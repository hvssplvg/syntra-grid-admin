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
  type MouseEvent as ReactMouseEvent,
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
  Archive,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CirclePause,
  Grid2X2,
  Layers3,
  LayoutList,
  Link2,
  Loader2,
  MoreHorizontal,
  Network,
  Pencil,
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
} from 'lucide-react';

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type DepartmentStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

type ViewMode = 'grid' | 'list';

type SortMode =
  | 'order'
  | 'name-asc'
  | 'name-desc'
  | 'members-desc'
  | 'newest';

type Person = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
  role?: string;
  active?: boolean;
  departmentId?: string | null;
};

type DepartmentSummary = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  status: DepartmentStatus;
  parentId?: string | null;
  displayOrder: number;
  _count?: {
    members?: number;
  };
};

type Department = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  description: string | null;
  status: DepartmentStatus;
  icon: string | null;
  colour: string | null;
  leadId: string | null;
  parentId: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  lead: Person | null;
  parent: {
    id: string;
    name: string;
    slug: string;
    code: string | null;
    status: DepartmentStatus;
  } | null;
  children: DepartmentSummary[];
  members: Person[];
  _count: {
    members: number;
    children: number;
  };
};

type DepartmentMeta = {
  total: number;
  active: number;
  paused: number;
  archived: number;
  rootDepartments: number;
  assignedMembers: number;
  resultCount: number;
};

type DepartmentsResponse = {
  ok?: boolean;
  departments?: Department[];
  meta?: Partial<DepartmentMeta>;
  error?: string;
};

type OptionsResponse = {
  ok?: boolean;
  leads?: Person[];
  departments?: DepartmentSummary[];
  statuses?: DepartmentStatus[];
  error?: string;
};

type MenuState = {
  id: string;
  top: number;
  right: number;
  placement: 'bottom' | 'top';
} | null;

type ToastState = {
  id: number;
  tone: 'success' | 'error';
  message: string;
} | null;

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

const EMPTY_META: DepartmentMeta = {
  total: 0,
  active: 0,
  paused: 0,
  archived: 0,
  rootDepartments: 0,
  assignedMembers: 0,
  resultCount: 0,
};

const STATUS_OPTIONS: Array<{
  value: DepartmentStatus;
  label: string;
}> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const SORT_OPTIONS: Array<DropdownOption<SortMode>> = [
  { value: 'order', label: 'Default order' },
  { value: 'name-asc', label: 'Name A to Z' },
  { value: 'name-desc', label: 'Name Z to A' },
  { value: 'members-desc', label: 'Most members' },
  { value: 'newest', label: 'Newest first' },
];

const COLOUR_OPTIONS = [
  'emerald',
  'blue',
  'violet',
  'amber',
  'rose',
  'cyan',
  'slate',
] as const;

const ICON_OPTIONS = [
  'building',
  'users',
  'network',
  'sparkles',
  'shield',
  'layers',
] as const;

const ICON_LABELS: Record<string, string> = {
  building: 'Building',
  users: 'People',
  network: 'Network',
  sparkles: 'Creative',
  shield: 'Shield',
  layers: 'Layers',
};

const ICON_KEYWORDS: Array<{
  icon: (typeof ICON_OPTIONS)[number];
  words: string[];
}> = [
  {
    icon: 'layers',
    words: [
      'engineering',
      'product',
      'development',
      'dev',
      'technology',
      'tech',
      'platform',
      'software',
      'data',
      'it',
    ],
  },
  {
    icon: 'sparkles',
    words: [
      'design',
      'marketing',
      'growth',
      'brand',
      'creative',
      'content',
      'social',
      'media',
      'ai',
      'innovation',
      'research',
    ],
  },
  {
    icon: 'shield',
    words: [
      'security',
      'legal',
      'compliance',
      'risk',
      'finance',
      'accounts',
      'audit',
      'quality',
    ],
  },
  {
    icon: 'users',
    words: [
      'people',
      'hr',
      'human',
      'resources',
      'talent',
      'team',
      'client',
      'clients',
      'customer',
      'success',
      'support',
      'sales',
      'community',
    ],
  },
  {
    icon: 'network',
    words: [
      'operations',
      'ops',
      'infrastructure',
      'partnerships',
      'logistics',
      'delivery',
      'projects',
      'strategy',
    ],
  },
];

const KNOWN_CODES: Record<string, string> = {
  engineering: 'ENG',
  operations: 'OPS',
  marketing: 'MKT',
  finance: 'FIN',
  design: 'DES',
  product: 'PRD',
  sales: 'SLS',
  support: 'SUP',
  legal: 'LGL',
  security: 'SEC',
  growth: 'GRW',
  people: 'PPL',
  research: 'RES',
  infrastructure: 'INF',
  administration: 'ADM',
  admin: 'ADM',
  management: 'MGT',
  executive: 'EXE',
  leadership: 'LDR',
  technology: 'TEC',
  development: 'DEV',
  data: 'DAT',
  quality: 'QA',
  compliance: 'CMP',
  partnerships: 'PTN',
  clients: 'CLI',
  client: 'CLI',
  hr: 'HR',
  it: 'IT',
  ai: 'AI',
};

const STOP_WORDS = new Set([
  'and',
  'of',
  'the',
  'for',
  'to',
  'in',
]);

