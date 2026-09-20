"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Cloud,
  Code2,
  CreditCard,
  Headphones,
  Layers3,
  MessageSquareText,
  MoreHorizontal,
  PackageCheck,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* =============================================================================
   TYPES
============================================================================= */

type OverviewTabProps = {
  admin?: {
    fullName?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
};

type WorkspaceStatus = "healthy" | "attention" | "development";

type Workspace = {
  id: string;
  name: string;
  shortName: string;
  type: "Client" | "Product";
  description: string;
  status: WorkspaceStatus;
  statusLabel: string;
  metricLabel: string;
  metricValue: string;
  secondaryMetric: string;
};

type AttentionItem = {
  id: string;
  title: string;
  description: string;
  workspace: string;
  type: "urgent" | "warning" | "normal";
  time: string;
};

type ScheduleItem = {
  id: string;
  time: string;
  endTime?: string;
  title: string;
  context: string;
  type: "meeting" | "deadline" | "deployment" | "review";
};

type Project = {
  id: string;
  name: string;
  workspace: string;
  progress: number;
  status: string;
  due: string;
  members: number;
};

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  type:
    | "deployment"
    | "support"
    | "finance"
    | "project"
    | "client"
    | "system";
};

type Metric = {
  label: string;
  value: string;
  helper: string;
  trend?: string;
  icon: ReactNode;
};

/* =============================================================================
   DUMMY DATA

   Keep this section isolated so it can later be replaced with API data.
============================================================================= */

const WORKSPACES: Workspace[] = [
  {
    id: "rentwise",
    name: "RentWise",
    shortName: "RW",
    type: "Client",
    description: "Property technology platform",
    status: "healthy",
    statusLabel: "On track",
    metricLabel: "Launch readiness",
    metricValue: "82%",
    secondaryMetric: "3 active projects",
  },
  {
    id: "esteem",
    name: "Esteem Learning Centre",
    shortName: "EL",
    type: "Client",
    description: "Education management platform",
    status: "healthy",
    statusLabel: "Operational",
    metricLabel: "Platform health",
    metricValue: "99.9%",
    secondaryMetric: "2 open requests",
  },
  {
    id: "meldex",
    name: "Meldex Industries",
    shortName: "MI",
    type: "Client",
    description: "Corporate digital platform",
    status: "healthy",
    statusLabel: "Operational",
    metricLabel: "Platform health",
    metricValue: "100%",
    secondaryMetric: "No open incidents",
  },
  {
    id: "zing",
    name: "Zing",
    shortName: "ZG",
    type: "Product",
    description: "Mobility & logistics platform",
    status: "development",
    statusLabel: "Pre-launch",
    metricLabel: "Launch readiness",
    metricValue: "68%",
    secondaryMetric: "November target",
  },
];

const ATTENTION_ITEMS: AttentionItem[] = [
  {
    id: "att-1",
    title: "Zing passenger wallet requires review",
    description:
      "Payment and wallet flow is ready for the next product review.",
    workspace: "Zing",
    type: "urgent",
    time: "Today",
  },
  {
    id: "att-2",
    title: "RentWise launch checklist",
    description:
      "7 launch-readiness items are still outstanding before December.",
    workspace: "RentWise",
    type: "warning",
    time: "Due this week",
  },
  {
    id: "att-3",
    title: "Esteem support request",
    description:
      "A new administration request is waiting for triage.",
    workspace: "Esteem",
    type: "normal",
    time: "2h ago",
  },
];

const TODAY_SCHEDULE: ScheduleItem[] = [
  {
    id: "schedule-1",
    time: "09:30",
    endTime: "10:00",
    title: "Morning operations review",
    context: "Syntra Grid",
    type: "review",
  },
  {
    id: "schedule-2",
    time: "11:00",
    endTime: "12:00",
    title: "Zing launch readiness",
    context: "Zing",
    type: "meeting",
  },
  {
    id: "schedule-3",
    time: "14:30",
    endTime: "15:15",
    title: "RentWise product review",
    context: "RentWise",
    type: "meeting",
  },
  {
    id: "schedule-4",
    time: "17:00",
    title: "Production deployment window",
    context: "Esteem",
    type: "deployment",
  },
];

