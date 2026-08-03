// lib/monzo/transactions.ts
//
// Fetches transactions from Monzo and stores them as MonzoTransaction rows.
//
// Monzo notes:
// - Full history may only be available for a short period after the user
//   approves access in the Monzo app.
// - After that, transaction access may be limited to recent history.
// - Merchant information must be expanded using expand[]=merchant.

import type {
  BankTransactionDirection,
  BankTransactionStatus,
  Prisma,
} from '@/app/generated/prisma/client';

import { prisma } from '@/lib/prisma';

const MONZO_API_URL = 'https://api.monzo.com';
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

type MonzoMerchant = {
  name?: string;
  logo?: string;
  category?: string;
};

type MonzoCounterparty = {
  name?: string;
  account_number?: string;
  sort_code?: string;
};

type MonzoApiTransaction = {
  id: string;
  account_id: string;

  amount: number;
  currency: string;

  local_amount?: number;
  local_currency?: string;

  created: string;
  settled?: string;
  updated?: string;

  description: string;
  notes?: string;
  category?: string;

  is_load: boolean;
  include_in_spending?: boolean;

  decline_reason?: string;
  scheme?: string;

  counterparty?: MonzoCounterparty;

  /**
   * Monzo returns a merchant ID when the merchant is not expanded.
   * With expand[]=merchant, this can be a merchant object.
   */
  merchant?: MonzoMerchant | string | null;
};

type TransactionsResponse = {
  transactions: MonzoApiTransaction[];
};

type MonzoTransactionsError = {
  error?: string;
  message?: string;
  error_description?: string;
};

export type SyncResult = {
  imported: number;
  updated: number;
  oldest: Date | null;
  newest: Date | null;
};

/**
 * Retrieves one page of transactions.
 *
 * `since` can contain a timestamp or a Monzo transaction ID.
 */
async function fetchPage(
  accessToken: string,
  accountId: string,
  since?: string,
): Promise<MonzoApiTransaction[]> {
  const url = new URL(`${MONZO_API_URL}/transactions`);

  url.searchParams.set('account_id', accountId);
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.append('expand[]', 'merchant');

  if (since) {
    url.searchParams.set('since', since);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const responseText = await response.text();

  let parsed: TransactionsResponse | MonzoTransactionsError;

  try {
    parsed = JSON.parse(responseText) as
      | TransactionsResponse
      | MonzoTransactionsError;
  } catch {
    console.error('Monzo returned invalid transaction JSON:', {
      status: response.status,
      body: responseText.slice(0, 500),
    });

    throw new Error(
      'Monzo returned an invalid transactions response.',
    );
  }

  if (!response.ok) {
    const error = parsed as MonzoTransactionsError;

    console.error('Monzo transactions request failed:', {
      status: response.status,
      error: error.error,
      message: error.message,
      description: error.error_description,
    });

    if (response.status === 401) {
      throw new Error(
        'The Monzo connection has expired. Reconnect the account and try again.',
      );
    }

    if (response.status === 403) {
      throw new Error(
        'Monzo has not approved transaction access, or the full-history access window has closed. Approve access in the Monzo app and try again.',
      );
    }

    throw new Error(
      error.error_description ||
        error.message ||
        error.error ||
        'Unable to load Monzo transactions.',
    );
  }

  const result = parsed as TransactionsResponse;

  return result.transactions ?? [];
}

function getExpandedMerchant(
  value: MonzoApiTransaction['merchant'],
): MonzoMerchant | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value;
}

function getTransactionStatus(
  transaction: MonzoApiTransaction,
): BankTransactionStatus {
  if (transaction.decline_reason) {
    return 'DECLINED';
  }

  if (transaction.settled) {
    return 'SETTLED';
  }

  return 'PENDING';
}

function getTransactionDirection(
  amount: number,
): BankTransactionDirection {
  return amount >= 0 ? 'CREDIT' : 'DEBIT';
}

