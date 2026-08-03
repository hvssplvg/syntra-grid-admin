'use client';

// app/(dashboard)/finance/MonzoPanel.tsx
//
// The interactive part of the finance page. Balance and transactions are
// rendered on the server; this handles connecting, choosing the account,
// and triggering a sync.

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';

type AccountOption = {
  id: string;
  description: string;
  type: string | null;
};

type Props = {
  connected: boolean;
  needsAccountSelection: boolean;
  hasTransactions: boolean;
  accountDescription?: string | null;
  accountNumberLast4?: string | null;
  sortCodeLast4?: string | null;
  lastSyncedAt: string | null;
  syncStatus: string;
  lastError: string | null;
};

type AccountsResponse = {
  accounts?: AccountOption[];
  error?: string;
};

type SyncResponse = {
  imported?: number;
  updated?: number;
  error?: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (!contentType.includes('application/json')) {
    console.error('Expected JSON response:', {
      status: response.status,
      contentType,
      body: text.slice(0, 300),
    });

    throw new Error(
      `The server returned an invalid response (${response.status}).`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('The server returned invalid JSON.');
  }
}

/**
 * Fetches the available Monzo accounts without modifying React state.
 *
 * Keeping this separate allows the effect to update state only in the
 * asynchronous completion callback.
 */
async function fetchMonzoAccounts(): Promise<AccountOption[]> {
  const response = await fetch('/api/monzo/accounts', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
    },
  });

  const result = await readJson<AccountsResponse>(response);

  if (!response.ok) {
    throw new Error(
      result.error || 'Unable to load your Monzo accounts.',
    );
  }

  return result.accounts ?? [];
}