const PROJECTS: Project[] = [
  {
    id: "project-1",
    name: "RentWise Production Launch",
    workspace: "RentWise",
    progress: 82,
    status: "On track",
    due: "December",
    members: 5,
  },
  {
    id: "project-2",
    name: "Zing Abuja Launch",
    workspace: "Zing",
    progress: 68,
    status: "In progress",
    due: "November",
    members: 4,
  },
  {
    id: "project-3",
    name: "Esteem Platform Improvements",
    workspace: "Esteem",
    progress: 74,
    status: "On track",
    due: "Oct 04",
    members: 3,
  },
];

const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: "activity-1",
    title: "Deployment completed",
    description: "RentWise production build deployed successfully.",
    time: "18 min ago",
    type: "deployment",
  },
  {
    id: "activity-2",
    title: "Support ticket resolved",
    description: "Esteem Learning Centre · Teacher access issue.",
    time: "43 min ago",
    type: "support",
  },
  {
    id: "activity-3",
    title: "Project milestone completed",
    description: "Zing · Driver active-ride experience.",
    time: "1h ago",
    type: "project",
  },
  {
    id: "activity-4",
    title: "Client activity",
    description: "New RentWise feedback was added to the workspace.",
    time: "2h ago",
    type: "client",
  },
  {
    id: "activity-5",
    title: "Invoice marked as paid",
    description: "Meldex Industries · Monthly service invoice.",
    time: "Yesterday",
    type: "finance",
  },
];

/* =============================================================================
   MAIN
============================================================================= */

