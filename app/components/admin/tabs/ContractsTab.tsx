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
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  AlertCircle,
  Ban,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  FilePen,
  FileSignature,
  FileText,
  FolderKanban,
  Handshake,
  Headphones,
  History,
  KeyRound,
  Lightbulb,
  Loader2,
  MoreHorizontal,
  PenLine,
  Plus,
  RefreshCw,
  Repeat,
  RotateCcw,
  Search,
  Send,
  Server,
  Sparkles,
  StickyNote,
  Wand2,
  Wrench,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

/* =============================================================================
 * TYPES
 * =============================================================================
 */

/**
 * Stored statuses match the Prisma ContractStatus enum.
 * EXPIRING is never stored. The API derives it from endDate and returns it
 * as displayStatus, and accepts it as a status filter.
 */
type StoredStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'CANCELLED';

type DisplayStatus = StoredStatus | 'EXPIRING';

type ContractType =
  | 'DEVELOPMENT'
  | 'MAINTENANCE'
  | 'SUPPORT'
  | 'RETAINER'
  | 'HOSTING'
  | 'LICENSING'
  | 'CONSULTING'
  | 'PARTNERSHIP'
  | 'OTHER';

type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM';

type Currency = 'GBP' | 'USD' | 'EUR' | 'NGN';

type ContractSort =
  | 'updated_desc'
  | 'created_desc'
  | 'end_asc'
  | 'end_desc'
  | 'value_desc'
  | 'value_asc'
  | 'title_asc'
  | 'title_desc';

type ContractClient = {
  id: string;
  name: string;
  displayName: string | null;
  clientRef: string | null;
  status: string;
  currency: string;
};

type ContractProject = {
  id: string;
  name: string;
  slug: string;
  status: string;
  clientId: string;
};

type ContractListItem = {
  id: string;
  contractRef: string;
  clientId: string;
  projectId: string | null;
  title: string;
  type: string;
  status: string;
  displayStatus: DisplayStatus;
  value: number | string | null;
  currency: string;
  billingCycle: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalAt: string | null;
  autoRenew: boolean;
  signedAt: string | null;
  documentUrl: string | null;
  client: ContractClient;
  project: ContractProject | null;
  daysUntilExpiry: number | null;
  daysUntilRenewal: number | null;
  createdAt: string;
  updatedAt: string;
};

type ContractSummary = {
  total: number;
  draft: number;
  pendingSignature: number;
  active: number;
  expiring: number;
  expired: number;
  terminated: number;
  cancelled: number;
  totalActiveValue: number;
  expiringValue: number;
  currencyBreakdown: Array<{ currency: string; value: number; count: number }>;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type ContractFeed = {
  summary: ContractSummary;
  contracts: ContractListItem[];
  pagination: Pagination;
};

type AdminSummary = {
  id: string;
  name: string;
  email: string;
};

type ContractActivity = {
  id: string;
  type: string;
  description: string | null;
  metadata: unknown;
  actor: AdminSummary | null;
  createdAt: string;
};

type ContractDetail = ContractListItem & {
  description: string | null;
  noticePeriodDays: number | null;
  signedByClientName: string | null;
  signedByCompanyName: string | null;
  documentName: string | null;
  documentMimeType: string | null;
  documentSizeBytes: string | null;
  notes: string | null;
  createdBy: AdminSummary | null;
  updatedBy: AdminSummary | null;
  activities: ContractActivity[];
  permissions: {
    canEdit: boolean;
    canSendForSignature: boolean;
    canMarkSigned: boolean;
    canActivate: boolean;
    canRenew: boolean;
    canTerminate: boolean;
    canCancel: boolean;
    canReplaceDocument: boolean;
    canDelete: boolean;
  };
};

type ClientOption = {
  id: string;
  name: string;
  displayName: string | null;
  clientRef: string | null;
  currency: string | null;
  projects: Array<{ id: string; name: string }>;
};

type ProjectOption = {
  id: string;
  name: string;
  clientId: string;
};

type TermPreset = '6' | '12' | '24' | '36' | 'custom';

type ContractForm = {
  clientId: string;
  projectId: string;

  title: string;
  titleAuto: boolean;
  description: string;

  type: ContractType;

  value: string;
  currency: Currency;
  currencyAuto: boolean;

  billingCycle: BillingCycle | 'NONE';
  billingAuto: boolean;

  startDate: string;
  term: TermPreset;
  endDate: string;

  renewalAt: string;
  renewalAuto: boolean;

  autoRenew: boolean;
  autoRenewAuto: boolean;

  noticePeriodDays: string;

  notes: string;
};

type FormErrors = Partial<Record<'clientId' | 'title' | 'value' | 'startDate' | 'endDate' | 'renewalAt' | 'noticePeriodDays', string>>;

type MenuItem = {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  external?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  badge?: string;
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

const STORAGE_PREFIX = 'syntragrid.contracts';
const PAGE_SIZE = 25;
const REFRESH_AFTER_MS = 60_000;
const EXPIRING_WINDOW_DAYS = 30;

const EMPTY_SUMMARY: ContractSummary = {
  total: 0,
  draft: 0,
  pendingSignature: 0,
  active: 0,
  expiring: 0,
  expired: 0,
  terminated: 0,
  cancelled: 0,
  totalActiveValue: 0,
  expiringValue: 0,
  currencyBreakdown: [],
};

const STATUS_META: Record<DisplayStatus, { label: string; dot: string; badge: string }> = {
  DRAFT: {
    label: 'Draft',
    dot: 'bg-[var(--text-subtle)]',
    badge: 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
  },
  PENDING_SIGNATURE: {
    label: 'Pending signature',
    dot: 'bg-[var(--accent)]',
    badge: 'border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[var(--text)]',
  },
  ACTIVE: {
    label: 'Active',
    dot: 'bg-[var(--success,#16a34a)]',
    badge: 'border-[var(--success-border,rgba(22,163,74,0.25))] bg-[var(--success-soft,rgba(22,163,74,0.08))] text-[var(--success,#16a34a)]',
  },
  EXPIRING: {
    label: 'Expiring soon',
    dot: 'bg-[var(--warning,#b45309)]',
    badge: 'border-[var(--warning-border,rgba(180,83,9,0.25))] bg-[var(--warning-soft,rgba(180,83,9,0.08))] text-[var(--warning,#b45309)]',
  },
  EXPIRED: {
    label: 'Expired',
    dot: 'bg-red-500',
    badge: 'border-red-500/20 bg-red-500/5 text-red-600',
  },
  TERMINATED: {
    label: 'Terminated',
    dot: 'bg-red-500',
    badge: 'border-red-500/20 bg-red-500/5 text-red-600',
  },
  CANCELLED: {
    label: 'Cancelled',
    dot: 'bg-[var(--text-subtle)]',
    badge: 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]',
  },
};

const STATUS_ORDER: DisplayStatus[] = ['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED', 'CANCELLED'];

const TYPE_META: Record<ContractType, { label: string; icon: LucideIcon; hint: string }> = {
  DEVELOPMENT: { label: 'Development', icon: Code2, hint: 'Build a platform or feature' },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench, hint: 'Updates, fixes and upkeep' },
  SUPPORT: { label: 'Support', icon: Headphones, hint: 'Help desk and SLAs' },
  RETAINER: { label: 'Retainer', icon: Repeat, hint: 'Reserved monthly capacity' },
  HOSTING: { label: 'Hosting', icon: Server, hint: 'Infrastructure and uptime' },
  LICENSING: { label: 'Licensing', icon: KeyRound, hint: 'Software licence' },
  CONSULTING: { label: 'Consulting', icon: Lightbulb, hint: 'Advice and strategy' },
  PARTNERSHIP: { label: 'Partnership', icon: Handshake, hint: 'Shared venture' },
  OTHER: { label: 'Other', icon: FileText, hint: 'Anything else' },
};

const TYPE_ORDER: ContractType[] = [
  'DEVELOPMENT',
  'MAINTENANCE',
  'SUPPORT',
  'RETAINER',
  'HOSTING',
  'LICENSING',
  'CONSULTING',
  'PARTNERSHIP',
  'OTHER',
];

/** Sensible commercial defaults per contract type. Each one can be overridden. */
const TYPE_DEFAULTS: Record<ContractType, { billing: BillingCycle | 'NONE'; autoRenew: boolean }> = {
  DEVELOPMENT: { billing: 'NONE', autoRenew: false },
  MAINTENANCE: { billing: 'MONTHLY', autoRenew: true },
  SUPPORT: { billing: 'MONTHLY', autoRenew: true },
  RETAINER: { billing: 'MONTHLY', autoRenew: true },
  HOSTING: { billing: 'MONTHLY', autoRenew: true },
  LICENSING: { billing: 'ANNUAL', autoRenew: true },
  CONSULTING: { billing: 'NONE', autoRenew: false },
  PARTNERSHIP: { billing: 'NONE', autoRenew: false },
  OTHER: { billing: 'NONE', autoRenew: false },
};

const BILLING_OPTIONS: Array<{ value: BillingCycle | 'NONE'; label: string }> = [
  { value: 'NONE', label: 'One off' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'CUSTOM', label: 'Custom' },
];

const CURRENCIES: Currency[] = ['GBP', 'NGN', 'USD', 'EUR'];

const TERM_OPTIONS: Array<{ value: TermPreset; label: string }> = [
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
  { value: '24', label: '2 years' },
  { value: '36', label: '3 years' },
  { value: 'custom', label: 'Custom' },
];

const NOTICE_PRESETS = ['30', '60', '90'];

const SORT_OPTIONS: Array<DropdownOption<ContractSort>> = [
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'created_desc', label: 'Newest first' },
  { value: 'end_asc', label: 'Ending soonest' },
  { value: 'end_desc', label: 'Ending latest' },
  { value: 'value_desc', label: 'Highest value' },
  { value: 'value_asc', label: 'Lowest value' },
  { value: 'title_asc', label: 'Title A to Z' },
  { value: 'title_desc', label: 'Title Z to A' },
];

