"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Globe2,
  Grid2X2,
  LayoutList,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";

import ClientWorkspace from "../../clients/ClientWorkspace";

/* =============================================================================
   TYPES
============================================================================= */

type ClientStatus =
  | "LEAD"
  | "ONBOARDING"
  | "ACTIVE"
  | "PAUSED"
  | "ARCHIVED";

type ClientPriority = "STANDARD" | "IMPORTANT" | "STRATEGIC";

type ClientRelationship =
  | "CLIENT"
  | "PARTNER"
  | "STRATEGIC_PARTNER";

type BillingCycle = "MONTHLY" | "QUARTERLY" | "ANNUAL" | "CUSTOM";

type Currency = "NGN" | "GBP" | "USD" | "EUR";

type ContactRole =
  | "GENERAL"
  | "DECISION_MAKER"
  | "EXECUTIVE"
  | "OPERATIONS"
  | "FINANCE"
  | "TECHNICAL"
  | "PRODUCT"
  | "SUPPORT";

type AccountOwner = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
  role?: string;
};

type ClientContact = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  role: ContactRole;
  primary: boolean;
};

type ClientProject = {
  id: string;
  name: string;
  slug: string;
  status: string;
  category: string;
};

type ClientRecord = {
  id: string;
  name: string;
  displayName: string | null;
  slug: string;
  clientRef: string | null;

  description: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;

  logoUrl: string | null;
  websiteUrl: string | null;

  status: ClientStatus;
  priority: ClientPriority;
  relationshipType: ClientRelationship;

  relationshipStartedAt: string | null;
  liveSince: string | null;

  domain: string | null;
  adminUrl: string | null;

  billingCycle: BillingCycle;
  contractValue: string;
  currency: Currency;
  renewalAt: string | null;

  integrationLive: boolean;

  createdAt: string;
  updatedAt: string;

  accountOwner: AccountOwner | null;
  contacts: ClientContact[];
  projects: ClientProject[];

  _count: {
    contacts: number;
    projects: number;
    tickets: number;
    invoices: number;
  };

  openSupportCount: number;
};

type ClientsResponse = {
  ok: boolean;
  clients?: ClientRecord[];
  meta?: {
    total: number;
    active: number;
    onboarding: number;
    archived: number;
  };
  error?: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type ClientOptionsResponse = {
  ok: boolean;
  accountOwners?: AccountOwner[];
  options?: {
    statuses: SelectOption[];
    priorities: SelectOption[];
    relationshipTypes: SelectOption[];
    contactRoles: SelectOption[];
    billingCycles: SelectOption[];
    currencies: SelectOption[];
  };
  error?: string;
};

type ViewMode = "grid" | "list";

type SortKey =
  | "RECENT"
  | "NAME"
  | "PROJECTS"
  | "VALUE"
  | "ATTENTION";

type QuickFilter =
  | "ALL"
  | "ATTENTION"
  | "RENEWALS"
  | "UNASSIGNED"
  | "SUPPORT";

type ToastTone = "success" | "error" | "info";

type ToastMessage = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ClientForm = {
  name: string;
  displayName: string;
  industry: string;
  description: string;

  country: string;
  city: string;
  websiteUrl: string;
  domain: string;

  status: ClientStatus;
  priority: ClientPriority;
  relationshipType: ClientRelationship;
  accountOwnerId: string;

  relationshipStartedAt: string;
  liveSince: string;

  billingCycle: BillingCycle;
  currency: Currency;
  contractValue: string;
  renewalAt: string;

  contactFirstName: string;
  contactLastName: string;
  contactJobTitle: string;
  contactEmail: string;
  contactPhone: string;
  contactRole: ContactRole;
};

type FormIssue = {
  field?: keyof ClientForm;
  step: AddClientStep;
  message: string;
};

type AddClientStep = 1 | 2 | 3 | 4;

type MenuItem = {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  external?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
};

/* =============================================================================
   BRAND
============================================================================= */

const GOLD_GRADIENT =
  "linear-gradient(135deg,#F3DFA2,#D4AF37 60%,#C79A2A)";

const BRAND_WASH =
  "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(20,184,166,0.11))";

const BRAND_WASH_SOFT =
  "linear-gradient(135deg, rgba(212,175,55,0.09), rgba(20,184,166,0.06))";

const GOLD_SHADOW = "0 10px 26px rgba(212,175,55,0.28)";
const GOLD_INK = "#241A05";

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]";

const INPUT_BASE =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[#D4AF37]/55 focus:ring-2 focus:ring-[#D4AF37]/15";

/* =============================================================================
   CONSTANTS
============================================================================= */

const STORAGE_PREFIX = "syntragrid.clients";
const DRAFT_KEY = `${STORAGE_PREFIX}.draft`;
const REFRESH_AFTER_MS = 60_000;
const RENEWAL_WINDOW_DAYS = 60;

const DEFAULT_FORM: ClientForm = {
  name: "",
  displayName: "",
  industry: "",
  description: "",
  country: "Nigeria",
  city: "",
  websiteUrl: "",
  domain: "",
  status: "ONBOARDING",
  priority: "STANDARD",
  relationshipType: "CLIENT",
  accountOwnerId: "",
  relationshipStartedAt: "",
  liveSince: "",
  billingCycle: "ANNUAL",
  currency: "NGN",
  contractValue: "",
  renewalAt: "",
  contactFirstName: "",
  contactLastName: "",
  contactJobTitle: "",
  contactEmail: "",
  contactPhone: "",
  contactRole: "GENERAL",
};

const STATUS_OPTIONS = [
  { value: "LEAD", label: "Lead" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "ARCHIVED", label: "Archived" },
] satisfies Array<{ value: ClientStatus; label: string }>;

const PRIORITY_OPTIONS = [
  { value: "STANDARD", label: "Standard" },
  { value: "IMPORTANT", label: "Important" },
  { value: "STRATEGIC", label: "Strategic" },
] satisfies Array<{ value: ClientPriority; label: string }>;

const RELATIONSHIP_OPTIONS = [
  { value: "CLIENT", label: "Client" },
  { value: "PARTNER", label: "Partner" },
  { value: "STRATEGIC_PARTNER", label: "Strategic partner" },
] satisfies Array<{ value: ClientRelationship; label: string }>;

const BILLING_OPTIONS = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "ANNUAL", label: "Annual" },
  { value: "CUSTOM", label: "Custom" },
] satisfies Array<{ value: BillingCycle; label: string }>;

const CURRENCY_OPTIONS = [
  { value: "NGN", label: "NGN · Nigerian Naira" },
  { value: "GBP", label: "GBP · British Pound" },
  { value: "USD", label: "USD · US Dollar" },
  { value: "EUR", label: "EUR · Euro" },
] satisfies Array<{ value: Currency; label: string }>;

const CONTACT_ROLE_OPTIONS = [
  { value: "GENERAL", label: "General" },
  { value: "DECISION_MAKER", label: "Decision maker" },
  { value: "EXECUTIVE", label: "Executive" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "FINANCE", label: "Finance" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "PRODUCT", label: "Product" },
  { value: "SUPPORT", label: "Support" },
] satisfies Array<{ value: ContactRole; label: string }>;

const SORT_OPTIONS = [
  { value: "RECENT", label: "Recently updated" },
  { value: "NAME", label: "Name A to Z" },
  { value: "PROJECTS", label: "Most projects" },
  { value: "VALUE", label: "Highest value" },
  { value: "ATTENTION", label: "Needs attention" },
] satisfies Array<{ value: SortKey; label: string }>;

/* =============================================================================
   HELPERS
============================================================================= */

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function personName(person: AccountOwner | null | undefined) {
  if (!person) return "Unassigned";

  const value = [person.firstName, person.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return value || person.email;
}

function timeOf(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: string | number, currency: Currency) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Not set";

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function formatCompactMoney(value: string | number, currency: Currency) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount === 0) return "No value set";

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;

  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;

  return Math.ceil((target - Date.now()) / 86_400_000);
}

function renewalLabel(value: string | null | undefined) {
  const days = daysUntil(value);

  if (days === null) return null;
  if (days < 0) return "Renewal overdue";
  if (days === 0) return "Renews today";
  if (days === 1) return "Renews tomorrow";
  if (days <= RENEWAL_WINDOW_DAYS) return `Renews in ${days} days`;

  return `Renews ${formatDate(value)}`;
}

function isRenewalDue(value: string | null | undefined) {
  const days = daysUntil(value);
  return days !== null && days <= RENEWAL_WINDOW_DAYS;
}

function attentionReasons(client: ClientRecord) {
  const reasons: string[] = [];

  if (client.openSupportCount > 0) {
    reasons.push(
      `${client.openSupportCount} open support ${
        client.openSupportCount === 1 ? "ticket" : "tickets"
      }`,
    );
  }

  if (client.status === "PAUSED") reasons.push("Relationship paused");
  if (!client.accountOwner) reasons.push("No account owner");

  const days = daysUntil(client.renewalAt);

  if (days !== null && days < 0) reasons.push("Renewal date has passed");
  else if (days !== null && days <= 30) reasons.push(`Renews in ${days} days`);

  return reasons;
}

function attentionScore(client: ClientRecord) {
  const days = daysUntil(client.renewalAt);

  return (
    client.openSupportCount * 3 +
    (client.status === "PAUSED" ? 2 : 0) +
    (client.accountOwner ? 0 : 2) +
    (days !== null && days < 0 ? 3 : 0) +
    (days !== null && days >= 0 && days <= 30 ? 1 : 0)
  );
}