export default function OverviewTab({ admin }: OverviewTabProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const firstName = useMemo(() => {
    const source =
      admin?.fullName?.trim() ||
      admin?.name?.trim() ||
      admin?.email?.split("@")[0] ||
      "Hassan";

    return source.split(/\s+/)[0];
  }, [admin]);

  const greeting = getGreeting(now);

  const metrics: Metric[] = [
    {
      label: "Active workspaces",
      value: "4",
      helper: "3 clients · 1 product",
      icon: <Layers3 size={18} />,
    },
    {
      label: "Open projects",
      value: "8",
      helper: "3 launch-critical",
      trend: "+2 this month",
      icon: <Rocket size={18} />,
    },
    {
      label: "Open support",
      value: "12",
      helper: "2 require attention",
      icon: <Headphones size={18} />,
    },
    {
      label: "System health",
      value: "99.9%",
      helper: "All production systems online",
      trend: "Healthy",
      icon: <Activity size={18} />,
    },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* =====================================================================
          WELCOME / COMMAND STRIP
      ===================================================================== */}

      <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]">
        <div className="relative px-5 py-5 sm:px-6 lg:px-7 lg:py-6">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[var(--accent-tint)] blur-3xl" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[var(--accent-tint)] text-[var(--accent)]">
                  <Sparkles size={14} />
                </span>

                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Syntra Grid Command Centre
                </span>
              </div>

              <h1 className="text-[24px] font-semibold tracking-[-0.035em] text-[var(--text)] sm:text-[28px]">
                {greeting}, {firstName}.
              </h1>

              <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[var(--text-muted)] sm:text-[14px]">
                Here&apos;s what&apos;s happening across Syntra Grid today.
                You have{" "}
                <span className="font-semibold text-[var(--text)]">
                  3 items requiring attention
                </span>{" "}
                and{" "}
                <span className="font-semibold text-[var(--text)]">
                  4 scheduled events
                </span>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <OverviewAction
                icon={<CalendarDays size={15} />}
                label="View calendar"
              />

              <OverviewAction
                icon={<Bell size={15} />}
                label="Notifications"
              />

              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--text)] px-4 text-[12px] font-semibold text-[var(--shell)] transition hover:opacity-90"
              >
                <Zap size={15} />
                Quick action
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border)] px-5 py-3 sm:px-6 lg:px-7">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--text-muted)]">
            <StatusLine
              icon={<CheckCircle2 size={13} />}
              label="All production systems operational"
            />

            <StatusLine
              icon={<CalendarDays size={13} />}
              label={formatFullDate(now)}
            />

            <StatusLine
              icon={<Clock3 size={13} />}
              label={`Last refreshed ${formatTime(now)}`}
            />
          </div>
        </div>
      </section>

      {/* =====================================================================
          KPI STRIP
      ===================================================================== */}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      {/* =====================================================================
          PRIMARY COMMAND GRID
      ===================================================================== */}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
        {/* ATTENTION */}

        <Panel>
          <PanelHeader
            eyebrow="Priority"
            title="Needs your attention"
            description="Items that may require a decision, review or follow-up."
            action="View all"
          />

          <div className="divide-y divide-[var(--border)]">
            {ATTENTION_ITEMS.map((item) => (
              <AttentionRow key={item.id} item={item} />
            ))}
          </div>
        </Panel>

        {/* TODAY */}

        <Panel>
          <PanelHeader
            eyebrow="Calendar"
            title="Today"
            description={`${TODAY_SCHEDULE.length} scheduled items`}
            action="Open calendar"
          />

          <div className="px-4 pb-4 sm:px-5">
            <div className="space-y-1">
              {TODAY_SCHEDULE.map((item, index) => (
                <ScheduleRow
                  key={item.id}
                  item={item}
                  last={index === TODAY_SCHEDULE.length - 1}
                />
              ))}
            </div>
          </div>
        </Panel>
      </section>

      {/* =====================================================================
          WORKSPACES
      ===================================================================== */}

      <Panel>
        <PanelHeader
          eyebrow="Portfolio"
          title="Workspace health"
          description="Clients and products currently managed by Syntra Grid."
          action="View portfolio"
        />

        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
          {WORKSPACES.map((workspace) => (
            <WorkspaceCard key={workspace.id} workspace={workspace} />
          ))}
        </div>
      </Panel>

      {/* =====================================================================
          PROJECTS + OPERATIONS
      ===================================================================== */}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.85fr)]">
        <Panel>
          <PanelHeader
            eyebrow="Delivery"
            title="Active projects"
            description="Current delivery priorities across your workspaces."
            action="All projects"
          />

          <div className="divide-y divide-[var(--border)]">
            {PROJECTS.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Operations"
            title="Operational pulse"
            description="A quick read on the business right now."
          />

          <div className="grid grid-cols-2 gap-px overflow-hidden border-t border-[var(--border)] bg-[var(--border)]">
            <PulseMetric
              icon={<Server size={16} />}
              label="Systems"
              value="12 / 12"
              helper="Online"
            />

            <PulseMetric
              icon={<Rocket size={16} />}
              label="Deployments"
              value="7"
              helper="This week"
            />

            <PulseMetric
              icon={<MessageSquareText size={16} />}
              label="Messages"
              value="18"
              helper="Unread"
            />

            <PulseMetric
              icon={<ShieldCheck size={16} />}
              label="Incidents"
              value="0"
              helper="Critical"
            />
          </div>

          <div className="border-t border-[var(--border)] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-[var(--text)]">
                  Infrastructure status
                </p>

                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  No active production incidents.
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(34,197,94,0.10)] px-2.5 py-1 text-[10px] font-semibold text-[var(--success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Operational
              </span>
            </div>
          </div>
        </Panel>
      </section>

      {/* =====================================================================
          FINANCE + SUPPORT
      ===================================================================== */}

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            eyebrow="Commercial"
            title="Finance snapshot"
            description="Dummy financial data for the current testing phase."
            action="Open finance"
          />

          <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:px-5">
            <MiniStat
              icon={<CircleDollarSign size={16} />}
              label="Revenue"
              value="₦0"
              helper="Pre-revenue"
            />

            <MiniStat
              icon={<WalletCards size={16} />}
              label="Receivables"
              value="₦0"
              helper="No outstanding invoices"
            />

            <MiniStat
              icon={<CreditCard size={16} />}
              label="Operating costs"
              value="₦184k"
              helper="This month · demo"
            />

            <MiniStat
              icon={<TrendingUp size={16} />}
              label="Runway"
              value="—"
              helper="Not configured"
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Client Success"
            title="Support snapshot"
            description="Open conversations and client requests."
            action="Open support"
          />

          <div className="grid grid-cols-3 gap-px border-y border-[var(--border)] bg-[var(--border)]">
            <SupportMetric value="12" label="Open" />
            <SupportMetric value="2" label="Urgent" />
            <SupportMetric value="5" label="Awaiting" />
          </div>

          <div className="space-y-2 p-4 sm:p-5">
            <CompactSupportRow
              workspace="RentWise"
              title="Payment flow clarification"
              priority="High"
            />

            <CompactSupportRow
              workspace="Esteem"
              title="Teacher account assistance"
              priority="Normal"
            />

            <CompactSupportRow
              workspace="Meldex"
              title="Catalogue content update"
              priority="Normal"
            />
          </div>
        </Panel>
      </section>

      {/* =====================================================================
          TEAM + ACTIVITY
      ===================================================================== */}

      <section className="grid gap-5 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
        <Panel>
          <PanelHeader
            eyebrow="Company"
            title="Team today"
            description="Availability across Syntra Grid."
            action="View team"
          />

          <div className="space-y-3 px-4 pb-5 sm:px-5">
            <TeamMember
              initials="HA"
              name={admin?.fullName || admin?.name || "Hassan"}
              role="Founder / Administrator"
              status="Online"
            />

            <TeamMember
              initials="AM"
              name="Amina Musa"
              role="Client Success"
              status="Online"
            />

            <TeamMember
              initials="DK"
              name="David King"
              role="Engineering"
              status="Focus"
            />

            <TeamMember
              initials="FO"
              name="Fatima Okafor"
              role="Operations"
              status="Away"
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Activity"
            title="Recent activity"
            description="The latest changes across Syntra Grid."
            action="View activity"
          />

          <div className="divide-y divide-[var(--border)]">
            {RECENT_ACTIVITY.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        </Panel>
      </section>

      {/* =====================================================================
          END OF OVERVIEW
      ===================================================================== */}

      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-[10px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>Syntra Grid Operations Console</span>

        <span>
          Overview data is currently using testing/demo information.
        </span>
      </div>
    </div>
  );
}

/* =============================================================================
   COMPONENTS
============================================================================= */

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)] ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
        ) : null}

        <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-[var(--text)]">
          {title}
        </h2>

        {description ? (
          <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
      </div>

      {action ? (
        <button
          type="button"
          className="group inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
        >
          {action}
          <ChevronRight
            size={12}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </button>
      ) : null}
    </div>
  );
}

