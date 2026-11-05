/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/refs */
"use client";

// Technology Operations: Systems inventory. Reuses the existing Client
// Health monitoring architecture (MonitoredEndpoint and HealthCheck) rather
// than building a second, parallel one. A system's monitoring section is
// that system's own linked endpoints, read through the same honest status
// logic lib/client-health/compute.ts already uses. Deployments and incidents
// are derived through the system's own projectId, never duplicated here.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  AppWindow,
  ArrowUpRight,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Copy,
  GitBranch,
  Globe,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Server,
  ShieldAlert,
  ShieldQuestion,
  Smartphone,
  Trash2,
  UtensilsCrossed,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";

import { useSelectedClient } from "@/app/components/admin/SelectedClientContext";
import { ClientMark } from "@/lib/clients/ClientMark";
import { EndpointHistoryPanel } from "@/app/components/admin/client-health/EndpointHistoryPanel";
import { CLIENTS_ENDPOINT, fetchClientsPayload } from "@/lib/clients/clientsApi";
import useSWR from "swr";
import {
  createSystemApi,
  deleteSystemApi,
  fetchSystemDetail,
  fetchSystemsList,
  linkEndpointToSystemApi,
  SystemsApiError,
  type ManagedSystemDetail,
  type ManagedSystemLifecycleStatus,
  type ManagedSystemSummary,
  type ManagedSystemType,
} from "@/lib/systems/systemsApi";

/* ============================================================================
   STYLE
   Same tokens as ClientHealthTab.tsx so the two screens sit together.
============================================================================ */

const CARD = "rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_14px_36px_-28px_rgba(16,24,40,0.28)]";
const BTN_PRIMARY = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 text-[11.5px] font-semibold text-[var(--accent-foreground)] shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_SECONDARY = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[11.5px] font-medium text-[var(--text)] transition hover:bg-[var(--surface-muted)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]";
const INPUT = "h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-[12px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_15%,transparent)]";
const SPRING = { type: "spring", stiffness: 420, damping: 36 } as const;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ============================================================================
   VOCABULARY
============================================================================ */

const SYSTEM_TYPES: ManagedSystemType[] = ["WEBSITE", "WEB_APP", "MOBILE_APP", "API", "BACKEND_SERVICE", "INFRASTRUCTURE", "RESTAURANT_TENANT"];
// Restaurant tenants are only ever created through the Restaurant Platform's
// own provisioning flow (provision_restaurant(), which also creates the
// matching RestaurantLink row) — never through this generic "New system"
// form, which would leave an orphaned ManagedSystem with no RestaurantLink.
// RESTAURANT_TENANT is excluded here, but stays in SYSTEM_TYPES above so it
// still renders correctly in the filter dropdown and existing rows.
const CREATABLE_SYSTEM_TYPES: ManagedSystemType[] = SYSTEM_TYPES.filter((type) => type !== "RESTAURANT_TENANT");
const LIFECYCLE_STATUSES: ManagedSystemLifecycleStatus[] = ["PLANNED", "ACTIVE", "MAINTENANCE", "DEPRECATED", "RETIRED"];

const TYPE_META: Record<ManagedSystemType, { label: string; hint: string; Icon: LucideIcon; placeholder: string }> = {
  WEBSITE: { label: "Website", hint: "Marketing or content site", Icon: Globe, placeholder: "Marketing website" },
  WEB_APP: { label: "Web App", hint: "A signed in product in the browser", Icon: AppWindow, placeholder: "Customer portal" },
  MOBILE_APP: { label: "Mobile App", hint: "iOS or Android app", Icon: Smartphone, placeholder: "Rider app" },
  API: { label: "API", hint: "Public or partner API", Icon: Webhook, placeholder: "Public API" },
  BACKEND_SERVICE: { label: "Backend Service", hint: "Worker, queue or internal service", Icon: Server, placeholder: "Payments worker" },
  INFRASTRUCTURE: { label: "Infrastructure", hint: "Servers, databases, DNS, storage", Icon: Cloud, placeholder: "Production database" },
  RESTAURANT_TENANT: { label: "Restaurant Tenant", hint: "A restaurant provisioned on the Restaurant Platform", Icon: UtensilsCrossed, placeholder: "Restaurant tenant" },
};