function needsAttention(client: ClientRecord) {
  return attentionReasons(client).length > 0;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function normaliseUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}

function isValidUrl(value: string) {
  try {
    const url = new URL(normaliseUrl(value));
    return Boolean(url.hostname) && url.hostname.includes(".");
  } catch {
    return false;
  }
}

function domainFromUrl(value: string) {
  try {
    const url = new URL(normaliseUrl(value));
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function relativeTime(value: Date | null) {
  if (!value) return "Not synced yet";

  const seconds = Math.round((Date.now() - value.getTime()) / 1000);

  if (seconds < 45) return "Synced just now";

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `Synced ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `Synced ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  return `Synced ${formatDate(value.toISOString())}`;
}

function statusClasses(status: ClientStatus) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "ONBOARDING":
      return "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300";
    case "LEAD":
      return "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "PAUSED":
      return "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "ARCHIVED":
      return "border-[var(--border)] bg-[var(--soft)] text-[var(--muted)]";
  }
}

function priorityClasses(priority: ClientPriority) {
  switch (priority) {
    case "STRATEGIC":
      return "border-[#D4AF37]/35 bg-[#D4AF37]/12 text-[#8A6A12] dark:text-[#F3DFA2]";
    case "IMPORTANT":
      return "border-[#D4AF37]/20 bg-[#D4AF37]/[0.07] text-[#8A6A12] dark:text-[#E7CE84]";
    default:
      return "border-[var(--border)] bg-[var(--soft)] text-[var(--muted)]";
  }
}

function buildCsv(clients: ClientRecord[]) {
  const headers = [
    "Reference",
    "Name",
    "Display name",
    "Status",
    "Priority",
    "Relationship",
    "Industry",
    "City",
    "Country",
    "Domain",
    "Account owner",
    "Projects",
    "Contacts",
    "Open support",
    "Billing cycle",
    "Currency",
    "Contract value",
    "Renewal",
  ];

  const rows = clients.map((client) => [
    client.clientRef ?? "",
    client.name,
    client.displayName ?? "",
    formatEnum(client.status),
    formatEnum(client.priority),
    formatEnum(client.relationshipType),
    client.industry ?? "",
    client.city ?? "",
    client.country ?? "",
    client.domain ?? "",
    personName(client.accountOwner),
    client._count.projects,
    client._count.contacts,
    client.openSupportCount,
    formatEnum(client.billingCycle),
    client.currency,
    client.contractValue,
    client.renewalAt ? formatDate(client.renewalAt) : "",
  ]);

  return [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
}

function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/* =============================================================================
   HOOKS
============================================================================= */

function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);

      if (raw !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // Defaults are fine.
    }

    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures.
    }
  }, [key, ready, value]);

  return [value, setValue] as const;
}

function useDebouncedValue<T>(value: T, delay = 180) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counter = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (tone: ToastTone, message: string) => {
      counter.current += 1;
      const id = counter.current;

      setToasts((current) => [...current.slice(-2), { id, tone, message }]);

      setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast],
  );

  return { toasts, pushToast, dismissToast };
}

/* =============================================================================
   CLIENTS TAB
============================================================================= */

