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

import { useFullWorkspace } from "@/app/components/admin/FullWorkspaceContext";
import { useSelectedClient } from "@/app/components/admin/SelectedClientContext";

import { CampaignPicker } from "@/app/components/admin/campaigns/CampaignPicker";
import { CampaignPlanner } from "@/app/components/admin/campaigns/CampaignPlanner";
import { CampaignContentSection } from "@/app/components/admin/campaigns/CampaignContentSection";
import { CampaignAudiencesSection } from "@/app/components/admin/campaigns/CampaignAudiencesSection";
import { CampaignBudgetSection } from "@/app/components/admin/campaigns/CampaignBudgetSection";
import { CampaignAnalyticsSection } from "@/app/components/admin/campaigns/CampaignAnalyticsSection";
import { CampaignApprovalsSection } from "@/app/components/admin/campaigns/CampaignApprovalsSection";
import { CampaignDetailPanel } from "@/app/components/admin/campaigns/CampaignDetailPanel";

import {
  Activity,
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
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
  /** null means a Syntra Grid campaign (our own marketing), not a
   *  client's — lib/campaigns/server.ts already selects this, it just
   *  wasn't modelled here yet. Never confuse this with the connected
   *  SocialAccount OAuth accounts used to publish, which have no client
   *  concept at all — they're always Syntra Grid's own. */
  client: { id: string; name: string; slug: string } | null;
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

type BudgetByCurrency = { currency: string; allocated: number; spent: number; remaining: number };

type CampaignOverview = {
  total: number;
  active: number;
  draft: number;
  scheduled: number;
  paused: number;
  completed: number;
  cancelled: number;
  archived: number;
  pendingApprovals: number;
  upcomingActivities: number;
  upcomingDeadlines: number;
  overdueMilestones: number;
  outstandingDeliverables: number;
  completedDeliverables: number;
  budgetByCurrency: BudgetByCurrency[];
  overBudgetCampaigns: number;
  campaigns: CampaignSummary[];
};

/** "unavailable" means the module has nothing to show yet; "error"
 *  means a request failed. They were the same state, so a failed fetch
 *  rendered the empty state and invited you to create your first
 *  campaign while your existing ones were simply unreachable. */
type LoadState = "loading" | "ready" | "unavailable" | "error";

/* ============================================================================
   NAVIGATION
============================================================================ */

const NAVIGATION: { id: CampaignView; label: string; icon: IconType }[] = [
  { id: "overview", label: "Overview", icon: Layers3 },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "planner", label: "Planner", icon: CalendarDays },
  { id: "content", label: "Content", icon: FileText },
  { id: "audiences", label: "Audiences", icon: Users },
  { id: "budget", label: "Budget", icon: CircleDollarSign },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "approvals", label: "Approvals", icon: ClipboardCheck },
];

const EMPTY_OVERVIEW: CampaignOverview = {
  total: 0,
  active: 0,
  draft: 0,
  scheduled: 0,
  paused: 0,
  completed: 0,
  cancelled: 0,
  archived: 0,
  pendingApprovals: 0,
  upcomingActivities: 0,
  upcomingDeadlines: 0,
  overdueMilestones: 0,
  outstandingDeliverables: 0,
  completedDeliverables: 0,
  budgetByCurrency: [],
  overBudgetCampaigns: 0,
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

/* The module carries its own motion. It used to reference `sg-fade`,
   which lives in the stylesheet SocialMediaTab injects, so whenever
   Campaigns was open on its own the dialogs appeared with no transition
   at all. The workspace switch used `animate-in fade-in`, which is
   tailwindcss-animate syntax and silently does nothing unless that
   plugin is installed. */
const CAMPAIGN_STYLES = `
@keyframes cp-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cp-rise { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes cp-view { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.cp-fade { animation: cp-fade .16s ease-out both; }
.cp-rise { animation: cp-rise .22s cubic-bezier(.2,.8,.2,1) both; }
.cp-view { animation: cp-view .22s cubic-bezier(.2,.8,.2,1) both; }
.cp-noscrollbar { scrollbar-width: none; }
.cp-noscrollbar::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: reduce) {
  .cp-fade, .cp-rise, .cp-view { animation-duration: 1ms !important; }
}
`;

/** Escape to close, the page behind locked, focus handed back to
 *  whatever opened the dialog. Neither dialog here had any of it. */
function useDialogChrome(onClose: () => void, enabled = true) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!enabled) return;
    const opener = document.activeElement as HTMLElement | null;
    const body = document.body;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;

    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [enabled]);
}

/** Holds a value back until typing stops. The campaign list used to
 *  refetch on every keystroke, and a slow early response could land
 *  after a fast later one and overwrite newer results. */
function useDebounced<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);
  return settled;
}

/** Status is the single most useful signal in a campaign list and every
 *  one of them rendered as the same grey pill. These give the lifecycle
 *  a colour, with the two states that need attention standing out. */