const WORKFLOW_STEPS = ['Draft', 'Sent', 'Signed', 'Active'];

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

function clientTitle(client: { name: string; displayName: string | null }) {
  return client.displayName?.trim() || client.name;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function prettyEnum(value: string | null | undefined) {
  if (!value) return '';
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function typeMeta(type: string) {
  return TYPE_META[type as ContractType] ?? { label: prettyEnum(type), icon: FileText, hint: '' };
}

function statusMeta(status: string) {
  return STATUS_META[status as DisplayStatus] ?? STATUS_META.DRAFT;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number | string | null | undefined, currency: string) {
  const amount = toNumber(value);
  if (amount === null) return 'Not set';

  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-GB')}`;
  }
}

function formatCompactMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString('en-GB')}`;
  }
}

function timeOf(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value: string | null | undefined, fallback = 'Not set') {
  const time = timeOf(value);
  if (!time) return fallback;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(time));
}

function formatDateTime(value: string | null | undefined) {
  const time = timeOf(value);
  if (!time) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

function relativeTime(value: string | null | undefined) {
  const time = timeOf(value);
  if (!time) return 'Unknown';
  const minutes = Math.round((Date.now() - time) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hoursAgo = Math.round(minutes / 60);
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  const days = Math.round(hoursAgo / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

function relativeSync(value: Date | null) {
  if (!value) return 'Not synced yet';
  const seconds = Math.round((Date.now() - value.getTime()) / 1000);
  if (seconds < 45) return 'Synced just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Synced ${minutes}m ago`;
  return `Synced ${Math.round(minutes / 60)}h ago`;
}

function expiryLabel(days: number | null) {
  if (days === null) return null;
  if (days < 0) return `Ended ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago`;
  if (days === 0) return 'Ends today';
  if (days === 1) return 'Ends tomorrow';
  if (days < 60) return `Ends in ${days} days`;
  const months = Math.round(days / 30);
  return `Ends in ${months} ${months === 1 ? 'month' : 'months'}`;
}

function formatBytes(value: string | null) {
  if (!value) return null;
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/* ---------- Date inputs ---------- */

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayInput() {
  return toInputDate(new Date());
}

function addMonthsInput(value: string, months: number) {
  const date = parseInputDate(value);
  if (!date) return '';
  const next = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  next.setDate(next.getDate() - 1);
  return toInputDate(next);
}

function addDaysInput(value: string, days: number) {
  const date = parseInputDate(value);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return toInputDate(date);
}

function inputToIso(value: string) {
  return parseInputDate(value) ? `${value}T00:00:00.000Z` : null;
}

function prettyInputDate(value: string) {
  const date = parseInputDate(value);
  return date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : '';
}

function monthsBetween(start: string, end: string) {
  const a = parseInputDate(start);
  const b = parseInputDate(end);
  if (!a || !b || b < a) return null;
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  return Math.max(1, Math.round(days / 30.44));
}

/* ---------- Form ---------- */

function emptyForm(): ContractForm {
  return {
    clientId: '',
    projectId: '',
    title: '',
    titleAuto: true,
    description: '',
    type: 'DEVELOPMENT',
    value: '',
    currency: 'GBP',
    currencyAuto: true,
    billingCycle: TYPE_DEFAULTS.DEVELOPMENT.billing,
    billingAuto: true,
    startDate: todayInput(),
    term: '12',
    endDate: '',
    renewalAt: '',
    renewalAuto: true,
    autoRenew: TYPE_DEFAULTS.DEVELOPMENT.autoRenew,
    autoRenewAuto: true,
    noticePeriodDays: '30',
    notes: '',
  };
}

function isCurrency(value: string | null | undefined): value is Currency {
  return value === 'GBP' || value === 'USD' || value === 'EUR' || value === 'NGN';
}

/** Resolves every auto field so the UI and the submitted payload always agree. */
function resolveForm(form: ContractForm, client: ClientOption | null) {
  const defaults = TYPE_DEFAULTS[form.type];

  const title = form.titleAuto
    ? client
      ? `${clientTitle(client)} ${TYPE_META[form.type].label.toLowerCase()} agreement`
      : ''
    : form.title;

  const currency: Currency = form.currencyAuto && client && isCurrency(client.currency) ? client.currency : form.currency;

  const billingCycle = form.billingAuto ? defaults.billing : form.billingCycle;
  const autoRenew = form.autoRenewAuto ? defaults.autoRenew : form.autoRenew;

  const endDate = form.term === 'custom' ? form.endDate : addMonthsInput(form.startDate, Number(form.term));

  const notice = Number(form.noticePeriodDays);
  const renewalAt = form.renewalAuto
    ? endDate
      ? addDaysInput(endDate, -(Number.isFinite(notice) && notice > 0 ? notice : 0))
      : ''
    : form.renewalAt;

  return { title, currency, billingCycle, autoRenew, endDate, renewalAt };
}

function validateForm(form: ContractForm, resolved: ReturnType<typeof resolveForm>): FormErrors {
  const errors: FormErrors = {};

  if (!form.clientId) errors.clientId = 'Choose the client this agreement is with.';
  if (!resolved.title.trim()) errors.title = 'Give the contract a title.';
  else if (resolved.title.trim().length > 160) errors.title = 'Keep the title under 160 characters.';

  if (form.value.trim()) {
    const amount = Number(form.value);
    if (!Number.isFinite(amount) || amount < 0) errors.value = 'Enter a positive amount.';
  }

  if (form.startDate && !parseInputDate(form.startDate)) errors.startDate = 'Enter a valid date.';

  if (resolved.endDate) {
    const start = parseInputDate(form.startDate);
    const end = parseInputDate(resolved.endDate);
    if (!end) errors.endDate = 'Enter a valid date.';
    else if (start && end < start) errors.endDate = 'The end date must be after the start date.';
  }

  if (resolved.renewalAt) {
    const renewal = parseInputDate(resolved.renewalAt);
    const end = parseInputDate(resolved.endDate);
    if (!renewal) errors.renewalAt = 'Enter a valid date.';
    else if (end && renewal > end) errors.renewalAt = 'Renewal should fall on or before the end date.';
  }

  if (form.noticePeriodDays.trim()) {
    const notice = Number(form.noticePeriodDays);
    if (!Number.isInteger(notice) || notice < 0 || notice > 365) errors.noticePeriodDays = 'Use a whole number of days up to 365.';
  }

  return errors;
}

function asArray(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record[key])) return record[key] as unknown[];
  if (Array.isArray(record.data)) return record.data as unknown[];
  return [];
}

function normaliseClients(value: unknown): ClientOption[] {
  return asArray(value, 'clients')
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter((item) => typeof item.id === 'string' && typeof item.name === 'string')
    .map((item) => ({
      id: item.id as string,
      name: item.name as string,
      displayName: typeof item.displayName === 'string' ? item.displayName : null,
      clientRef: typeof item.clientRef === 'string' ? item.clientRef : null,
      currency: typeof item.currency === 'string' ? item.currency : null,
      projects: Array.isArray(item.projects)
        ? (item.projects as Array<Record<string, unknown>>)
            .filter((project) => typeof project?.id === 'string' && typeof project?.name === 'string')
            .map((project) => ({ id: project.id as string, name: project.name as string }))
        : [],
    }))
    .sort((a, b) => clientTitle(a).localeCompare(clientTitle(b)));
}

function normaliseProjects(value: unknown): ProjectOption[] {
  return asArray(value, 'projects')
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter((item) => typeof item.id === 'string' && typeof item.name === 'string' && typeof item.clientId === 'string')
    .map((item) => ({ id: item.id as string, name: item.name as string, clientId: item.clientId as string }));
}

function workflowIndex(contract: Pick<ContractListItem, 'displayStatus' | 'signedAt'>) {
  switch (contract.displayStatus) {
    case 'DRAFT':
      return 0;
    case 'PENDING_SIGNATURE':
      return contract.signedAt ? 2 : 1;
    case 'ACTIVE':
    case 'EXPIRING':
      return 3;
    default:
      return -1;
  }
}

