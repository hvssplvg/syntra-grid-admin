// app/(dashboard)/dashboard/page.tsx

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleSlash,
  Clock,
  Database,
  FolderKanban,
  Headphones,
  Plug,
  Plus,
  Server,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { prisma } from '@/lib/prisma';
import {
  getEsteemOverview,
  type EsteemOverview,
} from '@/lib/integrations/firebase/getOverview';

export const dynamic = 'force-dynamic';

// Theme tokens — keep in sync with Sidebar / Navbar / client pages.
// ink: #0B1020   muted: #5A6173   gold: #D4AF37 / #A87B1B   teal: #14B8A6 / #0D9488
const PREMIUM_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const WASH_SOFT =
  'linear-gradient(135deg, rgba(212,175,55,0.055), rgba(20,184,166,0.045)), #FAFAF9';

const PROJECT_STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: '#14B8A6' },
  DEVELOPMENT: { label: 'Development', color: '#D4AF37' },
  TESTING: { label: 'Testing', color: '#6366F1' },
  MAINTENANCE: { label: 'Maintenance', color: '#F59E0B' },
  PAUSED: { label: 'Paused', color: '#94A3B8' },
  ARCHIVED: { label: 'Archived', color: '#64748B' },
} as const;

const TICKET_STATUS_CONFIG = {
  OPEN: { label: 'Open', color: '#EF4444' },
  IN_PROGRESS: { label: 'In progress', color: '#F59E0B' },
  WAITING_FOR_CLIENT: { label: 'Waiting on client', color: '#6366F1' },
  RESOLVED: { label: 'Resolved', color: '#14B8A6' },
  CLOSED: { label: 'Closed', color: '#64748B' },
} as const;

const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CLIENT'] as const;