const STATUS_META: Record<CampaignStatus, { hue: string }> = {
  DRAFT: { hue: "var(--text-subtle)" },
  PLANNING: { hue: "var(--text-muted)" },
  PENDING_APPROVAL: { hue: "#D97706" },
  APPROVED: { hue: "#059669" },
  SCHEDULED: { hue: "var(--accent)" },
  ACTIVE: { hue: "#059669" },
  PAUSED: { hue: "#D97706" },
  COMPLETED: { hue: "var(--text-muted)" },
  CANCELLED: { hue: "#DC2626" },
  ARCHIVED: { hue: "var(--text-subtle)" },
};

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";
/** A fixed dark ink rather than white: the accent is a gold in both
 *  themes and white on gold is about 3:1, which fails contrast either
 *  way. A near-black reads at roughly 8:1 against both values. */
const BTN_PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[11.5px] font-semibold text-[#181206] transition-[filter,transform,opacity] duration-150 hover:brightness-[1.06] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-[11.5px] font-semibold text-[var(--text)] transition-[background-color,transform,opacity] duration-150 hover:bg-[var(--surface-muted)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const BTN_DANGER =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-[11.5px] font-semibold text-white transition-[background-color,transform,opacity] duration-150 hover:bg-red-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const INPUT =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[12px] text-[var(--text)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_14%,transparent)]";
const LABEL = "mb-1.5 block text-[11px] font-semibold text-[var(--text)]";
/** INPUT carries `w-full`, and a `w-auto` written after it in the same
 *  class string does not override it: Tailwind emits utilities in its
 *  own order, not the order they appear. The status filter was therefore
 *  rendering full width on a row of its own. */
const SELECT =
  "h-10 shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_14%,transparent)]";

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

  useDialogChrome(onClose, !busy);

  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await request.onConfirm();
      // Deliberately no setBusy(false) on the success path: onClose
      // unmounts this, and the old `finally` ran a state update on a
      // component that had already gone.
      onClose();
    } catch (problem) {
      setBusy(false);
      setError(problem instanceof Error ? problem.message : "That action could not be completed.");
    }
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      className="cp-fade fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4"
    >
      <div role="dialog" aria-modal="true" className="cp-rise w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl">
        <h2 className="text-[14px] font-semibold text-[var(--text)]">{request.title}</h2>
        <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-muted)]">{request.description}</p>

        {error && (
          <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,#DC2626_10%,transparent)] px-3 py-2 text-[11px] leading-5 text-red-600">{error}</p>
        )}

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

/** "Not scheduled – Not scheduled" was what an undated campaign read as.
 *  This says the useful thing in each case, and without a dash. */
function dateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "No dates set";
  if (start && !end) return `Starts ${formatDate(start)}`;
  if (!start && end) return `Ends ${formatDate(end)}`;
  return `${formatDate(start)} to ${formatDate(end)}`;
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
  /** The header's client-context switcher — server-side filtering
   *  already existed (lib/campaigns/server.ts), this just finally sends
   *  it. null/undefined means company-wide: every campaign, Syntra
   *  Grid's own and every client's, same as before this existed. */
  clientId?: string | null;
}): Promise<{ campaigns: ApiCampaign[]; pagination: Pagination }> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.clientId) params.set("clientId", filters.clientId);
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
  tone = "neutral",
}: {
  label: string;
  value: number | null;
  icon: IconType;
  loading?: boolean;
  description?: string;
  /** "warn" is for a number that means somebody has to do something.
   *  Eight identical cards gave "Over budget" exactly as much weight as
   *  "Completed", which is the wrong way round. */
  tone?: "neutral" | "warn";
}) {
  const active = tone === "warn" && typeof value === "number" && value > 0;
  const hue = active ? "#D97706" : "var(--accent)";

  return (
    <div
      className={cx(
        "group rounded-[18px] border bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-muted)] sm:p-5",
        active ? "border-[color-mix(in_srgb,#D97706_38%,var(--line))]" : "border-[var(--line)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-medium text-[var(--text-muted)]">
          {label}
        </span>

        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--line)] bg-[var(--surface-muted)]"
          style={{ color: hue }}
        >
          <Icon size={15} strokeWidth={1.8} />
        </span>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="h-9 w-16 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        ) : value === null ? (
          <div className="flex h-9 items-end text-[12px] font-medium text-[var(--text-subtle)]">Not available</div>
        ) : (
          <div
            className="text-[29px] font-semibold tracking-[-0.055em]"
            style={{ color: active ? hue : "var(--text)" }}
          >
            {value.toLocaleString("en-GB")}
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
  action,
}: {
  icon: IconType;
  title: string;
  description: string;
  action?: React.ReactNode;
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

      {action && <div className="mt-4">{action}</div>}
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
  onRetry,
}: {
  overview: CampaignOverview;
  loadState: LoadState;
  onNavigate: (view: CampaignView) => void;
  onRetry: () => void;
}) {
  const loading = loadState === "loading";
  const ready = loadState === "ready";

  const stats: {
    label: string;
    value: number | null;
    icon: IconType;
    description: string;
    tone?: "neutral" | "warn";
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
    {
      label: "Draft",
      value: ready ? overview.draft : null,
      icon: FolderKanban,
      description: "Not yet submitted",
    },
    {
      label: "Paused",
      value: ready ? overview.paused : null,
      icon: Clock3,
      description: "Temporarily on hold",
    },
    {
      label: "Awaiting approval",
      value: ready ? overview.pendingApprovals : null,
      icon: ClipboardCheck,
      description: "Pending a decision",
      tone: "warn" as const,
    },
    {
      label: "Over budget",
      value: ready ? overview.overBudgetCampaigns : null,
      icon: CircleDollarSign,
      description: "Spending exceeds budget",
      tone: "warn" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Marketing operations"
        title="Campaign overview"
        description="Your central workspace for managing marketing campaigns, coordinating deliverables and tracking progress."
      />

      {/* This used to tell the client which development phase the work
          was scheduled for, which means nothing to them and makes the
          product look half built. It says what happened and offers the
          one useful action instead. */}
      {loadState === "unavailable" && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[11.5px] leading-5 text-[var(--text-muted)]"
        >
          <AlertCircle size={15} className="shrink-0 text-[#D97706]" />
          <span className="min-w-0 flex-1">These figures could not be loaded just now.</span>
          <button type="button" onClick={onRetry} className={cx(BTN_SECONDARY, FOCUS, "h-8 px-3 text-[11px]")}>
            <RefreshCw size={12} />
            Try again
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

                  <StatusBadge status={campaign.status} />
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
          {ready && (overview.upcomingDeadlines > 0 || overview.overdueMilestones > 0 || overview.outstandingDeliverables > 0) ? (
            <div className="space-y-2.5 px-5 py-4 text-[11.5px]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Milestones due within 7 days</span>
                <span className="font-semibold text-[var(--text)]">{overview.upcomingDeadlines}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Overdue milestones</span>
                <span className={cx("font-semibold", overview.overdueMilestones > 0 ? "text-red-600" : "text-[var(--text)]")}>{overview.overdueMilestones}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Outstanding content deliverables</span>
                <span className="font-semibold text-[var(--text)]">{overview.outstandingDeliverables}</span>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No activities to display"
              description="Campaign milestones, content deadlines and scheduled activities will appear here."
            />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Budget"
          subtitle="Allocated vs. spent, by currency"
          action={
            <TextAction onClick={() => onNavigate("budget")}>
              Budget
            </TextAction>
          }
        >
          {ready && overview.budgetByCurrency.length > 0 ? (
            <div className="space-y-3 px-5 py-4">
              {overview.budgetByCurrency.map((row) => (
                <div key={row.currency} className="text-[11.5px]">
                  <div className="flex items-center justify-between font-medium text-[var(--text)]">
                    <span>{row.currency}</span>
                    <span>{row.spent.toLocaleString("en-GB")} / {row.allocated.toLocaleString("en-GB")}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className={cx("h-full rounded-full", row.spent > row.allocated ? "bg-red-500" : "bg-[var(--accent)]")}
                      style={{ width: `${row.allocated > 0 ? Math.min(100, (row.spent / row.allocated) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CircleDollarSign}
              title="No budget data"
              description="Campaign budgets and recorded expenses will appear here."
            />
          )}
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
          {ready && overview.pendingApprovals > 0 ? (
            <div className="px-5 py-4 text-[11.5px]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Campaigns awaiting approval</span>
                <span className="font-semibold text-[var(--text)]">{overview.pendingApprovals}</span>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={ClipboardCheck}
              title="No approvals to display"
              description="Campaign approval requests and review decisions will be managed here."
            />
          )}
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
  { eyebrow: string; title: string; description: string }
> = {
  campaigns: {
    eyebrow: "Campaign management",
    title: "All campaigns",
    description:
      "Create, organise and manage marketing campaigns across your brands and clients.",
  },
  planner: {
    eyebrow: "Campaign scheduling",
    title: "Campaign planner",
    description:
      "Plan launches, milestones, creative deadlines and marketing activities.",
  },
  content: {
    eyebrow: "Creative operations",
    title: "Content & deliverables",
    description:
      "Coordinate campaign content, creative work and reusable brand assets.",
  },
  audiences: {
    eyebrow: "Marketing strategy",
    title: "Audiences & channels",
    description:
      "Define target audiences and organise your marketing distribution channels.",
  },
  budget: {
    eyebrow: "Campaign finances",
    title: "Budget & expenses",
    description:
      "Track campaign budgets, spending and financial performance.",
  },
  analytics: {
    eyebrow: "Campaign intelligence",
    title: "Performance & analytics",
    description:
      "Monitor campaign objectives, verified results and performance trends.",
  },
  approvals: {
    eyebrow: "Campaign governance",
    title: "Approvals & activity",
    description:
      "Review campaign submissions, manage approvals and inspect activity history.",
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

/* ----------------------------------------------------------------------------
   CAMPAIGN EDITOR

   A full-bleed workspace, the same shape as Write a post, Generate a
   graphic and Create a video: it takes over the dashboard content area
   rather than floating a 520px dialog over the list, and it is left by
   the back button. Creating a campaign is the one place in this module
   where somebody is actually composing something, so it gets the room.

   The API accepts exactly five fields (see CampaignFormInput), so the
   workspace earns its space by making those five legible rather than by
   inventing any: the status picker explains what each state means, the
   dates get presets and a live duration, and the right column shows the
   row this will become.
---------------------------------------------------------------------------- */

const STATUS_HELP: Record<CampaignStatus, string> = {
  DRAFT: "Still being written. Nobody is reviewing it.",
  PLANNING: "Being shaped. Scope and dates are not final.",
  PENDING_APPROVAL: "Waiting on a decision from an approver.",
  APPROVED: "Signed off and ready to be scheduled.",
  SCHEDULED: "Dated and queued to start.",
  ACTIVE: "Running now.",
  PAUSED: "Stopped for the moment. Can be resumed.",
  COMPLETED: "Finished and closed out.",
  CANCELLED: "Called off before it finished.",
  ARCHIVED: "Out of active work.",
};

function isoDay(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  const start = new Date(`${a}T00:00:00`);
  const end = new Date(`${b}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function CampaignEditorWorkspace({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: ApiCampaign | null;
  onClose: () => void;
  onSaved: (campaign: ApiCampaign, wasCreate: boolean) => void;
}) {
  const [name, setName] = useState(campaign?.name ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [status, setStatus] = useState<CampaignStatus>(campaign?.status ?? "DRAFT");
  const [startDate, setStartDate] = useState(toDateInputValue(campaign?.startDate ?? null));
  const [endDate, setEndDate] = useState(toDateInputValue(campaign?.endDate ?? null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const isEditing = Boolean(campaign);

  const [initialSignature] = useState(() =>
    JSON.stringify({
      name: campaign?.name ?? "",
      description: campaign?.description ?? "",
      status: campaign?.status ?? "DRAFT",
      startDate: toDateInputValue(campaign?.startDate ?? null),
      endDate: toDateInputValue(campaign?.endDate ?? null),
    }),
  );
  const dirty = JSON.stringify({ name, description, status, startDate, endDate }) !== initialSignature;

  /* Validation is inline and next to the field it concerns. It used to
     be thrown at a toast at the bottom of the screen, which is a long
     way from the input that caused it. */
  const nameProblem = name.trim() ? null : "Give the campaign a name.";
  const dateProblem = startDate && endDate && endDate < startDate ? "The end date is before the start date." : null;
  const canSave = !nameProblem && !dateProblem && !saving;

  useEffect(() => {
    const timeout = window.setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(timeout);
  }, []);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }, [dirty, saving, onClose]);

  const save = useCallback(async () => {
    if (!canSave) {
      setError(nameProblem ?? dateProblem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: CampaignFormInput = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      const saved = isEditing ? await updateCampaignApi(campaign!.id, input) : await createCampaignApi(input);
      onSaved(saved, !isEditing);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to save this campaign.");
      setSaving(false);
    }
  }, [canSave, nameProblem, dateProblem, name, description, status, startDate, endDate, isEditing, campaign, onSaved]);

  // Escape leaves, Cmd or Ctrl with Enter saves: the same two gestures
  // the other full-bleed workspaces use.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (confirmDiscard) setConfirmDiscard(false);
        else requestClose();
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose, save, confirmDiscard]);

  const today = isoDay(new Date());
  const applyRange = (fromToday: number, length: number) => {
    const from = new Date();
    from.setDate(from.getDate() + fromToday);
    const to = new Date(from);
    to.setDate(to.getDate() + length);
    setStartDate(isoDay(from));
    setEndDate(isoDay(to));
  };
  const applyThisMonth = () => {
    const now = new Date();
    setStartDate(isoDay(new Date(now.getFullYear(), now.getMonth(), 1)));
    setEndDate(isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  };

  const lengthInDays = startDate && endDate && !dateProblem ? daysBetween(startDate, endDate) : null;
  const startsIn = startDate ? daysBetween(today, startDate) : null;

  return (
    <div className="cp-view relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--surface)]">
      {/* ------------------------------ toolbar ------------------------------ */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--line)] px-3 sm:px-4">
        <IconButton label="Back to campaigns" onClick={requestClose}>
          <ChevronLeft size={17} />
        </IconButton>

        <Megaphone size={15} className="shrink-0 text-[var(--text-subtle)]" />

        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            {isEditing ? "Edit campaign" : "New campaign"}
          </h2>
          <p className="truncate text-[10.5px] text-[var(--text-muted)]">
            {isEditing ? campaign!.name : "Name it, say what it is for, then set the dates."}
          </p>
        </div>

        {dirty && !saving && (
          <span title="Unsaved changes" className="ml-1 hidden shrink-0 items-center gap-1.5 text-[10.5px] text-[var(--text-subtle)] sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
            Unsaved
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-[10.5px] text-[var(--text-subtle)] lg:inline">Cmd and Enter to save</span>
          <button type="button" onClick={requestClose} disabled={saving} className={cx(BTN_SECONDARY, FOCUS, "h-9 px-3.5")}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className={cx(
              BTN_PRIMARY,
              FOCUS,
              "h-9 min-w-[150px] px-3.5",
              "disabled:border disabled:border-[var(--line)] disabled:bg-transparent disabled:text-[var(--text-subtle)] disabled:opacity-100",
            )}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isEditing ? "Save changes" : "Create campaign"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* ------------------------------- form ------------------------------- */}
        <div className="cp-noscrollbar min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[720px] space-y-7 px-5 py-6 sm:px-8">
            <div>
              <label htmlFor="campaign-name" className={LABEL}>
                Campaign name
              </label>
              <input
                id="campaign-name"
                ref={nameRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Q1 product launch"
                aria-invalid={Boolean(nameProblem) && name !== ""}
                className={cx(INPUT, "h-11 px-3.5 text-[14px] font-medium")}
              />
              <p className="mt-1.5 text-[10.5px] text-[var(--text-subtle)]">
                How it appears everywhere else in the dashboard, so make it recognisable at a glance.
              </p>
            </div>

            <div>
              <label htmlFor="campaign-description" className={LABEL}>
                What is it for
              </label>
              <textarea
                id="campaign-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="The goal, the audience and anything the team needs to know before they start."
                className={cx(INPUT, "resize-y px-3.5 py-2.5 leading-6")}
              />
            </div>

            <div>
              <p className={LABEL}>Status</p>
              {/* A dropdown of nine lifecycle states gave no clue what any
                  of them meant. Each one says so now. */}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {EDITABLE_STATUSES.map((value) => {
                  const active = status === value;
                  const hue = STATUS_META[value].hue;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatus(value)}
                      className={cx(
                        "rounded-xl border p-3 text-left transition duration-150",
                        active ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]" : "border-[var(--line)] hover:border-[var(--line-strong)]",
                        FOCUS,
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: hue }} />
                        <span className="text-[12px] font-semibold text-[var(--text)]">{statusLabel(value)}</span>
                      </span>
                      <span className="mt-1 block text-[10.5px] leading-4 text-[var(--text-subtle)]">{STATUS_HELP[value]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className={LABEL}>Dates</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Next 30 days", run: () => applyRange(0, 30) },
                  { label: "Next 90 days", run: () => applyRange(0, 90) },
                  { label: "This month", run: applyThisMonth },
                  {
                    label: "Clear",
                    run: () => {
                      setStartDate("");
                      setEndDate("");
                    },
                  },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={preset.run}
                    className={cx(
                      "rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)]",
                      FOCUS,
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="campaign-start" className="mb-1.5 block text-[10.5px] text-[var(--text-subtle)]">
                    Starts
                  </label>
                  <input
                    id="campaign-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className={cx(INPUT, "h-10 px-3")}
                  />
                </div>
                <div>
                  <label htmlFor="campaign-end" className="mb-1.5 block text-[10.5px] text-[var(--text-subtle)]">
                    Ends
                  </label>
                  <input
                    id="campaign-end"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                    aria-invalid={Boolean(dateProblem)}
                    className={cx(INPUT, "h-10 px-3", dateProblem && "border-red-500")}
                  />
                </div>
              </div>

              {dateProblem && <p className="mt-1.5 text-[11px] font-medium text-red-600">{dateProblem}</p>}
            </div>
          </div>
        </div>

        {/* ----------------------------- summary ----------------------------- */}
        <aside className="cp-noscrollbar shrink-0 overflow-y-auto border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_55%,transparent)] px-5 py-6 lg:w-[320px] lg:border-t-0 lg:border-l">
          <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--text-subtle)] uppercase">How it will appear</p>

          <div className="mt-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
            <p className="truncate text-[12px] font-semibold text-[var(--text)]">{name.trim() || "Untitled campaign"}</p>
            <p className="mt-1 text-[10px] text-[var(--text-subtle)]">{dateRange(startDate || null, endDate || null)}</p>
            <div className="mt-2.5">
              <StatusBadge status={status} />
            </div>
          </div>

          <dl className="mt-5 space-y-2 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-subtle)]">Length</dt>
              <dd className="font-medium text-[var(--text)]">
                {lengthInDays === null ? "Not set" : `${lengthInDays} day${lengthInDays === 1 ? "" : "s"}`}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-subtle)]">Starts</dt>
              <dd className="font-medium text-[var(--text)]">
                {startsIn === null
                  ? "Not set"
                  : startsIn === 0
                    ? "Today"
                    : startsIn > 0
                      ? `In ${startsIn} day${startsIn === 1 ? "" : "s"}`
                      : `${Math.abs(startsIn)} day${Math.abs(startsIn) === 1 ? "" : "s"} ago`}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-subtle)]">Description</dt>
              <dd className="font-medium text-[var(--text)]">{description.trim() ? "Written" : "Empty"}</dd>
            </div>
          </dl>

          <p className="mt-5 text-[10.5px] leading-5 text-[var(--text-subtle)]">
            Dates are optional. A campaign with none simply has no scheduled window yet, and you can add one later.
          </p>

          {error && (
            <p role="alert" className="cp-fade mt-5 rounded-lg bg-[color-mix(in_srgb,#DC2626_10%,transparent)] px-3 py-2 text-[11px] leading-5 text-red-600">
              {error}
            </p>
          )}
        </aside>
      </div>

      {/* --------------------------- discard guard --------------------------- */}
      {confirmDiscard && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="cp-fade fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmDiscard(false);
          }}
        >
          <div className="cp-rise w-full max-w-[400px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl">
            <h3 className="text-[14px] font-semibold text-[var(--text)]">
              {isEditing ? "Discard your changes?" : "Discard this campaign?"}
            </h3>
            <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-muted)]">
              {isEditing ? "Edits made since the last save will be lost." : "Nothing has been saved yet, so this campaign will be lost."}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" autoFocus onClick={() => setConfirmDiscard(false)} className={cx(BTN_SECONDARY, FOCUS, "h-9 px-3.5")}>
                Keep editing
              </button>
              <button type="button" onClick={onClose} className={cx(BTN_DANGER, FOCUS, "h-9 px-3.5")}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   CAMPAIGNS LIST
============================================================================ */

function StatusBadge({ status }: { status: CampaignStatus }) {
  const hue = STATUS_META[status].hue;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[9.5px] font-semibold"
      style={{ background: `color-mix(in srgb, ${hue} 13%, transparent)`, color: hue }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: hue }} />
      {statusLabel(status)}
    </span>
  );
}

function CampaignsWorkspace({
  notify,
  notifyError,
  onChanged,
  onEditCampaign,
  refreshKey,
}: {
  notify: (message: string) => void;
  notifyError: (error: unknown, fallback: string) => void;
  onChanged: () => void;
  /** Opens the full-bleed editor. Owned by CampaignsTab, not here: the
   *  editor sets the dashboard to full, which unmounts this workspace,
   *  so an editor rendered from inside it would disappear on the very
   *  next render. */
  onEditCampaign: (campaign: ApiCampaign | null) => void;
  /** Bumped after a save so the list picks the change up. */
  refreshKey: number;
}) {
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);

  // The app-wide client-context switcher (header) — when set, narrows
  // this list to just that client's campaigns. Company-wide shows
  // everything (both Syntra Grid's own and every client's), same as
  // before this existed — see the client badge on each row.
  const { selectedClientId, selectClient } = useSelectedClient();

  // Typing fires one request once you stop, not one per character, and
  // every fetch carries a sequence number so an older response can
  // never overwrite a newer one.
  const debouncedSearch = useDebounced(search);
  const requestSeq = useRef(0);

  const load = useCallback(() => {
    // Named so the bump is a genuine dependency rather than one the
    // exhaustive-deps rule can only see as surplus.
    void refreshKey;
    const seq = (requestSeq.current += 1);
    setLoadState("loading");
    fetchCampaignsApi({ status: statusFilter, search: debouncedSearch, page, clientId: selectedClientId })
      .then((result) => {
        if (seq !== requestSeq.current) return;
        setCampaigns(result.campaigns);
        setPagination(result.pagination);
        setLoadState("ready");
      })
      .catch((error) => {
        if (seq !== requestSeq.current) return;
        setLoadState("error");
        notifyError(error, "Unable to load campaigns.");
      });
  }, [statusFilter, debouncedSearch, page, refreshKey, notifyError, selectedClientId]);

  useEffect(() => {
    load();
  }, [load]);

  // Switching the global client context is equivalent to changing any
  // other filter — return to the first page so an out-of-range page
  // number from the previous (wider or differently-scoped) list can't
  // silently show nothing.
  useEffect(() => {
    setPage(1);
  }, [selectedClientId]);

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
      />

      {selectedClientId && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-[11.5px] text-[var(--text-muted)]">
          <span>
            Filtered to <span className="font-semibold text-[var(--text)]">{campaigns[0]?.client?.name || "one client"}</span> — set from the header&apos;s client
            switcher.
          </span>
          <button type="button" onClick={() => selectClient(null)} className={cx("ml-auto text-[11px] font-semibold text-[var(--accent)] hover:underline", FOCUS)}>
            Show all clients
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search campaigns by name"
            className={cx(INPUT, "h-10 pl-9", search ? "pr-9" : "pr-3")}
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setPage(1);
                setSearch("");
              }}
              className={cx(
                "absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                FOCUS,
              )}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={(event) => {
            setPage(1);
            setStatusFilter(event.target.value as CampaignStatus | "");
          }}
          className={cx(SELECT, "w-[170px]", FOCUS)}
        >
          <option value="">All statuses</option>
          {CAMPAIGN_STATUSES.map((value) => (
            <option key={value} value={value}>
              {statusLabel(value)}
            </option>
          ))}
        </select>
      </div>

      {loadState === "ready" && pagination && pagination.total > 0 && (
        <p className="-mt-3 text-[11px] text-[var(--text-subtle)]">
          {pagination.total.toLocaleString("en-GB")} campaign{pagination.total === 1 ? "" : "s"}
          {statusFilter ? ` with status ${statusLabel(statusFilter).toLowerCase()}` : ""}
          {debouncedSearch.trim() ? ` matching “${debouncedSearch.trim()}”` : ""}.
        </p>
      )}

      <div className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)]">
        {loadState === "loading" && campaigns.length === 0 ? (
          <div className="divide-y divide-[var(--line)]">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-[42%] animate-pulse rounded bg-[var(--surface-muted)]" />
                  <div className="h-2.5 w-[28%] animate-pulse rounded bg-[var(--surface-muted)]" />
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-[var(--surface-muted)]" />
              </div>
            ))}
          </div>
        ) : loadState === "error" ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center px-5 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-[15px] border border-[color-mix(in_srgb,#DC2626_35%,var(--line))] bg-[color-mix(in_srgb,#DC2626_8%,transparent)] text-red-600">
              <AlertCircle size={20} strokeWidth={1.7} />
            </div>
            <h3 className="mt-4 text-[13px] font-semibold text-[var(--text)]">Campaigns could not be loaded</h3>
            <p className="mt-1.5 max-w-[340px] text-[11.5px] leading-5 text-[var(--text-muted)]">
              The request did not come back. Your campaigns are still there; this view just could not reach them.
            </p>
            <button type="button" onClick={load} className={cx(BTN_SECONDARY, FOCUS, "mt-4 h-9 px-3.5")}>
              <RefreshCw size={13} />
              Try again
            </button>
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={search || statusFilter ? "Nothing matches those filters" : "No campaigns yet"}
            description={
              search || statusFilter
                ? "Try a different search, or widen the status filter."
                : "Campaigns group the work, the budget and the approvals for one piece of marketing."
            }
            action={
              search || statusFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setSearch("");
                    setStatusFilter("");
                  }}
                  className={cx(BTN_SECONDARY, FOCUS, "h-9 px-3.5")}
                >
                  Clear filters
                </button>
              ) : (
                <button type="button" onClick={() => onEditCampaign(null)} className={cx(BTN_PRIMARY, FOCUS, "h-9 px-3.5")}>
                  <Plus size={13} />
                  New campaign
                </button>
              )
            }
          />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[12px] font-semibold text-[var(--text)]">{campaign.name}</p>
                    <span
                      className={cx(
                        "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                        campaign.client ? "bg-[var(--accent-tint)] text-[var(--accent)]" : "bg-[var(--surface-muted)] text-[var(--text-subtle)]",
                      )}
                    >
                      {campaign.client ? (campaign.client.name || "Client") : "Syntra Grid"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--text-subtle)]">
                    {dateRange(campaign.startDate, campaign.endDate)}
                    {adminName(campaign.createdBy) ? ` · Created by ${adminName(campaign.createdBy)}` : ""}
                  </p>
                </div>

                {/* Archived rows have no Edit button, so without a fixed
                    slot for it every control below them shifted left and
                    the column stopped lining up. */}
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={campaign.status} />

                  <button type="button" onClick={() => setManagingId(campaign.id)} className={cx(BTN_SECONDARY, "h-8 px-2.5 text-[10.5px]", FOCUS)}>
                    Manage
                  </button>

                  <span className="inline-flex h-9 w-9 items-center justify-center">
                    {campaign.status !== "ARCHIVED" && (
                      <IconButton label="Edit campaign" onClick={() => onEditCampaign(campaign)} bordered>
                        <Pencil size={13} />
                      </IconButton>
                    )}
                  </span>

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

      {dialog && <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />}

      {managingId && <CampaignDetailPanel campaignId={managingId} onClose={() => setManagingId(null)} />}
    </div>
  );
}

const SCOPED_SECTIONS: Record<"planner" | "content" | "audiences" | "budget" | "analytics" | "approvals", React.ComponentType<{ campaignId: string }>> = {
  planner: CampaignPlanner,
  content: CampaignContentSection,
  audiences: CampaignAudiencesSection,
  budget: CampaignBudgetSection,
  analytics: CampaignAnalyticsSection,
  approvals: CampaignApprovalsSection,
};

/** Planner/Content/Audiences/Budget/Analytics/Approvals are all built as
 *  per-campaign workspaces — every API route is nested under
 *  /api/admin/campaigns/[id]/... There is no cross-campaign aggregation
 *  endpoint yet, so each of these tabs asks the caller to pick a campaign
 *  first, rather than silently showing nothing or fabricating aggregated
 *  data. See app/components/admin/campaigns/CampaignPicker.tsx. */
function CampaignScopedWorkspace({ view }: { view: "planner" | "content" | "audiences" | "budget" | "analytics" | "approvals" }) {
  const meta = WORKSPACE_META[view];
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const Section = SCOPED_SECTIONS[view];

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={meta.eyebrow} title={meta.title} description={meta.description} />

      <CampaignPicker
        selectedId={selected?.id ?? null}
        onSelect={(id, name) => setSelected({ id, name })}
        title={`Choose a campaign`}
        description={`Select which campaign's ${meta.title.toLowerCase()} to view.`}
      />

      {selected ? (
        <div className="cp-view">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="min-w-0 text-[11px] font-medium text-[var(--text-muted)]">
              Showing {meta.title.toLowerCase()} for <span className="font-semibold text-[var(--text)]">{selected.name}</span>.
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className={cx("rounded text-[10.5px] font-semibold text-[var(--accent)] transition-opacity hover:opacity-70", FOCUS)}
            >
              Change campaign
            </button>
          </div>
          <Section campaignId={selected.id} />
        </div>
      ) : (
        <p className="text-[11px] leading-5 text-[var(--text-subtle)]">
          Each of these views belongs to one campaign, so pick one above and its {meta.title.toLowerCase()} will open here.
        </p>
      )}
    </div>
  );
}