/*
 * Modals, dropdowns, menus and toasts are portalled to document.body, which
 * sits outside the dashboard element that defines the theme variables. The
 * bridge copies those variables onto every portal so colours resolve.
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

const VIEW_KEY = 'syntragrid.departments.view';
const SORT_KEY = 'syntragrid.departments.sort';

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

function cx(
  ...classes: Array<string | false | null | undefined>
) {
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

function personName(person: Person | null) {
  if (!person) {
    return '';
  }

  const full = [person.firstName, person.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return full || person.email;
}

function initials(person: Person) {
  const first = person.firstName?.trim()?.[0] ?? '';
  const last = person.lastName?.trim()?.[0] ?? '';

  if (first || last) {
    return `${first}${last}`.toUpperCase();
  }

  return person.email.slice(0, 2).toUpperCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function nameWords(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !STOP_WORDS.has(word));
}

function suggestCode(name: string) {
  const words = nameWords(name);

  if (words.length === 0) {
    return '';
  }

  if (words.length === 1) {
    const [word] = words;
    return (KNOWN_CODES[word] ?? word.slice(0, 3)).toUpperCase();
  }

  return words
    .slice(0, 4)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function suggestIcon(name: string) {
  const words = new Set(nameWords(name));

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

function uniqueValue(
  base: string,
  taken: Set<string>,
  separator: string,
  maxLength = 80,
) {
  if (!base || !taken.has(base)) {
    return base;
  }

  let counter = 2;

  while (counter < 1000) {
    const suffix = `${separator}${counter}`;
    const candidate = `${base.slice(
      0,
      maxLength - suffix.length,
    )}${suffix}`;

    if (!taken.has(candidate)) {
      return candidate;
    }

    counter += 1;
  }

  return base;
}

function statusLabel(status: DepartmentStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'PAUSED':
      return 'Paused';
    case 'ARCHIVED':
      return 'Archived';
  }
}

function statusClasses(status: DepartmentStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'border-[color:var(--success-border,var(--line))] bg-[var(--success-soft,var(--surface-muted))] text-[var(--success,var(--text))]';
    case 'PAUSED':
      return 'border-[color:var(--warning-border,var(--line))] bg-[var(--warning-soft,var(--surface-muted))] text-[var(--warning,var(--text))]';
    case 'ARCHIVED':
      return 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]';
  }
}

function statusDotClass(status: DepartmentStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-[var(--success,#10b981)]';
    case 'PAUSED':
      return 'bg-[var(--warning,#f59e0b)]';
    case 'ARCHIVED':
      return 'bg-[var(--text-subtle)]';
  }
}

function colourDotClass(colour: string | null) {
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

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function iconForDepartment(icon: string | null, size = 18) {
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

function normaliseMeta(value?: Partial<DepartmentMeta>): DepartmentMeta {
  return { ...EMPTY_META, ...value };
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

const inputClass = cx(
  'h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] text-[var(--text)] outline-none transition',
  'placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10',
  'disabled:cursor-not-allowed disabled:opacity-60',
);

/* =============================================================================
 * MAIN TAB
 * =============================================================================
 */