const LIFECYCLE_META: Record<ManagedSystemLifecycleStatus, { label: string; hint: string; colour: string; bg: string }> = {
  PLANNED: { label: "Planned", hint: "Not built yet", colour: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  ACTIVE: { label: "Active", hint: "Live and supported", colour: "#059669", bg: "rgba(5,150,105,0.1)" },
  MAINTENANCE: { label: "Maintenance", hint: "Being worked on", colour: "#d97706", bg: "rgba(217,119,6,0.1)" },
  DEPRECATED: { label: "Deprecated", hint: "Being phased out", colour: "#dc2626", bg: "rgba(220,38,38,0.1)" },
  RETIRED: { label: "Retired", hint: "Switched off", colour: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

const HOSTING_SUGGESTIONS = ["Vercel", "AWS", "Netlify", "Cloudflare", "Render", "Railway", "DigitalOcean", "Firebase", "Supabase", "Hetzner"];

type Health = { key: "failure" | "degraded" | "awaiting" | "operational" | "unmonitored"; rank: number; label: string; colour: string; bg: string; Icon: LucideIcon };

/** Monitoring status for a system, derived honestly from its monitoring
 *  reasons (computeMonitoring in lib/client-health/compute.ts, reused
 *  server side). Never fabricated from the system row alone. */
function monitoringBadge(system: Pick<ManagedSystemSummary, "monitoring">): Health {
  if (!system.monitoring.applicable) {
    return { key: "unmonitored", rank: 4, label: "Not monitored", colour: "#6b7280", bg: "rgba(107,114,128,0.1)", Icon: ShieldQuestion };
  }
  if (system.monitoring.reasons.some((reason) => reason.severity === "risk")) {
    return { key: "failure", rank: 0, label: "Monitoring failure", colour: "#dc2626", bg: "rgba(220,38,38,0.1)", Icon: AlertTriangle };
  }
  if (system.monitoring.reasons.some((reason) => reason.severity === "attention")) {
    return { key: "degraded", rank: 1, label: "Degraded", colour: "#d97706", bg: "rgba(217,119,6,0.1)", Icon: AlertTriangle };
  }
  if (system.monitoring.reasons.some((reason) => reason.severity === "info")) {
    return { key: "awaiting", rank: 2, label: "Awaiting first check", colour: "#6b7280", bg: "rgba(107,114,128,0.1)", Icon: Loader2 };
  }
  return { key: "operational", rank: 3, label: "Operational", colour: "#059669", bg: "rgba(5,150,105,0.1)", Icon: CheckCircle2 };
}

/** Reasons carry a message under one of a few names depending on the check. */
function reasonText(reason: unknown): string | null {
  if (!reason || typeof reason !== "object") return null;
  const record = reason as Record<string, unknown>;
  for (const key of ["message", "label", "text", "detail", "description", "title"]) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  return null;
}

type Tone = "good" | "warn" | "bad" | "idle";
const TONE_COLOUR: Record<Tone, string> = { good: "#059669", warn: "#d97706", bad: "#dc2626", idle: "#9ca3af" };

function statusTone(status: string | null | undefined): Tone {
  const value = (status ?? "").toUpperCase();
  if (!value) return "idle";
  if (/(UNHEALTHY|DOWN|FAIL|ERROR|TIMEOUT|OFFLINE|CRITICAL|CANCEL)/.test(value)) return "bad";
  if (/(DEGRADED|SLOW|WARN|BUILD|QUEUE|PENDING|PROGRESS|RUNNING)/.test(value)) return "warn";
  if (/(UP|OK|HEALTHY|SUCCESS|SUCCEEDED|PASS|ONLINE|READY|LIVE|DONE|^2\d\d$)/.test(value)) return "good";
  return "idle";
}

function humanise(value: string) {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatRelativeTime(iso: string | null | undefined) {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAbsolute(iso: string | null | undefined) {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function hostOf(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.host.replace(/^www\./, "");
    // For code hosts the path is what identifies the repo.
    if (/(github|gitlab|bitbucket)\./.test(host)) {
      const path = parsed.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
      if (path) return path;
    }
    return host;
  } catch {
    return url;
  }
}

function normaliseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function urlProblem(value: string) {
  if (!value.trim()) return null;
  try {
    const parsed = new URL(normaliseUrl(value));
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return "That does not look like a full address.";
    return null;
  } catch {
    return "That does not look like a web address.";
  }
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/* ============================================================================
   OVERLAY STACK
   Escape closes only the topmost layer, scroll locks while any is open and
   focus returns to whatever opened it.
============================================================================ */

const overlayStack: number[] = [];
let overlaySeq = 0;

function useOverlay(onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const idRef = useRef(0);
  const isPresent = useIsPresent();

  // A layer that is animating out stops owning Escape straight away, so a
  // quick second press reaches the layer underneath.
  useEffect(() => {
    if (isPresent) return;
    const index = overlayStack.indexOf(idRef.current);
    if (index >= 0) overlayStack.splice(index, 1);
  }, [isPresent]);

  useEffect(() => {
    const id = ++overlaySeq;
    idRef.current = id;
    overlayStack.push(id);
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (overlayStack[overlayStack.length - 1] !== id) return;
      event.preventDefault();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      const index = overlayStack.indexOf(id);
      if (index >= 0) overlayStack.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);
}

/** Overlays render on document.body so page spacing and any transformed app
 *  shell above this tab can never offset or clip them. */
function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

/* ============================================================================
   PAGE
============================================================================ */

type LoadStatus = "loading" | "ready" | "error";
type OwnerFilter = "all" | "client" | "internal";
type HealthFilter = "all" | "attention" | "unmonitored";
type SortMode = "attention" | "name" | "endpoints";
type ViewMode = "list" | "grid";

const VIEW_KEY = "syntragrid.systems.view";

export default function SystemsTab() {
  const { selectedClientId, selectClient } = useSelectedClient();
  const reduce = useReducedMotion();

  const [items, setItems] = useState<ManagedSystemSummary[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ManagedSystemType | "">("");
  const [lifecycleFilter, setLifecycleFilter] = useState<ManagedSystemLifecycleStatus | "">("");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [sort, setSort] = useState<SortMode>("attention");
  const [view, setView] = useState<ViewMode>("list");

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_KEY);
      if (stored === "grid" || stored === "list") setView(stored);
    } catch {
      /* storage is optional */
    }
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage is optional */
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((message: string) => setToast({ id: Date.now(), message }), []);

  const load = useCallback(() => {
    // After the first load, keep the list on screen and refresh in place.
    if (hasLoadedRef.current) setRefreshing(true);
    else setStatus("loading");
    setError(null);
    fetchSystemsList({
      clientId: selectedClientId || undefined,
      systemType: typeFilter || undefined,
      lifecycleStatus: lifecycleFilter || undefined,
      search: search.trim() || undefined,
    })
      .then((result) => {
        setItems(result);
        setStatus("ready");
        setLoadedAt(Date.now());
        hasLoadedRef.current = true;
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Could not load systems.");
        setStatus("error");
      })
      .finally(() => setRefreshing(false));
  }, [selectedClientId, typeFilter, lifecycleFilter, search]);

  useEffect(() => {
    const handle = window.setTimeout(load, search ? 300 : 0);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId, typeFilter, lifecycleFilter, search]);

  /* Shortcuts: / searches, N adds a system. */
  const shortcutRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  shortcutRef.current = (event: KeyboardEvent) => {
    if (createOpen || detailId || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) return;
    if (event.key === "/") {
      event.preventDefault();
      searchRef.current?.focus();
    } else if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      setCreateOpen(true);
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => shortcutRef.current(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(() => {
    const internal = items.filter((item) => !item.clientId).length;
    const attention = items.filter((item) => monitoringBadge(item).rank <= 1).length;
    const unmonitored = items.filter((item) => !item.monitoring.applicable).length;
    const operational = items.filter((item) => monitoringBadge(item).key === "operational").length;
    return { total: items.length, internal, clientOwned: items.length - internal, attention, unmonitored, operational, withMonitoring: items.length - unmonitored };
  }, [items]);

  const visible = useMemo(() => {
    const list = items.filter((item) => {
      if (ownerFilter === "client" && !item.clientId) return false;
      if (ownerFilter === "internal" && item.clientId) return false;
      if (healthFilter === "attention" && monitoringBadge(item).rank > 1) return false;
      if (healthFilter === "unmonitored" && item.monitoring.applicable) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "endpoints") return b.monitoredEndpointCount - a.monitoredEndpointCount || a.name.localeCompare(b.name);
      return monitoringBadge(a).rank - monitoringBadge(b).rank || a.name.localeCompare(b.name);
    });
  }, [items, ownerFilter, healthFilter, sort]);

  const filtersActive = Boolean(search.trim() || typeFilter || lifecycleFilter || ownerFilter !== "all" || healthFilter !== "all");
  const clearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setLifecycleFilter("");
    setOwnerFilter("all");
    setHealthFilter("all");
  };

  const selectedClientName = items.find((item) => item.clientId === selectedClientId)?.client;

  const stats: Array<{ key: string; value: number; label: string; caption: string; active: boolean; tone?: "danger"; onClick: () => void }> = [
    {
      key: "all",
      value: counts.total,
      label: "Systems",
      caption: counts.total ? `${counts.operational} operational` : "None yet",
      active: ownerFilter === "all" && healthFilter === "all",
      onClick: () => {
        setOwnerFilter("all");
        setHealthFilter("all");
      },
    },
    {
      key: "attention",
      value: counts.attention,
      label: "Need attention",
      caption: counts.attention ? "Failing or degraded" : "All clear",
      active: healthFilter === "attention",
      tone: counts.attention ? "danger" : undefined,
      onClick: () => setHealthFilter((current) => (current === "attention" ? "all" : "attention")),
    },
    {
      key: "client",
      value: counts.clientOwned,
      label: "Client owned",
      caption: "Built for clients",
      active: ownerFilter === "client",
      onClick: () => setOwnerFilter((current) => (current === "client" ? "all" : "client")),
    },
    {
      key: "internal",
      value: counts.internal,
      label: "Syntra Grid",
      caption: "Our own systems",
      active: ownerFilter === "internal",
      onClick: () => setOwnerFilter((current) => (current === "internal" ? "all" : "internal")),
    },
    {
      key: "unmonitored",
      value: counts.unmonitored,
      label: "Not monitored",
      caption: counts.unmonitored ? "No endpoint linked" : "Everything is watched",
      active: healthFilter === "unmonitored",
      onClick: () => setHealthFilter((current) => (current === "unmonitored" ? "all" : "unmonitored")),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">Technology operations</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] text-[var(--text)]">Systems</h1>
          <p className="mt-1.5 max-w-[620px] text-[12px] leading-5 text-[var(--text-muted)]">
            Every website, app, API, service and piece of infrastructure we build and run, for clients and for ourselves. Monitoring, deployments and incidents come from the same live data as Client Health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[10.5px] text-[var(--text-subtle)] sm:block" title={loadedAt ? formatAbsolute(new Date(loadedAt).toISOString()) : undefined}>
            {refreshing ? "Refreshing" : loadedAt ? `Updated ${formatRelativeTime(new Date(loadedAt).toISOString()).toLowerCase()}` : ""}
          </span>
          <button type="button" onClick={load} disabled={status === "loading" || refreshing} aria-label="Refresh" title="Refresh" className={cx(BTN_SECONDARY, FOCUS, "h-10 w-10 px-0")}>
            <RefreshCw size={14} className={status === "loading" || refreshing ? "animate-spin" : undefined} />
          </button>
          <button type="button" onClick={() => setCreateOpen(true)} className={cx(BTN_PRIMARY, FOCUS, "h-10 pl-3.5 pr-2.5")}>
            <Plus size={14} strokeWidth={2.2} />
            New system
            <kbd className="ml-1 hidden h-5 min-w-5 items-center justify-center rounded-md bg-white/15 px-1.5 text-[9.5px] font-semibold sm:inline-flex">N</kbd>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {selectedClientId ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-[11.5px] text-[var(--text-muted)]">
              {selectedClientName ? <ClientMark logo={selectedClientName.logoUrl} name={selectedClientName.name} size="sm" /> : <Building2 size={14} />}
              <span>
                Showing systems for <span className="font-semibold text-[var(--text)]">{selectedClientName?.displayName || selectedClientName?.name || "the selected client"}</span>, set from the client switcher in the header.
              </span>
              <button type="button" onClick={() => selectClient(null)} className={cx(FOCUS, "ml-auto rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--surface)]")}>
                Show every system
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Stats double as quick filters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((stat) => (
          <button
            key={stat.key}
            type="button"
            onClick={stat.onClick}
            aria-pressed={stat.active}
            className={cx(
              CARD,
              FOCUS,
              "group relative overflow-hidden p-4 text-left transition hover:-translate-y-0.5",
              stat.active && "border-[color-mix(in_srgb,var(--accent)_60%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
              stat.key === "all" && "col-span-2 md:col-span-1",
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className={cx("text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums", stat.tone === "danger" ? "text-[var(--danger)]" : "text-[var(--text)]")}>
                {status === "loading" ? <span className="inline-block h-6 w-8 animate-pulse rounded-md bg-[var(--surface-muted)] align-middle" /> : stat.value}
              </span>
              {stat.active && stat.key !== "all" ? <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--accent)]">Filter</span> : null}
            </span>
            <span className="mt-2.5 block text-[11.5px] font-semibold text-[var(--text)]">{stat.label}</span>
            <span className="mt-0.5 block truncate text-[10.5px] text-[var(--text-muted)]">{stat.caption}</span>
            {stat.key === "all" && counts.total > 0 ? <HealthBar items={items} /> : null}
          </button>
        ))}
      </div>

      {/* Inventory */}
      <div className={cx(CARD, "overflow-hidden")}>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] p-3 sm:p-4">
          <label className="relative flex h-10 min-w-[200px] flex-1 items-center">
            <Search size={14} className="pointer-events-none absolute left-3 text-[var(--text-subtle)]" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && search) {
                  event.preventDefault();
                  setSearch("");
                }
              }}
              placeholder="Search by name, client or address"
              aria-label="Search systems"
              className={cx(INPUT, "border-[var(--line)] bg-[var(--surface-muted)] pl-9 pr-10 focus:bg-[var(--surface)]")}
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className={cx(FOCUS, "absolute right-2 flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-subtle)] hover:bg-[var(--surface)] hover:text-[var(--text)]")}>
                <X size={12} />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 hidden h-5 min-w-5 items-center justify-center rounded-md border border-[var(--line)] px-1.5 text-[9.5px] font-semibold text-[var(--text-subtle)] sm:inline-flex">/</kbd>
            )}
          </label>

          <Dropdown
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as ManagedSystemType | "")}
            width={176}
            options={[{ value: "", label: "All types", icon: <Boxes size={13} /> }, ...SYSTEM_TYPES.map((type) => {
              const Icon = TYPE_META[type].Icon;
              return { value: type, label: TYPE_META[type].label, hint: TYPE_META[type].hint, icon: <Icon size={13} /> };
            })]}
          />
          <Dropdown
            value={lifecycleFilter}
            onChange={(value) => setLifecycleFilter(value as ManagedSystemLifecycleStatus | "")}
            width={176}
            options={[{ value: "", label: "Any lifecycle" }, ...LIFECYCLE_STATUSES.map((value) => ({ value, label: LIFECYCLE_META[value].label, hint: LIFECYCLE_META[value].hint, dot: LIFECYCLE_META[value].colour }))]}
          />
          <Dropdown
            value={sort}
            onChange={(value) => setSort(value as SortMode)}
            width={196}
            prefix="Sort"
            options={[
              { value: "attention", label: "Needs attention first" },
              { value: "name", label: "Name, A to Z" },
              { value: "endpoints", label: "Most endpoints" },
            ]}
          />

          <div className="flex h-10 items-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1" role="radiogroup" aria-label="Layout">
            {([
              { id: "list", Icon: List, label: "List" },
              { id: "grid", Icon: LayoutGrid, label: "Cards" },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={view === item.id}
                aria-label={item.label}
                title={item.label}
                onClick={() => changeView(item.id)}
                className={cx(FOCUS, "relative flex h-full w-8 items-center justify-center rounded-lg transition-colors", view === item.id ? "text-[var(--text)]" : "text-[var(--text-subtle)] hover:text-[var(--text)]")}
              >
                {view === item.id ? <motion.span layoutId="systems-view-pill" transition={reduce ? { duration: 0 } : SPRING} className="absolute inset-0 rounded-lg bg-[var(--surface)] shadow-sm" /> : null}
                <item.Icon size={14} className="relative" />
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {filtersActive && status !== "loading" ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_50%,transparent)] px-4 py-2 text-[10.5px] text-[var(--text-muted)]">
                <span>
                  Showing <span className="font-semibold text-[var(--text)]">{visible.length}</span> of {plural(items.length, "system")}
                </span>
                {search.trim() ? <FilterChip label={`"${search.trim()}"`} onRemove={() => setSearch("")} /> : null}
                {typeFilter ? <FilterChip label={TYPE_META[typeFilter].label} onRemove={() => setTypeFilter("")} /> : null}
                {lifecycleFilter ? <FilterChip label={LIFECYCLE_META[lifecycleFilter].label} onRemove={() => setLifecycleFilter("")} /> : null}
                {ownerFilter !== "all" ? <FilterChip label={ownerFilter === "client" ? "Client owned" : "Syntra Grid"} onRemove={() => setOwnerFilter("all")} /> : null}
                {healthFilter !== "all" ? <FilterChip label={healthFilter === "attention" ? "Needs attention" : "Not monitored"} onRemove={() => setHealthFilter("all")} /> : null}
                <button type="button" onClick={clearFilters} className={cx(FOCUS, "ml-1 rounded-md px-1.5 py-0.5 font-semibold text-[var(--accent)] hover:bg-[var(--surface)]")}>
                  Clear all
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className={cx("transition-opacity", refreshing && "opacity-60")}>
          {status === "loading" ? <InventorySkeleton view={view} /> : null}

          {status === "error" ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)]">
                <AlertTriangle size={18} />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[var(--text)]">Systems could not be loaded</p>
                <p className="mt-1 max-w-[380px] text-[11.5px] text-[var(--text-muted)]">{error}</p>
              </div>
              <button type="button" onClick={load} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
                <RefreshCw size={13} />
                Try again
              </button>
            </div>
          ) : null}

          {status === "ready" && items.length === 0 && !filtersActive ? (
            <EmptyInventory onCreate={() => setCreateOpen(true)} />
          ) : null}

          {status === "ready" && visible.length === 0 && (items.length > 0 || filtersActive) ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-subtle)]">
                <Search size={18} />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[var(--text)]">Nothing matches these filters</p>
                <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">Try a different search, or clear the filters to see everything.</p>
              </div>
              <button type="button" onClick={clearFilters} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
                Clear filters
              </button>
            </div>
          ) : null}

          {status === "ready" && visible.length > 0 ? (
            view === "list" ? (
              <div>
                <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_72px_24px] gap-4 border-b border-[var(--line)] px-5 py-2.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)] md:grid">
                  <span>System</span>
                  <span>Type</span>
                  <span>Lifecycle</span>
                  <span>Monitoring</span>
                  <span className="text-right">Endpoints</span>
                  <span />
                </div>
                {visible.map((system, index) => (
                  <SystemRow key={system.id} system={system} index={index} onOpen={() => setDetailId(system.id)} />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3 2xl:grid-cols-4">
                {visible.map((system, index) => (
                  <SystemCard key={system.id} system={system} index={index} onOpen={() => setDetailId(system.id)} />
                ))}
              </div>
            )
          ) : null}
        </div>
      </div>

      <Portal>
      <AnimatePresence>
        {createOpen ? (
          <CreateSystemDialog
            key="create"
            defaultClientId={selectedClientId}
            onClose={() => setCreateOpen(false)}
            onCreated={(name) => {
              setCreateOpen(false);
              notify(`${name} added to the inventory`);
              load();
            }}
          />
        ) : null}

        {detailId ? (
          <SystemDetailPanel
            key="detail"
            systemId={detailId}
            onClose={() => setDetailId(null)}
            onChanged={load}
            onNotify={notify}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            className="fixed bottom-6 left-1/2 z-[400] flex -translate-x-1/2 items-center gap-2.5 rounded-2xl bg-[#111418] px-4 py-3 text-[12px] font-medium text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
              <Check size={12} />
            </span>
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
      </Portal>
    </div>
  );
}

