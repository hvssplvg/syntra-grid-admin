import Link from 'next/link';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  CloudCog,
  Database,
  FolderKanban,
  Gauge,
  Headphones,
  Minus,
  Plus,
  Server,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { prisma } from '@/lib/prisma';

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
  WAITING_FOR_CLIENT: { label: 'Waiting', color: '#6366F1' },
  RESOLVED: { label: 'Resolved', color: '#14B8A6' },
  CLOSED: { label: 'Closed', color: '#64748B' },
} as const;

const CHART_DAYS = 14;

export default async function DashboardPage() {
  const now = new Date();

  const chartWindowStart = new Date(now);
  chartWindowStart.setDate(now.getDate() - (CHART_DAYS - 1));
  chartWindowStart.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const [
    totalClients,
    activeClients,
    clientsLast30,
    clientsPrev30,
    totalProjects,
    activeProjects,
    projectsLast30,
    totalIntegrations,
    connectedIntegrations,
    totalTickets,
    openTickets,
    urgentTickets,
    ticketsCreated7d,
    resolvedTickets,
    deploymentsThisMonth,
    deploymentsPrevMonth,
    projectStatusGroups,
    ticketStatusGroups,
    chartDeployments,
    recentClients,
    recentAuditLogs,
    recentHealthChecks,
  ] = await Promise.all([
    prisma.client.count(),

    prisma.client.count({
      where: { status: 'ACTIVE' },
    }),

    prisma.client.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),

    prisma.client.count({
      where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),

    prisma.project.count(),

    prisma.project.count({
      where: { status: 'ACTIVE' },
    }),

    prisma.project.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),

    prisma.integration.count(),

    prisma.integration.count({
      where: { status: 'CONNECTED' },
    }),

    prisma.supportTicket.count(),

    prisma.supportTicket.count({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CLIENT'] },
      },
    }),

    prisma.supportTicket.count({
      where: {
        priority: 'URGENT',
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CLIENT'] },
      },
    }),

    prisma.supportTicket.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),

    prisma.supportTicket.count({
      where: { status: { in: ['RESOLVED', 'CLOSED'] } },
    }),

    prisma.deployment.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),

    prisma.deployment.count({
      where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),

    prisma.project.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),

    prisma.supportTicket.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),

    prisma.deployment.findMany({
      where: { createdAt: { gte: chartWindowStart } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.client.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: {
        projects: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            status: true,
            databaseType: true,
          },
        },
        _count: {
          select: { projects: true, tickets: true },
        },
      },
    }),

    prisma.auditLog.findMany({
      take: 7,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    }),

    prisma.healthCheck.findMany({
      take: 100,
      orderBy: { checkedAt: 'desc' },
      select: { projectId: true, status: true, healthy: true },
    }),
  ]);

  // ── Derived metrics ────────────────────────────────────────────────────────

  const projectSegments: ChartSegment[] = projectStatusGroups
    .map((group) => {
      const config =
        PROJECT_STATUS_CONFIG[
          group.status as keyof typeof PROJECT_STATUS_CONFIG
        ];

      return {
        key: group.status,
        label: config.label,
        value: group._count._all,
        color: config.color,
      };
    })
    .sort((a, b) => b.value - a.value);

  const ticketSegments: ChartSegment[] = ticketStatusGroups
    .map((group) => {
      const config =
        TICKET_STATUS_CONFIG[
          group.status as keyof typeof TICKET_STATUS_CONFIG
        ];

      return {
        key: group.status,
        label: config.label,
        value: group._count._all,
        color: config.color,
      };
    })
    .sort((a, b) => b.value - a.value);

  const deploymentSeries = createDailySeries(
    chartDeployments.map((deployment) => deployment.createdAt),
    CHART_DAYS
  );

  const chartTotal = chartDeployments.length;

  const dailyAverage =
    Math.round((chartTotal / CHART_DAYS) * 10) / 10;

  const peakDay = deploymentSeries.reduce(
    (peak, item) => (item.value > peak.value ? item : peak),
    deploymentSeries[0]
  );

  const latestHealthChecks = getLatestProjectChecks(recentHealthChecks);
  const monitoredProjects = latestHealthChecks.length;

  const healthyProjects = latestHealthChecks.filter(
    (item) => item.healthy || item.status === 'HEALTHY'
  ).length;

  const healthPercentage = toPercentage(healthyProjects, monitoredProjects);

  const integrationPercentage = toPercentage(
    connectedIntegrations,
    totalIntegrations
  );

  const activeClientPercentage = toPercentage(activeClients, totalClients);
  const activeProjectPercentage = toPercentage(activeProjects, totalProjects);
  const resolutionRate = toPercentage(resolvedTickets, totalTickets);

  const clientTrend = percentChange(clientsLast30, clientsPrev30);
  const deploymentTrend = percentChange(
    deploymentsThisMonth,
    deploymentsPrevMonth
  );

  // Weighted operational score: platform health, integration coverage,
  // active-project share, and ticket pressure (inverted).
  const ticketPressure =
    totalTickets > 0 ? Math.round((openTickets / totalTickets) * 100) : 0;

  const scoreInputs: Array<[number, number]> = [
    [monitoredProjects > 0 ? healthPercentage : 100, 0.35],
    [totalIntegrations > 0 ? integrationPercentage : 100, 0.25],
    [totalProjects > 0 ? activeProjectPercentage : 100, 0.2],
    [100 - ticketPressure, 0.2],
  ];

  const operationalScore = Math.round(
    scoreInputs.reduce((sum, [value, weight]) => sum + value * weight, 0)
  );

  const scoreTone =
    operationalScore >= 85
      ? 'Excellent'
      : operationalScore >= 65
        ? 'Stable'
        : 'Needs attention';

  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  return (
    <div className="space-y-8">
      {/* ── Command header ─────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/15 p-6 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-8"
        style={{
          background:
            'radial-gradient(120% 160% at 100% 0%, rgba(20,184,166,0.07), transparent 55%), radial-gradient(110% 150% at 0% 100%, rgba(212,175,55,0.09), transparent 50%), #FFFFFF',
        }}
      >
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#14B8A6] shadow-[0_0_0_5px_rgba(20,184,166,0.12)]" />

              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A87B1B]">
                Syntra Grid Operations
              </p>
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0B1020] sm:text-3xl">
              Business overview
            </h1>

            <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#5A6173]">
              {today} · Live status across every client platform managed by
              Syntra Grid.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <HeaderChip
                icon={Building2}
                label={`${activeClients}/${totalClients} clients active`}
              />

              <HeaderChip
                icon={FolderKanban}
                label={`${activeProjects}/${totalProjects} projects live`}
              />

              <HeaderChip
                icon={Headphones}
                label={
                  urgentTickets > 0
                    ? `${urgentTickets} urgent ${
                        urgentTickets === 1 ? 'ticket' : 'tickets'
                      }`
                    : 'No urgent tickets'
                }
                alert={urgentTickets > 0}
              />

              <HeaderChip
                icon={CloudCog}
                label={`${deploymentsThisMonth} deployments · 30d`}
              />
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* Operational score */}
            <div
              className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#D4AF37 0deg, #14B8A6 ${
                  operationalScore * 3.6
                }deg, rgba(11,16,32,0.06) ${
                  operationalScore * 3.6
                }deg 360deg)`,
              }}
            >
              <div className="absolute inset-[9px] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
                <p className="text-2xl font-bold tabular-nums text-[#0B1020]">
                  {operationalScore}
                </p>

                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#5A6173]">
                  Ops score
                </p>
              </div>
            </div>

            <div className="hidden sm:block">
              <p className="text-sm font-bold text-[#0B1020]">{scoreTone}</p>

              <p className="mt-1 max-w-44 text-xs leading-5 text-[#5A6173]">
                Weighted across platform health, integrations, active projects
                and support load.
              </p>

              <div className="mt-3 flex gap-2">
                <Link
                  href="/clients"
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#0B1020] px-3.5 text-xs font-bold text-white shadow-[0_8px_24px_rgba(11,16,32,0.18)] transition hover:-translate-y-0.5 hover:bg-[#151D34]"
                  style={{ transitionTimingFunction: PREMIUM_EASE }}
                >
                  <Plus size={13} />
                  Add client
                </Link>

                <Link
                  href="/monitoring"
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#0B1020]/[0.08] bg-white px-3.5 text-xs font-bold text-[#5A6173] shadow-sm transition hover:border-[#D4AF37]/30 hover:text-[#0B1020]"
                >
                  <Gauge size={13} />
                  Monitoring
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── KPI cards with trends ──────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Clients"
          value={totalClients}
          description={`${activeClientPercentage}% active portfolio`}
          icon={Building2}
          accent="gold"
          href="/clients"
          trend={clientTrend}
          trendLabel="vs previous 30 days"
        />

        <KpiCard
          label="Managed Projects"
          value={totalProjects}
          description={`${activeProjects} operational · ${projectsLast30} new this month`}
          icon={FolderKanban}
          accent="teal"
          href="/projects"
          progress={activeProjectPercentage}
        />

        <KpiCard
          label="Open Tickets"
          value={openTickets}
          description={
            urgentTickets > 0
              ? `${urgentTickets} urgent · ${ticketsCreated7d} new this week`
              : `${ticketsCreated7d} new this week`
          }
          icon={Headphones}
          accent={urgentTickets > 0 ? 'red' : 'teal'}
          href="/support"
          progress={resolutionRate}
          progressLabel={`${resolutionRate}% lifetime resolution`}
        />

        <KpiCard
          label="Deployments"
          value={deploymentsThisMonth}
          description="Recorded during the last 30 days"
          icon={CloudCog}
          accent="blue"
          href="/deployments"
          trend={deploymentTrend}
          trendLabel="vs previous 30 days"
        />
      </section>

      {/* ── Deployment activity + project distribution ─────────────────── */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <DashboardPanel>
          <PanelHeading
            title="Deployment activity"
            description={`Daily deployments across the last ${CHART_DAYS} days.`}
            icon={Activity}
            action={
              <Link
                href="/deployments"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#A87B1B] transition hover:text-[#0B1020]"
              >
                View deployments
                <ArrowUpRight size={13} />
              </Link>
            }
          />

          <div className="mt-6 grid grid-cols-3 gap-3">
            <ChartStat
              label="Total"
              value={chartTotal}
              hint={`${CHART_DAYS}-day window`}
            />

            <ChartStat
              label="Daily average"
              value={dailyAverage}
              hint="Deployments per day"
            />

            <ChartStat
              label="Peak day"
              value={peakDay.value}
              hint={peakDay.label}
            />
          </div>

          <DeploymentChart
            data={deploymentSeries}
            average={dailyAverage}
          />
        </DashboardPanel>

        <DashboardPanel>
          <PanelHeading
            title="Project distribution"
            description="Projects grouped by lifecycle status."
            icon={FolderKanban}
          />

          <div className="mt-7 flex flex-col items-center gap-6">
            <DonutChart
              segments={projectSegments}
              total={totalProjects}
              centreLabel="Projects"
            />

            <StackedBar segments={projectSegments} />

            <ChartLegend
              segments={projectSegments}
              emptyMessage="No projects have been created yet."
            />
          </div>
        </DashboardPanel>
      </section>

      {/* ── Clients + platform health ──────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <DashboardPanel>
          <PanelHeading
            title="Client systems"
            description="The latest businesses managed through Syntra Grid."
            icon={Server}
            action={
              <Link
                href="/clients"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#A87B1B] transition hover:text-[#0B1020]"
              >
                View all
                <ArrowRight size={13} />
              </Link>
            }
          />

          {recentClients.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No clients have been added"
              description="Create your first client profile to begin monitoring projects, integrations and support."
              href="/clients"
              action="Add first client"
            />
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {recentClients.map((client) => (
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
                />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel>
          <PanelHeading
            title="Platform health"
            description="Latest status across monitored services."
            icon={Gauge}
          />

          <div className="mt-7 flex justify-center">
            <CircularProgress
              value={healthPercentage}
              label={
                monitoredProjects > 0
                  ? `${healthyProjects} of ${monitoredProjects} healthy`
                  : 'Monitoring not configured'
              }
            />
          </div>

          <div className="mt-7 space-y-4">
            <HealthRow
              label="Syntra Grid database"
              status="Healthy"
              tone="healthy"
            />

            <HealthRow
              label="Authentication"
              status="Operational"
              tone="healthy"
            />

            <HealthRow
              label="Client integrations"
              status={
                totalIntegrations > 0
                  ? `${connectedIntegrations}/${totalIntegrations} connected`
                  : 'None configured'
              }
              tone={
                totalIntegrations === 0
                  ? 'muted'
                  : connectedIntegrations === totalIntegrations
                    ? 'healthy'
                    : 'warning'
              }
            />

            <HealthRow
              label="Automated monitoring"
              status={
                monitoredProjects > 0
                  ? `${healthPercentage}% healthy`
                  : 'Pending setup'
              }
              tone={monitoredProjects > 0 ? 'healthy' : 'muted'}
            />
          </div>

          <div className="mt-7 space-y-3">
            <CoverageBar
              icon={Database}
              label="Integration coverage"
              percentage={integrationPercentage}
              caption={`${connectedIntegrations} of ${totalIntegrations} configured integrations connected`}
            />

            <CoverageBar
              icon={CheckCircle2}
              label="Ticket resolution"
              percentage={resolutionRate}
              caption={`${resolvedTickets} of ${totalTickets} tickets resolved or closed`}
            />
          </div>
        </DashboardPanel>
      </section>

      {/* ── Support + activity ─────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashboardPanel>
          <PanelHeading
            title="Support workload"
            description="Distribution of support requests by status."
            icon={Headphones}
            action={
              <Link
                href="/support"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#A87B1B] transition hover:text-[#0B1020]"
              >
                Open support
                <ArrowUpRight size={13} />
              </Link>
            }
          />

          <div className="mt-7 grid items-center gap-7 sm:grid-cols-[170px_1fr]">
            <DonutChart
              segments={ticketSegments}
              total={ticketSegments.reduce(
                (total, item) => total + item.value,
                0
              )}
              centreLabel="Tickets"
              compact
            />

            <ChartLegend
              segments={ticketSegments}
              emptyMessage="There are currently no support tickets."
            />
          </div>

          {totalTickets > 0 && (
            <div
              className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-[#D4AF37]/15 p-4"
              style={{ background: WASH_SOFT }}
            >
              <div>
                <p className="text-xs font-bold text-[#0B1020]">
                  Support pressure
                </p>

                <p className="mt-1 text-[11px] text-[#5A6173]">
                  {ticketPressure}% of all tickets are currently open ·{' '}
                  {ticketsCreated7d} raised in the last 7 days
                </p>
              </div>

              <TrendingUp size={17} className="shrink-0 text-[#0D9488]" />
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel>
          <PanelHeading
            title="Recent activity"
            description="Latest recorded activity across Syntra Grid."
            icon={Activity}
          />

          {recentAuditLogs.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#0B1020]/10 bg-[#FAFAF9] px-5 py-10 text-center">
              <Activity size={22} className="mx-auto text-[#5A6173]/40" />

              <p className="mt-3 text-sm font-bold text-[#0B1020]">
                No recent activity
              </p>

              <p className="mt-1 text-xs text-[#5A6173]">
                Actions performed within the admin will appear here.
              </p>
            </div>
          ) : (
            <div className="relative mt-5">
              {/* Timeline rail */}
              <span className="absolute bottom-3 left-[17px] top-3 w-px bg-gradient-to-b from-[#D4AF37]/40 via-[#14B8A6]/30 to-transparent" />

              <div className="space-y-1">
                {recentAuditLogs.map((log) => {
                  const actorName =
                    [log.actor?.firstName, log.actor?.lastName]
                      .filter(Boolean)
                      .join(' ') ||
                    log.actor?.email ||
                    'System';

                  return (
                    <div
                      key={log.id}
                      className="relative flex items-start gap-3 rounded-xl py-2.5 pl-1 pr-2 transition hover:bg-[#FAFAF9]"
                    >
                      <div className="z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/20 bg-white text-[#A87B1B] shadow-sm">
                        <Activity size={12} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0B1020]">
                          {formatText(log.action)}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-[#5A6173]">
                          {actorName} · {formatText(log.entityType)}
                        </p>
                      </div>

                      <span className="shrink-0 pt-1 text-[10px] font-medium text-[#5A6173]/70">
                        {formatRelativeTime(log.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DashboardPanel>
      </section>

      {/* ── Quick actions ──────────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-bold text-[#0B1020]">
            Quick actions
          </h2>

          <p className="mt-1 text-sm text-[#5A6173]">
            Jump directly into common operational tasks.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            href="/clients"
            icon={Building2}
            label="Manage clients"
            description="Review connected businesses"
          />

          <QuickAction
            href="/projects"
            icon={FolderKanban}
            label="Manage projects"
            description="Track active software platforms"
          />

          <QuickAction
            href="/monitoring"
            icon={Activity}
            label="System monitoring"
            description="Review health and uptime"
          />

          <QuickAction
            href="/finance"
            icon={CircleDollarSign}
            label="Finance"
            description="Review revenue and invoices"
          />
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header components
// ─────────────────────────────────────────────────────────────────────────────

function HeaderChip({
  icon: Icon,
  label,
  alert = false,
}: {
  icon: LucideIcon;
  label: string;
  alert?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${
        alert
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-[#D4AF37]/15 bg-[#FAFAF9] text-[#5A6173]'
      }`}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// General components
