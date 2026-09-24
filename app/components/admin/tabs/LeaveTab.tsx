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
  AlertTriangle,
  ArrowRight,
  Baby,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  FileText,
  GraduationCap,
  Heart,
  HeartPulse,
  Loader2,
  Palmtree,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  UserRound,
  Users,
  Wallet,
  WalletCards,
  Wand2,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type LeaveSection = 'mine' | 'requests' | 'calendar' | 'balances' | 'policies';

type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'RECORDED';

type LeaveType =
  | 'ANNUAL'
  | 'SICK'
  | 'PERSONAL'
  | 'COMPASSIONATE'
  | 'PARENTAL'
  | 'UNPAID'
  | 'STUDY'
  | 'OTHER';

type LeaveDayPortion = 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF';

type Department = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  employeeRef?: string | null;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  workEmail?: string | null;
  department?: Department | null;
};

type LeavePolicy = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  type: LeaveType;
  active: boolean;
  annualAllowance?: number | null;
  carryOverEnabled: boolean;
  maxCarryOverDays?: number | null;
  requiresApproval: boolean;
  allowBackdated: boolean;
  reasonRequired: boolean;
  countWeekends: boolean;
  paid: boolean;
  minimumNoticeDays?: number | null;
  maximumDaysPerRequest?: number | null;
  displayOrder: number;
};

type LeaveRequestItem = {
  id: string;
  requestRef?: string | null;
  employeeId?: string;
  policyId?: string;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  startPortion?: LeaveDayPortion;
  endPortion?: LeaveDayPortion;
  totalDays: number;
  reason?: string | null;
  employeeNote?: string | null;
  internalNote?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  recordedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  policy: LeavePolicy;
  employee?: Employee;
  reviewedBy?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

type LeaveBalance = {
  id: string;
  year: number;
  entitlement: number;
  carriedOver: number;
  adjustment: number;
  used: number;
  booked: number;
  available: number;
  employee?: Employee;
  policy: LeavePolicy;
};

type OverviewResponse = {
  employee: Employee;
  permissions: {
    canManage: boolean;
  };
  year: number;
  my: {
    approvedDaysThisYear: number;
    balances: LeaveBalance[];
    recentRequests: LeaveRequestItem[];
  };
  management: {
    pendingRequests: number;
    offToday: number;
    upcomingLeave: number;
  } | null;
};

type OptionsResponse = {
  employee: Employee;
  permissions: {
    canRequest: boolean;
    canManage: boolean;
    canManagePolicies: boolean;
    canManageBalances: boolean;
  };
  policies: LeavePolicy[];
  leaveTypes: LeaveType[];
  dayPortions: LeaveDayPortion[];
  statuses: LeaveStatus[];
};

type RequestsResponse = {
  scope: 'mine' | 'all';
  requests: LeaveRequestItem[];
};

type BalancesResponse = {
  year: number;
  scope: 'mine' | 'all';
  balances: LeaveBalance[];
};

type PoliciesResponse = {
  policies: LeavePolicy[];
};

type CalendarEntry = {
  id: string;
  startDate: string;
  endDate: string;
  startPortion: LeaveDayPortion;
  endPortion: LeaveDayPortion;
  totalDays: number;
  employee: Employee;
  policy: {
    id: string;
    name: string;
    type: LeaveType;
    paid: boolean;
  };
};

type CalendarResponse = {
  year: number;
  month: number;
  leave: CalendarEntry[];
};

type RequestForm = {
  policyId: string;
  startDate: string;
  endDate: string;
  startPortion: LeaveDayPortion;
  endPortion: LeaveDayPortion;
  reason: string;
  employeeNote: string;
};

type PolicyForm = {
  name: string;
  code: string;
  codeAuto: boolean;
  description: string;
  type: LeaveType;
  typeAuto: boolean;
  annualAllowance: string;
  carryOverEnabled: boolean;
  maxCarryOverDays: string;
  requiresApproval: boolean;
  allowBackdated: boolean;
  reasonRequired: boolean;
  countWeekends: boolean;
  paid: boolean;
  minimumNoticeDays: string;
  maximumDaysPerRequest: string;
  active: boolean;
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

type Person = {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  avatarUrl?: string | null;
};

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const LEAVE_TYPES: LeaveType[] = [
  'ANNUAL',
  'SICK',
  'PERSONAL',
  'COMPASSIONATE',
  'PARENTAL',
  'UNPAID',
  'STUDY',
  'OTHER',
];

const LEAVE_TYPE_META: Record<
  LeaveType,
  { icon: LucideIcon; dot: string; soft: string }
> = {
  ANNUAL: {
    icon: Palmtree,
    dot: 'bg-[var(--accent)]',
    soft: 'bg-[color:var(--accent)]/12 text-[var(--text)]',
  },
  SICK: { icon: HeartPulse, dot: 'bg-rose-500', soft: 'bg-rose-500/10 text-rose-700' },
  PERSONAL: { icon: UserRound, dot: 'bg-violet-500', soft: 'bg-violet-500/10 text-violet-700' },
  COMPASSIONATE: { icon: Heart, dot: 'bg-slate-500', soft: 'bg-slate-500/10 text-slate-700' },
  PARENTAL: { icon: Baby, dot: 'bg-emerald-500', soft: 'bg-emerald-500/10 text-emerald-700' },
  UNPAID: { icon: Wallet, dot: 'bg-zinc-400', soft: 'bg-zinc-500/10 text-zinc-700' },
  STUDY: { icon: GraduationCap, dot: 'bg-cyan-500', soft: 'bg-cyan-500/10 text-cyan-700' },
  OTHER: { icon: CircleDot, dot: 'bg-amber-500', soft: 'bg-amber-500/10 text-amber-700' },
};

const STATUS_META: Record<LeaveStatus, { badge: string; dot: string; label: string }> = {
  PENDING: {
    label: 'Pending',
    badge:
      'border-[color:var(--warning-border,rgba(245,158,11,0.25))] bg-[var(--warning-soft,rgba(245,158,11,0.1))] text-[var(--warning,#b45309)]',
    dot: 'bg-[var(--warning,#f59e0b)]',
  },
  APPROVED: {
    label: 'Approved',
    badge:
      'border-[color:var(--success-border,rgba(16,185,129,0.25))] bg-[var(--success-soft,rgba(16,185,129,0.1))] text-[var(--success,#047857)]',
    dot: 'bg-[var(--success,#10b981)]',
  },
  RECORDED: {
    label: 'Recorded',
    badge: 'border-blue-500/20 bg-blue-500/10 text-blue-700',
    dot: 'bg-blue-500',
  },
  REJECTED: {
    label: 'Rejected',
    badge: 'border-red-500/20 bg-red-500/10 text-red-700',
    dot: 'bg-red-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    badge: 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]',
    dot: 'bg-[var(--text-subtle)]',
  },
};

const STATUS_FILTERS: Array<'ALL' | LeaveStatus> = [
  'ALL',
  'PENDING',
  'APPROVED',
  'RECORDED',
  'REJECTED',
  'CANCELLED',
];

const PORTION_OPTIONS: Array<{ value: LeaveDayPortion; label: string }> = [
  { value: 'FULL_DAY', label: 'Full day' },
  { value: 'FIRST_HALF', label: 'Morning' },
  { value: 'SECOND_HALF', label: 'Afternoon' },
];

const EMPTY_POLICY_FORM: PolicyForm = {
  name: '',
  code: '',
  codeAuto: true,
  description: '',
  type: 'ANNUAL',
  typeAuto: true,
  annualAllowance: '',
  carryOverEnabled: false,
  maxCarryOverDays: '',
  requiresApproval: true,
  allowBackdated: false,
  reasonRequired: false,
  countWeekends: false,
  paid: true,
  minimumNoticeDays: '',
  maximumDaysPerRequest: '',
  active: true,
};

const TYPE_KEYWORDS: Array<{ type: LeaveType; words: string[] }> = [
  { type: 'SICK', words: ['sick', 'sickness', 'illness', 'medical'] },
  { type: 'PARENTAL', words: ['parental', 'maternity', 'paternity', 'adoption', 'shared'] },
  { type: 'COMPASSIONATE', words: ['compassionate', 'bereavement', 'funeral'] },
  { type: 'STUDY', words: ['study', 'exam', 'exams', 'training', 'learning'] },
  { type: 'UNPAID', words: ['unpaid'] },
  { type: 'PERSONAL', words: ['personal', 'wellbeing', 'volunteering'] },
  { type: 'ANNUAL', words: ['annual', 'holiday', 'holidays', 'vacation', 'pto'] },
];

const SECTION_KEY = 'syntragrid.leave.section';

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

function prettyEnum(value?: string | null) {
  if (!value) {
    return 'Not set';
  }

  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function employeeName(employee?: Person | null) {
  if (!employee) {
    return 'Employee';
  }

  const first = employee.preferredName?.trim() || employee.firstName?.trim();

  return [first, employee.lastName?.trim()].filter(Boolean).join(' ') || 'Employee';
}

function employeeSubtitle(employee?: Employee | null) {
  return employee?.department?.name || employee?.jobTitle || 'Team';
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload as T;
}

function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...options,
  }).format(date);
}

function formatShortDate(value?: string | null) {
  return formatDate(value, { year: undefined });
}

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function sameUtcDay(a: string, b: string) {
  return a.slice(0, 10) === b.slice(0, 10);
}

function dateRangeLabel(start: string, end: string) {
  if (sameUtcDay(start, end)) {
    return formatDate(start);
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (startDate.getUTCFullYear() === endDate.getUTCFullYear()) {
    return `${formatShortDate(start)} to ${formatDate(end)}`;
  }

  return `${formatDate(start)} to ${formatDate(end)}`;
}

function todayUtcInput() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function daysFromToday(value: string) {
  const target = Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
  const today = todayUtcInput();
  const base = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );

  return Math.round((target - base) / 86_400_000);
}

function relativeDate(value?: string | null) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return formatDate(value);
}

function daysLabel(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'day' : 'days'}`;
}

function formatDays(value: number) {
  return String(Math.round(value * 10) / 10);
}

function isApprovedLike(status: LeaveStatus) {
  return status === 'APPROVED' || status === 'RECORDED';
}

function numberValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requestFormDays(form: RequestForm, policy?: LeavePolicy) {
  if (!form.startDate || !form.endDate) {
    return 0;
  }

  const start = new Date(`${form.startDate}T00:00:00.000Z`);
  const end = new Date(`${form.endDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  let days = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const weekday = cursor.getUTCDay();

    if (policy?.countWeekends || (weekday !== 0 && weekday !== 6)) {
      days += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (start.getTime() === end.getTime()) {
    return form.startPortion !== 'FULL_DAY' ? (days > 0 ? 0.5 : 0) : days;
  }

  if (form.startPortion !== 'FULL_DAY') days -= 0.5;
  if (form.endPortion !== 'FULL_DAY') days -= 0.5;

  return Math.max(days, 0);
}

function suggestPolicyCode(name: string, taken: Set<string>) {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_LEAVE$/, '')
    .slice(0, 24);

  if (!base || !taken.has(base)) {
    return base;
  }

  let counter = 2;

  while (taken.has(`${base}_${counter}`)) {
    counter += 1;
  }

  return `${base}_${counter}`;
}