/* ============================================================================
   INVENTORY PIECES
============================================================================ */

function HealthBar({ items }: { items: ManagedSystemSummary[] }) {
  const groups = useMemo(() => {
    const tally: Record<Health["key"], number> = { failure: 0, degraded: 0, awaiting: 0, operational: 0, unmonitored: 0 };
    items.forEach((item) => {
      tally[monitoringBadge(item).key] += 1;
    });
    return ([
      ["operational", "#059669"],
      ["awaiting", "#9ca3af"],
      ["degraded", "#d97706"],
      ["failure", "#dc2626"],
      ["unmonitored", "#d4d4d8"],
    ] as const).map(([key, colour]) => ({ key, colour, count: tally[key] }));
  }, [items]);
  return (
    <span className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-hidden="true">
      {groups.map((group) => (group.count ? <span key={group.key} style={{ width: `${(group.count / items.length) * 100}%`, backgroundColor: group.colour }} /> : null))}
    </span>
  );
}

function OwnerMark({ system, size = "sm" }: { system: Pick<ManagedSystemSummary, "client">; size?: "sm" | "md" }) {
  if (system.client) return <ClientMark logo={system.client.logoUrl} name={system.client.name} size={size} />;
  return (
    <span className={cx("flex shrink-0 items-center justify-center border border-[#0B1020]/[0.07] bg-[#FAFAF9] font-bold text-[#5A6173]", size === "md" ? "h-12 w-12 rounded-2xl text-xs" : "h-10 w-10 rounded-xl text-[10px]")}>SG</span>
  );
}

function ownerName(system: Pick<ManagedSystemSummary, "client">) {
  return system.client ? system.client.displayName || system.client.name : "Syntra Grid";
}