function OverviewAction({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[11px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-elevated)]"
    >
      <span className="text-[var(--text-muted)]">{icon}</span>
      {label}
    </button>
  );
}

function StatusLine({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[var(--text-muted)]">{icon}</span>
      {label}
    </span>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <article className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--surface-elevated)] text-[var(--text-muted)]">
          {metric.icon}
        </span>

        {metric.trend ? (
          <span className="rounded-full bg-[var(--surface-elevated)] px-2 py-1 text-[9px] font-semibold text-[var(--text-muted)]">
            {metric.trend}
          </span>
        ) : null}
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-medium text-[var(--text-muted)]">
          {metric.label}
        </p>

        <p className="mt-1 text-[24px] font-semibold tracking-[-0.04em] text-[var(--text)]">
          {metric.value}
        </p>

        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
          {metric.helper}
        </p>
      </div>
    </article>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const config =
    item.type === "urgent"
      ? {
          icon: <AlertCircle size={15} />,
          className: "text-[var(--danger,#ef4444)]",
          dot: "bg-[var(--danger,#ef4444)]",
        }
      : item.type === "warning"
        ? {
            icon: <Clock3 size={15} />,
            className: "text-[var(--warning,#f59e0b)]",
            dot: "bg-[var(--warning,#f59e0b)]",
          }
        : {
            icon: <Bell size={15} />,
            className: "text-[var(--text-muted)]",
            dot: "bg-[var(--text-muted)]",
          };

  return (
    <button
      type="button"
      className="group flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-[var(--surface-elevated)] sm:px-5"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--surface-elevated)] ${config.className}`}
      >
        {config.icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[12px] font-semibold text-[var(--text)]">
            {item.title}
          </p>

          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-[var(--text-muted)]">
            <span className={`h-1 w-1 rounded-full ${config.dot}`} />
            {item.workspace}
          </span>
        </div>

        <p className="mt-1 truncate text-[10px] text-[var(--text-muted)]">
          {item.description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-[9px] text-[var(--text-muted)] sm:block">
          {item.time}
        </span>

        <ArrowUpRight
          size={14}
          className="text-[var(--text-muted)] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--text)]"
        />
      </div>
    </button>
  );
}

function ScheduleRow({
  item,
  last,
}: {
  item: ScheduleItem;
  last?: boolean;
}) {
  const config = scheduleTypeConfig(item.type);

  return (
    <button
      type="button"
      className="group flex w-full gap-3 rounded-[13px] px-2 py-2.5 text-left transition hover:bg-[var(--surface-elevated)]"
    >
      <div className="w-[50px] shrink-0 pt-0.5">
        <p className="text-[10px] font-semibold text-[var(--text)]">
          {item.time}
        </p>

        {item.endTime ? (
          <p className="mt-0.5 text-[9px] text-[var(--text-muted)]">
            {item.endTime}
          </p>
        ) : null}
      </div>

      <div className="relative flex min-w-0 flex-1 gap-3">
        <div className="flex flex-col items-center">
          <span
            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${config.dot}`}
          />

          {!last ? (
            <span className="mt-1 h-full w-px bg-[var(--border)]" />
          ) : null}
        </div>

        <div className="min-w-0 pb-2">
          <p className="truncate text-[11px] font-semibold text-[var(--text)]">
            {item.title}
          </p>

          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[9px] text-[var(--text-muted)]">
              {item.context}
            </span>

            <span className="h-0.5 w-0.5 rounded-full bg-[var(--text-muted)]" />

            <span className="text-[9px] text-[var(--text-muted)]">
              {config.label}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const status = workspaceStatusConfig(workspace.status);

  return (
    <button
      type="button"
      className="group rounded-[17px] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--text-muted)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[var(--border)] bg-[var(--surface)] text-[10px] font-bold tracking-[-0.02em] text-[var(--text)]">
          {workspace.shortName}
        </span>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[8px] font-semibold ${status.className}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {workspace.statusLabel}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[12px] font-semibold text-[var(--text)]">
            {workspace.name}
          </h3>

          <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {workspace.type}
          </span>
        </div>

        <p className="mt-1 truncate text-[9px] text-[var(--text-muted)]">
          {workspace.description}
        </p>
      </div>

      <div className="mt-5 border-t border-[var(--border)] pt-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[8px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {workspace.metricLabel}
            </p>

            <p className="mt-1 text-[18px] font-semibold tracking-[-0.035em] text-[var(--text)]">
              {workspace.metricValue}
            </p>
          </div>

          <ArrowRight
            size={14}
            className="mb-1 text-[var(--text-muted)] transition-transform group-hover:translate-x-1"
          />
        </div>

        <p className="mt-1 text-[8px] text-[var(--text-muted)]">
          {workspace.secondaryMetric}
        </p>
      </div>
    </button>
  );
}

