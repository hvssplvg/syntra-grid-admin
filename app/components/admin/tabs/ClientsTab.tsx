/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
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
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react';

import ClientWorkspace from '../../clients/ClientWorkspace';

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type ClientStatus = 'LEAD' | 'ONBOARDING' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

type ClientPriority = 'STANDARD' | 'IMPORTANT' | 'STRATEGIC';

type ClientRelationship = 'CLIENT' | 'PARTNER' | 'STRATEGIC_PARTNER';

type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM';

type Currency = 'NGN' | 'GBP' | 'USD' | 'EUR';

type ContactRole =
  | 'GENERAL'
  | 'DECISION_MAKER'
  | 'EXECUTIVE'
  | 'OPERATIONS'
  | 'FINANCE'
  | 'TECHNICAL'
  | 'PRODUCT'
  | 'SUPPORT';

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
  error?: string;
};

type ClientOptionsResponse = {
  ok: boolean;
  accountOwners?: AccountOwner[];
  error?: string;
};

type ViewMode = 'grid' | 'list';

type SortKey = 'RECENT' | 'NAME' | 'PROJECTS' | 'VALUE' | 'ATTENTION';

type QuickFilter = 'ALL' | 'ATTENTION' | 'RENEWALS' | 'UNASSIGNED' | 'SUPPORT';

type ClientForm = {
  name: string;
  displayName: string;
  industry: string;
  description: string;
  country: string;
  city: string;
  websiteUrl: string;
  domain: string;
  domainAuto: boolean;
  status: ClientStatus;
  statusAuto: boolean;
  priority: ClientPriority;
  relationshipType: ClientRelationship;
  accountOwnerId: string;
  relationshipStartedAt: string;
  liveSince: string;
  billingCycle: BillingCycle;
  currency: Currency;
  currencyAuto: boolean;
  contractValue: string;
  renewalAt: string;
  contactFirstName: string;
  contactLastName: string;
  contactJobTitle: string;
  contactEmail: string;
  contactPhone: string;
  contactRole: ContactRole;
};

type FieldErrors = Partial<Record<keyof ClientForm, string>>;

type MenuItem = {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  external?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
};

type ToastState = {
  id: number;
  tone: 'success' | 'error';
  message: string;
} | null;

type Notify = (tone: 'success' | 'error', message: string) => void;

type DropdownOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  keywords?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
};

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const STORAGE_PREFIX = 'syntragrid.clients';
const DRAFT_KEY = `${STORAGE_PREFIX}.draft`;
const REFRESH_AFTER_MS = 60_000;
const RENEWAL_WINDOW_DAYS = 60;

const DEFAULT_FORM: ClientForm = {
  name: '',
  displayName: '',
  industry: '',
  description: '',
  country: 'Nigeria',
  city: '',
  websiteUrl: '',
  domain: '',
  domainAuto: true,
  status: 'ONBOARDING',
  statusAuto: true,
  priority: 'STANDARD',
  relationshipType: 'CLIENT',
  accountOwnerId: '',
  relationshipStartedAt: '',
  liveSince: '',
  billingCycle: 'ANNUAL',
  currency: 'NGN',
  currencyAuto: true,
  contractValue: '',
  renewalAt: '',
  contactFirstName: '',
  contactLastName: '',
  contactJobTitle: '',
  contactEmail: '',
  contactPhone: '',
  contactRole: 'GENERAL',
};

const STATUS_OPTIONS: Array<{ value: ClientStatus; label: string; hint: string }> = [
  { value: 'LEAD', label: 'Lead', hint: 'Talking, not signed' },
  { value: 'ONBOARDING', label: 'Onboarding', hint: 'Signed, setting up' },
  { value: 'ACTIVE', label: 'Active', hint: 'Live and working' },
  { value: 'PAUSED', label: 'Paused', hint: 'Work on hold' },
  { value: 'ARCHIVED', label: 'Archived', hint: 'No longer a client' },
];

const PRIORITY_OPTIONS: Array<{ value: ClientPriority; label: string }> = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'IMPORTANT', label: 'Important' },
  { value: 'STRATEGIC', label: 'Strategic' },
];

const RELATIONSHIP_OPTIONS: Array<{ value: ClientRelationship; label: string }> = [
  { value: 'CLIENT', label: 'Client' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'STRATEGIC_PARTNER', label: 'Strategic partner' },
];

const BILLING_OPTIONS: Array<{ value: BillingCycle; label: string }> = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'CUSTOM', label: 'Custom' },
];

const CURRENCY_OPTIONS: Array<DropdownOption<Currency>> = [
  { value: 'NGN', label: 'NGN', hint: 'Nigerian naira' },
  { value: 'GBP', label: 'GBP', hint: 'British pound' },
  { value: 'USD', label: 'USD', hint: 'US dollar' },
  { value: 'EUR', label: 'EUR', hint: 'Euro' },
];

const CONTACT_ROLE_OPTIONS: Array<DropdownOption<ContactRole>> = [
  { value: 'GENERAL', label: 'General' },
  { value: 'DECISION_MAKER', label: 'Decision maker' },
  { value: 'EXECUTIVE', label: 'Executive' },
  { value: 'OPERATIONS', label: 'Operations' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'SUPPORT', label: 'Support' },
];

const SORT_OPTIONS: Array<DropdownOption<SortKey>> = [
  { value: 'RECENT', label: 'Recently updated' },
  { value: 'NAME', label: 'Name A to Z' },
  { value: 'PROJECTS', label: 'Most projects' },
  { value: 'VALUE', label: 'Highest value' },
  { value: 'ATTENTION', label: 'Needs attention' },
];

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'ATTENTION', label: 'Needs attention' },
  { value: 'RENEWALS', label: 'Renewing soon' },
  { value: 'UNASSIGNED', label: 'No owner' },
  { value: 'SUPPORT', label: 'Open support' },
];

const COUNTRY_CURRENCY: Array<{ currency: Currency; words: string[] }> = [
  { currency: 'NGN', words: ['nigeria', 'ng'] },
  { currency: 'GBP', words: ['united kingdom', 'uk', 'england', 'scotland', 'wales', 'northern ireland', 'great britain', 'britain', 'gb'] },
  { currency: 'USD', words: ['united states', 'usa', 'us', 'america'] },
  {
    currency: 'EUR',
    words: ['ireland', 'germany', 'france', 'spain', 'italy', 'netherlands', 'belgium', 'portugal', 'austria', 'finland', 'greece', 'luxembourg'],
  },
];

const WIZARD_STEPS = [
  { id: 1, label: 'Company' },
  { id: 2, label: 'Relationship' },
  { id: 3, label: 'Contact' },
  { id: 4, label: 'Review' },
] as const;

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function personName(person: AccountOwner | null | undefined) {
  if (!person) return 'No owner';
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || person.email;
}

function clientTitle(client: Pick<ClientRecord, 'displayName' | 'name'>) {
  return client.displayName || client.name;
}

function timeOf(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatMoney(value: string | number, currency: Currency) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';

  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function formatCompactMoney(value: string | number, currency: Currency) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return null;

  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      notation: 'compact',
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
  if (days < 0) return 'Renewal overdue';
  if (days === 0) return 'Renews today';
  if (days === 1) return 'Renews tomorrow';
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
    reasons.push(`${client.openSupportCount} open support ${client.openSupportCount === 1 ? 'ticket' : 'tickets'}`);
  }

  if (client.status === 'PAUSED') reasons.push('Relationship paused');
  if (!client.accountOwner) reasons.push('No account owner');

  const days = daysUntil(client.renewalAt);
  if (days !== null && days < 0) reasons.push('Renewal date has passed');
  else if (days !== null && days <= 30) reasons.push(`Renews in ${days} days`);

  return reasons;
}