function Pill({ label, colour, bg, Icon, spin }: { label: string; colour: string; bg: string; Icon?: LucideIcon; spin?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: colour, backgroundColor: bg }}>
      {Icon ? <Icon size={10} className={cx("shrink-0", spin && "animate-spin [animation-duration:2.4s]")} /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: colour }} />}
      <span className="truncate">{label}</span>
    </span>
  );
}

function SystemRow({ system, index, onOpen }: { system: ManagedSystemSummary; index: number; onOpen: () => void }) {
  const badge = monitoringBadge(system);
  const type = TYPE_META[system.systemType];
  const lifecycle = LIFECYCLE_META[system.lifecycleStatus];
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index, 12) * 0.02 }}
      className={cx(
        FOCUS,
        "group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--line)] px-5 py-3 text-left transition-colors last:border-0 hover:bg-[color-mix(in_srgb,var(--surface-muted)_70%,transparent)] md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_72px_24px]",
      )}
    >
      {badge.rank <= 1 ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full" style={{ backgroundColor: badge.colour }} /> : null}
      <span className="flex min-w-0 items-center gap-3">
        <OwnerMark system={system} />
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-[var(--text)]">{system.name}</span>
          <span className="block truncate text-[10.5px] text-[var(--text-subtle)]">{ownerName(system)}</span>
        </span>
      </span>
      <span className="hidden min-w-0 items-center gap-1.5 text-[11px] text-[var(--text-muted)] md:flex">
        <type.Icon size={13} className="shrink-0 text-[var(--text-subtle)]" />
        <span className="truncate">{type.label}</span>
      </span>
      <span className="hidden md:block">
        <Pill label={lifecycle.label} colour={lifecycle.colour} bg={lifecycle.bg} />
      </span>
      <span className="justify-self-end md:justify-self-start">
        <Pill label={badge.label} colour={badge.colour} bg={badge.bg} Icon={badge.Icon} spin={badge.key === "awaiting"} />
      </span>
      <span className="hidden text-right text-[12px] font-semibold tabular-nums text-[var(--text)] md:block">{system.monitoredEndpointCount}</span>
      <ChevronRight size={14} className="hidden text-[var(--text-subtle)] transition-transform group-hover:translate-x-0.5 md:block" />
    </motion.button>
  );
}

function SystemCard({ system, index, onOpen }: { system: ManagedSystemSummary; index: number; onOpen: () => void }) {
  const badge = monitoringBadge(system);
  const type = TYPE_META[system.systemType];
  const lifecycle = LIFECYCLE_META[system.lifecycleStatus];
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index, 12) * 0.025 }}
      className={cx(FOCUS, "group relative flex flex-col overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgba(16,24,40,0.4)]")}
    >
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: badge.rank <= 1 ? badge.colour : "transparent" }} />
      <span className="flex items-start justify-between gap-3">
        <OwnerMark system={system} />
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-muted)]">
          <type.Icon size={15} />
        </span>
      </span>
      <span className="mt-3 block truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--text)]">{system.name}</span>
      <span className="mt-0.5 block truncate text-[11px] text-[var(--text-subtle)]">
        {ownerName(system)} · {type.label}
      </span>
      <span className="mt-4 flex flex-wrap items-center gap-1.5">
        <Pill label={badge.label} colour={badge.colour} bg={badge.bg} Icon={badge.Icon} spin={badge.key === "awaiting"} />
        <Pill label={lifecycle.label} colour={lifecycle.colour} bg={lifecycle.bg} />
      </span>
      <span className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 text-[10.5px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <Activity size={12} />
          {plural(system.monitoredEndpointCount, "endpoint")}
        </span>
        <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--text)] opacity-0 transition-opacity group-hover:opacity-100">
          Open <ChevronRight size={12} />
        </span>
      </span>
    </motion.button>
  );
}

function InventorySkeleton({ view }: { view: ViewMode }) {
  if (view === "grid") {
    return (
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-[172px] animate-pulse rounded-[18px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)]" />
        ))}
      </div>
    );
  }
  return (
    <div aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3.5 last:border-0">
          <span className="h-10 w-10 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3 w-40 animate-pulse rounded bg-[var(--surface-muted)]" style={{ animationDelay: `${index * 80}ms` }} />
            <span className="block h-2.5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" style={{ animationDelay: `${index * 80}ms` }} />
          </span>
          <span className="hidden h-5 w-24 animate-pulse rounded-full bg-[var(--surface-muted)] md:block" />
          <span className="h-5 w-28 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
      ))}
    </div>
  );
}

function EmptyInventory({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto flex w-fit items-center -space-x-2">
        {SYSTEM_TYPES.slice(0, 5).map((type, index) => {
          const Icon = TYPE_META[type].Icon;
          return (
            <span key={type} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] shadow-sm" style={{ transform: `rotate(${(index - 2) * 5}deg) translateY(${Math.abs(index - 2) * 3}px)` }}>
              <Icon size={17} />
            </span>
          );
        })}
      </div>
      <p className="mt-5 text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)]">Start your systems inventory</p>
      <p className="mx-auto mt-1.5 max-w-[420px] text-[12px] leading-5 text-[var(--text-muted)]">
        Add a website, app, API or internal service. Link its monitored endpoints and project, and its health, deployments and incidents show up here on their own.
      </p>
      <button type="button" onClick={onCreate} className={cx(BTN_PRIMARY, FOCUS, "mt-5 h-10 px-4")}>
        <Plus size={14} />
        Add the first system
      </button>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] pl-2 pr-0.5 font-medium text-[var(--text)]">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className={cx(FOCUS, "flex h-5 w-5 items-center justify-center rounded text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]")}>
        <X size={10} />
      </button>
    </span>
  );
}

/* ============================================================================
   DROPDOWN
   One themed menu for every choice. Keyboard driven, searchable when long,
   rendered in a portal so a dialog can never clip it.
============================================================================ */

type Option = { value: string; label: string; hint?: string; icon?: ReactNode; dot?: string; disabled?: boolean; keywords?: string };

