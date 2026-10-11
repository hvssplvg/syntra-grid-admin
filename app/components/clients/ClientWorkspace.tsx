/* eslint-disable react-hooks/purity */
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
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useSWRConfig } from 'swr';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Code2,
  ContactRound,
  Copy,
  ExternalLink,
  FileText,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  Network,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

import { CLIENTS_ENDPOINT } from '@/lib/clients/clientsApi';
import { LogoUploader } from '@/lib/clients/LogoUploader';
import { deleteClientLogo } from '@/lib/clients/uploadClientLogo';

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
  active?: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ProjectCount = {
  integrations?: number;
  deployments?: number;
  healthChecks?: number;
  incidents?: number;
  tickets?: number;
};

type ClientProject = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: string;
  category: string;
  productionUrl?: string | null;
  adminUrl?: string | null;
  repositoryUrl?: string | null;
  hostingProvider?: string | null;
  databaseType?: string | null;
  framework?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: ProjectCount;
};

type ClientBilling = {
  id: string;
  lastInvoiceRef: string | null;
  lastInvoiceAt: string | null;
  lastInvoiceStatus: string | null;
  outstandingAmount: string;
  totalPaid: string;
  createdAt: string;
  updatedAt: string;
};

type ClientInvoice = {
  id: string;
  invoiceRef: string;
  status: string;
  description: string | null;
  currency: string;
  subtotal: string;
  tax: string;
  total: string;
  paid: string;
  balance: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  accountOwner: AccountOwner | null;
  contacts: ClientContact[];
  projects: ClientProject[];
  billing?: ClientBilling | null;
  invoices?: ClientInvoice[];
  _count: {
    contacts: number;
    projects: number;
    tickets: number;
    invoices: number;
  };
  openSupportCount?: number;
};

type ClientResponse = {
  ok: boolean;
  client?: ClientRecord;
  error?: string;
};

type WorkspaceTab =
  | 'overview'
  | 'contacts'
  | 'projects'
  | 'commercial'
  | 'support'
  | 'meetings'
  | 'systems'
  | 'documents';

type ClientWorkspaceProps = {
  clientId: string;
  onBack: () => void;
  accountOwners: AccountOwner[];
  optionsLoading: boolean;
};

type ToastState = {
  id: number;
  tone: 'success' | 'error';
  message: string;
} | null;

type Notify = (tone: 'success' | 'error', message: string) => void;

type Tone = 'neutral' | 'green' | 'amber' | 'blue' | 'red' | 'purple';

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'contacts', label: 'Contacts', icon: ContactRound },
  { id: 'projects', label: 'Projects', icon: BriefcaseBusiness },
  { id: 'commercial', label: 'Commercial', icon: CircleDollarSign },
  { id: 'systems', label: 'Systems', icon: Server },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'meetings', label: 'Meetings', icon: MessageSquareText },
  { id: 'documents', label: 'Documents', icon: FileText },
];

const TONES: Record<Tone, { badge: string; dot: string }> = {
  neutral: { badge: 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]', dot: 'bg-[var(--text-subtle)]' },
  green: {
    badge: 'border-[color:var(--success-border,rgba(16,185,129,0.25))] bg-[var(--success-soft,rgba(16,185,129,0.1))] text-[var(--success,#047857)]',
    dot: 'bg-[var(--success,#10b981)]',
  },
  amber: {
    badge: 'border-[color:var(--warning-border,rgba(245,158,11,0.25))] bg-[var(--warning-soft,rgba(245,158,11,0.1))] text-[var(--warning,#b45309)]',
    dot: 'bg-[var(--warning,#f59e0b)]',
  },
  blue: { badge: 'border-blue-500/20 bg-blue-500/10 text-blue-700', dot: 'bg-blue-500' },
  red: { badge: 'border-red-500/20 bg-red-500/10 text-red-700', dot: 'bg-red-500' },
  purple: { badge: 'border-violet-500/20 bg-violet-500/10 text-violet-700', dot: 'bg-violet-500' },
};

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

