/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/refs */
"use client";

// Restaurant Platform: onboarding and platform level management for
// restaurants on the separate Restaurant Admin application. This never
// touches Restaurant Admin's Supabase project directly. Every call goes
// through this app's own /api/admin/restaurant-platform routes, which hold
// the signing credential server side and call Restaurant Admin's management
// API (lib/restaurant-platform/client.ts). Shares SystemsTab.tsx's look.

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
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Clock3,
  Copy,
  Globe2,
  ImagePlus,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Palette,
  PauseCircle,
  PlayCircle,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
  UtensilsCrossed,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

import useSWR from "swr";
import { CLIENTS_ENDPOINT, fetchClientsPayload } from "@/lib/clients/clientsApi";
import {
  createRestaurantApi,
  fetchModuleRegistry,
  fetchRestaurantDetail,
  fetchRestaurantsList,
  fetchThemeRegistry,
  issueOwnerInvitationApi,
  retryProvisioningApi,
  setDashboardThemeApi,
  setModuleEnabledApi,
  setRestaurantStatusApi,
  RestaurantPlatformApiError,
  type ModuleDefinition,
  type RemoteRestaurantStatus,
  type RestaurantDetail,
  type RestaurantListItem,
  type ThemeDefinition,
} from "@/lib/restaurant-platform/restaurantPlatformApi";
import {
  deleteRestaurantAsset,
  uploadRestaurantAsset,
  MAX_RESTAURANT_COVER_MB,
  MAX_RESTAURANT_LOGO_MB,
  type RestaurantAssetKind,
} from "@/lib/restaurant-platform/uploadRestaurantAsset";

/* ============================================================================
   STYLE
   Same tokens as SystemsTab.tsx and ClientHealthTab.tsx.
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

type Tone = { label: string; colour: string; bg: string; Icon: LucideIcon };

const STATUS_META: Record<RemoteRestaurantStatus, Tone & { hint: string }> = {
  ACTIVE: { label: "Active", hint: "Staff and guests can use it", colour: "#059669", bg: "rgba(5,150,105,0.1)", Icon: PlayCircle },
  SUSPENDED: { label: "Suspended", hint: "Paused until you reactivate it", colour: "#d97706", bg: "rgba(217,119,6,0.1)", Icon: PauseCircle },
  ARCHIVED: { label: "Archived", hint: "Taken off the platform", colour: "#6b7280", bg: "rgba(107,114,128,0.1)", Icon: Archive },
};

type StateKey = "active" | "suspended" | "archived" | "failed" | "pending";

function stateOf(item: Pick<RestaurantListItem, "provisioningState" | "remoteStatus">): StateKey {
  if (item.provisioningState === "PROVISIONED" && item.remoteStatus) {
    return item.remoteStatus === "ACTIVE" ? "active" : item.remoteStatus === "SUSPENDED" ? "suspended" : "archived";
  }
  return item.provisioningState === "FAILED" ? "failed" : "pending";
}

function provisioningBadge(item: Pick<RestaurantListItem, "provisioningState" | "remoteStatus">): Tone {
  if (item.provisioningState === "PROVISIONED" && item.remoteStatus) return STATUS_META[item.remoteStatus];
  if (item.provisioningState === "FAILED") return { label: "Provisioning failed", colour: "#dc2626", bg: "rgba(220,38,38,0.1)", Icon: AlertTriangle };
  return { label: "Pending onboarding", colour: "#6b7280", bg: "rgba(107,114,128,0.1)", Icon: Clock };
}

const ATTENTION_RANK: Record<StateKey, number> = { failed: 0, pending: 1, suspended: 2, active: 3, archived: 4 };

/* Countries most of our restaurants are in. Picking one fills in currency and
   timezone unless you have already chosen them. Anything else can be typed. */
const COUNTRIES: Array<{ name: string; code: string; currency: string; timezone: string }> = [
  { name: "Nigeria", code: "NG", currency: "NGN", timezone: "Africa/Lagos" },
  { name: "United Kingdom", code: "GB", currency: "GBP", timezone: "Europe/London" },
  { name: "Ghana", code: "GH", currency: "GHS", timezone: "Africa/Accra" },
  { name: "Kenya", code: "KE", currency: "KES", timezone: "Africa/Nairobi" },
  { name: "South Africa", code: "ZA", currency: "ZAR", timezone: "Africa/Johannesburg" },
  { name: "United States", code: "US", currency: "USD", timezone: "America/New_York" },
  { name: "Canada", code: "CA", currency: "CAD", timezone: "America/Toronto" },
  { name: "Ireland", code: "IE", currency: "EUR", timezone: "Europe/Dublin" },
  { name: "France", code: "FR", currency: "EUR", timezone: "Europe/Paris" },
  { name: "Germany", code: "DE", currency: "EUR", timezone: "Europe/Berlin" },
  { name: "Spain", code: "ES", currency: "EUR", timezone: "Europe/Madrid" },
  { name: "Italy", code: "IT", currency: "EUR", timezone: "Europe/Rome" },
  { name: "Netherlands", code: "NL", currency: "EUR", timezone: "Europe/Amsterdam" },
  { name: "Portugal", code: "PT", currency: "EUR", timezone: "Europe/Lisbon" },
  { name: "United Arab Emirates", code: "AE", currency: "AED", timezone: "Asia/Dubai" },
  { name: "Saudi Arabia", code: "SA", currency: "SAR", timezone: "Asia/Riyadh" },
  { name: "Qatar", code: "QA", currency: "QAR", timezone: "Asia/Qatar" },
  { name: "Egypt", code: "EG", currency: "EGP", timezone: "Africa/Cairo" },
  { name: "Morocco", code: "MA", currency: "MAD", timezone: "Africa/Casablanca" },
  { name: "Senegal", code: "SN", currency: "XOF", timezone: "Africa/Dakar" },
  { name: "Côte d'Ivoire", code: "CI", currency: "XOF", timezone: "Africa/Abidjan" },
  { name: "Cameroon", code: "CM", currency: "XAF", timezone: "Africa/Douala" },
  { name: "Rwanda", code: "RW", currency: "RWF", timezone: "Africa/Kigali" },
  { name: "Uganda", code: "UG", currency: "UGX", timezone: "Africa/Kampala" },
  { name: "Tanzania", code: "TZ", currency: "TZS", timezone: "Africa/Dar_es_Salaam" },
  { name: "Ethiopia", code: "ET", currency: "ETB", timezone: "Africa/Addis_Ababa" },
  { name: "Turkey", code: "TR", currency: "TRY", timezone: "Europe/Istanbul" },
  { name: "India", code: "IN", currency: "INR", timezone: "Asia/Kolkata" },
  { name: "Pakistan", code: "PK", currency: "PKR", timezone: "Asia/Karachi" },
  { name: "Australia", code: "AU", currency: "AUD", timezone: "Australia/Sydney" },
];

const CURRENCIES: Array<{ code: string; name: string }> = [
  { code: "NGN", name: "Nigerian naira" }, { code: "GBP", name: "Pound sterling" }, { code: "USD", name: "US dollar" }, { code: "EUR", name: "Euro" },
  { code: "GHS", name: "Ghanaian cedi" }, { code: "KES", name: "Kenyan shilling" }, { code: "ZAR", name: "South African rand" }, { code: "CAD", name: "Canadian dollar" },
  { code: "AED", name: "UAE dirham" }, { code: "SAR", name: "Saudi riyal" }, { code: "QAR", name: "Qatari riyal" }, { code: "EGP", name: "Egyptian pound" },
  { code: "MAD", name: "Moroccan dirham" }, { code: "XOF", name: "West African CFA franc" }, { code: "XAF", name: "Central African CFA franc" }, { code: "RWF", name: "Rwandan franc" },
  { code: "UGX", name: "Ugandan shilling" }, { code: "TZS", name: "Tanzanian shilling" }, { code: "ETB", name: "Ethiopian birr" }, { code: "TRY", name: "Turkish lira" },
  { code: "INR", name: "Indian rupee" }, { code: "PKR", name: "Pakistani rupee" }, { code: "AUD", name: "Australian dollar" },
];

const FALLBACK_TIMEZONES = ["UTC", ...Array.from(new Set(COUNTRIES.map((country) => country.timezone)))];

function listTimezones(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone");
    if (supported?.length) return supported.includes("UTC") ? supported : ["UTC", ...supported];
  } catch {
    /* older browsers */
  }
  return FALLBACK_TIMEZONES;
}

function offsetLabel(timezone: string) {
  try {
    const part = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((item) => item.type === "timeZoneName");
    return part?.value.replace("GMT", "UTC") ?? "";
  } catch {
    return "";
  }
}