export default function ClientsTab() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [accountOwners, setAccountOwners] = useState<AccountOwner[]>([]);

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [clockTick, setClockTick] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput);

  const [statusFilter, setStatusFilter] = usePersistentState<
    "ALL" | ClientStatus
  >(`${STORAGE_PREFIX}.status`, "ALL");

  const [priorityFilter, setPriorityFilter] = usePersistentState<
    "ALL" | ClientPriority
  >(`${STORAGE_PREFIX}.priority`, "ALL");

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");

  const [sortKey, setSortKey] = usePersistentState<SortKey>(
    `${STORAGE_PREFIX}.sort`,
    "RECENT",
  );

  const [viewMode, setViewMode] = usePersistentState<ViewMode>(
    `${STORAGE_PREFIX}.view`,
    "grid",
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [step, setStep] = useState<AddClientStep>(1);
  const [form, setForm] = useState<ClientForm>(DEFAULT_FORM);
  const [draftRestored, setDraftRestored] = useState(false);

  const [creating, setCreating] = useState(false);
  const [formIssue, setFormIssue] = useState<FormIssue | null>(null);
  const [createdClient, setCreatedClient] = useState<ClientRecord | null>(null);

  const { toasts, pushToast, dismissToast } = useToasts();

  const searchRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const syncRef = useRef<Date | null>(null);

  /* ==========================================================================
     OPEN CLIENT WORKSPACE
  ========================================================================== */

  const openClient = useCallback((clientId: string) => {
    setDrawerOpen(false);
    setCreatedClient(null);
    setFormIssue(null);
    setSelectedClientId(clientId);
  }, []);

  const closeClientWorkspace = useCallback(() => {
    setSelectedClientId(null);
  }, []);

  /* ==========================================================================
     DATA
  ========================================================================== */

  const loadClients = useCallback(
    async (silent = false) => {
      requestRef.current?.abort();

      const controller = new AbortController();
      requestRef.current = controller;

      if (silent) setRefreshing(true);
      else setLoading(true);

      setError(null);

      try {
        const response = await fetch("/api/admin/clients", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        const payload = (await response.json()) as ClientsResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Clients could not be loaded.");
        }

        setClients(payload.clients ?? []);

        const now = new Date();

        syncRef.current = now;
        setLastSyncedAt(now);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;

        const message =
          err instanceof Error
            ? err.message
            : "The client portfolio could not be loaded.";

        if (silent) pushToast("error", message);
        else setError(message);
      } finally {
        if (requestRef.current === controller) requestRef.current = null;

        setLoading(false);
        setRefreshing(false);
      }
    },
    [pushToast],
  );

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);

    try {
      const response = await fetch("/api/admin/client-options", {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = (await response.json()) as ClientOptionsResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Client options could not be loaded.");
      }

      const owners = payload.accountOwners ?? [];

      setAccountOwners(owners);

      setForm((current) => {
        if (current.accountOwnerId || owners.length === 0) return current;

        return {
          ...current,
          accountOwnerId: owners[0].id,
        };
      });
    } catch (err) {
      console.error("[ClientsTab/client-options]", err);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClients();
    void loadOptions();

    return () => requestRef.current?.abort();
  }, [loadClients, loadOptions]);

  useEffect(() => {
    const timer = setInterval(() => setClockTick((value) => value + 1), 30_000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const maybeRefresh = () => {
      if (document.visibilityState !== "visible") return;

      const last = syncRef.current?.getTime() ?? 0;

      if (Date.now() - last < REFRESH_AFTER_MS) return;

      void loadClients(true);
    };

    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);

    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [loadClients]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (drawerOpen || selectedClientId) return;

      const target = event.target as HTMLElement | null;

      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      const shortcut =
        (event.key === "/" && !typing) ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k");

      if (!shortcut) return;

      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, selectedClientId]);

  useEffect(() => {
    if (!drawerOpen || createdClient) return;

    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      } catch {
        // Ignore.
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [createdClient, drawerOpen, form]);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignore.
    }
  }, []);

  /* ==========================================================================
     DERIVED
  ========================================================================== */

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = clients.filter((client) => {
      if (statusFilter !== "ALL" && client.status !== statusFilter) return false;

      if (priorityFilter !== "ALL" && client.priority !== priorityFilter) {
        return false;
      }

      if (quickFilter === "ATTENTION" && !needsAttention(client)) return false;

      if (quickFilter === "RENEWALS" && !isRenewalDue(client.renewalAt)) {
        return false;
      }

      if (quickFilter === "UNASSIGNED" && client.accountOwner) return false;

      if (quickFilter === "SUPPORT" && client.openSupportCount === 0) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        client.name,
        client.displayName,
        client.clientRef,
        client.industry,
        client.country,
        client.city,
        client.domain,
        personName(client.accountOwner),
        ...client.projects.map((project) => project.name),
        ...client.contacts.map(
          (contact) =>
            `${contact.firstName} ${contact.lastName} ${contact.email ?? ""}`,
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });

    return filtered.sort((a, b) => {
      switch (sortKey) {
        case "NAME":
          return (a.displayName || a.name).localeCompare(
            b.displayName || b.name,
          );

        case "PROJECTS":
          return b._count.projects - a._count.projects;

        case "VALUE":
          return Number(b.contractValue || 0) - Number(a.contractValue || 0);

        case "ATTENTION":
          return attentionScore(b) - attentionScore(a);

        default:
          return timeOf(b.updatedAt) - timeOf(a.updatedAt);
      }
    });
  }, [clients, priorityFilter, quickFilter, search, sortKey, statusFilter]);

  const metrics = useMemo(() => {
    const active = clients.filter((client) => client.status === "ACTIVE").length;

    const onboarding = clients.filter(
      (client) => client.status === "ONBOARDING",
    ).length;

    const projects = clients.reduce(
      (total, client) => total + client._count.projects,
      0,
    );

    const attention = clients.filter(needsAttention).length;

    const renewals = clients.filter((client) =>
      isRenewalDue(client.renewalAt),
    ).length;

    return {
      total: clients.length,
      active,
      onboarding,
      projects,
      attention,
      renewals,
    };
  }, [clients]);

  const selectedOwner = useMemo(
    () =>
      accountOwners.find((owner) => owner.id === form.accountOwnerId) ?? null,
    [accountOwners, form.accountOwnerId],
  );

  const filtersActive =
    Boolean(searchInput) ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    quickFilter !== "ALL";

  const syncedLabel = useMemo(
    () => relativeTime(lastSyncedAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastSyncedAt, clockTick],
  );

  /* ==========================================================================
     ACTIONS
  ========================================================================== */

  const resetFilters = useCallback(() => {
    setSearchInput("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setQuickFilter("ALL");
  }, [setPriorityFilter, setStatusFilter]);

  const copyValue = useCallback(
    async (value: string, message: string) => {
      try {
        await navigator.clipboard.writeText(value);
        pushToast("success", message);
      } catch {
        pushToast("error", "Copy failed. Check clipboard permissions.");
      }
    },
    [pushToast],
  );

  const exportCsv = useCallback(() => {
    if (visibleClients.length === 0) {
      pushToast("info", "Nothing to export in this view.");
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);

    downloadCsv(`syntra_grid_clients_${stamp}.csv`, buildCsv(visibleClients));

    pushToast("success", `Exported ${visibleClients.length} client records.`);
  }, [pushToast, visibleClients]);

  /* ==========================================================================
     DRAWER
  ========================================================================== */

  const openDrawer = () => {
    const defaultOwner = accountOwners[0]?.id ?? "";

    let draft: Partial<ClientForm> | null = null;

    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ClientForm>;

        if (parsed && typeof parsed === "object" && parsed.name?.trim()) {
          draft = parsed;
        }
      }
    } catch {
      // Ignore.
    }

    setForm({
      ...DEFAULT_FORM,
      ...(draft ?? {}),
      accountOwnerId: draft?.accountOwnerId || defaultOwner,
    });

    setDraftRestored(Boolean(draft));
    setStep(1);
    setFormIssue(null);
    setCreatedClient(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (creating) return;

    setDrawerOpen(false);
    setStep(1);
    setFormIssue(null);
    setCreatedClient(null);
  };

  const discardDraft = () => {
    const defaultOwner = accountOwners[0]?.id ?? "";

    clearDraft();
    setForm({ ...DEFAULT_FORM, accountOwnerId: defaultOwner });
    setDraftRestored(false);
    setStep(1);
    setFormIssue(null);
  };

  const updateForm = <K extends keyof ClientForm>(
    key: K,
    value: ClientForm[K],
  ) => {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (
        key === "websiteUrl" &&
        !current.domain.trim() &&
        typeof value === "string"
      ) {
        const derived = domainFromUrl(value);

        if (derived) next.domain = derived;
      }

      return next;
    });

    if (formIssue?.field === key) setFormIssue(null);
  };

  const validateStep = (currentStep: AddClientStep): FormIssue | null => {
    if (currentStep === 1) {
      if (!form.name.trim()) {
        return {
          step: 1,
          field: "name",
          message: "Enter the company or organisation name.",
        };
      }

      if (form.websiteUrl.trim() && !isValidUrl(form.websiteUrl)) {
        return {
          step: 1,
          field: "websiteUrl",
          message: "Enter a valid website address, for example syntragrid.com.",
        };
      }
    }

    if (currentStep === 2) {
      if (!form.accountOwnerId && accountOwners.length > 0) {
        return {
          step: 2,
          field: "accountOwnerId",
          message: "Choose a Syntra Grid account owner.",
        };
      }

      if (form.contractValue.trim() && Number(form.contractValue) < 0) {
        return {
          step: 2,
          field: "contractValue",
          message: "Contract value cannot be negative.",
        };
      }

      if (
        form.relationshipStartedAt &&
        form.liveSince &&
        timeOf(form.liveSince) < timeOf(form.relationshipStartedAt)
      ) {
        return {
          step: 2,
          field: "liveSince",
          message: "The live date cannot come before the relationship started.",
        };
      }
    }

    if (currentStep === 3) {
      const hasAnyContactField = Boolean(
        form.contactFirstName.trim() ||
          form.contactLastName.trim() ||
          form.contactEmail.trim() ||
          form.contactPhone.trim() ||
          form.contactJobTitle.trim(),
      );

      if (hasAnyContactField) {
        if (!form.contactFirstName.trim()) {
          return {
            step: 3,
            field: "contactFirstName",
            message: "Enter the contact's first name.",
          };
        }

        if (!form.contactLastName.trim()) {
          return {
            step: 3,
            field: "contactLastName",
            message: "Enter the contact's last name.",
          };
        }

        if (form.contactEmail.trim() && !isValidEmail(form.contactEmail)) {
          return {
            step: 3,
            field: "contactEmail",
            message: "Enter a valid email address for the contact.",
          };
        }
      }
    }

    return null;
  };

  const goToStep = (target: AddClientStep) => {
    if (target === step) return;

    if (target < step) {
      setFormIssue(null);
      setStep(target);
      return;
    }

    for (let index = step; index < target; index += 1) {
      const issue = validateStep(index as AddClientStep);

      if (issue) {
        setFormIssue(issue);
        setStep(issue.step);
        return;
      }
    }

    setFormIssue(null);
    setStep(target);
  };

  const nextStep = () => {
    const issue = validateStep(step);

    if (issue) {
      setFormIssue(issue);
      return;
    }

    setFormIssue(null);
    setStep((current) => Math.min(4, current + 1) as AddClientStep);
  };

  const previousStep = () => {
    setFormIssue(null);
    setStep((current) => Math.max(1, current - 1) as AddClientStep);
  };

  const createClient = async (event?: FormEvent) => {
    event?.preventDefault();

    const issue = validateStep(1) || validateStep(2) || validateStep(3);

    if (issue) {
      setFormIssue(issue);
      setStep(issue.step);
      return;
    }

    setCreating(true);
    setFormIssue(null);

    const hasPrimaryContact = Boolean(
      form.contactFirstName.trim() && form.contactLastName.trim(),
    );

    try {
      const response = await fetch("/api/admin/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          displayName: form.displayName.trim() || null,
          industry: form.industry.trim() || null,
          description: form.description.trim() || null,
          country: form.country.trim() || null,
          city: form.city.trim() || null,
          websiteUrl: form.websiteUrl.trim()
            ? normaliseUrl(form.websiteUrl)
            : null,
          domain: form.domain.trim() || null,
          status: form.status,
          priority: form.priority,
          relationshipType: form.relationshipType,
          accountOwnerId: form.accountOwnerId || null,
          relationshipStartedAt: form.relationshipStartedAt || null,
          liveSince: form.liveSince || null,
          billingCycle: form.billingCycle,
          currency: form.currency,
          contractValue: form.contractValue || 0,
          renewalAt: form.renewalAt || null,

          primaryContact: hasPrimaryContact
            ? {
                firstName: form.contactFirstName.trim(),
                lastName: form.contactLastName.trim(),
                jobTitle: form.contactJobTitle.trim() || null,
                email: form.contactEmail.trim() || null,
                phone: form.contactPhone.trim() || null,
                role: form.contactRole,
              }
            : null,
        }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        client?: ClientRecord;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.client) {
        throw new Error(payload.error || "The client could not be created.");
      }

      clearDraft();
      setDraftRestored(false);
      setCreatedClient(payload.client);

      pushToast(
        "success",
        `${payload.client.displayName || payload.client.name} is now in the portfolio.`,
      );

      await loadClients(true);
    } catch (err) {
      setFormIssue({
        step: 4,
        message:
          err instanceof Error
            ? err.message
            : "The client could not be created.",
      });
    } finally {
      setCreating(false);
    }
  };

  /* ==========================================================================
     CLIENT WORKSPACE
  ========================================================================== */

  if (selectedClientId) {
    return (
      <ClientWorkspace
        clientId={selectedClientId}
        onBack={closeClientWorkspace}
      />
    );
  }

  /* ==========================================================================
     MAIN CLIENT PORTFOLIO
  ========================================================================== */

  return (
    <div className="space-y-5">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <section
        className="relative overflow-hidden rounded-[24px] border border-[#D4AF37]/22 bg-[var(--card)] p-4 shadow-[0_8px_24px_rgba(11,16,32,0.05)] lg:p-5"
        style={{ backgroundImage: BRAND_WASH }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: GOLD_GRADIENT, opacity: 0.7 }}
        />

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
                Client portfolio
              </h2>

              {metrics.onboarding > 0 ? (
                <Pill tone="teal" icon={<Sparkles size={12} />}>
                  {metrics.onboarding} onboarding
                </Pill>
              ) : null}

              {metrics.attention > 0 ? (
                <Pill tone="gold" icon={<AlertCircle size={12} />}>
                  {metrics.attention} need attention
                </Pill>
              ) : null}
            </div>

            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Every organisation Syntra Grid works with, who owns the
              relationship, and what is happening across delivery and support.
            </p>

            <p className="mt-1 text-[11px] font-medium text-[var(--muted)]">
              {syncedLabel}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className={cx(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-sm font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/45 hover:bg-[var(--soft)]",
                FOCUS_RING,
              )}
            >
              <Download size={15} />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              type="button"
              onClick={() => void loadClients(true)}
              disabled={refreshing}
              className={cx(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-sm font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/45 hover:bg-[var(--soft)] disabled:cursor-not-allowed disabled:opacity-50",
                FOCUS_RING,
              )}
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={openDrawer}
              style={{ background: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
              className={cx(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition hover:brightness-[1.04]",
                FOCUS_RING,
              )}
            >
              <Plus size={16} color={GOLD_INK} />
              <span style={{ color: GOLD_INK }}>Add client</span>
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          icon={<Building2 size={17} />}
          label="Total clients"
          value={metrics.total}
          hint="Portfolio"
        />

        <MetricCard
          icon={<CheckCircle2 size={17} />}
          label="Active"
          value={metrics.active}
          hint="Live"
          active={statusFilter === "ACTIVE"}
          onClick={() =>
            setStatusFilter((current) =>
              current === "ACTIVE" ? "ALL" : "ACTIVE",
            )
          }
        />

        <MetricCard
          icon={<Sparkles size={17} />}
          label="Onboarding"
          value={metrics.onboarding}
          hint="Setting up"
          active={statusFilter === "ONBOARDING"}
          onClick={() =>
            setStatusFilter((current) =>
              current === "ONBOARDING" ? "ALL" : "ONBOARDING",
            )
          }
        />

        <MetricCard
          icon={<BriefcaseBusiness size={17} />}
          label="Projects"
          value={metrics.projects}
          hint="In delivery"
        />

        <MetricCard
          icon={<CalendarClock size={17} />}
          label="Renewals"
          value={metrics.renewals}
          hint="Next 60 days"
          accent={metrics.renewals > 0}
          active={quickFilter === "RENEWALS"}
          onClick={() =>
            setQuickFilter((current) =>
              current === "RENEWALS" ? "ALL" : "RENEWALS",
            )
          }
        />

        <MetricCard
          className="col-span-2 md:col-span-1"
          icon={<AlertCircle size={17} />}
          label="Attention"
          value={metrics.attention}
          hint="Needs review"
          accent={metrics.attention > 0}
          active={quickFilter === "ATTENTION"}
          onClick={() =>
            setQuickFilter((current) =>
              current === "ATTENTION" ? "ALL" : "ATTENTION",
            )
          }
        />
      </section>

      <section className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />

            <input
              ref={searchRef}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearchInput("");
              }}
              placeholder="Search clients, people, projects or locations"
              aria-label="Search clients"
              className={cx(
                INPUT_BASE,
                "h-11 bg-[var(--soft)] pl-10 pr-24 focus:bg-[var(--card)]",
              )}
            />

            <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Clear search"
                  className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--card)] hover:text-[var(--text)]"
                >
                  <X size={13} />
                </button>
              ) : (
                <kbd className="hidden rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] sm:block">
                  /
                </kbd>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SelectControl
              icon={<Filter size={14} />}
              label="Status filter"
              value={statusFilter}
              onChange={(value) =>
                setStatusFilter(value as "ALL" | ClientStatus)
              }
              options={[
                { value: "ALL", label: "All statuses" },
                ...STATUS_OPTIONS,
              ]}
            />

            <SelectControl
              label="Priority filter"
              value={priorityFilter}
              onChange={(value) =>
                setPriorityFilter(value as "ALL" | ClientPriority)
              }
              options={[
                { value: "ALL", label: "All priorities" },
                ...PRIORITY_OPTIONS,
              ]}
            />

            <SelectControl
              icon={<SlidersHorizontal size={14} />}
              label="Sort clients"
              value={sortKey}
              onChange={(value) => setSortKey(value as SortKey)}
              options={SORT_OPTIONS}
            />

            <div className="flex h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--soft)] p-1">
              <ViewToggle
                active={viewMode === "grid"}
                label="Grid view"
                onClick={() => setViewMode("grid")}
              >
                <Grid2X2 size={15} />
              </ViewToggle>

              <ViewToggle
                active={viewMode === "list"}
                label="List view"
                onClick={() => setViewMode("list")}
              >
                <LayoutList size={15} />
              </ViewToggle>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          <FilterChip
            active={quickFilter === "ALL"}
            onClick={() => setQuickFilter("ALL")}
          >
            Everyone
          </FilterChip>

          <FilterChip
            active={quickFilter === "ATTENTION"}
            count={metrics.attention}
            onClick={() =>
              setQuickFilter((current) =>
                current === "ATTENTION" ? "ALL" : "ATTENTION",
              )
            }
          >
            Needs attention
          </FilterChip>

          <FilterChip
            active={quickFilter === "RENEWALS"}
            count={metrics.renewals}
            onClick={() =>
              setQuickFilter((current) =>
                current === "RENEWALS" ? "ALL" : "RENEWALS",
              )
            }
          >
            Renewing soon
          </FilterChip>

          <FilterChip
            active={quickFilter === "UNASSIGNED"}
            onClick={() =>
              setQuickFilter((current) =>
                current === "UNASSIGNED" ? "ALL" : "UNASSIGNED",
              )
            }
          >
            Unassigned
          </FilterChip>

          <FilterChip
            active={quickFilter === "SUPPORT"}
            onClick={() =>
              setQuickFilter((current) =>
                current === "SUPPORT" ? "ALL" : "SUPPORT",
              )
            }
          >
            Open support
          </FilterChip>

          <div className="ml-auto flex items-center gap-3 text-xs text-[var(--muted)]">
            <span aria-live="polite">
              {visibleClients.length}{" "}
              {visibleClients.length === 1 ? "client" : "clients"}
              {filtersActive && clients.length > 0
                ? ` of ${clients.length}`
                : ""}
            </span>

            {filtersActive ? (
              <button
                type="button"
                onClick={resetFilters}
                className={cx(
                  "rounded-md px-1 font-semibold text-[var(--text)] hover:text-[#B8912A]",
                  FOCUS_RING,
                )}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {loading ? (
        <LoadingState view={viewMode} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadClients()} />
      ) : clients.length === 0 ? (
        <EmptyState onAdd={openDrawer} />
      ) : visibleClients.length === 0 ? (
        <NoResultsState query={searchInput} onClear={resetFilters} />
      ) : viewMode === "grid" ? (
        <div
          className={cx(
            "grid gap-4 md:grid-cols-2 2xl:grid-cols-3",
            refreshing && "opacity-70 transition-opacity",
          )}
        >
          {visibleClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onCopy={copyValue}
              onOpen={openClient}
            />
          ))}
        </div>
      ) : (
        <ClientList
          clients={visibleClients}
          onCopy={copyValue}
          onOpen={openClient}
        />
      )}

      {drawerOpen ? (
        <AddClientDrawer
          form={form}
          step={step}
          creating={creating}
          formIssue={formIssue}
          createdClient={createdClient}
          accountOwners={accountOwners}
          optionsLoading={optionsLoading}
          selectedOwner={selectedOwner}
          draftRestored={draftRestored}
          onDiscardDraft={discardDraft}
          onChange={updateForm}
          onClose={closeDrawer}
          onNext={nextStep}
          onBack={previousStep}
          onStep={goToStep}
          onSubmit={createClient}
          onOpenClient={openClient}
          onDone={() => {
            setDrawerOpen(false);
            setCreatedClient(null);
            setStep(1);
          }}
        />
      ) : null}
    </div>
  );
}

