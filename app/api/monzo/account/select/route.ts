// app/api/monzo/account/select/route.ts
//
// This route did not exist either. It stores which Monzo account belongs to
// Syntra Grid, and pulls the first balance immediately so the finance page has
// something to show without a second click.

import { NextRequest, NextResponse } from 'next/server';

import {
  AuthenticationError,
  AuthorisationError,
  requireFinanceAdmin,
} from '@/lib/auth/current-admin';
import { getMonzoAccounts, getMonzoBalance } from '@/lib/monzo';
import {
  describeMonzoError,
  getMonzoConnection,
  getValidAccessToken,
  MonzoReauthorisationRequiredError,
} from '@/lib/monzo/connection';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BankAccountType = 'UK_RETAIL' | 'UK_BUSINESS' | 'UK_BUSINESS_KYC' | 'UNKNOWN';

function toAccountType(value: string | undefined): BankAccountType {
  switch (value) {
    case 'uk_retail':
    case 'uk_retail_joint':
      return 'UK_RETAIL';
    case 'uk_business':
      return 'UK_BUSINESS';
    case 'uk_business_kyc':
      return 'UK_BUSINESS_KYC';
    default:
      return 'UNKNOWN';
  }
}

function last4(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireFinanceAdmin();
    const connection = await getMonzoConnection(admin.id);

    if (!connection?.active) {
      return NextResponse.json({ error: 'Monzo is not connected.' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { accountId?: string };
    const accountId = body.accountId?.trim();

    if (!accountId) {
      return NextResponse.json(
        { error: 'Select the Syntra Grid Business account.' },
        { status: 400 },
      );
    }

    const accessToken = await getValidAccessToken(connection);

    // Never trust an ID posted from the browser — confirm it is genuinely one
    // of this connection's accounts before storing it.
    const accounts = await getMonzoAccounts(accessToken);
    const chosen = accounts.find((account) => account.id === accountId);

    if (!chosen) {
      return NextResponse.json(
        { error: 'That account is not available on this Monzo connection.' },
        { status: 400 },
      );
    }

    const balance = await getMonzoBalance(accessToken, chosen.id).catch((error) => {
      // Storing the choice still beats failing outright — the admin can sync
      // manually once Monzo has been approved in the app.
      console.error('Balance fetch after account selection failed:', error);
      return null;
    });

    const now = new Date();

    await prisma.monzoConnection.update({
      where: { id: connection.id },
      data: {
        accountId: chosen.id,
        accountDescription: chosen.description,
        accountType: toAccountType(chosen.type ?? chosen.account_type),
        accountNumberLast4: last4(chosen.account_number),
        sortCodeLast4: last4(chosen.sort_code),
        ...(balance
          ? {
              availableBalanceMinor: BigInt(balance.balance),
              totalBalanceMinor: BigInt(balance.total_balance),
              currency: balance.currency,
              balanceUpdatedAt: now,
              lastSyncedAt: now,
              lastSuccessfulAt: now,
              syncStatus: 'SUCCESS' as const,
              lastError: null,
              lastErrorAt: null,
            }
          : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
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

    console.error('Unable to select Monzo account:', error);

    return NextResponse.json({ error: describeMonzoError(error) }, { status: 502 });
  }
}