// ─────────────────────────────────────────────────────────────────────────────

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
          <Icon size={16} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI cards
// ─────────────────────────────────────────────────────────────────────────────

const CARD_ACCENTS = {
  gold: {
    icon: 'bg-gradient-to-br from-[#F3DFA2] via-[#D4AF37] to-[#A87B1B] text-[#3A2B05]',
    bar: 'from-[#D4AF37] to-[#A87B1B]',
    progress: 'from-[#D4AF37] to-[#A87B1B]',
  },
  teal: {
    icon: 'bg-gradient-to-br from-[#5EEAD4] via-[#14B8A6] to-[#0D9488] text-[#04312B]',
    bar: 'from-[#14B8A6] to-[#0D9488]',
    progress: 'from-[#14B8A6] to-[#0D9488]',
  },
  blue: {
    icon: 'bg-gradient-to-br from-[#93C5FD] via-[#3B82F6] to-[#1D4ED8] text-white',
    bar: 'from-[#3B82F6] to-[#1D4ED8]',
    progress: 'from-[#3B82F6] to-[#1D4ED8]',
  },
  red: {
    icon: 'bg-gradient-to-br from-[#FCA5A5] via-[#EF4444] to-[#B91C1C] text-white',
    bar: 'from-[#EF4444] to-[#B91C1C]',
    progress: 'from-[#EF4444] to-[#B91C1C]',
  },
} as const;

