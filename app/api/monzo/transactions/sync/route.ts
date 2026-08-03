// app/api/monzo/transactions/sync/route.ts
//
// POST { full?: boolean }
//
// Pulls transactions and refreshes the balance in one call. Pass full: true
// straight after connecting, while Monzo still allows the whole history.

import { NextRequest, NextResponse } from 'next/server';

import {
  AuthenticationError,
  AuthorisationError,
  requireFinanceAdmin,
} from '@/lib/auth/current-admin';
import { getMonzoBalance } from '@/lib/monzo';
import {
  describeMonzoError,
  getMonzoConnection,
  getValidAccessToken,
  MonzoReauthorisationRequiredError,
} from '@/lib/monzo/connection';
import { syncMonzoTransactions } from '@/lib/transactions';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // a full history walk is not fast

export async function POST(request: NextRequest) {
  let connectionId: string | undefined;

  try {
    const admin = await requireFinanceAdmin();
    const connection = await getMonzoConnection(admin.id);

    if (!connection?.active) {
      return NextResponse.json({ error: 'Monzo is not connected.' }, { status: 400 });
    }

    if (!connection.accountId) {
      return NextResponse.json(
        {
          error: 'Select the Syntra Grid Monzo Business account first.',
          needsAccountSelection: true,
        },
        { status: 400 },
      );
    }

    connectionId = connection.id;

    const body = (await request.json().catch(() => ({}))) as { full?: boolean };

    await prisma.monzoConnection.update({
      where: { id: connection.id },
      data: { syncStatus: 'SYNCING' },
    });

    const accessToken = await getValidAccessToken(connection);

    const [balance, result] = await Promise.all([
      getMonzoBalance(accessToken, connection.accountId),
      syncMonzoTransactions({
        accessToken,
        accountId: connection.accountId,
        connectionId: connection.id,
        full: body.full === true,
      }),
    ]);

    const now = new Date();

    await prisma.monzoConnection.update({
      where: { id: connection.id },
      data: {
        availableBalanceMinor: BigInt(balance.balance),
        totalBalanceMinor: BigInt(balance.total_balance),
        currency: balance.currency,
        balanceUpdatedAt: now,
        lastSyncedAt: now,
        lastSuccessfulAt: now,
        syncStatus: 'SUCCESS',
        lastError: null,
        lastErrorAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      imported: result.imported,
      updated: result.updated,
      oldest: result.oldest?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Monzo transaction sync failed:', error);

    if (connectionId) {
      await prisma.monzoConnection
        .update({
          where: { id: connectionId },
          data: {
            syncStatus: 'FAILED',
            lastError: describeMonzoError(error),
            lastErrorAt: new Date(),
          },
        })
        .catch(() => undefined);
    }

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
    }

    if (error instanceof AuthorisationError) {
      return NextResponse.json(
        { error: 'Only an owner, administrator or finance user can do this.' },
        { status: 403 },
      );
    }

    if (error instanceof MonzoReauthorisationRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ error: describeMonzoError(error) }, { status: 502 });
  }
}