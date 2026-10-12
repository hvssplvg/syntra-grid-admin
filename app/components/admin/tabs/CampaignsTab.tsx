/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";

import {
  Activity,
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderKanban,
  Layers3,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Target,
  Users,
  X,
} from "lucide-react";

/* ============================================================================
   TYPES
============================================================================ */

type IconType = ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

type CampaignView =
  | "overview"
  | "campaigns"
  | "planner"
  | "content"
  | "audiences"
  | "budget"
  | "analytics"
  | "approvals";

type CampaignStatus =
  | "DRAFT"
  | "PLANNING"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

type CampaignSummary = {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
};

type CampaignAdmin = { id: string; firstName: string | null; lastName: string | null; email: string } | null;

type ApiCampaign = {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
  createdAt: string;
  createdBy: CampaignAdmin;
  updatedBy: CampaignAdmin;
};

type Pagination = { page: number; pageSize: number; total: number; pages: number; hasPrevious: boolean; hasNext: boolean };

type Notice = { id: number; message: string; tone: "success" | "error" };

type DialogRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger";
  onConfirm: () => Promise<void>;
};

const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "DRAFT",
  "PLANNING",
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
];

function adminName(admin: CampaignAdmin): string | null {
  if (!admin) return null;
  const name = [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim();
  return name || admin.email;
}

type CampaignOverview = {
  total: number;
  active: number;
  scheduled: number;
  completed: number;
  pendingApprovals: number;
  upcomingActivities: number;
  campaigns: CampaignSummary[];
};

type LoadState = "loading" | "ready" | "unavailable";

/* ============================================================================
   NAVIGATION
============================================================================ */

const NAVIGATION: {
  id: CampaignView;
  label: string;
  icon: IconType;
}[] = [
  {
    id: "overview",
    label: "Overview",
    icon: Layers3,
  },
  {
    id: "campaigns",
    label: "Campaigns",
    icon: Megaphone,
  },
  {
    id: "planner",
    label: "Planner",
    icon: CalendarDays,
  },
  {
    id: "content",
    label: "Content",
    icon: FileText,
  },
  {
    id: "audiences",
    label: "Audiences",
    icon: Users,
  },
  {
    id: "budget",
    label: "Budget",
    icon: CircleDollarSign,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
  },
  {
    id: "approvals",
    label: "Approvals",
    icon: ClipboardCheck,
  },
];

const EMPTY_OVERVIEW: CampaignOverview = {
  total: 0,
  active: 0,
  scheduled: 0,
  completed: 0,
  pendingApprovals: 0,
  upcomingActivities: 0,
  campaigns: [],
};

/* ============================================================================
   HELPERS
============================================================================ */

function cx(
  ...values: Array<string | false | null | undefined>
) {
  return values.filter(Boolean).join(" ");
}

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";
const BTN_PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[11.5px] font-semibold text-white transition-[filter,transform,opacity] duration-150 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-[11.5px] font-semibold text-[var(--text)] transition-[background-color,transform,opacity] duration-150 hover:bg-[var(--surface-muted)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const BTN_DANGER =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-[11.5px] font-semibold text-white transition-[background-color,transform,opacity] duration-150 hover:bg-red-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const INPUT =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[12px] text-[var(--text)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_14%,transparent)]";
const LABEL = "mb-1.5 block text-[11px] font-semibold text-[var(--text)]";

function IconButton({
  label,
  onClick,
  bordered,
  children,
}: {
  label: string;
  onClick: () => void;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:text-[var(--text)]",
        bordered ? "border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]" : "hover:bg-[var(--surface-muted)]",
        FOCUS,
      )}
    >
      {children}
    </button>
  );
}

function Toast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className={cx(
        "fixed bottom-5 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[12px] font-medium shadow-lg",
        notice.tone === "success"
          ? "border-emerald-500/25 bg-[var(--surface)] text-[var(--text)]"
          : "border-red-500/25 bg-[var(--surface)] text-[var(--text)]",
      )}
    >
      {notice.tone === "success" ? <CheckCircle2 size={15} className="text-emerald-600" /> : <AlertCircle size={15} className="text-red-600" />}
      {notice.message}
      <button type="button" onClick={onDismiss} className="ml-1 text-[var(--text-subtle)] hover:text-[var(--text)]">
        <X size={13} />
      </button>
    </div>
  );
}