function KpiCard({
  label,
  value,
  description,
  icon: Icon,
  accent,
  href,
  trend,
  trendLabel,
  progress,
  progressLabel,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  accent: keyof typeof CARD_ACCENTS;
  href: string;
  trend?: number | null;
  trendLabel?: string;
  progress?: number;
  progressLabel?: string;
}) {
  const theme = CARD_ACCENTS[accent];

  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-[#0B1020]/[0.06] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37]/25 hover:shadow-[0_16px_32px_rgba(11,16,32,0.08)]"
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

          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl font-bold tabular-nums text-[#0B1020]">
              {value}
            </p>

            {trend !== undefined && <TrendBadge value={trend} />}
          </div>

          <p className="mt-1 text-xs text-[#5A6173]">{description}</p>

          {trend !== undefined && trendLabel && (
            <p className="mt-0.5 text-[10px] text-[#5A6173]/70">
              {trendLabel}
            </p>
          )}
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-105 ${theme.icon}`}
          style={{ transitionTimingFunction: PREMIUM_EASE }}
        >
          <Icon size={18} strokeWidth={2.25} />
        </div>
      </div>

      {progress !== undefined && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#0B1020]/[0.06]">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${theme.progress} transition-all duration-700`}
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>

          {progressLabel && (
            <p className="mt-1.5 text-[10px] font-medium text-[#5A6173]/80">
              {progressLabel}
            </p>
          )}
        </div>
      )}
    </Link>
  );
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#0B1020]/[0.05] px-1.5 py-0.5 text-[10px] font-bold text-[#5A6173]">
        <Minus size={10} />
        New
      </span>
    );
  }

  const positive = value > 0;
  const flat = value === 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
        flat
          ? 'bg-[#0B1020]/[0.05] text-[#5A6173]'
          : positive
            ? 'bg-[#14B8A6]/10 text-[#0D9488]'
            : 'bg-red-50 text-red-600'
      }`}
    >
      {flat ? (
        <Minus size={10} />
      ) : positive ? (
        <ArrowUpRight size={10} />
      ) : (
        <ArrowDownRight size={10} />
      )}
      {flat ? '0%' : `${positive ? '+' : ''}${value}%`}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────────────────────────────────────

type ChartSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

function ChartStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div
      className="rounded-2xl border border-[#0B1020]/[0.05] p-3.5"
      style={{ background: WASH_SOFT }}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#5A6173]">
        {label}
      </p>

      <p className="mt-1.5 text-2xl font-bold tabular-nums text-[#0B1020]">
        {value}
      </p>

      <p className="mt-0.5 truncate text-[10px] text-[#5A6173]/80">{hint}</p>
    </div>
  );
}

function DeploymentChart({
  data,
  average,
}: {
  data: Array<{ label: string; value: number }>;
  average: number;
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  const points = data
    .map((item, index) => {
      const x =
        data.length === 1 ? 50 : (index / (data.length - 1)) * 100;

      const y = 86 - (item.value / maxValue) * 66;

      return `${x},${y}`;
    })
    .join(' ');

  const averageY = 86 - (average / maxValue) * 66;

  return (
    <div className="mt-6">
      <div className="relative h-52 overflow-hidden">
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((line) => (
            <div
              key={line}
              className="border-t border-dashed border-[#0B1020]/[0.06]"
            />
          ))}
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-x-0 top-0 h-[165px] w-full overflow-visible"
          aria-label="Deployment activity"
        >
          <defs>
            <linearGradient id="deployment-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#14B8A6" />
            </linearGradient>

            <linearGradient id="deployment-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
            </linearGradient>
          </defs>

          <polygon
            points={`0,100 ${points} 100,100`}
            fill="url(#deployment-area)"
          />

          {/* Daily-average reference line */}
          <line
            x1="0"
            y1={averageY}
            x2="100"
            y2={averageY}
            stroke="#A87B1B"
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />

          <polyline
            points={points}
            fill="none"
            stroke="url(#deployment-line)"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {data.map((item, index) => {
            const x =
              data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
            const y = 86 - (item.value / maxValue) * 66;

            return (
              <circle
                key={item.label + index}
                cx={x}
                cy={y}
                r="1.4"
                fill="#0B1020"
                stroke="#fff"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        <div className="absolute inset-x-0 bottom-0 flex justify-between">
          {data.map((item, index) => (
            <div key={item.label + index} className="flex-1 text-center">
              <p className="text-[10px] font-bold tabular-nums text-[#0B1020]">
                {item.value}
              </p>

              <p className="mt-1 text-[9px] font-medium text-[#5A6173]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-[#5A6173]/80">
        <span className="inline-block h-px w-4 border-t border-dashed border-[#A87B1B]" />
        Dashed line marks the daily average of {average} deployments
      </p>
    </div>
  );
}

function DonutChart({
  segments,
  total,
  centreLabel,
  compact = false,
}: {
  segments: ChartSegment[];
  total: number;
  centreLabel: string;
  compact?: boolean;
}) {
  const size = compact ? 'h-36 w-36' : 'h-44 w-44';

  return (
    <div
      className={`relative shrink-0 rounded-full ${size}`}
      style={{
        background:
          total > 0
            ? createConicGradient(segments, total)
            : 'conic-gradient(#E5E7EB 0deg 360deg)',
      }}
    >
      <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <p className="text-2xl font-bold tabular-nums text-[#0B1020]">
          {total}
        </p>

        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6173]">
          {centreLabel}
        </p>
      </div>
    </div>
  );
}

function StackedBar({ segments }: { segments: ChartSegment[] }) {
  const total = segments.reduce(
    (currentTotal, segment) => currentTotal + segment.value,
    0
  );

  if (!total) return null;

  return (
    <div className="w-full">
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
    </div>
  );
}

function ChartLegend({
  segments,
  emptyMessage,
}: {
  segments: ChartSegment[];
  emptyMessage: string;
}) {
  const total = segments.reduce(
    (currentTotal, segment) => currentTotal + segment.value,
    0
  );

  if (!total) {
    return (
      <div className="flex min-h-24 w-full flex-1 items-center justify-center rounded-2xl border border-dashed border-[#0B1020]/10 bg-[#FAFAF9] p-4 text-center">
        <p className="text-xs leading-5 text-[#5A6173]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 space-y-3">
      {segments.map((segment) => {
        const percentage = Math.round((segment.value / total) * 100);

        return (
          <div
            key={segment.key}
            className="flex items-center justify-between gap-4"
          >
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
                {percentage}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CircularProgress({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const safeValue = Math.min(Math.max(value, 0), 100);

  return (
    <div
      className="relative flex h-40 w-40 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(
          #14B8A6 0deg ${safeValue * 3.6}deg,
          rgba(11,16,32,0.06) ${safeValue * 3.6}deg 360deg
        )`,
      }}
    >
      <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-white">
        <p className="text-3xl font-bold tabular-nums text-[#0B1020]">
          {safeValue}%
        </p>

        <p className="mt-1 max-w-24 text-center text-[10px] font-semibold leading-4 text-[#5A6173]">
          {label}
        </p>
      </div>
    </div>
  );
}

