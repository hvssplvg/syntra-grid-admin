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
  type Dispatch,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SetStateAction,
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
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Copy,
  Grid2X2,
  IdCard,
  Laptop,
  Layers3,
  LayoutList,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Network,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundPlus,
  UserX,
  Users,
  Wand2,
  X,
} from 'lucide-react';

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type EmployeeStatus =
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'OFFBOARDING'
  | 'FORMER';

type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'CONTRACTOR'
  | 'INTERN'
  | 'TEMPORARY';

type WorkArrangement = 'REMOTE' | 'HYBRID' | 'ONSITE';

type DepartmentStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

type AdminRole =
  | 'OWNER'
  | 'ADMIN'
  | 'DEVELOPER'
  | 'SUPPORT'
  | 'FINANCE'
  | 'VIEWER';

type ViewMode = 'grid' | 'list';

type SortMode =
  | 'name-asc'
  | 'name-desc'
  | 'newest'
  | 'start-date'
  | 'department';

type WorkspaceTab =
  | 'overview'
  | 'employment'
  | 'access'
  | 'reports'
  | 'activity';

type Department = {
  id: string;
  name: string;
  slug?: string | null;
  code?: string | null;
  icon?: string | null;
  colour?: string | null;
  status?: DepartmentStatus;
};

type EmployeeSummary = {
  id: string;
  employeeRef?: string | null;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  workEmail?: string | null;
  avatarUrl?: string | null;
  country?: string | null;
  city?: string | null;
  jobTitle: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  workArrangement?: WorkArrangement | null;
  startDate?: string | null;
  endDate?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
  adminUserId?: string | null;
  linkedinUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  department?: Department | null;
  manager?: {
    id: string;
    employeeRef?: string | null;
    firstName: string;
    lastName: string;
    preferredName?: string | null;
    jobTitle: string;
    avatarUrl?: string | null;
    status: EmployeeStatus;
  } | null;
  adminUser?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    role: AdminRole;
    active: boolean;
  } | null;
  _count?: {
    directReports?: number;
  };
};

type EmployeeDetail = EmployeeSummary & {
  personalEmail?: string | null;
  phone?: string | null;
  bio?: string | null;
  notes?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  directReports?: EmployeeSummary[];
  adminUser?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    role: AdminRole;
    active: boolean;
    createdAt?: string;
    updatedAt?: string;
  } | null;
};

type TeamResponse = {
  ok?: boolean;
  employees?: EmployeeSummary[];
  team?: EmployeeSummary[];
  data?: EmployeeSummary[];
  items?: EmployeeSummary[];
  error?: string;
};

type EmployeeDetailSummary = {
  directReports?: number;
  hasSystemAccess?: boolean;
  hasDepartment?: boolean;
  hasManager?: boolean;
  isCurrentEmployee?: boolean;
};

type EmployeeDetailResponse = {
  ok?: boolean;
  employee?: EmployeeDetail;
  summary?: EmployeeDetailSummary;
  error?: string;
};

type DepartmentOption = Department;

type ManagerOption = {
  id: string;
  employeeRef?: string | null;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  jobTitle: string;
  avatarUrl?: string | null;
  status: EmployeeStatus;
  department?: {
    id: string;
    name: string;
  } | null;
};

type AdminUserOption = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  role: AdminRole;
  active: boolean;
};

type TeamOptionsResponse = {
  ok?: boolean;
  departments?: DepartmentOption[];
  managers?: ManagerOption[];
  adminUsers?: AdminUserOption[];
  availableAdminUsers?: AdminUserOption[];
  systemAccounts?: AdminUserOption[];
  error?: string;
};

type EmployeeForm = {
  firstName: string;
  lastName: string;
  preferredName: string;
  personalEmail: string;
  workEmail: string;
  phone: string;
  jobTitle: string;
  departmentId: string;
  managerId: string;
  status: EmployeeStatus;
  statusAuto: boolean;
  employmentType: EmploymentType;
  workArrangement: '' | WorkArrangement;
  startDate: string;
  country: string;
  city: string;
  linkedinUrl: string;
  bio: string;
  notes: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  adminUserId: string;
};

type FieldErrors = Partial<Record<keyof EmployeeForm, string>>;

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

const VIEW_STORAGE_KEY = 'syntragrid.team.view';
const SORT_STORAGE_KEY = 'syntragrid.team.sort';
const STATUS_STORAGE_KEY = 'syntragrid.team.status';
const DEPARTMENT_STORAGE_KEY = 'syntragrid.team.department';
const DRAFT_STORAGE_KEY = 'syntragrid.team.employee-draft';

const WORK_EMAIL_DOMAIN = 'syntragrid.com';

const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  'ONBOARDING',
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'OFFBOARDING',
  'FORMER',
];

const EMPLOYMENT_TYPES: EmploymentType[] = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACTOR',
  'INTERN',
  'TEMPORARY',
];

const SORT_OPTIONS: Array<DropdownOption<SortMode>> = [
  { value: 'name-asc', label: 'Name A to Z' },
  { value: 'name-desc', label: 'Name Z to A' },
  { value: 'newest', label: 'Newest first' },
  { value: 'start-date', label: 'Start date' },
  { value: 'department', label: 'Department' },
];

const WIZARD_STEPS = [
  { id: 1, label: 'Profile' },
  { id: 2, label: 'Role' },
  { id: 3, label: 'Contact' },
  { id: 4, label: 'Review' },
] as const;

const EMPTY_FORM: EmployeeForm = {
  firstName: '',
  lastName: '',
  preferredName: '',
  personalEmail: '',
  workEmail: '',
  phone: '',
  jobTitle: '',
  departmentId: '',
  managerId: '',
  status: 'ONBOARDING',
  statusAuto: true,
  employmentType: 'FULL_TIME',
  workArrangement: '',
  startDate: '',
  country: '',
  city: '',
  linkedinUrl: '',
  bio: '',
  notes: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  adminUserId: '',
};

const COLOUR_OPTIONS = [
  'emerald',
  'blue',
  'violet',
  'amber',
  'rose',
  'cyan',
  'slate',
] as const;

const ICON_KEYWORDS: Array<{ icon: string; words: string[] }> = [
  {
    icon: 'layers',
    words: ['engineering', 'product', 'development', 'dev', 'technology', 'tech', 'platform', 'software', 'data', 'it'],
  },
  {
    icon: 'sparkles',
    words: ['design', 'marketing', 'growth', 'brand', 'creative', 'content', 'social', 'media', 'ai', 'innovation', 'research'],
  },
  {
    icon: 'shield',
    words: ['security', 'legal', 'compliance', 'risk', 'finance', 'accounts', 'audit', 'quality'],
  },
  {
    icon: 'users',
    words: ['people', 'hr', 'human', 'resources', 'talent', 'team', 'client', 'clients', 'customer', 'success', 'support', 'sales', 'community'],
  },
  {
    icon: 'network',
    words: ['operations', 'ops', 'infrastructure', 'partnerships', 'logistics', 'delivery', 'projects', 'strategy'],
  },
];

/*
 * Popups are portalled to document.body, outside the element that defines
 * the dashboard theme variables. The bridge copies them across.
 */
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

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

function prettyEnum(value?: string | null, fallback = 'Not set') {
  if (!value) {
    return fallback;
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function employeeName(person: Person) {
  const preferred = person.preferredName?.trim();
  const first = preferred || person.firstName?.trim() || '';
  const last = person.lastName?.trim() || '';

  return `${first} ${last}`.trim() || 'Unnamed';
}

function initials(first?: string | null, last?: string | null) {
  const a = first?.trim().charAt(0) ?? '';
  const b = last?.trim().charAt(0) ?? '';

  return `${a}${b}`.toUpperCase();
}

function adminUserName(user: AdminUserOption) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.email
  );
}