export default function DepartmentsTab() {
  const reduceMotion = useReducedMotion();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [meta, setMeta] = useState<DepartmentMeta>(EMPTY_META);
  const [leads, setLeads] = useState<Person[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<
    DepartmentSummary[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | DepartmentStatus
  >('ALL');
  const [view, setView] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortMode>('order');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] =
    useState<Department | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] =
    useState<Department | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [menu, setMenu] = useState<MenuState>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const theme = useThemeBridge();

  const notify = useCallback(
    (tone: 'success' | 'error', message: string) => {
      setToast({ id: Date.now(), tone, message });
    },
    [],
  );

  const loadDepartments = useCallback(
    async (background = false) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const params = new URLSearchParams();

        if (statusFilter !== 'ALL') {
          params.set('status', statusFilter);
        }

        const response = await fetch(
          `/api/admin/departments${
            params.size ? `?${params.toString()}` : ''
          }`,
          {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include',
          },
        );

        const payload = (await response
          .json()
          .catch(() => null)) as DepartmentsResponse | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(
            payload?.error || 'Could not load departments.',
          );
        }

        setDepartments(
          Array.isArray(payload.departments)
            ? payload.departments
            : [],
        );
        setMeta(normaliseMeta(payload.meta));
      } catch (cause) {
        console.error('Could not load departments:', cause);
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load departments.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter],
  );

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);

    try {
      const response = await fetch(
        '/api/admin/departments/options',
        {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        },
      );

      const payload = (await response
        .json()
        .catch(() => null)) as OptionsResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error || 'Could not load department options.',
        );
      }

      setLeads(Array.isArray(payload.leads) ? payload.leads : []);
      setDepartmentOptions(
        Array.isArray(payload.departments)
          ? payload.departments
          : [],
      );
    } catch (cause) {
      console.error('Could not load department options:', cause);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    try {
      const storedView = window.localStorage.getItem(VIEW_KEY);
      const storedSort = window.localStorage.getItem(SORT_KEY);

      if (storedView === 'grid' || storedView === 'list') {
        setView(storedView);
      }

      if (isSortMode(storedSort)) {
        setSort(storedSort);
      }
    } catch {
      // Storage is optional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Storage is optional.
    }
  }, [view]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SORT_KEY, sort);
    } catch {
      // Storage is optional.
    }
  }, [sort]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openCreate = useCallback(() => {
    setEditingDepartment(null);
    setEditorOpen(true);
    setMenu(null);
  }, []);

  const openEdit = useCallback((department: Department) => {
    setEditingDepartment(department);
    setEditorOpen(true);
    setMenu(null);
  }, []);

  const requestArchive = useCallback((department: Department) => {
    setMenu(null);
    setArchiveTarget(department);
    setConfirmOpen(true);
  }, []);

  const overlayOpen = editorOpen || confirmOpen;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (event.key === 'Escape') {
        setMenu(null);
        return;
      }

      if (overlayOpen || typing) {
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
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
        openCreate();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [overlayOpen, openCreate]);

  const visibleDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();

    const next = departments.filter((department) => {
      if (!query) {
        return true;
      }

      const haystack = [
        department.name,
        department.slug,
        department.code ?? '',
        department.description ?? '',
        department.parent?.name ?? '',
        personName(department.lead),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });

    switch (sort) {
      case 'name-asc':
        next.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        next.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'members-desc':
        next.sort(
          (a, b) => b._count.members - a._count.members,
        );
        break;
      case 'newest':
        next.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        );
        break;
      case 'order':
      default:
        next.sort(
          (a, b) =>
            a.displayOrder - b.displayOrder ||
            a.name.localeCompare(b.name),
        );
        break;
    }

    return next;
  }, [departments, search, sort]);

  const handleSaved = useCallback(
    async (message: string) => {
      setEditorOpen(false);
      notify('success', message);
      await Promise.all([loadDepartments(true), loadOptions()]);
    },
    [loadDepartments, loadOptions, notify],
  );

  const confirmArchive = useCallback(async () => {
    if (!archiveTarget || archiving) {
      return;
    }

    setArchiving(true);

    try {
      const response = await fetch(
        `/api/admin/departments/${archiveTarget.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      const payload = (await response
        .json()
        .catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error || 'Could not archive department.',
        );
      }

      setConfirmOpen(false);
      notify('success', `${archiveTarget.name} archived`);
      await Promise.all([loadDepartments(true), loadOptions()]);
    } catch (cause) {
      notify(
        'error',
        cause instanceof Error
          ? cause.message
          : 'Could not archive department.',
      );
    } finally {
      setArchiving(false);
    }
  }, [archiveTarget, archiving, loadDepartments, loadOptions, notify]);

  const statusFilterOptions = useMemo<
    Array<DropdownOption<'ALL' | DepartmentStatus>>
  >(
    () => [
      {
        value: 'ALL',
        label: 'All statuses',
        leading: (
          <span className="h-2 w-2 rounded-full border border-[var(--text-subtle)]" />
        ),
        trailing: <CountPill value={meta.total} />,
      },
      ...STATUS_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        leading: (
          <span
            className={cx(
              'h-2 w-2 rounded-full',
              statusDotClass(option.value),
            )}
          />
        ),
        trailing: (
          <CountPill
            value={
              option.value === 'ACTIVE'
                ? meta.active
                : option.value === 'PAUSED'
                  ? meta.paused
                  : meta.archived
            }
          />
        ),
      })),
    ],
    [meta],
  );

  return (
    <PortalTheme.Provider value={theme.vars}>
    <div ref={theme.ref} className="mx-auto w-full max-w-[1600px]">
      <section className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        <div className="border-b border-[var(--line)] px-4 py-5 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-[760px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                  <Network size={10} strokeWidth={2} />
                  Company structure
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[9px] font-semibold text-[var(--text-muted)]">
                  {meta.total}{' '}
                  {meta.total === 1 ? 'department' : 'departments'}
                </span>
              </div>

              <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[28px]">
                Departments
              </h2>

              <p className="mt-1.5 max-w-[680px] text-[12px] leading-5 text-[var(--text-muted)] sm:text-[13px]">
                Organise Syntra Grid&apos;s company structure,
                department leadership and team ownership from one
                place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadDepartments(true)}
                disabled={refreshing}
                className={cx(
                  'inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[11px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60',
                  focusRing,
                )}
              >
                <RefreshCw
                  size={14}
                  strokeWidth={1.9}
                  className={cx(refreshing && 'animate-spin')}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={openCreate}
                className={cx(
                  'group inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] pl-4 pr-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90',
                  focusRing,
                )}
              >
                <Plus size={15} strokeWidth={2} />
                Add department
                <kbd className="ml-1 hidden h-5 min-w-5 items-center justify-center rounded-md bg-white/15 px-1.5 text-[9px] font-semibold text-white/90 sm:inline-flex">
                  N
                </kbd>
              </button>
            </div>
          </div>
        </div>

        <Metrics meta={meta} />

        <div className="border-t border-[var(--line)] px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1 xl:max-w-[420px]">
                <Search
                  size={15}
                  strokeWidth={1.8}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
                />

                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search departments, leads or codes"
                  aria-label="Search departments"
                  className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-10 pr-12 text-[11px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:bg-[var(--surface)]"
                />

                {search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
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

              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Dropdown
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusFilterOptions}
                  ariaLabel="Filter by status"
                  triggerClassName="sm:w-[168px]"
                  minWidth={210}
                />

                <Dropdown
                  value={sort}
                  onChange={setSort}
                  options={SORT_OPTIONS}
                  ariaLabel="Sort departments"
                  triggerClassName="sm:w-[158px]"
                  minWidth={190}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <p className="text-[10px] font-medium text-[var(--text-subtle)]">
                {visibleDepartments.length} shown
              </p>

              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => void loadDepartments()}
          />
        ) : visibleDepartments.length === 0 ? (
          <EmptyState
            hasFilters={
              Boolean(search.trim()) || statusFilter !== 'ALL'
            }
            onCreate={openCreate}
            onClear={() => {
              setSearch('');
              setStatusFilter('ALL');
            }}
          />
        ) : view === 'grid' ? (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleDepartments.map((department) => (
                <motion.div
                  key={department.id}
                  layout={!reduceMotion}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={
                    reduceMotion
                      ? { duration: 0.12 }
                      : {
                          type: 'spring',
                          stiffness: 380,
                          damping: 34,
                        }
                  }
                >
                  <DepartmentCard
                    department={department}
                    onEdit={() => openEdit(department)}
                    onMenu={(event) => {
                      const rect =
                        event.currentTarget.getBoundingClientRect();
                      const flip =
                        rect.bottom + 120 > window.innerHeight;

                      setMenu({
                        id: department.id,
                        top: flip ? rect.top - 6 : rect.bottom + 6,
                        right: window.innerWidth - rect.right,
                        placement: flip ? 'top' : 'bottom',
                      });
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <DepartmentList
            departments={visibleDepartments}
            onEdit={openEdit}
            onArchive={requestArchive}
          />
        )}
      </div>

      <DepartmentMenu
        menu={menu}
        department={
          menu
            ? (departments.find(
                (department) => department.id === menu.id,
              ) ?? null)
            : null
        }
        onClose={() => setMenu(null)}
        onEdit={openEdit}
        onArchive={requestArchive}
      />

      <DepartmentEditor
        open={editorOpen}
        department={editingDepartment}
        leads={leads}
        options={departmentOptions}
        departments={departments}
        optionsLoading={optionsLoading}
        onClose={() => setEditorOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmArchiveDialog
        open={confirmOpen}
        department={archiveTarget}
        busy={archiving}
        onCancel={() => {
          if (!archiving) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={() => void confirmArchive()}
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

function Metrics({ meta }: { meta: DepartmentMeta }) {
  const metrics = [
    {
      label: 'Active',
      value: meta.active,
      helper: 'Operating departments',
      icon: Building2,
    },
    {
      label: 'People assigned',
      value: meta.assignedMembers,
      helper: 'System users assigned',
      icon: Users,
    },
    {
      label: 'Top level',
      value: meta.rootDepartments,
      helper: 'Primary departments',
      icon: Network,
    },
    {
      label: 'Paused',
      value: meta.paused,
      helper: 'Temporarily inactive',
      icon: CirclePause,
    },
  ];

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] lg:grid-cols-4 lg:divide-y-0">
      {metrics.map((metric) => {
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
                <p className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-[-0.04em] text-[var(--text)]">
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

  const items: Array<{
    value: ViewMode;
    label: string;
    icon: ReactNode;
  }> = [
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
                    : {
                        type: 'spring',
                        stiffness: 500,
                        damping: 38,
                      }
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
 * DEPARTMENT CARD
 * =============================================================================
 */

function DepartmentCard({
  department,
  onEdit,
  onMenu,
}: {
  department: Department;
  onEdit: () => void;
  onMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const visibleMembers = department.members.slice(0, 4);
  const remaining = Math.max(
    0,
    department._count.members - visibleMembers.length,
  );

  return (
    <article className="group h-full overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-[color:var(--text-subtle)]/40 hover:shadow-md">
      <div className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={onEdit}
            className={cx(
              'flex min-w-0 items-center gap-3 rounded-xl text-left',
              focusRing,
            )}
          >
            <IdentityTile
              icon={department.icon ?? suggestIcon(department.name)}
              colour={
                department.colour ?? suggestColour(department.name)
              }
              size="md"
            />

            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                  {department.name}
                </h3>

                {department.code ? (
                  <span className="shrink-0 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                    {department.code}
                  </span>
                ) : null}
              </div>

              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[9px] text-[var(--text-subtle)]">
                {department.parent ? (
                  <>
                    <span className="truncate">
                      {department.parent.name}
                    </span>
                    <ChevronRight size={10} className="shrink-0" />
                  </>
                ) : null}
                <span className="truncate">{department.slug}</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onMenu}
            className={cx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
              focusRing,
            )}
            aria-label={`Actions for ${department.name}`}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        <p className="mt-4 line-clamp-2 min-h-[40px] text-[11px] leading-5 text-[var(--text-muted)]">
          {department.description ||
            'No description yet. Add one so the team knows what this department owns.'}
        </p>

        <div className="mb-5 mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={department.status} />

          {department._count.children > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[8px] font-semibold text-[var(--text-subtle)]">
              <Layers3 size={9} />
              {department._count.children}{' '}
              {department._count.children === 1
                ? 'sub department'
                : 'sub departments'}
            </span>
          ) : null}
        </div>

        <div className="mt-auto border-t border-[var(--line)] pt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
                Department lead
              </p>

              <div className="mt-1.5 flex min-w-0 items-center gap-2">
                <PersonAvatar
                  person={department.lead}
                  size="small"
                />
                <p className="truncate text-[10px] font-semibold text-[var(--text)]">
                  {department.lead
                    ? personName(department.lead)
                    : 'Not assigned'}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
                Members
              </p>
              <p className="mt-1 text-[16px] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text)]">
                {department._count.members}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            {department._count.members > 0 ? (
              <div className="flex -space-x-2">
                {visibleMembers.map((member) => (
                  <PersonAvatar key={member.id} person={member} />
                ))}

                {remaining > 0 ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface-muted)] text-[8px] font-bold text-[var(--text-muted)]">
                    +{remaining}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[9px] text-[var(--text-subtle)]">
                No members assigned
              </p>
            )}

            <button
              type="button"
              onClick={onEdit}
              className={cx(
                'inline-flex items-center gap-1 rounded-md text-[9px] font-semibold text-[var(--accent)] transition hover:opacity-70',
                focusRing,
              )}
            >
              {department._count.members > 0
                ? 'Manage'
                : 'Edit department'}
              <ChevronRight
                size={11}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* =============================================================================
 * LIST VIEW
 * =============================================================================
 */

const LIST_COLUMNS =
  'lg:grid-cols-[minmax(240px,1.6fr)_minmax(150px,.8fr)_120px_100px_120px_80px]';

function DepartmentList({
  departments,
  onEdit,
  onArchive,
}: {
  departments: Department[];
  onEdit: (department: Department) => void;
  onArchive: (department: Department) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <div
        className={cx(
          'hidden gap-4 border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-3 lg:grid',
          LIST_COLUMNS,
        )}
      >
        {['Department', 'Lead', 'Status', 'Members', 'Updated', ''].map(
          (label) => (
            <p
              key={label || 'actions'}
              className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]"
            >
              {label}
            </p>
          ),
        )}
      </div>

      <div className="divide-y divide-[var(--line)]">
        {departments.map((department) => (
          <div
            key={department.id}
            className="px-4 py-4 transition-colors hover:bg-[var(--surface-muted)] sm:px-5"
          >
            <div
              className={cx(
                'flex items-start justify-between gap-3 lg:grid lg:items-center lg:gap-4',
                LIST_COLUMNS,
              )}
            >
              <button
                type="button"
                onClick={() => onEdit(department)}
                className={cx(
                  'flex min-w-0 items-center gap-3 rounded-xl text-left',
                  focusRing,
                )}
              >
                <IdentityTile
                  icon={
                    department.icon ?? suggestIcon(department.name)
                  }
                  colour={
                    department.colour ??
                    suggestColour(department.name)
                  }
                  size="sm"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[11px] font-semibold text-[var(--text)]">
                      {department.name}
                    </p>

                    {department.code ? (
                      <span className="rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[7px] font-bold text-[var(--text-subtle)]">
                        {department.code}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-0.5 truncate text-[9px] text-[var(--text-subtle)]">
                    {department.parent
                      ? `${department.parent.name} · `
                      : ''}
                    {department.slug}
                  </p>
                </div>
              </button>

              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                <PersonAvatar person={department.lead} size="small" />
                <span className="truncate text-[10px] font-medium text-[var(--text-muted)]">
                  {department.lead
                    ? personName(department.lead)
                    : 'Unassigned'}
                </span>
              </div>

              <div className="hidden lg:block">
                <StatusBadge status={department.status} compact />
              </div>

              <p className="hidden text-[10px] font-semibold tabular-nums text-[var(--text)] lg:block">
                {department._count.members}
              </p>

              <p className="hidden text-[9px] text-[var(--text-subtle)] lg:block">
                {formatDate(department.updatedAt)}
              </p>

              <div className="flex shrink-0 items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(department)}
                  className={cx(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]',
                    focusRing,
                  )}
                  aria-label={`Edit ${department.name}`}
                >
                  <Pencil size={13} />
                </button>

                {department.status !== 'ARCHIVED' ? (
                  <button
                    type="button"
                    onClick={() => onArchive(department)}
                    className={cx(
                      'flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]',
                      focusRing,
                    )}
                    aria-label={`Archive ${department.name}`}
                  >
                    <Archive size={13} />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 lg:hidden">
              <StatusBadge status={department.status} compact />
              <span className="text-[9px] text-[var(--text-subtle)]">
                {department._count.members} members
              </span>
              {department.lead ? (
                <span className="text-[9px] text-[var(--text-subtle)]">
                  · {personName(department.lead)}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
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
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
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
              size === 'lg' ? 'sm:max-w-[680px]' : 'sm:max-w-[440px]',
            )}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 28, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 14, scale: 0.98 }
            }
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : {
                    type: 'spring',
                    stiffness: 420,
                    damping: 36,
                    mass: 0.9,
                  }
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
 * DEPARTMENT EDITOR
 * =============================================================================
 */

function DepartmentEditor({
  open,
  department,
  leads,
  options,
  departments,
  optionsLoading,
  onClose,
  onSaved,
}: {
  open: boolean;
  department: Department | null;
  leads: Person[];
  options: DepartmentSummary[];
  departments: Department[];
  optionsLoading: boolean;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={titleId}>
      <EditorForm
        key={department?.id ?? 'new'}
        titleId={titleId}
        department={department}
        leads={leads}
        options={options}
        departments={departments}
        optionsLoading={optionsLoading}
        onClose={onClose}
        onSaved={onSaved}
      />
    </ModalShell>
  );
}

type EditorState = {
  name: string;
  description: string;
  status: DepartmentStatus;
  leadId: string;
  parentId: string;
  icon: string;
  colour: string;
  slug: string;
  code: string;
  iconAuto: boolean;
  colourAuto: boolean;
  slugAuto: boolean;
  codeAuto: boolean;
};

function initialEditorState(department: Department | null): EditorState {
  if (!department) {
    return {
      name: '',
      description: '',
      status: 'ACTIVE',
      leadId: '',
      parentId: '',
      icon: '',
      colour: '',
      slug: '',
      code: '',
      iconAuto: true,
      colourAuto: true,
      slugAuto: true,
      codeAuto: true,
    };
  }

  return {
    name: department.name,
    description: department.description ?? '',
    status: department.status,
    leadId: department.leadId ?? '',
    parentId: department.parentId ?? '',
    icon: department.icon ?? '',
    colour: department.colour ?? '',
    slug: department.slug,
    code: department.code ?? '',
    iconAuto: !department.icon,
    colourAuto: !department.colour,
    slugAuto: false,
    codeAuto: !department.code,
  };
}

function EditorForm({
  titleId,
  department,
  leads,
  options,
  departments,
  optionsLoading,
  onClose,
  onSaved,
}: {
  titleId: string;
  department: Department | null;
  leads: Person[];
  options: DepartmentSummary[];
  departments: Department[];
  optionsLoading: boolean;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion();
  const isEditing = Boolean(department);
  const nameId = useId();

  const [form, setForm] = useState<EditorState>(() =>
    initialEditorState(department),
  );
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const isMac = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad/.test(navigator.platform),
    [],
  );

  const update = useCallback(
    <K extends keyof EditorState>(key: K, value: EditorState[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  /* ---------- Derived, automatic values ---------- */

  const others = useMemo(() => {
    const map = new Map<
      string,
      { slug: string; code: string | null; displayOrder: number }
    >();

    for (const item of options) {
      map.set(item.id, item);
    }

    for (const item of departments) {
      map.set(item.id, item);
    }

    if (department) {
      map.delete(department.id);
    }

    return Array.from(map.values());
  }, [options, departments, department]);

  const takenSlugs = useMemo(
    () => new Set(others.map((item) => item.slug)),
    [others],
  );

  const takenCodes = useMemo(
    () =>
      new Set(
        others
          .map((item) => item.code?.toUpperCase())
          .filter((code): code is string => Boolean(code)),
      ),
    [others],
  );

  const autoSlug = useMemo(
    () => uniqueValue(slugify(form.name), takenSlugs, '-'),
    [form.name, takenSlugs],
  );

  const autoCode = useMemo(
    () => uniqueValue(suggestCode(form.name), takenCodes, '', 12),
    [form.name, takenCodes],
  );

  const effective = {
    slug: form.slugAuto ? autoSlug : form.slug,
    code: form.codeAuto ? autoCode : form.code,
    icon: form.iconAuto ? suggestIcon(form.name) : form.icon,
    colour: form.colourAuto
      ? (suggestColour(form.name) ?? '')
      : form.colour,
  };

  const displayOrder = useMemo(() => {
    if (department) {
      return department.displayOrder;
    }

    return others.length
      ? Math.max(...others.map((item) => item.displayOrder)) + 1
      : 0;
  }, [department, others]);

  const positionLabel = useMemo(() => {
    const total = others.length + 1;

    if (!department) {
      return `Position ${total} of ${total}`;
    }

    const rank =
      others.filter((item) => item.displayOrder < displayOrder)
        .length + 1;

    return `Position ${rank} of ${total}`;
  }, [department, others, displayOrder]);

  const slugConflict =
    !form.slugAuto && effective.slug && takenSlugs.has(effective.slug);

  const codeConflict =
    !form.codeAuto &&
    effective.code &&
    takenCodes.has(effective.code.toUpperCase());

  const nameError =
    nameTouched && !form.name.trim()
      ? 'Give the department a name.'
      : null;

  /* ---------- Option lists ---------- */

  const blockedParents = useMemo(() => {
    const blocked = new Set<string>();

    if (!department) {
      return blocked;
    }

    blocked.add(department.id);

    let grew = true;

    while (grew) {
      grew = false;

      for (const item of options) {
        if (
          item.parentId &&
          blocked.has(item.parentId) &&
          !blocked.has(item.id)
        ) {
          blocked.add(item.id);
          grew = true;
        }
      }
    }

    return blocked;
  }, [department, options]);

  const leadOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      {
        value: '',
        label: 'No lead',
        hint: 'Assign later',
        leading: <PersonAvatar person={null} size="small" />,
      },
      ...leads.map((person) => ({
        value: person.id,
        label: personName(person),
        hint: person.role
          ? person.role.replace(/_/g, ' ').toLowerCase()
          : person.email,
        keywords: person.email,
        leading: <PersonAvatar person={person} size="small" />,
      })),
    ],
    [leads],
  );

  const parentOptions = useMemo<Array<DropdownOption<string>>>(() => {
    const fullById = new Map(departments.map((item) => [item.id, item]));

    return [
      {
        value: '',
        label: 'None',
        hint: 'Top level department',
        leading: (
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]">
            <Network size={12} strokeWidth={1.8} />
          </span>
        ),
      },
      ...options
        .filter(
          (item) =>
            item.status !== 'ARCHIVED' && !blockedParents.has(item.id),
        )
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((item) => {
          const full = fullById.get(item.id);

          return {
            value: item.id,
            label: item.name,
            hint: item.code ?? undefined,
            keywords: item.slug,
            leading: (
              <IdentityTile
                icon={full?.icon ?? suggestIcon(item.name)}
                colour={full?.colour ?? suggestColour(item.name)}
                size="xs"
              />
            ),
          };
        }),
    ];
  }, [options, departments, blockedParents]);

  /* ---------- Submit ---------- */

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();

    if (saving) {
      return;
    }

    const name = form.name.trim();

    if (!name) {
      setNameTouched(true);
      return;
    }

    const slug = slugify(effective.slug || name);

    if (!slug) {
      setIssue('The link name needs at least one letter or number.');
      setAdvancedOpen(true);
      return;
    }

    if (slugConflict) {
      setIssue('Another department already uses this link name.');
      setAdvancedOpen(true);
      return;
    }

    if (codeConflict) {
      setIssue('Another department already uses this code.');
      setAdvancedOpen(true);
      return;
    }

    setSaving(true);
    setIssue(null);

    try {
      const response = await fetch(
        department
          ? `/api/admin/departments/${department.id}`
          : '/api/admin/departments',
        {
          method: department ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            slug,
            code: effective.code.trim().toUpperCase() || null,
            description: form.description.trim() || null,
            status: form.status,
            icon: effective.icon || null,
            colour: effective.colour || null,
            leadId: form.leadId || null,
            parentId: form.parentId || null,
            displayOrder,
          }),
        },
      );

      const payload = (await response
        .json()
        .catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error ||
            `Could not ${department ? 'save' : 'create'} the department.`,
        );
      }

      await onSaved(
        department ? 'Changes saved' : `${name} created`,
      );
    } catch (cause) {
      setIssue(
        cause instanceof Error
          ? cause.message
          : 'Could not save the department.',
      );
    } finally {
      setSaving(false);
    }
  };

  const onFormKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (
      event.key === 'Enter' &&
      (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      void submit();
    }
  };

  const spring = reduceMotion
    ? { duration: 0.12 }
    : { type: 'spring' as const, stiffness: 420, damping: 32 };

  return (
    <form
      onSubmit={submit}
      onKeyDown={onFormKeyDown}
      noValidate
      className="flex max-h-[92dvh] min-h-0 flex-col sm:max-h-[min(86dvh,860px)]"
    >
      {/* Header: the live identity of the department */}
      <div className="border-b border-[var(--line)] px-5 pb-5 pt-4 sm:px-7 sm:pt-6">
        <div className="flex items-start gap-4">
          <IdentityTile
            icon={effective.icon}
            colour={effective.colour || null}
            size="lg"
            animateChanges
          />

          <div className="min-w-0 flex-1 pt-0.5">
            <p
              id={titleId}
              className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]"
            >
              {isEditing ? 'Edit department' : 'New department'}
            </p>

            <label
              htmlFor={nameId}
              className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-[var(--text-muted)]"
            >
              Department name
              <span className="text-[var(--accent)]">*</span>
            </label>

            <div
              className={cx(
                'mt-1.5 flex items-center gap-2.5 rounded-xl border bg-white px-3.5 transition',
                nameError
                  ? 'border-red-500/60 ring-2 ring-red-500/10'
                  : 'border-[var(--line)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/15',
              )}
            >
              <Pencil
                size={15}
                strokeWidth={1.9}
                className="shrink-0 text-[var(--text-subtle)]"
              />

              <input
                id={nameId}
                data-autofocus
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                onBlur={() => setNameTouched(true)}
                placeholder="Type the department name, e.g. Engineering"
                aria-invalid={Boolean(nameError)}
                aria-required="true"
                maxLength={80}
                autoComplete="off"
                className="h-12 min-w-0 flex-1 bg-transparent text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)] outline-none placeholder:font-medium placeholder:text-[var(--text-subtle)] sm:text-[18px]"
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <MetaChip
                icon={<Link2 size={10} strokeWidth={2} />}
                auto={form.slugAuto}
              >
                {effective.slug || 'link name'}
              </MetaChip>

              <MetaChip auto={form.codeAuto}>
                {effective.code || 'code'}
              </MetaChip>

              <MetaChip>{positionLabel}</MetaChip>
            </div>

            <AnimatePresence initial={false}>
              {nameError ? (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden text-[10px] font-medium text-red-600"
                >
                  <span className="block pt-2">{nameError}</span>
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
              focusRing,
            )}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
        <AnimatePresence initial={false}>
          {issue ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={spring}
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

        <Field label="What does this department own?">
          <textarea
            value={form.description}
            onChange={(event) =>
              update('description', event.target.value)
            }
            rows={3}
            maxLength={400}
            placeholder="Brand, social media, campaigns and company growth."
            className={cx(inputClass, 'h-auto resize-none py-2.5 leading-5')}
          />
        </Field>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Department lead" as="div">
            <Dropdown
              value={form.leadId}
              onChange={(value) => update('leadId', value)}
              options={leadOptions}
              ariaLabel="Department lead"
              searchable={leadOptions.length > 6}
              searchPlaceholder="Search people"
              emptyText="Nobody matches that search."
              disabled={optionsLoading}
              loading={optionsLoading}
              minWidth={260}
            />
          </Field>

          <Field label="Sits under" as="div">
            <Dropdown
              value={form.parentId}
              onChange={(value) => update('parentId', value)}
              options={parentOptions}
              ariaLabel="Parent department"
              searchable={parentOptions.length > 6}
              searchPlaceholder="Search departments"
              emptyText="No departments match."
              disabled={optionsLoading}
              loading={optionsLoading}
              minWidth={260}
            />
          </Field>
        </div>

        <Field label="Status" as="div" className="mt-5">
          <Segmented
            value={form.status}
            onChange={(value) => update('status', value)}
            ariaLabel="Department status"
            options={STATUS_OPTIONS.map((option) => ({
              ...option,
              leading: (
                <span
                  className={cx(
                    'h-1.5 w-1.5 rounded-full',
                    statusDotClass(option.value),
                  )}
                />
              ),
            }))}
          />
        </Field>

        <div className="mt-6 rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-[var(--text)]">
              Appearance
            </p>

            {form.iconAuto && form.colourAuto ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-medium text-[var(--text-subtle)]">
                <Wand2 size={10} />
                Matched to the name
              </span>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    iconAuto: true,
                    colourAuto: true,
                  }))
                }
                className={cx(
                  'inline-flex items-center gap-1 rounded-md text-[9px] font-semibold text-[var(--accent)] transition hover:opacity-70',
                  focusRing,
                )}
              >
                <RotateCcw size={10} />
                Use automatic
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {ICON_OPTIONS.map((icon) => {
              const active = effective.icon === icon;

              return (
                <button
                  key={icon}
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      icon,
                      iconAuto: false,
                    }))
                  }
                  aria-label={ICON_LABELS[icon]}
                  aria-pressed={active}
                  title={ICON_LABELS[icon]}
                  className={cx(
                    'relative flex h-10 items-center justify-center rounded-xl border transition-colors',
                    active
                      ? 'border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)] shadow-sm'
                      : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface)]',
                    focusRing,
                  )}
                >
                  {iconForDepartment(icon, 16)}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {COLOUR_OPTIONS.map((colour) => {
              const active = effective.colour === colour;

              return (
                <button
                  key={colour}
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      colour,
                      colourAuto: false,
                    }))
                  }
                  aria-label={`${colour} colour`}
                  aria-pressed={active}
                  title={colour}
                  className={cx(
                    'relative flex h-8 w-8 items-center justify-center rounded-full transition-transform',
                    active ? 'scale-100' : 'hover:scale-110',
                    focusRing,
                  )}
                >
                  <span
                    className={cx(
                      'h-5 w-5 rounded-full',
                      colourDotClass(colour),
                    )}
                  />
                  {active ? (
                    <motion.span
                      layoutId="colour-ring"
                      className="absolute inset-0 rounded-full border-2 border-[var(--text)]/70"
                      transition={spring}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setAdvancedOpen((value) => !value)}
            aria-expanded={advancedOpen}
            className={cx(
              'flex w-full items-center justify-between rounded-xl px-1 py-2 text-left',
              focusRing,
            )}
          >
            <span>
              <span className="block text-[11px] font-semibold text-[var(--text)]">
                Link name and code
              </span>
              <span className="mt-0.5 block text-[9px] text-[var(--text-subtle)]">
                {form.slugAuto && form.codeAuto
                  ? 'Generated from the department name'
                  : 'Custom values in use'}
              </span>
            </span>

            <ChevronDown
              size={15}
              className={cx(
                'text-[var(--text-subtle)] transition-transform duration-200',
                advancedOpen && 'rotate-180',
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {advancedOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0.12 }
                    : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }
                }
                className="overflow-hidden"
              >
                <div className="grid gap-4 px-1 pb-1 pt-3 sm:grid-cols-2">
                  <AutoField
                    label="Link name"
                    auto={form.slugAuto}
                    error={
                      slugConflict ? 'Already in use' : undefined
                    }
                    onReset={() => update('slugAuto', true)}
                  >
                    <input
                      value={effective.slug}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          slug: slugify(event.target.value),
                          slugAuto: false,
                        }))
                      }
                      placeholder="growth-and-marketing"
                      className={cx(
                        inputClass,
                        slugConflict && 'border-red-500/50',
                      )}
                    />
                  </AutoField>

                  <AutoField
                    label="Code"
                    auto={form.codeAuto}
                    error={
                      codeConflict ? 'Already in use' : undefined
                    }
                    onReset={() => update('codeAuto', true)}
                  >
                    <input
                      value={effective.code}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          code: event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, '')
                            .slice(0, 12),
                          codeAuto: false,
                        }))
                      }
                      placeholder="GM"
                      className={cx(
                        inputClass,
                        'uppercase tracking-[0.06em]',
                        codeConflict && 'border-red-500/50',
                      )}
                    />
                  </AutoField>
                </div>

                {isEditing && !form.slugAuto ? (
                  <p className="px-1 pt-2 text-[9px] leading-4 text-[var(--text-subtle)]">
                    Changing the link name of an existing department
                    can break saved links to it.
                  </p>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--line)] bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <p className="hidden items-center gap-1.5 text-[9px] text-[var(--text-subtle)] sm:flex">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>Enter</Kbd>
            to {isEditing ? 'save' : 'create'}
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
              disabled={saving}
              className={cx(
                'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[150px] sm:flex-none',
                focusRing,
              )}
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  {isEditing ? 'Saving' : 'Creating'}
                </>
              ) : (
                <>
                  <Check size={13} />
                  {isEditing ? 'Save changes' : 'Create department'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* =============================================================================
 * CONFIRM ARCHIVE
 * =============================================================================
 */

function ConfirmArchiveDialog({
  open,
  department,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  department: Department | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      labelledBy={titleId}
      size="sm"
    >
      <div className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]">
          <Archive size={18} strokeWidth={1.8} />
        </div>

        <h3
          id={titleId}
          className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]"
        >
          Archive {department?.name ?? 'department'}?
        </h3>

        <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
          It stays in historical records and appears under the
          Archived filter. Members keep their accounts.
        </p>

        {department && department._count.members > 0 ? (
          <p className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-[10px] leading-5 text-[var(--text-muted)]">
            {department._count.members}{' '}
            {department._count.members === 1
              ? 'person is'
              : 'people are'}{' '}
            currently assigned here.
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
            Keep department
          </button>

          <button
            type="button"
            data-autofocus
            onClick={onConfirm}
            disabled={busy}
            className={cx(
              'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--text)] px-4 text-[10px] font-semibold text-[var(--surface)] transition hover:opacity-90 disabled:opacity-60',
              focusRing,
            )}
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Archive size={13} />
            )}
            {busy ? 'Archiving' : 'Archive'}
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

  const selected =
    options.find((option) => option.value === value) ?? null;

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
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - width - 8,
    );
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

  const onTriggerKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
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
          <span className="flex shrink-0 items-center">
            {selected.leading}
          </span>
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
                      : {
                          type: 'spring',
                          stiffness: 520,
                          damping: 36,
                        }
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
                      maxHeight:
                        position.maxHeight - (searchable ? 49 : 0),
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
                              option.disabled &&
                                'cursor-not-allowed opacity-50',
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
                                <span className="mt-0.5 block truncate text-[9px] capitalize text-[var(--text-subtle)]">
                                  {option.hint}
                                </span>
                              ) : null}
                            </span>

                            {option.trailing ? (
                              <span className="shrink-0">
                                {option.trailing}
                              </span>
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
            key={option.value}
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
 * ACTION MENU
 * =============================================================================
 */

function DepartmentMenu({
  menu,
  department,
  onClose,
  onEdit,
  onArchive,
}: {
  menu: MenuState;
  department: Department | null;
  onClose: () => void;
  onEdit: (department: Department) => void;
  onArchive: (department: Department) => void;
}) {
  const reduceMotion = useReducedMotion();
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const portalTheme = useContext(PortalTheme);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const open = Boolean(menu && department);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = () => onCloseRef.current();

    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        close();
      }
    };

    const frame = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus();
    });

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }

    event.preventDefault();
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]',
      ) ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
      items.length;
    items[next]?.focus();
  };

  if (!isClient) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {menu && department ? (
        <motion.div
          ref={panelRef}
          key={menu.id}
          role="menu"
          aria-label={`Actions for ${department.name}`}
          onKeyDown={onKeyDown}
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.96, y: menu.placement === 'top' ? 4 : -4 }
          }
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
          transition={
            reduceMotion
              ? { duration: 0.1 }
              : { type: 'spring', stiffness: 520, damping: 34 }
          }
          style={{
            ...portalTheme,
            position: 'fixed',
            right: Math.max(8, menu.right),
            ...(menu.placement === 'top'
              ? {
                  bottom: window.innerHeight - menu.top,
                  transformOrigin: 'bottom right',
                }
              : { top: menu.top, transformOrigin: 'top right' }),
          }}
          className="z-[90] w-[200px] overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl"
        >
          <MenuButton
            icon={<Pencil size={13} />}
            onClick={() => onEdit(department)}
          >
            Edit department
          </MenuButton>

          {department.status !== 'ARCHIVED' ? (
            <MenuButton
              icon={<Archive size={13} />}
              onClick={() => onArchive(department)}
            >
              Archive department
            </MenuButton>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function MenuButton({
  children,
  icon,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[10px] font-medium text-[var(--text-muted)] outline-none transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus-visible:bg-[var(--surface-muted)] focus-visible:text-[var(--text)]"
    >
      {icon}
      {children}
    </button>
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
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 16, scale: 0.96 }
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

function IdentityTile({
  icon,
  colour,
  size = 'md',
  animateChanges = false,
}: {
  icon: string | null;
  colour: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  animateChanges?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  const config = {
    xs: {
      box: 'h-6 w-6 rounded-md',
      icon: 12,
      dot: 'h-2 w-2 border',
    },
    sm: {
      box: 'h-10 w-10 rounded-[13px]',
      icon: 16,
      dot: 'h-3 w-3 border-2',
    },
    md: {
      box: 'h-11 w-11 rounded-[15px]',
      icon: 18,
      dot: 'h-3 w-3 border-2',
    },
    lg: {
      box: 'h-14 w-14 rounded-[18px]',
      icon: 22,
      dot: 'h-3.5 w-3.5 border-2',
    },
  }[size];

  return (
    <div
      className={cx(
        'relative flex shrink-0 items-center justify-center border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]',
        config.box,
      )}
    >
      {animateChanges ? (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={icon ?? 'none'}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.6, rotate: -12 }
            }
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.6, rotate: 12 }
            }
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { type: 'spring', stiffness: 500, damping: 28 }
            }
            className="flex"
          >
            {iconForDepartment(icon, config.icon)}
          </motion.span>
        </AnimatePresence>
      ) : (
        iconForDepartment(icon, config.icon)
      )}

      <span
        className={cx(
          'absolute -bottom-0.5 -right-0.5 rounded-full border-[var(--surface)] transition-colors duration-300',
          config.dot,
          colourDotClass(colour),
        )}
      />
    </div>
  );
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: DepartmentStatus;
  compact?: boolean;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-[0.08em]',
        compact ? 'px-2 py-1 text-[7px]' : 'px-2.5 py-1 text-[8px]',
        statusClasses(status),
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {statusLabel(status)}
    </span>
  );
}

function MetaChip({
  children,
  icon,
  auto,
}: {
  children: ReactNode;
  icon?: ReactNode;
  auto?: boolean;
}) {
  return (
    <span className="inline-flex max-w-[220px] items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
      {icon}
      <span className="truncate">{children}</span>
      {auto ? (
        <Wand2
          size={9}
          className="shrink-0 text-[var(--accent)]"
          aria-label="Generated automatically"
        />
      ) : null}
    </span>
  );
}

function AutoField({
  label,
  auto,
  error,
  onReset,
  children,
}: {
  label: string;
  auto: boolean;
  error?: string;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold text-[var(--text-muted)]">
          {label}
        </span>

        {auto ? (
          <span className="inline-flex items-center gap-1 text-[8px] font-semibold text-[var(--accent)]">
            <Wand2 size={9} />
            Auto
          </span>
        ) : (
          <button
            type="button"
            onClick={onReset}
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

      {children}

      {error ? (
        <p className="mt-1 text-[9px] font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  as = 'label',
  className,
}: {
  label: string;
  children: ReactNode;
  as?: 'label' | 'div';
  className?: string;
}) {
  const Wrapper = as;

  return (
    <Wrapper className={cx('block', className)}>
      <span className="mb-1.5 block text-[9px] font-semibold text-[var(--text-muted)]">
        {label}
      </span>
      {children}
    </Wrapper>
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

function PersonAvatar({
  person,
  size = 'normal',
}: {
  person: Person | null;
  size?: 'small' | 'normal';
}) {
  const dimension =
    size === 'small' ? 'h-6 w-6 text-[7px]' : 'h-7 w-7 text-[8px]';

  if (!person) {
    return (
      <div
        className={cx(
          'flex shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]',
          dimension,
        )}
      >
        <UserRound size={size === 'small' ? 10 : 11} />
      </div>
    );
  }

  if (person.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatarUrl}
        alt=""
        className={cx(
          'shrink-0 rounded-full border-2 border-[var(--surface)] object-cover',
          dimension,
        )}
      />
    );
  }

  return (
    <div
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface-muted)] font-bold text-[var(--text-muted)]',
        dimension,
      )}
    >
      {initials(person)}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-[270px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 motion-reduce:animate-none"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[15px] bg-[var(--surface-muted)]" />
            <div className="flex-1">
              <div className="h-3 w-32 rounded bg-[var(--surface-muted)]" />
              <div className="mt-2 h-2 w-20 rounded bg-[var(--surface-muted)]" />
            </div>
          </div>
          <div className="mt-6 h-2 w-full rounded bg-[var(--surface-muted)]" />
          <div className="mt-2 h-2 w-4/5 rounded bg-[var(--surface-muted)]" />
          <div className="mt-8 h-px bg-[var(--line)]" />
          <div className="mt-5 h-8 w-full rounded-xl bg-[var(--surface-muted)]" />
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
    <div className="flex min-h-[320px] items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 py-12 text-center">
      <div className="max-w-[420px]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[15px] border border-red-500/20 bg-red-500/5 text-red-500">
          <AlertCircle size={19} />
        </div>

        <h3 className="mt-4 text-[14px] font-semibold text-[var(--text)]">
          Departments could not be loaded
        </h3>

        <p className="mt-2 text-[10px] leading-5 text-[var(--text-muted)]">
          {message}
        </p>

        <button
          type="button"
          onClick={onRetry}
          className={cx(
            'mt-5 inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--line)] px-3.5 text-[10px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)]',
            focusRing,
          )}
        >
          <RefreshCw size={13} />
          Try again
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onCreate,
  onClear,
}: {
  hasFilters: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex min-h-[340px] items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 py-12 text-center">
      <div className="max-w-[430px]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
          <Network size={21} strokeWidth={1.7} />
        </div>

        <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">
          {hasFilters
            ? 'No departments match'
            : 'Build your company structure'}
        </h3>

        <p className="mx-auto mt-2 max-w-[370px] text-[10px] leading-5 text-[var(--text-muted)]">
          {hasFilters
            ? 'Try a different search or status filter.'
            : 'Create Syntra Grid’s departments, assign leadership and prepare the structure for the Team module.'}
        </p>

        <div className="mt-5 flex items-center justify-center gap-2">
          {hasFilters ? (
            <button
              type="button"
              onClick={onClear}
              className={cx(
                'h-9 rounded-xl border border-[var(--line)] px-3.5 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)]',
                focusRing,
              )}
            >
              Clear filters
            </button>
          ) : null}

          <button
            type="button"
            onClick={onCreate}
            className={cx(
              'inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 text-[10px] font-semibold text-white transition hover:opacity-90',
              focusRing,
            )}
          >
            <Plus size={13} />
            Add department
          </button>
        </div>
      </div>
    </div>
  );
}