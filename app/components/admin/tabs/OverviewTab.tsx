"use client";

import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Cloud,
  Headphones,
  PackageCheck,
  Server,
  Users,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/* =============================================================================
   TYPES
============================================================================= */

type Destination =
  | "calendar"
  | "notifications"
  | "quick-action"
  | "attention"
  | "projects"
  | "activity"
  | "portfolio"
  | "support"
  | "finance"
  | "team";

type OverviewTabProps = {
  admin?: {
    fullName?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  /** Optional: wire this to your tab router so links on the overview work. */
  onNavigate?: (destination: Destination) => void;
};

type WorkspaceStatus = "healthy" | "attention" | "development";

type Workspace = {
  id: string;
  name: string;
  shortName: string;
  type: "Client" | "Product";
  status: WorkspaceStatus;
  statusLabel: string;
  metricLabel: string;
  metricValue: number;
  metricSuffix: string;
  metricDecimals?: number;
};

type AttentionItem = {
  id: string;
  title: string;
  description: string;
  workspace: string;
  type: "urgent" | "warning" | "normal";
  time: string;
};

type ScheduleType = "meeting" | "deadline" | "deployment" | "review";

type ScheduleItem = {
  id: string;
  time: string;
  endTime?: string;
  title: string;
  context: string;
  type: ScheduleType;
};

type Project = {
  id: string;
  name: string;
  workspace: string;
  progress: number;
  due: string;
  members: number;
};

type ActivityType = "deployment" | "support" | "finance" | "project" | "client" | "system";

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  type: ActivityType;
  /** Static label for seeded items, e.g. "43 min ago". */
  time?: string;
  /** Real timestamp for live items; shown as relative time. */
  at?: number;
  fresh?: boolean;
};

type TeamStatus = "Online" | "Focus" | "Away";

/* =============================================================================
   DEMO DATA — isolated so it can be swapped for API data later
============================================================================= */

const WORKSPACES: Workspace[] = [
  {
    id: "rentwise",
    name: "RentWise",
    shortName: "RW",
    type: "Client",
    status: "healthy",
    statusLabel: "On track",
    metricLabel: "Launch readiness",
    metricValue: 82,
    metricSuffix: "%",
  },
  {
    id: "esteem",
    name: "Esteem Learning Centre",
    shortName: "EL",
    type: "Client",
    status: "healthy",
    statusLabel: "Operational",
    metricLabel: "Uptime",
    metricValue: 99.9,
    metricSuffix: "%",
    metricDecimals: 1,
  },
  {
    id: "meldex",
    name: "Meldex Industries",
    shortName: "MI",
    type: "Client",
    status: "healthy",
    statusLabel: "Operational",
    metricLabel: "Uptime",
    metricValue: 100,
    metricSuffix: "%",
  },
  {
    id: "zing",
    name: "Zing",
    shortName: "ZG",
    type: "Product",
    status: "development",
    statusLabel: "Pre-launch",
    metricLabel: "Launch readiness",
    metricValue: 68,
    metricSuffix: "%",
  },
];

const ATTENTION_ITEMS: AttentionItem[] = [
  {
    id: "att-1",
    title: "Zing passenger wallet needs review",
    description: "The payment and wallet flow is ready for the next product review.",
    workspace: "Zing",
    type: "urgent",
    time: "Today",
  },
  {
    id: "att-2",
    title: "RentWise launch checklist",
    description: "7 launch-readiness items are still open before December.",
    workspace: "RentWise",
    type: "warning",
    time: "Due this week",
  },
  {
    id: "att-3",
    title: "Esteem support request",
    description: "A new administration request is waiting for triage.",
    workspace: "Esteem",
    type: "normal",
    time: "2 h ago",
  },
];

const TODAY_SCHEDULE: ScheduleItem[] = [
  { id: "s-1", time: "09:30", endTime: "10:00", title: "Morning operations review", context: "Syntra Grid", type: "review" },
  { id: "s-2", time: "11:00", endTime: "12:00", title: "Zing launch readiness", context: "Zing", type: "meeting" },
  { id: "s-3", time: "14:30", endTime: "15:15", title: "RentWise product review", context: "RentWise", type: "meeting" },
  { id: "s-4", time: "17:00", title: "Production deployment window", context: "Esteem", type: "deployment" },
];