function findPreferredAccount(accounts: AccountOption[]): string {
  if (accounts.length === 1) {
    return accounts[0].id;
  }

  const likelyBusinessAccount = accounts.find((account) => {
    const searchableValue = [
      account.description,
      account.type ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return (
      searchableValue.includes('business') ||
      searchableValue.includes('syntra')
    );
  });

  return likelyBusinessAccount?.id ?? '';
}

export function MonzoPanel(props: Props) {
  const router = useRouter();

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedId, setSelectedId] = useState('');

  /*
   * Start in the loading state when the server already knows that an account
   * selection is required. This avoids calling setLoadingAccounts(true)
   * synchronously from the effect.
   */
  const [loadingAccounts, setLoadingAccounts] = useState(
    props.needsAccountSelection,
  );

  const [selecting, setSelecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  /**
   * Used by the Reload button.
   *
   * This is called from a user event rather than an effect, so it may
   * immediately update the loading state.
   */
  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    setError('');
    setNotice('');

    try {
      const availableAccounts = await fetchMonzoAccounts();

      setAccounts(availableAccounts);
      setSelectedId(findPreferredAccount(availableAccounts));
    } catch (caught) {
      setAccounts([]);
      setSelectedId('');

      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load your Monzo accounts.',
      );
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (!props.needsAccountSelection) {
      return;
    }

    let cancelled = false;

    /*
     * The effect starts an external asynchronous request. State updates occur
     * only when that request settles, not synchronously in the effect body.
     */
    void fetchMonzoAccounts()
      .then((availableAccounts) => {
        if (cancelled) {
          return;
        }

        setAccounts(availableAccounts);
        setSelectedId(findPreferredAccount(availableAccounts));
        setError('');
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }

        setAccounts([]);
        setSelectedId('');

        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load your Monzo accounts.',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAccounts(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [props.needsAccountSelection]);

  async function selectAccount() {
    if (!selectedId) {
      setError('Choose the Syntra Grid Business account.');
      return;
    }

    setSelecting(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/monzo/account/select', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          accountId: selectedId,
        }),
      });

      const result = await readJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(
          result.error || 'Unable to select the account.',
        );
      }

      setNotice('The Syntra Grid Business account has been selected.');
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to select the account.',
      );
    } finally {
      setSelecting(false);
    }
  }

  async function sync(full: boolean) {
    setSyncing(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(
        '/api/monzo/transactions/sync',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            full,
          }),
        },
      );

      const result = await readJson<SyncResponse>(response);

      if (!response.ok) {
        throw new Error(result.error || 'Unable to sync Monzo.');
      }

      const imported = result.imported ?? 0;
      const updated = result.updated ?? 0;

      if (imported > 0) {
        setNotice(
          `${imported} new ${
            imported === 1 ? 'transaction' : 'transactions'
          } imported.`,
        );
      } else if (updated > 0) {
        setNotice(
          `${updated} existing ${
            updated === 1 ? 'transaction was' : 'transactions were'
          } updated.`,
        );
      } else {
        setNotice('Up to date. No new transactions.');
      }

      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to synchronise Monzo.',
      );
    } finally {
      setSyncing(false);
    }
  }

  /* ── Not connected ── */

  if (!props.connected) {
    return (
      <Panel>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B1020]/[0.04] text-[#5A6173]">
            <Unplug size={22} />
          </div>

          <h2 className="mt-4 text-base font-bold text-[#0B1020]">
            Monzo is not connected
          </h2>

          <p className="mt-1 max-w-md text-sm leading-6 text-[#5A6173]">
            Connect your Monzo login, then choose the business
            account. Your personal account is never selected for you.
          </p>

          <a
            href="/api/monzo/connect"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B1020] px-5 text-sm font-bold text-white transition hover:bg-[#151D34]"
          >
            <Landmark size={15} />
            Connect Monzo
            <ArrowUpRight size={14} />
          </a>
        </div>
      </Panel>
    );
  }

  /* ── Connected, awaiting account choice ── */

  if (props.needsAccountSelection) {
    return (
      <Panel>
        <h2 className="text-base font-bold text-[#0B1020]">
          Choose the business account
        </h2>

        <p className="mt-1 text-sm leading-6 text-[#5A6173]">
          Your Monzo login has more than one account. Picking the
          business one keeps your personal balance and spending out of
          Syntra Grid entirely.
        </p>

        {notice && <Alert tone="success" message={notice} />}
        {error && <Alert tone="error" message={error} />}

        {loadingAccounts ? (
          <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#5A6173]">
            <Loader2 size={15} className="animate-spin" />
            Loading your accounts
          </p>
        ) : (
          <>
            <div className="relative mt-5">
              <select
                value={selectedId}
                onChange={(event) =>
                  setSelectedId(event.target.value)
                }
                className="h-11 w-full appearance-none rounded-xl border border-[#0B1020]/[0.08] bg-[#FAFAF9] px-3.5 pr-10 text-sm font-semibold text-[#0B1020] outline-none focus:border-[#0D9488] focus:bg-white"
              >
                <option value="">Choose an account</option>

                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.description}
                    {account.type
                      ? ` — ${tidyType(account.type)}`
                      : ''}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A6173]"
              />
            </div>

            {accounts.length === 0 && !error && (
              <Alert
                tone="error"
                message="No available Monzo accounts were returned. Approve access in the Monzo app, then reload."
              />
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void selectAccount()}
                disabled={!selectedId || selecting}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B1020] px-4 text-sm font-bold text-white transition hover:bg-[#151D34] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {selecting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}

                {selecting ? 'Selecting' : 'Use this account'}
              </button>

              <button
                type="button"
                onClick={() => void loadAccounts()}
                disabled={loadingAccounts}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#0B1020]/[0.08] bg-white px-4 text-sm font-bold text-[#5A6173] transition hover:text-[#0B1020] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={
                    loadingAccounts ? 'animate-spin' : undefined
                  }
                />
                Reload
              </button>
            </div>
          </>
        )}
      </Panel>
    );
  }

  /* ── Connected and selected ── */

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#14B8A6]/10 text-[#0D9488]">
            <ShieldCheck size={18} />
          </div>

          <div>
            <h2 className="text-base font-bold text-[#0B1020]">
              {props.accountDescription ||
                'Monzo Business account'}
            </h2>

            <p className="mt-0.5 text-sm text-[#5A6173]">
              {props.sortCodeLast4
                ? `••-••-${props.sortCodeLast4} · `
                : ''}

              {props.accountNumberLast4
                ? `•••• ${props.accountNumberLast4} · `
                : ''}

              {props.lastSyncedAt
                ? `synced ${formatWhen(props.lastSyncedAt)}`
                : 'never synced'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void sync(false)}
            disabled={syncing}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B1020] px-4 text-xs font-bold text-white transition hover:bg-[#151D34] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={syncing ? 'animate-spin' : undefined}
            />

            {syncing ? 'Syncing' : 'Sync'}
          </button>

          {!props.hasTransactions && (
            <button
              type="button"
              onClick={() => void sync(true)}
              disabled={syncing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D4AF37]/25 bg-white px-4 text-xs font-bold text-[#A87B1B] transition hover:bg-[#D4AF37]/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import full history
            </button>
          )}

          <a
            href="/api/monzo/connect"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#0B1020]/[0.08] bg-white px-4 text-xs font-bold text-[#5A6173] transition hover:text-[#0B1020]"
          >
            Reconnect
          </a>
        </div>
      </div>

      {notice && <Alert tone="success" message={notice} />}
      {error && <Alert tone="error" message={error} />}

      {!error &&
        props.syncStatus === 'FAILED' &&
        props.lastError && (
          <Alert
            tone="error"
            message={`Last sync failed: ${props.lastError}`}
          />
        )}
    </Panel>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#D4AF37]/15 bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-6">
      {children}
    </section>
  );
}

function Alert({
  tone,
  message,
}: {
  tone: 'success' | 'error';
  message: string;
}) {
  const successful = tone === 'success';

  return (
    <div
      className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3.5 ${
        successful
          ? 'border-[#14B8A6]/25 bg-[#14B8A6]/[0.06] text-[#0D9488]'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {successful ? (
        <CheckCircle2
          size={15}
          className="mt-0.5 shrink-0"
        />
      ) : (
        <AlertCircle
          size={15}
          className="mt-0.5 shrink-0"
        />
      )}

      <p className="text-sm font-semibold">{message}</p>
    </div>
  );
}

function tidyType(value: string) {
  return value
    .replace(/^uk_/, '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatWhen(iso: string) {
  const timestamp = new Date(iso).getTime();

  if (Number.isNaN(timestamp)) {
    return 'at an unknown time';
  }

  const minutes = Math.max(
    0,
    Math.round((Date.now() - timestamp) / 60_000),
  );

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (minutes < 1440) {
    return `${Math.round(minutes / 60)}h ago`;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp));
}