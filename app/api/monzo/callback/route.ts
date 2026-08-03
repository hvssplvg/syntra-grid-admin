// app/api/monzo/callback/route.ts
//
// Fixes two things:
//   1. The old version upserted on `ownerId`, which does not exist on
//      MonzoConnection — the field is `adminUserId`. Every callback threw a
//      Prisma validation error and redirected to connection_failed.
//   2. It ignored the `monzo_oauth_admin` cookie that /api/monzo/connect
//      already sets, and used a hardcoded placeholder instead.

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/encryption';
import { exchangeMonzoAuthorisationCode } from '@/lib/monzo';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const callbackUrl = new URL(request.url);
  const financeUrl = new URL('/finance', request.url);

  const code = callbackUrl.searchParams.get('code');
  const monzoError = callbackUrl.searchParams.get('error');
  const returnedState = callbackUrl.searchParams.get('state');

  const storedState = request.cookies.get('monzo_oauth_state')?.value;
  const adminUserId = request.cookies.get('monzo_oauth_admin')?.value;

  // The admin declined at Monzo's consent screen.
  if (monzoError) {
    return finish(financeUrl, 'access_denied');
  }

  if (!code || !returnedState || !storedState || returnedState !== storedState) {
    return finish(financeUrl, 'invalid_state');
  }

  // Without this cookie there is no way to know which admin authorised, and
  // guessing would attach someone else's bank account to the wrong user.
  if (!adminUserId) {
    return finish(financeUrl, 'invalid_session');
  }

  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: { id: true, active: true },
    });

    if (!admin?.active) {
      return finish(financeUrl, 'invalid_session');
    }

    const token = await exchangeMonzoAuthorisationCode(code);

    const tokens = {
      monzoUserId: token.user_id,
      encryptedAccessToken: encryptSecret(token.access_token),
      encryptedRefreshToken: token.refresh_token
        ? encryptSecret(token.refresh_token)
        : null,
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    };

    await prisma.monzoConnection.upsert({
      where: { adminUserId: admin.id },
      update: {
        ...tokens,
        active: true,
        connectedAt: new Date(),
        disconnectedAt: null,
        syncStatus: 'IDLE',
        lastError: null,
        lastErrorAt: null,
        // Reconnecting may be a different Monzo login, so the previously
        // chosen account is no longer trustworthy. Force reselection.
        accountId: null,
        accountDescription: null,
        accountNumberLast4: null,
        sortCodeLast4: null,
        accountType: 'UNKNOWN',
        availableBalanceMinor: null,
        totalBalanceMinor: null,
        balanceUpdatedAt: null,
      },
      create: {
        adminUserId: admin.id,
        ...tokens,
      },
    });

    return finish(financeUrl, 'connected');
  } catch (error) {
    console.error('Monzo callback error:', error);
    return finish(financeUrl, 'connection_failed');
  }
}

function finish(financeUrl: URL, status: string) {
  financeUrl.searchParams.set('monzo', status);

  const response = NextResponse.redirect(financeUrl);
  response.cookies.delete('monzo_oauth_state');
  response.cookies.delete('monzo_oauth_admin');

  return response;
}