const PROJECTS: Project[] = [
  { id: "p-1", name: "RentWise production launch", workspace: "RentWise", progress: 82, due: "December", members: 5 },
  { id: "p-2", name: "Zing Abuja launch", workspace: "Zing", progress: 68, due: "November", members: 4 },
  { id: "p-3", name: "Esteem platform improvements", workspace: "Esteem", progress: 74, due: "4 Oct", members: 3 },
];

const SEED_ACTIVITY: ActivityItem[] = [
  { id: "a-1", title: "Deployment completed", description: "RentWise production build deployed successfully.", time: "18 min ago", type: "deployment" },
  { id: "a-2", title: "Support ticket resolved", description: "Esteem Learning Centre, teacher access issue.", time: "43 min ago", type: "support" },
  { id: "a-3", title: "Milestone completed", description: "Zing driver active-ride experience.", time: "1 h ago", type: "project" },
  { id: "a-4", title: "New client feedback", description: "RentWise feedback was added to the workspace.", time: "2 h ago", type: "client" },
  { id: "a-5", title: "Invoice paid", description: "Meldex Industries monthly service invoice.", time: "Yesterday", type: "finance" },
];

/** Demo only: events that "arrive" while the page is open, so the feed feels live. */
const DEMO_LIVE_FEED = true;
const DEMO_FEED_INTERVAL_MS = 16_000;
const DEMO_INCOMING: Array<Omit<ActivityItem, "id">> = [
  { title: "Health check passed", description: "All 12 production services responded normally.", type: "system" },
  { title: "Pull request merged", description: "Zing wallet top-up flow merged into main.", type: "project" },
  { title: "New support message", description: "RentWise asked about the payment flow.", type: "support" },
  { title: "Preview deployed", description: "Esteem staging build is ready to review.", type: "deployment" },
];

const TEAM: Array<{ initials: string; name: string; role: string; status: TeamStatus }> = [
  { initials: "AM", name: "Amina Musa", role: "Client Success", status: "Online" },
  { initials: "DK", name: "David King", role: "Engineering", status: "Focus" },
  { initials: "FO", name: "Fatima Okafor", role: "Operations", status: "Away" },
];

const SUPPORT = { urgent: 2, awaiting: 5, open: 12 };

/* =============================================================================
   MOTION (one stylesheet, scoped by the sg- prefix)
============================================================================= */

const MOTION_CSS = `
@keyframes sg-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.sg-rise { animation: sg-rise 0.8s cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: var(--d, 0ms); }

@keyframes sg-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.sg-grow { transform-origin: left center; animation: sg-grow 1.2s cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: var(--d, 0ms); }

@keyframes sg-grow-y { from { transform: scaleY(0); } to { transform: scaleY(1); } }
.sg-grow-y { transform-origin: top center; animation: sg-grow-y 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: var(--d, 0ms); }

@keyframes sg-ping { 0% { transform: scale(1); opacity: 0.5; } 80%, 100% { transform: scale(2.8); opacity: 0; } }
.sg-ping { position: relative; }
.sg-ping::after { content: ""; position: absolute; inset: 0; border-radius: 9999px; background: currentColor; animation: sg-ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite; }

@keyframes sg-drift { to { transform: translateX(-60px); } }
.sg-drift { animation: sg-drift var(--speed, 2.4s) linear infinite; }

@keyframes sg-feed-in {
  from { opacity: 0; transform: translateY(-10px); max-height: 0; }
  to { opacity: 1; transform: none; max-height: 96px; }
}
.sg-feed-in { animation: sg-feed-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; overflow: hidden; }

@keyframes sg-glow {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 40%, transparent); }
  50% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent) 0%, transparent); }
}
.sg-glow { animation: sg-glow 2.6s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .sg-root *, .sg-root *::after { animation: none !important; transition-duration: 0ms !important; }
}
`;

const delay = (ms: number) => ({ ["--d" as string]: `${ms}ms` }) as CSSProperties;

