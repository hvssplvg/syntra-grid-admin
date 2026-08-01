// app/clients/page.tsx

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Database,
  Plug,
  Plus,
  ShieldCheck,
} from 'lucide-react';

import {
  getEsteemOverview,
  type EsteemOverview,
} from '@/lib/integrations/firebase/getOverview';
import { prisma } from '@/lib/prisma';
import { CLIENTS, daysUntil, type ClientRegistryEntry } from '@/lib/clients/registry';
import { ClientMark } from '@/lib/clients/ClientMark';

export const dynamic = 'force-dynamic';

// Theme tokens — keep in sync with Sidebar / Navbar / client detail page.
// ink: #0B1020   muted: #5A6173   gold: #D4AF37 / #A87B1B   teal: #14B8A6 / #0D9488
const PREMIUM_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const GOLD = 'linear-gradient(135deg,#F3DFA2,#D4AF37 60%,#C79A2A)';
const WASH_SOFT =
  'linear-gradient(135deg, rgba(212,175,55,0.06), rgba(20,184,166,0.05)), #FAFAF9';

type PlatformState = {
  status: 'connected' | 'disconnected' | 'not-connected';
  overview: EsteemOverview | null;
  error: string | null;
};

/** A single thing about a client that wants a decision. */
type Signal = {
  tone: 'critical' | 'warn' | 'info';
  text: string;
};

type ClientRow = ClientRegistryEntry & {
  platform: PlatformState;
  signals: Signal[];
  metrics: { label: string; value: number | string }[];
};