function ConfirmDialog({ request, onClose }: { request: DialogRequest; onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await request.onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      className="sg-fade fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4"
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl">
        <h2 className="text-[14px] font-semibold text-[var(--text)]">{request.title}</h2>
        <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-muted)]">{request.description}</p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={cx(BTN_SECONDARY, FOCUS)}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className={cx(request.tone === "danger" ? BTN_DANGER : BTN_PRIMARY, FOCUS)}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: CampaignStatus) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* ============================================================================
   API

   A separate base from Social Media/Brand Assets — Campaigns is its own
   module with its own permission scope (lib/campaigns/permissions.ts).
============================================================================ */

const CAMPAIGNS_API_BASE = "/api/admin/campaigns";

class ApiError extends Error {}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CAMPAIGNS_API_BASE}${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new ApiError(payload?.error ?? "Something went wrong.");
  }

  return payload as T;
}

async function fetchCampaignsApi(filters: {
  status: CampaignStatus | "" | null;
  search: string;
  page: number;
}): Promise<{ campaigns: ApiCampaign[]; pagination: Pagination }> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  params.set("page", String(filters.page));
  params.set("pageSize", "20");

  return apiRequest<{ campaigns: ApiCampaign[]; pagination: Pagination }>(`?${params.toString()}`);
}

type CampaignFormInput = {
  name: string;
  description: string | null;
  status?: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
};

async function createCampaignApi(input: CampaignFormInput): Promise<ApiCampaign> {
  const payload = await apiRequest<{ campaign: ApiCampaign }>("", { method: "POST", body: JSON.stringify(input) });
  return payload.campaign;
}

async function updateCampaignApi(id: string, input: Partial<CampaignFormInput>): Promise<ApiCampaign> {
  const payload = await apiRequest<{ campaign: ApiCampaign }>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  return payload.campaign;
}

async function archiveCampaignApi(id: string): Promise<ApiCampaign> {
  const payload = await apiRequest<{ campaign: ApiCampaign }>(`/${id}/archive`, { method: "POST" });
  return payload.campaign;
}

async function restoreCampaignApi(id: string): Promise<ApiCampaign> {
  const payload = await apiRequest<{ campaign: ApiCampaign }>(`/${id}/restore`, { method: "POST" });
  return payload.campaign;
}

