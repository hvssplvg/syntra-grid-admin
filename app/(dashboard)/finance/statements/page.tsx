// app/(dashboard)/finance/statements/page.tsx
//
// A month-by-month bank statement, the way you would read it in the Monzo app
// but with everything on one screen and exportable for an accountant.
//
// State lives in the URL (?month=2026-07&direction=in&q=esteem) so a filtered
// view can be bookmarked or shared.

import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Download,
  FileText,
} from 'lucide-react';

import { requireFinanceAdmin } from '@/lib/auth/current-admin';

import { prisma } from '@/lib/prisma';

import { StatementControls } from './StatementControls';

export const dynamic = 'force-dynamic';

const WASH_SOFT =
  'linear-gradient(135deg, rgba(212,175,55,0.055), rgba(20,184,166,0.045)), #FAFAF9';

type SearchParams = {
  month?: string;
  direction?: string;
  q?: string;
};

/** "2026-07" → the first and last instant of that month. */
function monthRange(month: string | undefined) {
  const now = new Date();

  const parsed = month?.match(/^(\d{4})-(\d{2})$/);

  const year = parsed ? Number(parsed[1]) : now.getFullYear();
  const index = parsed ? Number(parsed[2]) - 1 : now.getMonth();

  const start = new Date(year, index, 1, 0, 0, 0, 0);
  const end = new Date(year, index + 1, 1, 0, 0, 0, 0);

  return { start, end, key: `${year}-${String(index + 1).padStart(2, '0')}` };
}

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireFinanceAdmin();
  const params = await searchParams;

  const connection = await prisma.monzoConnection.findUnique({
    where: { adminUserId: admin.id },
    select: { id: true, currency: true, accountDescription: true },
  });

  if (!connection) {
    return (
      <div className="space-y-6">
        <Breadcrumb />
        <p className="rounded-2xl border border-[#0B1020]/[0.06] bg-white p-6 text-sm text-[#5A6173]">
          No Monzo account is connected yet.
        </p>
      </div>
    );
  }

  const { start, end, key } = monthRange(params.month);