function parseMonzoDate(
  value: string | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toPrismaJson(
  value: unknown,
): Prisma.InputJsonValue {
  /*
   * JSON.stringify removes undefined properties, which Prisma JSON fields
   * do not accept.
   */
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Fetches Monzo transactions and stores them in PostgreSQL.
 *
 * Incremental sync:
 * Starts after the newest stored Monzo transaction.
 *
 * Full sync:
 * Starts without a `since` value and walks through all history that Monzo
 * currently makes available.
 */
export async function syncMonzoTransactions({
  accessToken,
  accountId,
  connectionId,
  full = false,
}: {
  accessToken: string;
  accountId: string;
  connectionId: string;
  full?: boolean;
}): Promise<SyncResult> {
  let since: string | undefined;

  if (!full) {
    const latestTransaction =
      await prisma.monzoTransaction.findFirst({
        where: {
          monzoConnectionId: connectionId,
          monzoAccountId: accountId,
        },
        orderBy: {
          createdAtMonzo: 'desc',
        },
        select: {
          monzoTransactionId: true,
        },
      });

    /*
     * Using the Monzo transaction ID prevents the boundary transaction from
     * being fetched repeatedly during incremental synchronisation.
     */
    since = latestTransaction?.monzoTransactionId;
  }

  let imported = 0;
  let updated = 0;
  let oldest: Date | null = null;
  let newest: Date | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await fetchPage(
      accessToken,
      accountId,
      since,
    );

    if (batch.length === 0) {
      break;
    }

    for (const transaction of batch) {
      const createdAtMonzo = parseMonzoDate(
        transaction.created,
      );

      if (!createdAtMonzo) {
        console.warn(
          'Skipping Monzo transaction with an invalid creation date:',
          transaction.id,
        );

        continue;
      }

      const merchant = getExpandedMerchant(
        transaction.merchant,
      );

      const direction = getTransactionDirection(
        transaction.amount,
      );

      const status = getTransactionStatus(transaction);

      const settledAt = parseMonzoDate(transaction.settled);

      const declinedAt = transaction.decline_reason
        ? createdAtMonzo
        : null;

      if (!oldest || createdAtMonzo < oldest) {
        oldest = createdAtMonzo;
      }

      if (!newest || createdAtMonzo > newest) {
        newest = createdAtMonzo;
      }

      /*
       * The database stores the absolute monetary value and uses `direction`
       * to distinguish incoming and outgoing transactions.
       */
      const transactionData = {
        monzoConnectionId: connectionId,
        monzoAccountId: transaction.account_id,

        amountMinor: BigInt(
          Math.abs(transaction.amount),
        ),

        localAmountMinor:
          transaction.local_amount !== undefined
            ? BigInt(Math.abs(transaction.local_amount))
            : null,

        currency: transaction.currency,
        localCurrency:
          transaction.local_currency ?? null,

        direction,
        status,

        description:
          transaction.description || null,

        merchantName:
          merchant?.name ?? null,

        merchantLogoUrl:
          merchant?.logo ?? null,

        merchantCategory:
          merchant?.category ?? null,

        category:
          transaction.category ?? null,

        notes:
          transaction.notes || null,

        declineReason:
          transaction.decline_reason ?? null,

        scheme:
          transaction.scheme ?? null,

        paymentMethod:
          transaction.scheme ?? null,

        counterpartyName:
          transaction.counterparty?.name ?? null,

        counterpartyNumber:
          transaction.counterparty?.account_number ?? null,

        counterpartySortCode:
          transaction.counterparty?.sort_code ?? null,

        isLoad:
          transaction.is_load,

        includeInSpending:
          transaction.include_in_spending ?? true,

        createdAtMonzo,
        settledAt,
        declinedAt,

        rawData: toPrismaJson(transaction),
      } satisfies Prisma.MonzoTransactionUncheckedUpdateInput;

      const existingTransaction =
        await prisma.monzoTransaction.findUnique({
          where: {
            monzoTransactionId: transaction.id,
          },
          select: {
            id: true,
          },
        });

      if (existingTransaction) {
        /*
         * Do not modify reconciliation fields such as matchStatus,
         * matchedClientId, matchedProjectId or matchedInvoiceId.
         * Those values belong to Syntra Grid rather than Monzo.
         */
        await prisma.monzoTransaction.update({
          where: {
            monzoTransactionId: transaction.id,
          },
          data: transactionData,
        });

        updated += 1;
      } else {
        await prisma.monzoTransaction.create({
          data: {
            monzoTransactionId: transaction.id,
            monzoConnectionId: connectionId,
            monzoAccountId: transaction.account_id,

            amountMinor: BigInt(
              Math.abs(transaction.amount),
            ),

            localAmountMinor:
              transaction.local_amount !== undefined
                ? BigInt(
                    Math.abs(transaction.local_amount),
                  )
                : null,

            currency: transaction.currency,
            localCurrency:
              transaction.local_currency ?? null,

            direction,
            status,

            description:
              transaction.description || null,

            merchantName:
              merchant?.name ?? null,

            merchantLogoUrl:
              merchant?.logo ?? null,

            merchantCategory:
              merchant?.category ?? null,

            category:
              transaction.category ?? null,

            notes:
              transaction.notes || null,

            declineReason:
              transaction.decline_reason ?? null,

            scheme:
              transaction.scheme ?? null,

            paymentMethod:
              transaction.scheme ?? null,

            counterpartyName:
              transaction.counterparty?.name ?? null,

            counterpartyNumber:
              transaction.counterparty?.account_number ??
              null,

            counterpartySortCode:
              transaction.counterparty?.sort_code ?? null,

            isLoad:
              transaction.is_load,

            includeInSpending:
              transaction.include_in_spending ?? true,

            createdAtMonzo,
            settledAt,
            declinedAt,

            rawData: toPrismaJson(transaction),
          },
        });

        imported += 1;
      }
    }

    if (batch.length < PAGE_SIZE) {
      break;
    }

    const lastTransaction = batch.at(-1);

    if (!lastTransaction) {
      break;
    }

    since = lastTransaction.id;
  }

  return {
    imported,
    updated,
    oldest,
    newest,
  };
}