function attentionScore(client: ClientRecord) {
  const days = daysUntil(client.renewalAt);

  return (
    client.openSupportCount * 3 +
    (client.status === 'PAUSED' ? 2 : 0) +
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
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidUrl(value: string) {
  try {
    const url = new URL(normaliseUrl(value));
    return Boolean(url.hostname) && url.hostname.includes('.');
  } catch {
    return false;
  }
}

function domainFromUrl(value: string) {
  try {
    return new URL(normaliseUrl(value)).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function currencyForCountry(country: string): Currency | null {
  const key = country.trim().toLowerCase();
  if (!key) return null;

  for (const group of COUNTRY_CURRENCY) {
    if (group.words.includes(key)) return group.currency;
  }

  return null;
}

function todayInput() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function statusFromLiveDate(liveSince: string): ClientStatus {
  if (liveSince && liveSince <= todayInput()) return 'ACTIVE';
  return 'ONBOARDING';
}

function effective(form: ClientForm) {
  return {
    domain: form.domainAuto ? domainFromUrl(form.websiteUrl) || form.domain : form.domain,
    status: form.statusAuto ? statusFromLiveDate(form.liveSince) : form.status,
    currency: form.currencyAuto ? (currencyForCountry(form.country) ?? form.currency) : form.currency,
  };
}

function suggestRenewal(form: ClientForm) {
  const base = form.liveSince || form.relationshipStartedAt;
  if (!base || form.billingCycle === 'CUSTOM') return null;

  const date = new Date(`${base}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const months = form.billingCycle === 'MONTHLY' ? 1 : form.billingCycle === 'QUARTERLY' ? 3 : 12;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let guard = 0;
  do {
    date.setMonth(date.getMonth() + months);
    guard += 1;
  } while (date <= today && guard < 240);

  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function relativeSync(value: Date | null) {
  if (!value) return 'Not synced yet';
  const seconds = Math.round((Date.now() - value.getTime()) / 1000);
  if (seconds < 45) return 'Synced just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  return `Synced ${formatDate(value.toISOString())}`;
}

function statusStyle(status: ClientStatus) {
  switch (status) {
    case 'ACTIVE':
      return {
        badge: 'border-[color:var(--success-border,rgba(16,185,129,0.25))] bg-[var(--success-soft,rgba(16,185,129,0.1))] text-[var(--success,#047857)]',
        dot: 'bg-[var(--success,#10b981)]',
      };
    case 'ONBOARDING':
      return { badge: 'border-blue-500/20 bg-blue-500/10 text-blue-700', dot: 'bg-blue-500' };
    case 'LEAD':
      return { badge: 'border-violet-500/20 bg-violet-500/10 text-violet-700', dot: 'bg-violet-500' };
    case 'PAUSED':
      return {
        badge: 'border-[color:var(--warning-border,rgba(245,158,11,0.25))] bg-[var(--warning-soft,rgba(245,158,11,0.1))] text-[var(--warning,#b45309)]',
        dot: 'bg-[var(--warning,#f59e0b)]',
      };
    case 'ARCHIVED':
      return { badge: 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]', dot: 'bg-[var(--text-subtle)]' };
  }
}

function buildCsv(clients: ClientRecord[]) {
  const headers = [
    'Reference',
    'Name',
    'Display name',
    'Status',
    'Priority',
    'Relationship',
    'Industry',
    'City',
    'Country',
    'Domain',
    'Account owner',
    'Projects',
    'Contacts',
    'Open support',
    'Billing cycle',
    'Currency',
    'Contract value',
    'Renewal',
  ];

  const rows = clients.map((client) => [
    client.clientRef ?? '',
    client.name,
    client.displayName ?? '',
    formatEnum(client.status),
    formatEnum(client.priority),
    formatEnum(client.relationshipType),
    client.industry ?? '',
    client.city ?? '',
    client.country ?? '',
    client.domain ?? '',
    client.accountOwner ? personName(client.accountOwner) : '',
    client._count.projects,
    client._count.contacts,
    client.openSupportCount,
    formatEnum(client.billingCycle),
    client.currency,
    client.contractValue,
    client.renewalAt ? formatDate(client.renewalAt) : '',
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function loadDraft(ownerFallback: string): { form: ClientForm; restored: boolean } {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ClientForm>;
      if (parsed && typeof parsed === 'object' && parsed.name?.trim()) {
        return {
          form: { ...DEFAULT_FORM, ...parsed, accountOwnerId: parsed.accountOwnerId || ownerFallback },
          restored: true,
        };
      }
    }
  } catch {
    // Storage is optional.
  }

  return { form: { ...DEFAULT_FORM, accountOwnerId: ownerFallback }, restored: false };
}

function validateStep(step: number, form: ClientForm, hasOwners: boolean): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 1) {
    if (!form.name.trim()) errors.name = 'Enter the company or organisation name.';
    if (form.websiteUrl.trim() && !isValidUrl(form.websiteUrl)) errors.websiteUrl = 'Enter a real web address, e.g. syntragrid.com';
  }

  if (step === 2) {
    if (!form.accountOwnerId && hasOwners) errors.accountOwnerId = 'Choose who owns this relationship.';
    if (form.contractValue.trim() && Number(form.contractValue) < 0) errors.contractValue = 'Cannot be negative.';
    if (form.relationshipStartedAt && form.liveSince && form.liveSince < form.relationshipStartedAt) {
      errors.liveSince = 'Cannot be before the relationship started.';
    }
  }

  if (step === 3) {
    const anyContact = Boolean(
      form.contactFirstName.trim() ||
        form.contactLastName.trim() ||
        form.contactEmail.trim() ||
        form.contactPhone.trim() ||
        form.contactJobTitle.trim(),
    );

    if (anyContact) {
      if (!form.contactFirstName.trim()) errors.contactFirstName = 'Enter a first name.';
      if (!form.contactLastName.trim()) errors.contactLastName = 'Enter a last name.';
      if (form.contactEmail.trim() && !isValidEmail(form.contactEmail)) errors.contactEmail = 'Enter a valid email.';
    }
  }

  return errors;
}

/* =============================================================================
 * HOOKS
 * =============================================================================
 */

function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
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

/* =============================================================================
 * CLIENTS TAB
 * =============================================================================
 */

export default function ClientsTab() {
  const reduceMotion = useReducedMotion();
  const theme = useThemeBridge();

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [accountOwners, setAccountOwners] = useState<AccountOwner[]>([]);

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);

  const [statusFilter, setStatusFilter] = usePersistentState<'ALL' | ClientStatus>(`${STORAGE_PREFIX}.status`, 'ALL');
  const [priorityFilter, setPriorityFilter] = usePersistentState<'ALL' | ClientPriority>(`${STORAGE_PREFIX}.priority`, 'ALL');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');
  const [sortKey, setSortKey] = usePersistentState<SortKey>(`${STORAGE_PREFIX}.sort`, 'RECENT');
  const [viewMode, setViewMode] = usePersistentState<ViewMode>(`${STORAGE_PREFIX}.view`, 'grid');

  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [toast, setToast] = useState<ToastState>(null);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const syncRef = useRef<Date | null>(null);

  const notify = useCallback<Notify>((tone, message) => {
    setToast({ id: Date.now(), tone, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ---------- Data ---------- */

  const loadClients = useCallback(
    async (silent = false) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/admin/clients', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        const payload = (await response.json().catch(() => ({ ok: false }))) as ClientsResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || 'Clients could not be loaded.');
        }

        setClients(payload.clients ?? []);
        const now = new Date();
        syncRef.current = now;
        setLastSyncedAt(now);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        const message = cause instanceof Error ? cause.message : 'Clients could not be loaded.';
        if (silent) notify('error', message);
        else setError(message);
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [notify],
  );

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);

    try {
      const response = await fetch('/api/admin/client-options', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      const payload = (await response.json().catch(() => ({ ok: false }))) as ClientOptionsResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Client options could not be loaded.');
      }

      setAccountOwners(payload.accountOwners ?? []);
    } catch (cause) {
      console.error('[ClientsTab/client-options]', cause);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
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
      if (document.visibilityState !== 'visible') return;
      const last = syncRef.current?.getTime() ?? 0;
      if (Date.now() - last < REFRESH_AFTER_MS) return;
      void loadClients(true);
    };

    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', maybeRefresh);

    return () => {
      window.removeEventListener('focus', maybeRefresh);
      document.removeEventListener('visibilitychange', maybeRefresh);
    };
  }, [loadClients]);

  /* ---------- Actions ---------- */

  const openAdd = useCallback(() => {
    setAddKey((key) => key + 1);
    setAddOpen(true);
  }, []);

  const openClient = useCallback((clientId: string) => {
    setAddOpen(false);
    setSelectedClientId(clientId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const copyValue = useCallback(
    async (value: string, message: string) => {
      try {
        await navigator.clipboard.writeText(value);
        notify('success', message);
      } catch {
        notify('error', 'Copy failed. Check clipboard permissions.');
      }
    },
    [notify],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (addOpen || selectedClientId || event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      const typing =
        !!target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

      if ((event.key === '/' && !typing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openAdd();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addOpen, openAdd, selectedClientId]);

  /* ---------- Derived ---------- */

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = clients.filter((client) => {
      if (statusFilter !== 'ALL' && client.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && client.priority !== priorityFilter) return false;
      if (quickFilter === 'ATTENTION' && !needsAttention(client)) return false;
      if (quickFilter === 'RENEWALS' && !isRenewalDue(client.renewalAt)) return false;
      if (quickFilter === 'UNASSIGNED' && client.accountOwner) return false;
      if (quickFilter === 'SUPPORT' && client.openSupportCount === 0) return false;
      if (!query) return true;

      return [
        client.name,
        client.displayName,
        client.clientRef,
        client.industry,
        client.country,
        client.city,
        client.domain,
        client.accountOwner ? personName(client.accountOwner) : '',
        ...client.projects.map((project) => project.name),
        ...client.contacts.map((contact) => `${contact.firstName} ${contact.lastName} ${contact.email ?? ''}`),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    return filtered.sort((a, b) => {
      switch (sortKey) {
        case 'NAME':
          return clientTitle(a).localeCompare(clientTitle(b));
        case 'PROJECTS':
          return b._count.projects - a._count.projects;
        case 'VALUE':
          return Number(b.contractValue || 0) - Number(a.contractValue || 0);
        case 'ATTENTION':
          return attentionScore(b) - attentionScore(a);
        default:
          return timeOf(b.updatedAt) - timeOf(a.updatedAt);
      }
    });
  }, [clients, priorityFilter, quickFilter, search, sortKey, statusFilter]);

  const metrics = useMemo(() => {
    const byStatus = (status: ClientStatus) => clients.filter((client) => client.status === status).length;

    return {
      total: clients.length,
      active: byStatus('ACTIVE'),
      onboarding: byStatus('ONBOARDING'),
      projects: clients.reduce((total, client) => total + client._count.projects, 0),
      attention: clients.filter(needsAttention).length,
      renewals: clients.filter((client) => isRenewalDue(client.renewalAt)).length,
      unassigned: clients.filter((client) => !client.accountOwner).length,
      support: clients.filter((client) => client.openSupportCount > 0).length,
      byStatus,
    };
  }, [clients]);

  const filtersActive =
    Boolean(searchInput) || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || quickFilter !== 'ALL';

  const syncedLabel = useMemo(
    () => relativeSync(lastSyncedAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastSyncedAt, clockTick],
  );

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setQuickFilter('ALL');
  }, [setPriorityFilter, setStatusFilter]);

  const exportCsv = useCallback(() => {
    if (visibleClients.length === 0) {
      notify('error', 'Nothing to export in this view.');
      return;
    }

    downloadCsv(`syntra_grid_clients_${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(visibleClients));
    notify('success', `Exported ${visibleClients.length} ${visibleClients.length === 1 ? 'client' : 'clients'}`);
  }, [notify, visibleClients]);

  const statusOptions = useMemo<Array<DropdownOption<'ALL' | ClientStatus>>>(
    () => [
      {
        value: 'ALL',
        label: 'All statuses',
        leading: <span className="h-2 w-2 rounded-full border border-[var(--text-subtle)]" />,
        trailing: <CountPill value={clients.length} />,
      },
      ...STATUS_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        leading: <span className={cx('h-2 w-2 rounded-full', statusStyle(option.value).dot)} />,
        trailing: <CountPill value={metrics.byStatus(option.value)} />,
      })),
    ],
    [clients.length, metrics],
  );

  const priorityOptions: Array<DropdownOption<'ALL' | ClientPriority>> = [
    { value: 'ALL', label: 'All priorities' },
    ...PRIORITY_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      leading: <PriorityStars priority={option.value} />,
    })),
  ];

  const quickCounts: Record<QuickFilter, number | undefined> = {
    ALL: undefined,
    ATTENTION: metrics.attention,
    RENEWALS: metrics.renewals,
    UNASSIGNED: metrics.unassigned,
    SUPPORT: metrics.support,
  };

  /* ---------- Render ---------- */

  let content: ReactNode;

  if (selectedClientId) {
    content = <ClientWorkspace clientId={selectedClientId} onBack={() => setSelectedClientId(null)} />;
  } else {
    content = (
      <>
        <section className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
          <MetricsGrid
            columns="grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6"
            items={[
              { label: 'Clients', value: metrics.total, helper: 'In the portfolio', icon: Building2 },
              {
                label: 'Active',
                value: metrics.active,
                helper: 'Live and working',
                icon: CheckCircle2,
                active: statusFilter === 'ACTIVE',
                onClick: () => setStatusFilter((current) => (current === 'ACTIVE' ? 'ALL' : 'ACTIVE')),
              },
              {
                label: 'Onboarding',
                value: metrics.onboarding,
                helper: 'Setting up',
                icon: Sparkles,
                active: statusFilter === 'ONBOARDING',
                onClick: () => setStatusFilter((current) => (current === 'ONBOARDING' ? 'ALL' : 'ONBOARDING')),
              },
              { label: 'Projects', value: metrics.projects, helper: 'Across all clients', icon: BriefcaseBusiness },
              {
                label: 'Renewals',
                value: metrics.renewals,
                helper: `Next ${RENEWAL_WINDOW_DAYS} days`,
                icon: CalendarClock,
                highlight: metrics.renewals > 0,
                active: quickFilter === 'RENEWALS',
                onClick: () => setQuickFilter((current) => (current === 'RENEWALS' ? 'ALL' : 'RENEWALS')),
              },
              {
                label: 'Attention',
                value: metrics.attention,
                helper: 'Need a look',
                icon: AlertCircle,
                highlight: metrics.attention > 0,
                active: quickFilter === 'ATTENTION',
                onClick: () => setQuickFilter((current) => (current === 'ATTENTION' ? 'ALL' : 'ATTENTION')),
              },
            ]}
          />

          <div className="border-t border-[var(--line)] px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
              <div className="relative min-w-0 flex-1 2xl:max-w-[400px]">
                <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
                <input
                  ref={searchRef}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setSearchInput('');
                  }}
                  placeholder="Search clients, people, projects or places"
                  aria-label="Search clients"
                  className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-10 pr-12 text-[11px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:bg-[var(--surface)]"
                />
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      searchRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className={cx('absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-subtle)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]', focusRing)}
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[8px] font-semibold text-[var(--text-subtle)] sm:inline-flex">
                    /
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Dropdown value={statusFilter} onChange={setStatusFilter} options={statusOptions} ariaLabel="Filter by status" triggerClassName="sm:w-[150px]" minWidth={210} />
                <Dropdown value={priorityFilter} onChange={setPriorityFilter} options={priorityOptions} ariaLabel="Filter by priority" triggerClassName="sm:w-[150px]" minWidth={190} />
                <Dropdown value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} ariaLabel="Sort clients" triggerClassName="col-span-2 sm:col-span-1 sm:w-[170px]" minWidth={200} />
              </div>

              <div className="flex items-center justify-end gap-2 2xl:ml-auto">
                <ViewToggle value={viewMode} onChange={setViewMode} />

                <ToolbarIcon label="Export this view as CSV" onClick={exportCsv}>
                  <Download size={14} strokeWidth={1.9} />
                </ToolbarIcon>

                <ToolbarIcon label="Refresh clients" onClick={() => void loadClients(true)} disabled={refreshing}>
                  <RefreshCw size={14} strokeWidth={1.9} className={cx(refreshing && 'animate-spin')} />
                </ToolbarIcon>

                <button
                  type="button"
                  onClick={openAdd}
                  className={cx('inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] pl-4 pr-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90', focusRing)}
                >
                  <Plus size={15} strokeWidth={2} />
                  Add client
                  <kbd className="ml-1 hidden h-5 min-w-5 items-center justify-center rounded-md bg-white/15 px-1.5 text-[9px] font-semibold text-white/90 sm:inline-flex">N</kbd>
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-3">
              {QUICK_FILTERS.map((item) => {
                const active = quickFilter === item.value;
                const count = quickCounts[item.value];

                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setQuickFilter((current) => (current === item.value && item.value !== 'ALL' ? 'ALL' : item.value))}
                    className={cx(
                      'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold transition-colors',
                      active
                        ? 'border-[var(--accent)] bg-[var(--surface)] text-[var(--text)]'
                        : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]',
                      focusRing,
                    )}
                  >
                    {item.label}
                    {typeof count === 'number' && count > 0 ? <span className="tabular-nums text-[var(--text-subtle)]">{count}</span> : null}
                  </button>
                );
              })}

              <div className="ml-auto flex items-center gap-3 text-[10px] text-[var(--text-subtle)]">
                <span aria-live="polite">
                  <span className="font-semibold text-[var(--text)]">{visibleClients.length}</span>
                  {filtersActive && clients.length > 0 ? ` of ${clients.length}` : ''} {visibleClients.length === 1 ? 'client' : 'clients'}
                </span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">{syncedLabel}</span>
                {filtersActive ? (
                  <button type="button" onClick={resetFilters} className={cx('rounded font-semibold text-[var(--accent)] hover:opacity-80', focusRing)}>
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5">
          {loading ? (
            <LoadingState view={viewMode} />
          ) : error ? (
            <ErrorState title="Clients could not be loaded" message={error} onRetry={() => void loadClients()} />
          ) : clients.length === 0 ? (
            <EmptyState
              icon={<Building2 size={21} strokeWidth={1.7} />}
              title="Build your client portfolio"
              description="Add the organisations Syntra Grid works with. Projects, systems, support and commercial activity all connect back to one client record."
              action={
                <PrimaryButton onClick={openAdd}>
                  <Plus size={13} />
                  Add first client
                </PrimaryButton>
              }
            />
          ) : visibleClients.length === 0 ? (
            <EmptyState
              icon={<Search size={20} strokeWidth={1.7} />}
              title={searchInput ? `Nothing matches "${searchInput}"` : 'No clients match these filters'}
              description="Try a different search, or clear the filters to see the whole portfolio."
              action={
                <SecondaryButton onClick={resetFilters}>
                  <X size={13} />
                  Clear filters
                </SecondaryButton>
              }
            />
          ) : viewMode === 'grid' ? (
            <div className={cx('grid gap-3 md:grid-cols-2 2xl:grid-cols-3', refreshing && 'opacity-80 transition-opacity')}>
              <AnimatePresence mode="popLayout" initial={false}>
                {visibleClients.map((client) => (
                  <motion.div
                    key={client.id}
                    layout={!reduceMotion}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 380, damping: 34 }}
                  >
                    <ClientCard client={client} onCopy={copyValue} onOpen={openClient} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <ClientList clients={visibleClients} onCopy={copyValue} onOpen={openClient} />
          )}
        </div>
      </>
    );
  }

  return (
    <PortalTheme.Provider value={theme.vars}>
      <div ref={theme.ref} className="mx-auto w-full min-w-0 max-w-[1600px]">
        {content}

        <AddClientModal
          open={addOpen}
          formKey={addKey}
          accountOwners={accountOwners}
          optionsLoading={optionsLoading}
          onClose={() => setAddOpen(false)}
          onCreated={(client) => {
            setClients((current) => [client, ...current.filter((item) => item.id !== client.id)]);
            notify('success', `${clientTitle(client)} added to the portfolio`);
            void loadClients(true);
          }}
          onOpen={openClient}
          onAddAnother={() => setAddKey((key) => key + 1)}
        />

        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </PortalTheme.Provider>
  );
}

