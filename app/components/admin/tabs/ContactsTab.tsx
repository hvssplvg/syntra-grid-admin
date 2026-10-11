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
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Cpu,
  Crown,
  Download,
  ExternalLink,
  Eye,
  Headphones,
  LayoutList,
  Loader2,
  Mail,
  MoreHorizontal,
  Package,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  Settings2,
  Star,
  StickyNote,
  UserRound,
  UserX,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type ContactRole =
  | 'GENERAL'
  | 'DECISION_MAKER'
  | 'EXECUTIVE'
  | 'OPERATIONS'
  | 'FINANCE'
  | 'TECHNICAL'
  | 'PRODUCT'
  | 'SUPPORT';

type ContactClient = {
  id: string;
  name: string;
  displayName: string | null;
  clientRef: string | null;
  logoUrl: string | null;
  status: string;
  priority: string;
  relationshipType: string;
};

type Contact = {
  id: string;
  clientId: string;
  client: ContactClient;
  firstName: string;
  lastName: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  role: ContactRole;
  primary: boolean;
  active: boolean;
  notes: string | null;
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

type ContactSummary = {
  total: number;
  active: number;
  inactive: number;
  primary: number;
  clientCount: number;
  decisionMakers: number;
  executives: number;
  finance: number;
  technical: number;
  support: number;
};

type ContactFeed = {
  summary: ContactSummary;
  contacts: Contact[];
  permissions: {
    canCreate: boolean;
  };
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

type SortMode = 'NAME_ASC' | 'NAME_DESC' | 'CLIENT' | 'RECENT';

type QuickFilter = 'ALL' | 'PRIMARY' | 'DECIDERS' | 'MISSING' | 'RECENT';

type ViewMode = 'list' | 'grouped';

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

const STORAGE_PREFIX = 'syntragrid.contacts';
const REFRESH_AFTER_MS = 60_000;
const RECENT_DAYS = 30;

const EMPTY_SUMMARY: ContactSummary = {
  total: 0,
  active: 0,
  inactive: 0,
  primary: 0,
  clientCount: 0,
  decisionMakers: 0,
  executives: 0,
  finance: 0,
  technical: 0,
  support: 0,
};

const ROLE_META: Record<ContactRole, { label: string; icon: LucideIcon }> = {
  GENERAL: { label: 'General', icon: UserRound },
  DECISION_MAKER: { label: 'Decision maker', icon: Crown },
  EXECUTIVE: { label: 'Executive', icon: BriefcaseBusiness },
  OPERATIONS: { label: 'Operations', icon: Settings2 },
  FINANCE: { label: 'Finance', icon: CircleDollarSign },
  TECHNICAL: { label: 'Technical', icon: Cpu },
  PRODUCT: { label: 'Product', icon: Package },
  SUPPORT: { label: 'Support', icon: Headphones },
};

const ROLE_ORDER: ContactRole[] = [
  'DECISION_MAKER',
  'EXECUTIVE',
  'OPERATIONS',
  'FINANCE',
  'TECHNICAL',
  'PRODUCT',
  'SUPPORT',
  'GENERAL',
];

const SORT_OPTIONS: Array<DropdownOption<SortMode>> = [
  { value: 'NAME_ASC', label: 'Name A to Z' },
  { value: 'NAME_DESC', label: 'Name Z to A' },
  { value: 'CLIENT', label: 'Client' },
  { value: 'RECENT', label: 'Recently updated' },
];

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'PRIMARY', label: 'Primary contacts' },
  { value: 'DECIDERS', label: 'Decision makers' },
  { value: 'MISSING', label: 'Missing details' },
  { value: 'RECENT', label: `Updated in ${RECENT_DAYS} days` },
];

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