function termProgress(start: string | null, end: string | null) {
  const a = timeOf(start);
  const b = timeOf(end);
  if (!a || !b || b <= a) return null;
  return Math.min(1, Math.max(0, (Date.now() - a) / (b - a)));
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

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/* =============================================================================
 * CONTRACTS TAB
 * =============================================================================
 */

export default function ContractsTab() {
  const reduceMotion = useReducedMotion();
  const themeRef = useRef<HTMLDivElement>(null);
  const themeVars = useThemeBridge(themeRef);

  const [feed, setFeed] = useState<ContractFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [clockTick, setClockTick] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());

  const [statusFilter, setStatusFilter] = useState<'ALL' | DisplayStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | ContractType>('ALL');
  const [sort, setSort] = usePersistentState<ContractSort>(`${STORAGE_PREFIX}.sort`, 'updated_desc');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const syncRef = useRef<Date | null>(null);
  const loadedRef = useRef(false);

  const notify = useCallback<Notify>((tone, message) => {
    setToast({ id: Date.now(), tone, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Any change to the query returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, sort]);

  /* ---------- Data ---------- */

  const loadContracts = useCallback(
    async (silent = false) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      if (silent || loadedRef.current) setRefreshing(true);
      else setLoading(true);
      if (!silent) setError(null);

      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort });
        if (search) params.set('search', search);
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        if (typeFilter !== 'ALL') params.set('type', typeFilter);

        const response = await fetch(`/api/admin/contracts?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        const payload = (await response.json().catch(() => null)) as (Partial<ContractFeed> & { error?: string }) | null;

        if (!response.ok || !payload || !Array.isArray(payload.contracts)) {
          throw new Error(payload?.error || 'Contracts could not be loaded.');
        }

        setFeed({
          contracts: payload.contracts,
          summary: { ...EMPTY_SUMMARY, ...(payload.summary ?? {}) },
          pagination: payload.pagination ?? {
            page,
            pageSize: PAGE_SIZE,
            total: payload.contracts.length,
            pageCount: 1,
            hasPreviousPage: false,
            hasNextPage: false,
          },
        });

        loadedRef.current = true;
        const now = new Date();
        syncRef.current = now;
        setLastSyncedAt(now);
        setError(null);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        const message = errorMessage(cause, 'Contracts could not be loaded.');
        if (silent) notify('error', message);
        else setError(message);
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [notify, page, search, sort, statusFilter, typeFilter],
  );

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    const timer = setInterval(() => setClockTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const maybeRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      const last = syncRef.current?.getTime() ?? 0;
      if (Date.now() - last < REFRESH_AFTER_MS) return;
      void loadContracts(true);
    };

    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', maybeRefresh);

    return () => {
      window.removeEventListener('focus', maybeRefresh);
      document.removeEventListener('visibilitychange', maybeRefresh);
    };
  }, [loadContracts]);

  /* ---------- Actions ---------- */

  const openCreate = useCallback(() => {
    setCreateKey((key) => key + 1);
    setCreateOpen(true);
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
      if (createOpen || selectedId || event.defaultPrevented) return;

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
        openCreate();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [createOpen, openCreate, selectedId]);

  /* ---------- Derived ---------- */

  const summary = feed?.summary ?? EMPTY_SUMMARY;
  const contracts = feed?.contracts ?? [];
  const pagination = feed?.pagination ?? null;

  const mainCurrency = summary.currencyBreakdown[0]?.currency ?? 'GBP';
  const extraCurrencies = Math.max(0, summary.currencyBreakdown.length - 1);

  const statusCounts: Record<DisplayStatus, number> = {
    DRAFT: summary.draft,
    PENDING_SIGNATURE: summary.pendingSignature,
    ACTIVE: summary.active,
    EXPIRING: summary.expiring,
    EXPIRED: summary.expired,
    TERMINATED: summary.terminated,
    CANCELLED: summary.cancelled,
  };

  const filtersActive = Boolean(searchInput) || statusFilter !== 'ALL' || typeFilter !== 'ALL';

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
  }, []);

  const toggleStatus = useCallback((status: DisplayStatus) => {
    setStatusFilter((current) => (current === status ? 'ALL' : status));
  }, []);

  const syncedLabel = useMemo(
    () => relativeSync(lastSyncedAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastSyncedAt, clockTick],
  );

  const statusOptions: Array<DropdownOption<'ALL' | DisplayStatus>> = [
    {
      value: 'ALL',
      label: 'All statuses',
      leading: <span className="h-2 w-2 rounded-full border border-[var(--text-subtle)]" />,
      trailing: <CountPill value={summary.total} />,
    },
    ...STATUS_ORDER.map((status) => ({
      value: status,
      label: STATUS_META[status].label,
      leading: <span className={cx('h-2 w-2 rounded-full', STATUS_META[status].dot)} />,
      trailing: <CountPill value={statusCounts[status]} />,
    })),
  ];

  const typeOptions: Array<DropdownOption<'ALL' | ContractType>> = [
    { value: 'ALL', label: 'All types', leading: <FileText size={13} className="text-[var(--text-subtle)]" /> },
    ...TYPE_ORDER.map((type) => {
      const Icon = TYPE_META[type].icon;
      return { value: type, label: TYPE_META[type].label, leading: <Icon size={13} className="text-[var(--text-subtle)]" /> };
    }),
  ];

  const menuFor = useCallback(
    (contract: ContractListItem): MenuItem[] => {
      const items: MenuItem[] = [
        { key: 'view', label: 'Open contract', icon: <Eye size={13} />, onSelect: () => setSelectedId(contract.id) },
        {
          key: 'copy-ref',
          label: 'Copy reference',
          icon: <Copy size={13} />,
          onSelect: () => void copyValue(contract.contractRef, `${contract.contractRef} copied`),
        },
      ];

      if (contract.documentUrl) {
        items.push({ key: 'document', label: 'Open document', icon: <FileText size={13} />, href: contract.documentUrl, external: true });
      }

      return items;
    },
    [copyValue],
  );

  /* ---------- Render ---------- */

  let body: ReactNode;

  if (loading && !feed) {
    body = <LoadingState />;
  } else if (error && !feed) {
    body = <ErrorState title="Contracts could not be loaded" message={error} onRetry={() => void loadContracts()} />;
  } else if (contracts.length === 0 && !filtersActive) {
    body = (
      <EmptyState
        icon={<FileSignature size={21} strokeWidth={1.7} />}
        title="No contracts yet"
        description="Record every agreement with your clients in one place: commercial terms, signatures, renewals and the signed document."
        action={
          <PrimaryButton onClick={openCreate}>
            <Plus size={13} />
            Create first contract
          </PrimaryButton>
        }
      />
    );
  } else if (contracts.length === 0) {
    body = (
      <EmptyState
        icon={<Search size={20} strokeWidth={1.7} />}
        title={searchInput ? `Nothing matches "${searchInput}"` : 'No contracts match these filters'}
        description="Try a different search, or clear the filters to see every agreement."
        action={
          <SecondaryButton onClick={resetFilters}>
            <X size={13} />
            Clear filters
          </SecondaryButton>
        }
      />
    );
  } else {
    body = (
      <section
        className={cx(
          'overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm transition-opacity',
          refreshing && 'opacity-80',
        )}
      >
        <div className={cx('hidden gap-4 border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-3 lg:grid', LIST_GRID)}>
          {['Contract', 'Client', 'Value', 'Term', 'Status', ''].map((label) => (
            <p key={label || 'actions'} className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
              {label}
            </p>
          ))}
        </div>

        <div className="divide-y divide-[var(--line)]">
          <AnimatePresence initial={false}>
            {contracts.map((contract, index) => (
              <motion.div
                key={contract.id}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={reduceMotion ? { duration: 0.1 } : { duration: 0.22, delay: Math.min(index, 10) * 0.02, ease: [0.22, 1, 0.36, 1] }}
              >
                <ContractRow contract={contract} menuItems={menuFor(contract)} onOpen={() => setSelectedId(contract.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {pagination && pagination.pageCount > 1 ? (
          <PaginationBar pagination={pagination} disabled={refreshing} onPageChange={setPage} />
        ) : null}
      </section>
    );
  }

  return (
    <PortalTheme.Provider value={themeVars}>
      <div ref={themeRef} className="mx-auto w-full min-w-0 max-w-[1600px]">
        <section className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
          <MetricsGrid
            columns="grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6"
            loading={loading && !feed}
            items={[
              {
                label: 'Contracts',
                value: summary.total,
                helper: 'All client agreements',
                icon: FileText,
                active: statusFilter === 'ALL' && !filtersActive,
                onClick: resetFilters,
              },
              {
                label: 'Active',
                value: summary.active,
                helper: `${formatCompactMoney(summary.totalActiveValue, mainCurrency)} live${extraCurrencies > 0 ? ` +${extraCurrencies} more` : ''}`,
                icon: CheckCircle2,
                active: statusFilter === 'ACTIVE',
                onClick: () => toggleStatus('ACTIVE'),
              },
              {
                label: 'Awaiting signature',
                value: summary.pendingSignature,
                helper: 'Sent to the client',
                icon: FileSignature,
                highlight: summary.pendingSignature > 0,
                active: statusFilter === 'PENDING_SIGNATURE',
                onClick: () => toggleStatus('PENDING_SIGNATURE'),
              },
              {
                label: 'Expiring soon',
                value: summary.expiring,
                helper: summary.expiring > 0 ? `${formatCompactMoney(summary.expiringValue, mainCurrency)} at stake` : `Next ${EXPIRING_WINDOW_DAYS} days`,
                icon: CalendarClock,
                highlight: summary.expiring > 0,
                active: statusFilter === 'EXPIRING',
                onClick: () => toggleStatus('EXPIRING'),
              },
              {
                label: 'Drafts',
                value: summary.draft,
                helper: 'Not sent yet',
                icon: FilePen,
                active: statusFilter === 'DRAFT',
                onClick: () => toggleStatus('DRAFT'),
              },
              {
                label: 'Ended',
                value: summary.expired + summary.terminated,
                helper: `${summary.expired} expired, ${summary.terminated} terminated`,
                icon: History,
                active: statusFilter === 'EXPIRED',
                onClick: () => toggleStatus('EXPIRED'),
              },
            ]}
          />

          <div className="border-t border-[var(--line)] px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
              <div className="relative min-w-0 flex-1 2xl:max-w-[420px]">
                <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
                <input
                  ref={searchRef}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setSearchInput('');
                  }}
                  placeholder="Search title, reference, client or project"
                  aria-label="Search contracts"
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
                    {search !== searchInput.trim() ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                  </button>
                ) : (
                  <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline-flex">
                    <Kbd>/</Kbd>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Dropdown value={statusFilter} onChange={setStatusFilter} options={statusOptions} ariaLabel="Filter by status" triggerClassName="sm:w-[180px]" minWidth={230} />
                <Dropdown value={typeFilter} onChange={setTypeFilter} options={typeOptions} ariaLabel="Filter by type" triggerClassName="sm:w-[160px]" minWidth={210} />
                <Dropdown value={sort} onChange={setSort} options={SORT_OPTIONS} ariaLabel="Sort contracts" triggerClassName="col-span-2 sm:col-span-1 sm:w-[170px]" minWidth={200} />
              </div>

              <div className="flex items-center justify-end gap-2 2xl:ml-auto">
                <ToolbarIcon label="Refresh contracts" onClick={() => void loadContracts(true)} disabled={refreshing || loading}>
                  <RefreshCw size={14} strokeWidth={1.9} className={cx(refreshing && 'animate-spin')} />
                </ToolbarIcon>

                <button
                  type="button"
                  onClick={openCreate}
                  className={cx('inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] pl-4 pr-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90', focusRing)}
                >
                  <Plus size={15} strokeWidth={2} />
                  New contract
                  <kbd className="ml-1 hidden h-5 min-w-5 items-center justify-center rounded-md bg-white/15 px-1.5 text-[9px] font-semibold text-white/90 sm:inline-flex">N</kbd>
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-3">
              {(['ALL', 'ACTIVE', 'EXPIRING', 'PENDING_SIGNATURE', 'DRAFT'] as const).map((value) => {
                const active = statusFilter === value;
                const count = value === 'ALL' ? undefined : statusCounts[value];

                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => (value === 'ALL' ? setStatusFilter('ALL') : toggleStatus(value))}
                    className={cx(
                      'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold transition-colors',
                      active
                        ? 'border-[var(--accent)] bg-[var(--surface)] text-[var(--text)]'
                        : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]',
                      focusRing,
                    )}
                  >
                    {value !== 'ALL' ? <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_META[value].dot)} /> : null}
                    {value === 'ALL' ? 'Everything' : STATUS_META[value].label}
                    {typeof count === 'number' && count > 0 ? <span className="tabular-nums text-[var(--text-subtle)]">{count}</span> : null}
                  </button>
                );
              })}

              <div className="ml-auto flex items-center gap-3 text-[10px] text-[var(--text-subtle)]">
                <span aria-live="polite">
                  <span className="font-semibold text-[var(--text)]">{pagination?.total ?? contracts.length}</span>{' '}
                  {(pagination?.total ?? contracts.length) === 1 ? 'contract' : 'contracts'}
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

        <div className="mt-5">{body}</div>

        <CreateContractModal
          key={createKey}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(contract) => {
            setCreateOpen(false);
            notify('success', `${contract.contractRef} created`);
            setSelectedId(contract.id);
            setPage(1);
            void loadContracts(true);
          }}
        />

        <ContractDetailModal
          contractId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={(message) => {
            if (message) notify('success', message);
            void loadContracts(true);
          }}
          onCopy={copyValue}
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
  loading,
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
  loading?: boolean;
}) {
  return (
    <div className={cx('grid gap-px bg-[var(--line)]', columns)}>
      {items.map((metric) => {
        const Icon = metric.icon;

        const inner = (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">{metric.label}</p>
              {loading ? (
                <div className="mt-2.5 h-5 w-10 animate-pulse rounded bg-[var(--surface-muted)] motion-reduce:animate-none" />
              ) : (
                <p className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-[-0.04em] text-[var(--text)]">{metric.value}</p>
              )}
              <p className="mt-0.5 truncate text-[9px] text-[var(--text-subtle)]">{loading ? 'Loading' : metric.helper}</p>
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

/* =============================================================================
 * CONTRACT ROW
 * =============================================================================
 */

const LIST_GRID = 'lg:grid-cols-[minmax(240px,1.5fr)_minmax(170px,1fr)_130px_minmax(170px,1fr)_150px_40px]';

function ContractRow({ contract, menuItems, onOpen }: { contract: ContractListItem; menuItems: MenuItem[]; onOpen: () => void }) {
  const meta = typeMeta(contract.type);
  const TypeIcon = meta.icon;
  const expiry = contract.displayStatus === 'ACTIVE' || contract.displayStatus === 'EXPIRING' ? expiryLabel(contract.daysUntilExpiry) : null;

  return (
    <div className={cx('group grid gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-muted)] sm:px-5 lg:items-center lg:gap-4', LIST_GRID)}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <button type="button" onClick={onOpen} className={cx('flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left', focusRing)}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition group-hover:border-[color:var(--accent)]/40 group-hover:text-[var(--accent)]">
            <TypeIcon size={16} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11.5px] font-semibold text-[var(--text)]">{contract.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[9.5px] text-[var(--text-subtle)]">
              <span className="font-mono tracking-tight">{contract.contractRef}</span>
              <span>·</span>
              <span>{meta.label}</span>
              {contract.documentUrl ? <FileText size={10} className="shrink-0" aria-label="Has document" /> : null}
            </p>
          </div>
        </button>

        <div className="lg:hidden">
          <ActionMenu label={`Actions for ${contract.title}`} items={menuItems} />
        </div>
      </div>

      <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-[var(--line)] bg-[var(--surface-muted)] text-[8.5px] font-bold text-[var(--text)]">
          {initials(clientTitle(contract.client)) || <Building2 size={11} />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10.5px] font-medium text-[var(--text)]">{clientTitle(contract.client)}</p>
          <p className="mt-0.5 truncate text-[8.5px] text-[var(--text-subtle)]">{contract.project?.name ?? 'Whole account'}</p>
        </div>
      </div>

      <div className="hidden lg:block">
        <p className="text-[11px] font-semibold tabular-nums text-[var(--text)]">
          {toNumber(contract.value) === null ? <span className="font-normal text-[var(--text-subtle)]">Not set</span> : formatMoney(contract.value, contract.currency)}
        </p>
        <p className="mt-0.5 text-[8.5px] text-[var(--text-subtle)]">{contract.billingCycle ? prettyEnum(contract.billingCycle) : 'One off'}</p>
      </div>

      <div className="hidden min-w-0 lg:block">
        <p className="truncate text-[10px] text-[var(--text-muted)]">
          {formatDate(contract.startDate, 'No start')} <span className="text-[var(--text-subtle)]">to</span> {formatDate(contract.endDate, 'open ended')}
        </p>
        <TermBar start={contract.startDate} end={contract.endDate} warn={contract.displayStatus === 'EXPIRING'} compact />
      </div>

      <div className="hidden lg:block">
        <StatusBadge status={contract.displayStatus} />
        {expiry ? (
          <p className={cx('mt-1 text-[8.5px] font-medium', contract.displayStatus === 'EXPIRING' ? 'text-[var(--warning,#b45309)]' : 'text-[var(--text-subtle)]')}>
            {expiry}
            {contract.autoRenew ? ' · renews' : ''}
          </p>
        ) : null}
      </div>

      <div className="hidden justify-end lg:flex">
        <ActionMenu label={`Actions for ${contract.title}`} items={menuItems} />
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-[52px] lg:hidden">
        <StatusBadge status={contract.displayStatus} />
        <span className="text-[9.5px] text-[var(--text-subtle)]">
          {clientTitle(contract.client)}
          {toNumber(contract.value) !== null ? ` · ${formatMoney(contract.value, contract.currency)}` : ''}
        </span>
        {expiry ? <span className="text-[9.5px] font-medium text-[var(--warning,#b45309)]">{expiry}</span> : null}
      </div>
    </div>
  );
}

function TermBar({ start, end, warn, compact = false }: { start: string | null; end: string | null; warn?: boolean; compact?: boolean }) {
  const reduceMotion = useReducedMotion();
  const progress = termProgress(start, end);
  if (progress === null) return compact ? null : <p className="text-[10px] text-[var(--text-subtle)]">Add start and end dates to track the term.</p>;

  return (
    <div className={cx('relative overflow-hidden rounded-full bg-[var(--surface-muted)]', compact ? 'mt-1.5 h-1' : 'h-1.5')}>
      <motion.div
        className={cx('absolute inset-y-0 left-0 rounded-full', progress >= 1 ? 'bg-[var(--text-subtle)]' : warn ? 'bg-[var(--warning,#b45309)]' : 'bg-[var(--accent)]')}
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${progress * 100}%` }}
        transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);

  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-semibold', meta.badge)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