/* =============================================================================
 * METRICS
 * =============================================================================
 */

function MetricsGrid({
  items,
  columns,
}: {
  items: Array<{
    label: string;
    value: string | number;
    helper: string;
    icon: LucideIcon;
    onClick?: () => void;
    active?: boolean;
    highlight?: boolean;
  }>;
  columns: string;
}) {
  return (
    <div className={cx('grid gap-px bg-[var(--line)]', columns)}>
      {items.map((metric) => {
        const Icon = metric.icon;

        const inner = (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">{metric.label}</p>
              <p className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-[-0.04em] text-[var(--text)]">{metric.value}</p>
              <p className="mt-0.5 truncate text-[9px] text-[var(--text-subtle)]">{metric.helper}</p>
            </div>
            <div
              className={cx(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                metric.highlight || metric.active
                  ? 'border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)] group-hover:text-[var(--accent)]',
              )}
            >
              <Icon size={15} strokeWidth={1.8} />
            </div>
          </div>
        );

        if (!metric.onClick) {
          return (
            <div key={metric.label} className="min-w-0 bg-[var(--surface)] px-4 py-4 sm:px-5">
              {inner}
            </div>
          );
        }

        return (
          <button
            key={metric.label}
            type="button"
            onClick={metric.onClick}
            aria-pressed={metric.active}
            className={cx(
              'group relative min-w-0 px-4 py-4 text-left transition-colors sm:px-5',
              metric.active ? 'bg-[color:var(--accent)]/[0.06]' : 'bg-[var(--surface)] hover:bg-[var(--surface-muted)]',
              'focus-visible:bg-[var(--surface-muted)] focus-visible:outline-none',
            )}
          >
            {metric.active ? <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" /> : null}
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/* =============================================================================
 * TOOLBAR BITS
 * =============================================================================
 */

function ToolbarIcon({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx(
        'flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  const reduceMotion = useReducedMotion();
  const id = useId();

  const items: Array<{ value: ViewMode; label: string; icon: ReactNode }> = [
    { value: 'grid', label: 'Grid view', icon: <Grid2X2 size={14} strokeWidth={1.9} /> },
    { value: 'list', label: 'List view', icon: <LayoutList size={15} strokeWidth={1.9} /> },
  ];

  return (
    <div className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1">
      {items.map((item) => {
        const active = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-label={item.label}
            aria-pressed={active}
            className={cx(
              'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              active ? 'text-[var(--text)]' : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
              focusRing,
            )}
          >
            {active ? (
              <motion.span
                layoutId={`${id}-view`}
                className="absolute inset-0 rounded-lg bg-[var(--surface)] shadow-sm"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
              />
            ) : null}
            <span className="relative">{item.icon}</span>
          </button>
        );
      })}
    </div>
  );
}

/* =============================================================================
 * ACTION MENU
 * =============================================================================
 */

function ActionMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const reduceMotion = useReducedMotion();
  const isClient = useIsClient();
  const portalTheme = useContext(PortalTheme);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState<{ top?: number; bottom?: number; right: number; placement: 'top' | 'bottom' } | null>(null);

  const open = Boolean(position);

  const close = useCallback((refocus = false) => {
    setPosition(null);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const estimate = items.length * 36 + 16;
    const flip = rect.bottom + estimate + 12 > window.innerHeight && rect.top > estimate;

    setPosition({
      right: Math.max(8, window.innerWidth - rect.right),
      placement: flip ? 'top' : 'bottom',
      ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };

    const onScroll = () => close();

    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    });

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [close, open]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const list = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    const index = list.indexOf(document.activeElement as HTMLElement);
    list[(index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
  };

  const itemClass =
    'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[10.5px] font-medium text-[var(--text-muted)] outline-none transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus-visible:bg-[var(--surface-muted)] focus-visible:text-[var(--text)]';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        className={cx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
          open && 'bg-[var(--surface-muted)] text-[var(--text)]',
          focusRing,
        )}
      >
        <MoreHorizontal size={16} />
      </button>

      {isClient
        ? createPortal(
            <AnimatePresence>
              {position ? (
                <motion.div
                  ref={panelRef}
                  role="menu"
                  aria-label={label}
                  onKeyDown={onMenuKeyDown}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: position.placement === 'top' ? 4 : -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
                  transition={reduceMotion ? { duration: 0.1 } : { type: 'spring', stiffness: 520, damping: 34 }}
                  style={{
                    ...portalTheme,
                    position: 'fixed',
                    right: position.right,
                    top: position.top,
                    bottom: position.bottom,
                    transformOrigin: position.placement === 'top' ? 'bottom right' : 'top right',
                  }}
                  className="z-[90] w-[220px] overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl"
                >
                  {items.map((item) => {
                    const content = (
                      <>
                        <span className="shrink-0 text-[var(--text-subtle)]">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                        {item.external ? <ExternalLink size={10} className="ml-auto shrink-0 opacity-50" /> : null}
                      </>
                    );

                    if (item.href && !item.disabled) {
                      return (
                        <a
                          key={item.key}
                          role="menuitem"
                          href={item.href}
                          target={item.external ? '_blank' : undefined}
                          rel={item.external ? 'noopener noreferrer' : undefined}
                          onClick={() => close()}
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
                        aria-disabled={item.disabled || undefined}
                        disabled={item.disabled}
                        onClick={() => {
                          close();
                          item.onSelect?.();
                        }}
                        className={cx(itemClass, item.disabled && 'pointer-events-none opacity-40')}
                      >
                        {content}
                      </button>
                    );
                  })}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

function clientMenuItems(
  client: ClientRecord,
  onCopy: (value: string, message: string) => void,
  onOpen: (clientId: string) => void,
): MenuItem[] {
  const contact = client.contacts.find((item) => item.primary) ?? client.contacts[0];

  const items: MenuItem[] = [
    { key: 'open', label: 'Open workspace', icon: <ArrowRight size={13} />, onSelect: () => onOpen(client.id) },
  ];

  if (client.websiteUrl) {
    items.push({ key: 'website', label: 'Visit website', icon: <Globe2 size={13} />, href: client.websiteUrl, external: true });
  }

  if (client.adminUrl) {
    items.push({ key: 'admin', label: 'Open their admin', icon: <ShieldCheck size={13} />, href: client.adminUrl, external: true });
  }

  if (contact?.email) {
    items.push({ key: 'email', label: `Email ${contact.firstName}`, icon: <Mail size={13} />, href: `mailto:${contact.email}` });
    items.push({
      key: 'copy-email',
      label: 'Copy contact email',
      icon: <Copy size={13} />,
      onSelect: () => onCopy(contact.email as string, 'Contact email copied'),
    });
  }

  if (contact?.phone) {
    items.push({ key: 'phone', label: `Call ${contact.firstName}`, icon: <Phone size={13} />, href: `tel:${contact.phone}` });
  }

  items.push({
    key: 'copy-ref',
    label: 'Copy client reference',
    icon: <Copy size={13} />,
    disabled: !client.clientRef,
    onSelect: () => onCopy(client.clientRef ?? '', 'Client reference copied'),
  });

  return items;
}

/* =============================================================================
 * CLIENT CARD
 * =============================================================================
 */

function ClientCard({
  client,
  onCopy,
  onOpen,
}: {
  client: ClientRecord;
  onCopy: (value: string, message: string) => void;
  onOpen: (clientId: string) => void;
}) {
  const title = clientTitle(client);
  const location = [client.city, client.country].filter(Boolean).join(', ');
  const reasons = attentionReasons(client);
  const renewal = renewalLabel(client.renewalAt);
  const renewalSoon = isRenewalDue(client.renewalAt);
  const value = formatCompactMoney(client.contractValue, client.currency);

  return (
    <article className="group flex h-full flex-col rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-[color:var(--text-subtle)]/40 hover:shadow-md">
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpen(client.id)}
            className={cx('flex min-w-0 items-center gap-3 rounded-xl text-left', focusRing)}
          >
            <ClientLogo client={client} />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <h3 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</h3>
                {client.integrationLive ? (
                  <ShieldCheck size={13} className="shrink-0 text-[var(--accent)]" aria-label="Integration live" />
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[10px] text-[var(--text-subtle)]">
                {client.industry || 'Industry not set'}
                {client.clientRef ? ` · ${client.clientRef}` : ''}
              </p>
            </div>
          </button>

          <ActionMenu label={`Actions for ${title}`} items={clientMenuItems(client, onCopy, onOpen)} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={client.status} />
          {client.priority !== 'STANDARD' ? <PriorityBadge priority={client.priority} /> : null}
          {client.relationshipType !== 'CLIENT' ? <Chip>{formatEnum(client.relationshipType)}</Chip> : null}
        </div>

        <p className="mt-3 line-clamp-2 min-h-[40px] text-[11px] leading-5 text-[var(--text-muted)]">
          {client.description || 'No description yet. Add a short summary so the team knows what we do for them.'}
        </p>

        <div className="mb-4 mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-[var(--text-subtle)]">
          {location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} />
              {location}
            </span>
          ) : null}
          {client.domain ? (
            <span className="inline-flex items-center gap-1">
              <Globe2 size={11} />
              {client.domain}
            </span>
          ) : null}
          {value ? (
            <span className="inline-flex items-center gap-1">
              <CircleDollarSign size={11} />
              {value} {client.billingCycle !== 'CUSTOM' ? formatEnum(client.billingCycle).toLowerCase() : ''}
            </span>
          ) : null}
          {renewal ? (
            <span className={cx('inline-flex items-center gap-1', renewalSoon && 'font-semibold text-[var(--warning,#b45309)]')}>
              <CalendarClock size={11} />
              {renewal}
            </span>
          ) : null}
        </div>

        <div className="mt-auto grid grid-cols-3 border-t border-[var(--line)] pt-4">
          <Stat label="Projects" value={client._count.projects} />
          <Stat label="Contacts" value={client._count.contacts} />
          <Stat label="Open support" value={client.openSupportCount} warn={client.openSupportCount > 0} />
        </div>

        {reasons.length ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--warning-soft,rgba(245,158,11,0.08))] px-3 py-2 text-[10px] leading-4 text-[var(--warning,#b45309)]">
            <AlertCircle size={12} className="mt-px shrink-0" />
            {reasons.join(' · ')}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <OwnerAvatar owner={client.accountOwner} />
          <p className="truncate text-[10px] text-[var(--text-subtle)]">
            {client.accountOwner ? (
              <>
                Owned by <span className="font-semibold text-[var(--text)]">{personName(client.accountOwner)}</span>
              </>
            ) : (
              'No account owner'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpen(client.id)}
          className={cx('inline-flex shrink-0 items-center gap-1 rounded-md text-[10px] font-semibold text-[var(--accent)] hover:opacity-80', focusRing)}
        >
          Open
          <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cx('text-[16px] font-semibold tabular-nums tracking-[-0.03em]', warn ? 'text-[var(--warning,#b45309)]' : 'text-[var(--text)]')}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">{label}</p>
    </div>
  );
}

function ClientLogo({ client, size = 'md' }: { client: Pick<ClientRecord, 'logoUrl' | 'displayName' | 'name'>; size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'h-9 w-9 rounded-[11px] text-[10px]', md: 'h-11 w-11 rounded-[14px] text-[12px]', lg: 'h-14 w-14 rounded-[18px] text-[15px]' }[size];

  if (client.logoUrl) {
    return (
      <span className={cx('shrink-0 overflow-hidden border border-[var(--line)] bg-white', box)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={client.logoUrl} alt="" className="h-full w-full object-contain p-1.5" />
      </span>
    );
  }

  const letters = initials(clientTitle(client));

  return (
    <span className={cx('flex shrink-0 items-center justify-center border border-[var(--line)] bg-[var(--surface-muted)] font-bold text-[var(--text)]', box)}>
      {letters || <Building2 size={size === 'lg' ? 20 : 15} strokeWidth={1.8} className="text-[var(--text-subtle)]" />}
    </span>
  );
}

function OwnerAvatar({ owner }: { owner: AccountOwner | null }) {
  if (owner?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={owner.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full border border-[var(--line)] object-cover" />
    );
  }

  return (
    <span
      title={personName(owner)}
      className={cx(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[8px] font-bold',
        owner ? 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]' : 'border-dashed border-[var(--line)] text-[var(--text-subtle)]',
      )}
    >
      {owner ? initials(personName(owner)) : <UserRound size={10} />}
    </span>
  );
}

function StatusBadge({ status, compact = false }: { status: ClientStatus; compact?: boolean }) {
  const style = statusStyle(status);

  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-bold uppercase tracking-[0.08em]',
        compact ? 'px-2 py-1 text-[7px]' : 'px-2.5 py-1 text-[8px]',
        style.badge,
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', style.dot)} />
      {formatEnum(status)}
    </span>
  );
}

function PriorityStars({ priority }: { priority: ClientPriority }) {
  const count = priority === 'STRATEGIC' ? 3 : priority === 'IMPORTANT' ? 2 : 1;

  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span key={index} className={cx('h-1.5 w-1.5 rounded-full', index < count ? 'bg-[var(--accent)]' : 'bg-[var(--line)]')} />
      ))}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ClientPriority }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--accent)]/35 bg-[color:var(--accent)]/10 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--text)]">
      <PriorityStars priority={priority} />
      {formatEnum(priority)}
    </span>
  );
}

/* =============================================================================
 * LIST
 * =============================================================================
 */

const LIST_GRID = 'lg:grid-cols-[minmax(240px,1.6fr)_minmax(150px,1fr)_120px_70px_80px_minmax(130px,0.8fr)_40px]';

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
    <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <div className={cx('hidden gap-4 border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-3 lg:grid', LIST_GRID)}>
        {['Client', 'Owner', 'Status', 'Projects', 'Support', 'Renewal', ''].map((label) => (
          <p key={label || 'actions'} className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
            {label}
          </p>
        ))}
      </div>

      <div className="divide-y divide-[var(--line)]">
        {clients.map((client) => {
          const renewal = renewalLabel(client.renewalAt);
          const renewalSoon = isRenewalDue(client.renewalAt);

          return (
            <div key={client.id} className={cx('grid gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-muted)] sm:px-5 lg:items-center lg:gap-4', LIST_GRID)}>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <button type="button" onClick={() => onOpen(client.id)} className={cx('flex min-w-0 items-center gap-3 rounded-xl text-left', focusRing)}>
                  <ClientLogo client={client} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-[var(--text)]">{clientTitle(client)}</p>
                    <p className="mt-0.5 truncate text-[9px] text-[var(--text-subtle)]">
                      {[client.industry, client.country].filter(Boolean).join(' · ') || 'Client'}
                    </p>
                  </div>
                </button>
                <div className="lg:hidden">
                  <ActionMenu label={`Actions for ${clientTitle(client)}`} items={clientMenuItems(client, onCopy, onOpen)} />
                </div>
              </div>

              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                <OwnerAvatar owner={client.accountOwner} />
                <span className={cx('truncate text-[10px] font-medium', client.accountOwner ? 'text-[var(--text-muted)]' : 'text-[var(--text-subtle)]')}>
                  {personName(client.accountOwner)}
                </span>
              </div>

              <div className="hidden lg:block">
                <StatusBadge status={client.status} compact />
              </div>

              <p className="hidden text-[10px] font-semibold tabular-nums text-[var(--text)] lg:block">{client._count.projects}</p>

              <p className={cx('hidden text-[10px] font-semibold tabular-nums lg:block', client.openSupportCount > 0 ? 'text-[var(--warning,#b45309)]' : 'text-[var(--text)]')}>
                {client.openSupportCount}
              </p>

              <p className={cx('hidden truncate text-[10px] lg:block', renewalSoon ? 'font-semibold text-[var(--warning,#b45309)]' : 'text-[var(--text-subtle)]')}>
                {renewal ?? 'No renewal set'}
              </p>

              <div className="hidden justify-end lg:flex">
                <ActionMenu label={`Actions for ${clientTitle(client)}`} items={clientMenuItems(client, onCopy, onOpen)} />
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:hidden">
                <StatusBadge status={client.status} compact />
                <span className="text-[9px] text-[var(--text-subtle)]">
                  {client._count.projects} projects · {personName(client.accountOwner)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LoadingState({ view }: { view: ViewMode }) {
  if (view === 'list') {
    return (
      <div className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)]">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex animate-pulse items-center gap-4 border-b border-[var(--line)] px-5 py-4 last:border-b-0 motion-reduce:animate-none">
            <div className="h-9 w-9 rounded-[11px] bg-[var(--surface-muted)]" />
            <div className="h-3 w-40 rounded bg-[var(--surface-muted)]" />
            <div className="ml-auto h-3 w-24 rounded bg-[var(--surface-muted)]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-[300px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 motion-reduce:animate-none">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[14px] bg-[var(--surface-muted)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-[var(--surface-muted)]" />
              <div className="h-2.5 w-1/3 rounded bg-[var(--surface-muted)]" />
            </div>
          </div>
          <div className="mt-6 h-3 w-full rounded bg-[var(--surface-muted)]" />
          <div className="mt-2 h-3 w-4/5 rounded bg-[var(--surface-muted)]" />
          <div className="mt-10 h-px bg-[var(--line)]" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="h-8 rounded bg-[var(--surface-muted)]" />
            <div className="h-8 rounded bg-[var(--surface-muted)]" />
            <div className="h-8 rounded bg-[var(--surface-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* =============================================================================
 * ADD CLIENT MODAL
 * =============================================================================
 */

function AddClientModal({
  open,
  formKey,
  accountOwners,
  optionsLoading,
  onClose,
  onCreated,
  onOpen,
  onAddAnother,
}: {
  open: boolean;
  formKey: number;
  accountOwners: AccountOwner[];
  optionsLoading: boolean;
  onClose: () => void;
  onCreated: (client: ClientRecord) => void;
  onOpen: (clientId: string) => void;
  onAddAnother: () => void;
}) {
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={titleId}>
      <AddClientWizard
        key={formKey}
        titleId={titleId}
        accountOwners={accountOwners}
        optionsLoading={optionsLoading}
        onClose={onClose}
        onCreated={onCreated}
        onOpen={onOpen}
        onAddAnother={onAddAnother}
      />
    </ModalShell>
  );
}

type FormUpdate = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => void;

function AddClientWizard({
  titleId,
  accountOwners,
  optionsLoading,
  onClose,
  onCreated,
  onOpen,
  onAddAnother,
}: {
  titleId: string;
  accountOwners: AccountOwner[];
  optionsLoading: boolean;
  onClose: () => void;
  onCreated: (client: ClientRecord) => void;
  onOpen: (clientId: string) => void;
  onAddAnother: () => void;
}) {
  const reduceMotion = useReducedMotion();

  const [initial] = useState(() => loadDraft(accountOwners[0]?.id ?? ''));
  const [form, setForm] = useState<ClientForm>(initial.form);
  const [draftRestored, setDraftRestored] = useState(initial.restored);
  const [[step, direction], setStepState] = useState<[number, number]>([1, 0]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [issue, setIssue] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ClientRecord | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  const isMac = useMemo(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform), []);

  useEffect(() => {
    if (!form.accountOwnerId && accountOwners[0]) {
      setForm((current) => (current.accountOwnerId ? current : { ...current, accountOwnerId: accountOwners[0].id }));
    }
  }, [accountOwners, form.accountOwnerId]);

  useEffect(() => {
    if (done.current) return;

    const timer = setTimeout(() => {
      try {
        if (form.name.trim()) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        else window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Storage is optional.
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form]);

  const update = useCallback<FormUpdate>((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
    setIssue(null);
  }, []);

  const goTo = useCallback((target: number) => {
    setStepState(([current]) => [target, target > current ? 1 : -1]);
    bodyRef.current?.scrollTo({ top: 0 });
  }, []);

  const hasOwners = accountOwners.length > 0;

  const next = useCallback(() => {
    const stepErrors = validateStep(step, form, hasOwners);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    goTo(Math.min(4, step + 1));
  }, [form, goTo, hasOwners, step]);

  const jump = (target: number) => {
    if (target <= step) {
      setErrors({});
      goTo(target);
      return;
    }

    for (let index = step; index < target; index += 1) {
      const stepErrors = validateStep(index, form, hasOwners);
      if (Object.keys(stepErrors).length) {
        setErrors(stepErrors);
        goTo(index);
        return;
      }
    }

    goTo(target);
  };

  const startOver = () => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage is optional.
    }
    setForm({ ...DEFAULT_FORM, accountOwnerId: accountOwners[0]?.id ?? '' });
    setDraftRestored(false);
    setErrors({});
    setIssue(null);
    goTo(1);
  };

  const submit = useCallback(async () => {
    for (const target of [1, 2, 3]) {
      const stepErrors = validateStep(target, form, hasOwners);
      if (Object.keys(stepErrors).length) {
        setErrors(stepErrors);
        goTo(target);
        return;
      }
    }

    setCreating(true);
    setIssue(null);

    const values = effective(form);
    const hasContact = Boolean(form.contactFirstName.trim() && form.contactLastName.trim());

    try {
      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          displayName: form.displayName.trim() || null,
          industry: form.industry.trim() || null,
          description: form.description.trim() || null,
          country: form.country.trim() || null,
          city: form.city.trim() || null,
          websiteUrl: form.websiteUrl.trim() ? normaliseUrl(form.websiteUrl) : null,
          domain: values.domain.trim() || null,
          status: values.status,
          priority: form.priority,
          relationshipType: form.relationshipType,
          accountOwnerId: form.accountOwnerId || null,
          relationshipStartedAt: form.relationshipStartedAt || null,
          liveSince: form.liveSince || null,
          billingCycle: form.billingCycle,
          currency: values.currency,
          contractValue: form.contractValue || 0,
          renewalAt: form.renewalAt || null,
          primaryContact: hasContact
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

      const payload = (await response.json().catch(() => ({ ok: false }))) as { ok: boolean; client?: ClientRecord; error?: string };

      if (!response.ok || !payload.ok || !payload.client) {
        throw new Error(payload.error || 'The client could not be created.');
      }

      done.current = true;
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Storage is optional.
      }

      setCreated(payload.client);
      onCreated(payload.client);
    } catch (cause) {
      setIssue(cause instanceof Error ? cause.message : 'The client could not be created.');
    } finally {
      setCreating(false);
    }
  }, [form, goTo, hasOwners, onCreated]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (creating) return;
    if (step < 4) next();
    else void submit();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (step < 4) next();
      else if (!creating) void submit();
    }
  };

  if (created) {
    return <CreatedState titleId={titleId} client={created} onClose={onClose} onOpen={() => onOpen(created.id)} onAddAnother={onAddAnother} />;
  }

  const title = form.displayName.trim() || form.name.trim();

  const slide = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: (dir: number) => ({ opacity: 0, x: dir * 28 }),
        animate: { opacity: 1, x: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
      };

  return (
    <form onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate className="flex max-h-[92dvh] min-h-0 flex-col sm:max-h-[min(88dvh,900px)]">
      <div className="border-b border-[var(--line)] px-5 pb-4 pt-4 sm:px-7 sm:pt-6">
        <div className="flex items-start gap-4">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={initials(title) || 'empty'}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
              className="flex"
            >
              <ClientLogo client={{ logoUrl: null, displayName: form.displayName, name: form.name }} size="lg" />
            </motion.span>
          </AnimatePresence>

          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              Add client
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
              {title
                ? [title, form.industry.trim(), [form.city.trim(), form.country.trim()].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
                : 'Create the organisation first. Projects and systems connect to it afterwards.'}
            </p>

            {draftRestored ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-2 py-1 text-[9px] text-[var(--text-muted)]">
                <RotateCcw size={10} />
                Picked up where you left off
                <button type="button" onClick={startOver} className={cx('rounded font-semibold text-[var(--accent)] hover:opacity-70', focusRing)}>
                  Start over
                </button>
              </div>
            ) : null}
          </div>

          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        <WizardStepper step={step} onJump={jump} />
      </div>

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-5 sm:px-7">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduceMotion ? { duration: 0.12 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 ? <CompanyStep form={form} errors={errors} update={update} /> : null}
            {step === 2 ? (
              <RelationshipStep form={form} errors={errors} update={update} accountOwners={accountOwners} optionsLoading={optionsLoading} />
            ) : null}
            {step === 3 ? <ContactStep form={form} errors={errors} update={update} /> : null}
            {step === 4 ? <ReviewStep form={form} accountOwners={accountOwners} onEdit={goTo} /> : null}
          </motion.div>
        </AnimatePresence>

        {issue ? (
          <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3 text-[10px] font-medium leading-5 text-red-600">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            {issue}
          </p>
        ) : null}
      </div>

      <div className="border-t border-[var(--line)] bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <p className="hidden items-center gap-1.5 text-[9px] text-[var(--text-subtle)] sm:flex">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>Enter</Kbd>
            {step < 4 ? 'to continue' : 'to create'}
            <span className="ml-2">Draft saves as you type</span>
          </p>

          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={
                step === 1
                  ? onClose
                  : () => {
                      setErrors({});
                      goTo(step - 1);
                    }
              }
              disabled={creating}
              className={cx('inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50 sm:flex-none', focusRing)}
            >
              {step === 1 ? null : <ArrowLeft size={13} />}
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            <button
              type="submit"
              disabled={creating}
              className={cx('inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[150px] sm:flex-none', focusRing)}
            >
              {step < 4 ? (
                <>
                  Continue
                  <ArrowRight size={13} />
                </>
              ) : creating ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Creating
                </>
              ) : (
                <>
                  <Check size={13} />
                  Create client
                </>
              )}
            </button>
          </div>
        </div>
      </div>

    </form>
  );
}

function WizardStepper({ step, onJump }: { step: number; onJump: (step: number) => void }) {
  const reduceMotion = useReducedMotion();

  return (
    <ol className="mt-5 grid grid-cols-4 gap-2">
      {WIZARD_STEPS.map((item) => {
        const active = step === item.id;
        const complete = step > item.id;

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onJump(item.id)}
              aria-current={active ? 'step' : undefined}
              className={cx('block w-full rounded-md text-left', focusRing)}
            >
              <span className="relative block h-1 overflow-hidden rounded-full bg-[var(--line)]">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
                  initial={false}
                  animate={{ width: complete || active ? '100%' : '0%' }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <span className={cx('mt-2 flex items-center gap-1 text-[10px] font-semibold', active || complete ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]')}>
                {complete ? <Check size={10} strokeWidth={2.6} className="text-[var(--accent)]" /> : <span className="tabular-nums">{item.id}.</span>}
                {item.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function AutoHint({ auto, onReset, label }: { auto: boolean; onReset: () => void; label: string }) {
  return auto ? (
    <span className="inline-flex items-center gap-1 text-[8px] font-semibold text-[var(--accent)]">
      <Wand2 size={9} />
      {label}
    </span>
  ) : (
    <button type="button" onClick={onReset} className={cx('inline-flex items-center gap-1 rounded text-[8px] font-semibold text-[var(--text-subtle)] hover:text-[var(--accent)]', focusRing)}>
      <RotateCcw size={9} />
      Reset to auto
    </button>
  );
}

function CompanyStep({ form, errors, update }: { form: ClientForm; errors: FieldErrors; update: FormUpdate }) {
  const values = effective(form);

  return (
    <div>
      <StepIntro icon={<Building2 size={16} />} title="Who is the client?" description="The organisation itself. Only the name is required." />

      <Field label="Company name" required error={errors.name} className="mt-5">
        <input
          data-autofocus
          value={form.name}
          onChange={(event) => update('name', event.target.value)}
          placeholder="Type the company name, e.g. RentWise Nigeria Ltd"
          autoComplete="off"
          aria-invalid={Boolean(errors.name)}
          className={cx(inputClass(errors.name), 'h-12 text-[14px] font-semibold')}
        />
      </Field>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Short name" hint="Shown across the dashboard">
          <input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} placeholder="RentWise" className={inputClass()} />
        </Field>
        <Field label="Industry">
          <input value={form.industry} onChange={(event) => update('industry', event.target.value)} placeholder="Property technology" className={inputClass()} />
        </Field>
        <Field label="Country">
          <input value={form.country} onChange={(event) => update('country', event.target.value)} placeholder="Nigeria" className={inputClass()} />
        </Field>
        <Field label="City">
          <input value={form.city} onChange={(event) => update('city', event.target.value)} placeholder="Abuja" className={inputClass()} />
        </Field>
        <Field label="Website" error={errors.websiteUrl}>
          <input
            value={form.websiteUrl}
            onChange={(event) => update('websiteUrl', event.target.value)}
            placeholder="rentwise.ng"
            inputMode="url"
            aria-invalid={Boolean(errors.websiteUrl)}
            className={inputClass(errors.websiteUrl)}
          />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[9px] font-semibold text-[var(--text-muted)]">Primary domain</span>
            <AutoHint auto={form.domainAuto} onReset={() => update('domainAuto', true)} label="From the website" />
          </div>
          <input
            value={values.domain}
            onChange={(event) => {
              update('domain', event.target.value);
              update('domainAuto', false);
            }}
            placeholder="rentwise.ng"
            className={inputClass()}
          />
        </div>
      </div>

      <Field label="What do we do for them?" hint="Optional" className="mt-4">
        <textarea
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          rows={3}
          maxLength={600}
          placeholder="A short summary the team will read on the client card"
          className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
        />
      </Field>
    </div>
  );
}

function RelationshipStep({
  form,
  errors,
  update,
  accountOwners,
  optionsLoading,
}: {
  form: ClientForm;
  errors: FieldErrors;
  update: FormUpdate;
  accountOwners: AccountOwner[];
  optionsLoading: boolean;
}) {
  const values = effective(form);
  const renewalSuggestion = suggestRenewal(form);
  const contractPreview = form.contractValue ? formatMoney(form.contractValue, values.currency) : null;

  const ownerOptions: Array<DropdownOption<string>> = accountOwners.length
    ? accountOwners.map((owner) => ({
        value: owner.id,
        label: personName(owner),
        hint: owner.role ? formatEnum(owner.role) : owner.email,
        keywords: owner.email,
        leading: <OwnerAvatar owner={owner} />,
      }))
    : [{ value: '', label: 'No eligible team members', disabled: true }];

  const statusOptions: Array<DropdownOption<ClientStatus>> = STATUS_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    hint: option.hint,
    leading: <span className={cx('h-2 w-2 rounded-full', statusStyle(option.value).dot)} />,
  }));

  return (
    <div>
      <StepIntro icon={<Users size={16} />} title="How do we work with them?" description="Who owns the relationship, where it stands and the commercial basics." />

      <Field label="Account owner" as="div" required hint="The person the client hears from first" error={errors.accountOwnerId} className="mt-5">
        <Dropdown
          value={form.accountOwnerId}
          onChange={(value) => update('accountOwnerId', value)}
          options={ownerOptions}
          ariaLabel="Account owner"
          searchable={ownerOptions.length > 6}
          searchPlaceholder="Search people"
          disabled={optionsLoading}
          loading={optionsLoading}
          minWidth={280}
        />
      </Field>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Relationship started">
          <input type="date" value={form.relationshipStartedAt} onChange={(event) => update('relationshipStartedAt', event.target.value)} className={cx(inputClass(), '[color-scheme:light]')} />
        </Field>
        <Field label="Went live" error={errors.liveSince} hint={form.liveSince ? undefined : 'Leave empty if not live yet'}>
          <input
            type="date"
            value={form.liveSince}
            min={form.relationshipStartedAt || undefined}
            onChange={(event) => update('liveSince', event.target.value)}
            aria-invalid={Boolean(errors.liveSince)}
            className={cx(inputClass(errors.liveSince), '[color-scheme:light]')}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[9px] font-semibold text-[var(--text-muted)]">Status</span>
            <AutoHint auto={form.statusAuto} onReset={() => update('statusAuto', true)} label="Set from the live date" />
          </div>
          <Dropdown
            value={values.status}
            onChange={(value) => setBoth(update, 'status', value, 'statusAuto')}
            options={statusOptions}
            ariaLabel="Status"
            minWidth={240}
          />
        </div>

        <Field label="Relationship" as="div">
          <Dropdown
            value={form.relationshipType}
            onChange={(value) => update('relationshipType', value)}
            options={RELATIONSHIP_OPTIONS}
            ariaLabel="Relationship type"
          />
        </Field>
      </div>

      <Field label="Priority" as="div" className="mt-4">
        <Segmented
          value={form.priority}
          onChange={(value) => update('priority', value)}
          ariaLabel="Priority"
          options={PRIORITY_OPTIONS.map((option) => ({ ...option, leading: <PriorityStars priority={option.value} /> }))}
        />
      </Field>

      <div className="mt-6 rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text)]">
            <CircleDollarSign size={13} className="text-[var(--accent)]" />
            Commercial snapshot
          </p>
          {contractPreview ? (
            <p className="text-[10px] font-semibold text-[var(--text-muted)]">
              {contractPreview} {form.billingCycle !== 'CUSTOM' ? formatEnum(form.billingCycle).toLowerCase() : ''}
            </p>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Billing cycle" as="div">
            <Dropdown value={form.billingCycle} onChange={(value) => update('billingCycle', value)} options={BILLING_OPTIONS} ariaLabel="Billing cycle" />
          </Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[9px] font-semibold text-[var(--text-muted)]">Currency</span>
              <AutoHint auto={form.currencyAuto} onReset={() => update('currencyAuto', true)} label="Matched to the country" />
            </div>
            <Dropdown
              value={values.currency}
              onChange={(value) => setBoth(update, 'currency', value, 'currencyAuto')}
              options={CURRENCY_OPTIONS}
              ariaLabel="Currency"
            />
          </div>

          <Field label="Contract value" error={errors.contractValue}>
            <input
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={form.contractValue}
              onChange={(event) => update('contractValue', event.target.value)}
              placeholder="0"
              aria-invalid={Boolean(errors.contractValue)}
              className={cx(inputClass(errors.contractValue), 'bg-white tabular-nums')}
            />
          </Field>

          <div>
            <Field label="Renewal date">
              <input type="date" value={form.renewalAt} onChange={(event) => update('renewalAt', event.target.value)} className={cx(inputClass(), 'bg-white [color-scheme:light]')} />
            </Field>
            {renewalSuggestion && !form.renewalAt ? (
              <button
                type="button"
                onClick={() => update('renewalAt', renewalSuggestion)}
                className={cx('mt-1.5 inline-flex items-center gap-1 rounded-md text-[9px] font-semibold text-[var(--accent)] hover:opacity-70', focusRing)}
              >
                <Wand2 size={10} />
                Use {formatDate(renewalSuggestion)}
              </button>
            ) : null}
          </div>
        </div>

        <p className="mt-3 text-[9.5px] leading-4 text-[var(--text-subtle)]">
          Only enter a genuine fixed amount. Revenue share, equity or other arrangements belong in Commercial.
        </p>
      </div>
    </div>
  );
}

function setBoth<K extends keyof ClientForm, A extends keyof ClientForm>(update: FormUpdate, key: K, value: ClientForm[K], autoKey: A) {
  update(key, value);
  update(autoKey, false as ClientForm[A]);
}

function ContactStep({ form, errors, update }: { form: ClientForm; errors: FieldErrors; update: FormUpdate }) {
  return (
    <div>
      <StepIntro
        icon={<UserRound size={16} />}
        title="Who do we speak to?"
        description="Optional. The person we deal with most. Leave it empty to add contacts later."
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.contactFirstName}>
          <input value={form.contactFirstName} onChange={(event) => update('contactFirstName', event.target.value)} placeholder="First name" aria-invalid={Boolean(errors.contactFirstName)} className={inputClass(errors.contactFirstName)} />
        </Field>
        <Field label="Last name" error={errors.contactLastName}>
          <input value={form.contactLastName} onChange={(event) => update('contactLastName', event.target.value)} placeholder="Last name" aria-invalid={Boolean(errors.contactLastName)} className={inputClass(errors.contactLastName)} />
        </Field>
        <Field label="Job title">
          <input value={form.contactJobTitle} onChange={(event) => update('contactJobTitle', event.target.value)} placeholder="Managing Director" className={inputClass()} />
        </Field>
        <Field label="Their role for us" as="div">
          <Dropdown value={form.contactRole} onChange={(value) => update('contactRole', value)} options={CONTACT_ROLE_OPTIONS} ariaLabel="Contact role" />
        </Field>
        <Field label="Email" error={errors.contactEmail}>
          <input type="email" value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} placeholder="name@company.com" aria-invalid={Boolean(errors.contactEmail)} className={inputClass(errors.contactEmail)} />
        </Field>
        <Field label="Phone">
          <input type="tel" value={form.contactPhone} onChange={(event) => update('contactPhone', event.target.value)} placeholder={form.country.trim().toLowerCase() === 'nigeria' ? '+234' : '+44'} className={inputClass()} />
        </Field>
      </div>
    </div>
  );
}

function ReviewStep({ form, accountOwners, onEdit }: { form: ClientForm; accountOwners: AccountOwner[]; onEdit: (step: number) => void }) {
  const values = effective(form);
  const owner = accountOwners.find((item) => item.id === form.accountOwnerId) ?? null;
  const hasContact = Boolean(form.contactFirstName.trim() && form.contactLastName.trim());
  const title = form.displayName.trim() || form.name.trim() || 'Unnamed client';

  return (
    <div>
      <StepIntro icon={<Check size={16} />} title="Check everything looks right" description="Anything here can be changed later in the client workspace." />

      <div className="mt-5 flex items-center gap-4 rounded-[18px] border border-[var(--line)] p-4">
        <ClientLogo client={{ logoUrl: null, displayName: form.displayName, name: form.name }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</p>
          <p className="truncate text-[10px] text-[var(--text-subtle)]">
            {[form.industry, form.city, form.country].filter(Boolean).join(' · ') || 'No company details'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={values.status} compact />
          {form.priority !== 'STANDARD' ? <PriorityBadge priority={form.priority} /> : null}
        </div>
      </div>

      <div className="mt-4 divide-y divide-[var(--line)] rounded-[18px] border border-[var(--line)]">
        <ReviewRow label="Website" value={values.domain || 'Not set'} onEdit={() => onEdit(1)} />
        <ReviewRow label="Account owner" value={owner ? personName(owner) : 'Not set'} onEdit={() => onEdit(2)} />
        <ReviewRow label="Relationship" value={formatEnum(form.relationshipType)} onEdit={() => onEdit(2)} />
        <ReviewRow
          label="Commercial"
          value={`${form.contractValue ? formatMoney(form.contractValue, values.currency) : values.currency}, ${formatEnum(form.billingCycle).toLowerCase()}`}
          onEdit={() => onEdit(2)}
        />
        <ReviewRow label="Renewal" value={form.renewalAt ? formatDate(form.renewalAt) : 'Not set'} onEdit={() => onEdit(2)} />
        <ReviewRow label="Primary contact" value={hasContact ? `${form.contactFirstName.trim()} ${form.contactLastName.trim()}` : 'Add later'} onEdit={() => onEdit(3)} />
      </div>

      <p className="mt-4 flex items-start gap-2 text-[10px] leading-5 text-[var(--text-subtle)]">
        <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" />
        This creates the client record only. Projects, repositories, deployments and databases are connected separately.
      </p>
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-[10px] text-[var(--text-subtle)]">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-right text-[11px] font-semibold text-[var(--text)]">{value}</span>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${label.toLowerCase()}`}
            className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--accent)]', focusRing)}
          >
            <Pencil size={10} />
          </button>
        ) : null}
      </span>
    </div>
  );
}

function CreatedState({
  titleId,
  client,
  onClose,
  onOpen,
  onAddAnother,
}: {
  titleId: string;
  client: ClientRecord;
  onClose: () => void;
  onOpen: () => void;
  onAddAnother: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="px-6 pb-7 pt-8 text-center sm:px-10 sm:pt-10">
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 20 }}
        className="relative mx-auto w-fit"
      >
        <ClientLogo client={client} size="lg" />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[var(--success,#10b981)] text-white">
          <Check size={12} strokeWidth={3} />
        </span>
      </motion.div>

      <h2 id={titleId} className="mt-5 text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]">
        {clientTitle(client)} is in the portfolio
      </h2>
      <p className="mx-auto mt-1.5 max-w-[380px] text-[11px] leading-5 text-[var(--text-muted)]">
        {client.clientRef ? `Reference ${client.clientRef}. ` : ''}
        Projects, systems, support and commercial records can now connect to it.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" data-autofocus onClick={onOpen} className={cx('inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90', focusRing)}>
          Open workspace
          <ArrowRight size={13} />
        </button>
        <button type="button" onClick={onAddAnother} className={cx('inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)]', focusRing)}>
          <Plus size={13} />
          Add another
        </button>
        <button type="button" onClick={onClose} className={cx('inline-flex h-10 items-center justify-center rounded-xl px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)]', focusRing)}>
          Done
        </button>
      </div>
    </div>
  );
}

/* =============================================================================
 * SHARED PRIMITIVES
 * Same building blocks as the Team, Departments, Recruitment, Leave and
 * Calendar tabs.
 * =============================================================================
 */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const BRIDGED_VARS = [
  '--accent',
  '--accent-soft',
  '--surface',
  '--surface-muted',
  '--line',
  '--text',
  '--text-muted',
  '--text-subtle',
  '--success',
  '--success-soft',
  '--success-border',
  '--warning',
  '--warning-soft',
  '--warning-border',
] as const;

/* Solid white modal with black text and clearly visible borders. */

const MODAL_VARS = {
  '--surface': '#FFFFFF',
  '--surface-muted': '#F4F4F5',
  '--line': '#D4D4D8',
  '--text': '#0A0A0A',
  '--text-muted': '#27272A',
  '--text-subtle': '#52525B',
} as CSSProperties;

const PortalTheme = createContext<CSSProperties>({});

const subscribeNoop = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

function useThemeBridge() {
  const ref = useRef<HTMLDivElement>(null);
  const [vars, setVars] = useState<CSSProperties>({});

  useEffect(() => {
    const read = () => {
      const element = ref.current;

      if (!element) {
        return;
      }

      const computed = window.getComputedStyle(element);
      const next: Record<string, string> = {};

      for (const name of BRIDGED_VARS) {
        const value = computed.getPropertyValue(name).trim();

        if (value) {
          next[name] = value;
        }
      }

      setVars((previous) =>
        JSON.stringify(previous) === JSON.stringify(next)
          ? previous
          : (next as CSSProperties),
      );
    };

    read();

    const observer = new MutationObserver(read);
    const options = {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    };

    observer.observe(document.documentElement, options);
    observer.observe(document.body, options);

    return () => observer.disconnect();
  }, []);

  return { ref, vars };
}

function focusableIn(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
}

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]';

const inputBase =
  'h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-[11px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60';

function inputClass(error?: string) {
  return cx(
    inputBase,
    error
      ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/10'
      : 'border-[var(--line)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/10',
  );
}

function ModalShell({
  open,
  onClose,
  labelledBy,
  size = 'lg',
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  size?: 'sm' | 'lg';
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const inherited = useContext(PortalTheme);
  const modalTheme = useMemo(
    () => ({ ...inherited, ...MODAL_VARS }),
    [inherited],
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;

      if (!panel) {
        return;
      }

      const target =
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        focusableIn(panel)[0];

      target?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const panel = panelRef.current;

      if (!panel || !panel.contains(document.activeElement)) {
        return;
      }

      const items = focusableIn(panel);

      if (items.length === 0) {
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!isClient) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          key="modal"
          style={modalTheme}
          className="fixed inset-0 z-[120] flex items-end justify-center text-[var(--text)] sm:items-center sm:p-6"
        >
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/30 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22 }}
            onClick={() => onCloseRef.current()}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            className={cx(
              'relative flex w-full flex-col overflow-hidden rounded-t-[26px] border border-[var(--line)] bg-white shadow-2xl sm:rounded-[26px]',
              size === 'lg' ? 'sm:max-w-[720px]' : 'sm:max-w-[440px]',
            )}
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }
            }
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 }
            }
          >
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[var(--line)] sm:hidden" />
            <PortalTheme.Provider value={modalTheme}>
              {children}
            </PortalTheme.Provider>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function Dropdown<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = 'Select',
  searchable = false,
  searchPlaceholder = 'Search',
  emptyText = 'No results',
  disabled = false,
  loading = false,
  minWidth = 220,
  triggerClassName,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<DropdownOption<T>>;
  ariaLabel: string;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  minWidth?: number;
  triggerClassName?: string;
}) {
  const reduceMotion = useReducedMotion();
  const isClient = useIsClient();
  const listId = useId();
  const portalTheme = useContext(PortalTheme);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: 'top' | 'bottom';
  } | null>(null);

  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) {
      return options;
    }

    return options.filter((option) =>
      `${option.label} ${option.hint ?? ''} ${option.keywords ?? ''}`
        .toLowerCase()
        .includes(term),
    );
  }, [options, query]);

  const measure = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, minWidth);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const desired = 320;

    if (below < Math.min(desired, 240) && above > below) {
      setPosition({
        bottom: window.innerHeight - rect.top + 6,
        left,
        width,
        maxHeight: Math.min(desired, above - 6),
        placement: 'top',
      });
    } else {
      setPosition({
        top: rect.bottom + 6,
        left,
        width,
        maxHeight: Math.min(desired, below - 6),
        placement: 'bottom',
      });
    }
  }, [minWidth]);

  const openMenu = () => {
    if (disabled) {
      return;
    }

    measure();
    setQuery('');
    const index = options.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index : 0);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);

    if (refocus) {
      triggerRef.current?.focus();
    }
  };

  const select = (option: DropdownOption<T>) => {
    if (option.disabled) {
      return;
    }

    onChange(option.value);
    close();
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    const onReflow = (event?: Event) => {
      if (
        event?.target instanceof Node &&
        panelRef.current?.contains(event.target)
      ) {
        return;
      }

      measure();
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);

    const frame = window.requestAnimationFrame(() => {
      (searchable ? searchRef.current : listRef.current)?.focus({
        preventScroll: true,
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, measure, searchable]);

  useEffect(() => {
    if (!open) {
      return;
    }

    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const moveActive = (direction: 1 | -1) => {
    if (filtered.length === 0) {
      return;
    }

    setActive((current) => {
      let next = current;

      for (let step = 0; step < filtered.length; step += 1) {
        next = (next + direction + filtered.length) % filtered.length;

        if (!filtered[next]?.disabled) {
          return next;
        }
      }

      return current;
    });
  };

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        if (!searchable) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case 'End':
        if (!searchable) {
          event.preventDefault();
          setActive(Math.max(0, filtered.length - 1));
        }
        break;
      case 'Enter': {
        event.preventDefault();
        event.stopPropagation();
        const option = filtered[active];
        if (option) {
          select(option);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      event.stopPropagation();

      if (!open) {
        openMenu();
      }
    }
  };

  const activeId =
    open && filtered[active] ? `${listId}-option-${active}` : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={cx(
          'group flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border bg-[var(--surface)] px-3 text-left text-[11px] transition',
          open
            ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/10'
            : 'border-[var(--line)] hover:bg-[var(--surface-muted)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          focusRing,
          triggerClassName,
        )}
      >
        {selected?.leading ? (
          <span className="flex shrink-0 items-center">{selected.leading}</span>
        ) : null}

        <span
          className={cx(
            'min-w-0 flex-1 truncate font-semibold',
            selected ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]',
          )}
        >
          {loading ? 'Loading' : (selected?.label ?? placeholder)}
        </span>

        {loading ? (
          <Loader2
            size={13}
            className="shrink-0 animate-spin text-[var(--text-subtle)]"
          />
        ) : (
          <ChevronDown
            size={14}
            className={cx(
              'shrink-0 text-[var(--text-subtle)] transition-transform duration-200',
              open && 'rotate-180 text-[var(--text)]',
            )}
          />
        )}
      </button>

      {isClient
        ? createPortal(
            <AnimatePresence>
              {open && position ? (
                <motion.div
                  ref={panelRef}
                  key="panel"
                  onKeyDown={onPanelKeyDown}
                  initial={
                    reduceMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          y: position.placement === 'top' ? 6 : -6,
                          scale: 0.97,
                        }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          y: position.placement === 'top' ? 4 : -4,
                          scale: 0.98,
                        }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0.1 }
                      : { type: 'spring', stiffness: 520, damping: 36 }
                  }
                  style={{
                    ...portalTheme,
                    position: 'fixed',
                    top: position.top,
                    bottom: position.bottom,
                    left: position.left,
                    width: position.width,
                    transformOrigin:
                      position.placement === 'top'
                        ? 'bottom center'
                        : 'top center',
                  }}
                  className="z-[160] flex flex-col overflow-hidden rounded-[16px] border border-[var(--line)] bg-white text-[var(--text)] shadow-xl"
                >
                  {searchable ? (
                    <div className="relative border-b border-[var(--line)] p-1.5">
                      <Search
                        size={13}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
                      />
                      <input
                        ref={searchRef}
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setActive(0);
                        }}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        aria-controls={listId}
                        aria-activedescendant={activeId}
                        className="h-9 w-full rounded-[10px] bg-[var(--surface-muted)] pl-8 pr-3 text-[11px] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
                      />
                    </div>
                  ) : null}

                  <div
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    aria-label={ariaLabel}
                    aria-activedescendant={searchable ? undefined : activeId}
                    tabIndex={searchable ? -1 : 0}
                    className="overflow-y-auto overscroll-contain p-1.5 outline-none"
                    style={{
                      maxHeight: position.maxHeight - (searchable ? 49 : 0),
                    }}
                  >
                    {filtered.length === 0 ? (
                      <p className="px-3 py-6 text-center text-[10px] text-[var(--text-subtle)]">
                        {emptyText}
                      </p>
                    ) : (
                      filtered.map((option, index) => {
                        const isSelected = option.value === value;
                        const isActive = index === active;

                        return (
                          <div
                            key={option.value || '__empty'}
                            id={`${listId}-option-${index}`}
                            data-index={index}
                            role="option"
                            aria-selected={isSelected}
                            aria-disabled={option.disabled}
                            onPointerMove={() => {
                              if (!option.disabled && active !== index) {
                                setActive(index);
                              }
                            }}
                            onClick={() => select(option)}
                            className={cx(
                              'relative flex cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[11px] transition-colors',
                              option.disabled && 'cursor-not-allowed opacity-50',
                              isActive
                                ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                                : 'text-[var(--text-muted)]',
                            )}
                          >
                            {option.leading ? (
                              <span className="flex shrink-0 items-center">
                                {option.leading}
                              </span>
                            ) : null}

                            <span className="min-w-0 flex-1">
                              <span
                                className={cx(
                                  'block truncate',
                                  isSelected
                                    ? 'font-semibold text-[var(--text)]'
                                    : 'font-medium',
                                )}
                              >
                                {option.label}
                              </span>

                              {option.hint ? (
                                <span className="mt-0.5 block truncate text-[9px] text-[var(--text-subtle)]">
                                  {option.hint}
                                </span>
                              ) : null}
                            </span>

                            {option.trailing ? (
                              <span className="shrink-0">{option.trailing}</span>
                            ) : null}

                            <Check
                              size={13}
                              strokeWidth={2.2}
                              className={cx(
                                'shrink-0 text-[var(--accent)] transition-opacity',
                                isSelected ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                          </div>
                        );
                      })
                    )}
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

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; leading?: ReactNode }>;
  ariaLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }

    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const next =
      (index + (event.key === 'ArrowRight' ? 1 : -1) + options.length) %
      options.length;

    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="grid rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option, index) => {
        const active = option.value === value;

        return (
          <button
            key={option.value || '__none'}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cx(
              'relative flex h-8 items-center justify-center gap-1.5 rounded-lg text-[10px] font-semibold transition-colors',
              active
                ? 'text-[var(--text)]'
                : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
              focusRing,
            )}
          >
            {active ? (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-sm"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 38 }
                }
              />
            ) : null}
            <span className="relative flex items-center gap-1.5">
              {option.leading}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const isClient = useIsClient();
  const portalTheme = useContext(PortalTheme);

  if (!isClient) {
    return null;
  }

  return createPortal(
    <div
      style={portalTheme}
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[200] flex justify-center px-4"
    >
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            role="status"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }
            }
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { type: 'spring', stiffness: 460, damping: 32 }
            }
            className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-2.5 pl-3 pr-2 text-[11px] font-medium text-[var(--text)] shadow-xl"
          >
            {toast.tone === 'success' ? (
              <CheckCircle2
                size={15}
                className="text-[var(--success,var(--accent))]"
              />
            ) : (
              <AlertCircle size={15} className="text-red-500" />
            )}
            {toast.message}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className={cx(
                'ml-1 flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
                focusRing,
              )}
            >
              <X size={12} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

function Chip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
  as = 'label',
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  as?: 'label' | 'div';
  className?: string;
}) {
  const Wrapper = as;

  return (
    <Wrapper className={cx('block', className)}>
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[9px] font-semibold text-[var(--text-muted)]">
          {label}
          {required ? <span className="text-[var(--accent)]">*</span> : null}
        </span>
        {hint ? (
          <span className="truncate text-[8px] text-[var(--text-subtle)]">
            {hint}
          </span>
        ) : null}
      </span>

      {children}

      <AnimatePresence initial={false}>
        {error ? (
          <motion.span
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="block overflow-hidden"
          >
            <span className="block pt-1 text-[9px] font-medium text-red-600">
              {error}
            </span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </Wrapper>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--line)] px-3.5 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 text-[9px] font-semibold text-[var(--text-muted)]">
      {children}
    </kbd>
  );
}

function CountPill({ value }: { value: number }) {
  return (
    <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-[var(--text-subtle)]">
      {value}
    </span>
  );
}

function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 py-12 text-center">
      <div className="max-w-[420px]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[15px] border border-red-500/20 bg-red-500/5 text-red-500">
          <AlertCircle size={19} />
        </div>

        <h3 className="mt-4 text-[14px] font-semibold text-[var(--text)]">
          {title}
        </h3>

        <p className="mt-2 text-[10px] leading-5 text-[var(--text-muted)]">
          {message}
        </p>

        <div className="mt-5 flex justify-center">
          <SecondaryButton onClick={onRetry}>
            <RefreshCw size={13} />
            Try again
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 py-12 text-center">
      <div className="max-w-[440px]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
          {icon ?? <Users size={21} strokeWidth={1.7} />}
        </div>

        <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">
          {title}
        </h3>

        <p className="mx-auto mt-2 max-w-[380px] text-[10px] leading-5 text-[var(--text-muted)]">
          {description}
        </p>

        {action ? (
          <div className="mt-5 flex items-center justify-center">{action}</div>
        ) : null}
      </div>
    </div>
  );
}

function StepIntro({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]">
        {icon}
      </span>

      <div>
        <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)]">
          {title}
        </h3>
        <p className="mt-0.5 text-[10px] leading-5 text-[var(--text-muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}