function clientDisplayName(client: Pick<ContactClient, 'displayName' | 'name'>) {
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

function contactInitials(contact: Pick<Contact, 'firstName' | 'lastName' | 'name'>) {
  const fromParts = `${contact.firstName.charAt(0)}${contact.lastName.charAt(0)}`.toUpperCase();
  return fromParts || initials(contact.name);
}

function timeOf(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value: string | null | undefined) {
  const time = timeOf(value);
  if (!time) return 'Not recorded';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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
  if (days < 60) return `${Math.round(days / 7)}w ago`;

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

function isRecent(contact: Contact) {
  return Date.now() - timeOf(contact.updatedAt) <= RECENT_DAYS * 86_400_000;
}

function isMissingDetails(contact: Contact) {
  return !contact.email || !contact.phone;
}

function isDecider(contact: Contact) {
  return contact.role === 'DECISION_MAKER' || contact.role === 'EXECUTIVE';
}

function compareNames(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function contactCard(contact: Contact) {
  return [
    contact.name,
    contact.jobTitle,
    clientDisplayName(contact.client),
    contact.email,
    contact.phone,
  ]
    .filter(Boolean)
    .join('\n');
}

function csvCell(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(contacts: Contact[]) {
  const header = ['Name', 'Job title', 'Role', 'Client', 'Client ref', 'Email', 'Phone', 'Primary', 'Active', 'Updated'];

  const rows = contacts.map((contact) => [
    contact.name,
    contact.jobTitle,
    ROLE_META[contact.role]?.label ?? contact.role,
    clientDisplayName(contact.client),
    contact.client.clientRef,
    contact.email,
    contact.phone,
    contact.primary ? 'Yes' : 'No',
    contact.active ? 'Yes' : 'No',
    contact.updatedAt.slice(0, 10),
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([`﻿${contents}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function roleMeta(role: ContactRole) {
  return ROLE_META[role] ?? ROLE_META.GENERAL;
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

function useDebouncedValue<T>(value: T, delay = 160) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/* =============================================================================
 * CONTACTS TAB
 * =============================================================================
 */

export default function ContactsTab() {
  const reduceMotion = useReducedMotion();
  const themeRef = useRef<HTMLDivElement>(null);
  const themeVars = useThemeBridge(themeRef);

  const [feed, setFeed] = useState<ContactFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [clockTick, setClockTick] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);

  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = usePersistentState<'ALL' | ContactRole>(`${STORAGE_PREFIX}.role`, 'ALL');
  const [statusFilter, setStatusFilter] = usePersistentState<StatusFilter>(`${STORAGE_PREFIX}.status`, 'ACTIVE');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');
  const [sortMode, setSortMode] = usePersistentState<SortMode>(`${STORAGE_PREFIX}.sort`, 'NAME_ASC');
  const [viewMode, setViewMode] = usePersistentState<ViewMode>(`${STORAGE_PREFIX}.view`, 'list');

  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const loadContacts = useCallback(
    async (silent = false) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/admin/contacts', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        const payload = (await response.json().catch(() => null)) as (Partial<ContactFeed> & { error?: string }) | null;

        if (!response.ok || !payload || !Array.isArray(payload.contacts)) {
          throw new Error(payload?.error || 'Contacts could not be loaded.');
        }

        setFeed({
          contacts: payload.contacts,
          summary: { ...EMPTY_SUMMARY, ...(payload.summary ?? {}) },
          permissions: { canCreate: Boolean(payload.permissions?.canCreate) },
        });

        const now = new Date();
        syncRef.current = now;
        setLastSyncedAt(now);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        const message = cause instanceof Error ? cause.message : 'Contacts could not be loaded.';
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
    [notify],
  );

  useEffect(() => {
    void loadContacts();
    return () => requestRef.current?.abort();
  }, [loadContacts]);

  useEffect(() => {
    const timer = setInterval(() => setClockTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const maybeRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      const last = syncRef.current?.getTime() ?? 0;
      if (Date.now() - last < REFRESH_AFTER_MS) return;
      void loadContacts(true);
    };

    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', maybeRefresh);

    return () => {
      window.removeEventListener('focus', maybeRefresh);
      document.removeEventListener('visibilitychange', maybeRefresh);
    };
  }, [loadContacts]);

  /* ---------- Actions ---------- */

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
      if (selectedId || event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      const typing =
        !!target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

      if ((event.key === '/' && !typing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId]);

  /* ---------- Derived ---------- */

  const contacts = useMemo(() => feed?.contacts ?? [], [feed]);
  const summary = feed?.summary ?? EMPTY_SUMMARY;
  const canCreate = Boolean(feed?.permissions.canCreate);

  const clients = useMemo(() => {
    const map = new Map<string, { client: ContactClient; count: number }>();

    for (const contact of contacts) {
      const entry = map.get(contact.client.id);
      if (entry) entry.count += 1;
      else map.set(contact.client.id, { client: contact.client, count: 1 });
    }

    return Array.from(map.values()).sort((a, b) => compareNames(clientDisplayName(a.client), clientDisplayName(b.client)));
  }, [contacts]);

  useEffect(() => {
    if (clientFilter !== 'ALL' && feed && !clients.some((entry) => entry.client.id === clientFilter)) {
      setClientFilter('ALL');
    }
  }, [clientFilter, clients, feed]);

  const counts = useMemo(() => {
    const byRole = {} as Record<ContactRole, number>;
    for (const role of ROLE_ORDER) byRole[role] = 0;
    for (const contact of contacts) byRole[contact.role] = (byRole[contact.role] ?? 0) + 1;

    return {
      byRole,
      active: contacts.filter((contact) => contact.active).length,
      inactive: contacts.filter((contact) => !contact.active).length,
      primary: contacts.filter((contact) => contact.primary).length,
      deciders: contacts.filter(isDecider).length,
      missing: contacts.filter(isMissingDetails).length,
      recent: contacts.filter(isRecent).length,
    };
  }, [contacts]);

  const visibleContacts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = contacts.filter((contact) => {
      if (clientFilter !== 'ALL' && contact.clientId !== clientFilter) return false;
      if (roleFilter !== 'ALL' && contact.role !== roleFilter) return false;
      if (statusFilter === 'ACTIVE' && !contact.active) return false;
      if (statusFilter === 'INACTIVE' && contact.active) return false;
      if (quickFilter === 'PRIMARY' && !contact.primary) return false;
      if (quickFilter === 'DECIDERS' && !isDecider(contact)) return false;
      if (quickFilter === 'MISSING' && !isMissingDetails(contact)) return false;
      if (quickFilter === 'RECENT' && !isRecent(contact)) return false;
      if (!query) return true;

      return [
        contact.name,
        contact.jobTitle,
        contact.email,
        contact.phone,
        contact.client.name,
        contact.client.displayName,
        contact.client.clientRef,
        roleMeta(contact.role).label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    return filtered.sort((a, b) => {
      switch (sortMode) {
        case 'NAME_DESC':
          return compareNames(b.name, a.name);
        case 'CLIENT':
          return compareNames(clientDisplayName(a.client), clientDisplayName(b.client)) || compareNames(a.name, b.name);
        case 'RECENT':
          return timeOf(b.updatedAt) - timeOf(a.updatedAt);
        default:
          return compareNames(a.name, b.name);
      }
    });
  }, [clientFilter, contacts, quickFilter, roleFilter, search, sortMode, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, { client: ContactClient; contacts: Contact[] }>();

    for (const contact of visibleContacts) {
      const entry = map.get(contact.client.id);
      if (entry) entry.contacts.push(contact);
      else map.set(contact.client.id, { client: contact.client, contacts: [contact] });
    }

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        contacts: [...group.contacts].sort((a, b) => Number(b.primary) - Number(a.primary)),
      }))
      .sort((a, b) => compareNames(clientDisplayName(a.client), clientDisplayName(b.client)));
  }, [visibleContacts]);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedId) ?? null,
    [contacts, selectedId],
  );

  const navigationList = useMemo(
    () => (viewMode === 'grouped' ? groups.flatMap((group) => group.contacts) : visibleContacts),
    [groups, viewMode, visibleContacts],
  );

  const selectedIndex = selectedContact ? navigationList.findIndex((contact) => contact.id === selectedContact.id) : -1;

  const filtersActive =
    Boolean(searchInput) || clientFilter !== 'ALL' || roleFilter !== 'ALL' || statusFilter !== 'ACTIVE' || quickFilter !== 'ALL';

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setClientFilter('ALL');
    setRoleFilter('ALL');
    setStatusFilter('ACTIVE');
    setQuickFilter('ALL');
  }, [setRoleFilter, setStatusFilter]);

  const syncedLabel = useMemo(
    () => relativeSync(lastSyncedAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastSyncedAt, clockTick],
  );

  const exportCsv = useCallback(() => {
    if (visibleContacts.length === 0) {
      notify('error', 'Nothing to export in this view.');
      return;
    }

    downloadCsv(`syntra_grid_contacts_${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(visibleContacts));
    notify('success', `Exported ${visibleContacts.length} ${visibleContacts.length === 1 ? 'contact' : 'contacts'}`);
  }, [notify, visibleContacts]);

  const clientOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      {
        value: 'ALL',
        label: 'All clients',
        leading: <Building2 size={13} className="text-[var(--text-subtle)]" />,
        trailing: <CountPill value={contacts.length} />,
      },
      ...clients.map(({ client, count }) => ({
        value: client.id,
        label: clientDisplayName(client),
        keywords: [client.name, client.clientRef].filter(Boolean).join(' '),
        leading: <ClientLogo client={client} size="xs" />,
        trailing: <CountPill value={count} />,
      })),
    ],
    [clients, contacts.length],
  );

  const roleOptions = useMemo<Array<DropdownOption<'ALL' | ContactRole>>>(
    () => [
      { value: 'ALL', label: 'All roles', leading: <Users size={13} className="text-[var(--text-subtle)]" /> },
      ...ROLE_ORDER.map((role) => {
        const Icon = ROLE_META[role].icon;
        return {
          value: role,
          label: ROLE_META[role].label,
          leading: <Icon size={13} className="text-[var(--text-subtle)]" />,
          trailing: <CountPill value={counts.byRole[role] ?? 0} />,
        };
      }),
    ],
    [counts.byRole],
  );

  const statusOptions: Array<DropdownOption<StatusFilter>> = [
    {
      value: 'ACTIVE',
      label: 'Active',
      leading: <span className="h-2 w-2 rounded-full bg-[var(--success,#16a34a)]" />,
      trailing: <CountPill value={counts.active} />,
    },
    {
      value: 'INACTIVE',
      label: 'Inactive',
      leading: <span className="h-2 w-2 rounded-full bg-[var(--text-subtle)]" />,
      trailing: <CountPill value={counts.inactive} />,
    },
    {
      value: 'ALL',
      label: 'Any status',
      leading: <span className="h-2 w-2 rounded-full border border-[var(--text-subtle)]" />,
      trailing: <CountPill value={contacts.length} />,
    },
  ];

  const quickCounts: Record<QuickFilter, number | undefined> = {
    ALL: undefined,
    PRIMARY: counts.primary,
    DECIDERS: counts.deciders,
    MISSING: counts.missing,
    RECENT: counts.recent,
  };

  const menuFor = useCallback(
    (contact: Contact): MenuItem[] => {
      const items: MenuItem[] = [
        { key: 'view', label: 'View contact', icon: <Eye size={13} />, onSelect: () => setSelectedId(contact.id) },
      ];

      if (contact.email) {
        items.push(
          { key: 'email', label: 'Send email', icon: <Mail size={13} />, href: `mailto:${contact.email}` },
          {
            key: 'copy-email',
            label: 'Copy email',
            icon: <Copy size={13} />,
            onSelect: () => void copyValue(contact.email ?? '', 'Email copied'),
          },
        );
      }

      if (contact.phone) {
        items.push(
          { key: 'call', label: 'Call', icon: <Phone size={13} />, href: telHref(contact.phone) },
          {
            key: 'copy-phone',
            label: 'Copy phone',
            icon: <Copy size={13} />,
            onSelect: () => void copyValue(contact.phone ?? '', 'Phone number copied'),
          },
        );
      }

      if (contact.permissions.canEdit) {
        items.push({ key: 'edit', label: 'Edit contact', icon: <Pencil size={13} />, disabled: true, badge: 'Soon' });
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
    body = <ErrorState title="Contacts could not be loaded" message={error} onRetry={() => void loadContacts()} />;
  } else if (contacts.length === 0) {
    body = (
      <EmptyState
        icon={<Users size={21} strokeWidth={1.7} />}
        title="No contacts yet"
        description="Contacts are the people behind each client relationship. Add them from a client record and they will appear here automatically."
      />
    );
  } else if (visibleContacts.length === 0) {
    body = (
      <EmptyState
        icon={<Search size={20} strokeWidth={1.7} />}
        title={searchInput ? `Nothing matches "${searchInput}"` : 'No contacts match these filters'}
        description="Try a different search, or clear the filters to see everyone."
        action={
          <SecondaryButton onClick={resetFilters}>
            <X size={13} />
            Clear filters
          </SecondaryButton>
        }
      />
    );
  } else if (viewMode === 'grouped') {
    body = (
      <div className={cx('space-y-3', refreshing && 'opacity-80 transition-opacity')}>
        <AnimatePresence mode="popLayout" initial={false}>
          {groups.map((group) => (
            <motion.section
              key={group.client.id}
              layout={!reduceMotion}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 380, damping: 34 }}
              className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm"
            >
              <header className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 sm:px-5">
                <ClientLogo client={group.client} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-[var(--text)]">{clientDisplayName(group.client)}</p>
                  <p className="mt-0.5 truncate text-[9px] text-[var(--text-subtle)]">
                    {[group.client.clientRef, prettyEnum(group.client.relationshipType)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[9px] font-semibold tabular-nums text-[var(--text-muted)]">
                  {group.contacts.length} {group.contacts.length === 1 ? 'person' : 'people'}
                </span>
              </header>

              <div className="divide-y divide-[var(--line)]">
                {group.contacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    hideClient
                    menuItems={menuFor(contact)}
                    onOpen={() => setSelectedId(contact.id)}
                    onCopy={copyValue}
                  />
                ))}
              </div>
            </motion.section>
          ))}
        </AnimatePresence>
      </div>
    );
  } else {
    body = (
      <section
        className={cx(
          'overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm',
          refreshing && 'opacity-80 transition-opacity',
        )}
      >
        <div className={cx('hidden gap-4 border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-3 lg:grid', LIST_GRID)}>
          {['Contact', 'Client', 'Reach', 'Role', 'Updated', ''].map((label) => (
            <p key={label || 'actions'} className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
              {label}
            </p>
          ))}
        </div>

        <div className="divide-y divide-[var(--line)]">
          <AnimatePresence initial={false}>
            {visibleContacts.map((contact) => (
              <motion.div
                key={contact.id}
                layout={!reduceMotion ? 'position' : false}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
              >
                <ContactRow
                  contact={contact}
                  menuItems={menuFor(contact)}
                  onOpen={() => setSelectedId(contact.id)}
                  onCopy={copyValue}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
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
                label: 'Contacts',
                value: summary.total || contacts.length,
                helper: `Across ${summary.clientCount || clients.length} ${(summary.clientCount || clients.length) === 1 ? 'client' : 'clients'}`,
                icon: Users,
              },
              {
                label: 'Active',
                value: summary.active,
                helper: summary.total > 0 ? `${Math.round((summary.active / summary.total) * 100)}% reachable` : 'No contacts',
                icon: CheckCircle2,
                active: statusFilter === 'ACTIVE' && quickFilter === 'ALL',
                onClick: () => {
                  setStatusFilter('ACTIVE');
                  setQuickFilter('ALL');
                },
              },
              {
                label: 'Primary',
                value: summary.primary,
                helper: 'Main point of contact',
                icon: Star,
                active: quickFilter === 'PRIMARY',
                onClick: () => setQuickFilter((current) => (current === 'PRIMARY' ? 'ALL' : 'PRIMARY')),
              },
              {
                label: 'Decision makers',
                value: summary.decisionMakers + summary.executives,
                helper: `${summary.executives} ${summary.executives === 1 ? 'executive' : 'executives'}`,
                icon: Crown,
                active: quickFilter === 'DECIDERS',
                onClick: () => setQuickFilter((current) => (current === 'DECIDERS' ? 'ALL' : 'DECIDERS')),
              },
              {
                label: 'Finance',
                value: summary.finance,
                helper: 'Billing and invoices',
                icon: CircleDollarSign,
                active: roleFilter === 'FINANCE',
                onClick: () => setRoleFilter((current) => (current === 'FINANCE' ? 'ALL' : 'FINANCE')),
              },
              {
                label: 'Missing details',
                value: counts.missing,
                helper: 'No email or phone',
                icon: AlertCircle,
                highlight: counts.missing > 0,
                active: quickFilter === 'MISSING',
                onClick: () => setQuickFilter((current) => (current === 'MISSING' ? 'ALL' : 'MISSING')),
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
                  placeholder="Search people, clients, roles, email or phone"
                  aria-label="Search contacts"
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
                  <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline-flex">
                    <Kbd>/</Kbd>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Dropdown
                  value={clientFilter}
                  onChange={setClientFilter}
                  options={clientOptions}
                  ariaLabel="Filter by client"
                  searchable
                  searchPlaceholder="Find a client"
                  emptyText="No clients match"
                  loading={loading && !feed}
                  triggerClassName="col-span-2 sm:col-span-1 sm:w-[190px]"
                  minWidth={250}
                />
                <Dropdown value={roleFilter} onChange={setRoleFilter} options={roleOptions} ariaLabel="Filter by role" triggerClassName="sm:w-[160px]" minWidth={220} />
                <Dropdown value={statusFilter} onChange={setStatusFilter} options={statusOptions} ariaLabel="Filter by status" triggerClassName="sm:w-[130px]" minWidth={190} />
                <Dropdown value={sortMode} onChange={setSortMode} options={SORT_OPTIONS} ariaLabel="Sort contacts" triggerClassName="col-span-2 sm:col-span-1 sm:w-[170px]" minWidth={200} />
              </div>

              <div className="flex items-center justify-end gap-2 2xl:ml-auto">
                <Segmented
                  value={viewMode}
                  onChange={setViewMode}
                  ariaLabel="Layout"
                  options={[
                    { value: 'list', label: 'List', leading: <LayoutList size={13} /> },
                    { value: 'grouped', label: 'By client', leading: <Rows3 size={13} /> },
                  ]}
                />

                <ToolbarIcon label="Export this view as CSV" onClick={exportCsv}>
                  <Download size={14} strokeWidth={1.9} />
                </ToolbarIcon>

                <ToolbarIcon label="Refresh contacts" onClick={() => void loadContacts(true)} disabled={refreshing || loading}>
                  <RefreshCw size={14} strokeWidth={1.9} className={cx(refreshing && 'animate-spin')} />
                </ToolbarIcon>

                {canCreate ? (
                  <button
                    type="button"
                    disabled
                    title="Adding contacts from this tab is on the way. For now, add people from the client record."
                    className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-xl bg-[var(--accent)] pl-4 pr-2.5 text-[11px] font-semibold text-white opacity-60 shadow-sm"
                  >
                    <Plus size={15} strokeWidth={2} />
                    Add contact
                    <span className="ml-1 rounded-md bg-white/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em]">Soon</span>
                  </button>
                ) : null}
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
                    {active && item.value !== 'ALL' ? <Check size={11} className="text-[var(--accent)]" /> : null}
                    {item.label}
                    {typeof count === 'number' && count > 0 ? <span className="tabular-nums text-[var(--text-subtle)]">{count}</span> : null}
                  </button>
                );
              })}

              <div className="ml-auto flex items-center gap-3 text-[10px] text-[var(--text-subtle)]">
                <span aria-live="polite">
                  <span className="font-semibold text-[var(--text)]">{visibleContacts.length}</span>
                  {filtersActive && contacts.length > 0 ? ` of ${contacts.length}` : ''} {visibleContacts.length === 1 ? 'contact' : 'contacts'}
                </span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">{syncedLabel}</span>
                {filtersActive ? (
                  <button type="button" onClick={resetFilters} className={cx('rounded font-semibold text-[var(--accent)] hover:opacity-80', focusRing)}>
                    Reset
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5">{body}</div>

        <ContactModal
          contact={selectedContact}
          position={selectedIndex >= 0 ? { index: selectedIndex, total: navigationList.length } : null}
          siblings={selectedContact ? contacts.filter((item) => item.clientId === selectedContact.clientId && item.id !== selectedContact.id) : []}
          onClose={() => setSelectedId(null)}
          onPrevious={selectedIndex > 0 ? () => setSelectedId(navigationList[selectedIndex - 1].id) : undefined}
          onNext={selectedIndex >= 0 && selectedIndex < navigationList.length - 1 ? () => setSelectedId(navigationList[selectedIndex + 1].id) : undefined}
          onSelect={setSelectedId}
          onCopy={copyValue}
        />

        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </PortalTheme.Provider>
  );
}

function prettyEnum(value: string | null | undefined) {
  if (!value) return '';
  return value
    .toLowerCase()
    .split('_')
    .map((part, index) => (index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
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

/* =============================================================================
 * CONTACT ROW
 * =============================================================================
 */

const LIST_GRID = 'lg:grid-cols-[minmax(230px,1.5fr)_minmax(170px,1fr)_minmax(190px,1.1fr)_130px_90px_40px]';

function ContactRow({
  contact,
  hideClient = false,
  menuItems,
  onOpen,
  onCopy,
}: {
  contact: Contact;
  hideClient?: boolean;
  menuItems: MenuItem[];
  onOpen: () => void;
  onCopy: (value: string, message: string) => void;
}) {
  const gridClass = hideClient
    ? 'lg:grid-cols-[minmax(230px,1.5fr)_minmax(190px,1.1fr)_130px_90px_40px]'
    : LIST_GRID;

  return (
    <div
      className={cx(
        'group grid gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-muted)] sm:px-5 lg:items-center lg:gap-4',
        gridClass,
        !contact.active && 'opacity-70',
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <button type="button" onClick={onOpen} className={cx('flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left', focusRing)}>
          <ContactAvatar contact={contact} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[11.5px] font-semibold text-[var(--text)] group-hover:text-[var(--text)]">{contact.name}</p>
              {contact.primary ? <PrimaryMark /> : null}
              {!contact.active ? <InactiveBadge /> : null}
            </div>
            <p className="mt-0.5 truncate text-[9.5px] text-[var(--text-subtle)]">
              {contact.jobTitle || roleMeta(contact.role).label}
              {!hideClient ? <span className="lg:hidden"> · {clientDisplayName(contact.client)}</span> : null}
            </p>
          </div>
        </button>

        <div className="lg:hidden">
          <ActionMenu label={`Actions for ${contact.name}`} items={menuItems} />
        </div>
      </div>

      {!hideClient ? (
        <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
          <ClientLogo client={contact.client} size="xs" />
          <div className="min-w-0">
            <p className="truncate text-[10.5px] font-medium text-[var(--text)]">{clientDisplayName(contact.client)}</p>
            {contact.client.clientRef ? <p className="mt-0.5 truncate text-[8.5px] text-[var(--text-subtle)]">{contact.client.clientRef}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="hidden min-w-0 space-y-1 lg:block">
        {contact.email ? (
          <CopyLine icon={<Mail size={11} />} value={contact.email} label="Email" onCopy={onCopy} />
        ) : null}
        {contact.phone ? (
          <CopyLine icon={<Phone size={11} />} value={contact.phone} label="Phone number" onCopy={onCopy} />
        ) : null}
        {!contact.email && !contact.phone ? (
          <span className="inline-flex items-center gap-1.5 text-[9.5px] text-[var(--warning,#b45309)]">
            <AlertCircle size={11} />
            No contact details
          </span>
        ) : null}
      </div>

      <div className="hidden lg:block">
        <RoleBadge role={contact.role} />
      </div>

      <p className="hidden text-[10px] tabular-nums text-[var(--text-subtle)] lg:block" title={formatDate(contact.updatedAt)}>
        {relativeTime(contact.updatedAt)}
      </p>

      <div className="hidden justify-end lg:flex">
        <ActionMenu label={`Actions for ${contact.name}`} items={menuItems} />
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-12 lg:hidden">
        <RoleBadge role={contact.role} />
        {contact.email ? (
          <a href={`mailto:${contact.email}`} className={cx('inline-flex h-6 items-center gap-1 rounded-full border border-[var(--line)] px-2 text-[9px] font-semibold text-[var(--text-muted)]', focusRing)}>
            <Mail size={10} />
            Email
          </a>
        ) : null}
        {contact.phone ? (
          <a href={telHref(contact.phone)} className={cx('inline-flex h-6 items-center gap-1 rounded-full border border-[var(--line)] px-2 text-[9px] font-semibold text-[var(--text-muted)]', focusRing)}>
            <Phone size={10} />
            Call
          </a>
        ) : null}
      </div>
    </div>
  );
}

function CopyLine({
  icon,
  value,
  label,
  onCopy,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  onCopy: (value: string, message: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value, `${label} copied`)}
      title={`Copy ${label.toLowerCase()}`}
      className={cx('group/copy flex max-w-full items-center gap-1.5 rounded-md text-left text-[9.5px] text-[var(--text-muted)] transition hover:text-[var(--text)]', focusRing)}
    >
      <span className="shrink-0 text-[var(--text-subtle)]">{icon}</span>
      <span className="truncate">{value}</span>
      <Copy size={10} className="shrink-0 opacity-0 transition group-hover/copy:opacity-60 group-focus-visible/copy:opacity-60" />
    </button>
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
 * CONTACT MODAL
 * =============================================================================
 */

function ContactModal({
  contact,
  position,
  siblings,
  onClose,
  onPrevious,
  onNext,
  onSelect,
  onCopy,
}: {
  contact: Contact | null;
  position: { index: number; total: number } | null;
  siblings: Contact[];
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSelect: (id: string) => void;
  onCopy: (value: string, message: string) => void;
}) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();

  // Keep the last contact while the exit animation plays.
  const [shown, setShown] = useState<Contact | null>(contact);
  useEffect(() => {
    if (contact) setShown(contact);
  }, [contact]);

  useEffect(() => {
    if (!contact) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (event.key === 'ArrowLeft' && onPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === 'ArrowRight' && onNext) {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [contact, onNext, onPrevious]);

  const view = contact ?? shown;

  return (
    <ModalShell open={Boolean(contact)} onClose={onClose} labelledBy={titleId} size="lg">
      {view ? (
        <div className="flex max-h-[min(88vh,820px)] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3 sm:px-6">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
              <UserRound size={12} />
              Contact
              {position ? (
                <span className="font-semibold normal-case tracking-normal tabular-nums">
                  {position.index + 1} of {position.total}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              <NavButton label="Previous contact" onClick={onPrevious}>
                <ChevronLeft size={15} />
              </NavButton>
              <NavButton label="Next contact" onClick={onNext}>
                <ChevronRight size={15} />
              </NavButton>
              <span className="mx-1 h-5 w-px bg-[var(--line)]" />
              <IconButton label="Close" onClick={onClose}>
                <X size={15} />
              </IconButton>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view.id}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="px-5 pb-6 pt-5 sm:px-6"
              >
                <div className="flex items-start gap-4">
                  <ContactAvatar contact={view} size="lg" />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id={titleId} className="text-[19px] font-semibold tracking-[-0.03em] text-[var(--text)]">
                        {view.name}
                      </h2>
                      {view.primary ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
                          <Star size={9} fill="currentColor" />
                          Primary
                        </span>
                      ) : null}
                      {view.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--success-border,rgba(22,163,74,0.25))] bg-[var(--success-soft,rgba(22,163,74,0.08))] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[var(--success,#16a34a)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          Active
                        </span>
                      ) : (
                        <InactiveBadge />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {[view.jobTitle, clientDisplayName(view.client)].filter(Boolean).join(' at ')}
                    </p>
                    <div className="mt-2.5">
                      <RoleBadge role={view.role} />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <QuickAction icon={<Mail size={15} />} label="Email" href={view.email ? `mailto:${view.email}` : undefined} />
                  <QuickAction icon={<Phone size={15} />} label="Call" href={view.phone ? telHref(view.phone) : undefined} />
                  <QuickAction
                    icon={<Copy size={15} />}
                    label="Copy email"
                    onClick={view.email ? () => onCopy(view.email ?? '', 'Email copied') : undefined}
                  />
                  <QuickAction icon={<UserRound size={15} />} label="Copy card" onClick={() => onCopy(contactCard(view), 'Contact card copied')} />
                </div>

                <div className="mt-5 overflow-hidden rounded-[18px] border border-[var(--line)]">
                  <DetailLine icon={<Mail size={13} />} label="Email" value={view.email} onCopy={view.email ? () => onCopy(view.email ?? '', 'Email copied') : undefined} />
                  <DetailLine icon={<Phone size={13} />} label="Phone" value={view.phone} onCopy={view.phone ? () => onCopy(view.phone ?? '', 'Phone number copied') : undefined} />
                  <DetailLine
                    icon={<Building2 size={13} />}
                    label="Client"
                    value={[clientDisplayName(view.client), view.client.clientRef].filter(Boolean).join(' · ')}
                  />
                  <DetailLine icon={<BriefcaseBusiness size={13} />} label="Relationship" value={prettyEnum(view.client.relationshipType) || null} last />
                </div>

                {isMissingDetails(view) ? (
                  <div className="mt-3 flex items-start gap-2.5 rounded-[14px] border border-[var(--warning-border,rgba(180,83,9,0.25))] bg-[var(--warning-soft,rgba(180,83,9,0.06))] px-3.5 py-3 text-[10px] leading-5 text-[var(--warning,#b45309)]">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      {!view.email && !view.phone
                        ? 'No email or phone number on file. Add one so the team can reach this person.'
                        : !view.email
                          ? 'No email address on file yet.'
                          : 'No phone number on file yet.'}
                    </span>
                  </div>
                ) : null}

                {view.notes ? (
                  <div className="mt-5">
                    <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                      <StickyNote size={11} />
                      Notes
                    </p>
                    <p className="mt-2 whitespace-pre-wrap rounded-[14px] bg-[var(--surface-muted)] px-4 py-3 text-[11px] leading-6 text-[var(--text-muted)]">
                      {view.notes}
                    </p>
                  </div>
                ) : null}

                {siblings.length > 0 ? (
                  <div className="mt-5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                      Also at {clientDisplayName(view.client)}
                    </p>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {siblings.slice(0, 6).map((sibling) => (
                        <button
                          key={sibling.id}
                          type="button"
                          onClick={() => onSelect(sibling.id)}
                          className={cx(
                            'flex min-w-0 items-center gap-2.5 rounded-[14px] border border-[var(--line)] px-3 py-2.5 text-left transition hover:border-[color:var(--accent)]/40 hover:bg-[var(--surface-muted)]',
                            focusRing,
                          )}
                        >
                          <ContactAvatar contact={sibling} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 truncate text-[10.5px] font-semibold text-[var(--text)]">
                              <span className="truncate">{sibling.name}</span>
                              {sibling.primary ? <PrimaryMark /> : null}
                            </p>
                            <p className="truncate text-[9px] text-[var(--text-subtle)]">{sibling.jobTitle || roleMeta(sibling.role).label}</p>
                          </div>
                          <ChevronRight size={13} className="shrink-0 text-[var(--text-subtle)]" />
                        </button>
                      ))}
                    </div>
                    {siblings.length > 6 ? (
                      <p className="mt-2 text-[9px] text-[var(--text-subtle)]">and {siblings.length - 6} more</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[9.5px] text-[var(--text-subtle)]">
                  <span>Added {formatDate(view.createdAt)}</span>
                  <span>Updated {relativeTime(view.updatedAt)}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--surface-muted)] px-5 py-3 sm:px-6">
            <p className="hidden items-center gap-1.5 text-[9.5px] text-[var(--text-subtle)] sm:flex">
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
              to move between contacts
            </p>
            <div className="ml-auto flex items-center gap-2">
              {view.permissions.canEdit ? (
                <button
                  type="button"
                  disabled
                  title="Editing contacts from this tab is on the way."
                  className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[10px] font-semibold text-[var(--text-muted)] opacity-60"
                >
                  <Pencil size={12} />
                  Edit
                  <span className="rounded bg-[var(--surface-muted)] px-1 text-[8px] font-bold uppercase">Soon</span>
                </button>
              ) : null}
              <button
                type="button"
                data-autofocus
                onClick={onClose}
                className={cx('inline-flex h-9 items-center rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90', focusRing)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      title={label}
      className={cx(
        'flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-30',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function QuickAction({
  icon,
  label,
  href,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className = cx(
    'flex flex-col items-center justify-center gap-1.5 rounded-[16px] border border-[var(--line)] px-3 py-3 text-[10px] font-semibold transition',
    href || onClick
      ? 'text-[var(--text)] hover:-translate-y-px hover:border-[color:var(--accent)]/40 hover:bg-[var(--surface-muted)] motion-reduce:hover:translate-y-0'
      : 'pointer-events-none text-[var(--text-subtle)] opacity-50',
    focusRing,
  );

  const content = (
    <>
      <span className={cx(href || onClick ? 'text-[var(--accent)]' : '')}>{icon}</span>
      {label}
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={!onClick} aria-disabled={!onClick || undefined} className={className}>
      {content}
    </button>
  );
}

function DetailLine({
  icon,
  label,
  value,
  onCopy,
  last = false,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
  onCopy?: () => void;
  last?: boolean;
}) {
  return (
    <div className={cx('flex items-center gap-3 px-4 py-3', !last && 'border-b border-[var(--line)]')}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-muted)] text-[var(--text-subtle)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">{label}</p>
        <p className={cx('mt-0.5 truncate text-[11px]', value ? 'font-medium text-[var(--text)]' : 'text-[var(--text-subtle)]')}>{value || 'Not provided'}</p>
      </div>
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]', focusRing)}
        >
          <Copy size={13} />
        </button>
      ) : null}
    </div>
  );
}

/* =============================================================================
 * VISUAL HELPERS
 * =============================================================================
 */

function ContactAvatar({ contact, size = 'md' }: { contact: Contact; size?: 'sm' | 'md' | 'lg' }) {
  const box = {
    sm: 'h-8 w-8 text-[9px]',
    md: 'h-9 w-9 text-[10px]',
    lg: 'h-14 w-14 text-[15px]',
  }[size];

  const letters = contactInitials(contact);

  return (
    <span
      className={cx(
        'relative flex shrink-0 items-center justify-center rounded-full border font-semibold',
        contact.primary
          ? 'border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 text-[var(--accent)]'
          : 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
        box,
      )}
    >
      {letters || <UserRound size={size === 'lg' ? 20 : 14} />}
      {!contact.active ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--surface)] bg-[var(--surface-muted)] text-[var(--text-subtle)]">
          <UserX size={8} />
        </span>
      ) : null}
    </span>
  );
}

function ClientLogo({ client, size = 'sm' }: { client: Pick<ContactClient, 'logoUrl' | 'displayName' | 'name'>; size?: 'xs' | 'sm' }) {
  const box = { xs: 'h-6 w-6 rounded-[8px] text-[8px]', sm: 'h-9 w-9 rounded-[11px] text-[10px]' }[size];

  if (client.logoUrl) {
    return (
      <span className={cx('shrink-0 overflow-hidden border border-[var(--line)] bg-white', box)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={client.logoUrl} alt="" className="h-full w-full object-contain p-1" />
      </span>
    );
  }

  const letters = initials(clientDisplayName(client));

  return (
    <span className={cx('flex shrink-0 items-center justify-center border border-[var(--line)] bg-[var(--surface-muted)] font-bold text-[var(--text)]', box)}>
      {letters || <Building2 size={size === 'xs' ? 11 : 14} className="text-[var(--text-subtle)]" />}
    </span>
  );
}

function RoleBadge({ role }: { role: ContactRole }) {
  const meta = roleMeta(role);
  const Icon = meta.icon;
  const emphasised = role === 'DECISION_MAKER' || role === 'EXECUTIVE';

  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold',
        emphasised
          ? 'border-[color:var(--accent)]/30 bg-[color:var(--accent)]/[0.08] text-[var(--text)]'
          : 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
      )}
    >
      <Icon size={10} className={cx('shrink-0', emphasised ? 'text-[var(--accent)]' : 'text-[var(--text-subtle)]')} />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

function PrimaryMark() {
  return (
    <span title="Primary contact" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)]/12 text-[var(--accent)]">
      <Star size={8} fill="currentColor" strokeWidth={1.5} />
      <span className="sr-only">Primary contact</span>
    </span>
  );
}

function InactiveBadge() {
  return (
    <span className="shrink-0 rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
      Inactive
    </span>
  );
}

function LoadingState() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)]">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-4 border-b border-[var(--line)] px-5 py-4 last:border-b-0 motion-reduce:animate-none">
          <div className="h-9 w-9 rounded-full bg-[var(--surface-muted)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 max-w-full rounded bg-[var(--surface-muted)]" />
            <div className="h-2.5 w-24 rounded bg-[var(--surface-muted)]" />
          </div>
          <div className="hidden h-3 w-32 rounded bg-[var(--surface-muted)] lg:block" />
          <div className="hidden h-6 w-24 rounded-full bg-[var(--surface-muted)] lg:block" />
        </div>
      ))}
    </div>
  );
}

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