/* =============================================================================
   TOASTS
============================================================================= */

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[150] flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cx(
            "pointer-events-auto flex items-start gap-3 rounded-2xl border bg-[var(--card)] p-3.5 shadow-[0_18px_40px_rgba(11,16,32,0.18)]",
            toast.tone === "success" && "border-[#D4AF37]/40",
            toast.tone === "error" && "border-red-500/30",
            toast.tone === "info" && "border-[var(--border)]",
          )}
        >
          <span
            className={cx(
              "mt-0.5 shrink-0",
              toast.tone === "success" && "text-[#B8912A]",
              toast.tone === "error" && "text-red-600",
              toast.tone === "info" && "text-[var(--muted)]",
            )}
          >
            {toast.tone === "error" ? (
              <AlertCircle size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
          </span>

          <p className="flex-1 text-xs leading-5 text-[var(--text)]">
            {toast.message}
          </p>

          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-md p-0.5 text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* =============================================================================
   SMALL COMPONENTS
============================================================================= */

function Pill({
  children,
  icon,
  tone = "neutral",
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "gold" | "teal";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tone === "gold" &&
          "border-[#D4AF37]/40 bg-[#D4AF37]/12 text-[#8A6A12] dark:text-[#F3DFA2]",
        tone === "teal" &&
          "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
        tone === "neutral" &&
          "border-[var(--border)] bg-[var(--soft)] text-[var(--muted)]",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  className,
  accent,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  className?: string;
  accent?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cx(
            "flex h-9 w-9 items-center justify-center rounded-xl transition",
            accent
              ? "bg-[#D4AF37]/14 text-[#B8912A] dark:text-[#F3DFA2]"
              : "bg-[var(--soft)] text-[var(--text)]",
          )}
        >
          {icon}
        </span>

        <span className="text-[11px] font-medium text-[var(--muted)]">
          {hint}
        </span>
      </div>

      <div className="mt-5">
        <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          {value}
        </div>

        <div className="mt-1 text-xs font-medium text-[var(--muted)]">
          {label}
        </div>
      </div>
    </>
  );

  const shell = cx(
    "rounded-[20px] border bg-[var(--card)] p-4 text-left shadow-sm transition",
    active
      ? "border-[#D4AF37]/55 shadow-[0_10px_26px_rgba(212,175,55,0.18)]"
      : "border-[var(--border)]",
    className,
  );

  if (!onClick) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        shell,
        "hover:border-[#D4AF37]/45 hover:shadow-[0_10px_26px_rgba(212,175,55,0.14)]",
        FOCUS_RING,
      )}
      style={active ? { backgroundImage: BRAND_WASH_SOFT } : undefined}
    >
      {body}
    </button>
  );
}