function contactName(contact: ClientContact) {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';

  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatMoney(value: string | number | null | undefined, currency: string) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'Not set';

  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
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

function renewalText(value: string | null | undefined) {
  const days = daysUntil(value);
  if (days === null) return 'No renewal date';
  if (days < 0) return `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`;
  if (days === 0) return 'Renews today';
  if (days === 1) return 'Renews tomorrow';
  if (days <= 60) return `Renews in ${days} days`;
  return formatDate(value);
}

function relativeTime(value: string | null | undefined) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

function clientStatusTone(status: ClientStatus): Tone {
  switch (status) {
    case 'ACTIVE':
      return 'green';
    case 'ONBOARDING':
      return 'blue';
    case 'LEAD':
      return 'purple';
    case 'PAUSED':
      return 'amber';
    default:
      return 'neutral';
  }
}

function genericTone(status: string): Tone {
  const value = status.toUpperCase();
  if (['ACTIVE', 'LIVE', 'PAID', 'COMPLETED', 'HEALTHY', 'SUCCEEDED', 'READY'].includes(value)) return 'green';
  if (['OVERDUE', 'FAILED', 'CANCELLED', 'VOID', 'DOWN', 'ERROR'].includes(value)) return 'red';
  if (['PENDING', 'PARTIALLY_PAID', 'DRAFT', 'PAUSED', 'ON_HOLD', 'DEGRADED'].includes(value)) return 'amber';
  if (['SENT', 'IN_PROGRESS', 'BUILDING', 'PLANNING', 'IN_DEVELOPMENT'].includes(value)) return 'blue';
  return 'neutral';
}

function safeHref(value: string | null | undefined) {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/* =============================================================================
 * WORKSPACE
 * =============================================================================
 */

export default function ClientWorkspace({ clientId, onBack, accountOwners, optionsLoading }: ClientWorkspaceProps) {
  const reduceMotion = useReducedMotion();
  const theme = useThemeBridge();
  const tabsId = useId();
  const { mutate: mutateGlobal } = useSWRConfig();

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const requestRef = useRef<AbortController | null>(null);

  const notify = useCallback<Notify>((tone, message) => {
    setToast({ id: Date.now(), tone, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadClient = useCallback(
    async (silent = false) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        const payload = (await response.json().catch(() => ({ ok: false }))) as ClientResponse;

        if (!response.ok || !payload.ok || !payload.client) {
          throw new Error(payload.error || 'This client could not be loaded.');
        }

        setClient(payload.client);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        const message = cause instanceof Error ? cause.message : 'This client could not be loaded.';
        if (silent) notify('error', message);
        else setError(message);
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [clientId, notify],
  );

  useEffect(() => {
    void loadClient();
    return () => requestRef.current?.abort();
  }, [loadClient]);

  const handleClientSaved = useCallback(
    (updated: ClientRecord) => {
      setClient(updated);
      setEditOpen(false);
      notify('success', 'Client updated');

      // Keep the Clients tab's SWR cache in sync without waiting for its
      // next revalidation. Only the fields this form can change are
      // patched in — counts/contacts/projects on the list are untouched
      // since this edit never changes them.
      const patch = {
        name: updated.name,
        displayName: updated.displayName,
        description: updated.description,
        industry: updated.industry,
        country: updated.country,
        city: updated.city,
        logoUrl: updated.logoUrl,
        websiteUrl: updated.websiteUrl,
        status: updated.status,
        priority: updated.priority,
        relationshipType: updated.relationshipType,
        relationshipStartedAt: updated.relationshipStartedAt,
        liveSince: updated.liveSince,
        domain: updated.domain,
        adminUrl: updated.adminUrl,
        billingCycle: updated.billingCycle,
        contractValue: updated.contractValue,
        currency: updated.currency,
        renewalAt: updated.renewalAt,
        integrationLive: updated.integrationLive,
        accountOwner: updated.accountOwner,
        updatedAt: updated.updatedAt,
      };

      void mutateGlobal(
        CLIENTS_ENDPOINT,
        (current: { clients: Array<Record<string, unknown>> } | undefined) =>
          current
            ? {
                ...current,
                clients: current.clients.map((item) =>
                  (item as { id?: string }).id === updated.id ? { ...item, ...patch } : item,
                ),
              }
            : current,
        { revalidate: false },
      );
      void mutateGlobal(CLIENTS_ENDPOINT);
    },
    [mutateGlobal, notify],
  );

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

  const totals = useMemo(() => {
    const sum = (key: keyof ProjectCount) =>
      (client?.projects ?? []).reduce((total, project) => total + (project._count?.[key] ?? 0), 0);

    return {
      systems: sum('integrations'),
      incidents: sum('incidents'),
      deployments: sum('deployments'),
      healthChecks: sum('healthChecks'),
    };
  }, [client]);

  const backButton = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        className={cx(
          'inline-flex items-center gap-1.5 rounded-lg px-1 text-[11px] font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]',
          focusRing,
        )}
      >
        <ArrowLeft size={14} />
        All clients
      </button>

      {client ? (
        <p className="hidden items-center gap-1 text-[10px] text-[var(--text-subtle)] sm:flex">
          Clients
          <ChevronRight size={11} />
          <span className="font-semibold text-[var(--text)]">{client.displayName || client.name}</span>
        </p>
      ) : null}
    </div>
  );

  let content: ReactNode;

  if (loading) {
    content = (
      <div className="space-y-4">
        {backButton}
        <WorkspaceSkeleton />
      </div>
    );
  } else if (error || !client) {
    content = (
      <div className="space-y-4">
        {backButton}
        <ErrorState title="This client could not be opened" message={error || 'Client not found.'} onRetry={() => void loadClient()} />
      </div>
    );
  } else {
    const title = client.displayName || client.name;
    const location = [client.city, client.country].filter(Boolean).join(', ');
    const openSupport = client.openSupportCount ?? 0;

    const counts: Partial<Record<WorkspaceTab, number>> = {
      contacts: client._count.contacts,
      projects: client._count.projects,
      commercial: client._count.invoices,
      systems: totals.systems,
      support: openSupport || client._count.tickets,
    };

    content = (
      <div className="space-y-4">
        {backButton}

        <section className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
          <div className="px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <ClientLogo client={client} />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[22px] font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[26px]">{title}</h2>
                    <ToneBadge tone={clientStatusTone(client.status)}>{formatEnum(client.status)}</ToneBadge>
                    {client.priority !== 'STANDARD' ? <PriorityBadge priority={client.priority} /> : null}
                    {client.integrationLive ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        <ShieldCheck size={10} className="text-[var(--accent)]" />
                        Integrated
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                    {[client.industry, location, client.clientRef].filter(Boolean).join(' · ') || 'Syntra Grid client'}
                  </p>

                  {client.description ? (
                    <p className="mt-2 max-w-3xl text-[12px] leading-6 text-[var(--text-muted)]">{client.description}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Chip icon={<ShieldCheck size={10} />}>{formatEnum(client.relationshipType)}</Chip>
                    {client.domain ? <Chip icon={<Globe2 size={10} />}>{client.domain}</Chip> : null}
                    {client.relationshipStartedAt ? (
                      <Chip icon={<CalendarClock size={10} />}>Since {formatDate(client.relationshipStartedAt)}</Chip>
                    ) : null}
                    <Chip icon={<Clock3 size={10} />}>Updated {relativeTime(client.updatedAt)}</Chip>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadClient(true)}
                  disabled={refreshing}
                  aria-label="Refresh client"
                  title="Refresh"
                  className={cx(
                    'flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-60',
                    focusRing,
                  )}
                >
                  <RefreshCw size={14} className={cx(refreshing && 'animate-spin')} />
                </button>

                {client.websiteUrl ? (
                  <a
                    href={safeHref(client.websiteUrl) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cx(
                      'inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] px-3.5 text-[11px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)]',
                      focusRing,
                    )}
                  >
                    <Globe2 size={14} />
                    Website
                    <ExternalLink size={11} className="opacity-60" />
                  </a>
                ) : null}

                {client.adminUrl ? (
                  <a
                    href={safeHref(client.adminUrl) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cx(
                      'inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] px-3.5 text-[11px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)]',
                      focusRing,
                    )}
                  >
                    <ShieldCheck size={14} />
                    Their admin
                    <ExternalLink size={11} className="opacity-60" />
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className={cx(
                    'inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90',
                    focusRing,
                  )}
                >
                  <Pencil size={13} />
                  Edit client
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--line)]">
            <MetricsGrid
              columns="grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6"
              items={[
                { label: 'Projects', value: client._count.projects, helper: 'Connected delivery', icon: BriefcaseBusiness, onClick: () => setActiveTab('projects') },
                { label: 'Contacts', value: client._count.contacts, helper: 'Client people', icon: Users, onClick: () => setActiveTab('contacts') },
                {
                  label: 'Open support',
                  value: openSupport,
                  helper: openSupport ? 'Needs attention' : 'Nothing outstanding',
                  icon: LifeBuoy,
                  warn: openSupport > 0,
                  onClick: () => setActiveTab('support'),
                },
                { label: 'Systems', value: totals.systems, helper: 'Integrations', icon: Network, onClick: () => setActiveTab('systems') },
                { label: 'Invoices', value: client._count.invoices, helper: 'Commercial records', icon: FileText, onClick: () => setActiveTab('commercial') },
                {
                  label: 'Incidents',
                  value: totals.incidents,
                  helper: totals.incidents ? 'Across projects' : 'None recorded',
                  icon: AlertCircle,
                  warn: totals.incidents > 0,
                  onClick: () => setActiveTab('systems'),
                },
              ]}
            />
          </div>

          <div className="overflow-x-auto border-t border-[var(--line)] px-2 sm:px-4 [scrollbar-width:none]">
            <div role="tablist" aria-label="Client sections" className="flex min-w-max">
              {WORKSPACE_TABS.map((tab) => {
                const active = tab.id === activeTab;
                const count = counts[tab.id];
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={cx(
                      'relative inline-flex h-12 items-center gap-2 px-3.5 text-[11px] font-semibold transition-colors',
                      active ? 'text-[var(--text)]' : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
                      focusRing,
                    )}
                  >
                    <Icon size={13} strokeWidth={active ? 2 : 1.8} className={active ? 'text-[var(--accent)]' : undefined} />
                    {tab.label}
                    {typeof count === 'number' && count > 0 ? <CountPill value={count} /> : null}
                    {active ? (
                      <motion.span
                        layoutId={`${tabsId}-underline`}
                        className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--accent)]"
                        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
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
            key={activeTab}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
          >
            {activeTab === 'overview' ? <OverviewPanel client={client} onCopy={copyValue} onNavigate={setActiveTab} /> : null}
            {activeTab === 'contacts' ? <ContactsPanel client={client} onCopy={copyValue} /> : null}
            {activeTab === 'projects' ? <ProjectsPanel client={client} /> : null}
            {activeTab === 'commercial' ? <CommercialPanel client={client} /> : null}
            {activeTab === 'systems' ? <SystemsPanel client={client} totals={totals} /> : null}
            {activeTab === 'support' ? (
              <PlannedPanel
                icon={LifeBuoy}
                title={`Support for ${title}`}
                description="Tickets and support activity, filtered to this client from the global Support and Tickets modules."
                stats={[
                  { label: 'Tickets', value: client._count.tickets },
                  { label: 'Open', value: openSupport },
                ]}
                features={['Ticket timeline', 'Response times', 'Linked incidents', 'Satisfaction']}
              />
            ) : null}
            {activeTab === 'meetings' ? (
              <PlannedPanel
                icon={MessageSquareText}
                title="Meetings and decisions"
                description={`Notes, decisions, actions and follow ups from every conversation with ${title}.`}
                stats={[{ label: 'Account owner', value: personName(client.accountOwner) }]}
                features={['Meeting notes', 'Decisions log', 'Action items', 'Calendar link']}
              />
            ) : null}
            {activeTab === 'documents' ? (
              <PlannedPanel
                icon={FileText}
                title="Documents"
                description={`Contracts, briefs, handover material and reports for ${title}, all in one place.`}
                features={['Contracts', 'Briefs and scopes', 'Handover packs', 'Reports']}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <PortalTheme.Provider value={theme.vars}>
      <div ref={theme.ref} className="mx-auto w-full min-w-0 max-w-[1600px]">
        {content}
        <Toast toast={toast} onDismiss={() => setToast(null)} />
        {client ? (
          <EditClientDialog
            open={editOpen}
            client={client}
            accountOwners={accountOwners}
            optionsLoading={optionsLoading}
            onClose={() => setEditOpen(false)}
            onSaved={handleClientSaved}
          />
        ) : null}
      </div>
    </PortalTheme.Provider>
  );
}

/* =============================================================================
 * OVERVIEW
 * =============================================================================
 */

function OverviewPanel({
  client,
  onCopy,
  onNavigate,
}: {
  client: ClientRecord;
  onCopy: (value: string, message: string) => void;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const primary = client.contacts.find((contact) => contact.primary) ?? client.contacts[0] ?? null;
  const renewalDays = daysUntil(client.renewalAt);
  const contract = Number(client.contractValue || 0) > 0 ? formatMoney(client.contractValue, client.currency) : 'No fixed value';

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.75fr)]">
      <div className="space-y-4">
        <Panel title="Relationship">
          <div className="grid gap-x-8 sm:grid-cols-2">
            <div>
              <DetailLine label="Type" value={formatEnum(client.relationshipType)} />
              <DetailLine label="Status" value={<ToneBadge tone={clientStatusTone(client.status)} compact>{formatEnum(client.status)}</ToneBadge>} />
              <DetailLine label="Priority" value={formatEnum(client.priority)} />
              <DetailLine label="Started" value={formatDate(client.relationshipStartedAt)} />
              <DetailLine label="Went live" value={formatDate(client.liveSince)} />
            </div>
            <div>
              <DetailLine label="Billing" value={formatEnum(client.billingCycle)} />
              <DetailLine label="Contract value" value={contract} />
              <DetailLine
                label="Renewal"
                value={
                  <span className={cx(renewalDays !== null && renewalDays <= 60 && 'text-[var(--warning,#b45309)]')}>
                    {renewalText(client.renewalAt)}
                  </span>
                }
              />
              <DetailLine label="Reference" value={client.clientRef || 'Not assigned'} />
              <DetailLine label="Added" value={formatDate(client.createdAt)} />
            </div>
          </div>
        </Panel>

        <Panel
          title="Projects"
          action={
            client.projects.length ? (
              <LinkButton onClick={() => onNavigate('projects')}>View all</LinkButton>
            ) : undefined
          }
        >
          {client.projects.length === 0 ? (
            <InlineEmpty icon={BriefcaseBusiness} text="No projects yet. Projects created for this client will appear here." />
          ) : (
            <div className="-mx-2 space-y-0.5">
              {client.projects.slice(0, 5).map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onNavigate('projects')}
                  className={cx(
                    'group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)]',
                    focusRing,
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]">
                    <BriefcaseBusiness size={14} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-[var(--text)]">{project.name}</span>
                    <span className="block truncate text-[10px] text-[var(--text-subtle)]">
                      {[formatEnum(project.category), project.framework, project.hostingProvider].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <ToneBadge tone={genericTone(project.status)} compact>
                    {formatEnum(project.status)}
                  </ToneBadge>
                  <ChevronRight size={14} className="shrink-0 text-[var(--text-subtle)] transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          )}
        </Panel>

        {client.notes ? (
          <Panel title="Notes">
            <p className="whitespace-pre-wrap text-[12px] leading-6 text-[var(--text-muted)]">{client.notes}</p>
          </Panel>
        ) : null}
      </div>

      <div className="space-y-4">
        <Panel title="People">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">Account owner</p>
          {client.accountOwner ? (
            <div className="mt-2 flex items-center gap-3">
              <PersonAvatar name={personName(client.accountOwner)} avatarUrl={client.accountOwner.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-[var(--text)]">{personName(client.accountOwner)}</p>
                <p className="truncate text-[10px] text-[var(--text-subtle)]">
                  {[client.accountOwner.role ? formatEnum(client.accountOwner.role) : null, client.accountOwner.email].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-[11px] text-[var(--warning,#b45309)]">
              <AlertCircle size={13} />
              Nobody owns this relationship yet.
            </p>
          )}

          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">Primary contact</p>
              {client.contacts.length > 1 ? (
                <LinkButton onClick={() => onNavigate('contacts')}>All {client.contacts.length}</LinkButton>
              ) : null}
            </div>

            {primary ? (
              <div className="mt-2">
                <div className="flex items-center gap-3">
                  <PersonAvatar name={contactName(primary)} />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-[var(--text)]">{contactName(primary)}</p>
                    <p className="truncate text-[10px] text-[var(--text-subtle)]">{primary.jobTitle || formatEnum(primary.role)}</p>
                  </div>
                </div>
                <ContactActions contact={primary} onCopy={onCopy} className="mt-3" />
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-[var(--text-subtle)]">No contacts yet.</p>
            )}
          </div>
        </Panel>

        <Panel title="Details">
          <div className="-mx-2">
            <InfoItem icon={<Building2 size={13} />} label="Company name" value={client.name} />
            <InfoItem icon={<BriefcaseBusiness size={13} />} label="Industry" value={client.industry} />
            <InfoItem icon={<MapPin size={13} />} label="Location" value={[client.city, client.country].filter(Boolean).join(', ')} />
            <InfoItem
              icon={<Globe2 size={13} />}
              label="Domain"
              value={client.domain}
              onCopy={client.domain ? () => onCopy(client.domain as string, 'Domain copied') : undefined}
            />
            <InfoItem
              icon={<FileText size={13} />}
              label="Reference"
              value={client.clientRef}
              onCopy={client.clientRef ? () => onCopy(client.clientRef as string, 'Reference copied') : undefined}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* =============================================================================
 * CONTACTS
 * =============================================================================
 */

function ContactsPanel({ client, onCopy }: { client: ClientRecord; onCopy: (value: string, message: string) => void }) {
  const contacts = [...client.contacts].sort((a, b) => Number(b.primary) - Number(a.primary) || contactName(a).localeCompare(contactName(b)));

  return (
    <Panel title="Contacts" action={<SoonButton icon={<Plus size={13} />} label="Add contact" small />}>
      {contacts.length === 0 ? (
        <InlineEmpty
          icon={Users}
          text="No contacts yet. Decision makers, finance and technical contacts will be listed here."
        />
      ) : (
        <div className="-mx-2 divide-y divide-[var(--line)]">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex flex-col gap-3 px-2 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <PersonAvatar name={contactName(contact)} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[12px] font-semibold text-[var(--text)]">{contactName(contact)}</p>
                    {contact.primary ? (
                      <span className="shrink-0 rounded-md border border-[color:var(--accent)]/35 bg-[color:var(--accent)]/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[var(--text)]">
                        Primary
                      </span>
                    ) : null}
                    {contact.active === false ? (
                      <span className="shrink-0 rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[10px] text-[var(--text-subtle)]">
                    {[contact.jobTitle, formatEnum(contact.role)].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>

              <div className="hidden min-w-0 flex-1 text-[10px] text-[var(--text-muted)] lg:block">
                <p className="truncate">{contact.email || 'No email'}</p>
                <p className="truncate text-[var(--text-subtle)]">{contact.phone || 'No phone'}</p>
              </div>

              <ContactActions contact={contact} onCopy={onCopy} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ContactActions({
  contact,
  onCopy,
  className,
}: {
  contact: ClientContact;
  onCopy: (value: string, message: string) => void;
  className?: string;
}) {
  if (!contact.email && !contact.phone) {
    return <p className={cx('text-[10px] text-[var(--text-subtle)]', className)}>No email or phone</p>;
  }

  const buttonClass = cx(
    'inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 text-[10px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)]',
    focusRing,
  );

  return (
    <div className={cx('flex shrink-0 flex-wrap items-center gap-1.5', className)}>
      {contact.email ? (
        <>
          <a href={`mailto:${contact.email}`} className={buttonClass}>
            <Mail size={12} />
            Email
          </a>
          <button
            type="button"
            onClick={() => onCopy(contact.email as string, 'Email copied')}
            aria-label={`Copy ${contact.firstName}'s email`}
            className={cx(
              'flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
              focusRing,
            )}
          >
            <Copy size={12} />
          </button>
        </>
      ) : null}
      {contact.phone ? (
        <a href={`tel:${contact.phone}`} className={buttonClass}>
          <Phone size={12} />
          Call
        </a>
      ) : null}
    </div>
  );
}

/* =============================================================================
 * PROJECTS
 * =============================================================================
 */

function ProjectsPanel({ client }: { client: ClientRecord }) {
  if (client.projects.length === 0) {
    return (
      <EmptyState
        icon={<BriefcaseBusiness size={21} strokeWidth={1.7} />}
        title="No projects yet"
        description="Once a project is created for this client it appears here with its systems, deployments, health and incidents."
      />
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {client.projects.map((project) => {
        const incidents = project._count?.incidents ?? 0;
        const allLinks: Array<{ href: string | null; label: string; icon: ReactNode }> = [
          { href: safeHref(project.productionUrl), label: 'Live site', icon: <Globe2 size={11} /> },
          { href: safeHref(project.adminUrl), label: 'Admin', icon: <ShieldCheck size={11} /> },
          { href: safeHref(project.repositoryUrl), label: 'Repository', icon: <Code2 size={11} /> },
        ];
        const links = allLinks.filter((link): link is { href: string; label: string; icon: ReactNode } => Boolean(link.href));

        return (
          <article key={project.id} className="flex flex-col rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]">
                  <BriefcaseBusiness size={16} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-semibold tracking-[-0.02em] text-[var(--text)]">{project.name}</h3>
                  <p className="truncate text-[10px] text-[var(--text-subtle)]">
                    {[formatEnum(project.category), project.framework].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <ToneBadge tone={genericTone(project.status)} compact>
                {formatEnum(project.status)}
              </ToneBadge>
            </div>

            {project.description ? (
              <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-[var(--text-muted)]">{project.description}</p>
            ) : null}

            <div className="mb-4 mt-4 grid grid-cols-3 border-t border-[var(--line)] pt-3">
              <MiniStat label="Systems" value={project._count?.integrations ?? 0} />
              <MiniStat label="Deploys" value={project._count?.deployments ?? 0} />
              <MiniStat label="Incidents" value={incidents} warn={incidents > 0} />
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-1.5">
              {links.length ? (
                links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cx(
                      'inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--line)] px-2 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
                      focusRing,
                    )}
                  >
                    {link.icon}
                    {link.label}
                    <ExternalLink size={9} className="opacity-50" />
                  </a>
                ))
              ) : (
                <span className="text-[10px] text-[var(--text-subtle)]">No links added yet</span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* =============================================================================
 * COMMERCIAL
 * =============================================================================
 */

function CommercialPanel({ client }: { client: ClientRecord }) {
  const invoices = client.invoices ?? [];
  const billing = client.billing;
  const outstanding = billing ? Number(billing.outstandingAmount) : 0;
  const renewalDays = daysUntil(client.renewalAt);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[22px] border border-[var(--line)] shadow-sm">
        <MetricsGrid
          columns="grid-cols-2 lg:grid-cols-4"
          items={[
            {
              label: 'Contract value',
              value: Number(client.contractValue || 0) > 0 ? formatMoney(client.contractValue, client.currency) : 'None',
              helper: formatEnum(client.billingCycle),
              icon: CircleDollarSign,
            },
            {
              label: 'Total paid',
              value: billing ? formatMoney(billing.totalPaid, client.currency) : 'Not available',
              helper: 'All time',
              icon: CheckCircle2,
            },
            {
              label: 'Outstanding',
              value: billing ? formatMoney(billing.outstandingAmount, client.currency) : 'Not available',
              helper: outstanding > 0 ? 'Awaiting payment' : 'Nothing owed',
              icon: Banknote,
              warn: outstanding > 0,
            },
            {
              label: 'Renewal',
              value: client.renewalAt ? formatDate(client.renewalAt) : 'Not set',
              helper: renewalText(client.renewalAt),
              icon: CalendarClock,
              warn: renewalDays !== null && renewalDays <= 60,
            },
          ]}
        />
      </section>

      <Panel title="Invoices" action={invoices.length ? <CountPill value={invoices.length} /> : undefined}>
        {invoices.length === 0 ? (
          <InlineEmpty icon={FileText} text="No invoices yet. Invoices raised for this client will appear here." />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(160px,1.4fr)_110px_100px_100px_110px_110px] gap-4 border-b border-[var(--line)] pb-2.5 md:grid">
              {['Invoice', 'Status', 'Issued', 'Due', 'Total', 'Balance'].map((label, index) => (
                <p key={label} className={cx('text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]', index > 3 && 'text-right')}>
                  {label}
                </p>
              ))}
            </div>
            <div className="divide-y divide-[var(--line)]">
              {invoices.map((invoice) => {
                const balance = Number(invoice.balance);
                const overdue = balance > 0 && invoice.dueAt && new Date(invoice.dueAt).getTime() < Date.now();

                return (
                  <div
                    key={invoice.id}
                    className="grid grid-cols-2 gap-x-4 gap-y-1 py-3 md:grid-cols-[minmax(160px,1.4fr)_110px_100px_100px_110px_110px] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-[var(--text)]">{invoice.invoiceRef}</p>
                      {invoice.description ? <p className="truncate text-[9.5px] text-[var(--text-subtle)]">{invoice.description}</p> : null}
                    </div>
                    <div className="justify-self-end md:justify-self-start">
                      <ToneBadge tone={overdue ? 'red' : genericTone(invoice.status)} compact>
                        {overdue ? 'Overdue' : formatEnum(invoice.status)}
                      </ToneBadge>
                    </div>
                    <p className="text-[10px] text-[var(--text-subtle)]">
                      <span className="md:hidden">Issued </span>
                      {formatDate(invoice.issuedAt)}
                    </p>
                    <p className={cx('text-right text-[10px] md:text-left', overdue ? 'font-semibold text-red-600' : 'text-[var(--text-subtle)]')}>
                      <span className="md:hidden">Due </span>
                      {formatDate(invoice.dueAt)}
                    </p>
                    <p className="text-[11px] font-semibold tabular-nums text-[var(--text)] md:text-right">{formatMoney(invoice.total, invoice.currency)}</p>
                    <p className={cx('text-right text-[11px] font-semibold tabular-nums', balance > 0 ? 'text-[var(--warning,#b45309)]' : 'text-[var(--text-subtle)]')}>
                      {formatMoney(invoice.balance, invoice.currency)}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Panel>

      {billing ? (
        <Panel title="Billing record">
          <div className="grid gap-x-8 sm:grid-cols-2">
            <div>
              <DetailLine label="Currency" value={client.currency} />
              <DetailLine label="Last invoice" value={billing.lastInvoiceRef || 'Not set'} />
            </div>
            <div>
              <DetailLine label="Last invoice date" value={formatDate(billing.lastInvoiceAt)} />
              <DetailLine
                label="Last invoice status"
                value={billing.lastInvoiceStatus ? <ToneBadge tone={genericTone(billing.lastInvoiceStatus)} compact>{formatEnum(billing.lastInvoiceStatus)}</ToneBadge> : 'Not set'}
              />
            </div>
          </div>
        </Panel>
      ) : null}

      <p className="flex items-start gap-2 px-1 text-[10px] leading-5 text-[var(--text-subtle)]">
        <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" />
        Contract value is a summary only. Revenue share, equity or other arrangements will live in Contracts and Commercial once they are connected.
      </p>
    </div>
  );
}

/* =============================================================================
 * SYSTEMS
 * =============================================================================
 */

function SystemsPanel({
  client,
  totals,
}: {
  client: ClientRecord;
  totals: { systems: number; incidents: number; deployments: number; healthChecks: number };
}) {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[22px] border border-[var(--line)] shadow-sm">
        <MetricsGrid
          columns="grid-cols-2 lg:grid-cols-4"
          items={[
            { label: 'Integrations', value: totals.systems, helper: 'Connected systems', icon: Network },
            { label: 'Health checks', value: totals.healthChecks, helper: 'Monitoring records', icon: Activity },
            { label: 'Deployments', value: totals.deployments, helper: 'Across projects', icon: Server },
            {
              label: 'Incidents',
              value: totals.incidents,
              helper: totals.incidents ? 'Review needed' : 'None recorded',
              icon: AlertCircle,
              warn: totals.incidents > 0,
            },
          ]}
        />
      </section>

      <Panel title="By project">
        {client.projects.length === 0 ? (
          <InlineEmpty icon={Server} text="No infrastructure yet. Systems appear once projects and integrations are connected." />
        ) : (
          <div className="-mx-2 divide-y divide-[var(--line)]">
            {client.projects.map((project) => {
              const stack = [project.framework, project.hostingProvider, project.databaseType ? formatEnum(project.databaseType) : null].filter(Boolean);
              const incidents = project._count?.incidents ?? 0;

              return (
                <div key={project.id} className="grid gap-3 px-2 py-3 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(64px,0.3fr))] md:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[12px] font-semibold text-[var(--text)]">{project.name}</p>
                      <ToneBadge tone={genericTone(project.status)} compact>
                        {formatEnum(project.status)}
                      </ToneBadge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {stack.length ? (
                        stack.map((item) => <Chip key={item as string}>{item}</Chip>)
                      ) : (
                        <span className="text-[10px] text-[var(--text-subtle)]">Stack not recorded</span>
                      )}
                    </div>
                  </div>
                  <MiniStat label="Systems" value={project._count?.integrations ?? 0} />
                  <MiniStat label="Deploys" value={project._count?.deployments ?? 0} />
                  <MiniStat label="Health" value={project._count?.healthChecks ?? 0} />
                  <MiniStat label="Incidents" value={incidents} warn={incidents > 0} />
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* =============================================================================
 * PLANNED
 * =============================================================================
 */

function PlannedPanel({
  icon: Icon,
  title,
  description,
  features,
  stats = [],
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
  stats?: Array<{ label: string; value: string | number }>;
}) {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 py-14 text-center shadow-sm">
      <div className="max-w-[480px]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
          <Icon size={21} strokeWidth={1.7} />
        </div>
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
          <Clock3 size={9} />
          Planned
        </span>
        <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</h3>
        <p className="mx-auto mt-2 max-w-[420px] text-[11px] leading-5 text-[var(--text-muted)]">{description}</p>

        {stats.length ? (
          <div className="mx-auto mt-5 flex max-w-[360px] justify-center divide-x divide-[var(--line)] rounded-[14px] border border-[var(--line)]">
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-0 flex-1 px-4 py-3">
                <p className="truncate text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--text)]">{stat.value}</p>
                <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">{stat.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-center gap-1.5">
          {features.map((feature) => (
            <Chip key={feature} icon={<Check size={10} className="text-[var(--accent)]" />}>
              {feature}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 * WORKSPACE UI
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
    warn?: boolean;
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
              <p className={cx('mt-1.5 truncate text-[20px] font-semibold tabular-nums tracking-[-0.04em]', metric.warn ? 'text-[var(--warning,#b45309)]' : 'text-[var(--text)]')}>
                {metric.value}
              </p>
              <p className="mt-0.5 truncate text-[9px] text-[var(--text-subtle)]">{metric.helper}</p>
            </div>
            <div
              className={cx(
                'hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors sm:flex',
                metric.warn
                  ? 'border-[color:var(--warning-border,rgba(245,158,11,0.3))] bg-[var(--warning-soft,rgba(245,158,11,0.1))] text-[var(--warning,#b45309)]'
                  : 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)] group-hover:text-[var(--accent)]',
              )}
            >
              <Icon size={15} strokeWidth={1.8} />
            </div>
          </div>
        );

        return metric.onClick ? (
          <button
            key={metric.label}
            type="button"
            onClick={metric.onClick}
            className="group min-w-0 bg-[var(--surface)] px-4 py-4 text-left transition-colors hover:bg-[var(--surface-muted)] focus-visible:bg-[var(--surface-muted)] focus-visible:outline-none sm:px-5"
          >
            {inner}
          </button>
        ) : (
          <div key={metric.label} className="min-w-0 bg-[var(--surface)] px-4 py-4 sm:px-5">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function ToneBadge({ tone, compact = false, children }: { tone: Tone; compact?: boolean; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-bold uppercase tracking-[0.08em]',
        compact ? 'px-2 py-1 text-[7px]' : 'px-2.5 py-1 text-[8px]',
        TONES[tone].badge,
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', TONES[tone].dot)} />
      {children}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ClientPriority }) {
  const count = priority === 'STRATEGIC' ? 3 : priority === 'IMPORTANT' ? 2 : 1;

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--accent)]/35 bg-[color:var(--accent)]/10 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--text)]">
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span key={index} className={cx('h-1.5 w-1.5 rounded-full', index < count ? 'bg-[var(--accent)]' : 'bg-[var(--line)]')} />
        ))}
      </span>
      {formatEnum(priority)}
    </span>
  );
}

function ClientLogo({ client }: { client: ClientRecord }) {
  const title = client.displayName || client.name;

  if (client.logoUrl) {
    return (
      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[18px] border border-[var(--line)] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={client.logoUrl} alt="" className="h-full w-full object-contain p-2" />
      </span>
    );
  }

  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] text-[15px] font-bold text-[var(--text)]">
      {initials(title) || <Building2 size={20} strokeWidth={1.8} />}
    </span>
  );
}

function PersonAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-[13px] border border-[var(--line)] object-cover" />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-[var(--line)] bg-[var(--surface-muted)] text-[11px] font-bold text-[var(--text)]">
      {initials(name) || <UserRound size={15} strokeWidth={1.8} className="text-[var(--text-subtle)]" />}
    </span>
  );
}

function InfoItem({
  icon,
  label,
  value,
  onCopy,
}: {
  icon: ReactNode;
  label: string;
  value?: string | null;
  onCopy?: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-muted)]">
      <span className="text-[var(--text-subtle)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-medium text-[var(--text-subtle)]">{label}</p>
        <p className={cx('truncate text-[11px]', value ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-subtle)]')}>{value || 'Not set'}</p>
      </div>
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
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

function MiniStat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cx('text-[15px] font-semibold tabular-nums tracking-[-0.03em]', warn ? 'text-[var(--warning,#b45309)]' : 'text-[var(--text)]')}>{value}</p>
      <p className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">{label}</p>
    </div>
  );
}

function SoonButton({ icon, label, primary = false, small = false }: { icon: ReactNode; label: string; primary?: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      disabled
      title={`${label} is coming soon`}
      className={cx(
        'inline-flex cursor-not-allowed items-center gap-2 rounded-xl border font-semibold',
        small ? 'h-8 px-2.5 text-[10px]' : 'h-10 px-3.5 text-[11px]',
        primary ? 'border-[color:var(--accent)]/40 text-[var(--text-muted)]' : 'border-[var(--line)] text-[var(--text-subtle)]',
      )}
    >
      {icon}
      {label}
      <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
        Soon
      </span>
    </button>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('group inline-flex items-center gap-1 rounded-md text-[10px] font-semibold text-[var(--accent)] transition hover:opacity-80', focusRing)}
    >
      {children}
      <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function InlineEmpty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]">
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <p className="max-w-[300px] text-[10px] leading-5 text-[var(--text-subtle)]">{text}</p>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-[300px] animate-pulse rounded-[26px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.75fr)]">
        <div className="h-[340px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
        <div className="h-[340px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/* =============================================================================
 * SHARED PRIMITIVES
 * Same building blocks as the other Syntra Grid tabs.
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

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]';

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

function CountPill({ value }: { value: number }) {
  return (
    <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-[var(--text-subtle)]">
      {value}
    </span>
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

/* =============================================================================
 * EDIT CLIENT
 *
 * Same ModalShell chrome (portal, backdrop, Escape, focus trap, scroll
 * lock, PortalTheme) as the Add Client wizard in ClientsTab.tsx — copied in
 * rather than imported, matching how the rest of this component's building
 * blocks (ClientLogo, Toast, etc.) are each kept local to their own file.
 * =============================================================================
 */

const MODAL_VARS = {
  '--surface': '#FFFFFF',
  '--surface-muted': '#F4F4F5',
  '--line': '#D4D4D8',
  '--text': '#0A0A0A',
  '--text-muted': '#27272A',
  '--text-subtle': '#52525B',
} as CSSProperties;

function focusableIn(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
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
  const modalTheme = useMemo(() => ({ ...inherited, ...MODAL_VARS }), [inherited]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector<HTMLElement>('[data-autofocus]') ?? focusableIn(panel)[0];
      target?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel || !panel.contains(document.activeElement)) return;

      const items = focusableIn(panel);
      if (items.length === 0) return;

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

  if (!isClient) return null;

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
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 }
            }
          >
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[var(--line)] sm:hidden" />
            <PortalTheme.Provider value={modalTheme}>{children}</PortalTheme.Provider>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------- Form primitives ---------- */

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[9px] font-semibold text-[var(--text-muted)]">
          {label}
          {required ? <span className="text-[var(--accent)]">*</span> : null}
        </span>
        {hint ? <span className="truncate text-[8px] text-[var(--text-subtle)]">{hint}</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[9px] font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

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

/* ---------- Enum options ---------- */

const EDIT_STATUS_OPTIONS: Array<{ value: ClientStatus; label: string }> = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const EDIT_PRIORITY_OPTIONS: Array<{ value: ClientPriority; label: string }> = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'IMPORTANT', label: 'Important' },
  { value: 'STRATEGIC', label: 'Strategic' },
];

const EDIT_RELATIONSHIP_OPTIONS: Array<{ value: ClientRelationship; label: string }> = [
  { value: 'CLIENT', label: 'Client' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'STRATEGIC_PARTNER', label: 'Strategic partner' },
];

const EDIT_BILLING_OPTIONS: Array<{ value: BillingCycle; label: string }> = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'CUSTOM', label: 'Custom' },
];

const EDIT_CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: 'NGN', label: 'NGN' },
  { value: 'GBP', label: 'GBP' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
];

/* ---------- Edit form ---------- */

type EditClientForm = {
  name: string;
  displayName: string;
  description: string;
  industry: string;
  country: string;
  city: string;
  logoUrl: string;
  logoPublicId: string;
  websiteUrl: string;
  domain: string;
  adminUrl: string;
  status: ClientStatus;
  priority: ClientPriority;
  relationshipType: ClientRelationship;
  relationshipStartedAt: string;
  liveSince: string;
  accountOwnerId: string;
  integrationLive: boolean;
  billingCycle: BillingCycle;
  contractValue: string;
  currency: Currency;
  renewalAt: string;
  notes: string;
};

type EditFieldErrors = Partial<Record<keyof EditClientForm, string>>;

function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

function buildEditForm(client: ClientRecord): EditClientForm {
  return {
    name: client.name,
    displayName: client.displayName ?? '',
    description: client.description ?? '',
    industry: client.industry ?? '',
    country: client.country ?? '',
    city: client.city ?? '',
    logoUrl: client.logoUrl ?? '',
    logoPublicId: '',
    websiteUrl: client.websiteUrl ?? '',
    domain: client.domain ?? '',
    adminUrl: client.adminUrl ?? '',
    status: client.status,
    priority: client.priority,
    relationshipType: client.relationshipType,
    relationshipStartedAt: toDateInputValue(client.relationshipStartedAt),
    liveSince: toDateInputValue(client.liveSince),
    accountOwnerId: client.accountOwner?.id ?? '',
    integrationLive: client.integrationLive,
    billingCycle: client.billingCycle,
    contractValue: client.contractValue ?? '0',
    currency: client.currency,
    renewalAt: toDateInputValue(client.renewalAt),
    notes: client.notes ?? '',
  };
}

function validateEditForm(form: EditClientForm): EditFieldErrors {
  const errors: EditFieldErrors = {};

  if (!form.name.trim()) errors.name = 'Enter a company name.';
  if (form.websiteUrl.trim() && !isValidUrl(form.websiteUrl)) errors.websiteUrl = 'Enter a valid website.';

  return errors;
}

function EditClientDialog({
  open,
  client,
  accountOwners,
  optionsLoading,
  onClose,
  onSaved,
}: {
  open: boolean;
  client: ClientRecord;
  accountOwners: AccountOwner[];
  optionsLoading: boolean;
  onClose: () => void;
  onSaved: (client: ClientRecord) => void;
}) {
  const titleId = useId();
  const clientRef = useRef(client);
  clientRef.current = client;

  const [form, setForm] = useState<EditClientForm>(() => buildEditForm(client));
  const [errors, setErrors] = useState<EditFieldErrors>({});
  const [issue, setIssue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const initialSnapshotRef = useRef(JSON.stringify(buildEditForm(client)));

  // Re-seed from the freshest client data every time the dialog opens, but
  // never while it's open — a background refresh of `client` must not
  // clobber what the admin is typing.
  useEffect(() => {
    if (!open) return;

    const built = buildEditForm(clientRef.current);
    setForm(built);
    initialSnapshotRef.current = JSON.stringify(built);
    setErrors({});
    setIssue(null);
    setConfirmDiscard(false);
  }, [open]);

  const isDirty = JSON.stringify(form) !== initialSnapshotRef.current;

  const update = useCallback(<K extends keyof EditClientForm>(key: K, value: EditClientForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
    setIssue(null);
  }, []);

  const discardTempLogo = useCallback(() => {
    // Only ever a temp upload from this session — the persisted logo (if
    // any) has no tracked publicId here and is never touched this way.
    if (form.logoPublicId) void deleteClientLogo(form.logoPublicId);
  }, [form.logoPublicId]);

  const requestClose = useCallback(() => {
    if (saving) return;

    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }

    discardTempLogo();
    onClose();
  }, [discardTempLogo, isDirty, onClose, saving]);

  const confirmDiscardChanges = useCallback(() => {
    discardTempLogo();
    setConfirmDiscard(false);
    onClose();
  }, [discardTempLogo, onClose]);

  const submit = useCallback(async () => {
    const validationErrors = validateEditForm(form);

    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setIssue(null);

    try {
      const response = await fetch(`/api/admin/clients/${encodeURIComponent(client.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          displayName: form.displayName.trim() || null,
          description: form.description.trim() || null,
          industry: form.industry.trim() || null,
          country: form.country.trim() || null,
          city: form.city.trim() || null,
          logoUrl: form.logoUrl.trim() || null,
          websiteUrl: form.websiteUrl.trim() ? normaliseUrl(form.websiteUrl) : null,
          domain: form.domain.trim() || null,
          adminUrl: form.adminUrl.trim() || null,
          status: form.status,
          priority: form.priority,
          relationshipType: form.relationshipType,
          relationshipStartedAt: form.relationshipStartedAt || null,
          liveSince: form.liveSince || null,
          accountOwnerId: form.accountOwnerId || null,
          integrationLive: form.integrationLive,
          billingCycle: form.billingCycle,
          contractValue: form.contractValue || 0,
          currency: form.currency,
          renewalAt: form.renewalAt || null,
          notes: form.notes.trim() || null,
        }),
      });

      const payload = (await response.json().catch(() => ({ ok: false }))) as {
        ok: boolean;
        client?: ClientRecord;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.client) {
        throw new Error(payload.error || 'The client could not be updated.');
      }

      // The temp upload (if any) is now the persisted logo — it must
      // survive, so no cleanup call happens on this path.
      onSaved(payload.client);
    } catch (cause) {
      // Keep the temp logo and the entered values so the admin can retry
      // without re-uploading or re-typing anything.
      setIssue(cause instanceof Error ? cause.message : 'The client could not be updated.');
    } finally {
      setSaving(false);
    }
  }, [client.id, form, onSaved]);

  return (
    <ModalShell open={open} onClose={requestClose} labelledBy={titleId} size="lg">
      <div className="relative flex max-h-[92dvh] min-h-0 flex-col sm:max-h-[min(88dvh,900px)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 pb-4 pt-4 sm:px-7 sm:pt-6">
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              Edit client
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{client.displayName || client.name}</p>
          </div>

          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            aria-label="Close"
            className={cx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-60',
              focusRing,
            )}
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-7">
          <div className="space-y-6">
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Company</h3>

              <div className="mt-3">
                <LogoUploader
                  logoUrl={form.logoUrl}
                  logoPublicId={form.logoPublicId}
                  title={form.displayName.trim() || form.name.trim()}
                  onChange={(logoUrl, logoPublicId) => {
                    update('logoUrl', logoUrl);
                    update('logoPublicId', logoPublicId);
                  }}
                />
              </div>

              <div className="mt-4">
                <Field label="Company name" required error={errors.name}>
                  <input
                    data-autofocus
                    value={form.name}
                    onChange={(event) => update('name', event.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    className={inputClass(errors.name)}
                  />
                </Field>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Short name">
                  <input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} className={inputClass()} />
                </Field>
                <Field label="Industry">
                  <input value={form.industry} onChange={(event) => update('industry', event.target.value)} className={inputClass()} />
                </Field>
                <Field label="Country">
                  <input value={form.country} onChange={(event) => update('country', event.target.value)} className={inputClass()} />
                </Field>
                <Field label="City">
                  <input value={form.city} onChange={(event) => update('city', event.target.value)} className={inputClass()} />
                </Field>
                <Field label="Website" error={errors.websiteUrl}>
                  <input
                    value={form.websiteUrl}
                    onChange={(event) => update('websiteUrl', event.target.value)}
                    inputMode="url"
                    aria-invalid={Boolean(errors.websiteUrl)}
                    className={inputClass(errors.websiteUrl)}
                  />
                </Field>
                <Field label="Domain">
                  <input value={form.domain} onChange={(event) => update('domain', event.target.value)} className={inputClass()} />
                </Field>
                <Field label="Their admin URL">
                  <input value={form.adminUrl} onChange={(event) => update('adminUrl', event.target.value)} className={inputClass()} />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Description">
                  <textarea
                    value={form.description}
                    onChange={(event) => update('description', event.target.value)}
                    rows={3}
                    maxLength={600}
                    className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
                  />
                </Field>
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Relationship</h3>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Status">
                  <select value={form.status} onChange={(event) => update('status', event.target.value as ClientStatus)} className={inputClass()}>
                    {EDIT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select value={form.priority} onChange={(event) => update('priority', event.target.value as ClientPriority)} className={inputClass()}>
                    {EDIT_PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Relationship type">
                  <select
                    value={form.relationshipType}
                    onChange={(event) => update('relationshipType', event.target.value as ClientRelationship)}
                    className={inputClass()}
                  >
                    {EDIT_RELATIONSHIP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Account owner" hint={optionsLoading ? 'Loading…' : undefined}>
                  <select
                    value={form.accountOwnerId}
                    onChange={(event) => update('accountOwnerId', event.target.value)}
                    disabled={optionsLoading}
                    className={inputClass()}
                  >
                    <option value="">No owner</option>
                    {accountOwners.map((owner) => (
                      <option key={owner.id} value={owner.id}>{personName(owner)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Relationship started">
                  <input
                    type="date"
                    value={form.relationshipStartedAt}
                    onChange={(event) => update('relationshipStartedAt', event.target.value)}
                    className={inputClass()}
                  />
                </Field>
                <Field label="Live since">
                  <input type="date" value={form.liveSince} onChange={(event) => update('liveSince', event.target.value)} className={inputClass()} />
                </Field>
              </div>

              <label className="mt-4 flex items-center gap-2 text-[11px] font-medium text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={form.integrationLive}
                  onChange={(event) => update('integrationLive', event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--line)] text-[var(--accent)] focus:ring-[var(--accent)]/30"
                />
                Integration is live
              </label>
            </section>

            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Commercial</h3>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Billing cycle">
                  <select value={form.billingCycle} onChange={(event) => update('billingCycle', event.target.value as BillingCycle)} className={inputClass()}>
                    {EDIT_BILLING_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Currency">
                  <select value={form.currency} onChange={(event) => update('currency', event.target.value as Currency)} className={inputClass()}>
                    {EDIT_CURRENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Contract value">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.contractValue}
                    onChange={(event) => update('contractValue', event.target.value)}
                    className={inputClass()}
                  />
                </Field>
                <Field label="Renewal date">
                  <input type="date" value={form.renewalAt} onChange={(event) => update('renewalAt', event.target.value)} className={inputClass()} />
                </Field>
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Internal</h3>

              <div className="mt-3">
                <Field label="Notes" hint="Not visible to the client">
                  <textarea
                    value={form.notes}
                    onChange={(event) => update('notes', event.target.value)}
                    rows={4}
                    className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
                  />
                </Field>
              </div>
            </section>

            {issue ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3 text-[10px] font-medium leading-5 text-red-600">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {issue}
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[var(--line)] bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
          <div className="flex items-center justify-end gap-2">
            <SecondaryButton onClick={requestClose}>Cancel</SecondaryButton>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className={cx(
                'inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60',
                focusRing,
              )}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        {confirmDiscard ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 p-6">
            <div className="w-full max-w-[320px] rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-5 text-center shadow-xl">
              <p className="text-[12px] font-semibold text-[var(--text)]">Discard unsaved changes?</p>
              <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">Your edits to this client haven&apos;t been saved.</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <SecondaryButton onClick={() => setConfirmDiscard(false)}>Keep editing</SecondaryButton>
                <button
                  type="button"
                  onClick={confirmDiscardChanges}
                  className={cx(
                    'inline-flex h-9 items-center gap-2 rounded-xl bg-red-600 px-3.5 text-[10px] font-semibold text-white transition hover:opacity-90',
                    focusRing,
                  )}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}