export default async function DashboardPage() {
  const now = new Date();

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const [
    totalClients,
    activeClients,
    totalProjects,
    activeProjects,
    integrations,
    openTickets,
    urgentTickets,
    staleTickets,
    ticketsCreated7d,
    ticketStatusGroups,
    projectStatusGroups,
    clients,
    esteem,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { status: 'ACTIVE' } }),
    prisma.project.count(),
    prisma.project.count({ where: { status: 'ACTIVE' } }),

    // Integration belongs to Project, and Project belongs to Client — so the
    // client id comes through the relation rather than sitting on the row.
    prisma.integration.findMany({
      select: {
        id: true,
        status: true,
        lastError: true,
        project: { select: { clientId: true } },
      },
    }),

    prisma.supportTicket.count({ where: { status: { in: [...OPEN_STATUSES] } } }),

    prisma.supportTicket.count({
      where: { priority: 'URGENT', status: { in: [...OPEN_STATUSES] } },
    }),

    // Open for more than a week — the ones quietly going stale.
    prisma.supportTicket.count({
      where: {
        status: { in: [...OPEN_STATUSES] },
        createdAt: { lt: sevenDaysAgo },
      },
    }),

    prisma.supportTicket.count({ where: { createdAt: { gte: sevenDaysAgo } } }),

    prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),

    prisma.client.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        projects: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, status: true, databaseType: true },
        },
        _count: { select: { projects: true, tickets: true } },
      },
    }),

    loadEsteem(),
  ]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const connectedIntegrations = integrations.filter(
    (integration) => integration.status === 'CONNECTED',
  ).length;

  const brokenIntegrations = integrations.length - connectedIntegrations;

  const integrationsByClient = new Map<string, { total: number; connected: number }>();

  for (const integration of integrations) {
    const clientId = integration.project?.clientId;
    if (!clientId) continue; // integration with no project — nothing to attribute it to

    const entry = integrationsByClient.get(clientId) ?? { total: 0, connected: 0 };
    entry.total += 1;
    if (integration.status === 'CONNECTED') entry.connected += 1;
    integrationsByClient.set(clientId, entry);
  }

  const clientsWithoutIntegration = clients.filter(
    (client) => !integrationsByClient.has(client.id),
  );

  const ticketSegments = toSegments(ticketStatusGroups, TICKET_STATUS_CONFIG);
  const projectSegments = toSegments(projectStatusGroups, PROJECT_STATUS_CONFIG);
  const totalTickets = ticketSegments.reduce((sum, item) => sum + item.value, 0);

  // Live platform users across every connected client system.
  const livePlatformUsers = esteem.ok
    ? (esteem.data.students ?? 0) + (esteem.data.teachers ?? 0) + (esteem.data.admins ?? 0)
    : null;

  const attention = buildAttention({
    esteemFailed: !esteem.ok,
    esteemError: esteem.ok ? null : esteem.error,
    brokenIntegrations,
    urgentTickets,
    staleTickets,
    clientsWithoutIntegration: clientsWithoutIntegration.map((client) => client.name),
  });

  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/15 p-6 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-8"
        style={{
          background:
            'radial-gradient(120% 160% at 100% 0%, rgba(20,184,166,0.07), transparent 55%), radial-gradient(110% 150% at 0% 100%, rgba(212,175,55,0.09), transparent 50%), #FFFFFF',
        }}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#14B8A6] shadow-[0_0_0_5px_rgba(20,184,166,0.12)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A87B1B]">
                Syntra Grid Operations
              </p>
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0B1020] sm:text-3xl">
              {attention.length === 0
                ? 'Everything is running'
                : attention.length === 1
                ? '1 thing needs you'
                : `${attention.length} things need you`}
            </h1>

            <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#5A6173]">
              {today} · Live across every client platform managed by Syntra Grid.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/clients/new"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B1020] px-4 text-xs font-bold text-white shadow-[0_8px_24px_rgba(11,16,32,0.18)] transition hover:-translate-y-0.5 hover:bg-[#151D34] motion-reduce:hover:translate-y-0"
              style={{ transitionTimingFunction: PREMIUM_EASE }}
            >
              <Plus size={13} aria-hidden />
              Add client
            </Link>

            <Link
              href="/clients"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#0B1020]/[0.08] bg-white px-4 text-xs font-bold text-[#5A6173] shadow-sm transition hover:border-[#D4AF37]/30 hover:text-[#0B1020]"
            >
              <Building2 size={13} aria-hidden />
              All clients
            </Link>
          </div>
        </div>
      </header>

      {/* ── Needs attention ────────────────────────────────────────────── */}
      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="sr-only">
          Needs attention
        </h2>

        {attention.length === 0 ? (
          <div
            className="flex items-center gap-3 rounded-2xl border border-[#14B8A6]/20 p-4"
            style={{ background: WASH_SOFT }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#14B8A6]/12 text-[#0D9488]">
              <ShieldCheck size={17} aria-hidden />
            </div>
            <p className="text-sm text-[#5A6173]">
              All integrations connected, no urgent or stale tickets.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {attention.map((item) => (
              <li key={item.title}>
                <AttentionRow {...item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Clients"
          value={totalClients}
          description={
            totalClients === 0
              ? 'None added yet'
              : `${activeClients} active · ${totalClients - activeClients} other`
          }
          icon={Building2}
          accent="gold"
          href="/clients"
        />

        <KpiCard
          label="Live integrations"
          value={
            integrations.length === 0
              ? '—'
              : `${connectedIntegrations}/${integrations.length}`
          }
          description={
            integrations.length === 0
              ? 'No data sources connected'
              : brokenIntegrations > 0
              ? `${brokenIntegrations} not connecting`
              : 'All reading live data'
          }
          icon={Plug}
          accent={brokenIntegrations > 0 ? 'red' : 'teal'}
          href="/clients"
        />

        <KpiCard
          label="Open tickets"
          value={openTickets}
          description={
            openTickets === 0
              ? `${ticketsCreated7d} raised this week`
              : `${urgentTickets} urgent · ${staleTickets} over a week old`
          }
          icon={Headphones}
          accent={urgentTickets > 0 ? 'red' : 'teal'}
          href="/support"
        />

        <KpiCard
          label="Platform users"
          value={livePlatformUsers ?? '—'}
          description={
            livePlatformUsers === null
              ? 'Client platform unreachable'
              : 'People using client systems today'
          }
          icon={Users}
          accent="gold"
          href="/clients"
        />
      </section>

      {/* ── Client systems + support ───────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <DashboardPanel>
          <PanelHeading
            title="Client systems"
            description="Every business managed through Syntra Grid."
            icon={Server}
            action={
              <Link
                href="/clients"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#A87B1B] transition hover:text-[#0B1020]"
              >
                View all
                <ArrowRight size={13} aria-hidden />
              </Link>
            }
          />

          {clients.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No clients yet"
              description="Add your first client to start monitoring their platform, projects and support."
              href="/clients/new"
              action="Add first client"
            />
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {clients.map((client) => (
                <ClientCard
                  key={client.id}
                  id={client.id}
                  name={client.name}
                  industry={client.industry || 'Custom software platform'}
                  country={client.country}
                  status={client.status}
                  projectCount={client._count.projects}
                  ticketCount={client._count.tickets}
                  projects={client.projects}
                  integration={integrationsByClient.get(client.id) ?? null}
                />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel>
          <PanelHeading
            title="Support workload"
            description="Requests by status."
            icon={Headphones}
            action={
              <Link
                href="/support"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#A87B1B] transition hover:text-[#0B1020]"
              >
                Open
                <ArrowUpRight size={13} aria-hidden />
              </Link>
            }
          />

          {totalTickets === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#0B1020]/10 bg-[#FAFAF9] px-5 py-10 text-center">
              <CheckCircle2 size={22} className="mx-auto text-[#0D9488]/50" aria-hidden />
              <p className="mt-3 text-sm font-bold text-[#0B1020]">No tickets raised</p>
              <p className="mt-1 text-xs text-[#5A6173]">
                Support requests will appear here as clients report them.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-7 flex justify-center">
                <DonutChart
                  segments={ticketSegments}
                  total={totalTickets}
                  centreLabel="Tickets"
                />
              </div>

              <div className="mt-6">
                <ChartLegend segments={ticketSegments} />
              </div>

              {staleTickets > 0 && (
                <p className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  <Clock size={13} className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    {staleTickets} {staleTickets === 1 ? 'ticket has' : 'tickets have'} been
                    open for more than a week.
                  </span>
                </p>
              )}
            </>
          )}
        </DashboardPanel>
      </section>

      {/* ── Project distribution: only when there is something to show ─── */}
      {totalProjects > 0 && (
        <section>
          <DashboardPanel>
            <PanelHeading
              title="Project distribution"
              description={`${activeProjects} of ${totalProjects} projects are live.`}
              icon={FolderKanban}
              action={
                <Link
                  href="/projects"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#A87B1B] transition hover:text-[#0B1020]"
                >
                  View projects
                  <ArrowUpRight size={13} aria-hidden />
                </Link>
              }
            />

            <div className="mt-7 grid items-center gap-8 lg:grid-cols-[200px_1fr]">
              <div className="flex justify-center">
                <DonutChart
                  segments={projectSegments}
                  total={totalProjects}
                  centreLabel="Projects"
                />
              </div>

              <div className="space-y-5">
                <StackedBar segments={projectSegments} />
                <ChartLegend segments={projectSegments} />
              </div>
            </div>
          </DashboardPanel>
        </section>
      )}

      {/* ── Setup: honest about what isn't wired up yet ─────────────────── */}
      <SetupChecklist
        hasClients={totalClients > 0}
        hasIntegrations={integrations.length > 0}
        allIntegrationsConnected={integrations.length > 0 && brokenIntegrations === 0}
      />
    </div>
  );
}

/* ───────────────────────── data ───────────────────────── */

type EsteemResult =
  | { ok: true; data: EsteemOverview }
  | { ok: false; error: string };

async function loadEsteem(): Promise<EsteemResult> {
  try {
    return { ok: true, data: await getEsteemOverview() };
  } catch (error) {
    console.error('Esteem overview failed:', error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Could not reach the client Firebase project.',
    };
  }
}

type AttentionItem = {
  tone: 'critical' | 'warn';
  title: string;
  detail: string;
  href: string;
  action: string;
};

function buildAttention(input: {
  esteemFailed: boolean;
  esteemError: string | null;
  brokenIntegrations: number;
  urgentTickets: number;
  staleTickets: number;
  clientsWithoutIntegration: string[];
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (input.esteemFailed) {
    items.push({
      tone: 'critical',
      title: 'A client platform is unreachable',
      detail:
        input.esteemError ??
        'Syntra Grid could not read live data from a connected client system.',
      href: '/clients',
      action: 'Check connection',
    });
  }

  if (input.brokenIntegrations > 0) {
    items.push({
      tone: 'critical',
      title: `${input.brokenIntegrations} ${
        input.brokenIntegrations === 1 ? 'integration is' : 'integrations are'
      } not connected`,
      detail: 'Client figures will be stale or missing until these are restored.',
      href: '/clients',
      action: 'Review',
    });
  }

  if (input.urgentTickets > 0) {
    items.push({
      tone: 'critical',
      title: `${input.urgentTickets} urgent ${
        input.urgentTickets === 1 ? 'ticket' : 'tickets'
      } open`,
      detail: 'Marked urgent by whoever raised them and not yet resolved.',
      href: '/support',
      action: 'Open support',
    });
  }

  if (input.staleTickets > 0) {
    items.push({
      tone: 'warn',
      title: `${input.staleTickets} ${
        input.staleTickets === 1 ? 'ticket has' : 'tickets have'
      } been open over a week`,
      detail: 'Long-running tickets are the ones clients remember at renewal.',
      href: '/support',
      action: 'Open support',
    });
  }

  if (input.clientsWithoutIntegration.length > 0) {
    items.push({
      tone: 'warn',
      title: `${input.clientsWithoutIntegration.length} ${
        input.clientsWithoutIntegration.length === 1 ? 'client has' : 'clients have'
      } no data source`,
      detail: `${input.clientsWithoutIntegration
        .slice(0, 3)
        .join(', ')} — their workspace shows no live figures.`,
      href: '/clients',
      action: 'Connect',
    });
  }

  const order = { critical: 0, warn: 1 } as const;
  return items.sort((a, b) => order[a.tone] - order[b.tone]);
}

function toSegments(
  groups: { status: string; _count: { _all: number } }[],
  config: Record<string, { label: string; color: string }>,
): ChartSegment[] {
  return groups
    .map((group) => ({
      key: group.status,
      label: config[group.status]?.label ?? group.status,
      value: group._count._all,
      color: config[group.status]?.color ?? '#94A3B8',
    }))
    .sort((a, b) => b.value - a.value);
}

/* ───────────────────────── components ───────────────────────── */

function DashboardPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[#D4AF37]/15 bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-6">
      {children}
    </div>
  );
}

function PanelHeading({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-bold text-[#0B1020]">{title}</h2>
        <p className="mt-1 text-sm text-[#5A6173]">{description}</p>
      </div>

      {action || (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-[#5A6173]">
          <Icon size={16} aria-hidden />
        </div>
      )}
    </div>
  );
}

const ATTENTION_TONES = {
  critical: {
    wrap: 'border-red-200 bg-red-50/70',
    icon: 'bg-red-100 text-red-600',
    title: 'text-red-800',
    body: 'text-red-700',
  },
  warn: {
    wrap: 'border-amber-200 bg-amber-50/70',
    icon: 'bg-amber-100 text-amber-600',
    title: 'text-amber-900',
    body: 'text-amber-800',
  },
} as const;

function AttentionRow({ tone, title, detail, href, action }: AttentionItem) {
  const current = ATTENTION_TONES[tone];

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${current.wrap}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${current.icon}`}
      >
        <AlertTriangle size={17} aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${current.title}`}>{title}</p>
        <p className={`mt-0.5 break-words text-sm ${current.body}`}>{detail}</p>
      </div>

      <Link
        href={href}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#0B1020]/[0.08] bg-white px-3.5 text-xs font-bold text-[#0B1020] transition-colors hover:border-[#0B1020]/15"
      >
        {action}
        <ArrowUpRight size={13} aria-hidden />
      </Link>
    </div>
  );
}

const CARD_ACCENTS = {
  gold: {
    icon: 'bg-gradient-to-br from-[#F3DFA2] via-[#D4AF37] to-[#A87B1B] text-[#3A2B05]',
    bar: 'from-[#D4AF37] to-[#A87B1B]',
  },
  teal: {
    icon: 'bg-gradient-to-br from-[#5EEAD4] via-[#14B8A6] to-[#0D9488] text-[#04312B]',
    bar: 'from-[#14B8A6] to-[#0D9488]',
  },
  red: {
    icon: 'bg-gradient-to-br from-[#FCA5A5] via-[#EF4444] to-[#B91C1C] text-white',
    bar: 'from-[#EF4444] to-[#B91C1C]',
  },
} as const;

function KpiCard({
  label,
  value,
  description,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  accent: keyof typeof CARD_ACCENTS;
  href: string;
}) {
  const theme = CARD_ACCENTS[accent];

  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-[#0B1020]/[0.06] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37]/25 hover:shadow-[0_16px_32px_rgba(11,16,32,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{ transitionTimingFunction: PREMIUM_EASE }}
    >
      <span
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${theme.bar} opacity-70 transition-opacity duration-300 group-hover:opacity-100`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6173]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[#0B1020]">{value}</p>
          <p className="mt-1 text-xs leading-5 text-[#5A6173]">{description}</p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none ${theme.icon}`}
          style={{ transitionTimingFunction: PREMIUM_EASE }}
        >
          <Icon size={18} strokeWidth={2.25} aria-hidden />
        </div>
      </div>
    </Link>
  );
}

type ChartSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

function DonutChart({
  segments,
  total,
  centreLabel,
}: {
  segments: ChartSegment[];
  total: number;
  centreLabel: string;
}) {
  return (
    <div
      className="relative h-40 w-40 shrink-0 rounded-full"
      style={{ background: createConicGradient(segments, total) }}
      role="img"
      aria-label={`${centreLabel}: ${segments
        .map((segment) => `${segment.label} ${segment.value}`)
        .join(', ')}`}
    >
      <div className="absolute inset-[17px] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <p className="text-2xl font-bold tabular-nums text-[#0B1020]">{total}</p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6173]">
          {centreLabel}
        </p>
      </div>
    </div>
  );
}

function StackedBar({ segments }: { segments: ChartSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (!total) return null;

  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full">
      {segments.map((segment) => (
        <div
          key={segment.key}
          style={{
            width: `${(segment.value / total) * 100}%`,
            backgroundColor: segment.color,
          }}
        />
      ))}
    </div>
  );
}

function ChartLegend({ segments }: { segments: ChartSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (!total) return null;

  return (
    <div className="space-y-3">
      {segments.map((segment) => (
        <div key={segment.key} className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="truncate text-xs font-semibold text-[#5A6173]">
              {segment.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tabular-nums text-[#0B1020]">
              {segment.value}
            </span>
            <span className="w-9 text-right text-[10px] font-medium tabular-nums text-[#5A6173]/70">
              {Math.round((segment.value / total) * 100)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClientCard({
  id,
  name,
  industry,
  country,
  status,
  projectCount,
  ticketCount,
  projects,
  integration,
}: {
  id: string;
  name: string;
  industry: string;
  country: string | null;
  status: string;
  projectCount: number;
  ticketCount: number;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    databaseType: string | null;
  }>;
  integration: { total: number; connected: number } | null;
}) {
  const isActive = status === 'ACTIVE';

  const connection = !integration
    ? {
        label: 'No data source',
        className: 'bg-[#0B1020]/[0.05] text-[#5A6173]',
        dot: 'bg-[#5A6173]',
      }
    : integration.connected === integration.total
    ? {
        label: 'Connected',
        className: 'bg-[#14B8A6]/10 text-[#0D9488]',
        dot: 'bg-[#14B8A6]',
      }
    : {
        label: 'Connection failing',
        className: 'bg-red-50 text-red-700',
        dot: 'bg-red-500',
      };

  return (
    <Link
      href={`/clients/${id}`}
      className="group rounded-2xl border border-[#0B1020]/[0.06] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37]/25 hover:shadow-[0_10px_24px_rgba(11,16,32,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{ background: WASH_SOFT, transitionTimingFunction: PREMIUM_EASE }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1020] text-sm font-bold text-white">
            {getInitials(name)}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-[#0B1020]">{name}</h3>
            <p className="mt-1 truncate text-xs text-[#5A6173]">{industry}</p>
          </div>
        </div>

        <ArrowUpRight
          size={15}
          className="shrink-0 text-[#5A6173]/45 transition group-hover:text-[#A87B1B]"
          aria-hidden
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${connection.className}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${connection.dot}`} />
          {connection.label}
        </span>

        {!isActive && (
          <span className="rounded-full bg-[#0B1020]/[0.05] px-2.5 py-1 text-[10px] font-bold text-[#5A6173]">
            {formatText(status)}
          </span>
        )}

        {country && (
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#5A6173] ring-1 ring-[#D4AF37]/15">
            {country}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniMetric label="Projects" value={projectCount} />
        <MiniMetric label="Tickets" value={ticketCount} alert={ticketCount > 0} />
      </div>

      {projects.length > 0 && (
        <div className="mt-4 border-t border-[#0B1020]/[0.06] pt-3">
          <div className="flex flex-wrap gap-1.5">
            {projects.map((project) => (
              <span
                key={project.id}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-[#5A6173] ring-1 ring-[#0B1020]/[0.05]"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      PROJECT_STATUS_CONFIG[
                        project.status as keyof typeof PROJECT_STATUS_CONFIG
                      ]?.color ?? '#94A3B8',
                  }}
                />
                {project.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Link>
  );
}

function MiniMetric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number | string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-[#0B1020]/[0.05]">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#5A6173]">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          alert ? 'text-amber-600' : 'text-[#0B1020]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Replaces the deployment chart and health gauge, which read from tables
 * nothing writes to yet. Rather than drawing an empty graph, say plainly what
 * is not wired up. Each row disappears once its feature is live.
 */
function SetupChecklist({
  hasClients,
  hasIntegrations,
  allIntegrationsConnected,
}: {
  hasClients: boolean;
  hasIntegrations: boolean;
  allIntegrationsConnected: boolean;
}) {
  const steps = [
    {
      label: 'Client records',
      done: hasClients,
      detail: 'At least one client exists in Syntra Grid.',
    },
    {
      label: 'Data sources',
      done: hasIntegrations,
      detail: 'Client platforms connected so figures come from live systems.',
    },
    {
      label: 'All connections healthy',
      done: allIntegrationsConnected,
      detail: 'Every configured integration is reading successfully.',
    },
    {
      label: 'Uptime monitoring',
      done: false,
      detail:
        'Stamp lastSuccessAt and lastError on each integration read to track this.',
    },
    {
      label: 'Deployment tracking',
      done: false,
      detail: 'Record releases per client to chart delivery over time. Not built yet.',
    },
    {
      label: 'Audit trail',
      done: false,
      detail: 'Log actions taken inside Syntra Grid. Not built yet.',
    },
  ];

  const done = steps.filter((step) => step.done).length;

  return (
    <section>
      <DashboardPanel>
        <PanelHeading
          title="Platform setup"
          description={`${done} of ${steps.length} capabilities live.`}
          icon={Database}
        />

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#0B1020]/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#14B8A6] transition-[width] duration-700"
            style={{ width: `${(done / steps.length) * 100}%` }}
          />
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {steps.map((step) => (
            <li key={step.label} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  step.done
                    ? 'bg-[#14B8A6]/12 text-[#0D9488]'
                    : 'bg-[#0B1020]/[0.05] text-[#5A6173]'
                }`}
              >
                {step.done ? (
                  <CheckCircle2 size={13} aria-hidden />
                ) : (
                  <CircleSlash size={13} aria-hidden />
                )}
              </span>

              <div className="min-w-0">
                <p
                  className={`text-sm font-bold ${
                    step.done ? 'text-[#0B1020]' : 'text-[#5A6173]'
                  }`}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-[#5A6173]">{step.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </DashboardPanel>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  href,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-[#0B1020]/10 bg-[#FAFAF9] px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#A87B1B] shadow-sm ring-1 ring-[#D4AF37]/15">
        <Icon size={21} aria-hidden />
      </div>

      <p className="mt-4 text-sm font-bold text-[#0B1020]">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[#5A6173]">{description}</p>

      <Link
        href={href}
        className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-[#0B1020] px-4 text-xs font-bold text-white transition hover:bg-[#151D34]"
      >
        <Plus size={13} aria-hidden />
        {action}
      </Link>
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function createConicGradient(segments: ChartSegment[], total: number): string {
  if (!total) return 'conic-gradient(#E5E7EB 0deg 360deg)';

  let degree = 0;

  const stops = segments.map((segment) => {
    const start = degree;
    const end = start + (segment.value / total) * 360;
    degree = end;
    return `${segment.color} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${stops.join(', ')})`;
}

function formatText(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split('_')
    .join(' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}