function localTime(timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date());
  } catch {
    return null;
  }
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function humaniseKey(key: string) {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function humanise(value: string) {
  return humaniseKey(value);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase() || "R";
}

const MARK_PALETTE = [
  ["#F97316", "#C2410C"], ["#E11D48", "#9F1239"], ["#0EA5E9", "#0369A1"], ["#10B981", "#047857"], ["#8B5CF6", "#6D28D9"], ["#EAB308", "#A16207"],
] as const;

function RestaurantMark({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  const [from, to] = MARK_PALETTE[hash % MARK_PALETTE.length];
  return (
    <span
      className={cx("relative flex shrink-0 items-center justify-center overflow-hidden font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]", size === "md" ? "h-12 w-12 rounded-2xl text-[14px]" : "h-10 w-10 rounded-xl text-[11.5px]")}
      style={{ background: `linear-gradient(140deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {initials(name)}
      <UtensilsCrossed size={size === "md" ? 30 : 24} className="absolute -bottom-2 -right-2 opacity-15" />
    </span>
  );
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function formatAbsolute(iso: string | null | undefined) {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function errorText(caught: unknown, fallback: string) {
  if (caught instanceof RestaurantPlatformApiError) return caught.message;
  if (caught instanceof Error && caught.message) return caught.message;
  return fallback;
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
type StateFilter = "all" | "active" | "suspended" | "onboarding";
type SortMode = "attention" | "newest" | "name";

export default function RestaurantPlatformTab() {
  const [items, setItems] = useState<RestaurantListItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [sort, setSort] = useState<SortMode>("attention");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const hasLoadedRef = useRef(false);

  const notify = useCallback((message: string) => setToast({ id: Date.now(), message }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = useCallback(() => {
    if (hasLoadedRef.current) setRefreshing(true);
    else setStatus("loading");
    setError(null);
    fetchRestaurantsList()
      .then((result) => {
        setItems(result);
        setStatus("ready");
        setLoadedAt(Date.now());
        hasLoadedRef.current = true;
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Could not load restaurants.");
        setStatus("error");
      })
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Shortcuts: / searches, N creates a restaurant. */
  const shortcutRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  shortcutRef.current = (event: KeyboardEvent) => {
    if (createOpen || detail || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
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
    const tally: Record<StateKey, number> = { active: 0, suspended: 0, archived: 0, failed: 0, pending: 0 };
    items.forEach((item) => {
      tally[stateOf(item)] += 1;
    });
    return { total: items.length, ...tally, onboarding: tally.failed + tally.pending };
  }, [items]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = items.filter((item) => {
      const state = stateOf(item);
      if (stateFilter === "active" && state !== "active") return false;
      if (stateFilter === "suspended" && state !== "suspended") return false;
      if (stateFilter === "onboarding" && state !== "failed" && state !== "pending") return false;
      if (!term) return true;
      return [item.name, item.externalSlug, item.client?.name, item.client?.displayName].filter(Boolean).join(" ").toLowerCase().includes(term);
    });
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return ATTENTION_RANK[stateOf(a)] - ATTENTION_RANK[stateOf(b)] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, search, stateFilter, sort]);

  const filtersActive = Boolean(search.trim()) || stateFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStateFilter("all");
  };

  const stats: Array<{ key: StateFilter; value: number; label: string; caption: string; danger?: boolean }> = [
    { key: "all", value: counts.total, label: "Restaurants", caption: counts.archived ? `${counts.archived} archived` : "On the platform" },
    { key: "active", value: counts.active, label: "Active", caption: "Taking orders" },
    { key: "suspended", value: counts.suspended, label: "Suspended", caption: counts.suspended ? "Paused for now" : "None paused" },
    { key: "onboarding", value: counts.onboarding, label: "Onboarding", caption: counts.failed ? `${counts.failed} failed, needs a retry` : "Waiting to go live", danger: counts.failed > 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">Client platforms</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.035em] text-[var(--text)]">Restaurant Platform</h1>
          <p className="mt-1.5 max-w-[620px] text-[12px] leading-5 text-[var(--text-muted)]">
            Onboard restaurants onto Restaurant Admin and manage their platform setup: status, modules and owner access. Menus, orders and staff stay in Restaurant Admin itself.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[10.5px] text-[var(--text-subtle)] sm:block">
            {refreshing ? "Refreshing" : loadedAt ? `Updated ${formatRelative(new Date(loadedAt).toISOString()).toLowerCase()}` : ""}
          </span>
          <button type="button" onClick={load} disabled={status === "loading" || refreshing} aria-label="Refresh" title="Refresh" className={cx(BTN_SECONDARY, FOCUS, "h-10 w-10 px-0")}>
            <RefreshCw size={14} className={status === "loading" || refreshing ? "animate-spin" : undefined} />
          </button>
          <button type="button" onClick={() => setCreateOpen(true)} className={cx(BTN_PRIMARY, FOCUS, "h-10 pl-3.5 pr-2.5")}>
            <Plus size={14} strokeWidth={2.2} />
            New restaurant
            <kbd className="ml-1 hidden h-5 min-w-5 items-center justify-center rounded-md bg-white/15 px-1.5 text-[9.5px] font-semibold sm:inline-flex">N</kbd>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const active = stateFilter === stat.key;
          return (
            <button
              key={stat.key}
              type="button"
              aria-pressed={active}
              onClick={() => setStateFilter((current) => (current === stat.key && stat.key !== "all" ? "all" : stat.key))}
              className={cx(
                CARD,
                FOCUS,
                "relative overflow-hidden p-4 text-left transition hover:-translate-y-0.5",
                active && "border-[color-mix(in_srgb,var(--accent)_60%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className={cx("text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums", stat.danger ? "text-[var(--danger)]" : "text-[var(--text)]")}>
                  {status === "loading" ? <span className="inline-block h-6 w-8 animate-pulse rounded-md bg-[var(--surface-muted)] align-middle" /> : stat.value}
                </span>
                {active && stat.key !== "all" ? <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--accent)]">Filter</span> : null}
              </span>
              <span className="mt-2.5 block text-[11.5px] font-semibold text-[var(--text)]">{stat.label}</span>
              <span className={cx("mt-0.5 block truncate text-[10.5px]", stat.danger ? "text-[var(--danger)]" : "text-[var(--text-muted)]")}>{stat.caption}</span>
              {stat.key === "all" && counts.total > 0 ? <StatusBar counts={counts} /> : null}
            </button>
          );
        })}
      </div>

      <div className={cx(CARD, "overflow-hidden")}>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] p-3 sm:p-4">
          <label className="relative flex h-10 min-w-[220px] flex-1 items-center">
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
              placeholder="Search by restaurant, slug or client"
              aria-label="Search restaurants"
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
            value={stateFilter}
            onChange={(value) => setStateFilter(value as StateFilter)}
            width={188}
            options={[
              { value: "all", label: "Every status" },
              { value: "active", label: "Active", dot: STATUS_META.ACTIVE.colour },
              { value: "suspended", label: "Suspended", dot: STATUS_META.SUSPENDED.colour },
              { value: "onboarding", label: "Onboarding", hint: "Pending or failed", dot: "#9ca3af" },
            ]}
          />
          <Dropdown
            value={sort}
            onChange={(value) => setSort(value as SortMode)}
            width={200}
            prefix="Sort"
            options={[
              { value: "attention", label: "Needs attention first" },
              { value: "newest", label: "Newest first" },
              { value: "name", label: "Name, A to Z" },
            ]}
          />
        </div>

        <AnimatePresence initial={false}>
          {filtersActive && status === "ready" ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_50%,transparent)] px-4 py-2 text-[10.5px] text-[var(--text-muted)]">
                <span>
                  Showing <span className="font-semibold text-[var(--text)]">{visible.length}</span> of {plural(items.length, "restaurant")}
                </span>
                {search.trim() ? <FilterChip label={`"${search.trim()}"`} onRemove={() => setSearch("")} /> : null}
                {stateFilter !== "all" ? <FilterChip label={humanise(stateFilter)} onRemove={() => setStateFilter("all")} /> : null}
                <button type="button" onClick={clearFilters} className={cx(FOCUS, "ml-1 rounded-md px-1.5 py-0.5 font-semibold text-[var(--accent)] hover:bg-[var(--surface)]")}>
                  Clear all
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className={cx("transition-opacity", refreshing && "opacity-60")}>
          {status === "loading" ? (
            <div aria-busy="true">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3.5 last:border-0">
                  <span className="h-10 w-10 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                  <span className="flex-1 space-y-1.5">
                    <span className="block h-3 w-40 animate-pulse rounded bg-[var(--surface-muted)]" />
                    <span className="block h-2.5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
                  </span>
                  <span className="h-5 w-24 animate-pulse rounded-full bg-[var(--surface-muted)]" />
                </div>
              ))}
            </div>
          ) : null}

          {status === "error" ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)]">
                <AlertTriangle size={18} />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[var(--text)]">Restaurants could not be loaded</p>
                <p className="mt-1 max-w-[380px] text-[11.5px] text-[var(--text-muted)]">{error}</p>
              </div>
              <button type="button" onClick={load} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
                <RefreshCw size={13} />
                Try again
              </button>
            </div>
          ) : null}

          {status === "ready" && items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(140deg,#F97316,#C2410C)] text-white shadow-[0_18px_40px_-20px_#C2410C]">
                <UtensilsCrossed size={22} />
              </span>
              <p className="mt-5 text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)]">Onboard your first restaurant</p>
              <p className="mx-auto mt-1.5 max-w-[420px] text-[12px] leading-5 text-[var(--text-muted)]">
                Create it here and it is set up on Restaurant Admin for you. You get a one time link to send the owner so they can activate their account.
              </p>
              <button type="button" onClick={() => setCreateOpen(true)} className={cx(BTN_PRIMARY, FOCUS, "mt-5 h-10 px-4")}>
                <Plus size={14} />
                New restaurant
              </button>
            </div>
          ) : null}

          {status === "ready" && items.length > 0 && visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-subtle)]">
                <Search size={18} />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[var(--text)]">Nothing matches</p>
                <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">Try a different search, or clear the filters to see every restaurant.</p>
              </div>
              <button type="button" onClick={clearFilters} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
                Clear filters
              </button>
            </div>
          ) : null}

          {status === "ready" && visible.length > 0 ? (
            <div>
              <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_24px] gap-4 border-b border-[var(--line)] px-5 py-2.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)] md:grid">
                <span>Restaurant</span>
                <span>Client</span>
                <span>Status</span>
                <span>Created</span>
                <span />
              </div>
              {visible.map((item, index) => {
                const badge = provisioningBadge(item);
                const state = stateOf(item);
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => setDetail({ id: item.id, name: item.name })}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(index, 12) * 0.02 }}
                    className={cx(
                      FOCUS,
                      "group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--line)] px-5 py-3 text-left transition-colors last:border-0 hover:bg-[color-mix(in_srgb,var(--surface-muted)_70%,transparent)] md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_24px]",
                      state === "archived" && "opacity-70",
                    )}
                  >
                    {state === "failed" ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[#dc2626]" /> : null}
                    <span className="flex min-w-0 items-center gap-3">
                      <RestaurantMark name={item.name} />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold text-[var(--text)]">{item.name}</span>
                        <span className="block truncate font-mono text-[10.5px] text-[var(--text-subtle)]">{item.externalSlug ?? "Slug assigned on provisioning"}</span>
                      </span>
                    </span>
                    <span className="hidden min-w-0 items-center gap-1.5 text-[11.5px] text-[var(--text-muted)] md:flex">
                      {item.client ? <Building2 size={12} className="shrink-0 text-[var(--text-subtle)]" /> : null}
                      <span className="truncate">{item.client?.displayName || item.client?.name || "No linked client"}</span>
                    </span>
                    <span className="justify-self-end md:justify-self-start">
                      <Pill tone={badge} />
                    </span>
                    <span className="hidden text-[11px] text-[var(--text-muted)] md:block" title={formatAbsolute(item.createdAt)}>
                      {formatRelative(item.createdAt)}
                    </span>
                    <ChevronRight size={14} className="hidden text-[var(--text-subtle)] transition-transform group-hover:translate-x-0.5 md:block" />
                  </motion.button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <Portal>
        <AnimatePresence>
          {createOpen ? (
            <CreateRestaurantDialog
              key="create"
              onClose={() => setCreateOpen(false)}
              onCreated={(name) => {
                setCreateOpen(false);
                notify(`${name} is on the platform`);
                load();
              }}
            />
          ) : null}
          {detail ? (
            <RestaurantDetailPanel key="detail" managedSystemId={detail.id} fallbackName={detail.name} onClose={() => setDetail(null)} onChanged={load} onNotify={notify} />
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
   SMALL PIECES
============================================================================ */

function StatusBar({ counts }: { counts: Record<StateKey, number> & { total: number } }) {
  const segments: Array<[StateKey, string]> = [
    ["active", "#059669"],
    ["suspended", "#d97706"],
    ["pending", "#9ca3af"],
    ["failed", "#dc2626"],
    ["archived", "#d4d4d8"],
  ];
  return (
    <span className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-hidden="true">
      {segments.map(([key, colour]) => (counts[key] ? <span key={key} style={{ width: `${(counts[key] / counts.total) * 100}%`, backgroundColor: colour }} /> : null))}
    </span>
  );
}

function Pill({ tone }: { tone: Tone }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: tone.colour, backgroundColor: tone.bg }}>
      <tone.Icon size={10} className="shrink-0" />
      <span className="truncate">{tone.label}</span>
    </span>
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

function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">{children}</span>
      {aside}
    </div>
  );
}

function InlineError({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] px-3 py-2.5 text-[11.5px] font-medium text-[var(--danger)]">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span className="flex-1">{message}</span>
            {onDismiss ? (
              <button type="button" onClick={onDismiss} aria-label="Dismiss" className={cx(FOCUS, "rounded p-0.5 opacity-70 hover:opacity-100")}>
                <X size={12} />
              </button>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** A one time link: big, copyable and impossible to miss that it is shown once. */
function OneTimeLink({ link, email, restaurant, copied, onCopied }: { link: string; email?: string; restaurant: string; copied: boolean; onCopied: () => void }) {
  const [justCopied, setJustCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      inputRef.current?.select();
      document.execCommand?.("copy");
    }
    setJustCopied(true);
    onCopied();
    window.setTimeout(() => setJustCopied(false), 1600);
  };
  const subject = encodeURIComponent(`Activate ${restaurant} on Restaurant Admin`);
  const body = encodeURIComponent(`Hello,\n\nYour restaurant ${restaurant} is ready on Restaurant Admin. Use this link to activate your owner account:\n\n${link}\n\nThe link works once. If it expires, reply and we will send a new one.\n`);
  return (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] p-3.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text)]">
        <KeyRound size={13} className="text-[var(--accent)]" />
        Owner activation link
        <span className="ml-auto rounded-full bg-[var(--surface)] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Shown once</span>
      </div>
      <div className="mt-2.5 flex items-stretch overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <input ref={inputRef} readOnly value={link} onFocus={(event) => event.currentTarget.select()} aria-label="Activation link" className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[11px] text-[var(--text)] outline-none" />
        <button type="button" onClick={() => void copy()} className={cx(FOCUS, "flex shrink-0 items-center gap-1.5 border-l border-[var(--line)] px-3 text-[11px] font-semibold transition", justCopied ? "text-emerald-600" : "text-[var(--text)] hover:bg-[var(--surface-muted)]")}>
          {justCopied ? <Check size={13} /> : <Copy size={13} />}
          {justCopied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className={cx("text-[10.5px]", copied ? "text-emerald-700" : "text-[var(--text-muted)]")}>
          {copied ? "Copied. Send it to the owner, it cannot be shown again." : "Copy it now. It cannot be retrieved later, only reissued."}
        </span>
        {email ? (
          <a href={`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`} onClick={onCopied} className={cx(FOCUS, "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--surface)]")}>
            <Mail size={12} />
            Email it to {email}
          </a>
        ) : null}
      </div>
    </div>
  );
}

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
  allowCustom,
  icon,
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
  /** Offer whatever was typed as a value when nothing in the list matches. */
  allowCustom?: boolean;
  /** Shown before the label when the chosen option has no icon of its own. */
  icon?: ReactNode;
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
  const selected = options.find((option) => option.value === value) ?? (allowCustom && value ? { value, label: value } : null);
  const canSearch = searchable ?? options.length > 7;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle ? options.filter((option) => `${option.label} ${option.hint ?? ""} ${option.keywords ?? ""}`.toLowerCase().includes(needle)) : options;
    const exact = matches.some((option) => option.value.toLowerCase() === needle || option.label.toLowerCase() === needle);
    if (allowCustom && needle && !exact) return [...matches, { value: query.trim(), label: `Use "${query.trim()}"`, hint: "Not in the list" }];
    return matches;
  }, [options, query, allowCustom]);

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
        {selected?.icon ? <span className="flex shrink-0 text-[var(--text-muted)]">{selected.icon}</span> : icon && !selected?.dot ? <span className="flex shrink-0 text-[var(--text-subtle)]">{icon}</span> : null}
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
   CREATE DIALOG
============================================================================ */

type ClientOption = { id: string; name: string; displayName: string | null };

/* ============================================================================
   BRANDING HELPERS
============================================================================ */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** WCAG relative-luminance contrast ratio of a hex color against white
 *  (#FFFFFF) text — used to warn (not block) when a brand color would make
 *  white nav/button text hard to read. Returns null for an invalid hex. */
function contrastAgainstWhite(hex: string): number | null {
  if (!HEX_RE.test(hex)) return null;
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return (1.0 + 0.05) / (luminance + 0.05);
}

type AssetValue = { url: string; publicId: string } | null;

/** Logo/cover upload slot used by the Branding step — upload now, delete on
 *  replace/remove, same abandoned-upload lifecycle as uploadClientLogo.ts. */
function AssetUploadSlot({
  kind,
  label,
  hint,
  maxMb,
  shape,
  value,
  onChange,
}: {
  kind: RestaurantAssetKind;
  label: string;
  hint: string;
  maxMb: number;
  shape: "square" | "wide";
  value: AssetValue;
  onChange: (next: AssetValue) => void;
}) {
  const inputId = useId();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    setProgress(0);
    const previous = value;
    try {
      const uploaded = await uploadRestaurantAsset(file, kind, setProgress);
      onChange(uploaded);
      if (previous) void deleteRestaurantAsset(previous.publicId);
    } catch (caught) {
      setError(errorText(caught, "Upload failed."));
    } finally {
      setProgress(null);
    }
  };

  const remove = () => {
    if (value) void deleteRestaurantAsset(value.publicId);
    onChange(null);
    setError(null);
  };

  return (
    <div>
      <SectionLabel aside={<span className="text-[10px] text-[var(--text-subtle)]">PNG, JPEG or WebP · up to {maxMb}MB</span>}>{label}</SectionLabel>
      <div
        className={cx(
          "relative flex items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)]",
          shape === "square" ? "h-24 w-24" : "h-28 w-full",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={18} className="text-[var(--text-subtle)]" />
        )}

        {progress !== null ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]">
            <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
            <span className="text-[10px] font-medium text-[var(--text-muted)]">{progress}%</span>
          </div>
        ) : null}

        {!value && progress === null ? (
          <label htmlFor={inputId} className={cx(FOCUS, "absolute inset-0 cursor-pointer")}>
            <span className="sr-only">Upload {label.toLowerCase()}</span>
          </label>
        ) : null}

        {value && progress === null ? (
          <button
            type="button"
            onClick={remove}
            aria-label={`Remove ${label.toLowerCase()}`}
            className={cx(FOCUS, "absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--surface)]/90 text-[var(--text-subtle)] shadow-sm hover:text-[var(--danger)]")}
          >
            <Trash2 size={12} />
          </button>
        ) : null}

        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {!value && progress === null ? (
        <label htmlFor={inputId} className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[10.5px] font-medium text-[var(--accent)] hover:underline">
          Choose a file
        </label>
      ) : null}
      <p className="mt-1 text-[10px] text-[var(--text-subtle)]">{hint}</p>
      {error ? <p className="mt-1 text-[10.5px] font-medium text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

/* ============================================================================
   THEME PREVIEW CARD

   A compact mockup built from the theme's real tokens, not a swatch of
   flat color chips — this is what "visually distinctive, not just a
   different accent color" needs to actually be visible at selection
   time. accentColor (the restaurant's own primary brand color, from the
   Branding step) renders into the mockup's active-nav bar exactly the
   way DashboardShell layers brand colors on top of a theme for real, so
   the preview matches what the restaurant will actually look like.
============================================================================ */
function ThemePreviewCard({
  theme,
  selected,
  accentColor,
  onSelect,
}: {
  theme: ThemeDefinition;
  selected: boolean;
  accentColor?: string;
  onSelect: () => void;
}) {
  const t = theme.tokens;
  const accent = accentColor ?? (theme.isDark ? "#E5E7EB" : "#111827");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        FOCUS,
        "flex flex-col overflow-hidden rounded-2xl border text-left transition",
        selected ? "border-[var(--accent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]" : "border-[var(--line)] hover:border-[var(--line-strong)]"
      )}
    >
      <div className="relative flex h-24 w-full" style={{ backgroundColor: t["--dash-canvas"] }}>
        <div className="flex w-[34%] shrink-0 flex-col gap-1.5 border-r p-2" style={{ backgroundColor: t["--dash-sidebar-bg"], borderColor: t["--dash-sidebar-border"] }}>
          <div className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: accent }} />
          <div className="h-1.5 w-1/2 rounded-full opacity-60" style={{ backgroundColor: t["--dash-sidebar-text-muted"] }} />
          <div className="h-1.5 w-1/2 rounded-full opacity-60" style={{ backgroundColor: t["--dash-sidebar-text-muted"] }} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
          <div
            className="h-5 w-full shrink-0 rounded"
            style={{ backgroundColor: t["--dash-surface"], border: `1px solid ${t["--dash-border"]}`, borderRadius: t["--dash-radius-sm"] }}
          />
          <div className="flex flex-1 gap-1.5">
            <div className="flex-1 rounded" style={{ backgroundColor: t["--dash-card-bg"], border: `1px solid ${t["--dash-card-border"]}`, borderRadius: t["--dash-radius-sm"] }} />
            <div className="flex-1 rounded" style={{ backgroundColor: t["--dash-card-bg"], border: `1px solid ${t["--dash-card-border"]}`, borderRadius: t["--dash-radius-sm"] }} />
          </div>
        </div>
        {selected ? (
          <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-sm">
            <Check size={11} strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <p className="text-[12px] font-semibold text-[var(--text)]">{theme.label}</p>
        <p className="mt-0.5 text-[10.5px] leading-4 text-[var(--text-muted)]">{theme.description}</p>
        <p className="mt-1.5 text-[9.5px] font-medium uppercase tracking-wider text-[var(--text-subtle)]">{theme.suitedFor}</p>
      </div>
    </button>
  );
}

function CreateRestaurantDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const reduce = useReducedMotion();
  const ownerId = useId();
  const { data: clientsPayload, isLoading: clientsLoading } = useSWR(CLIENTS_ENDPOINT, fetchClientsPayload, { dedupingInterval: 60_000 });
  const clients = useMemo(() => (clientsPayload?.clients ?? []) as unknown as ClientOption[], [clientsPayload]);
  const timezones = useMemo(() => listTimezones(), []);

  const detectedTimezone = useMemo(() => browserTimezone(), []);
  const detectedCountry = COUNTRIES.find((item) => item.timezone === detectedTimezone) ?? null;

  const [isNewClient, setIsNewClient] = useState(true);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [country, setCountry] = useState(detectedCountry?.name ?? "");
  const [city, setCity] = useState("");
  const [currency, setCurrency] = useState(detectedCountry?.currency ?? "USD");
  const [timezone, setTimezone] = useState(detectedCountry ? detectedCountry.timezone : detectedTimezone || "UTC");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [timezoneTouched, setTimezoneTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ inviteLink: string | null; name: string; email: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [logo, setLogo] = useState<AssetValue>(null);
  const [cover, setCover] = useState<AssetValue>(null);
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [dashboardTheme, setDashboardTheme] = useState<string | null>(null);
  const [disabledModuleKeys, setDisabledModuleKeys] = useState<Set<string>>(new Set());

  const { data: moduleRegistry, isLoading: modulesLoading } = useSWR("restaurant-platform-modules", fetchModuleRegistry, { dedupingInterval: 60_000, revalidateOnFocus: false });
  const optionalModules = useMemo(() => (moduleRegistry ?? []).filter((m) => m.optional), [moduleRegistry]);
  const mandatoryModules = useMemo(() => (moduleRegistry ?? []).filter((m) => !m.optional), [moduleRegistry]);

  const { data: themeRegistry, isLoading: themesLoading } = useSWR("restaurant-platform-themes", fetchThemeRegistry, { dedupingInterval: 60_000, revalidateOnFocus: false });
  // Default to 'contemporary' once the registry loads — matches every
  // existing restaurant's actual appearance, so a restaurant created
  // without deliberately picking a theme still gets the familiar look.
  useEffect(() => {
    if (!dashboardTheme && themeRegistry && themeRegistry.length > 0) {
      const defaultTheme = themeRegistry.find((t) => t.id === "contemporary") ?? themeRegistry[0];
      setDashboardTheme(defaultTheme.id);
    }
  }, [themeRegistry, dashboardTheme]);

  const colorProblems = {
    primaryColor: primaryColor && !HEX_RE.test(primaryColor) ? "Use a 6-digit hex color, e.g. #1A2B3C." : null,
    secondaryColor: secondaryColor && !HEX_RE.test(secondaryColor) ? "Use a 6-digit hex color, e.g. #1A2B3C." : null,
  };
  const primaryContrast = primaryColor ? contrastAgainstWhite(primaryColor) : null;

  const STEPS: { label: string; hint: string }[] = [
    { label: "Details", hint: "Name, owner, locale" },
    { label: "Branding", hint: "Logo, cover, colors" },
    { label: "Dashboard Theme", hint: "Visual identity" },
    { label: "Modules", hint: "What the owner sees" },
  ];

  // The footer's primary button changes role (Next -> Create restaurant) in
  // the exact same screen position when step reaches 2. A fast click (and,
  // on a slow render, even an ordinary one) can land its mousedown on
  // "Next" and have React already swapped in "Create restaurant" by the
  // time the corresponding mouseup/click is dispatched at that same
  // coordinate, submitting the form from a click the user aimed at "Next".
  // stepChangedAtRef lets submit() refuse to run for a brief moment after
  // any step change, which absorbs that race without being noticeable to a
  // real deliberate click (which always comes well after 300ms).
  const stepChangedAtRef = useRef(0);
  useEffect(() => {
    stepChangedAtRef.current = Date.now();
  }, [step]);

  const goNext = () => {
    if (step === 0) {
      setAttempted(true);
      if (blocking) return;
    }
    setStep((current) => (current < 3 ? ((current + 1) as 0 | 1 | 2 | 3) : current));
  };
  const goBack = () => setStep((current) => (current > 0 ? ((current - 1) as 0 | 1 | 2 | 3) : current));
  const goToStep = (target: 0 | 1 | 2 | 3) => {
    if (target > step && step === 0) {
      setAttempted(true);
      if (blocking) return;
    }
    setStep(target);
  };

  const pickCountry = (value: string) => {
    setCountry(value);
    const match = COUNTRIES.find((item) => item.name.toLowerCase() === value.toLowerCase());
    if (match) {
      if (!currencyTouched) setCurrency(match.currency);
      if (!timezoneTouched) setTimezone(match.timezone);
    }
  };

  const problems = {
    name: name.trim().length < 2 ? "Give the restaurant a name." : null,
    ownerEmail: !ownerEmail.trim() ? "Add the owner's email so they can be invited." : !EMAIL_RE.test(ownerEmail.trim()) ? "That email does not look right." : null,
    currency: !/^[A-Za-z]{3}$/.test(currency.trim()) ? "Use a three letter currency code, like NGN." : null,
    client: !isNewClient && !clientId ? "Choose the client this restaurant belongs to." : null,
  };
  const blocking = Object.values(problems).some(Boolean);
  const dirty = Boolean(name || ownerEmail || city || logo || cover || primaryColor || secondaryColor);

  const discardUploadedAssets = () => {
    if (logo) void deleteRestaurantAsset(logo.publicId);
    if (cover) void deleteRestaurantAsset(cover.publicId);
  };

  const requestClose = () => {
    if (success) {
      if (success.inviteLink && !linkCopied) setConfirmClose(true);
      else onCreated(success.name);
      return;
    }
    if (dirty && !submitting) setConfirmClose(true);
    else onClose();
  };

  const submit = async () => {
    if (Date.now() - stepChangedAtRef.current < 300) return;
    setAttempted(true);
    if (blocking || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // disabledModuleKeys is sent as part of the SAME create call and
      // applied inside Restaurant Admin's provision_restaurant() RPC, in
      // the same transaction as the restaurant row itself — not a
      // separate call afterward. There is no "restaurant created but
      // modules half-applied" state to recover from: either the whole
      // create (including module selection) succeeds, or none of it does.
      const result = await createRestaurantApi({
        name: name.trim(),
        ownerEmail: ownerEmail.trim(),
        currency: currency.trim().toUpperCase(),
        timezone: timezone.trim(),
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        clientId: !isNewClient && clientId ? clientId : undefined,
        newClient: isNewClient ? { name: name.trim() } : undefined,
        logoUrl: logo?.url,
        coverImageUrl: cover?.url,
        primaryColor: HEX_RE.test(primaryColor) ? primaryColor : undefined,
        secondaryColor: HEX_RE.test(secondaryColor) ? secondaryColor : undefined,
        disabledModuleKeys: disabledModuleKeys.size > 0 ? Array.from(disabledModuleKeys) : undefined,
        dashboardTheme: dashboardTheme ?? undefined,
      });

      setSuccess({ inviteLink: result.inviteLink, name: name.trim(), email: ownerEmail.trim() });
    } catch (caught) {
      setError(errorText(caught, "Could not create this restaurant."));
    } finally {
      setSubmitting(false);
    }
  };

  const client = clients.find((item) => item.id === clientId) ?? null;
  const zoneTime = localTime(timezone);

  if (success) {
    return (
      <ModalShell label="Restaurant created" onClose={requestClose} width={520}>
        <div className="px-6 pb-2 pt-7 text-center">
          <motion.span
            initial={reduce ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_16px_40px_-14px_rgba(16,185,129,0.8)]"
          >
            <Check size={26} strokeWidth={2.6} />
          </motion.span>
          <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-[var(--text)]">{success.name} is on the platform</h3>
          <p className="mx-auto mt-1 max-w-[380px] text-[12px] leading-5 text-[var(--text-muted)]">
            {success.inviteLink ? "Last step: send the owner their activation link so they can sign in to Restaurant Admin." : "This restaurant already existed from an earlier attempt, so its link was already shown once."}
          </p>
        </div>
        <div className="px-6 pb-5 pt-3">
          {success.inviteLink ? (
            <OneTimeLink link={success.inviteLink} email={success.email} restaurant={success.name} copied={linkCopied} onCopied={() => setLinkCopied(true)} />
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3.5 text-[11.5px] leading-5 text-[var(--text-muted)]">
              <Send size={14} className="mt-0.5 shrink-0 text-[var(--text-subtle)]" />
              Open the restaurant and use Invite owner to send a fresh link. The old one cannot be retrieved.
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_50%,transparent)] px-6 py-4">
          {confirmClose ? (
            <>
              <span className="text-[11.5px] font-medium text-[var(--text)]">Close without copying the link?</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmClose(false)} className={cx(BTN_SECONDARY, FOCUS, "h-10")}>
                  Go back
                </button>
                <button type="button" onClick={() => onCreated(success.name)} className={cx(FOCUS, "inline-flex h-10 items-center rounded-xl bg-[var(--danger)] px-3.5 text-[11.5px] font-semibold text-white hover:opacity-90")}>
                  Close anyway
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-[10.5px] text-[var(--text-subtle)]">Lost it later? Reissue from the restaurant.</span>
              <button type="button" onClick={requestClose} className={cx(BTN_PRIMARY, FOCUS, "h-10 px-5")}>
                Done
              </button>
            </>
          )}
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell label="New restaurant" onClose={requestClose} width={640}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            if (step === 3) void submit();
            else goNext();
          }
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex items-start gap-4 border-b border-[var(--line)] px-6 pb-4 pt-6">
          {name.trim() ? <RestaurantMark name={name} size="md" /> : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
              <UtensilsCrossed size={20} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">New restaurant</h3>
            <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)]">
              {[name.trim() || "Untitled", [city.trim(), country.trim()].filter(Boolean).join(", ") || null, currency.trim().toUpperCase() || null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button type="button" onClick={requestClose} aria-label="Close" className={cx(FOCUS, "flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]")}>
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-[var(--line)] px-6 py-2.5" role="tablist" aria-label="New restaurant steps">
          {STEPS.map((item, index) => {
            const active = step === index;
            const done = index < step;
            return (
              <button
                key={item.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => goToStep(index as 0 | 1 | 2 | 3)}
                className={cx(FOCUS, "flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition", active ? "bg-[var(--surface-muted)]" : "hover:bg-[var(--surface-muted)]")}
              >
                <span
                  className={cx(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    active ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : done ? "bg-emerald-500 text-white" : "bg-[var(--surface-muted)] text-[var(--text-subtle)]",
                  )}
                >
                  {done ? <Check size={11} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className={cx("block truncate text-[11px] font-semibold", active ? "text-[var(--text)]" : "text-[var(--text-muted)]")}>{item.label}</span>
                  <span className="hidden truncate text-[9.5px] text-[var(--text-subtle)] sm:block">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
          {step === 0 ? (
          <>
          <section className="space-y-3">
            <div>
              <SectionLabel>Restaurant</SectionLabel>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Mama Put Kitchen"
                maxLength={120}
                aria-invalid={attempted && Boolean(problems.name)}
                className={cx(INPUT, "h-11 text-[13px] font-medium", attempted && problems.name ? "border-[var(--danger)]" : "border-[var(--line)]")}
              />
              {attempted && problems.name ? <p className="mt-1.5 text-[10.5px] font-medium text-[var(--danger)]">{problems.name}</p> : null}
            </div>
            <div>
              <SectionLabel aside={<span className="text-[10px] text-[var(--text-subtle)]">Gets the activation link</span>}>Owner email</SectionLabel>
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  placeholder="owner@restaurant.com"
                  aria-invalid={attempted && Boolean(problems.ownerEmail)}
                  className={cx(INPUT, "pl-9 pr-9", attempted && problems.ownerEmail ? "border-[var(--danger)]" : "border-[var(--line)]")}
                />
                {ownerEmail && !problems.ownerEmail ? <Check size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" /> : null}
              </div>
              {attempted && problems.ownerEmail ? <p className="mt-1.5 text-[10.5px] font-medium text-[var(--danger)]">{problems.ownerEmail}</p> : null}
            </div>
          </section>

          <section>
            <SectionLabel aside={<span className="text-[10px] text-[var(--text-subtle)]">Country fills in currency and timezone</span>}>Where it trades</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <Dropdown
                value={country}
                onChange={pickCountry}
                searchable
                allowCustom
                placeholder="Country"
                icon={<Globe2 size={14} />}
                options={COUNTRIES.map((item) => ({ value: item.name, label: item.name, hint: `${item.currency} · ${item.timezone.split("/").pop()?.replace(/_/g, " ")}`, keywords: item.code }))}
              />
              <div className="relative">
                <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
                <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" maxLength={80} className={cx(INPUT, "border-[var(--line)] pl-9")} />
              </div>
              <div>
                <Dropdown
                  value={currency}
                  onChange={(value) => {
                    setCurrencyTouched(true);
                    setCurrency(value.toUpperCase());
                  }}
                  searchable
                  allowCustom
                  invalid={attempted && Boolean(problems.currency)}
                  icon={<Wallet size={14} />}
                  placeholder="Currency"
                  options={CURRENCIES.map((item) => ({ value: item.code, label: item.code, hint: item.name, keywords: item.name }))}
                />
                {attempted && problems.currency ? <p className="mt-1.5 text-[10.5px] font-medium text-[var(--danger)]">{problems.currency}</p> : null}
              </div>
              <div>
                <Dropdown
                  value={timezone}
                  onChange={(value) => {
                    setTimezoneTouched(true);
                    setTimezone(value);
                  }}
                  searchable
                  icon={<Clock3 size={14} />}
                  placeholder="Timezone"
                  options={timezones.map((zone) => ({ value: zone, label: zone.replace(/_/g, " "), keywords: zone.split("/").join(" ") }))}
                />
                {zoneTime ? (
                  <p className="mt-1.5 text-[10.5px] text-[var(--text-subtle)]">
                    {zoneTime} there now · {offsetLabel(timezone)}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <SectionLabel>Syntra Grid client</SectionLabel>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-muted)] p-1" role="radiogroup" aria-label="Client">
              {([
                { id: true, label: "Create a new client", hint: name.trim() ? `Named ${name.trim()}` : "Named after the restaurant", Icon: Sparkles },
                { id: false, label: "Use an existing client", hint: "For groups with several sites", Icon: Building2 },
              ] as const).map((item) => {
                const active = isNewClient === item.id;
                return (
                  <button key={String(item.id)} type="button" role="radio" aria-checked={active} onClick={() => setIsNewClient(item.id)} className={cx(FOCUS, "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-left")}>
                    {active ? <motion.span layoutId={`${ownerId}-client`} transition={reduce ? { duration: 0 } : SPRING} className="absolute inset-0 rounded-lg bg-[var(--surface)] shadow-sm" /> : null}
                    <item.Icon size={15} className={cx("relative shrink-0", active ? "text-[var(--accent)]" : "text-[var(--text-subtle)]")} />
                    <span className="relative min-w-0">
                      <span className={cx("block truncate text-[12px] font-semibold", active ? "text-[var(--text)]" : "text-[var(--text-muted)]")}>{item.label}</span>
                      <span className="block truncate text-[10.5px] text-[var(--text-subtle)]">{item.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <AnimatePresence initial={false}>
              {!isNewClient ? (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="pt-3">
                    <Dropdown
                      value={clientId}
                      onChange={setClientId}
                      searchable
                      invalid={attempted && Boolean(problems.client)}
                      icon={<Building2 size={14} />}
                      placeholder={clientsLoading ? "Loading clients" : "Choose a client"}
                      options={clients.map((item) => ({ value: item.id, label: item.displayName || item.name, hint: item.displayName && item.displayName !== item.name ? item.name : undefined, keywords: item.name }))}
                    />
                    {attempted && problems.client ? <p className="mt-1.5 text-[10.5px] font-medium text-[var(--danger)]">{problems.client}</p> : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
          </>
          ) : null}

          {step === 1 ? (
            <>
              <section>
                <SectionLabel aside={<span className="text-[10px] text-[var(--text-subtle)]">Both optional — shown in the owner&rsquo;s dashboard and sidebar</span>}>Logo &amp; cover</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <AssetUploadSlot kind="logo" label="Logo" hint="Square works best — sidebar &amp; nav." maxMb={MAX_RESTAURANT_LOGO_MB} shape="square" value={logo} onChange={setLogo} />
                  <AssetUploadSlot kind="cover" label="Cover image" hint="Wide banner for the dashboard header." maxMb={MAX_RESTAURANT_COVER_MB} shape="wide" value={cover} onChange={setCover} />
                </div>
              </section>

              <section className="space-y-3">
                <SectionLabel aside={<span className="text-[10px] text-[var(--text-subtle)]">Optional — used for the sidebar and dashboard accents</span>}>Brand colors</SectionLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    { label: "Primary", value: primaryColor, set: setPrimaryColor, problem: colorProblems.primaryColor },
                    { label: "Secondary", value: secondaryColor, set: setSecondaryColor, problem: colorProblems.secondaryColor },
                  ] as const).map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center gap-2">
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[var(--line)]" style={{ backgroundColor: HEX_RE.test(item.value) ? item.value : "var(--surface-muted)" }}>
                          <input
                            type="color"
                            value={HEX_RE.test(item.value) ? item.value : "#000000"}
                            onChange={(event) => item.set(event.target.value)}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            aria-label={`${item.label} color picker`}
                          />
                        </span>
                        <div className="relative flex-1">
                          <Palette size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
                          <input
                            value={item.value}
                            onChange={(event) => item.set(event.target.value.trim())}
                            placeholder={item.label === "Primary" ? "#0B1020" : "#D4AF37"}
                            maxLength={7}
                            spellCheck={false}
                            aria-invalid={Boolean(item.problem)}
                            className={cx(INPUT, "pl-9 font-mono", item.problem ? "border-[var(--danger)]" : "border-[var(--line)]")}
                          />
                        </div>
                      </div>
                      {item.problem ? <p className="mt-1.5 text-[10.5px] font-medium text-[var(--danger)]">{item.problem}</p> : null}
                    </div>
                  ))}
                </div>
                {primaryContrast !== null && primaryContrast < 2 ? (
                  <div className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[var(--warning-soft)] p-2.5 text-[10.5px] leading-5 text-[var(--text-muted)]">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[var(--warning)]" />
                    This primary color is quite light — white nav/button text on it may be hard to read.
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          {step === 2 ? (
            <section className="space-y-2">
              <SectionLabel aside={<span className="text-[10px] text-[var(--text-subtle)]">The restaurant&apos;s dashboard visual identity — changeable later</span>}>Dashboard theme</SectionLabel>
              {themesLoading ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />)}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {(themeRegistry ?? []).map((theme) => (
                    <ThemePreviewCard
                      key={theme.id}
                      theme={theme}
                      selected={dashboardTheme === theme.id}
                      accentColor={HEX_RE.test(primaryColor) ? primaryColor : undefined}
                      onSelect={() => setDashboardTheme(theme.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {step === 3 ? (
            <>
              <section className="space-y-2">
                <SectionLabel aside={<span className="text-[10px] text-[var(--text-subtle)]">Turn off what this restaurant doesn&apos;t need yet — changeable later</span>}>Modules</SectionLabel>
                {modulesLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--surface-muted)]" />)}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mandatoryModules.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-2.5">
                        {mandatoryModules.map((m) => (
                          <span key={m.key} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2 py-1 text-[10px] font-medium text-[var(--text-muted)]">
                            <CheckCircle2 size={11} className="text-emerald-600" /> {m.label} · always on
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {optionalModules.map((m: ModuleDefinition) => {
                      const enabled = !disabledModuleKeys.has(m.key);
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() =>
                            setDisabledModuleKeys((current) => {
                              const next = new Set(current);
                              if (next.has(m.key)) next.delete(m.key);
                              else next.add(m.key);
                              return next;
                            })
                          }
                          className={cx(FOCUS, "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition", enabled ? "border-[var(--line)] bg-[var(--surface)]" : "border-[var(--line)] bg-[var(--surface-muted)] opacity-70")}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-semibold text-[var(--text)]">{m.label}</span>
                            <span className="block truncate text-[10.5px] text-[var(--text-subtle)]">{m.description}</span>
                          </span>
                          <span className={cx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition", enabled ? "bg-[var(--accent)]" : "bg-[var(--line-strong)]")}>
                            <span className={cx("inline-block h-3.5 w-3.5 transform rounded-full bg-white transition", enabled ? "translate-x-[18px]" : "translate-x-[3px]")} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <div className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)] p-3.5">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                <p className="text-[11.5px] leading-5 text-[var(--text-muted)]">
                  On create, the restaurant is set up on Restaurant Admin{isNewClient ? " with a new client record" : client ? ` under ${client.displayName || client.name}` : ""}, and you get a one time link for <span className="font-semibold text-[var(--text)]">{ownerEmail.trim() || "the owner"}</span> to activate their account.
                </p>
              </div>
            </>
          ) : null}
        </div>

        {error ? (
          <div className="border-t border-[color-mix(in_srgb,var(--danger)_20%,transparent)] px-6 py-2.5">
            <InlineError message={error} onDismiss={() => setError(null)} />
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_50%,transparent)] px-6 py-4">
          {confirmClose ? (
            <>
              <span className="text-[11.5px] font-medium text-[var(--text)]">Discard this restaurant?</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmClose(false)} className={cx(BTN_SECONDARY, FOCUS, "h-10")}>
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    discardUploadedAssets();
                    onClose();
                  }}
                  className={cx(FOCUS, "inline-flex h-10 items-center rounded-xl bg-[var(--danger)] px-3.5 text-[11.5px] font-semibold text-white hover:opacity-90")}
                >
                  Discard
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="hidden items-center gap-1 text-[10.5px] text-[var(--text-subtle)] sm:flex">
                <kbd className="rounded border border-[var(--line)] px-1 font-semibold">Ctrl</kbd>
                <kbd className="rounded border border-[var(--line)] px-1 font-semibold">Enter</kbd>
                {step === 3 ? "to create" : "for next"}
              </span>
              <div className="ml-auto flex gap-2">
                {step === 0 ? (
                  <button type="button" onClick={requestClose} className={cx(BTN_SECONDARY, FOCUS, "h-10")}>
                    Cancel
                  </button>
                ) : (
                  <button type="button" onClick={goBack} className={cx(BTN_SECONDARY, FOCUS, "h-10")}>
                    <ArrowLeft size={13} /> Back
                  </button>
                )}
                {step < 3 ? (
                  <button type="button" onClick={goNext} className={cx(BTN_PRIMARY, FOCUS, "h-10 min-w-[120px]")}>
                    Next <ArrowRight size={13} />
                  </button>
                ) : (
                  <button type="submit" disabled={submitting} className={cx(BTN_PRIMARY, FOCUS, "h-10 min-w-[160px]")}>
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {submitting ? "Setting it up" : "Create restaurant"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </form>
    </ModalShell>
  );
}

/* ============================================================================
   DETAIL PANEL
============================================================================ */

function RestaurantDetailPanel({
  managedSystemId,
  fallbackName,
  onClose,
  onChanged,
  onNotify,
}: {
  managedSystemId: string;
  fallbackName: string;
  onClose: () => void;
  onChanged: () => void;
  onNotify: (message: string) => void;
}) {
  const reduce = useReducedMotion();
  const segmentId = useId();
  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [statusBusy, setStatusBusy] = useState<RemoteRestaurantStatus | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<RemoteRestaurantStatus | null>(null);
  const [modulePending, setModulePending] = useState<Record<string, boolean>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reissueEmail, setReissueEmail] = useState("");
  const [reissueAttempted, setReissueAttempted] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [freshLink, setFreshLink] = useState<{ link: string; email?: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const linkRef = useRef<HTMLDivElement>(null);

  useOverlay(onClose);

  // A new one time link must never appear off screen.
  useEffect(() => {
    if (!freshLink) return;
    const timer = window.setTimeout(() => linkRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }), 60);
    return () => window.clearTimeout(timer);
  }, [freshLink, reduce]);

  const reload = useCallback(
    (quiet = false) => {
      if (!quiet) setStatus("loading");
      return fetchRestaurantDetail(managedSystemId)
        .then((result) => {
          setDetail(result);
          setStatus("ready");
          setReissueEmail((current) => current || result.remote?.email || "");
        })
        .catch((caught) => {
          if (quiet) setActionError(errorText(caught, "Could not refresh this restaurant."));
          else {
            setLoadError(errorText(caught, "Could not load this restaurant."));
            setStatus("error");
          }
        });
    },
    [managedSystemId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const remote = detail?.remote ?? null;
  const name = remote?.name ?? fallbackName;
  const provisioned = detail?.provisioningState === "PROVISIONED" && Boolean(remote);
  const badge = detail ? provisioningBadge({ provisioningState: detail.provisioningState, remoteStatus: remote?.status ?? null }) : null;

  const handleRetry = async () => {
    setRetrying(true);
    setActionError(null);
    try {
      const result = await retryProvisioningApi(managedSystemId);
      if (result.inviteLink) {
        setFreshLink({ link: result.inviteLink, email: reissueEmail || undefined });
        setLinkCopied(false);
      }
      await reload(true);
      onChanged();
      onNotify(`${name} provisioned`);
    } catch (caught) {
      setActionError(errorText(caught, "Retry failed."));
    } finally {
      setRetrying(false);
    }
  };

  const applyStatus = async (next: RemoteRestaurantStatus) => {
    if (!remote) return;
    setConfirmStatus(null);
    setStatusBusy(next);
    setActionError(null);
    try {
      await setRestaurantStatusApi(managedSystemId, next);
      await reload(true);
      onChanged();
      onNotify(`${name} is now ${STATUS_META[next].label.toLowerCase()}`);
    } catch (caught) {
      setActionError(errorText(caught, "The status could not be changed."));
    } finally {
      setStatusBusy(null);
    }
  };

  const requestStatus = (next: RemoteRestaurantStatus) => {
    if (!remote || remote.status === next || statusBusy) return;
    if (next === "ACTIVE") void applyStatus(next);
    else setConfirmStatus(next);
  };

  const modules = useMemo(() => {
    if (!remote) return [] as Array<{ key: string; enabled: boolean }>;
    const enabled = new Set(remote.enabledModules);
    return [...remote.enabledModules, ...remote.disabledModules]
      .filter((key, index, list) => list.indexOf(key) === index)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({ key, enabled: key in modulePending ? modulePending[key] : enabled.has(key) }));
  }, [remote, modulePending]);
  const enabledCount = modules.filter((module) => module.enabled).length;

  const toggleModule = async (moduleKey: string, enabled: boolean) => {
    if (moduleKey in modulePending) return;
    setModulePending((current) => ({ ...current, [moduleKey]: enabled }));
    setActionError(null);
    try {
      await setModuleEnabledApi(managedSystemId, moduleKey, enabled);
      await reload(true);
    } catch (caught) {
      setActionError(errorText(caught, `${humaniseKey(moduleKey)} could not be ${enabled ? "enabled" : "disabled"}.`));
    } finally {
      setModulePending((current) => {
        const next = { ...current };
        delete next[moduleKey];
        return next;
      });
    }
  };

  const { data: themeRegistry } = useSWR("restaurant-platform-themes", fetchThemeRegistry, { dedupingInterval: 60_000, revalidateOnFocus: false });
  const [themeBusy, setThemeBusy] = useState(false);
  const applyTheme = async (theme: string) => {
    if (!remote || theme === remote.dashboardTheme || themeBusy) return;
    setThemeBusy(true);
    setActionError(null);
    try {
      await setDashboardThemeApi(managedSystemId, theme);
      await reload(true);
      onChanged();
    } catch (caught) {
      setActionError(errorText(caught, "Could not change the dashboard theme."));
    } finally {
      setThemeBusy(false);
    }
  };

  const inviteProblem = !reissueEmail.trim() ? "Add an email." : !EMAIL_RE.test(reissueEmail.trim()) ? "That email does not look right." : null;
  const handleReissue = async () => {
    setReissueAttempted(true);
    if (inviteProblem || inviting) return;
    setInviting(true);
    setActionError(null);
    try {
      const result = await issueOwnerInvitationApi(managedSystemId, reissueEmail.trim());
      setFreshLink({ link: result.inviteLink, email: reissueEmail.trim() });
      setLinkCopied(false);
      setInviteOpen(false);
      setReissueAttempted(false);
      await reload(true);
    } catch (caught) {
      setActionError(errorText(caught, "Could not issue the invitation."));
    } finally {
      setInviting(false);
    }
  };

  const zoneTime = remote ? localTime(remote.timezone) : null;

  return (
    <div role="dialog" aria-modal="true" aria-label={name} className="fixed inset-0 z-[300] flex justify-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <motion.aside
        initial={reduce ? { opacity: 0 } : { x: "100%" }}
        animate={reduce ? { opacity: 1 } : { x: 0 }}
        exit={reduce ? { opacity: 0 } : { x: "100%" }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-full w-full max-w-[600px] flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-popover),-30px_0_80px_-40px_rgba(0,0,0,0.45)]"
      >
        <div className="border-b border-[var(--line)] px-6 pb-5 pt-5">
          <div className="flex items-start gap-3.5">
            <RestaurantMark name={name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-[var(--text-subtle)]">{detail ? detail.client?.displayName || detail.client?.name || "No linked client" : " "}</p>
              <h2 className="mt-0.5 truncate text-[19px] font-semibold tracking-[-0.03em] text-[var(--text)]">{name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {badge ? <Pill tone={badge} /> : <span className="h-5 w-20 animate-pulse rounded-full bg-[var(--surface-muted)]" />}
                {remote?.slug ? <code className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">{remote.slug}</code> : null}
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className={cx(FOCUS, "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]")}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {status === "loading" ? (
            <div className="space-y-3 p-6" aria-busy="true">
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-[62px] animate-pulse rounded-xl bg-[var(--surface-muted)]" />
                ))}
              </div>
              <div className="h-10 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
              ))}
            </div>
          ) : null}

          {status === "error" ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <AlertTriangle size={20} className="text-[var(--danger)]" />
              <p className="max-w-[360px] text-[12px] text-[var(--text-muted)]">{loadError}</p>
              <button type="button" onClick={() => void reload()} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
                <RefreshCw size={13} />
                Try again
              </button>
            </div>
          ) : null}

          {status === "ready" && detail ? (
            <div className="space-y-6 p-6">
              <InlineError message={actionError} onDismiss={() => setActionError(null)} />

              <AnimatePresence initial={false}>
                {freshLink ? (
                  <motion.div ref={linkRef} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="scroll-mt-4">
                    <OneTimeLink link={freshLink.link} email={freshLink.email} restaurant={name} copied={linkCopied} onCopied={() => setLinkCopied(true)} />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {!provisioned ? (
                <div className={cx("rounded-2xl border p-4", detail.provisioningState === "FAILED" ? "border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_5%,transparent)]" : "border-[var(--line)] bg-[var(--surface-muted)]")}>
                  <div className="flex items-start gap-3">
                    <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", detail.provisioningState === "FAILED" ? "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]" : "bg-[var(--surface)] text-[var(--text-subtle)]")}>
                      {detail.provisioningState === "FAILED" ? <ShieldAlert size={18} /> : <Clock size={18} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cx("text-[13.5px] font-semibold", detail.provisioningState === "FAILED" ? "text-[var(--danger)]" : "text-[var(--text)]")}>
                        {detail.provisioningState === "FAILED" ? "Provisioning failed" : "Waiting to be provisioned"}
                      </p>
                      <p className="mt-0.5 text-[11.5px] leading-5 text-[var(--text-muted)]">
                        The record exists here, but the restaurant has not been created on Restaurant Admin yet. Retrying sends the exact same request, so it can never create a duplicate.
                      </p>
                    </div>
                  </div>
                  {detail.provisioningError ? (
                    <pre className="mt-3 max-h-[140px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 font-mono text-[10.5px] leading-5 text-[var(--text-muted)]">{detail.provisioningError}</pre>
                  ) : null}
                  <button type="button" disabled={retrying} onClick={() => void handleRetry()} className={cx(BTN_PRIMARY, FOCUS, "mt-3 h-10 w-full")}>
                    {retrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {retrying ? "Retrying" : "Retry provisioning"}
                  </button>
                </div>
              ) : null}

              {remote ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Fact icon={Wallet} label="Currency" value={remote.currency} />
                    <Fact icon={Clock3} label="Timezone" value={remote.timezone.replace(/_/g, " ")} sub={zoneTime ? `${zoneTime} there now` : undefined} />
                    <Fact icon={MapPin} label="Location" value={[remote.city, remote.country].filter(Boolean).join(", ") || "Not set"} />
                    <Fact icon={Mail} label="Owner" value={remote.email || "Not set"} mono={Boolean(remote.email)} />
                  </div>

                  <section>
                    <SectionLabel>Status</SectionLabel>
                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--surface-muted)] p-1" role="radiogroup" aria-label="Restaurant status">
                      {(["ACTIVE", "SUSPENDED", "ARCHIVED"] as RemoteRestaurantStatus[]).map((candidate) => {
                        const meta = STATUS_META[candidate];
                        const current = remote.status === candidate;
                        return (
                          <button
                            key={candidate}
                            type="button"
                            role="radio"
                            aria-checked={current}
                            disabled={Boolean(statusBusy)}
                            onClick={() => requestStatus(candidate)}
                            className={cx(FOCUS, "relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors disabled:cursor-wait")}
                          >
                            {current ? <motion.span layoutId={`${segmentId}-status`} transition={reduce ? { duration: 0 } : SPRING} className="absolute inset-0 rounded-lg bg-[var(--surface)] shadow-sm" /> : null}
                            <span className="relative flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: current ? meta.colour : "var(--text-muted)" }}>
                              {statusBusy === candidate ? <Loader2 size={12} className="animate-spin" /> : <meta.Icon size={12} />}
                              {meta.label}
                            </span>
                            <span className="relative hidden text-[9.5px] text-[var(--text-subtle)] sm:block">{meta.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                    <AnimatePresence initial={false}>
                      {confirmStatus ? (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="mt-2 rounded-xl border p-3" style={{ borderColor: `${STATUS_META[confirmStatus].colour}40`, backgroundColor: STATUS_META[confirmStatus].bg }}>
                            <p className="text-[11.5px] leading-5 text-[var(--text)]">
                              {confirmStatus === "SUSPENDED"
                                ? `Suspend ${name}? Staff and guests lose access until you set it back to active.`
                                : `Archive ${name}? It comes off the platform. You can reactivate it later.`}
                            </p>
                            <div className="mt-2.5 flex justify-end gap-2">
                              <button type="button" onClick={() => setConfirmStatus(null)} className={cx(BTN_SECONDARY, FOCUS, "h-8")}>
                                Cancel
                              </button>
                              <button type="button" onClick={() => void applyStatus(confirmStatus)} className={cx(FOCUS, "inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[11.5px] font-semibold text-white hover:opacity-90")} style={{ backgroundColor: STATUS_META[confirmStatus].colour }}>
                                {confirmStatus === "SUSPENDED" ? <PauseCircle size={13} /> : <Archive size={13} />}
                                {confirmStatus === "SUSPENDED" ? "Suspend" : "Archive"}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </section>

                  <section>
                    <SectionLabel aside={<span className="text-[10.5px] tabular-nums text-[var(--text-subtle)]">{enabledCount} of {modules.length} on</span>}>Modules</SectionLabel>
                    {modules.length === 0 ? (
                      <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--line)] px-4 py-4 text-[11.5px] text-[var(--text-muted)]">
                        <Puzzle size={15} className="text-[var(--text-subtle)]" />
                        Restaurant Admin reported no modules for this restaurant.
                      </div>
                    ) : (
                      <ul className="overflow-hidden rounded-xl border border-[var(--line)]">
                        {modules.map((module) => {
                          const pending = module.key in modulePending;
                          return (
                            <li key={module.key} className="border-b border-[var(--line)] last:border-0">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={module.enabled}
                                disabled={pending}
                                onClick={() => void toggleModule(module.key, !module.enabled)}
                                className={cx(FOCUS, "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)] disabled:cursor-wait")}
                              >
                                <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", module.enabled ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]" : "bg-[var(--surface-muted)] text-[var(--text-subtle)]")}>
                                  <Puzzle size={13} />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[12px] font-semibold text-[var(--text)]">{humaniseKey(module.key)}</span>
                                  <span className="block truncate font-mono text-[10px] text-[var(--text-subtle)]">{module.key}</span>
                                </span>
                                {pending ? <Loader2 size={13} className="shrink-0 animate-spin text-[var(--text-subtle)]" /> : null}
                                <Switch on={module.enabled} />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  <section>
                    <SectionLabel aside={remote ? <span className="text-[10.5px] text-[var(--text-subtle)]">Changeable anytime</span> : null}>Dashboard appearance</SectionLabel>
                    {!themeRegistry ? (
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--surface-muted)]" />)}
                      </div>
                    ) : (
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        {themeRegistry.map((theme) => (
                          <ThemePreviewCard
                            key={theme.id}
                            theme={theme}
                            selected={remote?.dashboardTheme === theme.id}
                            accentColor={remote?.primaryColor ?? undefined}
                            onSelect={() => void applyTheme(theme.id)}
                          />
                        ))}
                      </div>
                    )}
                    {themeBusy ? (
                      <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[var(--text-subtle)]">
                        <Loader2 size={11} className="animate-spin" /> Saving theme…
                      </p>
                    ) : null}
                  </section>

                  <section>
                    <SectionLabel
                      aside={
                        !inviteOpen ? (
                          <button type="button" onClick={() => setInviteOpen(true)} className={cx(FOCUS, "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--surface-muted)]")}>
                            <UserPlus size={12} />
                            Invite owner
                          </button>
                        ) : null
                      }
                    >
                      Administrators
                    </SectionLabel>

                    <AnimatePresence initial={false}>
                      {inviteOpen ? (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="mb-3 rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_50%,transparent)] p-3">
                            <p className="text-[11px] leading-5 text-[var(--text-muted)]">Issue a fresh owner activation link. Any earlier link for this email stops working.</p>
                            <div className="mt-2 flex gap-2">
                              <div className="relative flex-1">
                                <Mail size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
                                <input
                                  autoFocus
                                  type="email"
                                  value={reissueEmail}
                                  onChange={(event) => setReissueEmail(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void handleReissue();
                                    }
                                  }}
                                  placeholder="owner@restaurant.com"
                                  className={cx(INPUT, "pl-8", reissueAttempted && inviteProblem ? "border-[var(--danger)]" : "border-[var(--line)]")}
                                />
                              </div>
                              <button type="button" onClick={() => { setInviteOpen(false); setReissueAttempted(false); }} className={cx(BTN_SECONDARY, FOCUS, "h-10")}>
                                Cancel
                              </button>
                              <button type="button" disabled={inviting} onClick={() => void handleReissue()} className={cx(BTN_PRIMARY, FOCUS, "h-10")}>
                                {inviting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                Issue link
                              </button>
                            </div>
                            {reissueAttempted && inviteProblem ? <p className="mt-1.5 text-[10.5px] font-medium text-[var(--danger)]">{inviteProblem}</p> : null}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    {detail.invitations.length === 0 ? (
                      <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--line)] px-4 py-4 text-[11.5px] text-[var(--text-muted)]">
                        <UserPlus size={15} className="text-[var(--text-subtle)]" />
                        No invitations issued yet.
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {detail.invitations.map((invitation) => {
                          const accepted = invitation.status === "ACCEPTED";
                          const pending = invitation.status === "PENDING";
                          return (
                            <li key={invitation.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-3.5 py-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[10.5px] font-bold uppercase text-[var(--text-muted)]">
                                {invitation.email.slice(0, 2)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12px] font-semibold text-[var(--text)]">{invitation.email}</span>
                                <span className="block truncate text-[10.5px] text-[var(--text-subtle)]">{humanise(invitation.role)}</span>
                              </span>
                              <span
                                className={cx("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", accepted ? "bg-emerald-500/10 text-emerald-700" : pending ? "bg-amber-500/10 text-amber-700" : "bg-[var(--surface-muted)] text-[var(--text-muted)]")}
                              >
                                {accepted ? <CheckCircle2 size={10} /> : pending ? <Clock size={10} /> : null}
                                {humanise(invitation.status)}
                              </span>
                              {pending ? (
                                <button type="button" onClick={() => { setReissueEmail(invitation.email); setInviteOpen(true); }} title="Send a fresh link" className={cx(FOCUS, "rounded-lg px-2 py-1 text-[10.5px] font-semibold text-[var(--accent)] hover:bg-[var(--surface-muted)]")}>
                                  Resend
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_50%,transparent)] px-6 py-3.5">
          <span className="text-[10.5px] text-[var(--text-subtle)]">Menus, orders and staff are managed in Restaurant Admin.</span>
          <button type="button" onClick={() => void reload(true)} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </motion.aside>
    </div>
  );
}

function Fact({ icon: Icon, label, value, sub, mono }: { icon: LucideIcon; label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--line)] px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
        <Icon size={11} />
        {label}
      </span>
      <span className={cx("mt-1 block truncate text-[12.5px] font-semibold text-[var(--text)]", mono && "font-mono text-[11.5px]")} title={value}>
        {value}
      </span>
      {sub ? <span className="block truncate text-[10.5px] text-[var(--text-subtle)]">{sub}</span> : null}
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={cx("flex h-6 w-10 shrink-0 items-center rounded-full p-[3px] transition-colors", on ? "bg-[var(--accent)]" : "bg-[color-mix(in_srgb,var(--text-subtle)_35%,transparent)]")} aria-hidden="true">
      <motion.span layout transition={SPRING} className={cx("h-[18px] w-[18px] rounded-full bg-white shadow-sm", on && "ml-auto")} />
    </span>
  );
}