function PaginationBar({
  pagination,
  disabled,
  onPageChange,
}: {
  pagination: Pagination;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}) {
  const from = (pagination.page - 1) * pagination.pageSize + 1;
  const to = Math.min(pagination.total, pagination.page * pagination.pageSize);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 sm:px-5">
      <p className="text-[10px] text-[var(--text-subtle)]">
        <span className="font-semibold tabular-nums text-[var(--text)]">
          {from} to {to}
        </span>{' '}
        of <span className="tabular-nums">{pagination.total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={disabled || !pagination.hasPreviousPage}
          onClick={() => onPageChange(pagination.page - 1)}
          className={cx('inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[10px] font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40', focusRing)}
        >
          <ChevronLeft size={13} />
          Previous
        </button>
        <span className="px-2 text-[10px] tabular-nums text-[var(--text-subtle)]">
          {pagination.page} / {pagination.pageCount}
        </span>
        <button
          type="button"
          disabled={disabled || !pagination.hasNextPage}
          onClick={() => onPageChange(pagination.page + 1)}
          className={cx('inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[10px] font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40', focusRing)}
        >
          Next
          <ChevronRight size={13} />
        </button>
      </div>
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
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]',
          open && 'bg-[var(--surface)] text-[var(--text)]',
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
                  className="z-[90] w-[210px] overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl"
                >
                  {items.map((item) => {
                    const content = (
                      <>
                        <span className="shrink-0 text-[var(--text-subtle)]">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                        {item.badge ? (
                          <span className="ml-auto rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                            {item.badge}
                          </span>
                        ) : item.external ? (
                          <ExternalLink size={10} className="ml-auto shrink-0 opacity-50" />
                        ) : null}
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
                        className={cx(itemClass, item.disabled && 'pointer-events-none opacity-50')}
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

/* =============================================================================
 * CREATE CONTRACT
 * =============================================================================
 */

function CreateContractModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (contract: ContractDetail) => void;
}) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();

  const [form, setForm] = useState<ContractForm>(emptyForm);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [extraProjects, setExtraProjects] = useState<ProjectOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError(null);

    try {
      const [clientsResult, projectsResult] = await Promise.allSettled([
        fetch('/api/admin/clients', { cache: 'no-store', credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch('/api/admin/projects?pageSize=200', { cache: 'no-store', credentials: 'include', headers: { Accept: 'application/json' } }),
      ]);

      if (clientsResult.status !== 'fulfilled' || !clientsResult.value.ok) {
        throw new Error('Clients could not be loaded.');
      }

      setClients(normaliseClients(await clientsResult.value.json().catch(() => [])));

      // Projects are optional: clients already embed their projects.
      if (projectsResult.status === 'fulfilled' && projectsResult.value.ok) {
        setExtraProjects(normaliseProjects(await projectsResult.value.json().catch(() => [])));
      }
    } catch (cause) {
      setOptionsError(errorMessage(cause, 'Clients could not be loaded.'));
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadOptions();
  }, [loadOptions, open]);

  const client = useMemo(() => clients.find((item) => item.id === form.clientId) ?? null, [clients, form.clientId]);

  const projects = useMemo(() => {
    if (!form.clientId) return [];
    const map = new Map<string, string>();
    for (const project of client?.projects ?? []) map.set(project.id, project.name);
    for (const project of extraProjects) if (project.clientId === form.clientId) map.set(project.id, project.name);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [client, extraProjects, form.clientId]);

  const resolved = useMemo(() => resolveForm(form, client), [client, form]);
  const errors = useMemo(() => validateForm(form, resolved), [form, resolved]);
  const visibleErrors: FormErrors = touched ? errors : {};
  const hasErrors = Object.keys(errors).length > 0;

  const update = useCallback(<K extends keyof ContractForm>(key: K, value: ContractForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const clientOptions = useMemo<Array<DropdownOption<string>>>(
    () =>
      clients.map((item) => ({
        value: item.id,
        label: clientTitle(item),
        hint: item.clientRef ?? undefined,
        keywords: [item.name, item.clientRef].filter(Boolean).join(' '),
        leading: (
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[8px] font-bold text-[var(--text)]">
            {initials(clientTitle(item))}
          </span>
        ),
      })),
    [clients],
  );

  const projectOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      { value: '', label: 'Whole account', leading: <Building2 size={13} className="text-[var(--text-subtle)]" /> },
      ...projects.map((project) => ({ value: project.id, label: project.name, leading: <FolderKanban size={13} className="text-[var(--text-subtle)]" /> })),
    ],
    [projects],
  );

  const termMonths = form.term === 'custom' ? monthsBetween(form.startDate, resolved.endDate) : Number(form.term);
  const amount = toNumber(form.value);

  const summaryLine = useMemo(() => {
    const parts: string[] = [];
    parts.push(termMonths ? `${termMonths} month ${TYPE_META[form.type].label.toLowerCase()}` : TYPE_META[form.type].label);
    if (amount !== null) parts.push(`worth ${formatMoney(amount, resolved.currency)}${resolved.billingCycle !== 'NONE' ? ` ${prettyEnum(resolved.billingCycle).toLowerCase()}` : ''}`);
    if (client) parts.push(`with ${clientTitle(client)}`);
    return parts.join(' ');
  }, [amount, client, form.type, resolved.billingCycle, resolved.currency, termMonths]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saving) return;
    setTouched(true);
    if (hasErrors) return;

    setSaving(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/admin/contracts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          clientId: form.clientId,
          projectId: form.projectId || null,
          title: resolved.title.trim(),
          description: form.description.trim() || null,
          type: form.type,
          value: amount,
          currency: resolved.currency,
          billingCycle: resolved.billingCycle === 'NONE' ? null : resolved.billingCycle,
          startDate: inputToIso(form.startDate),
          endDate: inputToIso(resolved.endDate),
          renewalAt: inputToIso(resolved.renewalAt),
          autoRenew: resolved.autoRenew,
          noticePeriodDays: form.noticePeriodDays.trim() ? Number(form.noticePeriodDays) : null,
          notes: form.notes.trim() || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { contract?: ContractDetail; error?: string } | null;

      if (!response.ok || !payload?.contract) {
        throw new Error(payload?.error || 'The contract could not be created.');
      }

      onCreated(payload.contract);
    } catch (cause) {
      setSubmitError(errorMessage(cause, 'The contract could not be created.'));
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <ModalShell open={open} onClose={() => (saving ? undefined : onClose())} labelledBy={titleId} size="lg">
      <form onSubmit={submit} onKeyDown={onKeyDown} noValidate className="flex max-h-[min(90vh,880px)] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[var(--accent)]">
              <FileSignature size={17} />
            </span>
            <div>
              <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                New contract
              </h2>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Pick a client and a type. Dates, renewal and billing fill themselves in.</p>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          {optionsError ? (
            <InlineAlert tone="error" message={optionsError} action={<button type="button" onClick={() => void loadOptions()} className={cx('font-semibold underline-offset-2 hover:underline', focusRing)}>Retry</button>} />
          ) : null}

          {/* Who */}
          <FormSection step={1} title="Who is it with">
            <div className="grid gap-4 sm:grid-cols-2">
              <SmartField label="Client" required error={visibleErrors.clientId}>
                <Dropdown
                  value={form.clientId}
                  onChange={(value) => setForm((current) => ({ ...current, clientId: value, projectId: '' }))}
                  options={clientOptions}
                  ariaLabel="Client"
                  placeholder={optionsLoading ? 'Loading clients' : 'Choose a client'}
                  searchable
                  searchPlaceholder="Find a client"
                  emptyText="No clients match"
                  loading={optionsLoading}
                  triggerClassName="w-full"
                  minWidth={280}
                />
              </SmartField>

              <SmartField label="Project" extra={<span className="text-[8px] text-[var(--text-subtle)]">Optional</span>}>
                <Dropdown
                  value={form.projectId}
                  onChange={(value) => update('projectId', value)}
                  options={projectOptions}
                  ariaLabel="Project"
                  disabled={!form.clientId}
                  placeholder="Whole account"
                  searchable={projects.length > 6}
                  triggerClassName="w-full"
                  minWidth={260}
                />
              </SmartField>
            </div>
          </FormSection>

          {/* What */}
          <FormSection step={2} title="What kind of agreement">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TYPE_ORDER.map((type) => {
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                const active = form.type === type;

                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update('type', type)}
                    className={cx(
                      'relative flex items-start gap-2.5 rounded-[14px] border px-3 py-2.5 text-left transition',
                      active
                        ? 'border-[var(--accent)] bg-[color:var(--accent)]/[0.06]'
                        : 'border-[var(--line)] hover:border-[color:var(--accent)]/40 hover:bg-[var(--surface-muted)]',
                      focusRing,
                    )}
                  >
                    <span className={cx('mt-0.5 shrink-0', active ? 'text-[var(--accent)]' : 'text-[var(--text-subtle)]')}>
                      <Icon size={15} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10.5px] font-semibold text-[var(--text)]">{meta.label}</span>
                      <span className="mt-0.5 block truncate text-[8.5px] text-[var(--text-subtle)]">{meta.hint}</span>
                    </span>
                    {active ? (
                      <motion.span
                        layoutId="contract-type-check"
                        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 36 }}
                        className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-white"
                      >
                        <Check size={10} strokeWidth={3} />
                      </motion.span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-4">
              <SmartField
                label="Title"
                required
                error={visibleErrors.title}
                extra={<AutoHint auto={form.titleAuto} label="From client and type" onReset={() => update('titleAuto', true)} />}
              >
                <input
                  value={resolved.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, titleAuto: false }))}
                  placeholder={client ? '' : 'Choose a client to suggest a title'}
                  className={inputClass(visibleErrors.title)}
                />
              </SmartField>

              <SmartField label="Scope" extra={<span className="text-[8px] text-[var(--text-subtle)]">Optional</span>}>
                <textarea
                  value={form.description}
                  onChange={(event) => update('description', event.target.value)}
                  rows={2}
                  placeholder="What this agreement covers, in a sentence or two"
                  className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
                />
              </SmartField>
            </div>
          </FormSection>

          {/* Money */}
          <FormSection step={3} title="Commercial terms">
            <div className="grid gap-4 sm:grid-cols-2">
              <SmartField
                label="Value"
                error={visibleErrors.value}
                extra={<AutoHint auto={form.currencyAuto} label="Currency from client" onReset={() => update('currencyAuto', true)} />}
              >
                <div className={cx('flex h-10 overflow-hidden rounded-xl border bg-[var(--surface)] transition focus-within:border-[var(--accent)]', visibleErrors.value ? 'border-red-500/60' : 'border-[var(--line)]')}>
                  <div className="flex shrink-0 items-center gap-0.5 border-r border-[var(--line)] bg-[var(--surface-muted)] px-1">
                    {CURRENCIES.map((currency) => (
                      <button
                        key={currency}
                        type="button"
                        aria-pressed={resolved.currency === currency}
                        onClick={() => setForm((current) => ({ ...current, currency, currencyAuto: false }))}
                        className={cx(
                          'h-7 rounded-lg px-1.5 text-[9px] font-bold transition',
                          resolved.currency === currency ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
                          focusRing,
                        )}
                      >
                        {currency}
                      </button>
                    ))}
                  </div>
                  <input
                    inputMode="decimal"
                    value={form.value}
                    onChange={(event) => update('value', event.target.value.replace(/[^\d.]/g, ''))}
                    placeholder="0"
                    aria-label="Contract value"
                    className="min-w-0 flex-1 bg-transparent px-3 text-[11px] tabular-nums text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
                  />
                </div>
              </SmartField>

              <SmartField
                as="div"
                label="Billing"
                extra={<AutoHint auto={form.billingAuto} label={`Usual for ${TYPE_META[form.type].label.toLowerCase()}`} onReset={() => update('billingAuto', true)} />}
              >
                <div className="flex flex-wrap gap-1.5">
                  {BILLING_OPTIONS.map((option) => (
                    <PillButton
                      key={option.value}
                      active={resolved.billingCycle === option.value}
                      onClick={() => setForm((current) => ({ ...current, billingCycle: option.value, billingAuto: false }))}
                    >
                      {option.label}
                    </PillButton>
                  ))}
                </div>
              </SmartField>
            </div>
          </FormSection>

          {/* When */}
          <FormSection step={4} title="Term and renewal">
            <div className="grid gap-4 sm:grid-cols-2">
              <SmartField label="Starts" error={visibleErrors.startDate}>
                <input type="date" value={form.startDate} onChange={(event) => update('startDate', event.target.value)} className={inputClass(visibleErrors.startDate)} />
              </SmartField>

              <SmartField as="div" label="Length">
                <div className="flex flex-wrap gap-1.5">
                  {TERM_OPTIONS.map((option) => (
                    <PillButton
                      key={option.value}
                      active={form.term === option.value}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          term: option.value,
                          endDate: option.value === 'custom' ? current.endDate || resolved.endDate : current.endDate,
                        }))
                      }
                    >
                      {option.label}
                    </PillButton>
                  ))}
                </div>
              </SmartField>

              <SmartField
                label="Ends"
                error={visibleErrors.endDate}
                extra={form.term !== 'custom' ? <span className="inline-flex items-center gap-1 text-[8px] font-semibold text-[var(--accent)]"><Wand2 size={9} />From length</span> : null}
              >
                <input
                  type="date"
                  value={resolved.endDate}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value, term: 'custom' }))}
                  className={inputClass(visibleErrors.endDate)}
                />
              </SmartField>

              <SmartField
                label="Notice period"
                error={visibleErrors.noticePeriodDays}
                extra={
                  <span className="flex items-center gap-1">
                    {NOTICE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => update('noticePeriodDays', preset)}
                        className={cx(
                          'rounded-md px-1.5 py-0.5 text-[8.5px] font-semibold transition',
                          form.noticePeriodDays === preset ? 'bg-[color:var(--accent)]/15 text-[var(--accent)]' : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
                          focusRing,
                        )}
                      >
                        {preset}d
                      </button>
                    ))}
                  </span>
                }
              >
                <div className="relative">
                  <input
                    inputMode="numeric"
                    value={form.noticePeriodDays}
                    onChange={(event) => update('noticePeriodDays', event.target.value.replace(/\D/g, ''))}
                    placeholder="30"
                    className={cx(inputClass(visibleErrors.noticePeriodDays), 'pr-12')}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-subtle)]">days</span>
                </div>
              </SmartField>

              <SmartField
                label="Renewal reminder"
                error={visibleErrors.renewalAt}
                extra={<AutoHint auto={form.renewalAuto} label="End date minus notice" onReset={() => update('renewalAuto', true)} />}
              >
                <input
                  type="date"
                  value={resolved.renewalAt}
                  onChange={(event) => setForm((current) => ({ ...current, renewalAt: event.target.value, renewalAuto: false }))}
                  className={inputClass(visibleErrors.renewalAt)}
                />
              </SmartField>

              <SmartField
                as="div"
                label="Renews automatically"
                extra={<AutoHint auto={form.autoRenewAuto} label={`Usual for ${TYPE_META[form.type].label.toLowerCase()}`} onReset={() => update('autoRenewAuto', true)} />}
              >
                <div className="flex h-10 items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3">
                  <span className="text-[10.5px] text-[var(--text-muted)]">{resolved.autoRenew ? 'Rolls over unless cancelled' : 'Ends unless renewed'}</span>
                  <Switch checked={resolved.autoRenew} label="Renews automatically" onChange={(value) => setForm((current) => ({ ...current, autoRenew: value, autoRenewAuto: false }))} />
                </div>
              </SmartField>
            </div>
          </FormSection>

          {/* Notes */}
          <div>
            <button
              type="button"
              onClick={() => setShowNotes((value) => !value)}
              aria-expanded={showNotes}
              className={cx('inline-flex items-center gap-1.5 rounded-md text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)]', focusRing)}
            >
              <StickyNote size={12} />
              {form.notes ? 'Internal notes' : 'Add internal notes'}
              <ChevronDown size={12} className={cx('transition-transform', showNotes && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
              {showNotes ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                  className="overflow-hidden"
                >
                  <textarea
                    value={form.notes}
                    onChange={(event) => update('notes', event.target.value)}
                    rows={3}
                    placeholder="Only visible to the Syntra Grid team"
                    className={cx(inputClass(), 'mt-2 h-auto resize-none py-2.5 leading-5')}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Preview */}
          <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3.5">
            <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
              <Sparkles size={11} className="text-[var(--accent)]" />
              Summary
            </p>
            <p className="mt-1.5 text-[11.5px] font-medium leading-5 text-[var(--text)]">{summaryLine}.</p>
            <p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">
              {form.startDate ? `Runs ${prettyInputDate(form.startDate)}` : 'No start date'}
              {resolved.endDate ? ` to ${prettyInputDate(resolved.endDate)}` : ', open ended'}
              {resolved.renewalAt ? `. Renewal reminder on ${prettyInputDate(resolved.renewalAt)}` : ''}
              {resolved.autoRenew ? '. Renews automatically.' : '.'}
            </p>
          </div>

          {submitError ? <InlineAlert tone="error" message={submitError} /> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface-muted)] px-5 py-3 sm:px-6">
          <p className="hidden items-center gap-1.5 text-[9.5px] text-[var(--text-subtle)] sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>Enter</Kbd>
            to create
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={cx('inline-flex h-10 items-center rounded-xl px-4 text-[10.5px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface)] disabled:opacity-50', focusRing)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || optionsLoading}
              className={cx('inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10.5px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60', focusRing)}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Creating' : 'Create contract'}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function FormSection({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[9px] font-bold tabular-nums text-[var(--text-muted)]">{step}</span>
        <h3 className="text-[11.5px] font-semibold tracking-[-0.01em] text-[var(--text)]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function SmartField({
  label,
  required,
  error,
  extra,
  as = 'label',
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  extra?: ReactNode;
  as?: 'label' | 'div';
  children: ReactNode;
}) {
  const Wrapper = as;

  return (
    <Wrapper className="block min-w-0">
      <span className="mb-1.5 flex min-h-4 items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[9px] font-semibold text-[var(--text-muted)]">
          {label}
          {required ? <span className="text-[var(--accent)]">*</span> : null}
        </span>
        {extra}
      </span>
      {children}
      <AnimatePresence initial={false}>
        {error ? (
          <motion.span initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="block overflow-hidden">
            <span className="block pt-1 text-[9px] font-medium text-red-600">{error}</span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </Wrapper>
  );
}

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex h-8 items-center rounded-lg border px-2.5 text-[10px] font-semibold transition',
        active
          ? 'border-[var(--accent)] bg-[color:var(--accent)]/[0.08] text-[var(--text)]'
          : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function AutoHint({ auto, onReset, label }: { auto: boolean; onReset: () => void; label: string }) {
  return auto ? (
    <span className="inline-flex items-center gap-1 truncate text-[8px] font-semibold text-[var(--accent)]">
      <Wand2 size={9} className="shrink-0" />
      {label}
    </span>
  ) : (
    <button
      type="button"
      onClick={onReset}
      className={cx('inline-flex items-center gap-1 rounded text-[8px] font-semibold text-[var(--text-subtle)] hover:text-[var(--accent)]', focusRing)}
    >
      <RotateCcw size={9} />
      Reset to auto
    </button>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors', checked ? 'justify-end bg-[var(--accent)]' : 'justify-start bg-[var(--line)]', focusRing)}
    >
      <motion.span layout={!reduceMotion} transition={{ type: 'spring', stiffness: 600, damping: 36 }} className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );
}

function InlineAlert({ tone, message, action }: { tone: 'error' | 'warning'; message: string; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className={cx(
        'flex items-start gap-2.5 rounded-[14px] border px-3.5 py-3 text-[10px] leading-5',
        tone === 'error'
          ? 'border-red-500/20 bg-red-500/5 text-red-600'
          : 'border-[var(--warning-border,rgba(180,83,9,0.25))] bg-[var(--warning-soft,rgba(180,83,9,0.06))] text-[var(--warning,#b45309)]',
      )}
    >
      <AlertCircle size={13} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {action}
    </div>
  );
}

/* =============================================================================
 * CONTRACT DETAIL
 * =============================================================================
 */

function ContractDetailModal({
  contractId,
  onClose,
  onChanged,
  onCopy,
}: {
  contractId: string | null;
  onClose: () => void;
  onChanged: (message?: string) => void;
  onCopy: (value: string, message: string) => void;
}) {
  const titleId = useId();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);

  const requestRef = useRef<AbortController | null>(null);

  const loadContract = useCallback(async (id: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/admin/contracts/${encodeURIComponent(id)}`, {
        cache: 'no-store',
        credentials: 'include',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      const payload = (await response.json().catch(() => null)) as { contract?: ContractDetail; error?: string } | null;

      if (!response.ok || !payload?.contract) {
        throw new Error(payload?.error || 'The contract could not be loaded.');
      }

      setContract(payload.contract);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setLoadError(errorMessage(cause, 'The contract could not be loaded.'));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!contractId) {
      requestRef.current?.abort();
      return;
    }

    setContract((current) => (current?.id === contractId ? current : null));
    setActionError(null);
    void loadContract(contractId);
  }, [contractId, loadContract]);

  const runAction = useCallback(
    async (key: string, path: string, success: string, body?: Record<string, unknown>) => {
      if (!contract || busyAction) return false;

      setBusyAction(key);
      setActionError(null);

      try {
        const response = await fetch(`/api/admin/contracts/${encodeURIComponent(contract.id)}/${path}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body ?? {}),
        });

        const payload = (await response.json().catch(() => null)) as { contract?: ContractDetail; error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error || 'The contract could not be updated.');
        }

        if (payload?.contract) setContract(payload.contract);
        else await loadContract(contract.id);

        onChanged(success);
        return true;
      } catch (cause) {
        setActionError(errorMessage(cause, 'The contract could not be updated.'));
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [busyAction, contract, loadContract, onChanged],
  );

  const open = Boolean(contractId);
  const view = contract && contract.id === contractId ? contract : null;

  return (
    <>
      <ModalShell open={open} onClose={onClose} labelledBy={titleId} size="lg">
        <div className="flex max-h-[min(90vh,900px)] flex-col">
          {!view ? (
            <>
              <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3 sm:px-6">
                <p id={titleId} className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                  Contract
                </p>
                <IconButton label="Close" onClick={onClose}>
                  <X size={15} />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                {loadError && !loading ? (
                  <ErrorState title="This contract could not be loaded" message={loadError} onRetry={() => contractId && void loadContract(contractId)} />
                ) : (
                  <DetailSkeleton />
                )}
              </div>
            </>
          ) : (
            <ContractDetailBody
              titleId={titleId}
              contract={view}
              refreshing={loading}
              busyAction={busyAction}
              actionError={actionError}
              onClose={onClose}
              onCopy={onCopy}
              onSend={() => void runAction('send', 'send-for-signature', `${view.contractRef} sent for signature`)}
              onSign={() => setSignOpen(true)}
              onActivate={() => void runAction('activate', 'activate', `${view.contractRef} is now active`)}
            />
          )}
        </div>
      </ModalShell>

      <MarkSignedDialog
        open={signOpen && Boolean(view)}
        contract={view}
        busy={busyAction === 'sign'}
        onCancel={() => setSignOpen(false)}
        onConfirm={async (body) => {
          const ok = await runAction('sign', 'mark-signed', `${view?.contractRef ?? 'Contract'} marked as signed`, body);
          if (ok) setSignOpen(false);
        }}
      />
    </>
  );
}