function formatDate(value?: string | null, fallback = 'Not set') {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function relativeDate(value?: string | null) {
  if (!value) {
    return 'No activity';
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

function statusTone(status: EmployeeStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'border-[color:var(--success-border,rgba(16,185,129,0.25))] bg-[var(--success-soft,rgba(16,185,129,0.1))] text-[var(--success,#047857)]';
    case 'ONBOARDING':
      return 'border-blue-500/20 bg-blue-500/10 text-blue-700';
    case 'ON_LEAVE':
      return 'border-[color:var(--warning-border,rgba(245,158,11,0.25))] bg-[var(--warning-soft,rgba(245,158,11,0.1))] text-[var(--warning,#b45309)]';
    case 'SUSPENDED':
      return 'border-red-500/20 bg-red-500/10 text-red-700';
    case 'OFFBOARDING':
      return 'border-orange-500/20 bg-orange-500/10 text-orange-700';
    case 'FORMER':
      return 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]';
  }
}

function statusDot(status: EmployeeStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-[var(--success,#10b981)]';
    case 'ONBOARDING':
      return 'bg-blue-500';
    case 'ON_LEAVE':
      return 'bg-[var(--warning,#f59e0b)]';
    case 'SUSPENDED':
      return 'bg-red-500';
    case 'OFFBOARDING':
      return 'bg-orange-500';
    case 'FORMER':
      return 'bg-[var(--text-subtle)]';
  }
}

function colourDotClass(colour?: string | null) {
  switch (colour) {
    case 'emerald':
      return 'bg-emerald-500';
    case 'blue':
      return 'bg-blue-500';
    case 'violet':
      return 'bg-violet-500';
    case 'amber':
      return 'bg-amber-500';
    case 'rose':
      return 'bg-rose-500';
    case 'cyan':
      return 'bg-cyan-500';
    case 'slate':
      return 'bg-slate-500';
    default:
      return 'bg-[var(--accent)]';
  }
}

function suggestIcon(name: string) {
  const words = new Set(
    name
      .toLowerCase()
      .replace(/&/g, ' ')
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );

  for (const group of ICON_KEYWORDS) {
    if (group.words.some((word) => words.has(word))) {
      return group.icon;
    }
  }

  return 'building';
}

function suggestColour(name: string) {
  const key = name.trim().toLowerCase();

  if (!key) {
    return null;
  }

  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }

  return COLOUR_OPTIONS[hash % COLOUR_OPTIONS.length];
}

function iconForDepartment(icon: string | null | undefined, size = 14) {
  const props = { size, strokeWidth: 1.8 };

  switch (icon) {
    case 'users':
      return <Users {...props} />;
    case 'network':
      return <Network {...props} />;
    case 'sparkles':
      return <Sparkles {...props} />;
    case 'shield':
      return <ShieldCheck {...props} />;
    case 'layers':
      return <Layers3 {...props} />;
    default:
      return <Building2 {...props} />;
  }
}

function departmentVisual(department?: Department | null) {
  if (!department) {
    return { icon: null, colour: null };
  }

  return {
    icon: department.icon ?? suggestIcon(department.name),
    colour: department.colour ?? suggestColour(department.name),
  };
}

function employeeArrayFromResponse(payload: TeamResponse) {
  for (const list of [
    payload.employees,
    payload.team,
    payload.data,
    payload.items,
  ]) {
    if (Array.isArray(list)) {
      return list;
    }
  }

  return [] as EmployeeSummary[];
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function formHasContent(form: EmployeeForm) {
  return (Object.keys(EMPTY_FORM) as Array<keyof EmployeeForm>).some(
    (key) =>
      typeof form[key] === 'string' &&
      form[key] !== EMPTY_FORM[key] &&
      String(form[key]).trim() !== '',
  );
}

function loadDraft(): { form: EmployeeForm; restored: boolean } {
  try {
    const draft = safeJsonParse<Partial<EmployeeForm>>(
      window.localStorage.getItem(DRAFT_STORAGE_KEY),
    );

    if (draft) {
      const form = { ...EMPTY_FORM, ...draft };
      return { form, restored: formHasContent(form) };
    }
  } catch {
    // Storage is optional.
  }

  return { form: EMPTY_FORM, restored: false };
}

function suggestWorkEmail(first: string, last: string) {
  const clean = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

  const a = clean(first);
  const b = clean(last);

  if (!a) {
    return '';
  }

  return `${b ? `${a}.${b}` : a}@${WORK_EMAIL_DOMAIN}`;
}

function suggestStatus(startDate: string): EmployeeStatus {
  if (!startDate) {
    return 'ONBOARDING';
  }

  const start = new Date(`${startDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(start.getTime())) {
    return 'ONBOARDING';
  }

  return start.getTime() > today.getTime() ? 'ONBOARDING' : 'ACTIVE';
}

function effectiveStatus(form: EmployeeForm) {
  return form.statusAuto ? suggestStatus(form.startDate) : form.status;
}

function validateStep(step: number, form: EmployeeForm): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 1) {
    if (!form.firstName.trim()) errors.firstName = 'Enter a first name.';
    if (!form.lastName.trim()) errors.lastName = 'Enter a last name.';
    if (!form.jobTitle.trim()) errors.jobTitle = 'Enter a job title.';
  }

  if (step === 3) {
    if (form.workEmail.trim() && !EMAIL_PATTERN.test(form.workEmail.trim())) {
      errors.workEmail = 'Enter a valid email address.';
    }

    if (
      form.personalEmail.trim() &&
      !EMAIL_PATTERN.test(form.personalEmail.trim())
    ) {
      errors.personalEmail = 'Enter a valid email address.';
    }
  }

  return errors;
}

function isStatus(value: string | null): value is EmployeeStatus {
  return EMPLOYEE_STATUSES.includes(value as EmployeeStatus);
}

function isSortMode(value: string | null): value is SortMode {
  return SORT_OPTIONS.some((option) => option.value === value);
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

/* =============================================================================
 * MAIN TAB
 * =============================================================================
 */

export default function TeamTab() {
  const reduceMotion = useReducedMotion();
  const theme = useThemeBridge();

  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | EmployeeStatus>('ALL');
  const [departmentId, setDepartmentId] = useState('ALL');
  const [employmentType, setEmploymentType] = useState<
    'ALL' | EmploymentType
  >('ALL');
  const [sort, setSort] = useState<SortMode>('name-asc');
  const [view, setView] = useState<ViewMode>('grid');

  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<
    string | null
  >(null);

  const [toast, setToast] = useState<ToastState>(null);

  const searchRef = useRef<HTMLInputElement>(null);

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

  /* ---------- Preferences ---------- */

  useEffect(() => {
    try {
      const storedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
      const storedSort = window.localStorage.getItem(SORT_STORAGE_KEY);
      const storedStatus = window.localStorage.getItem(STATUS_STORAGE_KEY);
      const storedDepartment = window.localStorage.getItem(
        DEPARTMENT_STORAGE_KEY,
      );

      if (storedView === 'grid' || storedView === 'list') {
        setView(storedView);
      }

      if (isSortMode(storedSort)) {
        setSort(storedSort);
      }

      if (storedStatus === 'ALL' || isStatus(storedStatus)) {
        setStatus(storedStatus as 'ALL' | EmployeeStatus);
      }

      if (storedDepartment) {
        setDepartmentId(storedDepartment);
      }
    } catch {
      // Storage is optional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
      window.localStorage.setItem(SORT_STORAGE_KEY, sort);
      window.localStorage.setItem(STATUS_STORAGE_KEY, status);
      window.localStorage.setItem(DEPARTMENT_STORAGE_KEY, departmentId);
    } catch {
      // Storage is optional.
    }
  }, [view, sort, status, departmentId]);

  /* ---------- Fetch ---------- */

  const loadTeam = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const [teamResponse, optionsResponse] = await Promise.all([
        fetch('/api/admin/team', {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch('/api/admin/team/options', {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);

      const teamPayload = (await teamResponse
        .json()
        .catch(() => null)) as TeamResponse | null;

      const optionsPayload = (await optionsResponse
        .json()
        .catch(() => null)) as TeamOptionsResponse | null;

      if (!teamResponse.ok) {
        throw new Error(teamPayload?.error || 'Could not load the team.');
      }

      if (!optionsResponse.ok) {
        throw new Error(
          optionsPayload?.error || 'Could not load team options.',
        );
      }

      setEmployees(employeeArrayFromResponse(teamPayload ?? {}));
      setDepartments(optionsPayload?.departments ?? []);
      setManagers(optionsPayload?.managers ?? []);
      setAdminUsers(
        optionsPayload?.availableAdminUsers ??
          optionsPayload?.adminUsers ??
          optionsPayload?.systemAccounts ??
          [],
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load the team.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  /* ---------- Actions ---------- */

  const openAdd = useCallback(() => {
    setAddKey((key) => key + 1);
    setAddOpen(true);
  }, []);

  const openEmployee = useCallback((id: string) => {
    setAddOpen(false);
    setSelectedEmployeeId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* ---------- Keyboard ---------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || addOpen || selectedEmployeeId) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (typing) {
        return;
      }

      if (
        event.key === '/' ||
        ((event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === 'k')
      ) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (
        event.key.toLowerCase() === 'n' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        openAdd();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addOpen, selectedEmployeeId, openAdd]);

  /* ---------- Derived ---------- */

  const counts = useMemo(() => {
    const byStatus = Object.fromEntries(
      EMPLOYEE_STATUSES.map((value) => [value, 0]),
    ) as Record<EmployeeStatus, number>;

    let withAccess = 0;

    for (const employee of employees) {
      byStatus[employee.status] += 1;

      if (employee.adminUserId) {
        withAccess += 1;
      }
    }

    return { total: employees.length, byStatus, withAccess };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const search = query.trim().toLowerCase();

    const result = employees.filter((employee) => {
      if (status !== 'ALL' && employee.status !== status) return false;
      if (departmentId !== 'ALL' && employee.departmentId !== departmentId)
        return false;
      if (
        employmentType !== 'ALL' &&
        employee.employmentType !== employmentType
      )
        return false;
      if (!search) return true;

      return [
        employee.firstName,
        employee.lastName,
        employee.preferredName,
        employee.employeeRef,
        employee.jobTitle,
        employee.workEmail,
        employee.city,
        employee.country,
        employee.department?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
    });

    return result.sort((a, b) => {
      switch (sort) {
        case 'name-desc':
          return employeeName(b).localeCompare(employeeName(a));
        case 'newest':
          return (
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
          );
        case 'start-date': {
          const at = a.startDate
            ? new Date(a.startDate).getTime()
            : Number.MAX_SAFE_INTEGER;
          const bt = b.startDate
            ? new Date(b.startDate).getTime()
            : Number.MAX_SAFE_INTEGER;
          return at - bt;
        }
        case 'department':
          return (a.department?.name ?? '\uffff').localeCompare(
            b.department?.name ?? '\uffff',
          );
        case 'name-asc':
        default:
          return employeeName(a).localeCompare(employeeName(b));
      }
    });
  }, [departmentId, employees, employmentType, query, sort, status]);

  const hasFilters =
    Boolean(query.trim()) ||
    status !== 'ALL' ||
    departmentId !== 'ALL' ||
    employmentType !== 'ALL';

  const clearFilters = useCallback(() => {
    setQuery('');
    setStatus('ALL');
    setDepartmentId('ALL');
    setEmploymentType('ALL');
  }, []);

  const statusOptions = useMemo<
    Array<DropdownOption<'ALL' | EmployeeStatus>>
  >(
    () => [
      {
        value: 'ALL',
        label: 'All statuses',
        leading: (
          <span className="h-2 w-2 rounded-full border border-[var(--text-subtle)]" />
        ),
        trailing: <CountPill value={counts.total} />,
      },
      ...EMPLOYEE_STATUSES.map((value) => ({
        value,
        label: prettyEnum(value),
        leading: (
          <span className={cx('h-2 w-2 rounded-full', statusDot(value))} />
        ),
        trailing: <CountPill value={counts.byStatus[value]} />,
      })),
    ],
    [counts],
  );

  const departmentFilterOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      {
        value: 'ALL',
        label: 'All departments',
        leading: <DepartmentTile department={null} />,
      },
      ...departments.map((department) => ({
        value: department.id,
        label: department.name,
        hint: department.code ?? undefined,
        leading: <DepartmentTile department={department} />,
        trailing: (
          <CountPill
            value={
              employees.filter(
                (employee) => employee.departmentId === department.id,
              ).length
            }
          />
        ),
      })),
    ],
    [departments, employees],
  );

  const employmentOptions = useMemo<
    Array<DropdownOption<'ALL' | EmploymentType>>
  >(
    () => [
      { value: 'ALL', label: 'All employment' },
      ...EMPLOYMENT_TYPES.map((value) => ({
        value,
        label: prettyEnum(value),
      })),
    ],
    [],
  );

  /* ---------- Render ---------- */

  const toastNode = (
    <Toast toast={toast} onDismiss={() => setToast(null)} />
  );

  const addModal = (
    <AddEmployeeModal
      open={addOpen}
      formKey={addKey}
      departments={departments}
      managers={managers}
      adminUsers={adminUsers}
      onClose={() => setAddOpen(false)}
      onCreated={(employee) => {
        setEmployees((current) => [
          employee,
          ...current.filter((item) => item.id !== employee.id),
        ]);
        notify('success', `${employeeName(employee)} added to the team`);
        void loadTeam(true);
      }}
      onView={(id) => openEmployee(id)}
      onAddAnother={() => setAddKey((key) => key + 1)}
    />
  );

  let content: ReactNode;

  if (selectedEmployeeId) {
    content = (
      <EmployeeWorkspace
        key={selectedEmployeeId}
        employeeId={selectedEmployeeId}
        onBack={() => setSelectedEmployeeId(null)}
        onOpen={openEmployee}
        onChanged={() => void loadTeam(true)}
        notify={notify}
      />
    );
  } else if (loading) {
    content = <LoadingState />;
  } else if (error) {
    content = (
      <ErrorState
        title="The team could not be loaded"
        message={error}
        onRetry={() => void loadTeam()}
      />
    );
  } else {
    content = (
      <>
        <section className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
          <MetricsRow
            items={[
              {
                label: 'Team size',
                value: counts.total,
                helper: `${counts.byStatus.ACTIVE} active`,
                icon: Users,
              },
              {
                label: 'Onboarding',
                value: counts.byStatus.ONBOARDING,
                helper: 'Joining the company',
                icon: Sparkles,
              },
              {
                label: 'On leave',
                value: counts.byStatus.ON_LEAVE,
                helper: 'Temporarily away',
                icon: CalendarDays,
              },
              {
                label: 'System access',
                value: counts.withAccess,
                helper: 'Linked dashboard accounts',
                icon: ShieldCheck,
              },
            ]}
          />

          <div className="border-t border-[var(--line)] px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
              <div className="relative min-w-0 flex-1 2xl:max-w-[380px]">
                <Search
                  size={15}
                  strokeWidth={1.8}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
                />

                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search people, roles or departments"
                  aria-label="Search team"
                  className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-10 pr-12 text-[11px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:bg-[var(--surface)]"
                />

                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      searchRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className={cx(
                      'absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-subtle)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]',
                      focusRing,
                    )}
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
                <Dropdown
                  value={status}
                  onChange={setStatus}
                  options={statusOptions}
                  ariaLabel="Filter by status"
                  triggerClassName="sm:w-[160px]"
                  minWidth={220}
                />

                <Dropdown
                  value={departmentId}
                  onChange={setDepartmentId}
                  options={departmentFilterOptions}
                  ariaLabel="Filter by department"
                  searchable={departmentFilterOptions.length > 7}
                  searchPlaceholder="Search departments"
                  triggerClassName="sm:w-[180px]"
                  minWidth={240}
                />

                <Dropdown
                  value={employmentType}
                  onChange={setEmploymentType}
                  options={employmentOptions}
                  ariaLabel="Filter by employment type"
                  triggerClassName="sm:w-[160px]"
                  minWidth={190}
                />

                <Dropdown
                  value={sort}
                  onChange={setSort}
                  options={SORT_OPTIONS}
                  ariaLabel="Sort team"
                  triggerClassName="sm:w-[150px]"
                  minWidth={180}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 2xl:ml-auto 2xl:justify-end">
                <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-subtle)]">
                  <span>
                    <span className="font-semibold text-[var(--text)]">
                      {filteredEmployees.length}
                    </span>{' '}
                    of {employees.length} shown
                  </span>

                  {hasFilters ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className={cx(
                        'inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5 font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
                        focusRing,
                      )}
                    >
                      <X size={10} />
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <ViewToggle value={view} onChange={setView} />

                  <button
                    type="button"
                    onClick={() => void loadTeam(true)}
                    disabled={refreshing}
                    aria-label="Refresh team"
                    title="Refresh"
                    className={cx(
                      'flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60',
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
                    onClick={openAdd}
                    className={cx(
                      'inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] pl-4 pr-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90',
                      focusRing,
                    )}
                  >
                    <UserRoundPlus size={15} strokeWidth={2} />
                    Add employee
                    <kbd className="ml-1 hidden h-5 min-w-5 items-center justify-center rounded-md bg-white/15 px-1.5 text-[9px] font-semibold text-white/90 sm:inline-flex">
                      N
                    </kbd>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5">
          {filteredEmployees.length === 0 ? (
            <EmptyState
              title={
                employees.length
                  ? 'Nobody matches these filters'
                  : 'Build your Syntra Grid team'
              }
              description={
                employees.length
                  ? 'Try a different search or clear the filters to see everyone.'
                  : 'Add the first person to set up Team, Workload, Timesheets, Leave and Recruitment.'
              }
              action={
                employees.length ? (
                  <SecondaryButton onClick={clearFilters}>
                    <X size={13} />
                    Clear filters
                  </SecondaryButton>
                ) : (
                  <PrimaryButton onClick={openAdd}>
                    <UserRoundPlus size={14} />
                    Add first employee
                  </PrimaryButton>
                )
              }
            />
          ) : view === 'grid' ? (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              <AnimatePresence mode="popLayout" initial={false}>
                {filteredEmployees.map((employee) => (
                  <motion.div
                    key={employee.id}
                    layout={!reduceMotion}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={
                      reduceMotion
                        ? { duration: 0.12 }
                        : { type: 'spring', stiffness: 380, damping: 34 }
                    }
                  >
                    <EmployeeCard
                      employee={employee}
                      onOpen={openEmployee}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmployeeList
              employees={filteredEmployees}
              onOpen={openEmployee}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <PortalTheme.Provider value={theme.vars}>
      <div ref={theme.ref} className="mx-auto w-full max-w-[1600px]">
        {content}
        {addModal}
        {toastNode}
      </div>
    </PortalTheme.Provider>
  );
}

/* =============================================================================
 * METRICS
 * =============================================================================
 */

function MetricsRow({
  items,
}: {
  items: Array<{
    label: string;
    value: string | number;
    helper: string;
    icon: typeof Users;
  }>;
}) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] lg:grid-cols-4 lg:divide-y-0">
      {items.map((metric) => {
        const Icon = metric.icon;

        return (
          <div
            key={metric.label}
            className="min-w-0 px-4 py-4 sm:px-5 lg:px-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                  {metric.label}
                </p>
                <p className="mt-1.5 truncate text-[22px] font-semibold tabular-nums tracking-[-0.04em] text-[var(--text)]">
                  {metric.value}
                </p>
                <p className="mt-0.5 truncate text-[9px] text-[var(--text-subtle)]">
                  {metric.helper}
                </p>
              </div>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
                <Icon size={15} strokeWidth={1.8} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =============================================================================
 * VIEW TOGGLE
 * =============================================================================
 */

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  const reduceMotion = useReducedMotion();
  const id = useId();

  const items: Array<{ value: ViewMode; label: string; icon: ReactNode }> = [
    {
      value: 'grid',
      label: 'Grid view',
      icon: <Grid2X2 size={14} strokeWidth={1.9} />,
    },
    {
      value: 'list',
      label: 'List view',
      icon: <LayoutList size={15} strokeWidth={1.9} />,
    },
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
              active
                ? 'text-[var(--text)]'
                : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
              focusRing,
            )}
          >
            {active ? (
              <motion.span
                layoutId={`${id}-view`}
                className="absolute inset-0 rounded-lg bg-[var(--surface)] shadow-sm"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 38 }
                }
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
 * EMPLOYEE CARD
 * =============================================================================
 */

function EmployeeCard({
  employee,
  onOpen,
}: {
  employee: EmployeeSummary;
  onOpen: (id: string) => void;
}) {
  const reports = employee._count?.directReports ?? 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(employee.id)}
      aria-label={`Open ${employeeName(employee)}`}
      className={cx(
        'group flex h-full w-full flex-col rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-4 text-left shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-[color:var(--text-subtle)]/40 hover:shadow-md sm:p-5',
        focusRing,
      )}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar person={employee} size="lg" />

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                {employeeName(employee)}
              </h3>

              {employee.adminUserId ? (
                <ShieldCheck
                  size={13}
                  strokeWidth={2}
                  className="shrink-0 text-[var(--accent)]"
                  aria-label="Has dashboard access"
                />
              ) : null}
            </div>

            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
              {employee.jobTitle}
            </p>
          </div>
        </div>

        <StatusBadge status={employee.status} />
      </div>

      <div className="mb-5 mt-4 flex flex-wrap items-center gap-1.5">
        <DepartmentChip department={employee.department} />

        {employee.workArrangement ? (
          <Chip icon={<Laptop size={10} />}>
            {prettyEnum(employee.workArrangement)}
          </Chip>
        ) : null}

        {employee.city || employee.country ? (
          <Chip icon={<MapPin size={10} />}>
            {employee.city || employee.country}
          </Chip>
        ) : null}
      </div>

      <div className="mt-auto w-full border-t border-[var(--line)] pt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
              Reports to
            </p>

            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <Avatar person={employee.manager ?? null} size="xs" />
              <p className="truncate text-[10px] font-semibold text-[var(--text)]">
                {employee.manager
                  ? employeeName(employee.manager)
                  : 'No manager'}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
              Reports
            </p>
            <p className="mt-1 text-[16px] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text)]">
              {reports}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-[9px] text-[var(--text-subtle)]">
          <span className="truncate">
            {prettyEnum(employee.employmentType)}
            {employee.employeeRef ? ` · ${employee.employeeRef}` : ''}
          </span>

          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[var(--accent)]">
            Open profile
            <ChevronRight
              size={11}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </div>
    </button>
  );
}

/* =============================================================================
 * EMPLOYEE LIST
 * =============================================================================
 */

const LIST_COLUMNS =
  'lg:grid-cols-[minmax(260px,1.6fr)_minmax(160px,1fr)_minmax(130px,.8fr)_130px_80px_32px]';

function EmployeeList({
  employees,
  onOpen,
}: {
  employees: EmployeeSummary[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <div
        className={cx(
          'hidden gap-4 border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-3 lg:grid',
          LIST_COLUMNS,
        )}
      >
        {['Person', 'Department', 'Employment', 'Status', 'Reports', ''].map(
          (label) => (
            <p
              key={label || 'open'}
              className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]"
            >
              {label}
            </p>
          ),
        )}
      </div>

      <div className="divide-y divide-[var(--line)]">
        {employees.map((employee) => (
          <button
            key={employee.id}
            type="button"
            onClick={() => onOpen(employee.id)}
            className={cx(
              'group grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--surface-muted)] sm:px-5 lg:items-center lg:gap-4',
              LIST_COLUMNS,
              'focus-visible:bg-[var(--surface-muted)] focus-visible:outline-none',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar person={employee} size="md" />

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[11px] font-semibold text-[var(--text)]">
                    {employeeName(employee)}
                  </p>

                  {employee.adminUserId ? (
                    <ShieldCheck
                      size={12}
                      className="shrink-0 text-[var(--accent)]"
                    />
                  ) : null}
                </div>

                <p className="mt-0.5 truncate text-[9px] text-[var(--text-subtle)]">
                  {employee.jobTitle}
                  {employee.workEmail ? ` · ${employee.workEmail}` : ''}
                </p>
              </div>
            </div>

            <div className="hidden min-w-0 lg:block">
              <DepartmentChip department={employee.department} />
            </div>

            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-[10px] font-medium text-[var(--text)]">
                {prettyEnum(employee.employmentType)}
              </p>
              <p className="truncate text-[9px] text-[var(--text-subtle)]">
                {prettyEnum(employee.workArrangement, 'Arrangement not set')}
              </p>
            </div>

            <div className="hidden lg:block">
              <StatusBadge status={employee.status} compact />
            </div>

            <p className="hidden text-[10px] font-semibold tabular-nums text-[var(--text)] lg:block">
              {employee._count?.directReports ?? 0}
            </p>

            <ChevronRight
              size={15}
              className="hidden text-[var(--text-subtle)] transition-transform group-hover:translate-x-0.5 lg:block"
            />

            <div className="flex flex-wrap items-center gap-2 lg:hidden">
              <StatusBadge status={employee.status} compact />
              <DepartmentChip department={employee.department} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* =============================================================================
 * ADD EMPLOYEE MODAL
 * =============================================================================
 */

function AddEmployeeModal({
  open,
  formKey,
  departments,
  managers,
  adminUsers,
  onClose,
  onCreated,
  onView,
  onAddAnother,
}: {
  open: boolean;
  formKey: number;
  departments: DepartmentOption[];
  managers: ManagerOption[];
  adminUsers: AdminUserOption[];
  onClose: () => void;
  onCreated: (employee: EmployeeSummary) => void;
  onView: (id: string) => void;
  onAddAnother: () => void;
}) {
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={titleId}>
      <AddEmployeeWizard
        key={formKey}
        titleId={titleId}
        departments={departments}
        managers={managers}
        adminUsers={adminUsers}
        onClose={onClose}
        onCreated={onCreated}
        onView={onView}
        onAddAnother={onAddAnother}
      />
    </ModalShell>
  );
}

type FormUpdate = <K extends keyof EmployeeForm>(
  key: K,
  value: EmployeeForm[K],
) => void;

function AddEmployeeWizard({
  titleId,
  departments,
  managers,
  adminUsers,
  onClose,
  onCreated,
  onView,
  onAddAnother,
}: {
  titleId: string;
  departments: DepartmentOption[];
  managers: ManagerOption[];
  adminUsers: AdminUserOption[];
  onClose: () => void;
  onCreated: (employee: EmployeeSummary) => void;
  onView: (id: string) => void;
  onAddAnother: () => void;
}) {
  const reduceMotion = useReducedMotion();

  const [initial] = useState(loadDraft);
  const [form, setForm] = useState<EmployeeForm>(initial.form);
  const [draftRestored, setDraftRestored] = useState(initial.restored);
  const [[step, direction], setStepState] = useState<[number, number]>([
    1, 0,
  ]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [issue, setIssue] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<EmployeeSummary | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);

  const isMac = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad/.test(navigator.platform),
    [],
  );

  useEffect(() => {
    if (created) {
      return;
    }

    try {
      if (formHasContent(form)) {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
      } else {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {
      // Storage is optional.
    }
  }, [form, created]);

  const update = useCallback<FormUpdate>((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
    setIssue(null);
  }, []);

  const goTo = useCallback((target: number) => {
    setStepState(([current]) => [target, target > current ? 1 : -1]);
    bodyRef.current?.scrollTo({ top: 0 });
  }, []);

  const next = useCallback(() => {
    const stepErrors = validateStep(step, form);

    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      return;
    }

    setErrors({});
    goTo(Math.min(4, step + 1));
  }, [form, goTo, step]);

  const back = useCallback(() => {
    setErrors({});
    setIssue(null);
    goTo(Math.max(1, step - 1));
  }, [goTo, step]);

  const startOver = useCallback(() => {
    setForm(EMPTY_FORM);
    setErrors({});
    setIssue(null);
    setDraftRestored(false);
    goTo(1);
  }, [goTo]);

  const submit = useCallback(async () => {
    for (const target of [1, 3]) {
      const stepErrors = validateStep(target, form);

      if (Object.keys(stepErrors).length) {
        setErrors(stepErrors);
        goTo(target);
        return;
      }
    }

    setSubmitting(true);
    setIssue(null);

    try {
      const response = await fetch('/api/admin/team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          preferredName: form.preferredName.trim() || null,
          personalEmail: form.personalEmail.trim() || null,
          workEmail: form.workEmail.trim() || null,
          phone: form.phone.trim() || null,
          jobTitle: form.jobTitle.trim(),
          departmentId: form.departmentId || null,
          managerId: form.managerId || null,
          status: effectiveStatus(form),
          employmentType: form.employmentType,
          workArrangement: form.workArrangement || null,
          startDate: form.startDate || null,
          country: form.country.trim() || null,
          city: form.city.trim() || null,
          linkedinUrl: form.linkedinUrl.trim() || null,
          bio: form.bio.trim() || null,
          notes: form.notes.trim() || null,
          emergencyContactName: form.emergencyContactName.trim() || null,
          emergencyContactPhone: form.emergencyContactPhone.trim() || null,
          emergencyContactRelationship:
            form.emergencyContactRelationship.trim() || null,
          adminUserId: form.adminUserId || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        employee?: EmployeeSummary;
        error?: string;
      } | null;

      if (!response.ok || !payload?.employee) {
        throw new Error(payload?.error || 'Could not add the employee.');
      }

      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Storage is optional.
      }

      setCreated(payload.employee);
      onCreated(payload.employee);
    } catch (cause) {
      setIssue(
        cause instanceof Error ? cause.message : 'Could not add the employee.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, goTo, onCreated]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (step < 4) {
      next();
    } else {
      void submit();
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();

      if (step < 4) {
        next();
      } else if (!submitting) {
        void submit();
      }
    }
  };

  if (created) {
    return (
      <CreatedState
        titleId={titleId}
        employee={created}
        onClose={onClose}
        onView={() => onView(created.id)}
        onAddAnother={onAddAnother}
      />
    );
  }

  const previewName =
    [form.preferredName.trim() || form.firstName.trim(), form.lastName.trim()]
      .filter(Boolean)
      .join(' ');

  const slide = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: (dir: number) => ({ opacity: 0, x: dir * 28 }),
        animate: { opacity: 1, x: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
      };

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      className="flex max-h-[92dvh] min-h-0 flex-col sm:max-h-[min(88dvh,880px)]"
    >
      {/* Header */}
      <div className="border-b border-[var(--line)] px-5 pb-4 pt-4 sm:px-7 sm:pt-6">
        <div className="flex items-start gap-4">
          <div className="relative">
            <Avatar
              person={{
                firstName: form.firstName,
                lastName: form.lastName,
              }}
              size="xl"
              animateChanges
            />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id={titleId}
              className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]"
            >
              Add employee
            </h2>

            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
              {previewName
                ? `${previewName}${form.jobTitle.trim() ? `, ${form.jobTitle.trim()}` : ''}`
                : 'Their name and role will appear here as you type.'}
            </p>

            {draftRestored ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-2 py-1 text-[9px] text-[var(--text-muted)]">
                <RotateCcw size={10} />
                Picked up where you left off
                <button
                  type="button"
                  onClick={startOver}
                  className={cx(
                    'rounded font-semibold text-[var(--accent)] hover:opacity-70',
                    focusRing,
                  )}
                >
                  Start over
                </button>
              </div>
            ) : null}
          </div>

          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        <Stepper step={step} onJump={(target) => target < step && goTo(target)} />
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-5 sm:px-7"
      >
        <AnimatePresence initial={false}>
          {issue ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3 text-[10px] leading-5 text-red-600"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="flex-1">{issue}</span>
              <button
                type="button"
                onClick={() => setIssue(null)}
                aria-label="Dismiss"
                className={cx('rounded p-0.5 hover:bg-red-500/10', focusRing)}
              >
                <X size={12} />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
            }
          >
            {step === 1 ? (
              <ProfileStep form={form} errors={errors} update={update} />
            ) : null}

            {step === 2 ? (
              <RoleStep
                form={form}
                update={update}
                setForm={setForm}
                departments={departments}
                managers={managers}
                adminUsers={adminUsers}
              />
            ) : null}

            {step === 3 ? (
              <ContactStep form={form} errors={errors} update={update} />
            ) : null}

            {step === 4 ? (
              <ReviewStep
                form={form}
                departments={departments}
                managers={managers}
                adminUsers={adminUsers}
                onEdit={goTo}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--line)] bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <p className="hidden items-center gap-1.5 text-[9px] text-[var(--text-subtle)] sm:flex">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>Enter</Kbd>
            {step < 4 ? 'to continue' : 'to add'}
          </p>

          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={step === 1 ? onClose : back}
              disabled={submitting}
              className={cx(
                'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50 sm:flex-none',
                focusRing,
              )}
            >
              {step === 1 ? null : <ArrowLeft size={13} />}
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            <button
              type="submit"
              disabled={submitting}
              className={cx(
                'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[150px] sm:flex-none',
                focusRing,
              )}
            >
              {step < 4 ? (
                <>
                  Continue
                  <ArrowRight size={13} />
                </>
              ) : submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Adding
                </>
              ) : (
                <>
                  <UserRoundPlus size={13} />
                  Add employee
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Stepper({
  step,
  onJump,
}: {
  step: number;
  onJump: (step: number) => void;
}) {
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
              disabled={!complete}
              aria-current={active ? 'step' : undefined}
              className={cx(
                'block w-full rounded-md text-left disabled:cursor-default',
                focusRing,
              )}
            >
              <span className="relative block h-1 overflow-hidden rounded-full bg-[var(--line)]">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
                  initial={false}
                  animate={{ width: complete || active ? '100%' : '0%' }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
                  }
                />
              </span>

              <span
                className={cx(
                  'mt-2 flex items-center gap-1 text-[10px] font-semibold',
                  active || complete
                    ? 'text-[var(--text)]'
                    : 'text-[var(--text-subtle)]',
                )}
              >
                {complete ? (
                  <Check
                    size={10}
                    strokeWidth={2.6}
                    className="text-[var(--accent)]"
                  />
                ) : (
                  <span className="tabular-nums">{item.id}.</span>
                )}
                {item.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ProfileStep({
  form,
  errors,
  update,
}: {
  form: EmployeeForm;
  errors: FieldErrors;
  update: FormUpdate;
}) {
  return (
    <div>
      <StepIntro
        icon={<CircleUserRound size={16} />}
        title="Who are they?"
        description="Their name and role inside Syntra Grid. Everything else can be added later."
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="First name" required error={errors.firstName}>
          <input
            data-autofocus
            value={form.firstName}
            onChange={(event) => update('firstName', event.target.value)}
            placeholder="Type their first name"
            autoComplete="off"
            aria-invalid={Boolean(errors.firstName)}
            className={inputClass(errors.firstName)}
          />
        </Field>

        <Field label="Last name" required error={errors.lastName}>
          <input
            value={form.lastName}
            onChange={(event) => update('lastName', event.target.value)}
            placeholder="Type their last name"
            autoComplete="off"
            aria-invalid={Boolean(errors.lastName)}
            className={inputClass(errors.lastName)}
          />
        </Field>

        <Field
          label="Preferred name"
          hint="Used across the dashboard if set"
        >
          <input
            value={form.preferredName}
            onChange={(event) => update('preferredName', event.target.value)}
            placeholder="What they like to be called"
            autoComplete="off"
            className={inputClass()}
          />
        </Field>

        <Field label="Job title" required error={errors.jobTitle}>
          <input
            value={form.jobTitle}
            onChange={(event) => update('jobTitle', event.target.value)}
            placeholder="e.g. Social Media Manager"
            autoComplete="off"
            aria-invalid={Boolean(errors.jobTitle)}
            className={inputClass(errors.jobTitle)}
          />
        </Field>

        <Field label="Country">
          <input
            value={form.country}
            onChange={(event) => update('country', event.target.value)}
            placeholder="United Kingdom"
            className={inputClass()}
          />
        </Field>

        <Field label="City">
          <input
            value={form.city}
            onChange={(event) => update('city', event.target.value)}
            placeholder="Leeds"
            className={inputClass()}
          />
        </Field>
      </div>

      <Field label="Short bio" className="mt-4">
        <textarea
          value={form.bio}
          onChange={(event) => update('bio', event.target.value)}
          rows={3}
          maxLength={600}
          placeholder="A short internal profile summary, optional"
          className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
        />
      </Field>
    </div>
  );
}

function RoleStep({
  form,
  update,
  setForm,
  departments,
  managers,
  adminUsers,
}: {
  form: EmployeeForm;
  update: FormUpdate;
  setForm: Dispatch<SetStateAction<EmployeeForm>>;
  departments: DepartmentOption[];
  managers: ManagerOption[];
  adminUsers: AdminUserOption[];
}) {
  const status = effectiveStatus(form);

  const departmentOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      {
        value: '',
        label: 'No department',
        hint: 'Assign later',
        leading: <DepartmentTile department={null} />,
      },
      ...departments
        .filter((department) => department.status !== 'ARCHIVED')
        .map((department) => ({
          value: department.id,
          label: department.name,
          hint: department.code ?? undefined,
          keywords: department.slug ?? undefined,
          leading: <DepartmentTile department={department} />,
        })),
    ],
    [departments],
  );

  const managerOptions = useMemo<Array<DropdownOption<string>>>(() => {
    const eligible = managers
      .filter((manager) => manager.status !== 'FORMER')
      .sort((a, b) => {
        const aSame = form.departmentId && a.department?.id === form.departmentId;
        const bSame = form.departmentId && b.department?.id === form.departmentId;

        if (aSame !== bSame) {
          return aSame ? -1 : 1;
        }

        return employeeName(a).localeCompare(employeeName(b));
      });

    return [
      {
        value: '',
        label: 'No manager',
        hint: 'Reports to nobody yet',
        leading: <Avatar person={null} size="xs" />,
      },
      ...eligible.map((manager) => ({
        value: manager.id,
        label: employeeName(manager),
        hint: [
          manager.jobTitle,
          form.departmentId && manager.department?.id === form.departmentId
            ? 'Same department'
            : manager.department?.name,
        ]
          .filter(Boolean)
          .join(' · '),
        keywords: manager.employeeRef ?? undefined,
        leading: <Avatar person={manager} size="xs" />,
      })),
    ];
  }, [managers, form.departmentId]);

  const employmentOptions = useMemo<Array<DropdownOption<EmploymentType>>>(
    () =>
      EMPLOYMENT_TYPES.map((value) => ({
        value,
        label: prettyEnum(value),
      })),
    [],
  );

  const statusOptions = useMemo<Array<DropdownOption<EmployeeStatus>>>(
    () =>
      EMPLOYEE_STATUSES.filter((value) => value !== 'FORMER').map((value) => ({
        value,
        label: prettyEnum(value),
        leading: (
          <span className={cx('h-2 w-2 rounded-full', statusDot(value))} />
        ),
      })),
    [],
  );

  const accessOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      {
        value: '',
        label: 'No dashboard account',
        hint: 'Most people do not need one',
        leading: (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]">
            <UserX size={11} />
          </span>
        ),
      },
      ...adminUsers.map((user) => ({
        value: user.id,
        label: adminUserName(user),
        hint: `${prettyEnum(user.role)}${user.active ? '' : ', disabled'} · ${user.email}`,
        keywords: user.email,
        leading: (
          <Avatar
            person={{
              firstName: user.firstName ?? user.email,
              lastName: user.lastName,
              avatarUrl: user.avatarUrl,
            }}
            size="xs"
          />
        ),
      })),
    ],
    [adminUsers],
  );

  return (
    <div>
      <StepIntro
        icon={<BriefcaseBusiness size={16} />}
        title="Where do they sit?"
        description="Their department, who they report to and how they work."
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Department" as="div">
          <Dropdown
            value={form.departmentId}
            onChange={(value) => update('departmentId', value)}
            options={departmentOptions}
            ariaLabel="Department"
            searchable={departmentOptions.length > 6}
            searchPlaceholder="Search departments"
            emptyText="No departments match."
            minWidth={260}
          />
        </Field>

        <Field
          label="Manager"
          as="div"
          hint={form.departmentId ? 'Same department listed first' : undefined}
        >
          <Dropdown
            value={form.managerId}
            onChange={(value) => update('managerId', value)}
            options={managerOptions}
            ariaLabel="Manager"
            searchable={managerOptions.length > 6}
            searchPlaceholder="Search people"
            emptyText="Nobody matches that search."
            minWidth={280}
          />
        </Field>

        <Field label="Employment type" as="div">
          <Dropdown
            value={form.employmentType}
            onChange={(value) => update('employmentType', value)}
            options={employmentOptions}
            ariaLabel="Employment type"
          />
        </Field>

        <Field label="Start date">
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => update('startDate', event.target.value)}
            className={cx(inputClass(), '[color-scheme:light]')}
          />
        </Field>
      </div>

      <Field label="Work arrangement" as="div" className="mt-4">
        <Segmented
          value={form.workArrangement}
          onChange={(value) => update('workArrangement', value)}
          ariaLabel="Work arrangement"
          options={[
            { value: '', label: 'Not set' },
            { value: 'REMOTE', label: 'Remote' },
            { value: 'HYBRID', label: 'Hybrid' },
            { value: 'ONSITE', label: 'On site' },
          ]}
        />
      </Field>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[9px] font-semibold text-[var(--text-muted)]">
            Status
          </span>

          {form.statusAuto ? (
            <span className="inline-flex items-center gap-1 text-[8px] font-semibold text-[var(--accent)]">
              <Wand2 size={9} />
              Set from the start date
            </span>
          ) : (
            <button
              type="button"
              onClick={() => update('statusAuto', true)}
              className={cx(
                'inline-flex items-center gap-1 rounded text-[8px] font-semibold text-[var(--text-subtle)] transition hover:text-[var(--accent)]',
                focusRing,
              )}
            >
              <RotateCcw size={9} />
              Reset to auto
            </button>
          )}
        </div>

        <Dropdown
          value={status}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              status: value,
              statusAuto: false,
            }))
          }
          options={statusOptions}
          ariaLabel="Status"
        />
      </div>

      <div className="mt-6 rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[var(--text)]">
            <ShieldCheck size={15} strokeWidth={1.8} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[var(--text)]">
              Dashboard access
            </p>
            <p className="mt-0.5 text-[10px] leading-5 text-[var(--text-muted)]">
              Only link an account if this person should sign in to the
              Syntra Grid operating system.
            </p>

            <div className="mt-3">
              <Dropdown
                value={form.adminUserId}
                onChange={(value) => update('adminUserId', value)}
                options={accessOptions}
                ariaLabel="Dashboard account"
                searchable={accessOptions.length > 6}
                searchPlaceholder="Search accounts"
                minWidth={280}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactStep({
  form,
  errors,
  update,
}: {
  form: EmployeeForm;
  errors: FieldErrors;
  update: FormUpdate;
}) {
  const suggestion = suggestWorkEmail(
    form.preferredName.trim() || form.firstName,
    form.lastName,
  );

  const showSuggestion =
    Boolean(suggestion) && form.workEmail.trim() !== suggestion;

  return (
    <div>
      <StepIntro
        icon={<Mail size={16} />}
        title="How do we reach them?"
        description="Contact details and an emergency contact. These stay inside the internal record."
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Field label="Work email" error={errors.workEmail}>
            <input
              type="email"
              value={form.workEmail}
              onChange={(event) => update('workEmail', event.target.value)}
              placeholder={`name@${WORK_EMAIL_DOMAIN}`}
              autoComplete="off"
              aria-invalid={Boolean(errors.workEmail)}
              className={inputClass(errors.workEmail)}
            />
          </Field>

          <AnimatePresence initial={false}>
            {showSuggestion ? (
              <motion.button
                type="button"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onClick={() => update('workEmail', suggestion)}
                className={cx(
                  'mt-1.5 flex max-w-full items-center gap-1 overflow-hidden rounded-md text-[9px] font-semibold text-[var(--accent)] hover:opacity-70',
                  focusRing,
                )}
              >
                <Wand2 size={10} className="shrink-0" />
                <span className="truncate">Use {suggestion}</span>
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>

        <Field label="Personal email" error={errors.personalEmail}>
          <input
            type="email"
            value={form.personalEmail}
            onChange={(event) => update('personalEmail', event.target.value)}
            placeholder="name@example.com"
            autoComplete="off"
            aria-invalid={Boolean(errors.personalEmail)}
            className={inputClass(errors.personalEmail)}
          />
        </Field>

        <Field label="Phone">
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            placeholder="+44 7700 900000"
            className={inputClass()}
          />
        </Field>

        <Field label="LinkedIn">
          <input
            type="url"
            value={form.linkedinUrl}
            onChange={(event) => update('linkedinUrl', event.target.value)}
            placeholder="linkedin.com/in/username"
            className={inputClass()}
          />
        </Field>
      </div>

      <div className="mt-6 rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <p className="text-[11px] font-semibold text-[var(--text)]">
          Emergency contact
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              value={form.emergencyContactName}
              onChange={(event) =>
                update('emergencyContactName', event.target.value)
              }
              placeholder="Full name"
              className={cx(inputClass(), 'bg-white')}
            />
          </Field>

          <Field label="Phone">
            <input
              type="tel"
              value={form.emergencyContactPhone}
              onChange={(event) =>
                update('emergencyContactPhone', event.target.value)
              }
              placeholder="Phone number"
              className={cx(inputClass(), 'bg-white')}
            />
          </Field>

          <Field label="Relationship" className="sm:col-span-2">
            <input
              value={form.emergencyContactRelationship}
              onChange={(event) =>
                update('emergencyContactRelationship', event.target.value)
              }
              placeholder="e.g. Parent, spouse, sibling"
              className={cx(inputClass(), 'bg-white')}
            />
          </Field>
        </div>
      </div>

      <Field label="Internal notes" className="mt-4">
        <textarea
          value={form.notes}
          onChange={(event) => update('notes', event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Anything HR should know, optional"
          className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
        />
      </Field>
    </div>
  );
}

function ReviewStep({
  form,
  departments,
  managers,
  adminUsers,
  onEdit,
}: {
  form: EmployeeForm;
  departments: DepartmentOption[];
  managers: ManagerOption[];
  adminUsers: AdminUserOption[];
  onEdit: (step: number) => void;
}) {
  const department = departments.find((item) => item.id === form.departmentId);
  const manager = managers.find((item) => item.id === form.managerId);
  const admin = adminUsers.find((item) => item.id === form.adminUserId);
  const status = effectiveStatus(form);

  return (
    <div>
      <StepIntro
        icon={<Check size={16} />}
        title="Check everything looks right"
        description="Select Edit on any section to change it before adding them."
      />

      <div className="mt-5 flex items-center gap-4 rounded-[18px] border border-[var(--line)] p-4">
        <Avatar
          person={{ firstName: form.firstName, lastName: form.lastName }}
          size="lg"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            {employeeName(form)}
          </p>
          <p className="truncate text-[11px] text-[var(--text-muted)]">
            {form.jobTitle}
          </p>
        </div>

        <StatusBadge status={status} />
      </div>

      <ReviewSection title="Profile" onEdit={() => onEdit(1)}>
        <ReviewItem
          label="Preferred name"
          value={form.preferredName.trim() || 'Not set'}
        />
        <ReviewItem
          label="Location"
          value={
            [form.city.trim(), form.country.trim()]
              .filter(Boolean)
              .join(', ') || 'Not set'
          }
        />
      </ReviewSection>

      <ReviewSection title="Role" onEdit={() => onEdit(2)}>
        <ReviewItem label="Department" value={department?.name || 'Unassigned'} />
        <ReviewItem
          label="Manager"
          value={manager ? employeeName(manager) : 'No manager'}
        />
        <ReviewItem label="Employment" value={prettyEnum(form.employmentType)} />
        <ReviewItem label="Arrangement" value={prettyEnum(form.workArrangement)} />
        <ReviewItem
          label="Start date"
          value={form.startDate ? formatDate(form.startDate) : 'Not set'}
        />
        <ReviewItem
          label="Dashboard access"
          value={admin ? admin.email : 'No account'}
        />
      </ReviewSection>

      <ReviewSection title="Contact" onEdit={() => onEdit(3)}>
        <ReviewItem label="Work email" value={form.workEmail.trim() || 'Not set'} />
        <ReviewItem
          label="Personal email"
          value={form.personalEmail.trim() || 'Not set'}
        />
        <ReviewItem label="Phone" value={form.phone.trim() || 'Not set'} />
        <ReviewItem
          label="Emergency contact"
          value={form.emergencyContactName.trim() || 'Not set'}
        />
      </ReviewSection>
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[var(--text)]">{title}</p>
        <button
          type="button"
          onClick={onEdit}
          className={cx(
            'inline-flex items-center gap-1 rounded-md px-1 text-[9px] font-semibold text-[var(--accent)] transition hover:opacity-70',
            focusRing,
          )}
        >
          <Pencil size={10} />
          Edit
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
      <p className="text-[9px] font-medium text-[var(--text-subtle)]">{label}</p>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--text)]">
        {value}
      </p>
    </div>
  );
}

function CreatedState({
  titleId,
  employee,
  onClose,
  onView,
  onAddAnother,
}: {
  titleId: string;
  employee: EmployeeSummary;
  onClose: () => void;
  onView: () => void;
  onAddAnother: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="px-6 pb-7 pt-8 text-center sm:px-10 sm:pt-10">
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0.15 }
            : { type: 'spring', stiffness: 380, damping: 20 }
        }
        className="relative mx-auto w-fit"
      >
        <Avatar person={employee} size="xl" />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[var(--success,#10b981)] text-white">
          <Check size={12} strokeWidth={3} />
        </span>
      </motion.div>

      <h2
        id={titleId}
        className="mt-5 text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]"
      >
        {employeeName(employee)} is on the team
      </h2>

      <p className="mx-auto mt-1.5 max-w-[360px] text-[11px] leading-5 text-[var(--text-muted)]">
        {employee.jobTitle}
        {employee.department?.name ? ` in ${employee.department.name}` : ''}.
        Their profile is ready to view.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          data-autofocus
          onClick={onView}
          className={cx(
            'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90',
            focusRing,
          )}
        >
          View profile
          <ArrowRight size={13} />
        </button>

        <button
          type="button"
          onClick={onAddAnother}
          className={cx(
            'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)]',
            focusRing,
          )}
        >
          <Plus size={13} />
          Add another
        </button>

        <button
          type="button"
          onClick={onClose}
          className={cx(
            'inline-flex h-10 items-center justify-center rounded-xl px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)]',
            focusRing,
          )}
        >
          Done
        </button>
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

/* =============================================================================
 * EMPLOYEE WORKSPACE
 * =============================================================================
 */

function EmployeeWorkspace({
  employeeId,
  onBack,
  onOpen,
  onChanged,
  notify,
}: {
  employeeId: string;
  onBack: () => void;
  onOpen: (id: string) => void;
  onChanged: () => void;
  notify: Notify;
}) {
  const reduceMotion = useReducedMotion();
  const tabsId = useId();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [summary, setSummary] = useState<EmployeeDetailSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [offboarding, setOffboarding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/team/${employeeId}`, {
        credentials: 'include',
        cache: 'no-store',
      });

      const payload = (await response
        .json()
        .catch(() => null)) as EmployeeDetailResponse | null;

      if (!response.ok || !payload?.employee) {
        throw new Error(payload?.error || 'Could not load this person.');
      }

      setEmployee(payload.employee);
      setSummary(payload.summary ?? null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load this person.',
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const offboard = useCallback(async () => {
    if (!employee || offboarding) {
      return;
    }

    setOffboarding(true);

    try {
      const response = await fetch(`/api/admin/team/${employee.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        employee?: EmployeeDetail;
        error?: string;
      } | null;

      if (!response.ok || !payload?.employee) {
        throw new Error(payload?.error || 'Could not offboard this person.');
      }

      setEmployee((current) =>
        current ? { ...current, ...payload.employee } : payload.employee!,
      );
      setConfirmOpen(false);
      notify('success', `${employeeName(employee)} offboarded`);
      onChanged();
    } catch (cause) {
      notify(
        'error',
        cause instanceof Error ? cause.message : 'Could not offboard this person.',
      );
    } finally {
      setOffboarding(false);
    }
  }, [employee, notify, offboarding, onChanged]);

  const copy = useCallback(
    async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value);
        notify('success', `${label} copied`);
      } catch {
        notify('error', `Could not copy the ${label.toLowerCase()}.`);
      }
    },
    [notify],
  );

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg px-1 text-[11px] font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]',
        focusRing,
      )}
    >
      <ArrowLeft size={14} />
      Back to team
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {backButton}
        <div className="h-[230px] animate-pulse rounded-[26px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
          <div className="h-[360px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
          <div className="h-[360px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="space-y-4">
        {backButton}
        <ErrorState
          title="This profile could not be opened"
          message={error ?? 'Unknown error.'}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const tabs: Array<{ id: WorkspaceTab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'employment', label: 'Employment' },
    { id: 'access', label: 'Access' },
    {
      id: 'reports',
      label: 'Reporting',
      count:
        employee.directReports?.length ??
        summary?.directReports ??
        employee._count?.directReports,
    },
    { id: 'activity', label: 'Activity' },
  ];

  const location = [employee.city, employee.country].filter(Boolean).join(', ');

  return (
    <div className="space-y-4">
      {backButton}

      <section className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <Avatar person={employee} size="xl" />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[26px]">
                    {employeeName(employee)}
                  </h2>

                  <StatusBadge status={employee.status} />

                  {employee.adminUser ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      <ShieldCheck size={10} className="text-[var(--accent)]" />
                      Dashboard access
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-[12px] text-[var(--text-muted)] sm:text-[13px]">
                  {employee.jobTitle}
                  {employee.department?.name
                    ? ` in ${employee.department.name}`
                    : ''}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {employee.employeeRef ? (
                    <Chip icon={<IdCard size={10} />}>{employee.employeeRef}</Chip>
                  ) : null}
                  {location ? (
                    <Chip icon={<MapPin size={10} />}>{location}</Chip>
                  ) : null}
                  <Chip icon={<CalendarDays size={10} />}>
                    Started {formatDate(employee.startDate)}
                  </Chip>
                  {employee.workArrangement ? (
                    <Chip icon={<Laptop size={10} />}>
                      {prettyEnum(employee.workArrangement)}
                    </Chip>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {employee.workEmail ? (
                <div className="inline-flex overflow-hidden rounded-xl border border-[var(--line)]">
                  <a
                    href={`mailto:${employee.workEmail}`}
                    className={cx(
                      'inline-flex h-10 items-center gap-2 px-3.5 text-[11px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)]',
                      focusRing,
                    )}
                  >
                    <Mail size={14} />
                    Email
                  </a>
                  <button
                    type="button"
                    onClick={() => void copy(employee.workEmail!, 'Email')}
                    aria-label="Copy work email"
                    className={cx(
                      'inline-flex h-10 w-10 items-center justify-center border-l border-[var(--line)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
                      focusRing,
                    )}
                  >
                    <Copy size={13} />
                  </button>
                </div>
              ) : null}

              {employee.status !== 'FORMER' ? (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className={cx(
                    'inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/25 px-3.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-500/5',
                    focusRing,
                  )}
                >
                  <UserX size={14} />
                  Offboard
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border-t border-[var(--line)] px-2 sm:px-4 [scrollbar-width:none]">
          <div role="tablist" aria-label="Profile sections" className="flex min-w-max">
            {tabs.map((item) => {
              const active = tab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={cx(
                    'relative inline-flex items-center gap-1.5 px-4 py-3.5 text-[11px] font-semibold transition-colors',
                    active
                      ? 'text-[var(--text)]'
                      : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
                    focusRing,
                  )}
                >
                  {item.label}

                  {item.count ? <CountPill value={item.count} /> : null}

                  {active ? (
                    <motion.span
                      layoutId={`${tabsId}-underline`}
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
      </section>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
        >
          {tab === 'overview' ? (
            <OverviewPanel
              employee={employee}
              summary={summary}
              onCopy={copy}
            />
          ) : null}
          {tab === 'employment' ? <EmploymentPanel employee={employee} /> : null}
          {tab === 'access' ? <AccessPanel employee={employee} /> : null}
          {tab === 'reports' ? (
            <ReportingPanel employee={employee} onOpen={onOpen} />
          ) : null}
          {tab === 'activity' ? <ActivityPanel employee={employee} /> : null}
        </motion.div>
      </AnimatePresence>

      <ConfirmDialog
        open={confirmOpen}
        busy={offboarding}
        icon={<UserX size={18} strokeWidth={1.8} />}
        title={`Offboard ${employeeName(employee)}?`}
        description="Their employee record is kept for history and they move out of the active team."
        note={
          employee.adminUser
            ? 'They still have a linked dashboard account. Disable it separately if they should lose access.'
            : undefined
        }
        cancelLabel="Keep employee"
        confirmLabel="Offboard"
        busyLabel="Offboarding"
        onCancel={() => {
          if (!offboarding) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={() => void offboard()}
      />
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

function OverviewPanel({
  employee,
  summary,
  onCopy,
}: {
  employee: EmployeeDetail;
  summary: EmployeeDetailSummary | null;
  onCopy: (value: string, label: string) => void;
}) {
  const reports =
    summary?.directReports ??
    employee.directReports?.length ??
    employee._count?.directReports ??
    0;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
          <MetricsRow
            items={[
              {
                label: 'Direct reports',
                value: reports,
                helper: 'Report to this person',
                icon: Network,
              },
              {
                label: 'Department',
                value:
                  employee.department?.code ||
                  employee.department?.name ||
                  'None',
                helper: employee.department?.name || 'Not assigned',
                icon: Building2,
              },
              {
                label: 'Work model',
                value: prettyEnum(employee.workArrangement),
                helper: prettyEnum(employee.employmentType),
                icon: Laptop,
              },
              {
                label: 'Access',
                value: employee.adminUser ? 'Linked' : 'None',
                helper: employee.adminUser
                  ? prettyEnum(employee.adminUser.role)
                  : 'No dashboard account',
                icon: ShieldCheck,
              },
            ]}
          />
        </section>

        <Panel title="At a glance">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <DetailTile
              icon={<BriefcaseBusiness size={14} />}
              label="Job title"
              value={employee.jobTitle}
            />
            <DetailTile
              icon={<Building2 size={14} />}
              label="Department"
              value={employee.department?.name || 'Not assigned'}
            />
            <DetailTile
              icon={<CircleUserRound size={14} />}
              label="Manager"
              value={
                employee.manager ? employeeName(employee.manager) : 'No manager'
              }
            />
            <DetailTile
              icon={<CalendarDays size={14} />}
              label="Start date"
              value={formatDate(employee.startDate)}
            />
            <DetailTile
              icon={<Laptop size={14} />}
              label="Arrangement"
              value={prettyEnum(employee.workArrangement)}
            />
            <DetailTile
              icon={<Clock3 size={14} />}
              label="Employment type"
              value={prettyEnum(employee.employmentType)}
            />
          </div>
        </Panel>

        <Panel title="About">
          <p className="whitespace-pre-wrap text-[12px] leading-6 text-[var(--text-muted)]">
            {employee.bio || 'No bio yet.'}
          </p>
        </Panel>

        {employee.notes ? (
          <Panel title="Internal notes">
            <p className="whitespace-pre-wrap text-[12px] leading-6 text-[var(--text-muted)]">
              {employee.notes}
            </p>
          </Panel>
        ) : null}
      </div>

      <div className="space-y-4">
        <Panel title="Contact">
          <div className="space-y-1">
            <ContactRow
              icon={<Mail size={14} />}
              label="Work email"
              value={employee.workEmail}
              href={employee.workEmail ? `mailto:${employee.workEmail}` : undefined}
              onCopy={onCopy}
            />
            <ContactRow
              icon={<Mail size={14} />}
              label="Personal email"
              value={employee.personalEmail}
              href={
                employee.personalEmail
                  ? `mailto:${employee.personalEmail}`
                  : undefined
              }
              onCopy={onCopy}
            />
            <ContactRow
              icon={<Phone size={14} />}
              label="Phone"
              value={employee.phone}
              href={employee.phone ? `tel:${employee.phone}` : undefined}
              onCopy={onCopy}
            />
            <ContactRow
              icon={<Link2 size={14} />}
              label="LinkedIn"
              value={employee.linkedinUrl}
              href={
                employee.linkedinUrl
                  ? employee.linkedinUrl.startsWith('http')
                    ? employee.linkedinUrl
                    : `https://${employee.linkedinUrl}`
                  : undefined
              }
              external
              onCopy={onCopy}
            />
            <ContactRow
              icon={<MapPin size={14} />}
              label="Location"
              value={
                [employee.city, employee.country].filter(Boolean).join(', ') ||
                null
              }
            />
          </div>
        </Panel>

        <Panel title="Emergency contact">
          <div className="space-y-1">
            <ContactRow
              icon={<CircleUserRound size={14} />}
              label="Name"
              value={employee.emergencyContactName}
            />
            <ContactRow
              icon={<Phone size={14} />}
              label="Phone"
              value={employee.emergencyContactPhone}
              href={
                employee.emergencyContactPhone
                  ? `tel:${employee.emergencyContactPhone}`
                  : undefined
              }
              onCopy={onCopy}
            />
            <ContactRow
              icon={<Users size={14} />}
              label="Relationship"
              value={employee.emergencyContactRelationship}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function EmploymentPanel({ employee }: { employee: EmployeeDetail }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Employment details">
        <DetailLine label="Employee reference" value={employee.employeeRef || 'Not assigned'} />
        <DetailLine label="Job title" value={employee.jobTitle} />
        <DetailLine
          label="Status"
          value={<StatusBadge status={employee.status} compact />}
        />
        <DetailLine label="Employment type" value={prettyEnum(employee.employmentType)} />
        <DetailLine label="Work arrangement" value={prettyEnum(employee.workArrangement)} />
      </Panel>

      <Panel title="Organisation">
        <DetailLine
          label="Department"
          value={<DepartmentChip department={employee.department} />}
        />
        <DetailLine
          label="Manager"
          value={employee.manager ? employeeName(employee.manager) : 'No manager'}
        />
        <DetailLine label="Start date" value={formatDate(employee.startDate)} />
        <DetailLine label="End date" value={formatDate(employee.endDate)} />
        <DetailLine
          label="Location"
          value={
            [employee.city, employee.country].filter(Boolean).join(', ') ||
            'Not set'
          }
        />
      </Panel>
    </div>
  );
}

function AccessPanel({ employee }: { employee: EmployeeDetail }) {
  if (!employee.adminUser) {
    return (
      <EmptyState
        icon={<ShieldCheck size={21} strokeWidth={1.7} />}
        title="No dashboard access"
        description="This person is on the team but has no linked dashboard account. That is normal for anyone who does not need to sign in to the Syntra Grid operating system."
      />
    );
  }

  const account = employee.adminUser;

  return (
    <Panel>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
          <ShieldCheck size={18} strokeWidth={1.8} />
        </span>

        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            Linked dashboard account
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            This person can sign in to the Syntra Grid operating system.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-x-8 sm:grid-cols-2">
        <DetailLine label="Account email" value={account.email} />
        <DetailLine label="Role" value={prettyEnum(account.role)} />
        <DetailLine
          label="Account status"
          value={
            <span
              className={cx(
                'inline-flex items-center gap-1.5 text-[11px] font-semibold',
                account.active ? 'text-[var(--success,#047857)]' : 'text-[var(--text-subtle)]',
              )}
            >
              <span
                className={cx(
                  'h-1.5 w-1.5 rounded-full',
                  account.active ? 'bg-[var(--success,#10b981)]' : 'bg-[var(--text-subtle)]',
                )}
              />
              {account.active ? 'Active' : 'Disabled'}
            </span>
          }
        />
        <DetailLine
          label="Account ID"
          value={<span className="font-mono text-[10px]">{account.id}</span>}
        />
      </div>
    </Panel>
  );
}

function ReportingPanel({
  employee,
  onOpen,
}: {
  employee: EmployeeDetail;
  onOpen: (id: string) => void;
}) {
  const reports = employee.directReports ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]">
      <Panel title="Reports to">
        {employee.manager ? (
          <PersonRow
            person={employee.manager}
            subtitle={employee.manager.jobTitle}
            status={employee.manager.status}
            onClick={() => onOpen(employee.manager!.id)}
          />
        ) : (
          <p className="text-[11px] text-[var(--text-subtle)]">
            No manager assigned.
          </p>
        )}
      </Panel>

      <Panel
        title="Direct reports"
        action={<CountPill value={reports.length} />}
      >
        {reports.length ? (
          <div className="-mx-2 space-y-0.5">
            {reports.map((report) => (
              <PersonRow
                key={report.id}
                person={report}
                subtitle={report.jobTitle}
                status={report.status}
                onClick={() => onOpen(report.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[var(--text-subtle)]">
            Nobody reports to {employeeName(employee)} yet.
          </p>
        )}
      </Panel>
    </div>
  );
}

function ActivityPanel({ employee }: { employee: EmployeeDetail }) {
  const events = [
    { label: 'Added to Syntra Grid', date: employee.createdAt, icon: UserRoundPlus },
    employee.startDate
      ? { label: 'Start date', date: employee.startDate, icon: CalendarDays }
      : null,
    employee.endDate
      ? { label: 'End date', date: employee.endDate, icon: UserX }
      : null,
    { label: 'Profile last updated', date: employee.updatedAt, icon: Pencil },
  ]
    .filter((item): item is { label: string; date: string; icon: typeof Users } =>
      Boolean(item),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Panel title="Timeline">
      <ol className="relative ml-3 border-l border-[var(--line)]">
        {events.map((event) => {
          const Icon = event.icon;

          return (
            <li key={event.label} className="relative pb-5 pl-6 last:pb-0">
              <span className="absolute -left-[13px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]">
                <Icon size={11} />
              </span>
              <p className="text-[11px] font-semibold text-[var(--text)]">
                {event.label}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
                {formatDate(event.date)} · {relativeDate(event.date)}
              </p>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 border-t border-[var(--line)] pt-4 text-[10px] text-[var(--text-subtle)]">
        A full HR timeline will appear here once Audit Logs are connected.
      </p>
    </Panel>
  );
}

function DetailTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-[var(--surface-muted)] px-3.5 py-3">
      <span className="mt-0.5 text-[var(--text-subtle)]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] font-medium text-[var(--text-subtle)]">{label}</p>
        <p className="mt-0.5 truncate text-[12px] font-semibold text-[var(--text)]">
          {value}
        </p>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
  external,
  onCopy,
}: {
  icon: ReactNode;
  label: string;
  value?: string | null;
  href?: string;
  external?: boolean;
  onCopy?: (value: string, label: string) => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-muted)]">
      <span className="text-[var(--text-subtle)]">{icon}</span>

      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-medium text-[var(--text-subtle)]">{label}</p>
        {value && href ? (
          <a
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className={cx(
              'mt-0.5 block truncate rounded text-[11px] font-semibold text-[var(--text)] hover:underline',
              focusRing,
            )}
          >
            {value}
          </a>
        ) : (
          <p
            className={cx(
              'mt-0.5 truncate text-[11px]',
              value
                ? 'font-semibold text-[var(--text)]'
                : 'text-[var(--text-subtle)]',
            )}
          >
            {value || 'Not set'}
          </p>
        )}
      </div>

      {value && onCopy ? (
        <button
          type="button"
          onClick={() => onCopy(value, label)}
          aria-label={`Copy ${label.toLowerCase()}`}
          className={cx(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] opacity-0 transition hover:bg-[var(--surface)] hover:text-[var(--text)] group-hover:opacity-100 focus-visible:opacity-100',
            focusRing,
          )}
        >
          <Copy size={12} />
        </button>
      ) : null}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-[var(--line)] py-3 first:pt-0 last:border-0 last:pb-0">
      <span className="shrink-0 text-[10px] text-[var(--text-subtle)]">
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-[11px] font-semibold text-[var(--text)]">
        {value}
      </span>
    </div>
  );
}

function PersonRow({
  person,
  subtitle,
  status,
  onClick,
}: {
  person: Person;
  subtitle: string;
  status: EmployeeStatus;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)]',
        focusRing,
      )}
    >
      <Avatar person={person} size="md" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-[var(--text)]">
          {employeeName(person)}
        </p>
        <p className="truncate text-[10px] text-[var(--text-subtle)]">
          {subtitle}
        </p>
      </div>

      <StatusBadge status={status} compact />

      <ChevronRight
        size={14}
        className="shrink-0 text-[var(--text-subtle)] transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

/* =============================================================================
 * MODAL SHELL
 * =============================================================================
 */

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

/* =============================================================================
 * CONFIRM DIALOG
 * =============================================================================
 */

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

/* =============================================================================
 * DROPDOWN
 * =============================================================================
 */

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

/* =============================================================================
 * SEGMENTED CONTROL
 * =============================================================================
 */

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

/* =============================================================================
 * TOAST
 * =============================================================================
 */

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

/* =============================================================================
 * SHARED
 * =============================================================================
 */

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

function StatusBadge({
  status,
  compact = false,
}: {
  status: EmployeeStatus;
  compact?: boolean;
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-bold uppercase tracking-[0.08em]',
        compact ? 'px-2 py-1 text-[7px]' : 'px-2.5 py-1 text-[8px]',
        statusTone(status),
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', statusDot(status))} />
      {prettyEnum(status)}
    </span>
  );
}

function DepartmentTile({ department }: { department: Department | null }) {
  const visual = departmentVisual(department);

  return (
    <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
      {department ? iconForDepartment(visual.icon, 12) : <Network size={12} strokeWidth={1.8} />}
      {department ? (
        <span
          className={cx(
            'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[var(--surface)]',
            colourDotClass(visual.colour),
          )}
        />
      ) : null}
    </span>
  );
}

function DepartmentChip({ department }: { department?: Department | null }) {
  if (!department) {
    return <Chip icon={<Building2 size={10} />}>No department</Chip>;
  }

  const visual = departmentVisual(department);

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-muted)]">
      <span
        className={cx('h-1.5 w-1.5 shrink-0 rounded-full', colourDotClass(visual.colour))}
      />
      <span className="truncate">{department.name}</span>
    </span>
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

function LoadingState() {
  return (
    <div className="space-y-5">
      <div className="h-[210px] animate-pulse rounded-[26px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-[250px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 motion-reduce:animate-none"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-[15px] bg-[var(--surface-muted)]" />
              <div className="flex-1">
                <div className="h-3 w-32 rounded bg-[var(--surface-muted)]" />
                <div className="mt-2 h-2 w-20 rounded bg-[var(--surface-muted)]" />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <div className="h-4 w-24 rounded bg-[var(--surface-muted)]" />
              <div className="h-4 w-16 rounded bg-[var(--surface-muted)]" />
            </div>
            <div className="mt-8 h-px bg-[var(--line)]" />
            <div className="mt-5 h-8 w-full rounded-xl bg-[var(--surface-muted)]" />
          </div>
        ))}
      </div>
    </div>
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