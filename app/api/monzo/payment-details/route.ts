// app/api/monzo/payment-details/route.ts
//
// Returns everything a client needs to pay you, in two forms:
//
//   UK            — sort code and account number, fetched live from Monzo.
//   International — IBAN and BIC. Monzo's public API does not appear to expose
//                   these, so they come from environment variables. If a
//                   future API response does include them, they win.
//
// None of this is secret; it appears on every invoice. It is fetched on demand
// rather than stored so the full account number is not sitting at rest.
//
// Environment variables (copy the values from the Monzo app, Account details →
// International):
//
//   MONZO_IBAN=GB00MONZ00000000000000
//   MONZO_BIC=MONZGB2L
//   MONZO_BANK_NAME=Monzo Bank Limited
//   MONZO_BANK_ADDRESS=Broadwalk House, 5 Appold Street, London, EC2A 2AG
//   MONZO_BENEFICIARY_ADDRESS=Your registered business address

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

function formatSortCode(value: string | undefined): string | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, '');
  if (digits.length !== 6) return value;

  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

/** IBANs are conventionally shown in groups of four. */
function formatIban(value: string | undefined | null): string | null {
  if (!value) return null;

  const compact = value.replace(/\s+/g, '').toUpperCase();
  return compact.replace(/(.{4})/g, '$1 ').trim();
}

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export async function GET() {
  try {
    const admin = await requireFinanceAdmin();
    const connection = await getMonzoConnection(admin.id);

    if (!connection?.active || !connection.accountId) {
      return NextResponse.json(
        { error: 'No Monzo business account is selected.' },
        { status: 400 },
      );
    }

    const accessToken = await getValidAccessToken(connection);
    const accounts = await getMonzoAccounts(accessToken);
    const account = accounts.find((item) => item.id === connection.accountId);

    if (!account) {
      return NextResponse.json(
        { error: 'The selected account is no longer available on this Monzo login.' },
        { status: 400 },
      );
    }

    // Business accounts name the entity in `description`; personal accounts
    // fall back to the account owner.
    const accountName =
      account.description || account.owners?.[0]?.preferred_name || 'Syntra Grid';

    // Monzo is not documented as returning these, but read them if they appear
    // rather than ignoring a perfectly good value.
    const apiExtras = account as unknown as { iban?: string; bic?: string };

    const iban = formatIban(apiExtras.iban ?? env('MONZO_IBAN'));
    const bic = (apiExtras.bic ?? env('MONZO_BIC'))?.toUpperCase() ?? null;

    return NextResponse.json({
      accountName,
      currency: connection.currency,

      uk: {
        sortCode: formatSortCode(account.sort_code),
        accountNumber: account.account_number ?? null,
      },

      international: {
        iban,
        bic,
        bankName: env('MONZO_BANK_NAME'),
        bankAddress: env('MONZO_BANK_ADDRESS'),
        beneficiaryAddress: env('MONZO_BENEFICIARY_ADDRESS'),
        // Drives the "not configured yet" state in the UI.
        available: Boolean(iban && bic),
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

    if (error instanceof MonzoReauthorisationRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Unable to load Monzo payment details:', error);

    return NextResponse.json({ error: describeMonzoError(error) }, { status: 502 });
  }
}