// app/api/monzo/status/route.ts
//
// Was a stub returning { connected: false } unconditionally, which made the
// finance page permanently show the not-connected state.

import { NextResponse } from 'next/server';

import {
  AuthenticationError,
  AuthorisationError,
  requireFinanceAdmin,
} from '@/lib/auth/current-admin';
import { getMonzoConnection } from '@/lib/monzo/connection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = await requireFinanceAdmin();
    const connection = await getMonzoConnection(admin.id);

    if (!connection || !connection.active) {
      return NextResponse.json({ connected: false });
    }

    // Authorised, but no account chosen yet — the UI shows the picker.
    if (!connection.accountId) {
      return NextResponse.json({
        connected: true,
        needsAccountSelection: true,
      });
    }

    return NextResponse.json({
      connected: true,
      needsAccountSelection: false,
      account: {
        description: connection.accountDescription,
        accountNumberLast4: connection.accountNumberLast4,
        sortCodeLast4: connection.sortCodeLast4,
        currency: connection.currency,
        // BigInt does not survive JSON.stringify — send as strings, which is
        // what the client already parses.
        availableBalanceMinor:
          connection.availableBalanceMinor?.toString() ?? null,
        totalBalanceMinor: connection.totalBalanceMinor?.toString() ?? null,
        connectedAt: connection.connectedAt.toISOString(),
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
    }

    if (error instanceof AuthorisationError) {
      return NextResponse.json(
        { error: 'Only an owner, administrator or finance user can view this.' },
        { status: 403 },
      );
    }

    console.error('Monzo status check failed:', error);

    return NextResponse.json(
      { error: 'Unable to check the Monzo connection.' },
      { status: 500 },
    );
  }
}