export default async function ClientsPage() {
  const esteemPlatform = await loadEsteem();

  // Clients recorded in Syntra Grid's own database.
  const databaseClients = await prisma.client.findMany({
    select: { id: true, name: true, slug: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const rows: ClientRow[] = CLIENTS.map((entry) =>
    buildRow(entry, entry.slug === 'esteem-learning-centre' ? esteemPlatform : notConnected()),
  );

  // Anything with a problem sorts to the top.
  const weight = (row: ClientRow) =>
    row.signals.some((signal) => signal.tone === 'critical')
      ? 0
      : row.signals.some((signal) => signal.tone === 'warn')
      ? 1
      : 2;
  rows.sort((a, b) => weight(a) - weight(b) || a.account.name.localeCompare(b.account.name));

  // Clients in the database that nothing on this page is wired up to render.
  const registrySlugs = new Set(CLIENTS.map((entry) => entry.slug));
  const unregistered = databaseClients.filter((client) => !registrySlugs.has(client.slug));

  const needingAttention = rows.filter((row) => row.signals.length > 0).length;
  const liveIntegrations = rows.filter(
    (row) => row.integrationLive && row.platform.status === 'connected',
  ).length;
  const renewalsSoon = rows.filter((row) => {
    const days = daysUntil(row.account.renewalAt);
    return days >= 0 && days <= 90;
  }).length;

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1020]">Clients</h1>
          <p className="mt-1 text-sm text-[#5A6173]">
            Every business Syntra Grid manages, and what each one needs today.
          </p>
        </div>

        <Link
          href="/clients/new"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl px-4 text-sm font-bold text-[#241A05] transition hover:brightness-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A87B1B] sm:self-auto"
          style={{ background: GOLD, boxShadow: '0 10px 26px rgba(212,175,55,0.3)' }}
        >
          <Plus size={15} aria-hidden />
          Add client
        </Link>
      </header>

      {/* Portfolio position */}
      <section
        aria-label="Portfolio summary"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-[#D4AF37]/15 bg-[#0B1020]/[0.06] shadow-[0_1px_2px_rgba(11,16,32,0.04)] lg:grid-cols-4"
      >
        <Stat
          label="Under management"
          value={rows.length}
          hint={`${rows.filter((row) => row.account.status === 'active').length} active, ${
            rows.filter((row) => row.account.status === 'onboarding').length
          } onboarding`}
        />
        <Stat
          label="Needing attention"
          value={needingAttention}
          hint={needingAttention === 0 ? 'Nothing outstanding' : 'See the cards below'}
          tone={needingAttention > 0 ? 'warn' : 'ok'}
        />
        <Stat
          label="Live integrations"
          value={`${liveIntegrations} of ${rows.length}`}
          hint="Reading real platform data"
          tone={liveIntegrations < rows.length ? 'muted' : 'ok'}
        />
        <Stat
          label="Renewals in 90 days"
          value={renewalsSoon}
          hint={renewalsSoon === 0 ? 'None due' : 'Start the conversation'}
          tone={renewalsSoon > 0 ? 'warn' : 'muted'}
        />
      </section>

      {/* Client cards */}
      <section aria-labelledby="systems-heading" className="space-y-4">
        <div>
          <h2 id="systems-heading" className="text-base font-bold text-[#0B1020]">
            Client systems
          </h2>
          <p className="mt-1 text-sm text-[#5A6173]">
            Anything needing a decision is listed first.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {rows.map((row) => (
            <ClientCard key={row.slug} row={row} />
          ))}
        </div>
      </section>

      {/* Clients in the database with no workspace wired up */}
      {unregistered.length > 0 && (
        <section aria-labelledby="unregistered-heading" className="space-y-3">
          <div>
            <h2 id="unregistered-heading" className="text-base font-bold text-[#0B1020]">
              Not yet wired up
            </h2>
            <p className="mt-1 text-sm text-[#5A6173]">
              Recorded in the Syntra Grid database, but with no workspace built for them
              yet. Add an entry to the client registry to give one a card above.
            </p>
          </div>

          <ul className="divide-y divide-[#0B1020]/[0.06] overflow-hidden rounded-2xl border border-[#0B1020]/[0.06] bg-white">
            {unregistered.map((client) => (
              <li
                key={client.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ClientMark logo={null} name={client.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#0B1020]">
                      {client.name}
                    </p>
                    <p className="truncate font-mono text-xs text-[#5A6173]">
                      {client.slug}
                    </p>
                  </div>
                </div>

                <span className="shrink-0 rounded-full bg-[#0B1020]/[0.05] px-2.5 py-1 text-[10px] font-bold text-[#5A6173]">
                  No workspace
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ───────────────────────── data ───────────────────────── */

async function loadEsteem(): Promise<PlatformState> {
  try {
    return { status: 'connected', overview: await getEsteemOverview(), error: null };
  } catch (error) {
    console.error('Could not load Esteem overview:', error);
    return {
      status: 'disconnected',
      overview: null,
      error:
        error instanceof Error
          ? error.message
          : 'Syntra Grid could not reach the school Firebase project.',
    };
  }
}

function notConnected(): PlatformState {
  return { status: 'not-connected', overview: null, error: null };
}

/**
 * Card-level signals. Deliberately lighter than the detail page's
 * buildAttentionItems — this is a summary, not the full list. When these two
 * start to drift, promote the logic into lib/clients and import it in both.
 */
function buildRow(entry: ClientRegistryEntry, platform: PlatformState): ClientRow {
  const signals: Signal[] = [];
  const { account } = entry;
  const data = platform.overview;

  if (entry.integrationLive && platform.status === 'disconnected') {
    signals.push({ tone: 'critical', text: 'Platform data unreachable' });
  }

  const pendingExams = data?.pendingExamRequests ?? 0;
  if (pendingExams > 0) {
    signals.push({
      tone: 'warn',
      text: `${pendingExams} exam ${pendingExams === 1 ? 'paper' : 'papers'} to print`,
    });
  }

  if (account.support.openTickets > 0) {
    signals.push({
      tone: 'warn',
      text: `${account.support.openTickets} open ${
        account.support.openTickets === 1 ? 'ticket' : 'tickets'
      }`,
    });
  }

  if (account.billing.outstandingAmount > 0) {
    signals.push({
      tone: account.billing.lastInvoiceStatus === 'overdue' ? 'critical' : 'warn',
      text:
        account.billing.lastInvoiceStatus === 'overdue'
          ? 'Invoice overdue'
          : 'Invoice unpaid',
    });
  }

  const renewalDays = daysUntil(account.renewalAt);
  if (renewalDays < 0) {
    signals.push({ tone: 'critical', text: 'Subscription lapsed' });
  } else if (renewalDays <= 90) {
    signals.push({
      tone: renewalDays <= 30 ? 'warn' : 'info',
      text: `Renews in ${renewalDays} days`,
    });
  }

  const metrics =
    entry.dataSource === 'firebase'
      ? [
          { label: 'Students', value: data?.students ?? '—' },
          { label: 'Teachers', value: data?.teachers ?? '—' },
          { label: 'Lesson plans', value: data?.lessonPlans ?? '—' },
          { label: 'Pending exams', value: data?.pendingExamRequests ?? '—' },
        ]
      : [
          { label: 'Users', value: '—' },
          { label: 'Properties', value: '—' },
          { label: 'Verifications', value: '—' },
          { label: 'Listings', value: '—' },
        ];

  return { ...entry, platform, signals, metrics };
}

/* ───────────────────────── components ───────────────────────── */

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  hint: string;
  tone?: 'default' | 'ok' | 'warn' | 'muted';
}) {
  const valueClass =
    tone === 'warn'
      ? 'text-amber-600'
      : tone === 'ok'
      ? 'text-[#0D9488]'
      : tone === 'muted'
      ? 'text-[#5A6173]'
      : 'text-[#0B1020]';

  return (
    <div className="bg-white px-5 py-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6173]">
        {label}
      </p>
      <p className={`mt-2.5 text-3xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-[#5A6173]">{hint}</p>
    </div>
  );
}

const STATUS_PILL = {
  active: { label: 'Active client', className: 'bg-[#14B8A6]/10 text-[#0D9488]', dot: 'bg-[#14B8A6]' },
  onboarding: { label: 'Onboarding', className: 'bg-[#D4AF37]/12 text-[#A87B1B]', dot: 'bg-[#D4AF37]' },
  suspended: { label: 'Suspended', className: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  churned: { label: 'Churned', className: 'bg-[#0B1020]/[0.06] text-[#5A6173]', dot: 'bg-[#5A6173]' },
} as const;

const SIGNAL_PILL = {
  critical: 'bg-red-50 text-red-700',
  warn: 'bg-amber-50 text-amber-700',
  info: 'bg-[#D4AF37]/10 text-[#A87B1B]',
} as const;

function ClientCard({ row }: { row: ClientRow }) {
  const { account, platform, signals, metrics } = row;
  const href = `/clients/${row.slug}`;
  const status = STATUS_PILL[account.status];
  const worst = signals.some((signal) => signal.tone === 'critical')
    ? 'critical'
    : signals.some((signal) => signal.tone === 'warn')
    ? 'warn'
    : null;

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(11,16,32,0.08)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        worst === 'critical'
          ? 'border-red-200'
          : worst === 'warn'
          ? 'border-amber-200'
          : 'border-[#0B1020]/[0.06] hover:border-[#D4AF37]/25'
      }`}
      style={{ transitionTimingFunction: PREMIUM_EASE }}
    >
      <div className="flex-1 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <ClientMark logo={account.logo} name={account.name} size="lg" />

            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-[#0B1020]">
                {account.name}
              </h3>
              <p className="mt-0.5 text-sm text-[#5A6173]">{account.productName}</p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0B1020]/[0.07] bg-white px-2.5 py-1 text-[10px] font-bold text-[#5A6173]">
                  <Database size={10} aria-hidden />
                  {account.clientRef}
                </span>
              </div>
            </div>
          </div>

          <Link
            href={href}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1020]/[0.04] text-[#5A6173] transition-colors group-hover:bg-[#0B1020] group-hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
            aria-label={`Open ${account.name}`}
          >
            <ArrowUpRight size={16} aria-hidden />
          </Link>
        </div>

        {/* Signals */}
        <div className="mt-5">
          {signals.length === 0 ? (
            <p
              className="inline-flex items-center gap-2 rounded-xl border border-[#14B8A6]/20 px-3 py-2 text-xs font-semibold text-[#5A6173]"
              style={{ background: WASH_SOFT }}
            >
              <CheckCircle2 size={13} className="text-[#0D9488]" aria-hidden />
              Nothing outstanding
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {signals.map((signal) => (
                <li
                  key={signal.text}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    SIGNAL_PILL[signal.tone]
                  }`}
                >
                  {signal.tone === 'info' ? (
                    <CalendarClock size={11} aria-hidden />
                  ) : (
                    <AlertTriangle size={11} aria-hidden />
                  )}
                  {signal.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        {platform.error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
            {platform.error}
          </p>
        )}

        {/* Metrics */}
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-[#0B1020]/[0.05] p-3"
              style={{ background: WASH_SOFT }}
            >
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6173]">
                {metric.label}
              </dt>
              <dd className="mt-1.5 text-xl font-bold tabular-nums text-[#0B1020]">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        {!row.integrationLive && (
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-[#5A6173]">
            <Plug size={12} aria-hidden />
            {account.name} integration is not connected yet, so these figures are
            placeholders.
          </p>
        )}
      </div>

      <Link
        href={href}
        className="flex items-center justify-between border-t border-[#0B1020]/[0.06] px-5 py-3.5 text-xs font-bold text-[#0D9488] transition-colors hover:bg-[#0B1020]/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0D9488] sm:px-6"
        style={{ background: WASH_SOFT }}
      >
        Open client workspace
        <ArrowRight size={14} aria-hidden />
      </Link>
    </article>
  );
}