function ContractDetailBody({
  titleId,
  contract,
  refreshing,
  busyAction,
  actionError,
  onClose,
  onCopy,
  onSend,
  onSign,
  onActivate,
}: {
  titleId: string;
  contract: ContractDetail;
  refreshing: boolean;
  busyAction: string | null;
  actionError: string | null;
  onClose: () => void;
  onCopy: (value: string, message: string) => void;
  onSend: () => void;
  onSign: () => void;
  onActivate: () => void;
}) {
  const meta = typeMeta(contract.type);
  const TypeIcon = meta.icon;
  const step = workflowIndex(contract);
  const ended = step === -1;
  const expiry = expiryLabel(contract.daysUntilExpiry);
  const permissions = contract.permissions;

  const nextAction = permissions.canSendForSignature
    ? { key: 'send', label: 'Send for signature', icon: <Send size={13} />, onClick: onSend }
    : permissions.canMarkSigned
      ? { key: 'sign', label: 'Mark as signed', icon: <PenLine size={13} />, onClick: onSign }
      : permissions.canActivate
        ? { key: 'activate', label: 'Activate', icon: <CheckCircle2 size={13} />, onClick: onActivate }
        : null;

  const secondaryActions = [
    permissions.canSendForSignature && nextAction?.key !== 'send' ? { key: 'send', label: 'Send for signature', icon: <Send size={13} />, onClick: onSend } : null,
    permissions.canMarkSigned && nextAction?.key !== 'sign' ? { key: 'sign', label: 'Mark as signed', icon: <PenLine size={13} />, onClick: onSign } : null,
    permissions.canActivate && nextAction?.key !== 'activate' ? { key: 'activate', label: 'Activate', icon: <CheckCircle2 size={13} />, onClick: onActivate } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <>
      <div className="border-b border-[var(--line)] px-5 pb-4 pt-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[var(--accent)]">
              <TypeIcon size={18} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={contract.displayStatus} />
                {contract.autoRenew ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2 py-1 text-[9px] font-semibold text-[var(--text-muted)]">
                    <Repeat size={9} />
                    Auto renews
                  </span>
                ) : null}
                {refreshing ? <Loader2 size={12} className="animate-spin text-[var(--text-subtle)]" /> : null}
              </div>
              <h2 id={titleId} className="mt-2 text-[17px] font-semibold leading-6 tracking-[-0.025em] text-[var(--text)]">
                {contract.title}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--text-muted)]">
                <button
                  type="button"
                  onClick={() => onCopy(contract.contractRef, `${contract.contractRef} copied`)}
                  className={cx('inline-flex items-center gap-1 rounded font-mono text-[var(--text-subtle)] transition hover:text-[var(--text)]', focusRing)}
                  title="Copy reference"
                >
                  {contract.contractRef}
                  <Copy size={10} />
                </button>
                <span className="text-[var(--text-subtle)]">·</span>
                <span>{meta.label}</span>
                <span className="text-[var(--text-subtle)]">·</span>
                <span>{clientTitle(contract.client)}</span>
                {contract.project ? (
                  <>
                    <span className="text-[var(--text-subtle)]">·</span>
                    <span>{contract.project.name}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        {!ended ? <WorkflowStepper current={step} /> : <EndedBanner contract={contract} />}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        {actionError ? <InlineAlert tone="error" message={actionError} /> : null}

        <div className="grid gap-2 sm:grid-cols-3">
          <HeroStat label="Value" value={formatMoney(contract.value, contract.currency)} sub={contract.billingCycle ? prettyEnum(contract.billingCycle) : 'One off'} />
          <HeroStat
            label="Ends"
            value={formatDate(contract.endDate, 'Open ended')}
            sub={expiry ?? 'No end date'}
            tone={contract.displayStatus === 'EXPIRING' ? 'warning' : undefined}
          />
          <HeroStat
            label="Renewal"
            value={formatDate(contract.renewalAt, 'Not set')}
            sub={contract.noticePeriodDays !== null ? `${contract.noticePeriodDays} days notice` : 'No notice period'}
          />
        </div>

        <div className="rounded-[18px] border border-[var(--line)] px-4 py-3.5">
          <div className="mb-2 flex items-center justify-between text-[9.5px] text-[var(--text-subtle)]">
            <span>{formatDate(contract.startDate, 'No start date')}</span>
            <span className="font-semibold text-[var(--text-muted)]">Term</span>
            <span>{formatDate(contract.endDate, 'Open ended')}</span>
          </div>
          <TermBar start={contract.startDate} end={contract.endDate} warn={contract.displayStatus === 'EXPIRING'} />
        </div>

        {nextAction || secondaryActions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/[0.05] px-4 py-3">
            <p className="mr-auto text-[10.5px] text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text)]">Next step.</span> {nextStepCopy(contract)}
            </p>
            {secondaryActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={Boolean(busyAction)}
                className={cx('inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[10px] font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-50', focusRing)}
              >
                {busyAction === action.key ? <Loader2 size={13} className="animate-spin" /> : action.icon}
                {action.label}
              </button>
            ))}
            {nextAction ? (
              <button
                type="button"
                data-autofocus
                onClick={nextAction.onClick}
                disabled={Boolean(busyAction)}
                className={cx('inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60', focusRing)}
              >
                {busyAction === nextAction.key ? <Loader2 size={13} className="animate-spin" /> : nextAction.icon}
                {nextAction.label}
              </button>
            ) : null}
          </div>
        ) : null}

        <DetailPanel title="Commercial terms" icon={<CircleDollarSign size={13} />}>
          <DetailGrid
            items={[
              ['Value', formatMoney(contract.value, contract.currency)],
              ['Currency', contract.currency],
              ['Billing', contract.billingCycle ? prettyEnum(contract.billingCycle) : 'One off'],
              ['Notice period', contract.noticePeriodDays !== null ? `${contract.noticePeriodDays} days` : 'Not set'],
              ['Starts', formatDate(contract.startDate)],
              ['Ends', formatDate(contract.endDate, 'Open ended')],
            ]}
          />
        </DetailPanel>

        <DetailPanel title="Signature" icon={<FileSignature size={13} />}>
          {contract.signedAt ? (
            <DetailGrid
              items={[
                ['Signed', formatDateTime(contract.signedAt)],
                ['Client signatory', contract.signedByClientName || 'Not recorded'],
                ['Syntra Grid signatory', contract.signedByCompanyName || 'Not recorded'],
              ]}
            />
          ) : (
            <p className="text-[10.5px] text-[var(--text-subtle)]">
              {contract.displayStatus === 'PENDING_SIGNATURE' ? 'Waiting for both parties to sign.' : 'Not signed yet.'}
            </p>
          )}
        </DetailPanel>

        <DetailPanel title="Document" icon={<FileText size={13} />}>
          {contract.documentUrl ? (
            <a
              href={contract.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cx('group flex items-center gap-3 rounded-[14px] border border-[var(--line)] px-3.5 py-3 transition hover:border-[color:var(--accent)]/40 hover:bg-[var(--surface-muted)]', focusRing)}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--surface-muted)] text-[var(--accent)]">
                <FileText size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-[var(--text)]">{contract.documentName || 'Contract document'}</span>
                <span className="mt-0.5 block truncate text-[9px] text-[var(--text-subtle)]">
                  {[prettyEnum(contract.documentMimeType?.split('/').pop() ?? '').toUpperCase(), formatBytes(contract.documentSizeBytes)].filter(Boolean).join(' · ') || 'Open in a new tab'}
                </span>
              </span>
              <ExternalLink size={13} className="shrink-0 text-[var(--text-subtle)] transition group-hover:text-[var(--accent)]" />
            </a>
          ) : (
            <div className="flex items-center gap-3 rounded-[14px] border border-dashed border-[var(--line)] px-3.5 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--surface-muted)] text-[var(--text-subtle)]">
                <FileText size={15} />
              </span>
              <p className="text-[10.5px] text-[var(--text-subtle)]">No document attached yet.</p>
            </div>
          )}
        </DetailPanel>

        {contract.description || contract.notes ? (
          <DetailPanel title="Notes" icon={<StickyNote size={13} />}>
            {contract.description ? (
              <div>
                <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">Scope</p>
                <p className="mt-1 whitespace-pre-wrap text-[11px] leading-6 text-[var(--text-muted)]">{contract.description}</p>
              </div>
            ) : null}
            {contract.notes ? (
              <div className={cx(contract.description && 'mt-3')}>
                <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">Internal</p>
                <p className="mt-1 whitespace-pre-wrap rounded-[12px] bg-[var(--surface-muted)] px-3 py-2.5 text-[11px] leading-6 text-[var(--text-muted)]">{contract.notes}</p>
              </div>
            ) : null}
          </DetailPanel>
        ) : null}

        <DetailPanel title="Activity" icon={<History size={13} />}>
          {contract.activities.length === 0 ? (
            <p className="text-[10.5px] text-[var(--text-subtle)]">No activity recorded yet.</p>
          ) : (
            <ol className="relative space-y-4">
              {contract.activities.map((activity, index) => (
                <li key={activity.id} className="relative flex gap-3">
                  {index < contract.activities.length - 1 ? <span className="absolute bottom-[-18px] left-[11px] top-6 w-px bg-[var(--line)]" /> : null}
                  <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--text-subtle)]">
                    <ActivityIcon type={activity.type} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[10.5px] font-medium text-[var(--text)]">{activity.description || prettyEnum(activity.type)}</p>
                    <p className="mt-0.5 text-[9px] text-[var(--text-subtle)]">
                      {activity.actor?.name || 'System'} · <span title={formatDateTime(activity.createdAt)}>{relativeTime(activity.createdAt)}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </DetailPanel>

        <p className="flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] text-[var(--text-subtle)]">
          <span>
            Created {formatDate(contract.createdAt)}
            {contract.createdBy ? ` by ${contract.createdBy.name}` : ''}
          </span>
          <span>
            Updated {relativeTime(contract.updatedAt)}
            {contract.updatedBy ? ` by ${contract.updatedBy.name}` : ''}
          </span>
        </p>
      </div>
    </>
  );
}

function nextStepCopy(contract: ContractDetail) {
  if (contract.permissions.canSendForSignature) return 'Send it to the client when the terms are agreed.';
  if (contract.permissions.canMarkSigned) return 'Record the signature once both parties have signed.';
  if (contract.permissions.canActivate) return 'Signed and ready. Activate it to start the term.';
  return 'Nothing to do right now.';
}

function WorkflowStepper({ current }: { current: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Contract progress">
      {WORKFLOW_STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li key={label} className="min-w-0">
            <div className="relative h-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: done || active ? '100%' : '0%' }}
                transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <p
              className={cx(
                'mt-1.5 flex items-center gap-1 truncate text-[9px] font-semibold',
                active ? 'text-[var(--text)]' : done ? 'text-[var(--text-muted)]' : 'text-[var(--text-subtle)]',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check size={10} className="shrink-0 text-[var(--accent)]" /> : null}
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function EndedBanner({ contract }: { contract: ContractDetail }) {
  const copy: Record<string, string> = {
    EXPIRED: `This contract reached its end date${contract.endDate ? ` on ${formatDate(contract.endDate)}` : ''}.`,
    TERMINATED: 'This contract was terminated before the end of its term.',
    CANCELLED: 'This contract was cancelled before it started.',
  };

  return (
    <div className="mt-4 flex items-center gap-2 rounded-[12px] bg-[var(--surface-muted)] px-3 py-2 text-[10px] text-[var(--text-muted)]">
      {contract.displayStatus === 'CANCELLED' ? <Ban size={12} /> : contract.displayStatus === 'TERMINATED' ? <XCircle size={12} /> : <Clock3 size={12} />}
      {copy[contract.displayStatus] ?? 'This contract has ended.'}
    </div>
  );
}

function HeroStat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'warning' }) {
  return (
    <div className="rounded-[16px] border border-[var(--line)] px-3.5 py-3">
      <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">{label}</p>
      <p className="mt-1 truncate text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--text)]">{value}</p>
      <p className={cx('mt-0.5 truncate text-[9px]', tone === 'warning' ? 'font-semibold text-[var(--warning,#b45309)]' : 'text-[var(--text-subtle)]')}>{sub}</p>
    </div>
  );
}

function DetailPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section>
      <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
        {icon}
        {title}
      </p>
      {children}
    </section>
  );
}

function DetailGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid overflow-hidden rounded-[16px] border border-[var(--line)] sm:grid-cols-2">
      {items.map(([label, value], index) => (
        <div
          key={label}
          className={cx(
            'px-3.5 py-2.5',
            index < items.length - (items.length % 2 === 0 ? 2 : 1) && 'sm:border-b',
            index < items.length - 1 && 'border-b sm:border-b-0',
            index % 2 === 0 && 'sm:border-r',
            'border-[var(--line)]',
          )}
        >
          <dt className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">{label}</dt>
          <dd className="mt-0.5 truncate text-[11px] font-medium text-[var(--text)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, LucideIcon> = {
    CONTRACT_CREATED: Plus,
    CONTRACT_UPDATED: FilePen,
    SENT_FOR_SIGNATURE: Send,
    SIGNED: PenLine,
    ACTIVATED: CheckCircle2,
    DOCUMENT_ADDED: FileText,
    DOCUMENT_REPLACED: FileText,
    RENEWAL_UPDATED: CalendarDays,
    RENEWED: Repeat,
    EXPIRED: Clock3,
    TERMINATED: XCircle,
    CANCELLED: Ban,
    NOTE_ADDED: StickyNote,
  };
  const Icon = map[type] ?? History;
  return <Icon size={11} />;
}

/* =============================================================================
 * MARK SIGNED
 * =============================================================================
 */

function MarkSignedDialog({
  open,
  contract,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  contract: ContractDetail | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (body: Record<string, unknown>) => void;
}) {
  const titleId = useId();
  const [signedOn, setSignedOn] = useState(todayInput());
  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    if (!open || !contract) return;
    setSignedOn(todayInput());
    setClientName(contract.signedByClientName ?? '');
    setCompanyName(contract.signedByCompanyName ?? '');
  }, [contract, open]);

  // eslint-disable-next-line react-hooks/purity
  const invalid = !parseInputDate(signedOn) || (parseInputDate(signedOn)?.getTime() ?? 0) > Date.now();

  return (
    <ModalShell open={open} onClose={() => (busy ? undefined : onCancel())} labelledBy={titleId} size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (invalid || busy) return;
          onConfirm({
            signedAt: inputToIso(signedOn),
            signedByClientName: clientName.trim() || null,
            signedByCompanyName: companyName.trim() || null,
          });
        }}
        className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[var(--accent)]">
          <PenLine size={18} />
        </div>
        <h3 id={titleId} className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">
          Mark as signed
        </h3>
        <p className="mt-1.5 text-[10.5px] leading-5 text-[var(--text-muted)]">Record when the agreement was signed and by whom. You can activate it straight after.</p>

        <div className="mt-5 space-y-3.5">
          <SmartField label="Signed on" required error={invalid ? 'Use a date that is today or earlier.' : undefined}>
            <input type="date" data-autofocus value={signedOn} max={todayInput()} onChange={(event) => setSignedOn(event.target.value)} className={inputClass(invalid ? 'invalid' : undefined)} />
          </SmartField>
          <SmartField label="Client signatory">
            <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Name of the person who signed" className={inputClass()} />
          </SmartField>
          <SmartField label="Syntra Grid signatory">
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Who signed for Syntra Grid" className={inputClass()} />
          </SmartField>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={cx('h-10 flex-1 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50', focusRing)}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || invalid}
            className={cx('inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60', focusRing)}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {busy ? 'Saving' : 'Mark signed'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* =============================================================================
 * LOADING
 * =============================================================================
 */

function LoadingState() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)]">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-4 border-b border-[var(--line)] px-5 py-4 last:border-b-0 motion-reduce:animate-none">
          <div className="h-10 w-10 rounded-[12px] bg-[var(--surface-muted)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-48 max-w-full rounded bg-[var(--surface-muted)]" />
            <div className="h-2.5 w-28 rounded bg-[var(--surface-muted)]" />
          </div>
          <div className="hidden h-3 w-24 rounded bg-[var(--surface-muted)] lg:block" />
          <div className="hidden h-3 w-32 rounded bg-[var(--surface-muted)] lg:block" />
          <div className="hidden h-6 w-24 rounded-full bg-[var(--surface-muted)] lg:block" />
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-5 motion-reduce:animate-none">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-[14px] bg-[var(--surface-muted)]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 rounded-full bg-[var(--surface-muted)]" />
          <div className="h-5 w-2/3 rounded bg-[var(--surface-muted)]" />
          <div className="h-3 w-1/2 rounded bg-[var(--surface-muted)]" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-[74px] rounded-[16px] bg-[var(--surface-muted)]" />
        ))}
      </div>
      <div className="h-24 rounded-[16px] bg-[var(--surface-muted)]" />
      <div className="h-32 rounded-[16px] bg-[var(--surface-muted)]" />
    </div>
  );
}

/* =============================================================================
 * SHARED PRIMITIVES
 * Same building blocks as the other admin tabs.
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

function useThemeBridge(ref: RefObject<HTMLElement | null>) {
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
  }, [ref]);

  return vars;
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
          {icon ?? <FileText size={21} strokeWidth={1.7} />}
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