/* ============================================================================
   SHARED COMPONENTS
============================================================================ */

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--accent)]">
            {eyebrow}
          </p>
        )}

        <h2 className="text-[21px] font-semibold tracking-[-0.045em] text-[var(--text)] sm:text-[24px]">
          {title}
        </h2>

        {description && (
          <p className="mt-1.5 max-w-[620px] text-[12px] leading-6 text-[var(--text-muted)]">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  description,
}: {
  label: string;
  value: number | null;
  icon: IconType;
  loading?: boolean;
  description?: string;
}) {
  return (
    <div className="group rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-muted)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-medium text-[var(--text-muted)]">
          {label}
        </span>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
          <Icon size={15} strokeWidth={1.8} />
        </span>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="h-9 w-16 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        ) : (
          <div className="text-[29px] font-semibold tracking-[-0.055em] text-[var(--text)]">
            {value === null ? "—" : value.toLocaleString("en-GB")}
          </div>
        )}

        {description && (
          <p className="mt-1 text-[10px] text-[var(--text-subtle)]">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: IconType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center px-5 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-[15px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
        <Icon size={20} strokeWidth={1.7} />
      </div>

      <h3 className="mt-4 text-[13px] font-semibold text-[var(--text)]">
        {title}
      </h3>

      <p className="mt-1.5 max-w-[330px] text-[11.5px] leading-5 text-[var(--text-muted)]">
        {description}
      </p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h3 className="text-[12px] font-semibold text-[var(--text)]">
            {title}
          </h3>

          {subtitle && (
            <p className="mt-1 text-[10.5px] text-[var(--text-subtle)]">
              {subtitle}
            </p>
          )}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function TextAction({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--accent)] transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      {children}
      <ArrowRight size={12} />
    </button>
  );
}

/* ============================================================================
   OVERVIEW
============================================================================ */

function OverviewWorkspace({
  overview,
  loadState,
  onNavigate,
}: {
  overview: CampaignOverview;
  loadState: LoadState;
  onNavigate: (view: CampaignView) => void;
}) {
  const loading = loadState === "loading";
  const ready = loadState === "ready";

  const stats: {
    label: string;
    value: number | null;
    icon: IconType;
    description: string;
  }[] = [
    {
      label: "Total campaigns",
      value: ready ? overview.total : null,
      icon: Megaphone,
      description: "Across all campaign statuses",
    },
    {
      label: "Active campaigns",
      value: ready ? overview.active : null,
      icon: Activity,
      description: "Currently running",
    },
    {
      label: "Scheduled",
      value: ready ? overview.scheduled : null,
      icon: CalendarDays,
      description: "Upcoming launches",
    },
    {
      label: "Completed",
      value: ready ? overview.completed : null,
      icon: CheckCircle2,
      description: "Finished campaigns",
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Marketing operations"
        title="Campaign overview"
        description="Your central workspace for managing marketing campaigns, coordinating deliverables and tracking progress."
      />

      {loadState === "unavailable" && (
        <div
          role="status"
          className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[11.5px] leading-5 text-[var(--text-muted)]"
        >
          Campaign data is not connected yet. The database and API
          integration will be added in the next development phase.
          Statistics are unavailable until that connection is complete.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            {...stat}
            loading={loading}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <Panel
          title="Campaigns"
          subtitle="Recently updated marketing campaigns"
          action={
            <TextAction onClick={() => onNavigate("campaigns")}>
              View all
            </TextAction>
          }
        >
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2
                size={20}
                className="animate-spin text-[var(--accent)]"
              />
            </div>
          ) : ready && overview.campaigns.length > 0 ? (
            <div className="divide-y divide-[var(--line)]">
              {overview.campaigns.slice(0, 5).map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-[var(--text)]">
                      {campaign.name}
                    </p>

                    <p className="mt-1 text-[10px] text-[var(--text-subtle)]">
                      Updated {formatDate(campaign.updatedAt)}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[9px] font-medium text-[var(--text-muted)]">
                    {statusLabel(campaign.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="No campaigns to display"
              description={
                ready
                  ? "Your marketing campaigns will appear here once created."
                  : "Campaign records will appear here once the backend is connected."
              }
            />
          )}
        </Panel>

        <Panel
          title="Upcoming activities"
          subtitle="Deadlines, milestones and scheduled work"
          action={
            <TextAction onClick={() => onNavigate("planner")}>
              Open planner
            </TextAction>
          }
        >
          <EmptyState
            icon={CalendarDays}
            title="No activities to display"
            description="Campaign milestones, content deadlines and scheduled activities will appear here."
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Performance"
          subtitle="Campaign results and key metrics"
          action={
            <TextAction onClick={() => onNavigate("analytics")}>
              Analytics
            </TextAction>
          }
        >
          <EmptyState
            icon={BarChart3}
            title="No performance data"
            description="Campaign performance will appear here when verified metrics have been recorded."
          />
        </Panel>

        <Panel
          title="Approvals"
          subtitle="Campaigns awaiting review"
          action={
            <TextAction onClick={() => onNavigate("approvals")}>
              Review queue
            </TextAction>
          }
        >
          <EmptyState
            icon={ClipboardCheck}
            title="No approvals to display"
            description="Campaign approval requests and review decisions will be managed here."
          />
        </Panel>
      </div>

      <div className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Target
            size={15}
            className="text-[var(--accent)]"
          />

          <h3 className="text-[12px] font-semibold text-[var(--text)]">
            Campaign workspace
          </h3>
        </div>

        <p className="max-w-[700px] text-[11.5px] leading-6 text-[var(--text-muted)]">
          Organise campaigns across your brands and clients.
          Coordinate creative deliverables, plan publishing
          activities, manage budgets and evaluate results
          from one connected workspace.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              {
                label: "Campaign planner",
                view: "planner" as const,
                icon: CalendarDays,
              },
              {
                label: "Creative content",
                view: "content" as const,
                icon: FileText,
              },
              {
                label: "Budget tracking",
                view: "budget" as const,
                icon: CircleDollarSign,
              },
              {
                label: "Performance",
                view: "analytics" as const,
                icon: BarChart3,
              },
            ]
          ).map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.view)}
                className="group flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-3 text-left transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <span className="flex items-center gap-2">
                  <Icon
                    size={14}
                    className="shrink-0 text-[var(--accent)]"
                  />

                  <span className="text-[10.5px] font-medium text-[var(--text)]">
                    {item.label}
                  </span>
                </span>

                <ChevronRight
                  size={12}
                  className="shrink-0 text-[var(--text-subtle)] transition-transform group-hover:translate-x-0.5"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   WORKSPACE EMPTY STATES

   These are deliberately honest placeholders until their respective
   backend workflows are implemented.
============================================================================ */

const WORKSPACE_META: Record<
  Exclude<CampaignView, "overview">,
  {
    eyebrow: string;
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    icon: IconType;
  }
> = {
  campaigns: {
    eyebrow: "Campaign management",
    title: "All campaigns",
    description:
      "Create, organise and manage marketing campaigns across your brands and clients.",
    emptyTitle: "Campaign management is being connected",
    emptyDescription:
      "Campaign creation, editing, duplication and lifecycle management will become available after the database and API are implemented.",
    icon: Megaphone,
  },
  planner: {
    eyebrow: "Campaign scheduling",
    title: "Campaign planner",
    description:
      "Plan launches, milestones, creative deadlines and marketing activities.",
    emptyTitle: "No campaign schedule yet",
    emptyDescription:
      "Campaign activities and milestones will appear here once the planner is connected.",
    icon: CalendarDays,
  },
  content: {
    eyebrow: "Creative operations",
    title: "Content & deliverables",
    description:
      "Coordinate campaign content, creative work and reusable brand assets.",
    emptyTitle: "No deliverables to display",
    emptyDescription:
      "Campaign deliverables and linked Social Media and Brand Assets records will appear here.",
    icon: FileText,
  },
  audiences: {
    eyebrow: "Marketing strategy",
    title: "Audiences & channels",
    description:
      "Define target audiences and organise your marketing distribution channels.",
    emptyTitle: "No audiences configured",
    emptyDescription:
      "Campaign audiences and distribution channels will be available after their management workflows are implemented.",
    icon: Users,
  },
  budget: {
    eyebrow: "Campaign finances",
    title: "Budget & expenses",
    description:
      "Track campaign budgets, spending and financial performance.",
    emptyTitle: "No financial data to display",
    emptyDescription:
      "Approved budgets, recorded expenses and remaining balances will appear here.",
    icon: CircleDollarSign,
  },
  analytics: {
    eyebrow: "Campaign intelligence",
    title: "Performance & analytics",
    description:
      "Monitor campaign objectives, verified results and performance trends.",
    emptyTitle: "No campaign analytics yet",
    emptyDescription:
      "Real campaign metrics, KPI targets and performance trends will appear here once recorded.",
    icon: BarChart3,
  },
  approvals: {
    eyebrow: "Campaign governance",
    title: "Approvals & activity",
    description:
      "Review campaign submissions, manage approvals and inspect activity history.",
    emptyTitle: "No approval records",
    emptyDescription:
      "Campaign submissions, approval decisions and audit history will appear here.",
    icon: ClipboardCheck,
  },
};

/* ============================================================================
   CREATE / EDIT DIALOG
============================================================================ */

const EDITABLE_STATUSES = CAMPAIGN_STATUSES.filter((status) => status !== "ARCHIVED");

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function CampaignFormDialog({
  campaign,
  onClose,
  onSaved,
  notifyError,
}: {
  campaign: ApiCampaign | null;
  onClose: () => void;
  onSaved: (campaign: ApiCampaign) => void;
  notifyError: (error: unknown, fallback: string) => void;
}) {
  const [name, setName] = useState(campaign?.name ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [status, setStatus] = useState<CampaignStatus>(campaign?.status ?? "DRAFT");
  const [startDate, setStartDate] = useState(toDateInputValue(campaign?.startDate ?? null));
  const [endDate, setEndDate] = useState(toDateInputValue(campaign?.endDate ?? null));
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(campaign);

  const save = async () => {
    if (!name.trim()) {
      notifyError(new Error("A campaign name is required."), "A campaign name is required.");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      notifyError(new Error("The end date can't be before the start date."), "The end date can't be before the start date.");
      return;
    }

    setSaving(true);
    try {
      const input: CampaignFormInput = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
      };

      const saved = isEditing ? await updateCampaignApi(campaign!.id, input) : await createCampaignApi(input);
      onSaved(saved);
    } catch (error) {
      notifyError(error, isEditing ? "Unable to save this campaign." : "Unable to create this campaign.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      className="sg-fade fixed inset-0 z-[150] flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
    >
      <div role="dialog" aria-modal="true" className="flex max-h-[88dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[24px] border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[var(--text)]">{isEditing ? "Edit campaign" : "New campaign"}</h2>
          <IconButton label="Close" onClick={onClose} bordered>
            <X size={15} />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div>
            <label className={LABEL}>Campaign name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Q1 product launch"
              className={cx(INPUT, "h-10 px-3")}
            />
          </div>

          <div className="mt-3">
            <label className={LABEL}>Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className={cx(INPUT, "resize-y px-3 py-2")}
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Status</label>
              <select value={status} onChange={(event) => setStatus(event.target.value as CampaignStatus)} className={cx(INPUT, "h-10 px-3")}>
                {EDITABLE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Start date</label>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={cx(INPUT, "h-10 px-3")} />
            </div>
            <div>
              <label className={LABEL}>End date</label>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={cx(INPUT, "h-10 px-3")} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-3.5">
          <button type="button" onClick={onClose} className={cx(BTN_SECONDARY, FOCUS)}>
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={cx(BTN_PRIMARY, FOCUS)}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isEditing ? "Save changes" : "Create campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   CAMPAIGNS LIST
============================================================================ */

function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[9px] font-medium text-[var(--text-muted)]">
      {statusLabel(status)}
    </span>
  );
}

function CampaignsWorkspace({
  notify,
  notifyError,
  onChanged,
}: {
  notify: (message: string) => void;
  notifyError: (error: unknown, fallback: string) => void;
  onChanged: () => void;
}) {
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ApiCampaign | null | "new">(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);

  const load = useCallback(() => {
    setLoadState("loading");
    fetchCampaignsApi({ status: statusFilter, search, page })
      .then((result) => {
        setCampaigns(result.campaigns);
        setPagination(result.pagination);
        setLoadState("ready");
      })
      .catch((error) => {
        setLoadState("unavailable");
        notifyError(error, "Unable to load campaigns.");
      });
  }, [statusFilter, search, page, notifyError]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = () => {
    notify(editing === "new" ? "Campaign created." : "Campaign saved.");
    setEditing(null);
    load();
    onChanged();
  };

  const archiveOrRestore = (campaign: ApiCampaign) => {
    const archiving = campaign.status !== "ARCHIVED";
    setDialog({
      title: archiving ? "Archive this campaign?" : "Restore this campaign?",
      description: archiving
        ? `"${campaign.name}" will be moved out of active work. You can restore it at any time.`
        : `"${campaign.name}" will be restored to Draft status.`,
      confirmLabel: archiving ? "Archive" : "Restore",
      tone: archiving ? "danger" : undefined,
      onConfirm: async () => {
        try {
          await (archiving ? archiveCampaignApi(campaign.id) : restoreCampaignApi(campaign.id));
          notify(archiving ? "Campaign archived." : "Campaign restored.");
          load();
          onChanged();
        } catch (error) {
          notifyError(error, "That action could not be completed.");
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Campaign management"
        title="All campaigns"
        description="Create, organise and manage marketing campaigns across your brands and clients."
        action={
          <button type="button" onClick={() => setEditing("new")} className={cx(BTN_PRIMARY, FOCUS)}>
            <Plus size={14} />
            New campaign
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search campaigns"
            className={cx(INPUT, "h-10 pl-9 pr-3")}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => {
            setPage(1);
            setStatusFilter(event.target.value as CampaignStatus | "");
          }}
          className={cx(INPUT, "h-10 w-auto px-3")}
        >
          <option value="">All statuses</option>
          {CAMPAIGN_STATUSES.map((value) => (
            <option key={value} value={value}>
              {statusLabel(value)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)]">
        {loadState === "loading" ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Loader2 size={20} className="animate-spin text-[var(--accent)]" />
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No campaigns to display"
            description={
              search || statusFilter
                ? "No campaigns match your current filters."
                : "Create your first campaign to get started."
            }
          />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-[var(--text)]">{campaign.name}</p>
                  <p className="mt-1 text-[10px] text-[var(--text-subtle)]">
                    {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                    {adminName(campaign.createdBy) ? ` · Created by ${adminName(campaign.createdBy)}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={campaign.status} />

                  {campaign.status !== "ARCHIVED" && (
                    <IconButton label="Edit campaign" onClick={() => setEditing(campaign)} bordered>
                      <Pencil size={13} />
                    </IconButton>
                  )}

                  <IconButton
                    label={campaign.status === "ARCHIVED" ? "Restore campaign" : "Archive campaign"}
                    onClick={() => archiveOrRestore(campaign)}
                    bordered
                  >
                    {campaign.status === "ARCHIVED" ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]">
          <span>
            Page {pagination.page} of {pagination.pages} · {pagination.total} campaigns
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPrevious}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className={cx(BTN_SECONDARY, "h-8 px-3", FOCUS)}
            >
              <ChevronLeft size={13} />
              Previous
            </button>
            <button
              type="button"
              disabled={!pagination.hasNext}
              onClick={() => setPage((value) => value + 1)}
              className={cx(BTN_SECONDARY, "h-8 px-3", FOCUS)}
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {editing && (
        <CampaignFormDialog
          campaign={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          notifyError={notifyError}
        />
      )}

      {dialog && <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function SecondaryWorkspace({
  view,
}: {
  view: Exclude<CampaignView, "overview">;
}) {
  const meta = WORKSPACE_META[view];

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
      />

      <div className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)]">
        <EmptyState
          icon={meta.icon}
          title={meta.emptyTitle}
          description={meta.emptyDescription}
        />
      </div>
    </div>
  );
}

/* ============================================================================
   MAIN COMPONENT
============================================================================ */

export default function CampaignsTab() {
  const [view, setView] = useState<CampaignView>("overview");

  const [overview, setOverview] =
    useState<CampaignOverview>(EMPTY_OVERVIEW);

  const [loadState, setLoadState] =
    useState<LoadState>("loading");

  const [refreshing, setRefreshing] = useState(false);

  const [notice, setNotice] = useState<Notice | null>(null);
  const notify = useCallback((message: string) => setNotice({ id: Date.now(), message, tone: "success" }), []);
  const notifyError = useCallback((error: unknown, fallback: string) => {
    setNotice({ id: Date.now(), message: error instanceof Error ? error.message : fallback, tone: "error" });
  }, []);

  const tabContainerRef = useRef<HTMLDivElement>(null);

  const tabRefs = useRef<
    Partial<Record<CampaignView, HTMLButtonElement | null>>
  >({});

  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  /* ==========================================================================
     DATA LOADING

     Overview stats are real — see lib/campaigns/server.ts#getCampaignOverview.
     pendingApprovals reflects campaigns in PENDING_APPROVAL status;
     upcomingActivities stays honestly 0 until the Planner sub-system exists.
  ========================================================================== */

  const refreshOverview = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(
        "/api/admin/campaigns/overview",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Campaign overview request failed: ${response.status}`
        );
      }

      const data: unknown = await response.json();

      if (
        !data ||
        typeof data !== "object" ||
        !("overview" in data)
      ) {
        throw new Error("Invalid campaign overview response");
      }

      const result = (
        data as { overview: CampaignOverview }
      ).overview;

      if (
        !result ||
        !Array.isArray(result.campaigns) ||
        ![
          result.total,
          result.active,
          result.scheduled,
          result.completed,
          result.pendingApprovals,
          result.upcomingActivities,
        ].every(
          (value) =>
            typeof value === "number" &&
            Number.isFinite(value) &&
            value >= 0
        )
      ) {
        throw new Error("Invalid campaign overview data");
      }

      setOverview(result);
      setLoadState("ready");
    } catch {
      setLoadState("unavailable");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  /* ==========================================================================
     ANIMATED NAVIGATION INDICATOR
  ========================================================================== */

  const updateIndicator = useCallback(() => {
    const container = tabContainerRef.current;
    const activeTab = tabRefs.current[view];

    if (!container || !activeTab) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();

    setIndicator({
      left:
        tabRect.left -
        containerRect.left +
        container.scrollLeft,
      width: tabRect.width,
    });
  }, [view]);

  useLayoutEffect(() => {
    updateIndicator();

    const observer = new ResizeObserver(updateIndicator);

    if (tabContainerRef.current) {
      observer.observe(tabContainerRef.current);
    }

    const activeTab = tabRefs.current[view];

    if (activeTab) {
      observer.observe(activeTab);
    }

    return () => observer.disconnect();
  }, [view, updateIndicator]);

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return (
    <div className="w-full min-w-0 space-y-6 pb-10">
      {/* ================================================================
          HEADER
      ================================================================ */}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              <Megaphone
                size={11}
                className="text-[var(--accent)]"
              />
              Growth
            </span>

            <span className="text-[10px] text-[var(--text-subtle)]">
              /
            </span>

            <span className="text-[10px] font-medium text-[var(--text-muted)]">
              Campaigns
            </span>
          </div>

          <h1 className="text-[26px] font-semibold tracking-[-0.055em] text-[var(--text)] sm:text-[30px]">
            Campaigns
          </h1>

          <p className="mt-1.5 max-w-[600px] text-[12px] leading-5 text-[var(--text-muted)]">
            Plan, execute and track marketing campaigns
            across Syntra Grid and its brands.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshOverview()}
            disabled={refreshing}
            aria-label="Refresh campaigns"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
            />
          </button>

          <button
            type="button"
            onClick={() => setView("campaigns")}
            className="inline-flex h-9 items-center gap-2 rounded-[11px] bg-[var(--accent)] px-3.5 text-[11px] font-semibold text-white transition-[filter] duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <Plus size={14} />
            New campaign
          </button>
        </div>
      </header>

      {/* ================================================================
          WORKSPACE NAVIGATION
      ================================================================ */}

      <nav
        aria-label="Campaign workspace"
        className="border-b border-[var(--line)]"
      >
        <div
          ref={tabContainerRef}
          role="tablist"
          aria-label="Campaign sections"
          className="relative flex min-w-0 items-center gap-1 overflow-x-auto"
        >
          {NAVIGATION.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;

            return (
              <button
                key={item.id}
                ref={(element) => {
                  tabRefs.current[item.id] = element;
                }}
                id={`campaign-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`campaign-panel-${item.id}`}
                onClick={() => setView(item.id)}
                className={cx(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-t-lg px-3 text-[12px] font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]",
                  active
                    ? "text-[var(--text)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                )}
              >
                <Icon
                  size={15}
                  strokeWidth={1.8}
                  className={
                    active
                      ? "text-[var(--accent)]"
                      : ""
                  }
                />

                {item.label}

                {item.id === "approvals" &&
                  loadState === "ready" &&
                  overview.pendingApprovals > 0 && (
                    <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--accent)]">
                      {overview.pendingApprovals}
                    </span>
                  )}
              </button>
            );
          })}

          {indicator && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-[var(--accent)] transition-[transform,width] duration-300"
              style={{
                width: indicator.width,
                transform: `translateX(${indicator.left}px)`,
              }}
            />
          )}
        </div>
      </nav>

      {/* ================================================================
          ACTIVE WORKSPACE
      ================================================================ */}

      <div
        key={view}
        id={`campaign-panel-${view}`}
        role="tabpanel"
        aria-labelledby={`campaign-tab-${view}`}
        className="min-w-0 animate-in fade-in duration-200"
      >
        {view === "overview" ? (
          <OverviewWorkspace
            overview={overview}
            loadState={loadState}
            onNavigate={setView}
          />
        ) : view === "campaigns" ? (
          <CampaignsWorkspace notify={notify} notifyError={notifyError} onChanged={() => void refreshOverview()} />
        ) : (
          <SecondaryWorkspace view={view} />
        )}
      </div>

      {/* ================================================================
          FOOTER
      ================================================================ */}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-subtle)]">
          <Clock3 size={12} />
          Syntra Grid Marketing Operations
        </div>

        <span className="text-[10px] text-[var(--text-subtle)]">
          Campaign Management
        </span>
      </footer>

      {notice && <Toast notice={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
}