function ProjectRow({ project }: { project: Project }) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-[var(--surface-elevated)] sm:px-5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--surface-elevated)] text-[var(--text-muted)]">
        <Code2 size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-[var(--text)]">
              {project.name}
            </p>

            <p className="mt-0.5 text-[9px] text-[var(--text-muted)]">
              {project.workspace} · {project.members} contributors
            </p>
          </div>

          <span className="text-[9px] font-medium text-[var(--text-muted)]">
            {project.due}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{
                width: `${Math.max(0, Math.min(project.progress, 100))}%`,
              }}
            />
          </div>

          <span className="w-8 text-right text-[9px] font-semibold text-[var(--text)]">
            {project.progress}%
          </span>
        </div>
      </div>

      <ChevronRight
        size={14}
        className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

function PulseMetric({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        {icon}
        <span className="text-[9px] font-medium">{label}</span>
      </div>

      <p className="mt-4 text-[19px] font-semibold tracking-[-0.035em] text-[var(--text)]">
        {value}
      </p>

      <p className="mt-1 text-[9px] text-[var(--text-muted)]">{helper}</p>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[15px] border border-[var(--border)] bg-[var(--surface-elevated)] p-3.5">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        {icon}
        <span className="text-[9px] font-medium">{label}</span>
      </div>

      <p className="mt-3 text-[17px] font-semibold tracking-[-0.03em] text-[var(--text)]">
        {value}
      </p>

      <p className="mt-1 text-[8px] text-[var(--text-muted)]">{helper}</p>
    </div>
  );
}