/* =============================================================================
   HOOKS + HELPERS
============================================================================= */

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useCountUp(target: number, { duration = 1200, delayMs = 0 } = {}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target);
      return;
    }
    let raf = 0;
    const startAt = performance.now() + delayMs;
    const tick = (time: number) => {
      const progress = Math.min(Math.max((time - startAt) / duration, 0), 1);
      setValue(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delayMs]);

  return value;
}

function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  delayMs = 0,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  delayMs?: number;
}) {
  const current = useCountUp(value, { delayMs });
  return (
    <span className="tabular-nums">
      {prefix}
      {current.toFixed(decimals)}
      {suffix}
    </span>
  );
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

function formatIn(minutes: number) {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function relativeTime(at: number, now: Date) {
  const minutes = Math.floor((now.getTime() - at) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

const SCHEDULE_TYPES: Record<ScheduleType, { label: string; color: string }> = {
  meeting: { label: "Meeting", color: "var(--accent)" },
  deployment: { label: "Deployment", color: "var(--success, #22c55e)" },
  deadline: { label: "Deadline", color: "var(--danger, #ef4444)" },
  review: { label: "Review", color: "var(--warning, #f59e0b)" },
};

const STATUS_COLOR: Record<WorkspaceStatus, string> = {
  healthy: "var(--success, #22c55e)",
  attention: "var(--warning, #f59e0b)",
  development: "var(--accent)",
};

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";

/* =============================================================================
   MAIN
============================================================================= */

export default function OverviewTab({ admin, onNavigate }: OverviewTabProps) {
  const now = useNow();
  const go = (destination: Destination) => () => onNavigate?.(destination);

  const firstName = useMemo(() => {
    const source = admin?.fullName?.trim() || admin?.name?.trim() || admin?.email?.split("@")[0] || "Hassan";
    return source.split(/\s+/)[0];
  }, [admin]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const focus = useMemo(() => {
    const ongoing = TODAY_SCHEDULE.find((item) => {
      const start = toMinutes(item.time);
      const end = item.endTime ? toMinutes(item.endTime) : start + 30;
      return nowMinutes >= start && nowMinutes < end;
    });
    if (ongoing) return { kind: "ongoing" as const, item: ongoing };
    const next = TODAY_SCHEDULE.find((item) => toMinutes(item.time) > nowMinutes);
    if (next) return { kind: "next" as const, item: next, inMinutes: toMinutes(next.time) - nowMinutes };
    return { kind: "clear" as const };
  }, [nowMinutes]);

  return (
    <div className="sg-root space-y-8">
      <style>{MOTION_CSS}</style>

      {/* =====================================================================
          HERO — the day at a glance
      ===================================================================== */}

      <section className="sg-rise overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)]">
        <div className="relative px-5 pt-6 sm:px-7 lg:px-8 lg:pt-8">
          <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[var(--accent-tint)] opacity-80 blur-3xl" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="text-[13px] text-[var(--text-muted)]">
                {formatFullDate(now)}
                <span className="mx-2 text-[var(--border)]">/</span>
                <span className="tabular-nums">{formatClock(now)}</span>
              </p>

              <h1 className="mt-2 text-[30px] font-semibold leading-[1.1] tracking-[-0.04em] text-[var(--text)] sm:text-[38px]">
                {getGreeting(now)}, {firstName}.
              </h1>

              <p className="mt-3 text-[15px] leading-7 text-[var(--text-muted)]">
                {focus.kind === "ongoing" && (
                  <>
                    You&apos;re in <span className="font-medium text-[var(--text)]">{focus.item.title}</span>
                    {focus.item.endTime ? <> until {focus.item.endTime}</> : null}.{" "}
                  </>
                )}
                {focus.kind === "next" && (
                  <>
                    Next up is <span className="font-medium text-[var(--text)]">{focus.item.title}</span> in{" "}
                    {formatIn(focus.inMinutes)}.{" "}
                  </>
                )}
                {focus.kind === "clear" && <>Your schedule is clear for the rest of the day. </>}
                {ATTENTION_ITEMS.length} things are waiting on you, and every production system is online.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <HeroButton icon={<CalendarDays size={15} />} label="Calendar" onClick={go("calendar")} />
              <HeroButton icon={<Bell size={15} />} label="Notifications" badge={3} onClick={go("notifications")} />
              <button
                type="button"
                onClick={go("quick-action")}
                className={`inline-flex h-10 items-center gap-2 rounded-full bg-[var(--text)] px-4 text-[12.5px] font-semibold text-[var(--shell)] transition-[transform,opacity] hover:-translate-y-px hover:opacity-90 active:translate-y-0 ${FOCUS}`}
              >
                <Zap size={15} />
                Quick action
              </button>
            </div>
          </div>

          <DayTimeline items={TODAY_SCHEDULE} now={now} onOpen={go("calendar")} />
        </div>

        {/* Figures */}
        <div className="grid grid-cols-2 border-t border-[var(--border)] lg:grid-cols-4">
          <HeroFigure label="Active workspaces" helper="3 clients, 1 product" value={4} delayMs={200} />
          <HeroFigure label="Open projects" helper="3 launch-critical" value={8} delayMs={300} trend="+2 this month" />
          <HeroFigure label="Open support" helper="2 need attention" value={SUPPORT.open} delayMs={400} />
          <HeroFigure label="System uptime" helper="Last 30 days" value={99.9} decimals={1} suffix="%" delayMs={500} live />
        </div>
      </section>

      {/* =====================================================================
          BODY — open main column + one instrument rail
      ===================================================================== */}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0 space-y-10">
          {/* Needs you */}
          <section className="sg-rise" style={delay(150)}>
            <SectionHeading title="Needs you" count={ATTENTION_ITEMS.length} action="View all" onAction={go("attention")} />
            <div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {ATTENTION_ITEMS.map((item, index) => (
                <AttentionRow key={item.id} item={item} index={index} onClick={go("attention")} />
              ))}
            </div>
          </section>

          {/* Delivery */}
          <section className="sg-rise" style={delay(250)}>
            <SectionHeading title="Delivery" count={PROJECTS.length} action="All projects" onAction={go("projects")} />
            <div className="mt-4 space-y-5">
              {PROJECTS.map((project, index) => (
                <ProjectRow key={project.id} project={project} delayMs={400 + index * 120} onClick={go("projects")} />
              ))}
            </div>
          </section>

          {/* Activity */}
          <section className="sg-rise" style={delay(350)}>
            <ActivityFeed now={now} onOpen={go("activity")} />
          </section>
        </main>

        {/* Instrument rail */}
        <aside
          className="sg-rise h-fit divide-y divide-[var(--border)] overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]"
          style={delay(200)}
        >
          <RailSection title="Workspaces" action="Portfolio" onAction={go("portfolio")}>
            <div className="space-y-1">
              {WORKSPACES.map((workspace, index) => (
                <WorkspaceRow key={workspace.id} workspace={workspace} index={index} onClick={go("portfolio")} />
              ))}
            </div>
          </RailSection>

          <RailSection title="Support" action="Open" onAction={go("support")}>
            <SupportMeter />
          </RailSection>

          <RailSection title="Operations">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <OpsFigure label="Systems online" value={12} suffix=" / 12" />
              <OpsFigure label="Deploys this week" value={7} />
              <OpsFigure label="Unread messages" value={18} />
              <OpsFigure label="Critical incidents" value={0} />
            </dl>
          </RailSection>

          <RailSection title="Finance" action="Open" onAction={go("finance")} note="Demo figures">
            <dl className="space-y-2.5 text-[13px]">
              <FinanceLine label="Revenue" value="₦0" helper="Pre-revenue" />
              <FinanceLine label="Receivables" value="₦0" helper="Nothing outstanding" />
              <FinanceLine label="Operating costs" value="₦184k" helper="This month" />
              <FinanceLine label="Runway" value="Not set" muted />
            </dl>
          </RailSection>

          <RailSection title="Team today" action="View team" onAction={go("team")}>
            <TeamList adminName={admin?.fullName || admin?.name || "Hassan"} />
          </RailSection>
        </aside>
      </div>

      <p className="pb-2 text-[11.5px] text-[var(--text-muted)]">
        Overview is showing demo data while Syntra Grid is in testing.
      </p>
    </div>
  );
}

/* =============================================================================
   HERO PIECES
============================================================================= */

const DAY_START = 7 * 60;
const DAY_END = 21 * 60;

function DayTimeline({ items, now, onOpen }: { items: ScheduleItem[]; now: Date; onOpen: () => void }) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const pct = (minutes: number) =>
    Math.min(Math.max(((minutes - DAY_START) / (DAY_END - DAY_START)) * 100, 0), 100);
  const nowPct = pct(nowMinutes);
  const nextId = items.find((item) => toMinutes(item.time) > nowMinutes)?.id;
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);

  return (
    <div className="relative -mx-5 mt-6 overflow-x-auto px-5 sm:-mx-7 sm:px-7 lg:-mx-8 lg:px-8">
      <div className="relative min-w-[680px] py-[68px]">
        <div className="relative h-[3px] rounded-full bg-[var(--border)]">
          {/* Hour ticks */}
          {hours.map((minutes) => (
            <span
              key={minutes}
              className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-[var(--border)]"
              style={{ left: `${pct(minutes)}%` }}
            />
          ))}

          {/* Elapsed part of the day */}
          <div
            className="sg-grow absolute inset-y-0 left-0 rounded-full bg-[var(--accent)] transition-[width] duration-1000"
            style={{ width: `${nowPct}%`, ...delay(300) }}
          />

          {/* Events */}
          {items.map((item, index) => {
            const start = toMinutes(item.time);
            const end = item.endTime ? toMinutes(item.endTime) : start;
            const past = (item.endTime ? end : start + 30) <= nowMinutes;
            const ongoing = !past && start <= nowMinutes;
            const isNext = item.id === nextId;
            const color = SCHEDULE_TYPES[item.type].color;
            const above = index % 2 === 0;

            return (
              <div key={item.id}>
                {end > start && (
                  <span
                    className="absolute top-1/2 h-[7px] -translate-y-1/2 rounded-full"
                    style={{
                      left: `${pct(start)}%`,
                      width: `${pct(end) - pct(start)}%`,
                      background: color,
                      opacity: past ? 0.35 : 0.9,
                    }}
                  />
                )}

                <span
                  className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] ${
                    ongoing ? "sg-ping" : ""
                  }`}
                  style={{ left: `${pct(start)}%`, background: color, color, opacity: past ? 0.45 : 1 }}
                />

                <button
                  type="button"
                  onClick={onOpen}
                  className={`group absolute w-[168px] -translate-x-3 rounded-lg px-1.5 py-1 text-left transition-[opacity,background-color] hover:bg-[var(--surface-elevated)] ${FOCUS} ${
                    above ? "bottom-[calc(100%+12px)]" : "top-[calc(100%+12px)]"
                  } ${past ? "opacity-45 hover:opacity-100" : ""}`}
                  style={{ left: `${pct(start)}%` }}
                >
                  <span className="flex items-center gap-1.5 text-[11.5px] tabular-nums text-[var(--text-muted)]">
                    {item.time}
                    {item.endTime ? `–${item.endTime}` : ""}
                    {isNext && (
                      <span className="rounded-full bg-[var(--accent-tint)] px-1.5 text-[10.5px] font-medium text-[var(--accent)]">
                        in {formatIn(start - nowMinutes)}
                      </span>
                    )}
                    {ongoing && (
                      <span className="rounded-full bg-[var(--accent-tint)] px-1.5 text-[10.5px] font-medium text-[var(--accent)]">
                        now
                      </span>
                    )}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-[13px] text-[var(--text)] ${
                      isNext || ongoing ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {item.title}
                  </span>
                </button>
              </div>
            );
          })}

          {/* Now marker */}
          {nowMinutes >= DAY_START && nowMinutes <= DAY_END && (
            <div
              className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-1000"
              style={{ left: `${nowPct}%` }}
            >
              <span className="sg-glow flex h-[22px] items-center rounded-full bg-[var(--accent)] px-2 text-[10.5px] font-semibold tabular-nums text-[var(--shell)] shadow-sm">
                {formatClock(now)}
              </span>
            </div>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-3 flex justify-between text-[10.5px] tabular-nums text-[var(--text-muted)]">
          <span>07:00</span>
          <span>21:00</span>
        </div>
      </div>
    </div>
  );
}

function HeroButton({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-[12.5px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-elevated)] ${FOCUS}`}
    >
      <span className="text-[var(--text-muted)]">{icon}</span>
      {label}
      {badge ? (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold tabular-nums text-[var(--shell)]">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function HeroFigure({
  label,
  helper,
  value,
  decimals,
  suffix,
  trend,
  live,
  delayMs,
}: {
  label: string;
  helper: string;
  value: number;
  decimals?: number;
  suffix?: string;
  trend?: string;
  live?: boolean;
  delayMs: number;
}) {
  return (
    <div className="border-[var(--border)] px-5 py-5 even:border-l sm:px-7 lg:border-l lg:px-8 lg:first:border-l-0">
      <p className="flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
        {live && (
          <span className="sg-ping h-1.5 w-1.5 rounded-full bg-[var(--success,#22c55e)] text-[var(--success,#22c55e)]" />
        )}
        {label}
      </p>
      <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.045em] text-[var(--text)]">
        <CountUp value={value} decimals={decimals} suffix={suffix} delayMs={delayMs} />
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-muted)]">
        {helper}
        {trend && <span className="font-medium text-[var(--success,#22c55e)]">{trend}</span>}
      </p>
    </div>
  );
}

/* =============================================================================
   MAIN COLUMN PIECES
============================================================================= */

function SectionHeading({
  title,
  count,
  action,
  onAction,
  children,
}: {
  title: string;
  count?: number;
  action?: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="flex items-baseline gap-2 text-[19px] font-semibold tracking-[-0.03em] text-[var(--text)]">
        {title}
        {count !== undefined && <span className="text-[14px] font-normal text-[var(--text-muted)]">{count}</span>}
        {children}
      </h2>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className={`group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)] ${FOCUS}`}
        >
          {action}
          <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

function AttentionRow({ item, index, onClick }: { item: AttentionItem; index: number; onClick: () => void }) {
  const color =
    item.type === "urgent"
      ? "var(--danger, #ef4444)"
      : item.type === "warning"
        ? "var(--warning, #f59e0b)"
        : "var(--text-muted)";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full items-start gap-4 py-4 pl-5 pr-2 text-left transition-colors hover:bg-[var(--surface)] ${FOCUS}`}
    >
      <span
        className="sg-grow-y absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
        style={{ background: color, ...delay(500 + index * 120) }}
      />

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--text)]">{item.title}</span>
          {item.type === "urgent" && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color }}>
              <AlertCircle size={12} />
              Urgent
            </span>
          )}
        </span>
        <span className="mt-1 block text-[13px] leading-5 text-[var(--text-muted)]">{item.description}</span>
        <span className="mt-2 flex items-center gap-3 text-[11.5px] text-[var(--text-muted)]">
          <span>{item.workspace}</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={11} />
            {item.time}
          </span>
        </span>
      </span>

      <ArrowUpRight
        size={16}
        className="mt-0.5 shrink-0 text-[var(--text-muted)] opacity-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--text)] group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </button>
  );
}

function ProjectRow({ project, delayMs, onClick }: { project: Project; delayMs: number; onClick: () => void }) {
  const progress = Math.max(0, Math.min(project.progress, 100));

  return (
    <button type="button" onClick={onClick} className={`group block w-full rounded-xl text-left ${FOCUS}`}>
      <span className="flex items-baseline justify-between gap-4">
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--text)] transition-colors group-hover:text-[var(--accent)]">
            {project.name}
          </span>
          <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]">
            {project.workspace}, {project.members} people, due {project.due}
          </span>
        </span>
        <span className="shrink-0 text-[22px] font-semibold tracking-[-0.04em] text-[var(--text)]">
          <CountUp value={progress} suffix="%" delayMs={delayMs} />
        </span>
      </span>

      <span className="relative mt-3 block h-[3px] overflow-hidden rounded-full bg-[var(--border)]">
        <span
          className="sg-grow absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
          style={{ width: `${progress}%`, ...delay(delayMs) }}
        />
      </span>
    </button>
  );
}

function ActivityFeed({ now, onOpen }: { now: Date; onOpen: () => void }) {
  const [items, setItems] = useState<ActivityItem[]>(SEED_ACTIVITY);
  const cursor = useRef(0);

  useEffect(() => {
    if (!DEMO_LIVE_FEED) return;
    const id = window.setInterval(() => {
      const template = DEMO_INCOMING[cursor.current % DEMO_INCOMING.length];
      cursor.current += 1;
      setItems((current) => [
        { ...template, id: `live-${Date.now()}`, at: Date.now(), fresh: true },
        ...current.map((item) => ({ ...item, fresh: false })),
      ].slice(0, 6));
    }, DEMO_FEED_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <SectionHeading title="Activity" action="View all" onAction={onOpen}>
        <span className="inline-flex items-center gap-1.5 self-center text-[12px] font-medium text-[var(--success,#22c55e)]">
          <span className="sg-ping h-1.5 w-1.5 rounded-full bg-current" />
          Live
        </span>
      </SectionHeading>

      <ol className="relative mt-4">
        <span className="absolute bottom-3 left-[15px] top-3 w-px bg-[var(--border)]" aria-hidden />
        {items.map((item) => (
          <li key={item.id} className={item.fresh ? "sg-feed-in" : ""}>
            <button
              type="button"
              onClick={onOpen}
              className={`group relative flex w-full items-start gap-4 rounded-xl py-2.5 pr-2 text-left ${FOCUS}`}
            >
              <span
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[var(--surface)] transition-colors ${
                  item.fresh
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text-muted)] group-hover:text-[var(--text)]"
                }`}
              >
                <ActivityIcon type={item.type} />
              </span>
              <span className="min-w-0 flex-1 pt-1">
                <span className="block text-[13.5px] font-medium text-[var(--text)]">{item.title}</span>
                <span className="mt-0.5 block truncate text-[12.5px] text-[var(--text-muted)]">{item.description}</span>
              </span>
              <span className="shrink-0 pt-1.5 text-[11.5px] tabular-nums text-[var(--text-muted)]">
                {item.at ? relativeTime(item.at, now) : item.time}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

function ActivityIcon({ type }: { type: ActivityType }) {
  switch (type) {
    case "deployment":
      return <Cloud size={14} />;
    case "support":
      return <Headphones size={14} />;
    case "finance":
      return <CircleDollarSign size={14} />;
    case "project":
      return <PackageCheck size={14} />;
    case "client":
      return <Users size={14} />;
    case "system":
      return <Server size={14} />;
  }
}

/* =============================================================================
   RAIL PIECES
============================================================================= */

function RailSection({
  title,
  action,
  onAction,
  note,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-baseline gap-2 text-[14px] font-semibold tracking-[-0.015em] text-[var(--text)]">
          {title}
          {note && <span className="text-[11.5px] font-normal text-[var(--text-muted)]">{note}</span>}
        </h3>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className={`group inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)] ${FOCUS}`}
          >
            {action}
            <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function WorkspaceRow({ workspace, index, onClick }: { workspace: Workspace; index: number; onClick: () => void }) {
  const color = STATUS_COLOR[workspace.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-[var(--surface-elevated)] ${FOCUS}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[11px] font-semibold text-[var(--text)]">
        {workspace.shortName}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[var(--text)]">{workspace.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px]" style={{ color }}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {workspace.statusLabel}
        </span>
      </span>

      <Heartbeat status={workspace.status} offset={index} />

      <span className="w-[52px] shrink-0 text-right">
        <span className="block text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">
          <CountUp
            value={workspace.metricValue}
            decimals={workspace.metricDecimals}
            suffix={workspace.metricSuffix}
            delayMs={500 + index * 100}
          />
        </span>
        <span className="block truncate text-[10.5px] text-[var(--text-muted)]" title={workspace.metricLabel}>
          {workspace.metricLabel === "Launch readiness" ? "Ready" : workspace.metricLabel}
        </span>
      </span>
    </button>
  );
}

/** A small scrolling pulse line; its rhythm reflects the workspace status. */
function Heartbeat({ status, offset }: { status: WorkspaceStatus; offset: number }) {
  const maskId = useId();

  const beat = (x: number) => {
    if (status === "development") {
      return `M${x} 12 H${x + 18} Q${x + 30} 4 ${x + 42} 12 H${x + 60}`;
    }
    if (status === "attention") {
      return `M${x} 12 H${x + 14} L${x + 18} 5 L${x + 22} 17 L${x + 27} 8 L${x + 31} 15 L${x + 35} 12 H${x + 60}`;
    }
    return `M${x} 12 H${x + 20} L${x + 24} 7 L${x + 28} 17 L${x + 32} 3 L${x + 36} 14 L${x + 39} 12 H${x + 60}`;
  };

  const d = Array.from({ length: 4 }, (_, i) => beat(i * 60)).join(" ");
  const speed = status === "development" ? "3.6s" : status === "attention" ? "1.6s" : "2.4s";

  return (
    <svg viewBox="0 0 120 24" className="h-6 w-[84px] shrink-0" aria-hidden style={{ color: STATUS_COLOR[status] }}>
      <defs>
        <linearGradient id={`${maskId}-g`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.35" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity="1" />
        </linearGradient>
        <mask id={`${maskId}-m`}>
          <rect width="120" height="24" fill={`url(#${maskId}-g)`} />
        </mask>
      </defs>
      <g mask={`url(#${maskId}-m)`}>
        <g
          className="sg-drift"
          style={{ ["--speed" as string]: speed, animationDelay: `-${offset * 0.7}s` } as CSSProperties}
        >
          <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

function SupportMeter() {
  const other = SUPPORT.open - SUPPORT.urgent - SUPPORT.awaiting;
  const segments = [
    { label: "Urgent", value: SUPPORT.urgent, color: "var(--danger, #ef4444)" },
    { label: "Awaiting reply", value: SUPPORT.awaiting, color: "var(--warning, #f59e0b)" },
    { label: "In progress", value: other, color: "var(--accent)" },
  ];

  return (
    <div>
      <p className="flex items-baseline gap-2">
        <span className="text-[28px] font-semibold leading-none tracking-[-0.045em] text-[var(--text)]">
          <CountUp value={SUPPORT.open} delayMs={600} />
        </span>
        <span className="text-[12.5px] text-[var(--text-muted)]">open conversations</span>
      </p>

      <div className="mt-4 flex h-2 gap-[3px] overflow-hidden rounded-full">
        {segments.map((segment, index) => (
          <span
            key={segment.label}
            className="sg-grow h-full rounded-full"
            style={{ flexGrow: segment.value, background: segment.color, ...delay(650 + index * 120) }}
          />
        ))}
      </div>

      <ul className="mt-3 space-y-1.5">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between text-[12.5px]">
            <span className="flex items-center gap-2 text-[var(--text-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ background: segment.color }} />
              {segment.label}
            </span>
            <span className="font-medium tabular-nums text-[var(--text)]">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OpsFigure({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 text-[20px] font-semibold tracking-[-0.035em] text-[var(--text)]">
        <CountUp value={value} suffix={suffix} delayMs={700} />
      </dd>
    </div>
  );
}

function FinanceLine({
  label,
  value,
  helper,
  muted = false,
}: {
  label: string;
  value: string;
  helper?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--text-muted)]">
        {label}
        {helper && <span className="ml-2 text-[11.5px] opacity-70">{helper}</span>}
      </dt>
      <dd className={`font-semibold tabular-nums ${muted ? "text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
        {value}
      </dd>
    </div>
  );
}

function TeamList({ adminName }: { adminName: string }) {
  const people = [
    { initials: adminName.slice(0, 2).toUpperCase(), name: adminName, role: "Founder", status: "Online" as TeamStatus },
    ...TEAM,
  ];

  const statusColor = (status: TeamStatus) =>
    status === "Online"
      ? "var(--success, #22c55e)"
      : status === "Focus"
        ? "var(--accent)"
        : "var(--warning, #f59e0b)";

  return (
    <ul className="space-y-3">
      {people.map((person) => (
        <li key={person.name} className="flex items-center gap-3">
          <span className="relative shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[10.5px] font-semibold text-[var(--text)]">
              {person.initials}
            </span>
            <span
              className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] ${
                person.status === "Online" ? "sg-ping" : ""
              }`}
              style={{ background: statusColor(person.status), color: statusColor(person.status) }}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-[var(--text)]">{person.name}</span>
            <span className="block truncate text-[11.5px] text-[var(--text-muted)]">{person.role}</span>
          </span>
          <span className="text-[11.5px] text-[var(--text-muted)]">{person.status}</span>
        </li>
      ))}
    </ul>
  );
}