const direction: 'CREDIT' | 'DEBIT' | null =
  params.direction === 'in'
    ? 'CREDIT'
    : params.direction === 'out'
      ? 'DEBIT'
      : null;
  const search = params.q?.trim() ?? '';

  // Which months actually have data, so the picker only offers real options.
  const [earliest, latest] = await Promise.all([
    prisma.monzoTransaction.findFirst({
      where: { monzoConnectionId: connection.id },
      orderBy: { createdAtMonzo: 'asc' },
      select: { createdAtMonzo: true },
    }),
    prisma.monzoTransaction.findFirst({
      where: { monzoConnectionId: connection.id },
      orderBy: { createdAtMonzo: 'desc' },
      select: { createdAtMonzo: true },
    }),
  ]);

  const [rows, monthTotals] = await Promise.all([
    prisma.monzoTransaction.findMany({
 
      orderBy: { createdAtMonzo: 'desc' },
      take: 300,
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
        notes: true,
        createdAtMonzo: true,
        matchStatus: true,
      },
    }),

    // Totals ignore the search and direction filters — a statement summary
    // should describe the month, not the current view.
    prisma.monzoTransaction.groupBy({
      by: ['direction'],
      where: {
        monzoConnectionId: connection.id,
        createdAtMonzo: { gte: start, lt: end },
        status: { not: 'DECLINED' },
      },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
  ]);

  const totals = {
    in: Number(monthTotals.find((row) => row.direction === 'CREDIT')?._sum.amountMinor ?? 0),
    out: Number(monthTotals.find((row) => row.direction === 'DEBIT')?._sum.amountMinor ?? 0),
    count: monthTotals.reduce((sum, row) => sum + row._count._all, 0),
  };

  const currency = connection.currency;
  const grouped = groupByDay(rows);

  const exportUrl = `/api/monzo/statement.csv?month=${key}`;

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1020]">Statement</h1>
          <p className="mt-1 text-sm text-[#5A6173]">
            {connection.accountDescription || 'Monzo Business account'} ·{' '}
            {new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
              start,
            )}
          </p>
        </div>

        <a
          href={exportUrl}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-[#0B1020]/[0.08] bg-white px-4 text-xs font-bold text-[#5A6173] transition hover:text-[#0B1020]"
        >
          <Download size={14} />
          Export CSV
        </a>
      </header>

      {/* Month summary */}
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[#D4AF37]/15 bg-[#0B1020]/[0.06] sm:grid-cols-3">
        <Summary label="Money in" value={money(totals.in, currency)} tone="teal" />
        <Summary label="Money out" value={money(totals.out, currency)} tone="gold" />
        <Summary
          label="Net"
          value={`${totals.in - totals.out >= 0 ? '+' : '−'}${money(
            Math.abs(totals.in - totals.out),
            currency,
          )}`}
          hint={`${totals.count} ${totals.count === 1 ? 'transaction' : 'transactions'}`}
          tone={totals.in - totals.out >= 0 ? 'teal' : 'ink'}
        />
      </section>

      <StatementControls
        month={key}
        direction={params.direction ?? 'all'}
        query={search}
        earliest={earliest?.createdAtMonzo.toISOString() ?? null}
        latest={latest?.createdAtMonzo.toISOString() ?? null}
      />

      {/* Day-by-day list */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#0B1020]/10 bg-[#FAFAF9] px-6 py-12 text-center">
          <FileText size={22} className="mx-auto text-[#5A6173]/40" />
          <p className="mt-3 text-sm font-bold text-[#0B1020]">Nothing in this view</p>
          <p className="mt-1 text-xs text-[#5A6173]">
            {search || direction
              ? 'Try clearing the filters, or pick another month.'
              : 'No transactions were recorded in this month.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((day) => (
            <section
              key={day.key}
              className="overflow-hidden rounded-2xl border border-[#0B1020]/[0.06] bg-white"
            >
              <div
                className="flex items-center justify-between gap-4 border-b border-[#0B1020]/[0.06] px-5 py-3"
                style={{ background: WASH_SOFT }}
              >
                <p className="text-xs font-bold text-[#0B1020]">{day.label}</p>

                <p className="text-xs font-semibold tabular-nums text-[#5A6173]">
                  {day.in > 0 && (
                    <span className="text-[#0D9488]">+{money(day.in, currency)}</span>
                  )}
                  {day.in > 0 && day.out > 0 && ' · '}
                  {day.out > 0 && <span>−{money(day.out, currency)}</span>}
                </p>
              </div>

              <ul className="divide-y divide-[#0B1020]/[0.05]">
                {day.rows.map((row) => {
                  const incoming = row.direction === 'CREDIT';
                  const declined = row.status === 'DECLINED';

                  return (
                    <li key={row.id} className="flex items-center gap-4 px-5 py-3.5">
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
                        <p className="truncate text-sm font-bold text-[#0B1020]">
                          {row.merchantName ||
                            row.counterpartyName ||
                            row.description ||
                            'Transaction'}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-[#5A6173]">
                          {time(row.createdAtMonzo)}
                          {row.category ? ` · ${tidy(row.category)}` : ''}
                          {row.status === 'PENDING' ? ' · Pending' : ''}
                          {declined ? ' · Declined' : ''}
                          {row.notes ? ` · ${row.notes}` : ''}
                        </p>
                      </div>

                      {incoming && row.matchStatus === 'UNMATCHED' && !declined && (
                        <span className="hidden shrink-0 rounded-full bg-[#D4AF37]/12 px-2.5 py-1 text-[10px] font-bold text-[#A87B1B] sm:inline">
                          Unmatched
                        </span>
                      )}

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
                        {money(Number(row.amountMinor), row.currency)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {rows.length === 300 && (
            <p className="text-center text-xs text-[#5A6173]">
              Showing the first 300 transactions of this month. Export the CSV for the
              complete record.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

type Row = {
  id: string;
  amountMinor: bigint;
  currency: string;
  direction: string;
  status: string;
  description: string | null;
  merchantName: string | null;
  counterpartyName: string | null;
  category: string | null;
  notes: string | null;
  createdAtMonzo: Date;
  matchStatus: string;
};

function groupByDay(rows: Row[]) {
  const days = new Map<string, { key: string; label: string; in: number; out: number; rows: Row[] }>();

  for (const row of rows) {
    const key = row.createdAtMonzo.toDateString();

    const day =
      days.get(key) ??
      {
        key,
        label: new Intl.DateTimeFormat('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(row.createdAtMonzo),
        in: 0,
        out: 0,
        rows: [] as Row[],
      };

    if (row.status !== 'DECLINED') {
      if (row.direction === 'CREDIT') day.in += Number(row.amountMinor);
      else day.out += Number(row.amountMinor);
    }

    day.rows.push(row);
    days.set(key, day);
  }

  return [...days.values()];
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function time(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(
    date,
  );
}

function tidy(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* ───────────────────────── components ───────────────────────── */

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-[#5A6173]">
      <Link
        href="/finance"
        className="inline-flex items-center gap-1.5 font-semibold transition-colors hover:text-[#0D9488]"
      >
        <ArrowLeft size={14} />
        Finance
      </Link>
      <span className="text-[#5A6173]/35">/</span>
      <span className="font-medium text-[#0B1020]">Statement</span>
    </nav>
  );
}

function Summary({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'teal' | 'gold' | 'ink';
}) {
  const colour =
    tone === 'teal' ? 'text-[#0D9488]' : tone === 'gold' ? 'text-[#A87B1B]' : 'text-[#0B1020]';

  return (
    <div className="bg-white px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6173]">
        {label}
      </p>
      <p className={`mt-2 text-xl font-bold tabular-nums ${colour}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[#5A6173]">{hint}</p>}
    </div>
  );
}