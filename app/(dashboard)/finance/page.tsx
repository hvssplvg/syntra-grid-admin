// app/(dashboard)/finance/page.tsx
//
// Server component. Balance and transactions come from Postgres, not from a
// browser fetch — the page renders with real figures on first paint. Only the
// connect / select / sync controls and the payment-details card need to be
// interactive.

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Link2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { requireFinanceAdmin } from '@/lib/auth/current-admin';
import { prisma } from '@/lib/prisma';

import { MonzoPanel } from './MonzoPanel';
import { PaymentDetails, type InvoiceOption } from './PaymentDetails';

export const dynamic = 'force-dynamic';

// Theme tokens — keep in sync with Sidebar / Navbar / client pages.
// ink: #0B1020   muted: #5A6173   gold: #D4AF37 / #A87B1B   teal: #14B8A6 / #0D9488
const PREMIUM_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const WASH_SOFT =
  'linear-gradient(135deg, rgba(212,175,55,0.055), rgba(20,184,166,0.045)), #FAFAF9';

const MONTHS_SHOWN = 6;

/** Invoices that someone could still be chased for. */
const CHASEABLE = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] as const;

export default async function FinancePage() {
  const admin = await requireFinanceAdmin();

  const connection = await prisma.monzoConnection.findUnique({
    where: { adminUserId: admin.id },
    select: {
      id: true,
      active: true,
      accountId: true,
      accountDescription: true,
      accountNumberLast4: true,
      sortCodeLast4: true,
      currency: true,
      availableBalanceMinor: true,
      totalBalanceMinor: true,
      balanceUpdatedAt: true,
      connectedAt: true,
      lastSyncedAt: true,
      syncStatus: true,
      lastError: true,
    },
  });

  const connected = Boolean(connection?.active);
  const needsAccountSelection = connected && !connection?.accountId;
  const currency = connection?.currency ?? 'GBP';

  // Nothing to summarise until an account is chosen.
  if (!connected || needsAccountSelection || !connection) {
    return (
      <div className="space-y-7">
        <Header currency={currency} />
        <MonzoPanel
          connected={connected}
          needsAccountSelection={needsAccountSelection}
          hasTransactions={false}
          lastSyncedAt={connection?.lastSyncedAt?.toISOString() ?? null}
          syncStatus={connection?.syncStatus ?? 'IDLE'}
          lastError={connection?.lastError ?? null}
        />
      </div>
    );
  }

  const now = new Date();

  const windowStart = new Date(now);
  windowStart.setMonth(now.getMonth() - (MONTHS_SHOWN - 1));
  windowStart.setDate(1);
  windowStart.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const [
    monthlyRows,
    last30,
    recent,
    unmatchedIncoming,
    totalTransactions,
    openInvoices,
  ] = await Promise.all([
    prisma.monzoTransaction.findMany({
      where: {
        monzoConnectionId: connection.id,
        status: { not: 'DECLINED' },
        createdAtMonzo: { gte: windowStart },
      },
      select: { amountMinor: true, direction: true, createdAtMonzo: true },
    }),

    prisma.monzoTransaction.findMany({
      where: {
        monzoConnectionId: connection.id,
        status: { not: 'DECLINED' },
        createdAtMonzo: { gte: thirtyDaysAgo },
      },
      select: { amountMinor: true, direction: true },
    }),

    prisma.monzoTransaction.findMany({
      where: { monzoConnectionId: connection.id },
      orderBy: { createdAtMonzo: 'desc' },
      take: 12,
      select: {
        id: true,
        amountMinor: true,
        currency: true,
        direction: true,
        status: true,
        description: true,
        merchantName: true,
        counterpartyName: true,
        category: true,
        createdAtMonzo: true,
        matchStatus: true,
      },
    }),

    prisma.monzoTransaction.count({
      where: {
        monzoConnectionId: connection.id,
        direction: 'CREDIT',
        status: { not: 'DECLINED' },
        matchStatus: 'UNMATCHED',
        isLoad: false,
      },
    }),

    prisma.monzoTransaction.count({
      where: { monzoConnectionId: connection.id },
    }),

    // Feeds the payment-details card, so a message can carry the right
    // reference and amount.
    prisma.clientInvoice.findMany({
      where: { status: { in: [...CHASEABLE] } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 25,
      select: {
        id: true,
        invoiceRef: true,
        currency: true,
        balance: true,
        total: true,
        client: { select: { name: true, contactName: true } },
      },
    }),
  ]);

  const moneyIn = sum(last30, 'CREDIT');
  const moneyOut = sum(last30, 'DEBIT');
  const net = moneyIn - moneyOut;

  const monthly = buildMonthlySeries(monthlyRows, windowStart);
  const peak = Math.max(1, ...monthly.map((m) => Math.max(m.in, m.out)));

  // Prisma Decimal does not survive the server/client boundary — send strings.
  const invoices: InvoiceOption[] = openInvoices.map((invoice) => {
    const outstanding = Number(invoice.balance) > 0 ? invoice.balance : invoice.total;

    return {
      id: invoice.id,
      invoiceRef: invoice.invoiceRef,
      clientName: invoice.client.name,
      contactName: invoice.client.contactName,
      currency: invoice.currency,
      balance: outstanding.toString(),
    };
  });

  return (
    <div className="space-y-7">
      <Header currency={currency} />

      {/* Balance and 30-day flow */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BalanceCard
          label="Available"
          minor={connection.availableBalanceMinor}
          currency={currency}
          description="Ready to spend now"
          primary
        />

        <BalanceCard
          label="Total balance"
          minor={connection.totalBalanceMinor}
          currency={currency}
          description="Including money in Pots"
        />

        <FlowCard
          label="Money in"
          minor={moneyIn}
          currency={currency}
          description="Last 30 days"
          icon={ArrowDownLeft}
          tone="teal"
        />

        <FlowCard
          label="Money out"
          minor={moneyOut}
          currency={currency}
          description="Last 30 days"
          icon={ArrowUpRight}
          tone="gold"
        />
      </section>

      {/* Getting paid — sits high because it is the thing you act on */}
      <PaymentDetails invoices={invoices} />

      {totalTransactions === 0 ? (
        <EmptyTransactions />
      ) : (
        <>
          {/* Monthly trend */}
          <section className="rounded-3xl border border-[#D4AF37]/15 bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#0B1020]">
                  In and out by month
                </h2>
                <p className="mt-1 text-sm text-[#5A6173]">
                  The last {MONTHS_SHOWN} months of settled activity.
                </p>
              </div>

              <p
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                  net >= 0
                    ? 'bg-[#14B8A6]/10 text-[#0D9488]'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {net >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {net >= 0 ? 'Up' : 'Down'} {money(Math.abs(net), currency)} over 30 days
              </p>
            </div>

            <div className="mt-7 flex items-end gap-3 sm:gap-5">
              {monthly.map((month) => (
                <Link
                  key={month.label}
                  href={`/finance/statements?month=${month.href}`}
                  className="group flex flex-1 flex-col items-center gap-2 rounded-xl py-1 transition-colors hover:bg-[#FAFAF9]"
                  aria-label={`Open the ${month.label} statement`}
                >
                  <div className="flex h-40 w-full items-end justify-center gap-1.5">
                    <span
                      className="w-1/2 rounded-t-md bg-gradient-to-t from-[#0D9488] to-[#14B8A6] transition-opacity group-hover:opacity-85"
                      style={{ height: `${Math.max(2, (month.in / peak) * 100)}%` }}
                      title={`In ${money(month.in, currency)}`}
                    />
                    <span
                      className="w-1/2 rounded-t-md bg-gradient-to-t from-[#A87B1B] to-[#D4AF37] transition-opacity group-hover:opacity-85"
                      style={{ height: `${Math.max(2, (month.out / peak) * 100)}%` }}
                      title={`Out ${money(month.out, currency)}`}
                    />
                  </div>

                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5A6173] group-hover:text-[#0B1020]">
                    {month.label}
                  </p>
                </Link>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-[#0B1020]/[0.06] pt-4">
              <Legend colour="bg-[#14B8A6]" label="Money in" />
              <Legend colour="bg-[#D4AF37]" label="Money out" />

              <span className="ml-auto text-xs text-[#5A6173]">
                Select a month to open its statement.
              </span>
            </div>
          </section>

          {/* Unmatched payments */}
          {unmatchedIncoming > 0 && (
            <Link
              href="/finance/statements?direction=in"
              className="flex flex-col gap-3 rounded-2xl border border-[#D4AF37]/25 p-4 transition-colors hover:border-[#D4AF37]/40 sm:flex-row sm:items-center"
              style={{ background: WASH_SOFT }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/12 text-[#A87B1B]">
                <Link2 size={17} />
              </div>

              <p className="min-w-0 flex-1 text-sm text-[#5A6173]">
                <span className="font-bold text-[#0B1020]">
                  {unmatchedIncoming} incoming{' '}
                  {unmatchedIncoming === 1 ? 'payment has' : 'payments have'}
                </span>{' '}
                not been matched to a client or invoice yet.
              </p>

              <ArrowUpRight size={15} className="shrink-0 text-[#A87B1B]" />
            </Link>
          )}

          {/* Recent transactions */}
          <section className="rounded-3xl border border-[#D4AF37]/15 bg-white shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#0B1020]/[0.06] p-5 sm:p-6">
              <div>
                <h2 className="text-base font-bold text-[#0B1020]">
                  Recent transactions
                </h2>
                <p className="mt-1 text-sm text-[#5A6173]">
                  {totalTransactions.toLocaleString('en-GB')} imported in total.
                </p>
              </div>

              <Link
                href="/finance/statements"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#A87B1B] transition-colors hover:text-[#0B1020]"
              >
                Full statement
                <ArrowUpRight size={13} />
              </Link>
            </div>

            <ul className="divide-y divide-[#0B1020]/[0.05]">
              {recent.map((transaction) => {
                const incoming = transaction.direction === 'CREDIT';
                const declined = transaction.status === 'DECLINED';

                const name =
                  transaction.merchantName ||
                  transaction.counterpartyName ||
                  transaction.description ||
                  'Transaction';

                return (
                  <li
                    key={transaction.id}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#FAFAF9] sm:px-6"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        declined
                          ? 'bg-[#0B1020]/[0.05] text-[#5A6173]'
                          : incoming
                          ? 'bg-[#14B8A6]/10 text-[#0D9488]'
                          : 'bg-[#D4AF37]/12 text-[#A87B1B]'
                      }`}
                    >
                      {incoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#0B1020]">{name}</p>
                      <p className="mt-0.5 truncate text-xs text-[#5A6173]">
                        {formatDay(transaction.createdAtMonzo)}
                        {transaction.category ? ` · ${tidy(transaction.category)}` : ''}
                        {declined ? ' · Declined' : ''}
                      </p>
                    </div>

                    <p
                      className={`shrink-0 text-sm font-bold tabular-nums ${
                        declined
                          ? 'text-[#5A6173] line-through'
                          : incoming
                          ? 'text-[#0D9488]'
                          : 'text-[#0B1020]'
                      }`}
                    >
                      {incoming ? '+' : '−'}
                      {money(Number(transaction.amountMinor), transaction.currency)}
                    </p>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-[#0B1020]/[0.06] px-5 py-3.5 sm:px-6">
              <Link
                href="/finance/statements"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D9488] transition-colors hover:text-[#0B1020]"
              >
                View all transactions by month
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </section>
        </>
      )}

      <MonzoPanel
        connected
        needsAccountSelection={false}
        hasTransactions={totalTransactions > 0}
        accountDescription={connection.accountDescription}
        accountNumberLast4={connection.accountNumberLast4}
        sortCodeLast4={connection.sortCodeLast4}
        lastSyncedAt={connection.lastSyncedAt?.toISOString() ?? null}
        syncStatus={connection.syncStatus}
        lastError={connection.lastError}
      />
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function sum(
  rows: { amountMinor: bigint; direction: string }[],
  direction: 'CREDIT' | 'DEBIT',
) {
  return rows
    .filter((row) => row.direction === direction)
    .reduce((total, row) => total + Number(row.amountMinor), 0);
}

function buildMonthlySeries(
  rows: { amountMinor: bigint; direction: string; createdAtMonzo: Date }[],
  start: Date,
) {
  const buckets = Array.from({ length: MONTHS_SHOWN }, (_, index) => {
    const month = new Date(start);
    month.setMonth(start.getMonth() + index);

    return {
      key: `${month.getFullYear()}-${month.getMonth()}`,
      // Matches the ?month= format the statement page parses.
      href: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(month),
      in: 0,
      out: 0,
    };
  });

  const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const row of rows) {
    const key = `${row.createdAtMonzo.getFullYear()}-${row.createdAtMonzo.getMonth()}`;
    const bucket = index.get(key);
    if (!bucket) continue;

    if (row.direction === 'CREDIT') bucket.in += Number(row.amountMinor);
    else bucket.out += Number(row.amountMinor);
  }

  return buckets;
}

function money(minor: number | bigint | null, currency: string) {
  if (minor === null) return '—';

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(minor) / 100);
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function tidy(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* ───────────────────────── components ───────────────────────── */

function Header({ currency }: { currency: string }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <Landmark size={14} className="text-[#A87B1B]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A87B1B]">
            Business banking
          </p>
        </div>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0B1020]">Finance</h1>

        <p className="mt-1 max-w-xl text-sm leading-6 text-[#5A6173]">
          Money moving through the Syntra Grid Monzo Business account, in {currency}.
        </p>
      </div>

      <Link
        href="/finance/statements"
        className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-[#0B1020]/[0.08] bg-white px-4 text-xs font-bold text-[#5A6173] transition-colors hover:text-[#0B1020]"
      >
        <Landmark size={14} />
        Statements
      </Link>
    </header>
  );
}

function BalanceCard({
  label,
  minor,
  currency,
  description,
  primary = false,
}: {
  label: string;
  minor: bigint | null;
  currency: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-5 shadow-sm ${
        primary ? 'bg-[#0B1020] text-white' : 'border border-[#0B1020]/[0.06] bg-white'
      }`}
    >
      {primary && (
        <span
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg,#D4AF37,#14B8A6)' }}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
            primary ? 'text-white/55' : 'text-[#5A6173]'
          }`}
        >
          {label}
        </p>

        <Wallet size={16} className={primary ? 'text-[#D4AF37]' : 'text-[#5A6173]'} />
      </div>

      <p
        className={`mt-3 text-2xl font-bold tabular-nums ${
          primary ? 'text-white' : 'text-[#0B1020]'
        }`}
      >
        {minor === null ? 'Not synced' : money(minor, currency)}
      </p>

      <p className={`mt-1 text-xs ${primary ? 'text-white/55' : 'text-[#5A6173]'}`}>
        {description}
      </p>
    </div>
  );
}

function FlowCard({
  label,
  minor,
  currency,
  description,
  icon: Icon,
  tone,
}: {
  label: string;
  minor: number;
  currency: string;
  description: string;
  icon: React.ElementType;
  tone: 'teal' | 'gold';
}) {
  const theme =
    tone === 'teal'
      ? {
          bar: 'from-[#14B8A6] to-[#0D9488]',
          value: 'text-[#0D9488]',
          icon: 'bg-[#14B8A6]/10 text-[#0D9488]',
        }
      : {
          bar: 'from-[#D4AF37] to-[#A87B1B]',
          value: 'text-[#A87B1B]',
          icon: 'bg-[#D4AF37]/12 text-[#A87B1B]',
        };

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-[#0B1020]/[0.06] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(11,16,32,0.08)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{ transitionTimingFunction: PREMIUM_EASE }}
    >
      <span
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${theme.bar} opacity-70`}
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6173]">
          {label}
        </p>

        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${theme.icon}`}>
          <Icon size={15} />
        </span>
      </div>

      <p className={`mt-3 text-2xl font-bold tabular-nums ${theme.value}`}>
        {money(minor, currency)}
      </p>

      <p className="mt-1 text-xs text-[#5A6173]">{description}</p>
    </div>
  );
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#5A6173]">
      <span className={`h-2.5 w-2.5 rounded-full ${colour}`} />
      {label}
    </span>
  );
}

function EmptyTransactions() {
  return (
    <div className="rounded-3xl border border-dashed border-[#0B1020]/10 bg-[#FAFAF9] px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#A87B1B] shadow-sm ring-1 ring-[#D4AF37]/15">
        <AlertTriangle size={20} />
      </div>

      <p className="mt-4 text-sm font-bold text-[#0B1020]">No transactions imported</p>

      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#5A6173]">
        Balance is showing, but money in and out needs transaction history. Run a full
        import below. Monzo only allows the complete history for about five minutes after
        you approve in the app — after that you get the last 90 days.
      </p>
    </div>
  );
}