function suggestLeaveType(name: string): LeaveType | null {
  const words = new Set(
    name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean),
  );

  for (const group of TYPE_KEYWORDS) {
    if (group.words.some((word) => words.has(word))) {
      return group.type;
    }
  }

  return null;
}

function effectivePolicyType(form: PolicyForm) {
  return form.typeAuto ? (suggestLeaveType(form.name) ?? form.type) : form.type;
}

function policySummary(policy: LeavePolicy) {
  return [
    policy.annualAllowance != null
      ? `${formatDays(policy.annualAllowance)} days a year`
      : 'No fixed allowance',
    policy.paid ? 'Paid' : 'Unpaid',
    policy.requiresApproval ? 'Needs approval' : 'Approved automatically',
  ].join(' · ');
}

/* =============================================================================
 * MAIN TAB
 * =============================================================================
 */

export default function LeaveTab() {
  const reduceMotion = useReducedMotion();
  const theme = useThemeBridge();

  const [active, setActive] = useState<LeaveSection>('mine');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [myRequests, setMyRequests] = useState<LeaveRequestItem[]>([]);
  const [managementRequests, setManagementRequests] = useState<LeaveRequestItem[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [balanceYear, setBalanceYear] = useState(() => new Date().getFullYear());

  const [initialLoading, setInitialLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const [requestPreset, setRequestPreset] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestItem | null>(null);

  const [toast, setToast] = useState<ToastState>(null);

  const requestFilters = useRef<{ status: 'ALL' | LeaveStatus; query: string }>({
    status: 'ALL',
    query: '',
  });

  const canManage = options?.permissions.canManage ?? overview?.permissions.canManage ?? false;
  const canManagePolicies = options?.permissions.canManagePolicies ?? canManage;

  const notify = useCallback<Notify>((tone, message) => {
    setToast({ id: Date.now(), tone, message });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ---------- Loaders ---------- */

  const loadOverview = useCallback(async () => {
    const [overviewResponse, optionsResponse] = await Promise.all([
      fetch('/api/admin/leave/overview', { cache: 'no-store', credentials: 'include' }),
      fetch('/api/admin/leave/options', { cache: 'no-store', credentials: 'include' }),
    ]);

    const [overviewPayload, optionsPayload] = await Promise.all([
      readJson<OverviewResponse>(overviewResponse),
      readJson<OptionsResponse>(optionsResponse),
    ]);

    setOverview(overviewPayload);
    setOptions(optionsPayload);
    setPolicies((current) => (current.length ? current : optionsPayload.policies));
  }, []);

  const loadMyRequests = useCallback(async () => {
    const response = await fetch('/api/admin/leave/requests', {
      cache: 'no-store',
      credentials: 'include',
    });

    const payload = await readJson<RequestsResponse>(response);
    setMyRequests(payload.requests);
  }, []);

  const loadManagementRequests = useCallback(
    async (status: 'ALL' | LeaveStatus = 'ALL', query = '') => {
      requestFilters.current = { status, query };
      setSectionLoading(true);

      try {
        const params = new URLSearchParams({ scope: 'all' });

        if (status !== 'ALL') params.set('status', status);
        if (query.trim()) params.set('q', query.trim());

        const response = await fetch(`/api/admin/leave/requests?${params.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
        });

        const payload = await readJson<RequestsResponse>(response);
        setManagementRequests(payload.requests);
      } catch (cause) {
        notify('error', cause instanceof Error ? cause.message : 'Could not load requests.');
      } finally {
        setSectionLoading(false);
      }
    },
    [notify],
  );

  const loadPolicies = useCallback(async () => {
    setSectionLoading(true);

    try {
      const response = await fetch('/api/admin/leave/policies', {
        cache: 'no-store',
        credentials: 'include',
      });

      const payload = await readJson<PoliciesResponse>(response);
      setPolicies(payload.policies);
    } catch (cause) {
      notify('error', cause instanceof Error ? cause.message : 'Could not load policies.');
    } finally {
      setSectionLoading(false);
    }
  }, [notify]);

  const loadBalances = useCallback(
    async (year: number) => {
      setSectionLoading(true);

      try {
        const response = await fetch(`/api/admin/leave/balances?scope=all&year=${year}`, {
          cache: 'no-store',
          credentials: 'include',
        });

        const payload = await readJson<BalancesResponse>(response);
        setBalances(payload.balances);
      } catch (cause) {
        notify('error', cause instanceof Error ? cause.message : 'Could not load balances.');
      } finally {
        setSectionLoading(false);
      }
    },
    [notify],
  );

  const loadCalendar = useCallback(
    async (year: number, month: number) => {
      setSectionLoading(true);

      try {
        const response = await fetch(`/api/admin/leave/calendar?year=${year}&month=${month}`, {
          cache: 'no-store',
          credentials: 'include',
        });

        setCalendar(await readJson<CalendarResponse>(response));
      } catch (cause) {
        notify('error', cause instanceof Error ? cause.message : 'Could not load the calendar.');
      } finally {
        setSectionLoading(false);
      }
    },
    [notify],
  );

  const refreshCore = useCallback(async () => {
    await Promise.all([loadOverview(), loadMyRequests()]);
  }, [loadOverview, loadMyRequests]);

  const initialLoad = useCallback(async () => {
    setInitialLoading(true);
    setError(null);

    try {
      await refreshCore();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load leave.');
    } finally {
      setInitialLoading(false);
    }
  }, [refreshCore]);

  useEffect(() => {
    void initialLoad();
  }, [initialLoad]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SECTION_KEY) as LeaveSection | null;

      if (stored && ['mine', 'requests', 'calendar', 'balances', 'policies'].includes(stored)) {
        setActive(stored);
      }
    } catch {
      // Storage is optional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SECTION_KEY, active);
    } catch {
      // Storage is optional.
    }
  }, [active]);

  useEffect(() => {
    if (!options || canManage || active === 'mine') {
      return;
    }

    setActive('mine');
  }, [active, canManage, options]);

  useEffect(() => {
    if (!canManage) return;
    if (active === 'balances') void loadBalances(balanceYear);
  }, [active, balanceYear, canManage, loadBalances]);

  useEffect(() => {
    if (!canManage) return;
    if (active === 'policies') void loadPolicies();
  }, [active, canManage, loadPolicies]);

  useEffect(() => {
    if (!canManage) return;
    if (active === 'calendar') void loadCalendar(calendarMonth.year, calendarMonth.month);
  }, [active, calendarMonth, canManage, loadCalendar]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);

    try {
      await refreshCore();

      if (canManage) {
        if (active === 'requests') {
          await loadManagementRequests(
            requestFilters.current.status,
            requestFilters.current.query,
          );
        }
        if (active === 'balances') await loadBalances(balanceYear);
        if (active === 'policies') await loadPolicies();
        if (active === 'calendar') await loadCalendar(calendarMonth.year, calendarMonth.month);
      }
    } catch (cause) {
      notify('error', cause instanceof Error ? cause.message : 'Could not refresh.');
    } finally {
      setRefreshing(false);
    }
  }, [
    active,
    balanceYear,
    calendarMonth,
    canManage,
    loadBalances,
    loadCalendar,
    loadManagementRequests,
    loadPolicies,
    notify,
    refreshCore,
  ]);

  const handleChanged = useCallback(
    async (message?: string) => {
      if (message) {
        notify('success', message);
      }

      await refreshCore();

      if (canManage && active === 'requests') {
        await loadManagementRequests(
          requestFilters.current.status,
          requestFilters.current.query,
        );
      }

      if (canManage && active === 'calendar') {
        await loadCalendar(calendarMonth.year, calendarMonth.month);
      }
    },
    [active, calendarMonth, canManage, loadCalendar, loadManagementRequests, notify, refreshCore],
  );

  const openRequestModal = useCallback((policyId?: string) => {
    setRequestPreset(policyId ?? null);
    setRequestKey((key) => key + 1);
    setRequestOpen(true);
  }, []);

  const openRequest = useCallback((request: LeaveRequestItem) => {
    setSelectedRequest(request);
    setDetailOpen(true);
  }, []);

  const quickApprove = useCallback(
    async (request: LeaveRequestItem) => {
      try {
        const response = await fetch(`/api/admin/leave/requests/${request.id}/approve`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ internalNote: '' }),
        });

        await readJson(response);
        await handleChanged(`${employeeName(request.employee)}'s leave approved`);
      } catch (cause) {
        notify('error', cause instanceof Error ? cause.message : 'Could not approve the request.');
      }
    },
    [handleChanged, notify],
  );

  /* ---------- Keyboard ---------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || requestOpen || detailOpen) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (typing || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openRequestModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailOpen, openRequestModal, requestOpen]);

  /* ---------- Render ---------- */

  let content: ReactNode;

  if (initialLoading) {
    content = <PageSkeleton />;
  } else if (error || !overview || !options) {
    content = (
      <ErrorState
        title="Leave could not be loaded"
        message={error || 'Leave data is unavailable.'}
        onRetry={() => void initialLoad()}
      />
    );
  } else {
    const pending = overview.management?.pendingRequests ?? 0;

    content = (
      <>
        <section className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
          <div className="flex flex-col gap-3 px-2 pt-2 sm:px-3 lg:flex-row lg:items-center lg:justify-between lg:pr-4 lg:pt-0">
            <SectionNav
              value={active}
              onChange={setActive}
              canManage={canManage}
              pending={pending}
            />

            <div className="flex items-center justify-end gap-2 px-2 pb-3 lg:px-0 lg:pb-0">
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={refreshing}
                aria-label="Refresh leave"
                title="Refresh"
                className={cx(
                  'flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-60',
                  focusRing,
                )}
              >
                <RefreshCw
                  size={14}
                  strokeWidth={1.9}
                  className={cx(refreshing && 'animate-spin')}
                />
              </button>

              <button
                type="button"
                onClick={() => openRequestModal()}
                className={cx(
                  'inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] pl-4 pr-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90',
                  focusRing,
                )}
              >
                <Plus size={15} strokeWidth={2} />
                Request leave
                <kbd className="ml-1 hidden h-5 min-w-5 items-center justify-center rounded-md bg-white/15 px-1.5 text-[9px] font-semibold text-white/90 sm:inline-flex">
                  N
                </kbd>
              </button>
            </div>
          </div>
        </section>

        <div className="mt-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
            >
              {active === 'mine' ? (
                <MyLeaveView
                  overview={overview}
                  requests={myRequests}
                  onRequest={openRequestModal}
                  onOpenRequest={openRequest}
                />
              ) : null}

              {active === 'requests' && canManage ? (
                <RequestsView
                  overview={overview}
                  requests={managementRequests}
                  loading={sectionLoading}
                  currentEmployeeId={overview.employee.id}
                  onLoad={loadManagementRequests}
                  onOpen={openRequest}
                  onApprove={quickApprove}
                />
              ) : null}

              {active === 'calendar' && canManage ? (
                <CalendarView
                  data={calendar}
                  loading={sectionLoading}
                  year={calendarMonth.year}
                  month={calendarMonth.month}
                  onChange={(year, month) => setCalendarMonth({ year, month })}
                />
              ) : null}

              {active === 'balances' && canManage ? (
                <BalancesView
                  balances={balances}
                  year={balanceYear}
                  loading={sectionLoading}
                  onYearChange={setBalanceYear}
                />
              ) : null}

              {active === 'policies' && canManage ? (
                <PoliciesView
                  policies={policies}
                  loading={sectionLoading}
                  canEdit={canManagePolicies}
                  onChanged={async (message) => {
                    notify('success', message);
                    await Promise.all([loadPolicies(), loadOverview()]);
                  }}
                  notify={notify}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <RequestLeaveModal
          open={requestOpen}
          formKey={requestKey}
          presetPolicyId={requestPreset}
          policies={options.policies.filter((policy) => policy.active)}
          balances={overview.my.balances}
          onClose={() => setRequestOpen(false)}
          onCreated={async (policy) => {
            setRequestOpen(false);
            await handleChanged(
              policy.requiresApproval ? 'Request sent for approval' : 'Leave booked',
            );
          }}
        />

        <RequestDetailModal
          open={detailOpen}
          request={selectedRequest}
          canManage={canManage}
          currentEmployeeId={overview.employee.id}
          onClose={() => setDetailOpen(false)}
          onChanged={async (message) => {
            setDetailOpen(false);
            await handleChanged(message);
          }}
        />
      </>
    );
  }

  return (
    <PortalTheme.Provider value={theme.vars}>
      <div ref={theme.ref} className="mx-auto w-full min-w-0 max-w-[1600px]">
        {content}
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </PortalTheme.Provider>
  );
}

/* =============================================================================
 * SECTION NAVIGATION
 * =============================================================================
 */

function SectionNav({
  value,
  onChange,
  canManage,
  pending,
}: {
  value: LeaveSection;
  onChange: (value: LeaveSection) => void;
  canManage: boolean;
  pending: number;
}) {
  const reduceMotion = useReducedMotion();
  const id = useId();

  const items: Array<{
    id: LeaveSection;
    label: string;
    icon: LucideIcon;
    manage?: boolean;
    count?: number;
  }> = [
    { id: 'mine', label: 'My leave', icon: Palmtree },
    { id: 'requests', label: 'Requests', icon: FileText, manage: true, count: pending },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, manage: true },
    { id: 'balances', label: 'Balances', icon: WalletCards, manage: true },
    { id: 'policies', label: 'Policies', icon: Settings2, manage: true },
  ];

  return (
    <div className="min-w-0 overflow-x-auto [scrollbar-width:none]">
      <div role="tablist" aria-label="Leave sections" className="flex min-w-max">
        {items
          .filter((item) => !item.manage || canManage)
          .map((item) => {
            const active = item.id === value;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(item.id)}
                className={cx(
                  'relative inline-flex h-12 items-center gap-2 px-3.5 text-[11px] font-semibold transition-colors lg:h-14',
                  active
                    ? 'text-[var(--text)]'
                    : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
                  focusRing,
                )}
              >
                <Icon
                  size={14}
                  strokeWidth={active ? 2 : 1.8}
                  className={active ? 'text-[var(--accent)]' : undefined}
                />
                {item.label}

                {item.count ? (
                  <span className="rounded-md bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white">
                    {item.count}
                  </span>
                ) : null}

                {active ? (
                  <motion.span
                    layoutId={`${id}-underline`}
                    className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--accent)]"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 500, damping: 38 }
                    }
                  />
                ) : null}
              </button>
            );
          })}
      </div>
    </div>
  );
}

/* =============================================================================
 * MY LEAVE
 * =============================================================================
 */

function MyLeaveView({
  overview,
  requests,
  onRequest,
  onOpenRequest,
}: {
  overview: OverviewResponse;
  requests: LeaveRequestItem[];
  onRequest: (policyId?: string) => void;
  onOpenRequest: (request: LeaveRequestItem) => void;
}) {
  const balances = overview.my.balances;

  const upcoming = useMemo(
    () =>
      requests
        .filter(
          (request) =>
            (isApprovedLike(request.status) || request.status === 'PENDING') &&
            daysFromToday(request.endDate.slice(0, 10)) >= 0,
        )
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [requests],
  );

  const next = upcoming.find((request) => isApprovedLike(request.status)) ?? null;
  const pending = requests.filter((request) => request.status === 'PENDING');

  const totalAvailable = balances.reduce((sum, balance) => sum + balance.available, 0);
  const totalBooked = balances.reduce((sum, balance) => sum + balance.booked, 0);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
          <div className="p-5 sm:p-6">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
              Your {overview.year} allowance
            </p>

            <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
              <p className="text-[38px] font-semibold leading-none tabular-nums tracking-[-0.05em] text-[var(--text)]">
                {formatDays(totalAvailable)}
                <span className="ml-2 text-[13px] font-medium tracking-normal text-[var(--text-subtle)]">
                  days left
                </span>
              </p>

              <div className="flex gap-5 pb-1 text-[10px] text-[var(--text-subtle)]">
                <span>
                  <span className="font-semibold tabular-nums text-[var(--text)]">
                    {formatDays(totalBooked)}
                  </span>{' '}
                  booked
                </span>
                <span>
                  <span className="font-semibold tabular-nums text-[var(--text)]">
                    {formatDays(overview.my.approvedDaysThisYear)}
                  </span>{' '}
                  taken
                </span>
                {pending.length ? (
                  <span>
                    <span className="font-semibold tabular-nums text-[var(--text)]">
                      {pending.length}
                    </span>{' '}
                    awaiting approval
                  </span>
                ) : null}
              </div>
            </div>

            {balances.length ? (
              <ul className="mt-6 space-y-4">
                {balances.map((balance) => (
                  <BalanceRow
                    key={balance.id}
                    balance={balance}
                    onRequest={() => onRequest(balance.policy.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-6 rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-[11px] text-[var(--text-muted)]">
                Your balances for {overview.year} have not been set up yet. You can still
                request leave.
              </p>
            )}
          </div>

          <div className="border-t border-[var(--line)] p-5 sm:p-6 lg:border-l lg:border-t-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
              Next time away
            </p>

            {next ? (
              <button
                type="button"
                onClick={() => onOpenRequest(next)}
                className={cx(
                  'group mt-3 flex w-full items-center gap-4 rounded-2xl text-left',
                  focusRing,
                )}
              >
                <DateTile value={next.startDate} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--text)]">
                    {next.policy.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
                    {daysLabel(next.totalDays)}
                    {' · '}
                    {(() => {
                      const days = daysFromToday(next.startDate.slice(0, 10));
                      if (days <= 0) return 'Happening now';
                      if (days === 1) return 'Starts tomorrow';
                      return `In ${days} days`;
                    })()}
                  </p>
                </div>
                <ArrowRight
                  size={14}
                  className="text-[var(--text-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
                />
              </button>
            ) : (
              <div className="mt-3">
                <p className="text-[13px] font-semibold text-[var(--text)]">Nothing booked yet</p>
                <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
                  Time off you book will show here with a countdown.
                </p>
                <button
                  type="button"
                  onClick={() => onRequest()}
                  className={cx(
                    'mt-3 inline-flex items-center gap-1 rounded-md text-[10px] font-semibold text-[var(--accent)] hover:opacity-80',
                    focusRing,
                  )}
                >
                  Plan some time off
                  <ArrowRight size={11} />
                </button>
              </div>
            )}

            {upcoming.length > 1 ? (
              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                  Also coming up
                </p>
                <ul className="mt-2 space-y-1">
                  {upcoming
                    .filter((item) => item.id !== next?.id)
                    .slice(0, 3)
                    .map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onOpenRequest(item)}
                          className={cx(
                            'flex w-full items-center justify-between gap-3 rounded-lg py-1.5 text-left text-[11px] hover:text-[var(--accent)]',
                            focusRing,
                          )}
                        >
                          <span className="truncate font-medium text-[var(--text)]">
                            {dateRangeLabel(item.startDate, item.endDate)}
                          </span>
                          <StatusDot status={item.status} />
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <Panel
        title="Your requests"
        action={requests.length ? <CountPill value={requests.length} /> : undefined}
      >
        {requests.length ? (
          <div className="-mx-2 space-y-0.5">
            {requests.slice(0, 10).map((request) => (
              <RequestRow key={request.id} request={request} onOpen={() => onOpenRequest(request)} />
            ))}
          </div>
        ) : (
          <InlineEmpty
            icon={FileText}
            text="You have not requested any leave yet."
            action={
              <PrimaryButton onClick={() => onRequest()}>
                <Plus size={13} />
                Request leave
              </PrimaryButton>
            }
          />
        )}
      </Panel>
    </div>
  );
}

function BalanceRow({ balance, onRequest }: { balance: LeaveBalance; onRequest: () => void }) {
  const reduceMotion = useReducedMotion();
  const total = balance.entitlement + balance.carriedOver + balance.adjustment;
  const usedShare = total > 0 ? Math.min(100, (balance.used / total) * 100) : 0;
  const bookedShare = total > 0 ? Math.min(100 - usedShare, (balance.booked / total) * 100) : 0;
  const meta = LEAVE_TYPE_META[balance.policy.type];
  const Icon = meta.icon;

  return (
    <li className="group">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
          <Icon size={14} strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[12px] font-semibold text-[var(--text)]">
              {balance.policy.name}
            </p>
            <p className="shrink-0 text-[11px] tabular-nums text-[var(--text-subtle)]">
              <span className="font-semibold text-[var(--text)]">{formatDays(balance.available)}</span>
              {total > 0 ? ` of ${formatDays(total)} left` : ' left'}
            </p>
          </div>

          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <motion.span
              className="h-full bg-[var(--accent)]"
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${usedShare}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.span
              className="h-full bg-[var(--accent)] opacity-40"
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${bookedShare}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-3 text-[9px] text-[var(--text-subtle)]">
            <span>
              {formatDays(balance.used)} used · {formatDays(balance.booked)} booked
              {balance.carriedOver > 0 ? ` · ${formatDays(balance.carriedOver)} carried over` : ''}
            </span>
            <button
              type="button"
              onClick={onRequest}
              className={cx(
                'rounded font-semibold text-[var(--accent)] opacity-0 transition-opacity hover:opacity-80 group-hover:opacity-100 focus-visible:opacity-100',
                focusRing,
              )}
            >
              Book
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function RequestRow({
  request,
  onOpen,
  showEmployee = false,
  actions,
}: {
  request: LeaveRequestItem;
  onOpen: () => void;
  showEmployee?: boolean;
  actions?: ReactNode;
}) {
  const meta = LEAVE_TYPE_META[request.policy.type];
  const Icon = meta.icon;

  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--surface-muted)]">
      <button
        type="button"
        onClick={onOpen}
        className={cx('flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left', focusRing)}
      >
        {showEmployee ? (
          <Avatar person={request.employee ?? null} size="md" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]">
            <Icon size={15} strokeWidth={1.8} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-[var(--text)]">
            {showEmployee ? employeeName(request.employee) : request.policy.name}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-[var(--text-subtle)]">
            {showEmployee ? (
              <>
                <span className={cx('mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle', meta.dot)} />
                {request.policy.name} ·{' '}
              </>
            ) : null}
            {dateRangeLabel(request.startDate, request.endDate)} · {daysLabel(request.totalDays)}
          </p>
        </div>

        <div className="hidden shrink-0 text-right sm:block">
          <StatusBadge status={request.status} />
          <p className="mt-1 text-[9px] text-[var(--text-subtle)]">
            {request.createdAt ? `Sent ${relativeDate(request.createdAt)}` : ''}
          </p>
        </div>

        <span className="sm:hidden">
          <StatusDot status={request.status} />
        </span>
      </button>

      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

/* =============================================================================
 * REQUESTS (MANAGEMENT)
 * =============================================================================
 */

function RequestsView({
  overview,
  requests,
  loading,
  currentEmployeeId,
  onLoad,
  onOpen,
  onApprove,
}: {
  overview: OverviewResponse;
  requests: LeaveRequestItem[];
  loading: boolean;
  currentEmployeeId: string;
  onLoad: (status: 'ALL' | LeaveStatus, query: string) => Promise<void>;
  onOpen: (request: LeaveRequestItem) => void;
  onApprove: (request: LeaveRequestItem) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<'ALL' | LeaveStatus>('ALL');
  const [query, setQuery] = useState('');
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => void onLoad(status, query), query ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [status, query, onLoad]);

  const sorted = useMemo(
    () =>
      [...requests].sort((a, b) => {
        if ((a.status === 'PENDING') !== (b.status === 'PENDING')) {
          return a.status === 'PENDING' ? -1 : 1;
        }

        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      }),
    [requests],
  );

  const pendingList = sorted.filter((item) => item.status === 'PENDING');
  const otherList = sorted.filter((item) => item.status !== 'PENDING');
  const management = overview.management;

  const statusOptions: Array<DropdownOption<'ALL' | LeaveStatus>> = STATUS_FILTERS.map(
    (value) => ({
      value,
      label: value === 'ALL' ? 'All statuses' : STATUS_META[value].label,
      leading:
        value === 'ALL' ? (
          <span className="h-2 w-2 rounded-full border border-[var(--text-subtle)]" />
        ) : (
          <span className={cx('h-2 w-2 rounded-full', STATUS_META[value].dot)} />
        ),
    }),
  );

  const renderRow = (request: LeaveRequestItem) => {
    const own = request.employee?.id === currentEmployeeId || request.employeeId === currentEmployeeId;
    const reviewable = request.status === 'PENDING' && !own;

    return (
      <motion.div
        key={request.id}
        layout={!reduceMotion}
        initial={false}
        exit={{ opacity: 0 }}
      >
        <RequestRow
          request={request}
          showEmployee
          onOpen={() => onOpen(request)}
          actions={
            reviewable ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpen(request)}
                  className={cx(
                    'hidden h-8 items-center rounded-lg border border-[var(--line)] px-2.5 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface)] hover:text-[var(--text)] md:inline-flex',
                    focusRing,
                  )}
                >
                  Review
                </button>
                <button
                  type="button"
                  disabled={approving === request.id}
                  onClick={async () => {
                    setApproving(request.id);
                    await onApprove(request);
                    setApproving(null);
                  }}
                  aria-label={`Approve ${employeeName(request.employee)}'s leave`}
                  className={cx(
                    'inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 text-[10px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60',
                    focusRing,
                  )}
                >
                  {approving === request.id ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Check size={11} strokeWidth={2.4} />
                  )}
                  Approve
                </button>
              </>
            ) : undefined
          }
        />
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        {management ? (
          <MetricsGrid
            columns="grid-cols-3"
            items={[
              {
                label: 'To review',
                value: management.pendingRequests,
                helper: 'Waiting for a decision',
                icon: Clock3,
              },
              {
                label: 'Away today',
                value: management.offToday,
                helper: 'Approved absence',
                icon: UserRound,
              },
              {
                label: 'Upcoming',
                value: management.upcomingLeave,
                helper: `Approved in ${overview.year}`,
                icon: CalendarDays,
              },
            ]}
          />
        ) : null}

        <div className="flex flex-col gap-2 border-t border-[var(--line)] p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="relative min-w-0 flex-1 sm:max-w-[340px]">
            <Search
              size={15}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people"
              aria-label="Search requests by person"
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-10 pr-3 text-[11px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:bg-[var(--surface)]"
            />
          </div>

          <Dropdown
            value={status}
            onChange={setStatus}
            options={statusOptions}
            ariaLabel="Filter by status"
            triggerClassName="sm:w-[160px]"
            minWidth={190}
          />

          {loading ? (
            <Loader2 size={14} className="animate-spin text-[var(--text-subtle)] sm:ml-auto" />
          ) : null}
        </div>
      </section>

      {requests.length === 0 && !loading ? (
        <EmptyState
          icon={<FileText size={21} strokeWidth={1.7} />}
          title={status === 'ALL' && !query ? 'No leave requests yet' : 'Nothing matches'}
          description={
            status === 'ALL' && !query
              ? 'Requests from the team will appear here for review.'
              : 'Try a different search or status.'
          }
        />
      ) : (
        <>
          {pendingList.length ? (
            <Panel title="Needs your review" action={<CountPill value={pendingList.length} />}>
              <div className="-mx-2 space-y-0.5">
                <AnimatePresence initial={false}>{pendingList.map(renderRow)}</AnimatePresence>
              </div>
            </Panel>
          ) : status === 'ALL' || status === 'PENDING' ? (
            <div className="flex items-center gap-3 rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-sm">
              <CheckCircle2 size={16} className="text-[var(--success,#10b981)]" />
              <p className="text-[11px] font-medium text-[var(--text-muted)]">
                You are all caught up. Nothing is waiting for review.
              </p>
            </div>
          ) : null}

          {otherList.length ? (
            <Panel title={pendingList.length ? 'Everything else' : 'Requests'}>
              <div className="-mx-2 space-y-0.5">
                <AnimatePresence initial={false}>{otherList.map(renderRow)}</AnimatePresence>
              </div>
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}

/* =============================================================================
 * CALENDAR
 * =============================================================================
 */

function CalendarView({
  data,
  loading,
  year,
  month,
  onChange,
}: {
  data: CalendarResponse | null;
  loading: boolean;
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const todayKey = todayUtcInput();

  const move = (direction: -1 | 1) => {
    let nextMonth = month + direction;
    let nextYear = year;

    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }

    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    onChange(nextYear, nextMonth);
  };

  const entries = data && data.year === year && data.month === month ? data.leave : [];

  const cells = useMemo(() => {
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const list: Array<number | null> = Array.from({ length: offset }, () => null);

    for (let day = 1; day <= count; day += 1) list.push(day);
    while (list.length % 7 !== 0) list.push(null);

    return list;
  }, [year, month]);

  const keyFor = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const leaveFor = (day: number) => {
    const key = keyFor(day);
    return entries.filter(
      (item) => item.startDate.slice(0, 10) <= key && item.endDate.slice(0, 10) >= key,
    );
  };

  const awayToday = isCurrentMonth
    ? entries.filter(
        (item) => item.startDate.slice(0, 10) <= todayKey && item.endDate.slice(0, 10) >= todayKey,
      )
    : [];

  const typesInView = Array.from(new Set(entries.map((item) => item.policy.type)));

  return (
    <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2">
          <IconButton label="Previous month" onClick={() => move(-1)}>
            <ChevronLeft size={16} />
          </IconButton>
          <p className="min-w-[150px] text-center text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            {formatMonth(year, month)}
          </p>
          <IconButton label="Next month" onClick={() => move(1)}>
            <ChevronRight size={16} />
          </IconButton>
          {!isCurrentMonth ? (
            <SecondaryButton onClick={() => onChange(now.getFullYear(), now.getMonth() + 1)}>
              Today
            </SecondaryButton>
          ) : null}
          {loading ? <Loader2 size={14} className="ml-1 animate-spin text-[var(--text-subtle)]" /> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {typesInView.length ? (
            typesInView.map((type) => (
              <span key={type} className="inline-flex items-center gap-1.5 text-[9px] font-medium text-[var(--text-muted)]">
                <span className={cx('h-2 w-2 rounded-full', LEAVE_TYPE_META[type].dot)} />
                {prettyEnum(type)}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-[var(--text-subtle)]">
              Approved absences only. Reasons stay private.
            </span>
          )}
        </div>
      </div>

      {isCurrentMonth ? (
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
            Away today
          </p>
          {awayToday.length ? (
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none]">
              {awayToday.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] py-0.5 pl-0.5 pr-2 text-[10px] font-medium text-[var(--text)]"
                >
                  <Avatar person={item.employee} size="xs" />
                  {employeeName(item.employee)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-[var(--text-muted)]">Everyone is in.</p>
          )}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-[var(--line)]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => (
              <p
                key={label}
                className={cx(
                  'px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em]',
                  index > 4 ? 'text-[var(--text-subtle)]/70' : 'text-[var(--text-subtle)]',
                )}
              >
                {label}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, index) => {
              const weekend = index % 7 > 4;

              if (!day) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="min-h-[112px] border-b border-r border-[var(--line)] bg-[var(--surface-muted)]/40 [&:nth-child(7n)]:border-r-0"
                  />
                );
              }

              const leave = leaveFor(day);
              const isToday = keyFor(day) === todayKey;

              return (
                <div
                  key={day}
                  className={cx(
                    'min-h-[112px] border-b border-r border-[var(--line)] p-2 [&:nth-child(7n)]:border-r-0',
                    weekend && 'bg-[var(--surface-muted)]/40',
                  )}
                >
                  <span
                    className={cx(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                      isToday
                        ? 'bg-[var(--accent)] text-white'
                        : weekend
                          ? 'text-[var(--text-subtle)]'
                          : 'text-[var(--text-muted)]',
                    )}
                  >
                    {day}
                  </span>

                  <div className="mt-1.5 space-y-1">
                    {leave.slice(0, 3).map((item) => {
                      const meta = LEAVE_TYPE_META[item.policy.type];
                      const half =
                        (sameUtcDay(item.startDate, `${keyFor(day)}T00:00:00Z`) &&
                          item.startPortion !== 'FULL_DAY') ||
                        (sameUtcDay(item.endDate, `${keyFor(day)}T00:00:00Z`) &&
                          item.endPortion !== 'FULL_DAY');

                      return (
                        <div
                          key={item.id}
                          title={`${employeeName(item.employee)}, ${item.policy.name}${half ? ', half day' : ''}`}
                          className={cx(
                            'flex items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-[9px] font-semibold',
                            meta.soft,
                          )}
                        >
                          <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
                          <span className="truncate">{employeeName(item.employee)}</span>
                          {half ? <span className="ml-auto shrink-0 opacity-60">Half</span> : null}
                        </div>
                      );
                    })}

                    {leave.length > 3 ? (
                      <p className="px-1.5 text-[9px] font-semibold text-[var(--text-subtle)]">
                        {leave.length - 3} more
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =============================================================================
 * BALANCES
 * =============================================================================
 */

function BalancesView({
  balances,
  year,
  loading,
  onYearChange,
}: {
  balances: LeaveBalance[];
  year: number;
  loading: boolean;
  onYearChange: (year: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [policy, setPolicy] = useState('ALL');
  const currentYear = new Date().getFullYear();

  const policyOptions = useMemo<Array<DropdownOption<string>>>(() => {
    const map = new Map<string, LeavePolicy>();
    for (const balance of balances) map.set(balance.policy.id, balance.policy);

    return [
      { value: 'ALL', label: 'All policies' },
      ...Array.from(map.values()).map((item) => ({
        value: item.id,
        label: item.name,
        leading: <span className={cx('h-2 w-2 rounded-full', LEAVE_TYPE_META[item.type].dot)} />,
      })),
    ];
  }, [balances]);

  const yearOptions = useMemo<Array<DropdownOption<string>>>(
    () =>
      [currentYear - 1, currentYear, currentYear + 1].map((value) => ({
        value: String(value),
        label: String(value),
        hint: value === currentYear ? 'This year' : undefined,
      })),
    [currentYear],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    return balances.filter((balance) => {
      if (policy !== 'ALL' && balance.policy.id !== policy) return false;
      if (!term) return true;

      return [employeeName(balance.employee), balance.employee?.department?.name, balance.policy.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [balances, policy, query]);

  return (
    <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-col gap-2 border-b border-[var(--line)] p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative min-w-0 flex-1 sm:max-w-[300px]">
          <Search
            size={15}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people or departments"
            aria-label="Search balances"
            className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-10 pr-3 text-[11px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:bg-[var(--surface)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Dropdown
            value={policy}
            onChange={setPolicy}
            options={policyOptions}
            ariaLabel="Filter by policy"
            triggerClassName="sm:w-[170px]"
            minWidth={200}
          />
          <Dropdown
            value={String(year)}
            onChange={(value) => onYearChange(Number(value))}
            options={yearOptions}
            ariaLabel="Year"
            triggerClassName="sm:w-[110px]"
            minWidth={150}
          />
        </div>

        {loading ? <Loader2 size={14} className="animate-spin text-[var(--text-subtle)] sm:ml-auto" /> : null}
      </div>

      {loading && balances.length === 0 ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-xl bg-[var(--surface-muted)] motion-reduce:animate-none" />
          ))}
        </div>
      ) : filtered.length ? (
        <>
          <div className="hidden grid-cols-[minmax(200px,1.2fr)_minmax(140px,0.8fr)_minmax(200px,1.2fr)_90px] gap-4 border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-2.5 lg:grid">
            {['Person', 'Policy', 'Usage', 'Left'].map((label) => (
              <p key={label} className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)] last:text-right">
                {label}
              </p>
            ))}
          </div>

          <div className="divide-y divide-[var(--line)]">
            {filtered.map((balance) => {
              const total = balance.entitlement + balance.carriedOver + balance.adjustment;
              const usedShare = total > 0 ? Math.min(100, (balance.used / total) * 100) : 0;
              const bookedShare = total > 0 ? Math.min(100 - usedShare, (balance.booked / total) * 100) : 0;
              const low = total > 0 && balance.available / total <= 0.15;

              return (
                <div
                  key={balance.id}
                  className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-muted)] sm:px-5 lg:grid-cols-[minmax(200px,1.2fr)_minmax(140px,0.8fr)_minmax(200px,1.2fr)_90px] lg:items-center lg:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar person={balance.employee ?? null} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-[var(--text)]">
                        {employeeName(balance.employee)}
                      </p>
                      <p className="truncate text-[10px] text-[var(--text-subtle)]">
                        {employeeSubtitle(balance.employee)}
                      </p>
                    </div>
                  </div>

                  <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[var(--text)]">
                    <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', LEAVE_TYPE_META[balance.policy.type].dot)} />
                    <span className="truncate">{balance.policy.name}</span>
                  </p>

                  <div className="min-w-0">
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <span className="h-full bg-[var(--accent)]" style={{ width: `${usedShare}%` }} />
                      <span className="h-full bg-[var(--accent)] opacity-40" style={{ width: `${bookedShare}%` }} />
                    </div>
                    <p className="mt-1.5 text-[9px] tabular-nums text-[var(--text-subtle)]">
                      {formatDays(balance.used)} used · {formatDays(balance.booked)} booked of {formatDays(total)}
                      {balance.carriedOver ? ` · ${formatDays(balance.carriedOver)} carried` : ''}
                      {balance.adjustment
                        ? ` · ${balance.adjustment > 0 ? '+' : ''}${formatDays(balance.adjustment)} adjusted`
                        : ''}
                    </p>
                  </div>

                  <p
                    className={cx(
                      'text-[15px] font-semibold tabular-nums tracking-[-0.02em] lg:text-right',
                      low ? 'text-[var(--warning,#b45309)]' : 'text-[var(--text)]',
                    )}
                  >
                    {formatDays(balance.available)}
                    <span className="ml-1 text-[9px] font-medium tracking-normal text-[var(--text-subtle)]">days</span>
                  </p>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="p-4">
          <InlineEmpty
            icon={WalletCards}
            text={
              balances.length
                ? 'Nobody matches these filters.'
                : `No balances have been set up for ${year}.`
            }
          />
        </div>
      )}
    </section>
  );
}

/* =============================================================================
 * POLICIES
 * =============================================================================
 */

function PoliciesView({
  policies,
  loading,
  canEdit,
  onChanged,
  notify,
}: {
  policies: LeavePolicy[];
  loading: boolean;
  canEdit: boolean;
  onChanged: (message: string) => Promise<void>;
  notify: Notify;
}) {
  const reduceMotion = useReducedMotion();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [editing, setEditing] = useState<LeavePolicy | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<LeavePolicy | null>(null);
  const [archiving, setArchiving] = useState(false);

  const sorted = useMemo(
    () =>
      [...policies].sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          a.displayOrder - b.displayOrder ||
          a.name.localeCompare(b.name),
      ),
    [policies],
  );

  const openEditor = (policy: LeavePolicy | null) => {
    setEditing(policy);
    setEditorKey((key) => key + 1);
    setEditorOpen(true);
  };

  const archive = async () => {
    if (!archiveTarget) return;

    setArchiving(true);

    try {
      const response = await fetch(`/api/admin/leave/policies/${archiveTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      await readJson(response);
      setArchiveTarget(null);
      await onChanged(`${archiveTarget.name} archived`);
    } catch (cause) {
      notify('error', cause instanceof Error ? cause.message : 'Could not archive the policy.');
    } finally {
      setArchiving(false);
    }
  };

  if (loading && policies.length === 0) {
    return (
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-[210px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  return (
    <>
      {sorted.length === 0 ? (
        <EmptyState
          icon={<Settings2 size={21} strokeWidth={1.7} />}
          title="No leave policies yet"
          description="Create a policy such as Annual leave so people can start requesting time off."
          action={
            canEdit ? (
              <PrimaryButton onClick={() => openEditor(null)}>
                <Plus size={13} />
                Create a policy
              </PrimaryButton>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {sorted.map((policy) => {
              const meta = LEAVE_TYPE_META[policy.type];
              const Icon = meta.icon;
              const rules = [
                policy.carryOverEnabled
                  ? `Carry over${policy.maxCarryOverDays != null ? ` up to ${formatDays(policy.maxCarryOverDays)}` : ''}`
                  : null,
                policy.minimumNoticeDays ? `${policy.minimumNoticeDays} days notice` : null,
                policy.maximumDaysPerRequest
                  ? `Max ${formatDays(policy.maximumDaysPerRequest)} per request`
                  : null,
                policy.reasonRequired ? 'Reason required' : null,
                policy.allowBackdated ? 'Backdating allowed' : null,
                policy.countWeekends ? 'Counts weekends' : null,
              ].filter((rule): rule is string => Boolean(rule));

              return (
                <motion.article
                  key={policy.id}
                  layout={!reduceMotion}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={cx(
                    'flex flex-col rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm',
                    !policy.active && 'opacity-60',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]">
                      <Icon size={17} strokeWidth={1.8} />
                      <span className={cx('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--surface)]', meta.dot)} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                          {policy.name}
                        </h3>
                        {!policy.active ? (
                          <span className="shrink-0 rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                            Archived
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        {policy.code}
                      </p>
                    </div>

                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => openEditor(policy)}
                        aria-label={`Edit ${policy.name}`}
                        className={cx(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
                          focusRing,
                        )}
                      >
                        <Pencil size={13} />
                      </button>
                    ) : null}
                  </div>

                  {policy.description ? (
                    <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-[var(--text-muted)]">
                      {policy.description}
                    </p>
                  ) : null}

                  <p className="mt-4 text-[11px] font-semibold text-[var(--text)]">
                    {policySummary(policy)}
                  </p>

                  <div className="mb-4 mt-2 flex flex-wrap gap-1.5">
                    {rules.length ? (
                      rules.map((rule) => <Chip key={rule}>{rule}</Chip>)
                    ) : (
                      <span className="text-[10px] text-[var(--text-subtle)]">No extra rules</span>
                    )}
                  </div>

                  {canEdit && policy.active ? (
                    <div className="mt-auto flex justify-end border-t border-[var(--line)] pt-3">
                      <button
                        type="button"
                        onClick={() => setArchiveTarget(policy)}
                        className={cx(
                          'rounded-md text-[10px] font-semibold text-[var(--text-subtle)] transition hover:text-red-600',
                          focusRing,
                        )}
                      >
                        Archive
                      </button>
                    </div>
                  ) : null}
                </motion.article>
              );
            })}

            {canEdit ? (
              <motion.button
                key="new-policy"
                layout={!reduceMotion}
                type="button"
                onClick={() => openEditor(null)}
                className={cx(
                  'flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-[var(--line)] text-[var(--text-subtle)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]',
                  focusRing,
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-current">
                  <Plus size={16} />
                </span>
                <span className="text-[11px] font-semibold">New policy</span>
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
      )}

      <PolicyEditorModal
        open={editorOpen}
        formKey={editorKey}
        policy={editing}
        policies={policies}
        onClose={() => setEditorOpen(false)}
        onSaved={async (message) => {
          setEditorOpen(false);
          await onChanged(message);
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        busy={archiving}
        icon={<Settings2 size={18} strokeWidth={1.8} />}
        title={`Archive ${archiveTarget?.name ?? 'policy'}?`}
        description="People will no longer be able to request this type of leave. Existing requests and balances are kept."
        cancelLabel="Keep policy"
        confirmLabel="Archive"
        busyLabel="Archiving"
        onCancel={() => {
          if (!archiving) setArchiveTarget(null);
        }}
        onConfirm={() => void archive()}
      />
    </>
  );
}

function PolicyEditorModal({
  open,
  formKey,
  policy,
  policies,
  onClose,
  onSaved,
}: {
  open: boolean;
  formKey: number;
  policy: LeavePolicy | null;
  policies: LeavePolicy[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={titleId}>
      <PolicyEditorForm
        key={formKey}
        titleId={titleId}
        policy={policy}
        policies={policies}
        onClose={onClose}
        onSaved={onSaved}
      />
    </ModalShell>
  );
}

function PolicyEditorForm({
  titleId,
  policy,
  policies,
  onClose,
  onSaved,
}: {
  titleId: string;
  policy: LeavePolicy | null;
  policies: LeavePolicy[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion();

  const [form, setForm] = useState<PolicyForm>(() =>
    policy
      ? {
          name: policy.name,
          code: policy.code,
          codeAuto: false,
          description: policy.description ?? '',
          type: policy.type,
          typeAuto: false,
          annualAllowance: policy.annualAllowance == null ? '' : String(policy.annualAllowance),
          carryOverEnabled: policy.carryOverEnabled,
          maxCarryOverDays: policy.maxCarryOverDays == null ? '' : String(policy.maxCarryOverDays),
          requiresApproval: policy.requiresApproval,
          allowBackdated: policy.allowBackdated,
          reasonRequired: policy.reasonRequired,
          countWeekends: policy.countWeekends,
          paid: policy.paid,
          minimumNoticeDays: policy.minimumNoticeDays == null ? '' : String(policy.minimumNoticeDays),
          maximumDaysPerRequest:
            policy.maximumDaysPerRequest == null ? '' : String(policy.maximumDaysPerRequest),
          active: policy.active,
        }
      : EMPTY_POLICY_FORM,
  );

  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const takenCodes = useMemo(
    () => new Set(policies.filter((item) => item.id !== policy?.id).map((item) => item.code.toUpperCase())),
    [policies, policy?.id],
  );

  const code = form.codeAuto ? suggestPolicyCode(form.name, takenCodes) : form.code;
  const type = effectivePolicyType(form);
  const meta = LEAVE_TYPE_META[type];
  const TypeIcon = meta.icon;

  const set = <K extends keyof PolicyForm>(key: K, value: PolicyForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setIssue(null);
  };

  const typeOptions = useMemo<Array<DropdownOption<LeaveType>>>(
    () =>
      LEAVE_TYPES.map((value) => {
        const Icon = LEAVE_TYPE_META[value].icon;
        return {
          value,
          label: prettyEnum(value),
          leading: (
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
              <Icon size={12} strokeWidth={1.8} />
            </span>
          ),
        };
      }),
    [],
  );

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();

    if (saving) return;

    if (!form.name.trim()) {
      setNameError('Give the policy a name.');
      return;
    }

    if (!policy && !code) {
      setIssue('The code needs at least one letter or number.');
      return;
    }

    if (!policy && takenCodes.has(code.toUpperCase())) {
      setIssue('Another policy already uses this code.');
      return;
    }

    setSaving(true);
    setIssue(null);

    const nextOrder = policies.length
      ? Math.max(...policies.map((item) => item.displayOrder)) + 1
      : 0;

    try {
      const response = await fetch(
        policy ? `/api/admin/leave/policies/${policy.id}` : '/api/admin/leave/policies',
        {
          method: policy ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            ...(!policy ? { code } : {}),
            description: form.description.trim(),
            type,
            annualAllowance: numberValue(form.annualAllowance),
            carryOverEnabled: form.carryOverEnabled,
            maxCarryOverDays: form.carryOverEnabled ? numberValue(form.maxCarryOverDays) : null,
            requiresApproval: form.requiresApproval,
            allowBackdated: form.allowBackdated,
            reasonRequired: form.reasonRequired,
            countWeekends: form.countWeekends,
            paid: form.paid,
            minimumNoticeDays: numberValue(form.minimumNoticeDays),
            maximumDaysPerRequest: numberValue(form.maximumDaysPerRequest),
            displayOrder: policy ? policy.displayOrder : nextOrder,
            active: form.active,
          }),
        },
      );

      await readJson(response);
      await onSaved(policy ? 'Policy saved' : `${form.name.trim()} created`);
    } catch (cause) {
      setIssue(cause instanceof Error ? cause.message : 'Could not save the policy.');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={onKeyDown}
      noValidate
      className="flex max-h-[92dvh] min-h-0 flex-col sm:max-h-[min(88dvh,860px)]"
    >
      <div className="border-b border-[var(--line)] px-5 pb-5 pt-4 sm:px-7 sm:pt-6">
        <div className="flex items-start gap-4">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={type}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                className="flex"
              >
                <TypeIcon size={22} strokeWidth={1.8} />
              </motion.span>
            </AnimatePresence>
            <span className={cx('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white', meta.dot)} />
          </span>

          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              {policy ? 'Edit leave policy' : 'New leave policy'}
            </h2>

            <label className="mt-3 block">
              <span className="mb-1.5 flex items-center gap-1 text-[9px] font-semibold text-[var(--text-muted)]">
                Policy name <span className="text-[var(--accent)]">*</span>
              </span>
              <input
                data-autofocus
                value={form.name}
                onChange={(event) => {
                  set('name', event.target.value);
                  setNameError(null);
                }}
                placeholder="Type the policy name, e.g. Annual leave"
                aria-invalid={Boolean(nameError)}
                className={cx(inputClass(nameError ?? undefined), 'h-11 text-[13px] font-semibold')}
              />
            </label>
            {nameError ? <p className="mt-1 text-[9px] font-medium text-red-600">{nameError}</p> : null}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                {code || 'code'}
                {form.codeAuto && !policy ? <Wand2 size={9} className="text-[var(--accent)]" /> : null}
              </span>
              {policy ? (
                <span className="text-[9px] text-[var(--text-subtle)]">Codes cannot change once created</span>
              ) : (
                <span className="text-[9px] text-[var(--text-subtle)]">Code generated from the name</span>
              )}
            </div>
          </div>

          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
        {issue ? (
          <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3 text-[10px] leading-5 text-red-600">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {issue}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Leave type"
            as="div"
            hint={form.typeAuto && suggestLeaveType(form.name) ? 'Matched to the name' : undefined}
          >
            <Dropdown
              value={type}
              onChange={(value) => {
                setForm((current) => ({
                  ...current,
                  type: value,
                  typeAuto: false,
                  paid: value === 'UNPAID' ? false : current.paid,
                }));
              }}
              options={typeOptions}
              ariaLabel="Leave type"
            />
          </Field>

          <Field label="Days a year" hint="Leave empty for no fixed allowance">
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.annualAllowance}
              onChange={(event) => set('annualAllowance', event.target.value)}
              placeholder="25"
              className={cx(inputClass(), 'tabular-nums')}
            />
          </Field>
        </div>

        <Field label="When should people use it?" className="mt-4">
          <textarea
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            rows={2}
            placeholder="A short explanation shown when people request leave"
            className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
          />
        </Field>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Minimum notice" hint="In days">
            <input
              type="number"
              min={0}
              step={1}
              value={form.minimumNoticeDays}
              onChange={(event) => set('minimumNoticeDays', event.target.value)}
              placeholder="None"
              className={cx(inputClass(), 'tabular-nums')}
            />
          </Field>

          <Field label="Most days in one request">
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.maximumDaysPerRequest}
              onChange={(event) => set('maximumDaysPerRequest', event.target.value)}
              placeholder="No limit"
              className={cx(inputClass(), 'tabular-nums')}
            />
          </Field>
        </div>

        <p className="mb-2 mt-6 text-[11px] font-semibold text-[var(--text)]">Rules</p>
        <div className="divide-y divide-[var(--line)] rounded-[18px] border border-[var(--line)]">
          <RuleSwitch
            label="Paid leave"
            description="People are paid as normal while away."
            checked={form.paid}
            onChange={(value) => set('paid', value)}
          />
          <RuleSwitch
            label="Needs approval"
            description="Requests wait for a manager. Turn off to approve automatically."
            checked={form.requiresApproval}
            onChange={(value) => set('requiresApproval', value)}
          />
          <RuleSwitch
            label="Reason required"
            description="People must say why before they can submit."
            checked={form.reasonRequired}
            onChange={(value) => set('reasonRequired', value)}
          />
          <RuleSwitch
            label="Allow past dates"
            description="Useful for sickness recorded after the fact."
            checked={form.allowBackdated}
            onChange={(value) => set('allowBackdated', value)}
          />
          <RuleSwitch
            label="Count weekends"
            description="Saturdays and Sundays use up the allowance."
            checked={form.countWeekends}
            onChange={(value) => set('countWeekends', value)}
          />
          <div>
            <RuleSwitch
              label="Carry over unused days"
              description="Leftover days move into next year."
              checked={form.carryOverEnabled}
              onChange={(value) => set('carryOverEnabled', value)}
            />
            <AnimatePresence initial={false}>
              {form.carryOverEnabled ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.1 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-4 pb-4">
                    <span className="text-[10px] text-[var(--text-muted)]">Up to</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={form.maxCarryOverDays}
                      onChange={(event) => set('maxCarryOverDays', event.target.value)}
                      placeholder="5"
                      aria-label="Maximum days carried over"
                      className={cx(inputClass(), 'w-24 tabular-nums')}
                    />
                    <span className="text-[10px] text-[var(--text-muted)]">days, empty for no limit</span>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          {policy ? (
            <RuleSwitch
              label="Active"
              description="Archived policies cannot be requested."
              checked={form.active}
              onChange={(value) => set('active', value)}
            />
          ) : null}
        </div>
      </div>

      <div className="border-t border-[var(--line)] bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={cx(
              'h-10 flex-1 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50 sm:flex-none',
              focusRing,
            )}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={cx(
              'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 sm:min-w-[140px] sm:flex-none',
              focusRing,
            )}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {saving ? 'Saving' : policy ? 'Save changes' : 'Create policy'}
          </button>
        </div>
      </div>
    </form>
  );
}

function RuleSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-[var(--text)]">{label}</p>
        <p className="mt-0.5 text-[10px] leading-4 text-[var(--text-subtle)]">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/* =============================================================================
 * REQUEST LEAVE MODAL
 * =============================================================================
 */

function RequestLeaveModal({
  open,
  formKey,
  presetPolicyId,
  policies,
  balances,
  onClose,
  onCreated,
}: {
  open: boolean;
  formKey: number;
  presetPolicyId: string | null;
  policies: LeavePolicy[];
  balances: LeaveBalance[];
  onClose: () => void;
  onCreated: (policy: LeavePolicy) => Promise<void>;
}) {
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={titleId}>
      <RequestLeaveForm
        key={formKey}
        titleId={titleId}
        presetPolicyId={presetPolicyId}
        policies={policies}
        balances={balances}
        onClose={onClose}
        onCreated={onCreated}
      />
    </ModalShell>
  );
}

function RequestLeaveForm({
  titleId,
  presetPolicyId,
  policies,
  balances,
  onClose,
  onCreated,
}: {
  titleId: string;
  presetPolicyId: string | null;
  policies: LeavePolicy[];
  balances: LeaveBalance[];
  onClose: () => void;
  onCreated: (policy: LeavePolicy) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion();
  const sortedPolicies = useMemo(
    () => [...policies].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)),
    [policies],
  );

  const [form, setForm] = useState<RequestForm>(() => ({
    policyId: presetPolicyId ?? sortedPolicies[0]?.id ?? '',
    startDate: '',
    endDate: '',
    startPortion: 'FULL_DAY',
    endPortion: 'FULL_DAY',
    reason: '',
    employeeNote: '',
  }));
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  const policy = sortedPolicies.find((item) => item.id === form.policyId);
  const balance = balances.find((item) => item.policy.id === form.policyId);
  const singleDay = Boolean(form.startDate) && form.startDate === form.endDate;
  const days = requestFormDays(
    singleDay ? { ...form, endPortion: form.startPortion } : form,
    policy,
  );
  const today = todayUtcInput();

  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform),
    [],
  );

  const problems = useMemo(() => {
    const blocking: string[] = [];
    const warnings: string[] = [];

    if (!policy || !form.startDate || !form.endDate) {
      return { blocking, warnings };
    }

    if (form.endDate < form.startDate) {
      blocking.push('The last day is before the first day.');
    }

    if (!policy.allowBackdated && form.startDate < today) {
      blocking.push(`${policy.name} cannot be booked for past dates.`);
    }

    if (policy.maximumDaysPerRequest && days > policy.maximumDaysPerRequest) {
      blocking.push(`${policy.name} allows at most ${daysLabel(policy.maximumDaysPerRequest)} per request.`);
    }

    if (days === 0 && form.endDate >= form.startDate) {
      blocking.push('Those dates only cover weekends, so no days would be used.');
    }

    if (policy.minimumNoticeDays && form.startDate >= today) {
      const notice = daysFromToday(form.startDate);
      if (notice < policy.minimumNoticeDays) {
        warnings.push(
          `${policy.name} asks for ${policy.minimumNoticeDays} days notice. This starts in ${notice} ${notice === 1 ? 'day' : 'days'}.`,
        );
      }
    }

    if (balance && policy.annualAllowance != null && days > balance.available) {
      warnings.push(
        `This is ${formatDays(days - balance.available)} more than you have left.`,
      );
    }

    return { blocking, warnings };
  }, [balance, days, form.endDate, form.startDate, policy, today]);

  const policyOptions = useMemo<Array<DropdownOption<string>>>(
    () =>
      sortedPolicies.map((item) => {
        const itemBalance = balances.find((entry) => entry.policy.id === item.id);
        const Icon = LEAVE_TYPE_META[item.type].icon;

        return {
          value: item.id,
          label: item.name,
          hint: [item.paid ? 'Paid' : 'Unpaid', item.requiresApproval ? 'needs approval' : 'approved automatically'].join(', '),
          leading: (
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
              <Icon size={12} strokeWidth={1.8} />
            </span>
          ),
          trailing: itemBalance ? (
            <span className="text-[9px] font-semibold tabular-nums text-[var(--text-subtle)]">
              {formatDays(itemBalance.available)} left
            </span>
          ) : undefined,
        };
      }),
    [balances, sortedPolicies],
  );

  const set = <K extends keyof RequestForm>(key: K, value: RequestForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setIssue(null);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();

    if (saving || !policy) return;

    if (!form.startDate || !form.endDate) {
      setIssue('Choose the first and last day.');
      return;
    }

    if (policy.reasonRequired && !form.reason.trim()) {
      setReasonError(`${policy.name} needs a reason.`);
      return;
    }

    if (problems.blocking.length) {
      setIssue(problems.blocking[0]);
      return;
    }

    setSaving(true);
    setIssue(null);

    try {
      const response = await fetch('/api/admin/leave/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          endPortion: singleDay ? form.startPortion : form.endPortion,
          reason: form.reason.trim(),
          employeeNote: form.employeeNote.trim(),
        }),
      });

      await readJson(response);
      await onCreated(policy);
    } catch (cause) {
      setIssue(cause instanceof Error ? cause.message : 'Could not send the request.');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  if (sortedPolicies.length === 0) {
    return (
      <div className="px-6 pb-7 pt-8 text-center">
        <h2 id={titleId} className="text-[15px] font-semibold text-[var(--text)]">
          No leave types available
        </h2>
        <p className="mx-auto mt-2 max-w-[320px] text-[11px] leading-5 text-[var(--text-muted)]">
          An administrator needs to create a leave policy before anyone can request time off.
        </p>
        <div className="mt-5 flex justify-center">
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={onKeyDown}
      noValidate
      className="flex max-h-[92dvh] min-h-0 flex-col sm:max-h-[min(88dvh,820px)]"
    >
      <div className="flex items-start gap-4 border-b border-[var(--line)] px-5 pb-4 pt-4 sm:px-7 sm:pt-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
          <Palmtree size={20} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            Request leave
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {policy?.requiresApproval
              ? 'Your manager will be asked to approve it.'
              : 'This type of leave is approved automatically.'}
          </p>
        </div>
        <IconButton label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
        <Field label="Type of leave" as="div">
          <Dropdown
            value={form.policyId}
            onChange={(value) => set('policyId', value)}
            options={policyOptions}
            ariaLabel="Type of leave"
            minWidth={300}
          />
        </Field>
        {policy?.description ? (
          <p className="mt-1.5 text-[10px] leading-4 text-[var(--text-subtle)]">{policy.description}</p>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="First day" required>
            <input
              data-autofocus
              type="date"
              value={form.startDate}
              min={policy?.allowBackdated ? undefined : today}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({
                  ...current,
                  startDate: value,
                  endDate: !current.endDate || current.endDate < value ? value : current.endDate,
                }));
                setIssue(null);
              }}
              className={cx(inputClass(), '[color-scheme:light]')}
            />
          </Field>

          <Field label="Last day" required hint={form.startDate && form.endDate === form.startDate ? 'Same day' : undefined}>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(event) => set('endDate', event.target.value)}
              className={cx(inputClass(), '[color-scheme:light]')}
            />
          </Field>
        </div>

        {form.startDate && form.endDate ? (
          <div className={cx('mt-4 grid gap-4', !singleDay && 'sm:grid-cols-2')}>
            <Field label={singleDay ? 'How much of the day' : 'First day'} as="div">
              <Segmented
                value={form.startPortion}
                onChange={(value) => set('startPortion', value)}
                ariaLabel="First day portion"
                options={PORTION_OPTIONS}
              />
            </Field>
            {!singleDay ? (
              <Field label="Last day" as="div">
                <Segmented
                  value={form.endPortion}
                  onChange={(value) => set('endPortion', value)}
                  ariaLabel="Last day portion"
                  options={PORTION_OPTIONS}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {form.startDate && form.endDate && form.endDate >= form.startDate ? (
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-5 rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                    You are requesting
                  </p>
                  <p className="mt-1 truncate text-[12px] font-semibold text-[var(--text)]">
                    {singleDay
                      ? `${formatWeekday(form.startDate)} ${formatDate(form.startDate)}`
                      : `${formatWeekday(form.startDate)} ${formatShortDate(form.startDate)} to ${formatWeekday(form.endDate)} ${formatDate(form.endDate)}`}
                  </p>
                </div>
                <p className="shrink-0 text-[26px] font-semibold leading-none tabular-nums tracking-[-0.04em] text-[var(--text)]">
                  {formatDays(days)}
                  <span className="ml-1 text-[10px] font-medium tracking-normal text-[var(--text-subtle)]">
                    {days === 1 ? 'day' : 'days'}
                  </span>
                </p>
              </div>

              {balance && policy?.annualAllowance != null ? (
                <p className="mt-3 border-t border-[var(--line)] pt-3 text-[10px] text-[var(--text-muted)]">
                  <span className="font-semibold tabular-nums text-[var(--text)]">
                    {formatDays(balance.available)}
                  </span>{' '}
                  left now, leaving{' '}
                  <span
                    className={cx(
                      'font-semibold tabular-nums',
                      balance.available - days < 0 ? 'text-red-600' : 'text-[var(--text)]',
                    )}
                  >
                    {formatDays(balance.available - days)}
                  </span>{' '}
                  after this.
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {problems.blocking.length || problems.warnings.length ? (
          <div className="mt-3 space-y-1.5">
            {problems.blocking.map((message) => (
              <p key={message} className="flex items-start gap-2 text-[10px] font-medium leading-4 text-red-600">
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                {message}
              </p>
            ))}
            {problems.warnings.map((message) => (
              <p key={message} className="flex items-start gap-2 text-[10px] font-medium leading-4 text-[var(--warning,#b45309)]">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                {message}
              </p>
            ))}
          </div>
        ) : null}

        <Field
          label="Reason"
          required={policy?.reasonRequired}
          error={reasonError ?? undefined}
          hint={policy?.reasonRequired ? undefined : 'Optional'}
          className="mt-5"
        >
          <textarea
            value={form.reason}
            onChange={(event) => {
              set('reason', event.target.value);
              setReasonError(null);
            }}
            rows={2}
            placeholder="A short reason for your manager"
            className={cx(inputClass(reasonError ?? undefined), 'h-auto resize-none py-2.5 leading-5')}
          />
        </Field>

        {noteOpen ? (
          <Field label="Note for your approver" hint="Optional" className="mt-4">
            <textarea
              value={form.employeeNote}
              onChange={(event) => set('employeeNote', event.target.value)}
              rows={2}
              placeholder="Handover plans, who is covering, anything else"
              className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
            />
          </Field>
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className={cx(
              'mt-3 inline-flex items-center gap-1 rounded-md text-[10px] font-semibold text-[var(--accent)] hover:opacity-80',
              focusRing,
            )}
          >
            <Plus size={11} />
            Add a note about handover or cover
          </button>
        )}

        {issue ? (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3 text-[10px] leading-5 text-red-600">
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
            to send
          </p>
          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={cx(
                'h-10 flex-1 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50 sm:flex-none',
                focusRing,
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || problems.blocking.length > 0}
              className={cx(
                'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[150px] sm:flex-none',
                focusRing,
              )}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
              {saving ? 'Sending' : policy?.requiresApproval ? 'Send request' : 'Book leave'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* =============================================================================
 * REQUEST DETAIL MODAL
 * =============================================================================
 */

function RequestDetailModal({
  open,
  request,
  canManage,
  currentEmployeeId,
  onClose,
  onChanged,
}: {
  open: boolean;
  request: LeaveRequestItem | null;
  canManage: boolean;
  currentEmployeeId: string;
  onClose: () => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={titleId}>
      {request ? (
        <RequestDetail
          key={request.id}
          titleId={titleId}
          request={request}
          canManage={canManage}
          currentEmployeeId={currentEmployeeId}
          onClose={onClose}
          onChanged={onChanged}
        />
      ) : null}
    </ModalShell>
  );
}

function RequestDetail({
  titleId,
  request,
  canManage,
  currentEmployeeId,
  onClose,
  onChanged,
}: {
  titleId: string;
  request: LeaveRequestItem;
  canManage: boolean;
  currentEmployeeId: string;
  onClose: () => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<'view' | 'approve' | 'reject' | 'cancel'>('view');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);

  const own = request.employee?.id === currentEmployeeId || request.employeeId === currentEmployeeId;
  const canReview = canManage && !own && request.status === 'PENDING';
  const canCancel =
    (own || canManage) && ['PENDING', 'APPROVED', 'RECORDED'].includes(request.status);

  const meta = LEAVE_TYPE_META[request.policy.type];
  const Icon = meta.icon;

  const act = async (type: 'approve' | 'reject' | 'cancel') => {
    if (type === 'reject' && !note.trim()) {
      setIssue('Add a reason so they know why.');
      return;
    }

    setBusy(true);
    setIssue(null);

    try {
      const response = await fetch(`/api/admin/leave/requests/${request.id}/${type}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(type === 'approve' ? { internalNote: note.trim() } : { reason: note.trim() }),
      });

      await readJson(response);
      await onChanged(
        type === 'approve' ? 'Leave approved' : type === 'reject' ? 'Request declined' : 'Leave cancelled',
      );
    } catch (cause) {
      setIssue(cause instanceof Error ? cause.message : 'Could not update the request.');
    } finally {
      setBusy(false);
    }
  };

  const facts: Array<{ label: string; value: string }> = [
    { label: 'Duration', value: daysLabel(request.totalDays) },
    {
      label: 'First day',
      value: PORTION_OPTIONS.find((item) => item.value === (request.startPortion ?? 'FULL_DAY'))?.label ?? 'Full day',
    },
    {
      label: 'Last day',
      value: PORTION_OPTIONS.find((item) => item.value === (request.endPortion ?? 'FULL_DAY'))?.label ?? 'Full day',
    },
    { label: 'Sent', value: request.createdAt ? formatDate(request.createdAt) : 'Unknown' },
  ];

  return (
    <div className="flex max-h-[92dvh] min-h-0 flex-col sm:max-h-[min(88dvh,820px)]">
      <div className="flex items-start gap-4 border-b border-[var(--line)] px-5 pb-5 pt-4 sm:px-7 sm:pt-6">
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]">
          <Icon size={19} strokeWidth={1.8} />
          <span className={cx('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white', meta.dot)} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              {request.policy.name}
            </h2>
            <StatusBadge status={request.status} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {dateRangeLabel(request.startDate, request.endDate)}
            {request.requestRef ? ` · ${request.requestRef}` : ''}
          </p>
        </div>

        <IconButton label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
        {request.employee && !own ? (
          <div className="mb-5 flex items-center gap-3">
            <Avatar person={request.employee} size="md" />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-[var(--text)]">
                {employeeName(request.employee)}
              </p>
              <p className="truncate text-[10px] text-[var(--text-subtle)]">
                {[request.employee.jobTitle, request.employee.department?.name].filter(Boolean).join(' · ') || 'Team'}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="bg-white px-3.5 py-3">
              <p className="text-[9px] font-medium text-[var(--text-subtle)]">{fact.label}</p>
              <p className="mt-0.5 text-[12px] font-semibold text-[var(--text)]">{fact.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {request.reason ? <NoteBlock label="Reason" text={request.reason} /> : null}
          {request.employeeNote ? <NoteBlock label="Note" text={request.employeeNote} /> : null}
          {request.rejectionReason ? <NoteBlock label="Why it was declined" text={request.rejectionReason} tone="red" /> : null}
          {request.cancellationReason ? <NoteBlock label="Why it was cancelled" text={request.cancellationReason} /> : null}
          {request.internalNote && canManage ? <NoteBlock label="Internal note" text={request.internalNote} /> : null}

          {request.reviewedAt ? (
            <p className="flex items-center gap-2 text-[10px] text-[var(--text-subtle)]">
              <Avatar person={request.reviewedBy ?? null} size="xs" />
              Reviewed{request.reviewedBy ? ` by ${employeeName(request.reviewedBy)}` : ''} on {formatDate(request.reviewedAt)}
            </p>
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {mode !== 'view' ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <Field
                label={
                  mode === 'approve'
                    ? 'Internal note'
                    : mode === 'reject'
                      ? 'Reason for declining'
                      : 'Reason for cancelling'
                }
                required={mode === 'reject'}
                hint={mode === 'reject' ? 'They will see this' : 'Optional'}
                className="mt-5"
              >
                <textarea
                  autoFocus
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setIssue(null);
                  }}
                  rows={3}
                  placeholder={
                    mode === 'approve'
                      ? 'Only visible to managers'
                      : mode === 'reject'
                        ? 'For example, the team is short that week'
                        : 'A short note for the record'
                  }
                  className={cx(inputClass(issue ?? undefined), 'h-auto resize-none py-2.5 leading-5')}
                />
              </Field>
              {issue ? <p className="mt-1 text-[9px] font-medium text-red-600">{issue}</p> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {canReview || canCancel ? (
        <div className="border-t border-[var(--line)] bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mode === 'view' ? (
              <>
                {canCancel ? (
                  <button
                    type="button"
                    onClick={() => setMode('cancel')}
                    className={cx(
                      'mr-auto inline-flex h-10 items-center gap-1.5 rounded-xl px-2 text-[10px] font-semibold text-[var(--text-subtle)] transition hover:text-red-600',
                      focusRing,
                    )}
                  >
                    <XCircle size={13} />
                    Cancel leave
                  </button>
                ) : null}

                {canReview ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode('reject')}
                      className={cx(
                        'h-10 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text)] transition hover:border-red-500/40 hover:text-red-600',
                        focusRing,
                      )}
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('approve')}
                      className={cx(
                        'hidden h-10 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] sm:inline-flex sm:items-center',
                        focusRing,
                      )}
                    >
                      Approve with note
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act('approve')}
                      className={cx(
                        'inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60',
                        focusRing,
                      )}
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Approve
                    </button>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMode('view');
                    setNote('');
                    setIssue(null);
                  }}
                  className={cx(
                    'h-10 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50',
                    focusRing,
                  )}
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(mode)}
                  className={cx(
                    'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[10px] font-semibold text-white shadow-sm transition disabled:opacity-60',
                    mode === 'approve' ? 'bg-[var(--accent)] hover:opacity-90' : 'bg-red-600 hover:bg-red-700',
                    focusRing,
                  )}
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                  {mode === 'approve' ? 'Approve' : mode === 'reject' ? 'Decline request' : 'Cancel leave'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NoteBlock({ label, text, tone }: { label: string; text: string; tone?: 'red' }) {
  return (
    <div>
      <p className="text-[9px] font-semibold text-[var(--text-subtle)]">{label}</p>
      <p
        className={cx(
          'mt-1 whitespace-pre-wrap text-[12px] leading-6',
          tone === 'red' ? 'text-red-700' : 'text-[var(--text-muted)]',
        )}
      >
        {text}
      </p>
    </div>
  );
}

/* =============================================================================
 * LEAVE UI
 * =============================================================================
 */

function StatusBadge({ status }: { status: LeaveStatus }) {
  const meta = STATUS_META[status];

  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[7px] font-bold uppercase tracking-[0.08em]',
        meta.badge,
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

function StatusDot({ status }: { status: LeaveStatus }) {
  return (
    <span
      title={STATUS_META[status].label}
      aria-label={STATUS_META[status].label}
      className={cx('inline-block h-2 w-2 shrink-0 rounded-full', STATUS_META[status].dot)}
    />
  );
}

function DateTile({ value }: { value: string }) {
  const date = new Date(value);

  return (
    <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[16px] border border-[var(--line)] bg-[var(--surface)]">
      <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
        {new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(date)}
      </span>
      <span className="text-[20px] font-semibold leading-none tabular-nums text-[var(--text)]">
        {date.getUTCDate()}
      </span>
    </span>
  );
}

function MetricsGrid({
  items,
  columns,
}: {
  items: Array<{ label: string; value: string | number; helper: string; icon: LucideIcon }>;
  columns: string;
}) {
  return (
    <div className={cx('grid gap-px bg-[var(--line)]', columns)}>
      {items.map((metric) => {
        const Icon = metric.icon;

        return (
          <div key={metric.label} className="min-w-0 bg-[var(--surface)] px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                  {metric.label}
                </p>
                <p className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-[-0.04em] text-[var(--text)]">
                  {metric.value}
                </p>
                <p className="mt-0.5 truncate text-[9px] text-[var(--text-subtle)]">{metric.helper}</p>
              </div>
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)] sm:flex">
                <Icon size={15} strokeWidth={1.8} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'justify-end bg-[var(--accent)]' : 'justify-start bg-[var(--line)]',
        focusRing,
      )}
    >
      <motion.span
        layout={!reduceMotion}
        transition={{ type: 'spring', stiffness: 600, damping: 36 }}
        className="h-5 w-5 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function InlineEmpty({
  icon: Icon,
  text,
  action,
}: {
  icon: LucideIcon;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]">
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <p className="max-w-[300px] text-[10px] leading-5 text-[var(--text-subtle)]">{text}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-14 animate-pulse rounded-[26px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
      <div className="h-[300px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
      <div className="h-[260px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
    </div>
  );
}

/* =============================================================================
 * SHARED PRIMITIVES
 * Same building blocks as the Team, Departments and Recruitment tabs.
 * =============================================================================
 */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function initials(first?: string | null, last?: string | null) {
  const a = first?.trim().charAt(0) ?? '';
  const b = last?.trim().charAt(0) ?? '';

  return `${a}${b}`.toUpperCase();
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

function ConfirmDialog({
  open,
  busy,
  icon,
  title,
  description,
  note,
  cancelLabel,
  confirmLabel,
  busyLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  note?: string;
  cancelLabel: string;
  confirmLabel: string;
  busyLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onCancel} labelledBy={titleId} size="sm">
      <div className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-red-500/20 bg-red-500/5 text-red-600">
          {icon}
        </div>

        <h3
          id={titleId}
          className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]"
        >
          {title}
        </h3>

        <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
          {description}
        </p>

        {note ? (
          <p className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-[10px] leading-5 text-[var(--text-muted)]">
            {note}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={cx(
              'h-10 flex-1 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50',
              focusRing,
            )}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            data-autofocus
            onClick={onConfirm}
            disabled={busy}
            className={cx(
              'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-[10px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60',
              focusRing,
            )}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : null}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
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

function Avatar({
  person,
  size = 'md',
  animateChanges = false,
}: {
  person: Person | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animateChanges?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  const sizeClass = {
    xs: 'h-6 w-6 rounded-full text-[8px]',
    sm: 'h-8 w-8 rounded-[10px] text-[9px]',
    md: 'h-10 w-10 rounded-[13px] text-[11px]',
    lg: 'h-11 w-11 rounded-[15px] text-[12px]',
    xl: 'h-14 w-14 rounded-[18px] text-[15px]',
  }[size];

  const iconSize = { xs: 10, sm: 13, md: 15, lg: 17, xl: 20 }[size];

  if (person?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatarUrl}
        alt=""
        className={cx(
          'shrink-0 border border-[var(--line)] object-cover',
          sizeClass,
        )}
      />
    );
  }

  const letters = person ? initials(person.firstName, person.lastName) : '';

  const content = letters ? (
    <span className="tracking-[0.02em]">{letters}</span>
  ) : (
    <UserRound size={iconSize} strokeWidth={1.8} />
  );

  return (
    <div
      className={cx(
        'flex shrink-0 items-center justify-center border border-[var(--line)] bg-[var(--surface-muted)] font-bold',
        letters ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]',
        sizeClass,
      )}
    >
      {animateChanges ? (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={letters || 'empty'}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { type: 'spring', stiffness: 500, damping: 28 }
            }
            className="flex"
          >
            {content}
          </motion.span>
        </AnimatePresence>
      ) : (
        content
      )}
    </div>
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

function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        'rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[12px] font-semibold tracking-[-0.01em] text-[var(--text)]">
            {title}
          </h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}