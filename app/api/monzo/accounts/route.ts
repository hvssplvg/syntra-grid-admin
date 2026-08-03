// app/api/monzo/accounts/route.ts
//
// This route did not exist. The client fetched it, Next returned an HTML 404,
// and readJsonResponse correctly reported "an invalid response (404)".

import { NextResponse } from 'next/server';

import {
  AuthenticationError,
  AuthorisationError,
  requireFinanceAdmin,
} from '@/lib/auth/current-admin';
import { getMonzoAccounts } from '@/lib/monzo';
import {
  describeMonzoError,
  getMonzoConnection,
  getValidAccessToken,
  MonzoReauthorisationRequiredError,
} from '@/lib/monzo/connection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = await requireFinanceAdmin();
    const connection = await getMonzoConnection(admin.id);

    if (!connection?.active) {
      return NextResponse.json({ error: 'Monzo is not connected.' }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(connection);
    const accounts = await getMonzoAccounts(accessToken);

    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        description: account.description,
        type: account.type ?? account.account_type ?? null,
      })),
    });
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

    console.error('Unable to load Monzo accounts:', error);

    return NextResponse.json({ error: describeMonzoError(error) }, { status: 502 });
  }
}