function CoverageBar({
  icon: Icon,
  label,
  percentage,
  caption,
}: {
  icon: LucideIcon;
  label: string;
  percentage: number;
  caption: string;
}) {
  return (
    <div
      className="rounded-2xl border border-[#D4AF37]/15 p-4"
      style={{ background: WASH_SOFT }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[#0B1020]">{label}</p>

          <p className="mt-1 text-[11px] text-[#5A6173]">{caption}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-[#0B1020]">
            {percentage}%
          </span>

          <Icon size={16} className="text-[#A87B1B]" />
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0B1020]/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#14B8A6] transition-all duration-700"
          style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────

function ClientCard({
  id,
  name,
  industry,
  country,
  status,
  projectCount,
  ticketCount,
  projects,
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
}) {
  const isActive = status === 'ACTIVE';

  return (
    <Link
      href={`/clients/${id}`}
      className="group rounded-2xl border border-[#0B1020]/[0.06] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37]/25 hover:shadow-[0_10px_24px_rgba(11,16,32,0.06)]"
      style={{
        background: WASH_SOFT,
        transitionTimingFunction: PREMIUM_EASE,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1020] text-sm font-bold text-white">
            {getInitials(name)}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-[#0B1020]">
              {name}
            </h3>

            <p className="mt-1 truncate text-xs text-[#5A6173]">{industry}</p>
          </div>
        </div>

        <ArrowUpRight
          size={15}
          className="shrink-0 text-[#5A6173]/45 transition group-hover:text-[#A87B1B]"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
            isActive
              ? 'bg-[#14B8A6]/10 text-[#0D9488]'
              : 'bg-[#0B1020]/[0.05] text-[#5A6173]'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive ? 'bg-[#14B8A6]' : 'bg-[#5A6173]'
            }`}
          />

          {formatText(status)}
        </span>

        {country && (
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#5A6173] ring-1 ring-[#D4AF37]/15">
            {country}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniMetric label="Projects" value={projectCount} />

        <MiniMetric label="Tickets" value={ticketCount} />
      </div>

      {projects.length > 0 && (
        <div className="mt-4 border-t border-[#0B1020]/[0.06] pt-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#5A6173]/70">
            Recent systems
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {projects.map((project) => {
              const config =
                PROJECT_STATUS_CONFIG[
                  project.status as keyof typeof PROJECT_STATUS_CONFIG
                ];

              return (
                <span
                  key={project.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-[#5A6173] ring-1 ring-[#0B1020]/[0.05]"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: config?.color ?? '#94A3B8' }}
                  />
                  {project.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </Link>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-[#0B1020]/[0.05]">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#5A6173]">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold tabular-nums text-[#0B1020]">
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status and actions
// ─────────────────────────────────────────────────────────────────────────────

function HealthRow({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: 'healthy' | 'warning' | 'error' | 'muted';
}) {
  const themes = {
    healthy: {
      badge: 'bg-[#14B8A6]/10 text-[#0D9488]',
      dot: 'bg-[#14B8A6]',
    },
    warning: {
      badge: 'bg-amber-50 text-amber-700',
      dot: 'bg-amber-500',
    },
    error: {
      badge: 'bg-red-50 text-red-700',
      dot: 'bg-red-500',
    },
    muted: {
      badge: 'bg-[#0B1020]/[0.05] text-[#5A6173]',
      dot: 'bg-[#5A6173]',
    },
  };

  const theme = themes[tone];

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-[#0B1020]">{label}</p>

      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${theme.badge}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />

        {status}
      </span>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-[#0B1020]/[0.06] bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37]/25 hover:shadow-[0_10px_24px_rgba(11,16,32,0.06)]"
      style={{ transitionTimingFunction: PREMIUM_EASE }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-[#5A6173] transition group-hover:bg-[#0B1020] group-hover:text-white">
        <Icon size={17} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#0B1020]">{label}</p>

        <p className="mt-0.5 truncate text-xs text-[#5A6173]">
          {description}
        </p>
      </div>

      <ArrowRight
        size={14}
        className="text-[#5A6173]/40 transition group-hover:translate-x-0.5 group-hover:text-[#A87B1B]"
      />
    </Link>
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
        <Icon size={21} />
      </div>

      <p className="mt-4 text-sm font-bold text-[#0B1020]">{title}</p>

      <p className="mt-1 max-w-sm text-xs leading-5 text-[#5A6173]">
        {description}
      </p>

      <Link
        href={href}
        className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-[#0B1020] px-4 text-xs font-bold text-white transition hover:bg-[#151D34]"
      >
        <Plus size={13} />
        {action}
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Data helpers
// ─────────────────────────────────────────────────────────────────────────────

function createDailySeries(dates: Date[], days: number) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  return Array.from({ length: days }).map((_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (days - 1 - index));
    day.setHours(0, 0, 0, 0);

    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    const value = dates.filter(
      (date) => date >= day && date < nextDay
    ).length;

    return {
      label: formatter.format(day),
      value,
    };
  });
}

function getLatestProjectChecks<T extends { projectId: string }>(
  checks: T[]
): T[] {
  const projectIds = new Set<string>();

  return checks.filter((check) => {
    if (projectIds.has(check.projectId)) {
      return false;
    }

    projectIds.add(check.projectId);

    return true;
  });
}

function createConicGradient(
  segments: ChartSegment[],
  total: number
): string {
  if (!total) {
    return 'conic-gradient(#E5E7EB 0deg 360deg)';
  }

  let currentDegree = 0;

  const stops = segments.map((segment) => {
    const start = currentDegree;
    const end = start + (segment.value / total) * 360;

    currentDegree = end;

    return `${segment.color} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${stops.join(', ')})`;
}

function toPercentage(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Percentage change between periods.
 * Returns null when there is no previous data to compare against
 * (rendered as a neutral "New" badge instead of a misleading +100%).
 */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? null : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
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

function formatRelativeTime(date: Date): string {
  const difference = Date.now() - date.getTime();

  const minutes = Math.floor(difference / 60_000);
  const hours = Math.floor(difference / 3_600_000);
  const days = Math.floor(difference / 86_400_000);

  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}