function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Choose",
  width,
  prefix,
  invalid,
  searchable,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  width?: number | string;
  prefix?: string;
  invalid?: boolean;
  searchable?: boolean;
  id?: string;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; up: boolean; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value) ?? null;
  const canSearch = searchable ?? options.length > 7;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((option) => `${option.label} ${option.hint ?? ""} ${option.keywords ?? ""}`.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight, viewportWidth = window.innerWidth;
    const wanted = Math.min(360, 14 + (canSearch ? 50 : 0) + Math.min(options.length, 6) * 50);
    const below = viewportHeight - rect.bottom - 12, above = rect.top - 12;
    const up = below < wanted && above > below;
    const menuWidth = Math.max(rect.width, 240);
    const left = Math.min(Math.max(rect.left, 8), Math.max(8, viewportWidth - menuWidth - 8));
    const maxHeight = Math.max(160, Math.min(360, up ? above : below));
    setPos(up ? { left, width: menuWidth, bottom: viewportHeight - rect.top + 6, up, maxHeight } : { left, width: menuWidth, top: rect.bottom + 6, up, maxHeight });
    setCursor(Math.max(0, options.findIndex((option) => option.value === value)));
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = (event: Event) => {
      if (listRef.current && event.target instanceof Node && listRef.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const focusTimer = window.setTimeout(() => (canSearch ? searchRef.current : listRef.current)?.focus(), 10);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.clearTimeout(focusTimer);
    };
  }, [open, canSearch]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  const choose = (option: Option) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const move = (delta: number) => {
    if (!filtered.length) return;
    let next = cursor;
    for (let step = 0; step < filtered.length; step += 1) {
      next = (next + delta + filtered.length) % filtered.length;
      if (!filtered[next].disabled) break;
    }
    setCursor(next);
  };
  const onListKey = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
    else if (event.key === "Enter") { event.preventDefault(); const option = filtered[cursor]; if (option) choose(option); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); }
    else if (event.key === "Tab") setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        style={{ width }}
        className={cx(
          FOCUS,
          "flex h-10 min-w-0 items-center gap-2 rounded-xl border px-3 text-left text-[11.5px] transition",
          invalid ? "border-[color-mix(in_srgb,var(--danger)_60%,transparent)]" : open ? "border-[var(--accent)]" : "border-[var(--line)] hover:border-[color-mix(in_srgb,var(--text-subtle)_40%,transparent)]",
          open ? "bg-[var(--surface)]" : "bg-[var(--surface-muted)]",
          !width && "w-full",
        )}
      >
        {prefix ? <span className="shrink-0 text-[var(--text-subtle)]">{prefix}</span> : null}
        {selected?.dot ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: selected.dot }} /> : null}
        {selected?.icon ? <span className="flex shrink-0 text-[var(--text-muted)]">{selected.icon}</span> : null}
        <span className={cx("min-w-0 flex-1 truncate font-medium", selected ? "text-[var(--text)]" : "text-[var(--text-subtle)]")}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={cx("shrink-0 text-[var(--text-subtle)] transition-transform", open && "rotate-180")} />
      </button>
      {mounted
        ? createPortal(
            <AnimatePresence>
              {open && pos ? (
                <motion.div
                  ref={listRef}
                  tabIndex={-1}
                  role="listbox"
                  onKeyDown={onListKey}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: pos.up ? 6 : -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: pos.up ? 4 : -4, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="fixed z-[500] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] outline-none shadow-[0_24px_60px_-24px_rgba(16,24,40,0.4),0_2px_8px_-4px_rgba(16,24,40,0.15)]"
                  style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
                >
                  {canSearch ? (
                    <div className="border-b border-[var(--line)] p-2">
                      <div className="relative">
                        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
                        <input
                          ref={searchRef}
                          value={query}
                          onChange={(event) => {
                            setQuery(event.target.value);
                            setCursor(0);
                          }}
                          placeholder="Type to filter"
                          className="h-9 w-full rounded-lg bg-[var(--surface-muted)] pl-8 pr-3 text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="overflow-y-auto p-1.5" style={{ maxHeight: pos.maxHeight - (canSearch ? 50 : 0) }}>
                    {filtered.length === 0 ? <p className="px-3 py-6 text-center text-[11.5px] text-[var(--text-subtle)]">Nothing matches</p> : null}
                    {filtered.map((option, index) => {
                      const active = option.value === value;
                      return (
                        <button
                          key={option.value || "__empty"}
                          type="button"
                          role="option"
                          aria-selected={active}
                          disabled={option.disabled}
                          data-index={index}
                          onMouseEnter={() => setCursor(index)}
                          onClick={() => choose(option)}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors disabled:opacity-40"
                          style={{ backgroundColor: index === cursor ? "var(--surface-muted)" : "transparent" }}
                        >
                          {option.dot ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.dot }} /> : null}
                          {option.icon ? (
                            <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg", active ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]" : "bg-[var(--surface-muted)] text-[var(--text-muted)]")}>{option.icon}</span>
                          ) : null}
                          <span className="min-w-0 flex-1">
                            <span className={cx("block truncate text-[12px] font-semibold", active ? "text-[var(--accent)]" : "text-[var(--text)]")}>{option.label}</span>
                            {option.hint ? <span className="block truncate text-[10.5px] text-[var(--text-subtle)]">{option.hint}</span> : null}
                          </span>
                          {active ? <Check size={14} className="shrink-0 text-[var(--accent)]" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

/* ============================================================================
   SHELLS
============================================================================ */

function ModalShell({ label, onClose, children, width = 620, z = 320 }: { label: string; onClose: () => void; children: ReactNode; width?: number; z?: number }) {
  const reduce = useReducedMotion();
  useOverlay(onClose);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ zIndex: z }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" />
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-popover),0_40px_100px_-40px_rgba(0,0,0,0.5)] sm:rounded-[26px]"
        style={{ maxWidth: width }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">{children}</span>
      {aside}
    </div>
  );
}

/* ============================================================================
   CREATE DIALOG
============================================================================ */

type ClientOption = { id: string; name: string; displayName: string | null; logoUrl?: string | null };

function CreateSystemDialog({ defaultClientId, onClose, onCreated }: { defaultClientId: string | null; onClose: () => void; onCreated: (name: string) => void }) {
  const reduce = useReducedMotion();
  const fieldId = useId();
  const { data: clientsPayload, isLoading: clientsLoading } = useSWR(CLIENTS_ENDPOINT, fetchClientsPayload, { dedupingInterval: 60_000 });
  const clients = useMemo(() => (clientsPayload?.clients ?? []) as unknown as ClientOption[], [clientsPayload]);

  const [isInternal, setIsInternal] = useState(defaultClientId === null);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [name, setName] = useState("");
  const [systemType, setSystemType] = useState<ManagedSystemType>("WEBSITE");
  const [description, setDescription] = useState("");
  const [productionUrl, setProductionUrl] = useState("");
  const [stagingUrl, setStagingUrl] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [hostingProvider, setHostingProvider] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const client = clients.find((item) => item.id === clientId) ?? null;
  const dirty = Boolean(name || description || productionUrl || stagingUrl || repositoryUrl || hostingProvider);
  const problems = {
    client: !isInternal && !clientId ? "Choose which client owns this system." : null,
    name: !name.trim() ? "Give the system a name." : null,
    productionUrl: urlProblem(productionUrl),
    stagingUrl: urlProblem(stagingUrl),
    repositoryUrl: urlProblem(repositoryUrl),
  };
  const blocking = Object.values(problems).some(Boolean);

  const requestClose = () => {
    if (dirty && !submitting) setConfirmDiscard(true);
    else onClose();
  };

  const submit = async () => {
    setAttempted(true);
    if (blocking || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSystemApi({
        clientId: isInternal ? null : clientId || null,
        name: name.trim(),
        description: description.trim() || null,
        systemType,
        productionUrl: normaliseUrl(productionUrl) || null,
        stagingUrl: normaliseUrl(stagingUrl) || null,
        repositoryUrl: normaliseUrl(repositoryUrl) || null,
        hostingProvider: hostingProvider.trim() || null,
      });
      onCreated(name.trim());
    } catch (caught) {
      setError(caught instanceof SystemsApiError ? caught.message : "Could not create this system.");
    } finally {
      setSubmitting(false);
    }
  };

  const type = TYPE_META[systemType];
  const suggestedName = client ? `${client.displayName || client.name} ${type.label.toLowerCase()}` : type.placeholder;

  return (
    <ModalShell label="Add a system" onClose={requestClose} width={660}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex items-start gap-4 border-b border-[var(--line)] px-6 pb-5 pt-6">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={systemType} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} className="flex">
                <type.Icon size={20} />
              </motion.span>
            </AnimatePresence>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">Add a system</h3>
            <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)]">
              {name.trim() || "Untitled"} · {type.label} · {isInternal ? "Syntra Grid" : client ? client.displayName || client.name : "No client chosen"}
            </p>
          </div>
          <button type="button" onClick={requestClose} aria-label="Close" className={cx(FOCUS, "flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]")}>
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
          {/* Owner */}
          <section>
            <SectionLabel>Who owns it</SectionLabel>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-muted)] p-1" role="radiogroup" aria-label="Owner">
              {([
                { id: false, label: "A client", hint: "Built for a client", Icon: Building2 },
                { id: true, label: "Syntra Grid", hint: "One of our own", Icon: Boxes },
              ] as const).map((item) => {
                const active = isInternal === item.id;
                return (
                  <button
                    key={String(item.id)}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setIsInternal(item.id)}
                    className={cx(FOCUS, "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-left")}
                  >
                    {active ? <motion.span layoutId={`${fieldId}-owner`} transition={reduce ? { duration: 0 } : SPRING} className="absolute inset-0 rounded-lg bg-[var(--surface)] shadow-sm" /> : null}
                    <item.Icon size={15} className={cx("relative shrink-0", active ? "text-[var(--accent)]" : "text-[var(--text-subtle)]")} />
                    <span className="relative min-w-0">
                      <span className={cx("block text-[12px] font-semibold", active ? "text-[var(--text)]" : "text-[var(--text-muted)]")}>{item.label}</span>
                      <span className="block truncate text-[10.5px] text-[var(--text-subtle)]">{item.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence initial={false}>
              {!isInternal ? (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="pt-3">
                    <Dropdown
                      value={clientId}
                      onChange={setClientId}
                      searchable
                      invalid={attempted && Boolean(problems.client)}
                      placeholder={clientsLoading ? "Loading clients" : "Choose a client"}
                      options={clients.map((item) => ({
                        value: item.id,
                        label: item.displayName || item.name,
                        hint: item.displayName && item.displayName !== item.name ? item.name : undefined,
                        keywords: item.name,
                        icon: <ClientMark logo={item.logoUrl ?? null} name={item.name} size="sm" />,
                      }))}
                    />
                    {attempted && problems.client ? <p className="mt-1.5 text-[10.5px] font-medium text-[var(--danger)]">{problems.client}</p> : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>

          {/* Type */}
          <section>
            <SectionLabel>What is it</SectionLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="System type">
              {CREATABLE_SYSTEM_TYPES.map((value) => {
                const meta = TYPE_META[value];
                const active = systemType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSystemType(value)}
                    className={cx(
                      FOCUS,
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                      active ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] shadow-[0_8px_20px_-16px_var(--accent)]" : "border-[var(--line)] hover:border-[color-mix(in_srgb,var(--text-subtle)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)]",
                    )}
                  >
                    <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-[var(--surface-muted)] text-[var(--text-muted)]")}>
                      <meta.Icon size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold text-[var(--text)]">{meta.label}</span>
                      <span className="mt-0.5 block text-[10.5px] leading-4 text-[var(--text-subtle)]">{meta.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Name and description */}
          <section className="space-y-3">
            <div>
              <SectionLabel>Name</SectionLabel>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={suggestedName}
                maxLength={120}
                aria-invalid={attempted && Boolean(problems.name)}
                className={cx(INPUT, "h-11 text-[13px] font-medium", attempted && problems.name ? "border-[color-mix(in_srgb,var(--danger)_60%,transparent)]" : "border-[var(--line)]")}
              />
              {attempted && problems.name ? (
                <p className="mt-1.5 text-[10.5px] font-medium text-[var(--danger)]">{problems.name}</p>
              ) : !name && suggestedName ? (
                <button type="button" onClick={() => setName(suggestedName)} className={cx(FOCUS, "mt-1.5 inline-flex items-center gap-1 rounded-md text-[10.5px] font-medium text-[var(--accent)] hover:underline")}>
                  Use &ldquo;{suggestedName}&rdquo;
                </button>
              ) : null}
            </div>
            <div>
              <SectionLabel aside={<span className="text-[10px] tabular-nums text-[var(--text-subtle)]">{description.length}/500</span>}>Description</SectionLabel>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, 500))}
                rows={3}
                placeholder="What it does, who uses it, anything the on call engineer should know."
                className={cx(INPUT, "h-auto resize-none border-[var(--line)] py-2.5 leading-5")}
              />
            </div>
          </section>

          {/* Links */}
          <section>
            <SectionLabel>Where it lives</SectionLabel>
            <div className="space-y-2">
              <UrlField icon={Globe} label="Production" value={productionUrl} onChange={setProductionUrl} placeholder="example.com" problem={problems.productionUrl} />
              <UrlField icon={Rocket} label="Staging" value={stagingUrl} onChange={setStagingUrl} placeholder="staging.example.com" problem={problems.stagingUrl} />
              <UrlField icon={GitBranch} label="Repository" value={repositoryUrl} onChange={setRepositoryUrl} placeholder="github.com/org/repo" problem={problems.repositoryUrl} />
            </div>
            <p className="mt-2 text-[10.5px] text-[var(--text-subtle)]">https is added for you. Monitoring is linked separately from Client Health once the system exists.</p>
          </section>

          {/* Hosting */}
          <section>
            <SectionLabel>Hosting</SectionLabel>
            <div className="relative">
              <Cloud size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
              <input value={hostingProvider} onChange={(event) => setHostingProvider(event.target.value)} placeholder="Where it runs" maxLength={80} className={cx(INPUT, "border-[var(--line)] pl-9")} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {HOSTING_SUGGESTIONS.map((provider) => {
                const active = hostingProvider.trim().toLowerCase() === provider.toLowerCase();
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setHostingProvider(active ? "" : provider)}
                    aria-pressed={active}
                    className={cx(FOCUS, "h-7 rounded-full border px-2.5 text-[10.5px] font-medium transition", active ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]" : "border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]")}
                  >
                    {provider}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <AnimatePresence initial={false}>
          {error ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <p className="flex items-center gap-2 border-t border-[color-mix(in_srgb,var(--danger)_20%,transparent)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] px-6 py-2.5 text-[11.5px] font-medium text-[var(--danger)]">
                <AlertTriangle size={13} />
                {error}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_50%,transparent)] px-6 py-4">
          {confirmDiscard ? (
            <>
              <span className="text-[11.5px] font-medium text-[var(--text)]">Discard this system?</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDiscard(false)} className={cx(BTN_SECONDARY, FOCUS, "h-10")}>
                  Keep editing
                </button>
                <button type="button" onClick={onClose} className={cx(FOCUS, "inline-flex h-10 items-center rounded-xl bg-[var(--danger)] px-3.5 text-[11.5px] font-semibold text-white hover:opacity-90")}>
                  Discard
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="hidden items-center gap-1 text-[10.5px] text-[var(--text-subtle)] sm:flex">
                <kbd className="rounded border border-[var(--line)] px-1 font-semibold">Ctrl</kbd>
                <kbd className="rounded border border-[var(--line)] px-1 font-semibold">Enter</kbd>
                to add
              </span>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={requestClose} className={cx(BTN_SECONDARY, FOCUS, "h-10")}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting || (attempted && blocking)} className={cx(BTN_PRIMARY, FOCUS, "h-10 min-w-[128px]")}>
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {submitting ? "Adding" : "Add system"}
                </button>
              </div>
            </>
          )}
        </div>
      </form>
    </ModalShell>
  );
}

function UrlField({ icon: Icon, label, value, onChange, placeholder, problem }: { icon: LucideIcon; label: string; value: string; onChange: (value: string) => void; placeholder: string; problem: string | null }) {
  const [touched, setTouched] = useState(false);
  const showProblem = touched && problem;
  return (
    <div>
      <div className={cx("flex h-10 items-center overflow-hidden rounded-xl border bg-[var(--surface)] transition focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--accent)_15%,transparent)]", showProblem ? "border-[color-mix(in_srgb,var(--danger)_60%,transparent)]" : "border-[var(--line)]")}>
        <span className="flex h-full w-[118px] shrink-0 items-center gap-2 border-r border-[var(--line)] bg-[var(--surface-muted)] px-3 text-[11px] font-medium text-[var(--text-muted)]">
          <Icon size={13} />
          {label}
        </span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            setTouched(true);
            if (value.trim() && !urlProblem(value)) onChange(normaliseUrl(value));
          }}
          inputMode="url"
          spellCheck={false}
          autoCapitalize="off"
          placeholder={placeholder}
          aria-label={`${label} URL`}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
        />
        {value && !problem ? <Check size={13} className="mr-3 shrink-0 text-emerald-600" /> : null}
      </div>
      {showProblem ? <p className="mt-1 text-[10.5px] font-medium text-[var(--danger)]">{problem}</p> : null}
    </div>
  );
}

/* ============================================================================
   DETAIL PANEL
============================================================================ */

type DetailTab = "monitoring" | "deployments" | "incidents";

function SystemDetailPanel({ systemId, onClose, onChanged, onNotify }: { systemId: string; onClose: () => void; onChanged: () => void; onNotify: (message: string) => void }) {
  const reduce = useReducedMotion();
  const tabsId = useId();
  const [system, setSystem] = useState<ManagedSystemDetail | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("monitoring");

  useOverlay(onClose);

  const reload = useCallback((quiet = false) => {
    if (!quiet) setStatus("loading");
    fetchSystemDetail(systemId)
      .then((result) => {
        setSystem(result);
        setStatus("ready");
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Could not load this system.");
        setStatus("error");
      });
  }, [systemId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const handleDelete = async () => {
    if (!system) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteSystemApi(system.id);
      onNotify(`${system.name} removed from the inventory`);
      onChanged();
      onClose();
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Could not remove this system.");
    } finally {
      setBusy(false);
    }
  };

  const badge = system ? monitoringBadge(system) : null;
  const openIncidents = system ? system.incidents.filter((incident) => !incident.resolved).length : 0;
  const lastChecked = system
    ? system.monitoredEndpoints.reduce<string | null>((latest, endpoint) => {
        const at = endpoint.latestCheck?.checkedAt ?? null;
        return at && (!latest || new Date(at) > new Date(latest)) ? at : latest;
      }, null)
    : null;
  const upCount = system ? system.monitoredEndpoints.filter((endpoint) => statusTone(endpoint.latestCheck?.status) === "good").length : 0;
  const reasons = system ? system.monitoring.reasons.map(reasonText).filter((text): text is string => Boolean(text)) : [];

  const tabs: Array<{ id: DetailTab; label: string; count: number; alert?: boolean }> = system
    ? [
        { id: "monitoring", label: "Monitoring", count: system.monitoredEndpoints.length },
        { id: "deployments", label: "Deployments", count: system.deployments.length },
        { id: "incidents", label: "Incidents", count: system.incidents.length, alert: openIncidents > 0 },
      ]
    : [];

  return (
    <div role="dialog" aria-modal="true" aria-label={system ? system.name : "System detail"} className="fixed inset-0 z-[300] flex justify-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <motion.aside
        initial={reduce ? { opacity: 0 } : { x: "100%" }}
        animate={reduce ? { opacity: 1 } : { x: 0 }}
        exit={reduce ? { opacity: 0 } : { x: "100%" }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-full w-full max-w-[600px] flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-popover),-30px_0_80px_-40px_rgba(0,0,0,0.45)]"
      >
        {/* Header */}
        <div className="border-b border-[var(--line)] px-6 pb-5 pt-5">
          <div className="flex items-start gap-3.5">
            {system ? <OwnerMark system={system} size="md" /> : <span className="h-12 w-12 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-[var(--text-subtle)]">{system ? ownerName(system) : " "}</p>
              <h2 className="mt-0.5 truncate text-[19px] font-semibold tracking-[-0.03em] text-[var(--text)]">{system ? system.name : "Loading system"}</h2>
              {system ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                    {(() => {
                      const Icon = TYPE_META[system.systemType].Icon;
                      return <Icon size={10} />;
                    })()}
                    {TYPE_META[system.systemType].label}
                  </span>
                  <Pill label={LIFECYCLE_META[system.lifecycleStatus].label} colour={LIFECYCLE_META[system.lifecycleStatus].colour} bg={LIFECYCLE_META[system.lifecycleStatus].bg} />
                  {system.hostingProvider ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                      <Cloud size={10} />
                      {system.hostingProvider}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className={cx(FOCUS, "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]")}>
              <X size={15} />
            </button>
          </div>

          {system && (system.productionUrl || system.stagingUrl || system.repositoryUrl) ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {system.productionUrl ? <LinkButton href={system.productionUrl} label="Production" icon={Globe} primary /> : null}
              {system.stagingUrl ? <LinkButton href={system.stagingUrl} label="Staging" icon={Rocket} /> : null}
              {system.repositoryUrl ? <LinkButton href={system.repositoryUrl} label="Repository" icon={GitBranch} /> : null}
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {status === "loading" && !system ? (
            <div className="space-y-3 p-6" aria-busy="true">
              <div className="h-[92px] animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
              <div className="h-10 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-xl bg-[var(--surface-muted)]" style={{ animationDelay: `${index * 90}ms` }} />
              ))}
            </div>
          ) : null}

          {status === "error" ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <AlertTriangle size={20} className="text-[var(--danger)]" />
              <p className="text-[12px] text-[var(--text-muted)]">{error}</p>
              <button type="button" onClick={() => reload()} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
                <RefreshCw size={13} />
                Try again
              </button>
            </div>
          ) : null}

          {system && badge && status !== "error" ? (
            <div className="space-y-5 p-6">
              {/* Health hero */}
              <div className="relative overflow-hidden rounded-2xl border p-4" style={{ borderColor: `${badge.colour}33`, background: `linear-gradient(135deg, ${badge.bg}, transparent 70%)` }}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: badge.bg, color: badge.colour }}>
                    <badge.Icon size={18} className={badge.key === "awaiting" ? "animate-spin [animation-duration:2.4s]" : undefined} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: badge.colour }}>
                      {badge.label}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                      {!system.monitoring.applicable
                        ? "No monitored endpoint is linked, so there is nothing to check yet."
                        : `${upCount} of ${plural(system.monitoredEndpoints.length, "endpoint")} responding · last checked ${formatRelativeTime(lastChecked).toLowerCase()}`}
                    </p>
                  </div>
                </div>
                {reasons.length ? (
                  <ul className="mt-3 space-y-1 border-t pt-3 text-[11px] text-[var(--text-muted)]" style={{ borderColor: `${badge.colour}22` }}>
                    {reasons.slice(0, 4).map((reason, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: badge.colour }} />
                        {reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {system.description ? <p className="text-[12.5px] leading-6 text-[var(--text-muted)]">{system.description}</p> : null}

              {/* Tabs */}
              <div>
                <div className="flex gap-1 rounded-xl bg-[var(--surface-muted)] p-1" role="tablist" aria-label="System records">
                  {tabs.map((item) => {
                    const active = tab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setTab(item.id)}
                        className={cx(FOCUS, "relative flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11.5px] font-semibold transition-colors", active ? "text-[var(--text)]" : "text-[var(--text-subtle)] hover:text-[var(--text)]")}
                      >
                        {active ? <motion.span layoutId={`${tabsId}-tab`} transition={reduce ? { duration: 0 } : SPRING} className="absolute inset-0 rounded-lg bg-[var(--surface)] shadow-sm" /> : null}
                        <span className="relative">{item.label}</span>
                        <span className={cx("relative rounded-md px-1.5 py-px text-[10px] tabular-nums", item.alert ? "bg-[var(--danger)] text-white" : "bg-[var(--surface-muted)] text-[var(--text-muted)]")}>{item.alert ? openIncidents : item.count}</span>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="pt-4">
                    {tab === "monitoring" ? (
                      <div>
                        {system.monitoredEndpoints.length === 0 ? (
                          <EmptyNote
                            icon={Activity}
                            title="No endpoint linked"
                            body={system.clientId ? "Link an endpoint that is already set up in Client Health, or add it there first." : "Internal systems cannot link a monitored endpoint yet, because a monitored endpoint always belongs to a client."}
                          />
                        ) : (
                          <ul className="space-y-2">
                            {system.monitoredEndpoints.map((endpoint) => {
                              const historyOpen = historyOpenId === endpoint.id;
                              const tone = statusTone(endpoint.latestCheck?.status);
                              return (
                                <li key={endpoint.id} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                                  <button type="button" onClick={() => setHistoryOpenId(historyOpen ? null : endpoint.id)} aria-expanded={historyOpen} className={cx(FOCUS, "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)]")}>
                                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                                      {tone === "good" ? <span className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ backgroundColor: TONE_COLOUR[tone] }} /> : null}
                                      <span className="relative h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TONE_COLOUR[tone] }} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[12px] font-semibold text-[var(--text)]">{endpoint.label}</span>
                                      <span className="block truncate text-[10.5px] text-[var(--text-subtle)]" title={formatAbsolute(endpoint.latestCheck?.checkedAt)}>
                                        {endpoint.latestCheck ? `${humanise(endpoint.latestCheck.status)} · checked ${formatRelativeTime(endpoint.latestCheck.checkedAt).toLowerCase()}` : "Awaiting first check"}
                                      </span>
                                    </span>
                                    {endpoint.latestCheck?.responseTimeMs != null ? (
                                      <span className="shrink-0 rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-[var(--text-muted)]">{endpoint.latestCheck.responseTimeMs} ms</span>
                                    ) : null}
                                    <ChevronDown size={14} className={cx("shrink-0 text-[var(--text-subtle)] transition-transform", historyOpen && "rotate-180")} />
                                  </button>
                                  <AnimatePresence initial={false}>
                                    {historyOpen ? (
                                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_40%,transparent)]">
                                        <div className="px-3.5 py-3">
                                          <EndpointHistoryPanel endpointId={endpoint.id} />
                                        </div>
                                      </motion.div>
                                    ) : null}
                                  </AnimatePresence>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {system.clientId ? (
                          <button type="button" onClick={() => setLinkOpen(true)} className={cx(FOCUS, "mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] py-2.5 text-[11.5px] font-semibold text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]")}>
                            <Link2 size={13} />
                            Link an endpoint from Client Health
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {tab === "deployments" ? (
                      !system.projectId ? (
                        <EmptyNote icon={Rocket} title="Not linked to a project" body="Link this system to a project to see its deployment history." />
                      ) : system.deployments.length === 0 ? (
                        <EmptyNote icon={Rocket} title="No deployments yet" body="Deployments recorded against the project show up here." />
                      ) : (
                        <ol className="relative space-y-1 pl-5 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-[var(--line)]">
                          {system.deployments.map((deployment) => {
                            const tone = statusTone(deployment.status);
                            return (
                              <li key={deployment.id} className="relative rounded-xl px-3 py-2.5 transition-colors hover:bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)]">
                                <span className="absolute -left-5 top-[15px] h-[11px] w-[11px] rounded-full border-2 border-[var(--surface)]" style={{ backgroundColor: TONE_COLOUR[tone] }} />
                                <div className="flex items-center justify-between gap-3">
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{deployment.environment ?? "Unknown"}</span>
                                    <span className="flex min-w-0 items-center gap-1 truncate text-[12px] font-medium text-[var(--text)]">
                                      <GitBranch size={11} className="shrink-0 text-[var(--text-subtle)]" />
                                      <span className="truncate">{deployment.branch ?? "No branch"}</span>
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-[10.5px] text-[var(--text-subtle)]" title={formatAbsolute(deployment.createdAt)}>
                                    {formatRelativeTime(deployment.createdAt)}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[10.5px]">
                                  <span className="font-semibold" style={{ color: TONE_COLOUR[tone] }}>{humanise(deployment.status)}</span>
                                  {deployment.commitHash ? <code className="rounded bg-[var(--surface-muted)] px-1 py-px font-mono text-[10px] text-[var(--text-muted)]">{deployment.commitHash.slice(0, 7)}</code> : null}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )
                    ) : null}

                    {tab === "incidents" ? (
                      !system.projectId ? (
                        <EmptyNote icon={ShieldAlert} title="Not linked to a project" body="Link this system to a project to see related incidents." />
                      ) : system.incidents.length === 0 ? (
                        <EmptyNote icon={CheckCircle2} title="No incidents" body="Nothing has been raised against this system." tone="good" />
                      ) : (
                        <ul className="space-y-2">
                          {[...system.incidents].sort((a, b) => Number(a.resolved) - Number(b.resolved)).map((incident) => (
                            <li key={incident.id} className={cx("flex items-center gap-3 rounded-xl border px-3.5 py-3", incident.resolved ? "border-[var(--line)]" : "border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_4%,transparent)]")}>
                              <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", incident.resolved ? "bg-[var(--surface-muted)] text-[var(--success)]" : "bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)]")}>
                                {incident.resolved ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
                              </span>
                              <span className={cx("min-w-0 flex-1 truncate text-[12px] font-medium", incident.resolved ? "text-[var(--text-muted)]" : "text-[var(--text)]")}>{incident.title}</span>
                              <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", incident.resolved ? "bg-[var(--surface-muted)] text-[var(--text-muted)]" : "bg-[var(--danger)] text-white")}>{incident.resolved ? "Resolved" : "Open"}</span>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {system ? (
          <div className="border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_50%,transparent)] px-6 py-3.5">
            <AnimatePresence mode="wait" initial={false}>
              {confirming ? (
                <motion.div key="confirm" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="space-y-2.5">
                  <p className="text-[11.5px] leading-5 text-[var(--text)]">
                    Remove <span className="font-semibold">{system.name}</span> from the inventory? Its monitored endpoints, deployments and incidents stay where they are.
                  </p>
                  {deleteError ? <p className="text-[11px] font-medium text-[var(--danger)]">{deleteError}</p> : null}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setConfirming(false); setDeleteError(null); }} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
                      Keep it
                    </button>
                    <button type="button" disabled={busy} onClick={() => void handleDelete()} className={cx(FOCUS, "inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--danger)] px-3.5 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-60")}>
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      {deleteError ? "Try again" : "Remove system"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-between gap-3">
                  <button type="button" onClick={() => setConfirming(true)} className={cx(FOCUS, "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_6%,transparent)]")}>
                    <Trash2 size={13} />
                    Remove from inventory
                  </button>
                  <button type="button" onClick={() => reload(true)} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
                    <RefreshCw size={13} />
                    Refresh
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : null}
      </motion.aside>

      <AnimatePresence>
        {linkOpen && system ? (
          <LinkEndpointDialog
            key="link"
            systemId={system.id}
            clientId={system.clientId}
            linkedIds={system.monitoredEndpoints.map((endpoint) => endpoint.id)}
            onClose={() => setLinkOpen(false)}
            onLinked={(label) => {
              setLinkOpen(false);
              setTab("monitoring");
              onNotify(`${label} linked`);
              reload(true);
              onChanged();
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function LinkButton({ href, label, icon: Icon, primary }: { href: string; label: string; icon: LucideIcon; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard can be blocked; the link still works */
    }
  };
  return (
    <span className={cx("inline-flex h-9 items-stretch overflow-hidden rounded-xl border text-[11.5px]", primary ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--text)]")}>
      <a href={href} target="_blank" rel="noreferrer" title={href} className={cx(FOCUS, "flex items-center gap-1.5 pl-3 pr-2.5 font-semibold transition hover:opacity-85")}>
        <Icon size={13} />
        <span>{label}</span>
        <span className={cx("max-w-[150px] truncate font-normal", primary ? "opacity-75" : "text-[var(--text-subtle)]")}>{hostOf(href)}</span>
        <ArrowUpRight size={12} className="opacity-70" />
      </a>
      <button type="button" onClick={() => void copy()} aria-label={`Copy ${label} address`} title="Copy address" className={cx(FOCUS, "flex w-8 items-center justify-center border-l transition", primary ? "border-white/20 hover:bg-white/10" : "border-[var(--line)] text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]")}>
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </span>
  );
}

function EmptyNote({ icon: Icon, title, body, tone }: { icon: LucideIcon; title: string; body: string; tone?: "good" }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--line)] px-4 py-5">
      <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone === "good" ? "bg-emerald-500/10 text-emerald-600" : "bg-[var(--surface-muted)] text-[var(--text-subtle)]")}>
        <Icon size={15} />
      </span>
      <span>
        <span className="block text-[12px] font-semibold text-[var(--text)]">{title}</span>
        <span className="mt-0.5 block text-[11.5px] leading-5 text-[var(--text-muted)]">{body}</span>
      </span>
    </div>
  );
}

/* ============================================================================
   LINK EXISTING ENDPOINT DIALOG
============================================================================ */

type ExistingEndpoint = { id: string; label: string; url: string };

function LinkEndpointDialog({ systemId, clientId, linkedIds, onClose, onLinked }: { systemId: string; clientId: string | null; linkedIds: string[]; onClose: () => void; onLinked: (label: string) => void }) {
  const [endpoints, setEndpoints] = useState<ExistingEndpoint[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/admin/client-health/endpoints?clientId=${encodeURIComponent(clientId)}`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this client's endpoints.");
        return response.json();
      })
      .then((payload) => setEndpoints(Array.isArray(payload?.endpoints) ? payload.endpoints : []))
      .catch((caught) => {
        setLoadError(caught instanceof Error ? caught.message : "Could not load this client's endpoints.");
        setEndpoints([]);
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  const linked = useMemo(() => new Set(linkedIds), [linkedIds]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = endpoints ?? [];
    return (needle ? list.filter((endpoint) => `${endpoint.label} ${endpoint.url}`.toLowerCase().includes(needle)) : list).sort((a, b) => Number(linked.has(a.id)) - Number(linked.has(b.id)));
  }, [endpoints, query, linked]);
  const available = (endpoints ?? []).filter((endpoint) => !linked.has(endpoint.id)).length;
  const selected = endpoints?.find((endpoint) => endpoint.id === selectedId) ?? null;

  const submit = async () => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await linkEndpointToSystemApi(systemId, selectedId);
      onLinked(selected?.label ?? "Endpoint");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not link this endpoint.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell label="Link a monitored endpoint" onClose={onClose} width={480} z={340}>
      <div className="flex items-start gap-3.5 border-b border-[var(--line)] px-6 pb-4 pt-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]">
          <Link2 size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">Link a monitored endpoint</h3>
          <p className="mt-0.5 text-[11.5px] leading-5 text-[var(--text-muted)]">Pick one already set up for this client in Client Health. This does not create a new monitored address.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className={cx(FOCUS, "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]")}>
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-[58px] animate-pulse rounded-xl bg-[var(--surface-muted)]" />
            ))}
          </div>
        ) : loadError ? (
          <EmptyNote icon={AlertTriangle} title="Endpoints could not be loaded" body={loadError} />
        ) : !endpoints || endpoints.length === 0 ? (
          <EmptyNote icon={Activity} title="No endpoints for this client yet" body="Add one in Client Health first, then come back to link it." />
        ) : (
          <>
            {endpoints.length > 5 ? (
              <label className="relative mb-3 flex items-center">
                <Search size={13} className="pointer-events-none absolute left-3 text-[var(--text-subtle)]" />
                <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter endpoints" className={cx(INPUT, "border-[var(--line)] bg-[var(--surface-muted)] pl-8 focus:bg-[var(--surface)]")} />
              </label>
            ) : null}
            <div role="radiogroup" aria-label="Endpoints" className="space-y-2">
              {filtered.map((endpoint) => {
                const isLinked = linked.has(endpoint.id);
                const active = selectedId === endpoint.id;
                return (
                  <button
                    key={endpoint.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={isLinked}
                    onClick={() => setSelectedId(endpoint.id)}
                    onDoubleClick={() => {
                      setSelectedId(endpoint.id);
                      void submit();
                    }}
                    className={cx(
                      FOCUS,
                      "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55",
                      active ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]" : "border-[var(--line)] enabled:hover:bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)]",
                    )}
                  >
                    <span className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2", active ? "border-[var(--accent)]" : "border-[var(--line)]")}>
                      {active ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-[var(--text)]">{endpoint.label}</span>
                      <span className="block truncate font-mono text-[10.5px] text-[var(--text-subtle)]">{endpoint.url}</span>
                    </span>
                    {isLinked ? <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">Already linked</span> : null}
                  </button>
                );
              })}
              {filtered.length === 0 ? <p className="py-6 text-center text-[11.5px] text-[var(--text-subtle)]">Nothing matches</p> : null}
            </div>
          </>
        )}
      </div>

      {error ? <p className="flex items-center gap-2 border-t border-[color-mix(in_srgb,var(--danger)_20%,transparent)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] px-6 py-2.5 text-[11.5px] font-medium text-[var(--danger)]"><AlertTriangle size={13} />{error}</p> : null}

      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_50%,transparent)] px-6 py-4">
        <span className="text-[10.5px] text-[var(--text-subtle)]">{endpoints && endpoints.length ? `${plural(available, "endpoint")} available` : ""}</span>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={cx(BTN_SECONDARY, FOCUS, "h-10")}>
            Cancel
          </button>
          <button type="button" disabled={submitting || !selectedId} onClick={() => void submit()} className={cx(BTN_PRIMARY, FOCUS, "h-10 min-w-[132px]")}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            {submitting ? "Linking" : "Link endpoint"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}