function SupportMetric({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="bg-[var(--surface)] px-3 py-4 text-center">
      <p className="text-[18px] font-semibold tracking-[-0.035em] text-[var(--text)]">
        {value}
      </p>

      <p className="mt-1 text-[8px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </p>
    </div>
  );
}

function CompactSupportRow({
  workspace,
  title,
  priority,
}: {
  workspace: string;
  title: string;
  priority: string;
}) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left transition hover:bg-[var(--surface-elevated)]"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[var(--surface-elevated)] text-[var(--text-muted)]">
        <Headphones size={13} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold text-[var(--text)]">
          {title}
        </p>

        <p className="mt-0.5 text-[8px] text-[var(--text-muted)]">
          {workspace} · {priority}
        </p>
      </div>

      <ChevronRight
        size={12}
        className="text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

function TeamMember({
  initials,
  name,
  role,
  status,
}: {
  initials: string;
  name: string;
  role: string;
  status: "Online" | "Focus" | "Away";
}) {
  const statusClass =
    status === "Online"
      ? "bg-[var(--success,#22c55e)]"
      : status === "Focus"
        ? "bg-[var(--accent)]"
        : "bg-[var(--warning,#f59e0b)]";

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[9px] font-bold text-[var(--text)]">
          {initials}
        </span>

        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] ${statusClass}`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold text-[var(--text)]">
          {name}
        </p>

        <p className="mt-0.5 truncate text-[8px] text-[var(--text-muted)]">
          {role}
        </p>
      </div>

      <span className="text-[8px] font-medium text-[var(--text-muted)]">
        {status}
      </span>
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const config = activityConfig(activity.type);

  return (
    <button
      type="button"
      className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--surface-elevated)] sm:px-5"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-elevated)] text-[var(--text-muted)]">
        {config.icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold text-[var(--text)]">
          {activity.title}
        </p>

        <p className="mt-0.5 truncate text-[8px] text-[var(--text-muted)]">
          {activity.description}
        </p>
      </div>

      <span className="shrink-0 text-[8px] text-[var(--text-muted)]">
        {activity.time}
      </span>
    </button>
  );
}

/* =============================================================================
   CONFIG / HELPERS
============================================================================= */

function workspaceStatusConfig(status: WorkspaceStatus) {
  switch (status) {
    case "healthy":
      return {
        className:
          "bg-[rgba(34,197,94,0.10)] text-[var(--success,#22c55e)]",
        dot: "bg-[var(--success,#22c55e)]",
      };

    case "attention":
      return {
        className:
          "bg-[rgba(245,158,11,0.10)] text-[var(--warning,#f59e0b)]",
        dot: "bg-[var(--warning,#f59e0b)]",
      };

    case "development":
      return {
        className:
          "bg-[var(--accent-tint)] text-[var(--accent)]",
        dot: "bg-[var(--accent)]",
      };
  }
}

function scheduleTypeConfig(type: ScheduleItem["type"]) {
  switch (type) {
    case "meeting":
      return {
        label: "Meeting",
        dot: "bg-[var(--accent)]",
      };

    case "deployment":
      return {
        label: "Deployment",
        dot: "bg-[var(--success,#22c55e)]",
      };

    case "deadline":
      return {
        label: "Deadline",
        dot: "bg-[var(--danger,#ef4444)]",
      };

    case "review":
      return {
        label: "Review",
        dot: "bg-[var(--warning,#f59e0b)]",
      };
  }
}

function activityConfig(type: ActivityItem["type"]) {
  switch (type) {
    case "deployment":
      return {
        icon: <Cloud size={14} />,
      };

    case "support":
      return {
        icon: <Headphones size={14} />,
      };

    case "finance":
      return {
        icon: <CircleDollarSign size={14} />,
      };

    case "project":
      return {
        icon: <PackageCheck size={14} />,
      };

    case "client":
      return {
        icon: <Users size={14} />,
      };

    case "system":
      return {
        icon: <Server size={14} />,
      };
  }
}

function getGreeting(date: Date) {
  const hour = date.getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}