function SelectControl({
  value,
  onChange,
  options,
  icon,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <div className="relative">
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
          {icon}
        </span>
      ) : null}

      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          "h-10 appearance-none rounded-xl border border-[var(--border)] bg-[var(--soft)] pr-9 text-xs font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/45 hover:bg-[var(--card)]",
          icon ? "pl-8" : "pl-3",
          FOCUS_RING,
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
      />
    </div>
  );
}

function ViewToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        "flex h-8 w-8 items-center justify-center rounded-lg transition",
        active
          ? "bg-[var(--card)] text-[#B8912A] shadow-sm ring-1 ring-[#D4AF37]/35 dark:text-[#F3DFA2]"
          : "text-[var(--muted)] hover:text-[var(--text)]",
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}

function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-[#D4AF37]/50 bg-[#D4AF37]/12 text-[#8A6A12] dark:text-[#F3DFA2]"
          : "border-[var(--border)] bg-[var(--soft)] text-[var(--muted)] hover:border-[#D4AF37]/35 hover:text-[var(--text)]",
        FOCUS_RING,
      )}
    >
      {children}

      {typeof count === "number" && count > 0 ? (
        <span
          className={cx(
            "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
            active
              ? "bg-[#D4AF37]/25"
              : "bg-[var(--card)] text-[var(--muted)]",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/* =============================================================================
   ACTION MENU
============================================================================= */

function ActionMenu({
  label,
  items,
}: {
  label: string;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]",
          open && "bg-[var(--soft)] text-[var(--text)]",
          FOCUS_RING,
        )}
      >
        <MoreHorizontal size={17} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-[0_18px_44px_rgba(11,16,32,0.18)]"
        >
          {items.map((item) => {
            const content = (
              <>
                <span className="shrink-0 text-[var(--muted)]">
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </>
            );

            const itemClass = cx(
              "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-[var(--text)] transition hover:bg-[#D4AF37]/10",
              item.disabled && "pointer-events-none opacity-40",
            );

            if (item.href) {
              return (
                <a
                  key={item.key}
                  role="menuitem"
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                  className={itemClass}
                >
                  {content}
                </a>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={itemClass}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function clientMenuItems(
  client: ClientRecord,
  onCopy: (value: string, message: string) => void,
  onOpen: (clientId: string) => void,
): MenuItem[] {
  const primaryContact =
    client.contacts.find((contact) => contact.primary) ?? client.contacts[0];

  const items: MenuItem[] = [
    {
      key: "open",
      label: "Open workspace",
      icon: <ArrowRight size={14} />,
      onSelect: () => onOpen(client.id),
    },
  ];

  if (client.websiteUrl) {
    items.push({
      key: "website",
      label: "Visit website",
      icon: <Globe2 size={14} />,
      href: client.websiteUrl,
      external: true,
    });
  }

  if (client.adminUrl) {
    items.push({
      key: "admin",
      label: "Open client admin",
      icon: <ExternalLink size={14} />,
      href: client.adminUrl,
      external: true,
    });
  }

  if (primaryContact?.email) {
    items.push({
      key: "email",
      label: "Email primary contact",
      icon: <Mail size={14} />,
      href: `mailto:${primaryContact.email}`,
    });

    items.push({
      key: "copy-email",
      label: "Copy contact email",
      icon: <Copy size={14} />,
      onSelect: () =>
        onCopy(primaryContact.email as string, "Contact email copied."),
    });
  }

  if (primaryContact?.phone) {
    items.push({
      key: "phone",
      label: "Call primary contact",
      icon: <Phone size={14} />,
      href: `tel:${primaryContact.phone}`,
    });
  }

  items.push({
    key: "copy-ref",
    label: "Copy client reference",
    icon: <Copy size={14} />,
    disabled: !client.clientRef,
    onSelect: () =>
      onCopy(client.clientRef ?? "", "Client reference copied."),
  });

  return items;
}

/* =============================================================================
   CLIENT CARD
============================================================================= */

function ClientCard({
  client,
  onCopy,
  onOpen,
}: {
  client: ClientRecord;
  onCopy: (value: string, message: string) => void;
  onOpen: (clientId: string) => void;
}) {
  const title = client.displayName || client.name;
  const location = [client.city, client.country].filter(Boolean).join(", ");
  const reasons = attentionReasons(client);
  const renewal = renewalLabel(client.renewalAt);
  const renewalSoon = isRenewalDue(client.renewalAt);

  return (
    <article className="group relative flex flex-col rounded-[24px] border border-[var(--border)] bg-[var(--card)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#D4AF37]/45 hover:shadow-[0_16px_34px_rgba(212,175,55,0.16)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: GOLD_GRADIENT }}
      />

      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <ClientLogo client={client} />

            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold tracking-tight text-[var(--text)]">
                {title}
              </h3>

              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                {client.industry || "Industry not set"}
                {client.clientRef ? ` · ${client.clientRef}` : ""}
              </p>
            </div>
          </div>

          <ActionMenu
            label={`Actions for ${title}`}
            items={clientMenuItems(client, onCopy, onOpen)}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
              statusClasses(client.status),
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {formatEnum(client.status)}
          </span>

          <span
            className={cx(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
              priorityClasses(client.priority),
            )}
          >
            {formatEnum(client.priority)}
          </span>

          {client.integrationLive ? (
            <Pill tone="teal" icon={<ShieldCheck size={11} />}>
              Integrated
            </Pill>
          ) : null}
        </div>

        <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--muted)]">
          {client.description ||
            `${title} is managed inside the Syntra Grid client workspace.`}
        </p>

        <div className="mt-4 space-y-2">
          <InfoRow
            icon={<ShieldCheck size={14} />}
            value={formatEnum(client.relationshipType)}
          />

          <InfoRow
            icon={<MapPin size={14} />}
            value={location || "Location not set"}
          />

          {client.domain ? (
            <InfoRow icon={<Globe2 size={14} />} value={client.domain} />
          ) : null}

          <InfoRow
            icon={<CircleDollarSign size={14} />}
            value={`${formatCompactMoney(
              client.contractValue,
              client.currency,
            )} · ${formatEnum(client.billingCycle)}`}
          />

          {renewal ? (
            <InfoRow
              icon={<CalendarClock size={14} />}
              value={renewal}
              accent={renewalSoon}
            />
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniMetric label="Projects" value={client._count.projects} />
          <MiniMetric label="Contacts" value={client._count.contacts} />
          <MiniMetric
            label="Support"
            value={client.openSupportCount}
            attention={client.openSupportCount > 0}
          />
        </div>

        {reasons.length > 0 ? (
          <div
            className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#D4AF37]/30 p-3"
            style={{ backgroundImage: BRAND_WASH_SOFT }}
          >
            <AlertCircle
              size={14}
              className="mt-0.5 shrink-0 text-[#B8912A] dark:text-[#F3DFA2]"
            />

            <p className="text-[11px] leading-5 text-[var(--text)]">
              {reasons.join(" · ")}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-b-[24px] border-t border-[var(--border)] bg-[var(--soft)]/50 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <OwnerAvatar owner={client.accountOwner} />

          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-[var(--text)]">
              {personName(client.accountOwner)}
            </div>

            <div className="text-[10px] text-[var(--muted)]">Account owner</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpen(client.id)}
          className={cx(
            "inline-flex h-8 items-center gap-1 rounded-lg border border-transparent px-2.5 text-xs font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/40 hover:bg-[var(--card)]",
            FOCUS_RING,
          )}
        >
          Open
          <ArrowRight size={13} />
        </button>
      </div>
    </article>
  );
}

function ClientLogo({
  client,
  size = "md",
}: {
  client: ClientRecord;
  size?: "sm" | "md";
}) {
  const title = client.displayName || client.name;
  const box = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";

  if (client.logoUrl) {
    return (
      <div
        className={cx(
          "shrink-0 overflow-hidden rounded-xl border border-[#D4AF37]/25 bg-white",
          box,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={client.logoUrl}
          alt=""
          className="h-full w-full object-contain p-1.5"
        />
      </div>
    );
  }

  return (
    <div
      className={cx(
        "flex shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/25 font-bold text-[#8A6A12] dark:text-[#F3DFA2]",
        box,
      )}
      style={{ backgroundImage: BRAND_WASH_SOFT }}
    >
      {initials(title) || "CL"}
    </div>
  );
}

function OwnerAvatar({ owner }: { owner: AccountOwner | null }) {
  const name = personName(owner);

  if (owner?.avatarUrl) {
    return (
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--card)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={owner.avatarUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
        owner
          ? "border-[#D4AF37]/30 text-[#8A6A12] dark:text-[#F3DFA2]"
          : "border-dashed border-[var(--border)] text-[var(--muted)]",
      )}
      title={name}
    >
      {owner ? initials(name) : <UserRound size={13} />}
    </div>
  );
}

function InfoRow({
  icon,
  value,
  accent,
}: {
  icon: ReactNode;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex min-w-0 items-center gap-2 text-xs",
        accent
          ? "font-semibold text-[#B8912A] dark:text-[#F3DFA2]"
          : "text-[var(--muted)]",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  attention,
}: {
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border px-3 py-2.5",
        attention
          ? "border-[#D4AF37]/35 bg-[#D4AF37]/[0.08]"
          : "border-[var(--border)] bg-[var(--soft)]",
      )}
    >
      <div
        className={cx(
          "text-sm font-semibold",
          attention
            ? "text-[#B8912A] dark:text-[#F3DFA2]"
            : "text-[var(--text)]",
        )}
      >
        {value}
      </div>

      <div className="mt-0.5 truncate text-[10px] font-medium text-[var(--muted)]">
        {label}
      </div>
    </div>
  );
}

/* =============================================================================
   LIST
============================================================================= */

const LIST_GRID =
  "lg:grid-cols-[minmax(220px,1.5fr)_minmax(140px,1fr)_130px_90px_90px_140px_44px]";

function ClientList({
  clients,
  onCopy,
  onOpen,
}: {
  clients: ClientRecord[];
  onCopy: (value: string, message: string) => void;
  onOpen: (clientId: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <div
        className={cx(
          "sticky top-0 z-10 hidden gap-4 rounded-t-[24px] border-b border-[var(--border)] bg-[var(--card)] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)] lg:grid",
          LIST_GRID,
        )}
        style={{ backgroundImage: BRAND_WASH_SOFT }}
      >
        <span>Client</span>
        <span>Owner</span>
        <span>Status</span>
        <span>Projects</span>
        <span>Support</span>
        <span>Renewal</span>
        <span />
      </div>

      <div className="divide-y divide-[var(--border)]">
        {clients.map((client) => {
          const renewal = renewalLabel(client.renewalAt);
          const renewalSoon = isRenewalDue(client.renewalAt);

          return (
            <div
              key={client.id}
              className={cx(
                "grid gap-3 px-4 py-4 transition last:rounded-b-[24px] hover:bg-[#D4AF37]/[0.05] lg:items-center lg:gap-4 lg:px-5",
                LIST_GRID,
              )}
            >
              <button
                type="button"
                onClick={() => onOpen(client.id)}
                className="flex min-w-0 items-center gap-3 text-left"
              >
                <ClientLogo client={client} size="sm" />

                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--text)]">
                    {client.displayName || client.name}
                  </div>

                  <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
                    {[client.industry, client.country]
                      .filter(Boolean)
                      .join(" · ") || "Client"}
                  </div>
                </div>
              </button>

              <div className="flex min-w-0 items-center gap-2">
                <OwnerAvatar owner={client.accountOwner} />

                <span className="truncate text-xs font-medium text-[var(--text)]">
                  {personName(client.accountOwner)}
                </span>
              </div>

              <div>
                <span
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                    statusClasses(client.status),
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {formatEnum(client.status)}
                </span>
              </div>

              <div className="text-sm font-semibold text-[var(--text)]">
                <span className="mr-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] lg:hidden">
                  Projects
                </span>
                {client._count.projects}
              </div>

              <div
                className={cx(
                  "text-sm font-semibold",
                  client.openSupportCount > 0
                    ? "text-[#B8912A] dark:text-[#F3DFA2]"
                    : "text-[var(--text)]",
                )}
              >
                <span className="mr-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] lg:hidden">
                  Support
                </span>
                {client.openSupportCount}
              </div>

              <div
                className={cx(
                  "truncate text-xs",
                  renewalSoon
                    ? "font-semibold text-[#B8912A] dark:text-[#F3DFA2]"
                    : "text-[var(--muted)]",
                )}
              >
                {renewal ?? "No renewal set"}
              </div>

              <div className="flex items-center justify-end gap-1">
                <ActionMenu
                  label={`Actions for ${client.name}`}
                  items={clientMenuItems(client, onCopy, onOpen)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* =============================================================================
   STATES
============================================================================= */

function LoadingState({ view }: { view: ViewMode }) {
  if (view === "list") {
    return (
      <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--card)]">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex animate-pulse items-center gap-4 border-b border-[var(--border)] px-5 py-4 last:border-b-0"
          >
            <div className="h-9 w-9 rounded-xl bg-[var(--soft)]" />
            <div className="h-3.5 w-40 rounded bg-[var(--soft)]" />
            <div className="ml-auto h-3.5 w-24 rounded bg-[var(--soft)]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-[340px] animate-pulse rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-5"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[var(--soft)]" />

            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/2 rounded bg-[var(--soft)]" />
              <div className="h-3 w-1/3 rounded bg-[var(--soft)]" />
            </div>
          </div>

          <div className="mt-6 h-4 w-2/3 rounded bg-[var(--soft)]" />
          <div className="mt-2 h-4 w-full rounded bg-[var(--soft)]" />
          <div className="mt-2 h-4 w-4/5 rounded bg-[var(--soft)]" />

          <div className="mt-8 grid grid-cols-3 gap-2">
            <div className="h-14 rounded-xl bg-[var(--soft)]" />
            <div className="h-14 rounded-xl bg-[var(--soft)]" />
            <div className="h-14 rounded-xl bg-[var(--soft)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[24px] border border-red-500/20 bg-red-500/[0.04] px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
        <AlertCircle size={21} />
      </div>

      <h3 className="mt-4 text-base font-semibold text-[var(--text)]">
        Clients could not be loaded
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        {message}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className={cx(
          "mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/45 hover:bg-[var(--soft)]",
          FOCUS_RING,
        )}
      >
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-dashed border-[#D4AF37]/35 bg-[var(--card)] px-6 py-16 text-center"
      style={{ backgroundImage: BRAND_WASH_SOFT }}
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D4AF37]/20 blur-3xl" />

      <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/35 bg-[var(--card)] text-[#B8912A] dark:text-[#F3DFA2]">
        <Building2 size={23} />
      </div>

      <h3 className="relative mt-5 text-lg font-semibold tracking-tight text-[var(--text)]">
        Build your client portfolio
      </h3>

      <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        Add the organisations Syntra Grid works with. Projects, systems, support
        and commercial activity all connect back to one client record.
      </p>

      <button
        type="button"
        onClick={onAdd}
        style={{ background: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
        className={cx(
          "relative mt-6 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition hover:brightness-[1.04]",
          FOCUS_RING,
        )}
      >
        <Plus size={15} color={GOLD_INK} />
        <span style={{ color: GOLD_INK }}>Add first client</span>
      </button>
    </div>
  );
}

function NoResultsState({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[24px] border border-[var(--border)] bg-[var(--card)] px-6 text-center">
      <Search size={22} className="text-[var(--muted)]" />

      <h3 className="mt-4 text-base font-semibold text-[var(--text)]">
        {query ? `Nothing matches "${query}"` : "No clients match these filters"}
      </h3>

      <p className="mt-2 text-sm text-[var(--muted)]">
        Try a different search, or reset the portfolio filters.
      </p>

      <button
        type="button"
        onClick={onClear}
        className={cx(
          "mt-5 rounded-md px-1 text-sm font-semibold text-[var(--text)] hover:text-[#B8912A]",
          FOCUS_RING,
        )}
      >
        Clear filters
      </button>
    </div>
  );
}

/* =============================================================================
   ADD CLIENT DRAWER
============================================================================= */

function AddClientDrawer({
  form,
  step,
  creating,
  formIssue,
  createdClient,
  accountOwners,
  optionsLoading,
  selectedOwner,
  draftRestored,
  onDiscardDraft,
  onChange,
  onClose,
  onNext,
  onBack,
  onStep,
  onSubmit,
  onDone,
  onOpenClient,
}: {
  form: ClientForm;
  step: AddClientStep;
  creating: boolean;
  formIssue: FormIssue | null;
  createdClient: ClientRecord | null;
  accountOwners: AccountOwner[];
  optionsLoading: boolean;
  selectedOwner: AccountOwner | null;
  draftRestored: boolean;
  onDiscardDraft: () => void;
  onChange: <K extends keyof ClientForm>(
    key: K,
    value: ClientForm[K],
  ) => void;
  onClose: () => void;
  onNext: () => void;
  onBack: () => void;
  onStep: (target: AddClientStep) => void;
  onSubmit: (event?: FormEvent) => Promise<void>;
  onDone: () => void;
  onOpenClient: (clientId: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;

    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creating) {
        event.stopPropagation();
        onClose();
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key === "Enter" &&
        !creating &&
        !createdClient
      ) {
        event.preventDefault();
        void onSubmit();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [createdClient, creating, onClose, onSubmit]);

  return (
    <div className="fixed inset-0 z-[120]">
      <button
        type="button"
        aria-label="Close the add client drawer"
        onClick={onClose}
        className="absolute inset-0 bg-[#0B1020]/40 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add client"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-[680px] flex-col border-l border-[#D4AF37]/25 bg-[var(--shell)] shadow-[0_0_60px_rgba(11,16,32,0.35)] outline-none"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
          style={{ background: GOLD_GRADIENT }}
        />

        {createdClient ? (
          <ClientCreatedState
            client={createdClient}
            onDone={onDone}
            onOpen={() => onOpenClient(createdClient.id)}
          />
        ) : (
          <>
            <div
              className="border-b border-[var(--border)] px-5 py-5 sm:px-7"
              style={{ backgroundImage: BRAND_WASH_SOFT }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-[var(--text)]">
                    Add client
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    Create the organisation first. Projects and systems connect
                    to it afterwards.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={creating}
                  aria-label="Close"
                  className={cx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] transition hover:border-[#D4AF37]/45 hover:text-[var(--text)] disabled:opacity-50",
                    FOCUS_RING,
                  )}
                >
                  <X size={16} />
                </button>
              </div>

              <StepIndicator step={step} onStep={onStep} />
            </div>

            <form
              onSubmit={(event) => void onSubmit(event)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
                {draftRestored ? (
                  <div
                    className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/35 p-3.5"
                    style={{ backgroundImage: BRAND_WASH_SOFT }}
                  >
                    <p className="text-xs leading-5 text-[var(--text)]">
                      Picked up where you left off. Your unsaved client details
                      were restored.
                    </p>

                    <button
                      type="button"
                      onClick={onDiscardDraft}
                      className={cx(
                        "shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text)] transition hover:bg-[var(--soft)]",
                        FOCUS_RING,
                      )}
                    >
                      Start fresh
                    </button>
                  </div>
                ) : null}

                {step === 1 ? (
                  <CompanyStep
                    form={form}
                    issue={formIssue}
                    onChange={onChange}
                  />
                ) : null}

                {step === 2 ? (
                  <RelationshipStep
                    form={form}
                    issue={formIssue}
                    accountOwners={accountOwners}
                    optionsLoading={optionsLoading}
                    onChange={onChange}
                  />
                ) : null}

                {step === 3 ? (
                  <ContactStep
                    form={form}
                    issue={formIssue}
                    onChange={onChange}
                  />
                ) : null}

                {step === 4 ? (
                  <ReviewStep
                    form={form}
                    selectedOwner={selectedOwner}
                    onStep={onStep}
                  />
                ) : null}

                {formIssue ? (
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4 text-sm text-red-700 dark:text-red-300">
                    <AlertCircle size={17} className="mt-0.5 shrink-0" />
                    <span>{formIssue.message}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--shell)] px-5 py-4 sm:px-7">
                <div className="flex items-center gap-3">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={onBack}
                      disabled={creating}
                      className={cx(
                        "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)] disabled:opacity-50",
                        FOCUS_RING,
                      )}
                    >
                      <ArrowLeft size={15} />
                      Back
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={creating}
                      className={cx(
                        "h-10 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)] disabled:opacity-50",
                        FOCUS_RING,
                      )}
                    >
                      Cancel
                    </button>
                  )}

                  <span className="hidden text-[11px] text-[var(--muted)] sm:block">
                    Saved as a draft while you type
                  </span>
                </div>

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={onNext}
                    style={{
                      background: GOLD_GRADIENT,
                      boxShadow: GOLD_SHADOW,
                    }}
                    className={cx(
                      "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition hover:brightness-[1.04]",
                      FOCUS_RING,
                    )}
                  >
                    <span style={{ color: GOLD_INK }}>Continue</span>
                    <ArrowRight size={15} color={GOLD_INK} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={creating}
                    style={{
                      background: GOLD_GRADIENT,
                      boxShadow: GOLD_SHADOW,
                    }}
                    className={cx(
                      "inline-flex h-10 min-w-[140px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-60",
                      FOCUS_RING,
                    )}
                  >
                    {creating ? (
                      <>
                        <Loader2
                          size={15}
                          color={GOLD_INK}
                          className="animate-spin"
                        />
                        <span style={{ color: GOLD_INK }}>Creating</span>
                      </>
                    ) : (
                      <>
                        <Check size={15} color={GOLD_INK} />
                        <span style={{ color: GOLD_INK }}>Create client</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* =============================================================================
   STEPS
============================================================================= */

const STEPS: Array<{ number: AddClientStep; label: string }> = [
  { number: 1, label: "Company" },
  { number: 2, label: "Relationship" },
  { number: 3, label: "Contact" },
  { number: 4, label: "Review" },
];

function StepIndicator({
  step,
  onStep,
}: {
  step: AddClientStep;
  onStep: (target: AddClientStep) => void;
}) {
  return (
    <div className="mt-5 grid grid-cols-4 gap-2">
      {STEPS.map((item) => {
        const active = item.number === step;
        const complete = item.number < step;

        return (
          <button
            key={item.number}
            type="button"
            onClick={() => onStep(item.number)}
            aria-current={active ? "step" : undefined}
            className={cx("group text-left", FOCUS_RING, "rounded-md")}
          >
            <span
              className={cx(
                "block h-1 rounded-full transition",
                !active && !complete && "bg-[var(--soft)]",
              )}
              style={
                active || complete ? { background: GOLD_GRADIENT } : undefined
              }
            />

            <span
              className={cx(
                "mt-2 block truncate text-[11px] font-semibold transition",
                active
                  ? "text-[var(--text)]"
                  : "text-[var(--muted)] group-hover:text-[var(--text)]",
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CompanyStep({
  form,
  issue,
  onChange,
}: {
  form: ClientForm;
  issue: FormIssue | null;
  onChange: <K extends keyof ClientForm>(
    key: K,
    value: ClientForm[K],
  ) => void;
}) {
  return (
    <StepSection
      title="Company details"
      description="Start with the organisation itself. Technical systems and projects are connected once the client exists."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          className="sm:col-span-2"
          label="Company name"
          required
          invalid={issue?.field === "name"}
          value={form.name}
          onChange={(value) => onChange("name", value)}
          placeholder="RentWise"
          autoFocus
        />

        <Field
          label="Display name"
          hint="A shorter label used across the dashboard"
          value={form.displayName}
          onChange={(value) => onChange("displayName", value)}
          placeholder="Optional"
        />

        <Field
          label="Industry"
          value={form.industry}
          onChange={(value) => onChange("industry", value)}
          placeholder="Property technology"
        />

        <TextAreaField
          className="sm:col-span-2"
          label="Description"
          hint="What the organisation does and how Syntra Grid works with it"
          value={form.description}
          onChange={(value) => onChange("description", value)}
          placeholder="A short summary the team will read on the client card."
        />

        <Field
          label="Country"
          value={form.country}
          onChange={(value) => onChange("country", value)}
          placeholder="Nigeria"
        />

        <Field
          label="City"
          value={form.city}
          onChange={(value) => onChange("city", value)}
          placeholder="Abuja"
        />

        <Field
          label="Website"
          hint="The domain fills itself in from this"
          invalid={issue?.field === "websiteUrl"}
          value={form.websiteUrl}
          onChange={(value) => onChange("websiteUrl", value)}
          placeholder="rentwise.ng"
          inputMode="url"
        />

        <Field
          label="Primary domain"
          value={form.domain}
          onChange={(value) => onChange("domain", value)}
          placeholder="rentwise.ng"
        />
      </div>
    </StepSection>
  );
}

function RelationshipStep({
  form,
  issue,
  accountOwners,
  optionsLoading,
  onChange,
}: {
  form: ClientForm;
  issue: FormIssue | null;
  accountOwners: AccountOwner[];
  optionsLoading: boolean;
  onChange: <K extends keyof ClientForm>(
    key: K,
    value: ClientForm[K],
  ) => void;
}) {
  const contractPreview = form.contractValue
    ? formatMoney(form.contractValue, form.currency)
    : null;

  return (
    <StepSection
      title="Relationship"
      description="Set how Syntra Grid works with this organisation and who owns the relationship internally."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          label="Status"
          value={form.status}
          onChange={(value) => onChange("status", value as ClientStatus)}
          options={STATUS_OPTIONS}
        />

        <FormSelect
          label="Priority"
          value={form.priority}
          onChange={(value) => onChange("priority", value as ClientPriority)}
          options={PRIORITY_OPTIONS}
        />

        <FormSelect
          className="sm:col-span-2"
          label="Relationship type"
          value={form.relationshipType}
          onChange={(value) =>
            onChange("relationshipType", value as ClientRelationship)
          }
          options={RELATIONSHIP_OPTIONS}
        />

        <FormSelect
          className="sm:col-span-2"
          label="Account owner"
          hint="The person clients hear from first"
          invalid={issue?.field === "accountOwnerId"}
          value={form.accountOwnerId}
          onChange={(value) => onChange("accountOwnerId", value)}
          disabled={optionsLoading}
          options={[
            ...(accountOwners.length === 0
              ? [{ value: "", label: "No eligible team members" }]
              : []),
            ...accountOwners.map((owner) => ({
              value: owner.id,
              label: `${personName(owner)}${
                owner.role ? ` · ${formatEnum(owner.role)}` : ""
              }`,
            })),
          ]}
        />

        <Field
          label="Relationship started"
          type="date"
          value={form.relationshipStartedAt}
          onChange={(value) => onChange("relationshipStartedAt", value)}
        />

        <Field
          label="Went live"
          type="date"
          invalid={issue?.field === "liveSince"}
          value={form.liveSince}
          onChange={(value) => onChange("liveSince", value)}
        />

        <div className="sm:col-span-2">
          <div className="mb-3 mt-2 flex items-center gap-2">
            <CircleDollarSign size={15} className="text-[#B8912A]" />
            <span className="text-xs font-semibold text-[var(--text)]">
              Commercial snapshot
            </span>
          </div>

          <div
            className="grid gap-4 rounded-2xl border border-[#D4AF37]/25 p-4 sm:grid-cols-2"
            style={{ backgroundImage: BRAND_WASH_SOFT }}
          >
            <FormSelect
              label="Billing cycle"
              value={form.billingCycle}
              onChange={(value) =>
                onChange("billingCycle", value as BillingCycle)
              }
              options={BILLING_OPTIONS}
            />

            <FormSelect
              label="Currency"
              value={form.currency}
              onChange={(value) => onChange("currency", value as Currency)}
              options={CURRENCY_OPTIONS}
            />

            <Field
              label="Contract value"
              type="number"
              min="0"
              invalid={issue?.field === "contractValue"}
              hint={contractPreview ?? undefined}
              value={form.contractValue}
              onChange={(value) => onChange("contractValue", value)}
              placeholder="0"
            />

            <Field
              label="Renewal date"
              type="date"
              value={form.renewalAt}
              onChange={(value) => onChange("renewalAt", value)}
            />
          </div>

          <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
            Use contract value only for a genuine fixed amount. Revenue share,
            equity or other arrangements belong in the Commercial workspace
            rather than this field.
          </p>
        </div>
      </div>
    </StepSection>
  );
}

function ContactStep({
  form,
  issue,
  onChange,
}: {
  form: ClientForm;
  issue: FormIssue | null;
  onChange: <K extends keyof ClientForm>(
    key: K,
    value: ClientForm[K],
  ) => void;
}) {
  return (
    <StepSection
      title="Primary contact"
      description="Optional. Add the person Syntra Grid speaks to most often. More contacts can be added later."
    >
      <div
        className="mb-5 flex items-center gap-3 rounded-2xl border border-[#D4AF37]/25 p-4"
        style={{ backgroundImage: BRAND_WASH_SOFT }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--card)] text-[#B8912A] dark:text-[#F3DFA2]">
          <Users size={17} />
        </div>

        <div>
          <div className="text-sm font-semibold text-[var(--text)]">
            Contact record
          </div>

          <div className="mt-0.5 text-xs text-[var(--muted)]">
            Leave every field blank to skip this and add contacts later.
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="First name"
          invalid={issue?.field === "contactFirstName"}
          value={form.contactFirstName}
          onChange={(value) => onChange("contactFirstName", value)}
          placeholder="First name"
        />

        <Field
          label="Last name"
          invalid={issue?.field === "contactLastName"}
          value={form.contactLastName}
          onChange={(value) => onChange("contactLastName", value)}
          placeholder="Last name"
        />

        <Field
          label="Job title"
          value={form.contactJobTitle}
          onChange={(value) => onChange("contactJobTitle", value)}
          placeholder="Managing Director"
        />

        <FormSelect
          label="Contact role"
          value={form.contactRole}
          onChange={(value) => onChange("contactRole", value as ContactRole)}
          options={CONTACT_ROLE_OPTIONS}
        />

        <Field
          label="Email"
          type="email"
          invalid={issue?.field === "contactEmail"}
          value={form.contactEmail}
          onChange={(value) => onChange("contactEmail", value)}
          placeholder="name@company.com"
        />

        <Field
          label="Phone"
          type="tel"
          value={form.contactPhone}
          onChange={(value) => onChange("contactPhone", value)}
          placeholder="+234"
        />
      </div>
    </StepSection>
  );
}

function ReviewStep({
  form,
  selectedOwner,
  onStep,
}: {
  form: ClientForm;
  selectedOwner: AccountOwner | null;
  onStep: (target: AddClientStep) => void;
}) {
  const hasContact = Boolean(
    form.contactFirstName.trim() && form.contactLastName.trim(),
  );

  return (
    <StepSection
      title="Review client"
      description="Check the record before it is created. Anything here can be edited afterwards."
    >
      <div className="overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--card)]">
        <div
          className="flex items-start gap-4 border-b border-[var(--border)] p-5"
          style={{ backgroundImage: BRAND_WASH_SOFT }}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[var(--card)] text-sm font-bold text-[#8A6A12] dark:text-[#F3DFA2]">
            {initials(form.displayName || form.name) || "CL"}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-[var(--text)]">
              {form.displayName || form.name || "Unnamed client"}
            </h3>

            <p className="mt-1 truncate text-xs text-[var(--muted)]">
              {[form.industry, form.city, form.country]
                .filter(Boolean)
                .join(" · ") || "No company details supplied"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={cx(
                  "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                  statusClasses(form.status),
                )}
              >
                {formatEnum(form.status)}
              </span>

              <span
                className={cx(
                  "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                  priorityClasses(form.priority),
                )}
              >
                {formatEnum(form.priority)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStep(1)}
            className={cx(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 text-[11px] font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/45",
              FOCUS_RING,
            )}
          >
            <Pencil size={12} />
            Edit
          </button>
        </div>

        <div className="divide-y divide-[var(--border)] px-5">
          <ReviewRow
            label="Relationship"
            value={formatEnum(form.relationshipType)}
            onEdit={() => onStep(2)}
          />

          <ReviewRow
            label="Account owner"
            value={personName(selectedOwner)}
            onEdit={() => onStep(2)}
          />

          <ReviewRow
            label="Relationship started"
            value={
              form.relationshipStartedAt
                ? formatDate(form.relationshipStartedAt)
                : "Not set"
            }
            onEdit={() => onStep(2)}
          />

          <ReviewRow
            label="Commercial"
            value={`${formatEnum(form.billingCycle)} · ${
              form.contractValue
                ? formatMoney(form.contractValue, form.currency)
                : form.currency
            }`}
            onEdit={() => onStep(2)}
          />

          <ReviewRow
            label="Renewal"
            value={form.renewalAt ? formatDate(form.renewalAt) : "Not set"}
            onEdit={() => onStep(2)}
          />

          <ReviewRow
            label="Primary contact"
            value={
              hasContact
                ? `${form.contactFirstName} ${form.contactLastName}`
                : "Add later"
            }
            onEdit={() => onStep(3)}
          />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--soft)] p-4">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#B8912A]" />

        <p className="text-xs leading-5 text-[var(--muted)]">
          This creates the client workspace only. Projects, repositories,
          deployments and databases are connected separately so the client
          record stays clean.
        </p>
      </div>
    </StepSection>
  );
}

function StepSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text)]">
          {title}
        </h3>

        <p className="mt-1.5 max-w-xl text-sm leading-6 text-[var(--muted)]">
          {description}
        </p>
      </div>

      {children}
    </div>
  );
}

/* =============================================================================
   FORM CONTROLS
============================================================================= */

function FieldLabel({
  label,
  required,
  hint,
}: {
  label: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <span className="mb-2 flex items-baseline justify-between gap-3">
      <span className="text-xs font-semibold text-[var(--text)]">
        {label}
        {required ? <span className="ml-1 text-[#C79A2A]">*</span> : null}
      </span>

      {hint ? (
        <span className="truncate text-[11px] font-medium text-[var(--muted)]">
          {hint}
        </span>
      ) : null}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  className,
  type = "text",
  autoFocus,
  min,
  hint,
  invalid,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  type?: string;
  autoFocus?: boolean;
  min?: string;
  hint?: string;
  invalid?: boolean;
  inputMode?: "text" | "url" | "tel" | "email" | "numeric" | "decimal";
}) {
  return (
    <label className={cx("block", className)}>
      <FieldLabel label={label} required={required} hint={hint} />

      <input
        type={type}
        value={value}
        min={min}
        inputMode={inputMode}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cx(
          INPUT_BASE,
          "h-11 px-3.5",
          invalid &&
            "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/15",
        )}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  className,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <FieldLabel label={label} hint={hint} />

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className={cx(INPUT_BASE, "resize-none px-3.5 py-3 leading-6")}
      />
    </label>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  className,
  disabled,
  hint,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  disabled?: boolean;
  hint?: string;
  invalid?: boolean;
}) {
  return (
    <label className={cx("block", className)}>
      <FieldLabel label={label} hint={hint} />

      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cx(
            INPUT_BASE,
            "h-11 appearance-none px-3.5 pr-10 disabled:cursor-not-allowed disabled:opacity-50",
            invalid && "border-red-500/60 focus:border-red-500/60",
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
      </div>
    </label>
  );
}

/* =============================================================================
   REVIEW
============================================================================= */

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-5 py-3.5">
      <span className="text-xs text-[var(--muted)]">{label}</span>

      <span className="flex items-center gap-2">
        <span className="text-right text-xs font-semibold text-[var(--text)]">
          {value}
        </span>

        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${label.toLowerCase()}`}
            className={cx(
              "rounded-md p-1 text-[var(--muted)] transition hover:text-[#B8912A]",
              FOCUS_RING,
            )}
          >
            <Pencil size={12} />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/* =============================================================================
   SUCCESS
============================================================================= */

function ClientCreatedState({
  client,
  onDone,
  onOpen,
}: {
  client: ClientRecord;
  onDone: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-12">
        <div className="w-full max-w-md text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#D4AF37]/35 text-[#B8912A] dark:text-[#F3DFA2]"
            style={{ backgroundImage: BRAND_WASH }}
          >
            <CheckCircle2 size={27} />
          </div>

          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--text)]">
            {client.displayName || client.name} is in the portfolio
          </h2>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">
            The client workspace is live. Projects, systems, support activity
            and commercial records can now be connected to it.
          </p>

          <div className="mt-7 rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-5 text-left shadow-sm">
            <ReviewRow label="Status" value={formatEnum(client.status)} />

            <div className="border-t border-[var(--border)]">
              <ReviewRow
                label="Relationship"
                value={formatEnum(client.relationshipType)}
              />
            </div>

            <div className="border-t border-[var(--border)]">
              <ReviewRow
                label="Account owner"
                value={personName(client.accountOwner)}
              />
            </div>

            <div className="border-t border-[var(--border)]">
              <ReviewRow
                label="Reference"
                value={client.clientRef || "Not assigned"}
              />
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onDone}
              className={cx(
                "inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 text-sm font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/45 hover:bg-[var(--soft)]",
                FOCUS_RING,
              )}
            >
              Back to clients
            </button>

            <button
              type="button"
              onClick={onOpen}
              style={{ background: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
              className={cx(
                "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition hover:brightness-[1.04]",
                FOCUS_RING,
              )}
            >
              <span style={{ color: GOLD_INK }}>Open workspace</span>
              <ArrowRight size={15} color={GOLD_INK} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}