/* ============================================================================
   MAIN COMPONENT
============================================================================ */

export default function CampaignsTab() {
  const [view, setView] = useState<CampaignView>("overview");

  /** Creating or editing a campaign is a full-bleed workspace, exactly
   *  like Write a post, Generate a graphic and Create a video: it takes
   *  over the whole dashboard content area. `editing` holds the record
   *  being worked on, or null for a new one; `editorOpen` is what drives
   *  the takeover, because null is a legitimate value for `editing`. */
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ApiCampaign | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const { full: fullWorkspace, setFull } = useFullWorkspace();

  useEffect(() => {
    setFull(editorOpen);
    return () => setFull(false);
  }, [editorOpen, setFull]);

  const openEditor = useCallback((campaign: ApiCampaign | null) => {
    setEditing(campaign);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditing(null);
  }, []);

  /** The page header's "New campaign" works from any section: it lands
   *  you on the list and opens the editor over it. */
  const startNewCampaign = useCallback(() => {
    setView("campaigns");
    openEditor(null);
  }, [openEditor]);

  const [overview, setOverview] =
    useState<CampaignOverview>(EMPTY_OVERVIEW);

  const [loadState, setLoadState] =
    useState<LoadState>("loading");

  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

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
      setLastRefreshed(new Date());
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
    <>
      {/* Mounted unconditionally: the editor below uses the same cp-*
          animations, so the stylesheet cannot live inside the branch
          that unmounts when the editor opens. */}
      <style>{CAMPAIGN_STYLES}</style>

      {!fullWorkspace && (
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
            onClick={startNewCampaign}
            className="inline-flex h-9 items-center gap-2 rounded-[11px] bg-[var(--accent)] px-3.5 text-[11px] font-semibold text-[#181206] transition-[filter] duration-150 hover:brightness-[1.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
          className="cp-noscrollbar relative flex min-w-0 items-center gap-1 overflow-x-auto"
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
                    <span
                      title={`${overview.pendingApprovals} awaiting a decision`}
                      className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[color-mix(in_srgb,#D97706_16%,transparent)] px-1 text-[9.5px] font-bold text-[#D97706] tabular-nums"
                    >
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
        className="cp-view min-w-0"
      >
        {view === "overview" ? (
          <OverviewWorkspace
            overview={overview}
            loadState={loadState}
            onNavigate={setView}
            onRetry={() => void refreshOverview()}
          />
        ) : view === "campaigns" ? (
          <CampaignsWorkspace
            notify={notify}
            notifyError={notifyError}
            onChanged={() => void refreshOverview()}
            onEditCampaign={openEditor}
            refreshKey={listRefreshKey}
          />
        ) : (
          <CampaignScopedWorkspace view={view} />
        )}
      </div>

      {/* ================================================================
          FOOTER
      ================================================================ */}

      {/* The footer used to be two decorative labels. It now carries the
          one fact worth having at the bottom of a dashboard: how old
          the numbers above it are. */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-subtle)]">
          <Clock3 size={12} />
          {lastRefreshed
            ? `Figures last updated at ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(lastRefreshed)}`
            : "Figures have not loaded yet"}
        </div>

        <button
          type="button"
          onClick={() => void refreshOverview()}
          disabled={refreshing}
          className={cx("rounded text-[10px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-50", FOCUS)}
        >
          Refresh now
        </button>
      </footer>

    </div>
      )}

      {/* The editor sits out here beside the tab, not inside it: opening
          it sets `full`, and `full` unmounts the branch above. */}
      {editorOpen && (
        <CampaignEditorWorkspace
          key={editing?.id ?? "new"}
          campaign={editing}
          onClose={closeEditor}
          onSaved={(saved, wasCreate) => {
            closeEditor();
            notify(wasCreate ? `“${saved.name}” created.` : "Campaign saved.");
            setListRefreshKey((value) => value + 1);
            void refreshOverview();
          }}
        />
      )}

      {/* Toasts float above whichever surface is showing, so a save made
          inside the editor still confirms itself once it closes. */}
      {notice && <Toast notice={notice} onDismiss={() => setNotice(null)} />}
    </>
  );
}