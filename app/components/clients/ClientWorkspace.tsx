"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  ContactRound,
  Copy,
  ExternalLink,
  FileText,
  Globe2,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  MoreHorizontal,
  Network,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  TicketCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";

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

type ClientCounts = {
  contacts: number;
  projects: number;
  tickets: number;
  invoices: number;
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

  _count: ClientCounts;

  /*
   * The list API already returns this. The Client 360 endpoint may or may not
   * return it yet, so the workspace safely falls back to zero.
   */
  openSupportCount?: number;
};

type ClientResponse = {
  ok: boolean;
  client?: ClientRecord;
  error?: string;
};

type WorkspaceTab =
  | "overview"
  | "contacts"
  | "projects"
  | "commercial"
  | "support"
  | "meetings"
  | "systems"
  | "documents";

type ToastTone = "success" | "error" | "info";

type ToastMessage = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ClientWorkspaceProps = {
  clientId: string;
  onBack: () => void;
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

const GOLD_SHADOW = "0 10px 26px rgba(212,175,55,0.24)";

const GOLD_INK = "#241A05";

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]";

/* =============================================================================
   TABS
============================================================================= */

const WORKSPACE_TABS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: ReactNode;
}> = [
  {
    id: "overview",
    label: "Overview",
    icon: <LayoutDashboard size={14} />,
  },
  {
    id: "contacts",
    label: "Contacts",
    icon: <ContactRound size={14} />,
  },
  {
    id: "projects",
    label: "Projects",
    icon: <BriefcaseBusiness size={14} />,
  },
  {
    id: "commercial",
    label: "Commercial",
    icon: <CircleDollarSign size={14} />,
  },
  {
    id: "support",
    label: "Support",
    icon: <LifeBuoy size={14} />,
  },
  {
    id: "meetings",
    label: "Meetings",
    icon: <MessageSquareText size={14} />,
  },
  {
    id: "systems",
    label: "Systems",
    icon: <Server size={14} />,
  },
  {
    id: "documents",
    label: "Documents",
    icon: <FileText size={14} />,
  },
];

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

  const name = [person.firstName, person.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || person.email;
}

function contactName(contact: ClientContact) {
  return `${contact.firstName} ${contact.lastName}`.trim();
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

function formatMoney(
  value: string | number | null | undefined,
  currency: string,
) {
  const amount = Number(value ?? 0);

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

function daysUntil(value: string | null | undefined) {
  if (!value) return null;

  const target = new Date(value).getTime();

  if (Number.isNaN(target)) return null;

  return Math.ceil((target - Date.now()) / 86_400_000);
}

function renewalText(value: string | null | undefined) {
  const days = daysUntil(value);

  if (days === null) return "No renewal date";
  if (days < 0) return `Overdue by ${Math.abs(days)} days`;
  if (days === 0) return "Renews today";
  if (days === 1) return "Renews tomorrow";
  if (days <= 60) return `Renews in ${days} days`;

  return formatDate(value);
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

/* =============================================================================
   TOAST HOOK
============================================================================= */

function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      counter.current += 1;

      const id = counter.current;

      setToasts((current) => [
        ...current.slice(-2),
        {
          id,
          tone,
          message,
        },
      ]);

      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return {
    toasts,
    push,
    dismiss,
  };
}

/* =============================================================================
   WORKSPACE
============================================================================= */

export default function ClientWorkspace({
  clientId,
  onBack,
}: ClientWorkspaceProps) {
  const [client, setClient] = useState<ClientRecord | null>(null);

  const [activeTab, setActiveTab] =
    useState<WorkspaceTab>("overview");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const requestRef = useRef<AbortController | null>(null);

  const { toasts, push, dismiss } = useToasts();

  const loadClient = useCallback(
    async (silent = false) => {
      requestRef.current?.abort();

      const controller = new AbortController();
      requestRef.current = controller;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const response = await fetch(
          `/api/admin/clients/${encodeURIComponent(clientId)}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload = (await response.json()) as ClientResponse;

        if (!response.ok || !payload.ok || !payload.client) {
          throw new Error(
            payload.error || "The client workspace could not be loaded.",
          );
        }

        setClient(payload.client);
      } catch (err) {
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : "The client workspace could not be loaded.";

        if (silent) {
          push("error", message);
        } else {
          setError(message);
        }
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
        }

        setLoading(false);
        setRefreshing(false);
      }
    },
    [clientId, push],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClient();

    return () => {
      requestRef.current?.abort();
    };
  }, [loadClient]);

  const primaryContact = useMemo(() => {
    if (!client) return null;

    return (
      client.contacts.find((contact) => contact.primary) ??
      client.contacts[0] ??
      null
    );
  }, [client]);

  const title = client?.displayName || client?.name || "Client";

  const location = useMemo(() => {
    if (!client) return "";

    return [client.city, client.country]
      .filter(Boolean)
      .join(", ");
  }, [client]);

  const totalIncidents = useMemo(() => {
    if (!client) return 0;

    return client.projects.reduce(
      (total, project) =>
        total + (project._count?.incidents ?? 0),
      0,
    );
  }, [client]);

  const totalSystems = useMemo(() => {
    if (!client) return 0;

    return client.projects.reduce(
      (total, project) =>
        total + (project._count?.integrations ?? 0),
      0,
    );
  }, [client]);

  const copyValue = useCallback(
    async (value: string, successMessage: string) => {
      try {
        await navigator.clipboard.writeText(value);
        push("success", successMessage);
      } catch {
        push(
          "error",
          "Copy failed. Check your clipboard permissions.",
        );
      }
    },
    [push],
  );

  if (loading) {
    return <WorkspaceLoading />;
  }

  if (error || !client) {
    return (
      <WorkspaceError
        message={error || "Client not found."}
        onBack={onBack}
        onRetry={() => void loadClient()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <ToastStack
        toasts={toasts}
        onDismiss={dismiss}
      />

      {/* ===================================================================
          BREADCRUMB / BACK
      ==================================================================== */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className={cx(
            "inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]",
            FOCUS_RING,
          )}
        >
          <ArrowLeft size={14} />
          All clients
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] font-medium text-[var(--muted)] sm:block">
            CRM
          </span>

          <span className="hidden text-[var(--muted)] sm:block">
            /
          </span>

          <span className="text-[11px] font-semibold text-[var(--text)]">
            {title}
          </span>
        </div>
      </div>

      {/* ===================================================================
          CLIENT HERO
      ==================================================================== */}

      <section
        className="relative overflow-hidden rounded-[26px] border border-[#D4AF37]/25 bg-[var(--card)] shadow-[0_10px_32px_rgba(11,16,32,0.06)]"
        style={{
          backgroundImage: BRAND_WASH,
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: GOLD_GRADIENT,
            opacity: 0.8,
          }}
        />

        <div className="p-5 lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <ClientLogo client={client} />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-semibold tracking-tight text-[var(--text)] lg:text-2xl">
                    {title}
                  </h2>

                  <StatusBadge status={client.status} />

                  <PriorityBadge priority={client.priority} />

                  {client.integrationLive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/25 bg-teal-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-teal-700 dark:text-teal-300">
                      <ShieldCheck size={11} />
                      Integrated
                    </span>
                  ) : null}
                </div>

                <p className="mt-1.5 text-sm text-[var(--muted)]">
                  {[
                    client.industry,
                    location,
                    client.clientRef,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Syntra Grid client"}
                </p>

                {client.description ? (
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                    {client.description}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck size={13} />
                    {formatEnum(client.relationshipType)}
                  </span>

                  {client.domain ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Globe2 size={13} />
                      {client.domain}
                    </span>
                  ) : null}

                  {client.relationshipStartedAt ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock size={13} />
                      Since {formatDate(client.relationshipStartedAt)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadClient(true)}
                disabled={refreshing}
                className={cx(
                  "inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-xs font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/45 hover:bg-[var(--soft)] disabled:opacity-50",
                  FOCUS_RING,
                )}
              >
                <RefreshCw
                  size={14}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>

              {client.websiteUrl ? (
                <a
                  href={client.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cx(
                    "inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-xs font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/45 hover:bg-[var(--soft)]",
                    FOCUS_RING,
                  )}
                >
                  <Globe2 size={14} />
                  Website
                  <ExternalLink size={12} />
                </a>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  push(
                    "info",
                    "Client editing will connect to the PATCH client API next.",
                  )
                }
                style={{
                  background: GOLD_GRADIENT,
                  boxShadow: GOLD_SHADOW,
                }}
                className={cx(
                  "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition hover:brightness-[1.04]",
                  FOCUS_RING,
                )}
              >
                <Pencil
                  size={14}
                  color={GOLD_INK}
                />

                <span style={{ color: GOLD_INK }}>
                  Edit client
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* =================================================================
            CLIENT 360 NAVIGATION
        ================================================================== */}

        <div className="border-t border-[var(--border)] bg-[var(--card)]/70 px-3 backdrop-blur-sm lg:px-5">
          <div className="no-scrollbar flex overflow-x-auto">
            {WORKSPACE_TABS.map((tab) => {
              const active = tab.id === activeTab;

              let count: number | undefined;

              if (tab.id === "contacts") {
                count = client._count.contacts;
              }

              if (tab.id === "projects") {
                count = client._count.projects;
              }

              if (tab.id === "support") {
                count = client.openSupportCount ?? client._count.tickets;
              }

              if (tab.id === "systems") {
                count = totalSystems;
              }

              if (tab.id === "commercial") {
                count = client._count.invoices;
              }

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cx(
                    "relative flex h-14 shrink-0 items-center gap-2 px-3 text-xs font-semibold transition lg:px-4",
                    active
                      ? "text-[var(--text)]"
                      : "text-[var(--muted)] hover:text-[var(--text)]",
                    FOCUS_RING,
                  )}
                >
                  <span
                    className={cx(
                      "transition",
                      active &&
                        "text-[#B8912A] dark:text-[#F3DFA2]",
                    )}
                  >
                    {tab.icon}
                  </span>

                  {tab.label}

                  {typeof count === "number" && count > 0 ? (
                    <span
                      className={cx(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                        active
                          ? "bg-[#D4AF37]/15 text-[#8A6A12] dark:text-[#F3DFA2]"
                          : "bg-[var(--soft)] text-[var(--muted)]",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}

                  {active ? (
                    <span
                      className="absolute inset-x-3 bottom-0 h-[2px] rounded-full"
                      style={{
                        background: GOLD_GRADIENT,
                      }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================================================================
          TAB CONTENT
      ==================================================================== */}

      {activeTab === "overview" ? (
        <OverviewWorkspace
          client={client}
          primaryContact={primaryContact}
          totalIncidents={totalIncidents}
          totalSystems={totalSystems}
          onCopy={copyValue}
          onNavigate={setActiveTab}
        />
      ) : null}

      {activeTab === "contacts" ? (
        <ContactsWorkspace
          client={client}
          onAdd={() =>
            push(
              "info",
              "The contact creation drawer will connect to the contacts API next.",
            )
          }
        />
      ) : null}

      {activeTab === "projects" ? (
        <ProjectsWorkspace client={client} />
      ) : null}

      {activeTab === "commercial" ? (
        <CommercialWorkspace client={client} />
      ) : null}

      {activeTab === "support" ? (
        <ComingSoonWorkspace
          icon={<LifeBuoy size={22} />}
          eyebrow="Client Success"
          title="Support"
          description={`Support activity for ${title} will live here. This view will connect directly to the global Support and Tickets modules using this client as the filter.`}
          stats={[
            {
              label: "Tickets",
              value: client._count.tickets,
            },
            {
              label: "Open support",
              value: client.openSupportCount ?? 0,
            },
          ]}
        />
      ) : null}

      {activeTab === "meetings" ? (
        <ComingSoonWorkspace
          icon={<MessageSquareText size={22} />}
          eyebrow="Relationship"
          title="Meetings"
          description={`Meeting notes, decisions, actions and follow-ups for ${title} will appear here once the Meetings model is connected.`}
          stats={[
            {
              label: "Client",
              value: title,
            },
            {
              label: "Owner",
              value: personName(client.accountOwner),
            },
          ]}
        />
      ) : null}

      {activeTab === "systems" ? (
        <SystemsWorkspace
          client={client}
          totalSystems={totalSystems}
          totalIncidents={totalIncidents}
        />
      ) : null}

      {activeTab === "documents" ? (
        <ComingSoonWorkspace
          icon={<FileText size={22} />}
          eyebrow="Knowledge"
          title="Documents"
          description={`Contracts, briefs, handover material, reports and client-specific documents for ${title} will be organised here.`}
          stats={[
            {
              label: "Workspace",
              value: "Ready",
            },
          ]}
        />
      ) : null}
    </div>
  );
}

/* =============================================================================
   OVERVIEW
============================================================================= */

function OverviewWorkspace({
  client,
  primaryContact,
  totalIncidents,
  totalSystems,
  onCopy,
  onNavigate,
}: {
  client: ClientRecord;
  primaryContact: ClientContact | null;
  totalIncidents: number;
  totalSystems: number;
  onCopy: (value: string, message: string) => void;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const title = client.displayName || client.name;

  const renewalDays = daysUntil(client.renewalAt);

  const renewalAttention =
    renewalDays !== null && renewalDays <= 60;

  const openSupport =
    client.openSupportCount ?? 0;

  return (
    <div className="space-y-4">
      {/* ===================================================================
          KPIs
      ==================================================================== */}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewMetric
          icon={<BriefcaseBusiness size={17} />}
          label="Projects"
          value={client._count.projects}
          detail="Connected delivery"
          onClick={() => onNavigate("projects")}
        />

        <OverviewMetric
          icon={<Users size={17} />}
          label="Contacts"
          value={client._count.contacts}
          detail="Client people"
          onClick={() => onNavigate("contacts")}
        />

        <OverviewMetric
          icon={<LifeBuoy size={17} />}
          label="Open support"
          value={openSupport}
          detail={
            openSupport > 0
              ? "Needs attention"
              : "Nothing outstanding"
          }
          attention={openSupport > 0}
          onClick={() => onNavigate("support")}
        />

        <OverviewMetric
          icon={<Network size={17} />}
          label="Systems"
          value={totalSystems}
          detail={
            totalIncidents > 0
              ? `${totalIncidents} recorded incidents`
              : "Operational estate"
          }
          attention={totalIncidents > 0}
          onClick={() => onNavigate("systems")}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <div className="space-y-4">
          {/* ===============================================================
              RELATIONSHIP
          ================================================================ */}

          <WorkspaceCard
            title="Relationship overview"
            description="The commercial and operational relationship at a glance."
            icon={<ShieldCheck size={16} />}
          >
            <div className="grid gap-x-8 sm:grid-cols-2">
              <DetailRow
                label="Relationship"
                value={formatEnum(client.relationshipType)}
              />

              <DetailRow
                label="Status"
                value={formatEnum(client.status)}
              />

              <DetailRow
                label="Priority"
                value={formatEnum(client.priority)}
              />

              <DetailRow
                label="Account owner"
                value={personName(client.accountOwner)}
              />

              <DetailRow
                label="Relationship started"
                value={formatDate(
                  client.relationshipStartedAt,
                )}
              />

              <DetailRow
                label="Went live"
                value={formatDate(client.liveSince)}
              />

              <DetailRow
                label="Billing cycle"
                value={formatEnum(client.billingCycle)}
              />

              <DetailRow
                label="Contract value"
                value={
                  Number(client.contractValue || 0) > 0
                    ? formatMoney(
                        client.contractValue,
                        client.currency,
                      )
                    : "No fixed value"
                }
              />

              <DetailRow
                label="Renewal"
                value={renewalText(client.renewalAt)}
                attention={renewalAttention}
              />

              <DetailRow
                label="Reference"
                value={client.clientRef || "Not assigned"}
              />
            </div>
          </WorkspaceCard>

          {/* ===============================================================
              PROJECTS
          ================================================================ */}

          <WorkspaceCard
            title="Projects"
            description="Delivery work connected to this client."
            icon={<BriefcaseBusiness size={16} />}
            action={
              <button
                type="button"
                onClick={() => onNavigate("projects")}
                className={cx(
                  "inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[#B8912A]",
                  FOCUS_RING,
                  "rounded-md",
                )}
              >
                View all
                <ArrowRight size={12} />
              </button>
            }
          >
            {client.projects.length === 0 ? (
              <CompactEmpty
                icon={<BriefcaseBusiness size={18} />}
                title="No projects connected"
                description="Projects created for this organisation will appear here."
              />
            ) : (
              <div className="space-y-2">
                {client.projects.slice(0, 4).map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                  />
                ))}
              </div>
            )}
          </WorkspaceCard>
        </div>

        <div className="space-y-4">
          {/* ===============================================================
              OWNER
          ================================================================ */}

          <WorkspaceCard
            title="Account owner"
            description="Internal relationship owner."
            icon={<UserRound size={16} />}
          >
            <OwnerProfile owner={client.accountOwner} />
          </WorkspaceCard>

          {/* ===============================================================
              PRIMARY CONTACT
          ================================================================ */}

          <WorkspaceCard
            title="Primary contact"
            description="The main person Syntra Grid speaks with."
            icon={<ContactRound size={16} />}
            action={
              <button
                type="button"
                onClick={() => onNavigate("contacts")}
                className={cx(
                  "text-xs font-semibold text-[var(--muted)] transition hover:text-[#B8912A]",
                  FOCUS_RING,
                  "rounded-md",
                )}
              >
                Contacts
              </button>
            }
          >
            {primaryContact ? (
              <PrimaryContact
                contact={primaryContact}
                onCopy={onCopy}
              />
            ) : (
              <CompactEmpty
                icon={<Users size={18} />}
                title="No contact yet"
                description="Add the person your team works with most often."
              />
            )}
          </WorkspaceCard>

          {/* ===============================================================
              CLIENT DETAILS
          ================================================================ */}

          <WorkspaceCard
            title="Client details"
            description="Quick reference information."
            icon={<Building2 size={16} />}
          >
            <div className="space-y-3">
              <CompactDetail
                icon={<Building2 size={14} />}
                label="Legal / company name"
                value={client.name}
              />

              <CompactDetail
                icon={<BriefcaseBusiness size={14} />}
                label="Industry"
                value={client.industry || "Not set"}
              />

              <CompactDetail
                icon={<MapPin size={14} />}
                label="Location"
                value={
                  [client.city, client.country]
                    .filter(Boolean)
                    .join(", ") || "Not set"
                }
              />

              <CompactDetail
                icon={<Globe2 size={14} />}
                label="Domain"
                value={client.domain || "Not set"}
              />
            </div>
          </WorkspaceCard>
        </div>
      </div>

      {/* ===================================================================
          OPERATIONAL SNAPSHOT
      ==================================================================== */}

      <WorkspaceCard
        title="Operational snapshot"
        description={`A high-level view of ${title}'s Syntra Grid footprint.`}
        icon={<Activity size={16} />}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OperationalCard
            icon={<Server size={16} />}
            label="Systems"
            value={totalSystems}
            detail="Connected integrations"
          />

          <OperationalCard
            icon={<TicketCheck size={16} />}
            label="Support"
            value={client._count.tickets}
            detail="Recorded tickets"
          />

          <OperationalCard
            icon={<FileText size={16} />}
            label="Invoices"
            value={client._count.invoices}
            detail="Commercial records"
          />

          <OperationalCard
            icon={<AlertCircle size={16} />}
            label="Incidents"
            value={totalIncidents}
            detail="Across connected projects"
            attention={totalIncidents > 0}
          />
        </div>
      </WorkspaceCard>
    </div>
  );
}

/* =============================================================================
   CONTACTS
============================================================================= */

function ContactsWorkspace({
  client,
  onAdd,
}: {
  client: ClientRecord;
  onAdd: () => void;
}) {
  return (
    <WorkspaceCard
      title="Contacts"
      description={`People connected to ${client.displayName || client.name}.`}
      icon={<ContactRound size={16} />}
      action={
        <button
          type="button"
          onClick={onAdd}
          style={{
            background: GOLD_GRADIENT,
          }}
          className={cx(
            "inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition hover:brightness-[1.04]",
            FOCUS_RING,
          )}
        >
          <Plus
            size={14}
            color={GOLD_INK}
          />

          <span style={{ color: GOLD_INK }}>
            Add contact
          </span>
        </button>
      }
    >
      {client.contacts.length === 0 ? (
        <LargeEmpty
          icon={<Users size={22} />}
          title="No client contacts yet"
          description="Add decision makers, finance contacts, technical stakeholders and anyone else involved in the relationship."
          actionLabel="Add contact"
          onAction={onAdd}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {client.contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
            />
          ))}
        </div>
      )}
    </WorkspaceCard>
  );
}

function ContactCard({
  contact,
}: {
  contact: ClientContact;
}) {
  const name = contactName(contact);

  return (
    <article className="rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[#D4AF37]/35">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/30 text-xs font-bold text-[#8A6A12] dark:text-[#F3DFA2]"
            style={{
              backgroundImage: BRAND_WASH_SOFT,
            }}
          >
            {initials(name) || "CT"}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-sm font-semibold text-[var(--text)]">
                {name}
              </h4>

              {contact.primary ? (
                <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#8A6A12] dark:text-[#F3DFA2]">
                  Primary
                </span>
              ) : null}
            </div>

            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
              {contact.jobTitle ||
                formatEnum(contact.role)}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label={`More options for ${name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-2 text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            <Mail
              size={13}
              className="shrink-0"
            />
            <span className="truncate">
              {contact.email}
            </span>
          </a>
        ) : null}

        {contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-2 text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            <Phone
              size={13}
              className="shrink-0"
            />
            <span className="truncate">
              {contact.phone}
            </span>
          </a>
        ) : null}
      </div>

      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <span className="inline-flex rounded-full bg-[var(--soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--muted)]">
          {formatEnum(contact.role)}
        </span>
      </div>
    </article>
  );
}

/* =============================================================================
   PROJECTS
============================================================================= */

function ProjectsWorkspace({
  client,
}: {
  client: ClientRecord;
}) {
  return (
    <WorkspaceCard
      title="Projects"
      description={`Delivery work and systems Syntra Grid manages for ${
        client.displayName || client.name
      }.`}
      icon={<BriefcaseBusiness size={16} />}
      action={
        <button
          type="button"
          className={cx(
            "inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-xs font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/45",
            FOCUS_RING,
          )}
        >
          <Plus size={14} />
          New project
        </button>
      }
    >
      {client.projects.length === 0 ? (
        <LargeEmpty
          icon={<BriefcaseBusiness size={22} />}
          title="No projects connected"
          description="Once a project is created for this client it will appear here with its systems, deployments, health and incidents."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {client.projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
            />
          ))}
        </div>
      )}
    </WorkspaceCard>
  );
}

function ProjectCard({
  project,
}: {
  project: ClientProject;
}) {
  return (
    <article className="rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[#D4AF37]/40">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/25 text-[#B8912A]"
            style={{
              backgroundImage: BRAND_WASH_SOFT,
            }}
          >
            <BriefcaseBusiness size={17} />
          </div>

          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-[var(--text)]">
              {project.name}
            </h4>

            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
              {formatEnum(project.category)}
            </p>
          </div>
        </div>

        <span className="rounded-full border border-[var(--border)] bg-[var(--soft)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
          {formatEnum(project.status)}
        </span>
      </div>

      {project.description ? (
        <p className="mt-4 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
          {project.description}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <SmallCount
          label="Systems"
          value={project._count?.integrations ?? 0}
        />

        <SmallCount
          label="Deploys"
          value={project._count?.deployments ?? 0}
        />

        <SmallCount
          label="Incidents"
          value={project._count?.incidents ?? 0}
          attention={
            (project._count?.incidents ?? 0) > 0
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
        {project.productionUrl ? (
          <a
            href={project.productionUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]"
          >
            <Globe2 size={12} />
            Production
          </a>
        ) : null}

        {project.repositoryUrl ? (
          <a
            href={project.repositoryUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]"
          >
            <Network size={12} />
            Repository
          </a>
        ) : null}

        {project.adminUrl ? (
          <a
            href={project.adminUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]"
          >
            <ExternalLink size={12} />
            Admin
          </a>
        ) : null}
      </div>
    </article>
  );
}

/* =============================================================================
   COMMERCIAL
============================================================================= */

function CommercialWorkspace({
  client,
}: {
  client: ClientRecord;
}) {
  const invoices = client.invoices ?? [];

  const billing = client.billing;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CommercialMetric
          label="Contract value"
          value={
            Number(client.contractValue || 0) > 0
              ? formatMoney(
                  client.contractValue,
                  client.currency,
                )
              : "No fixed value"
          }
          icon={<CircleDollarSign size={17} />}
        />

        <CommercialMetric
          label="Total paid"
          value={
            billing
              ? formatMoney(
                  billing.totalPaid,
                  client.currency,
                )
              : "Not available"
          }
          icon={<CheckCircle2 size={17} />}
        />

        <CommercialMetric
          label="Outstanding"
          value={
            billing
              ? formatMoney(
                  billing.outstandingAmount,
                  client.currency,
                )
              : "Not available"
          }
          icon={<Banknote size={17} />}
          attention={
            Boolean(
              billing &&
                Number(billing.outstandingAmount) > 0,
            )
          }
        />

        <CommercialMetric
          label="Renewal"
          value={renewalText(client.renewalAt)}
          icon={<CalendarClock size={17} />}
          attention={
            (daysUntil(client.renewalAt) ?? 999) <= 60
          }
        />
      </section>

      <WorkspaceCard
        title="Commercial relationship"
        description="High-level commercial information stored against this client."
        icon={<CircleDollarSign size={16} />}
      >
        <div className="grid gap-x-8 sm:grid-cols-2">
          <DetailRow
            label="Billing cycle"
            value={formatEnum(client.billingCycle)}
          />

          <DetailRow
            label="Currency"
            value={client.currency}
          />

          <DetailRow
            label="Contract value"
            value={
              Number(client.contractValue || 0) > 0
                ? formatMoney(
                    client.contractValue,
                    client.currency,
                  )
                : "No fixed value"
            }
          />

          <DetailRow
            label="Renewal"
            value={formatDate(client.renewalAt)}
          />

          {billing ? (
            <>
              <DetailRow
                label="Last invoice"
                value={
                  billing.lastInvoiceRef || "Not set"
                }
              />

              <DetailRow
                label="Last invoice date"
                value={formatDate(
                  billing.lastInvoiceAt,
                )}
              />

              <DetailRow
                label="Invoice status"
                value={
                  billing.lastInvoiceStatus
                    ? formatEnum(
                        billing.lastInvoiceStatus,
                      )
                    : "Not set"
                }
              />

              <DetailRow
                label="Total paid"
                value={formatMoney(
                  billing.totalPaid,
                  client.currency,
                )}
              />
            </>
          ) : null}
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        title="Invoices"
        description="Recent invoice records for this client."
        icon={<FileText size={16} />}
      >
        {invoices.length === 0 ? (
          <CompactEmpty
            icon={<FileText size={18} />}
            title="No invoices"
            description="Invoices connected to this client will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <TableHeading>
                    Reference
                  </TableHeading>
                  <TableHeading>
                    Status
                  </TableHeading>
                  <TableHeading>
                    Issued
                  </TableHeading>
                  <TableHeading>
                    Due
                  </TableHeading>
                  <TableHeading align="right">
                    Total
                  </TableHeading>
                  <TableHeading align="right">
                    Balance
                  </TableHeading>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <TableCell>
                      <div className="font-semibold text-[var(--text)]">
                        {invoice.invoiceRef}
                      </div>

                      {invoice.description ? (
                        <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-[var(--muted)]">
                          {invoice.description}
                        </div>
                      ) : null}
                    </TableCell>

                    <TableCell>
                      {formatEnum(invoice.status)}
                    </TableCell>

                    <TableCell>
                      {formatDate(invoice.issuedAt)}
                    </TableCell>

                    <TableCell>
                      {formatDate(invoice.dueAt)}
                    </TableCell>

                    <TableCell align="right">
                      {formatMoney(
                        invoice.total,
                        invoice.currency,
                      )}
                    </TableCell>

                    <TableCell align="right">
                      {formatMoney(
                        invoice.balance,
                        invoice.currency,
                      )}
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WorkspaceCard>

      <div className="flex items-start gap-3 rounded-[20px] border border-[#D4AF37]/25 p-4"
        style={{ backgroundImage: BRAND_WASH_SOFT }}
      >
        <ShieldCheck
          size={16}
          className="mt-0.5 shrink-0 text-[#B8912A]"
        />

        <p className="text-xs leading-5 text-[var(--muted)]">
          Fixed contract value is only a summary field. Revenue share,
          ownership, equity or other commercial arrangements should be
          represented separately when the Contracts and Commercial models are
          connected.
        </p>
      </div>
    </div>
  );
}

/* =============================================================================
   SYSTEMS
============================================================================= */

function SystemsWorkspace({
  client,
  totalSystems,
  totalIncidents,
}: {
  client: ClientRecord;
  totalSystems: number;
  totalIncidents: number;
}) {
  const deployments = client.projects.reduce(
    (total, project) =>
      total + (project._count?.deployments ?? 0),
    0,
  );

  const healthChecks = client.projects.reduce(
    (total, project) =>
      total + (project._count?.healthChecks ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewMetric
          icon={<Network size={17} />}
          label="Integrations"
          value={totalSystems}
          detail="Connected systems"
        />

        <OverviewMetric
          icon={<Activity size={17} />}
          label="Health checks"
          value={healthChecks}
          detail="Monitoring records"
        />

        <OverviewMetric
          icon={<Server size={17} />}
          label="Deployments"
          value={deployments}
          detail="Across projects"
        />

        <OverviewMetric
          icon={<AlertCircle size={17} />}
          label="Incidents"
          value={totalIncidents}
          detail={
            totalIncidents > 0
              ? "Review required"
              : "No incidents"
          }
          attention={totalIncidents > 0}
        />
      </section>

      <WorkspaceCard
        title="Project infrastructure"
        description="The technical footprint connected to each client project."
        icon={<Server size={16} />}
      >
        {client.projects.length === 0 ? (
          <CompactEmpty
            icon={<Server size={18} />}
            title="No infrastructure yet"
            description="Technical systems will appear once projects and integrations are connected."
          />
        ) : (
          <div className="space-y-3">
            {client.projects.map((project) => (
              <div
                key={project.id}
                className="rounded-[20px] border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text)]">
                      {project.name}
                    </h4>

                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {[
                        project.framework,
                        project.hostingProvider,
                        project.databaseType
                          ? formatEnum(
                              project.databaseType,
                            )
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") ||
                        "Technical metadata not set"}
                    </p>
                  </div>

                  <span className="self-start rounded-full border border-[var(--border)] bg-[var(--soft)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)] sm:self-auto">
                    {formatEnum(project.status)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SmallCount
                    label="Systems"
                    value={
                      project._count?.integrations ?? 0
                    }
                  />

                  <SmallCount
                    label="Deployments"
                    value={
                      project._count?.deployments ?? 0
                    }
                  />

                  <SmallCount
                    label="Health"
                    value={
                      project._count?.healthChecks ?? 0
                    }
                  />

                  <SmallCount
                    label="Incidents"
                    value={
                      project._count?.incidents ?? 0
                    }
                    attention={
                      (project._count?.incidents ??
                        0) > 0
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspaceCard>
    </div>
  );
}

/* =============================================================================
   GENERIC COMING SOON WORKSPACE
============================================================================= */

function ComingSoonWorkspace({
  icon,
  eyebrow,
  title,
  description,
  stats = [],
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  stats?: Array<{
    label: string;
    value: string | number;
  }>;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-[26px] border border-[var(--border)] bg-[var(--card)] px-6 py-14 text-center shadow-sm"
      style={{
        backgroundImage: BRAND_WASH_SOFT,
      }}
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D4AF37]/15 blur-3xl" />

      <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[var(--card)] text-[#B8912A] dark:text-[#F3DFA2]">
        {icon}
      </div>

      <div className="relative mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B8912A] dark:text-[#F3DFA2]">
        {eyebrow}
      </div>

      <h3 className="relative mt-2 text-xl font-semibold tracking-tight text-[var(--text)]">
        {title}
      </h3>

      <p className="relative mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>

      {stats.length > 0 ? (
        <div className="relative mx-auto mt-7 grid max-w-lg gap-3 sm:grid-cols-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="text-lg font-semibold text-[var(--text)]">
                {stat.value}
              </div>

              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* =============================================================================
   SHARED CARDS
============================================================================= */

function WorkspaceCard({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-4 lg:px-5">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/25 text-[#B8912A] dark:text-[#F3DFA2]"
              style={{
                backgroundImage: BRAND_WASH_SOFT,
              }}
            >
              {icon}
            </div>
          ) : null}

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text)]">
              {title}
            </h3>

            {description ? (
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {action ? (
          <div className="shrink-0">
            {action}
          </div>
        ) : null}
      </div>

      <div className="p-4 lg:p-5">
        {children}
      </div>
    </section>
  );
}

function OverviewMetric({
  icon,
  label,
  value,
  detail,
  attention,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  attention?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cx(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            attention
              ? "bg-[#D4AF37]/12 text-[#B8912A] dark:text-[#F3DFA2]"
              : "bg-[var(--soft)] text-[var(--text)]",
          )}
        >
          {icon}
        </span>

        {onClick ? (
          <ArrowRight
            size={13}
            className="text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[#B8912A]"
          />
        ) : null}
      </div>

      <div className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text)]">
        {value}
      </div>

      <div className="mt-1 text-xs font-semibold text-[var(--text)]">
        {label}
      </div>

      <div
        className={cx(
          "mt-1 text-[10px]",
          attention
            ? "font-semibold text-[#B8912A] dark:text-[#F3DFA2]"
            : "text-[var(--muted)]",
        )}
      >
        {detail}
      </div>
    </>
  );

  const classes = cx(
    "group rounded-[20px] border bg-[var(--card)] p-4 text-left shadow-sm transition",
    attention
      ? "border-[#D4AF37]/35"
      : "border-[var(--border)]",
    onClick &&
      "hover:-translate-y-0.5 hover:border-[#D4AF37]/40 hover:shadow-[0_12px_28px_rgba(212,175,55,0.12)]",
  );

  if (!onClick) {
    return (
      <div className={classes}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        classes,
        FOCUS_RING,
      )}
    >
      {content}
    </button>
  );
}

function CommercialMetric({
  label,
  value,
  icon,
  attention,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  attention?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-[20px] border bg-[var(--card)] p-4 shadow-sm",
        attention
          ? "border-[#D4AF37]/35"
          : "border-[var(--border)]",
      )}
    >
      <span
        className={cx(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          attention
            ? "bg-[#D4AF37]/12 text-[#B8912A] dark:text-[#F3DFA2]"
            : "bg-[var(--soft)] text-[var(--text)]",
        )}
      >
        {icon}
      </span>

      <div className="mt-4 truncate text-lg font-semibold text-[var(--text)]">
        {value}
      </div>

      <div className="mt-1 text-xs text-[var(--muted)]">
        {label}
      </div>
    </div>
  );
}

function OperationalCard({
  icon,
  label,
  value,
  detail,
  attention,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  attention?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-[18px] border p-4",
        attention
          ? "border-[#D4AF37]/35 bg-[#D4AF37]/[0.05]"
          : "border-[var(--border)] bg-[var(--soft)]/50",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={
            attention
              ? "text-[#B8912A] dark:text-[#F3DFA2]"
              : "text-[var(--muted)]"
          }
        >
          {icon}
        </span>

        <span className="text-lg font-semibold text-[var(--text)]">
          {value}
        </span>
      </div>

      <div className="mt-4 text-xs font-semibold text-[var(--text)]">
        {label}
      </div>

      <div className="mt-1 text-[10px] text-[var(--muted)]">
        {detail}
      </div>
    </div>
  );
}

/* =============================================================================
   DETAIL COMPONENTS
============================================================================= */

function DetailRow({
  label,
  value,
  attention,
}: {
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-[var(--border)] py-3.5 last:border-b-0">
      <span className="text-xs text-[var(--muted)]">
        {label}
      </span>

      <span
        className={cx(
          "text-right text-xs font-semibold",
          attention
            ? "text-[#B8912A] dark:text-[#F3DFA2]"
            : "text-[var(--text)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function CompactDetail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-[var(--muted)]">
        {icon}
      </span>

      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {label}
        </div>

        <div className="mt-1 break-words text-xs font-medium text-[var(--text)]">
          {value}
        </div>
      </div>
    </div>
  );
}

function OwnerProfile({
  owner,
}: {
  owner: AccountOwner | null;
}) {
  if (!owner) {
    return (
      <CompactEmpty
        icon={<UserRound size={18} />}
        title="No account owner"
        description="Assign a Syntra Grid team member to own the relationship."
      />
    );
  }

  const name = personName(owner);

  return (
    <div className="flex items-center gap-3">
      <OwnerAvatar owner={owner} />

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-[var(--text)]">
          {name}
        </div>

        <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
          {owner.email}
        </div>

        {owner.role ? (
          <span className="mt-2 inline-flex rounded-full bg-[var(--soft)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
            {formatEnum(owner.role)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PrimaryContact({
  contact,
  onCopy,
}: {
  contact: ClientContact;
  onCopy: (value: string, message: string) => void;
}) {
  const name = contactName(contact);

  return (
    <div>
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/30 text-xs font-bold text-[#8A6A12] dark:text-[#F3DFA2]"
          style={{
            backgroundImage: BRAND_WASH_SOFT,
          }}
        >
          {initials(name) || "CT"}
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--text)]">
            {name}
          </div>

          <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
            {contact.jobTitle ||
              formatEnum(contact.role)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {contact.email ? (
          <>
            <a
              href={`mailto:${contact.email}`}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--soft)] px-2.5 text-[10px] font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/35",
                FOCUS_RING,
              )}
            >
              <Mail size={12} />
              Email
            </a>

            <button
              type="button"
              onClick={() =>
                onCopy(
                  contact.email as string,
                  "Contact email copied.",
                )
              }
              className={cx(
                "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--soft)] text-[var(--muted)] transition hover:border-[#D4AF37]/35 hover:text-[var(--text)]",
                FOCUS_RING,
              )}
              aria-label="Copy email"
            >
              <Copy size={12} />
            </button>
          </>
        ) : null}

        {contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--soft)] px-2.5 text-[10px] font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/35",
              FOCUS_RING,
            )}
          >
            <Phone size={12} />
            Call
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ProjectRow({
  project,
}: {
  project: ClientProject;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:border-[#D4AF37]/30">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#B8912A]"
        style={{
          backgroundImage: BRAND_WASH_SOFT,
        }}
      >
        <BriefcaseBusiness size={15} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-[var(--text)]">
          {project.name}
        </div>

        <div className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
          {formatEnum(project.category)} ·{" "}
          {formatEnum(project.status)}
        </div>
      </div>

      <ArrowRight
        size={13}
        className="shrink-0 text-[var(--muted)]"
      />
    </div>
  );
}

function SmallCount({
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
          ? "border-[#D4AF37]/30 bg-[#D4AF37]/[0.06]"
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

      <div className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
    </div>
  );
}

/* =============================================================================
   LOGOS / AVATARS / BADGES
============================================================================= */

function ClientLogo({
  client,
}: {
  client: ClientRecord;
}) {
  const title = client.displayName || client.name;

  if (client.logoUrl) {
    return (
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#D4AF37]/25 bg-white shadow-sm lg:h-16 lg:w-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={client.logoUrl}
          alt=""
          className="h-full w-full object-contain p-2"
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/30 text-base font-bold text-[#8A6A12] dark:text-[#F3DFA2] lg:h-16 lg:w-16"
      style={{
        backgroundImage: BRAND_WASH_SOFT,
      }}
    >
      {initials(title) || "CL"}
    </div>
  );
}

function OwnerAvatar({
  owner,
}: {
  owner: AccountOwner | null;
}) {
  if (owner?.avatarUrl) {
    return (
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--card)]">
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
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
        owner
          ? "border-[#D4AF37]/30 text-[#8A6A12] dark:text-[#F3DFA2]"
          : "border-dashed border-[var(--border)] text-[var(--muted)]",
      )}
      style={
        owner
          ? {
              backgroundImage: BRAND_WASH_SOFT,
            }
          : undefined
      }
    >
      {owner ? (
        initials(personName(owner))
      ) : (
        <UserRound size={15} />
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: ClientStatus;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em]",
        statusClasses(status),
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {formatEnum(status)}
    </span>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: ClientPriority;
}) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em]",
        priorityClasses(priority),
      )}
    >
      {formatEnum(priority)}
    </span>
  );
}

/* =============================================================================
   EMPTY STATES
============================================================================= */

function CompactEmpty({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--soft)]/50 p-5 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--card)] text-[var(--muted)]">
        {icon}
      </div>

      <div className="mt-3 text-xs font-semibold text-[var(--text)]">
        {title}
      </div>

      <p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-[var(--muted)]">
        {description}
      </p>
    </div>
  );
}

function LargeEmpty({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="rounded-[22px] border border-dashed border-[#D4AF37]/30 px-6 py-12 text-center"
      style={{
        backgroundImage: BRAND_WASH_SOFT,
      }}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[var(--card)] text-[#B8912A] dark:text-[#F3DFA2]">
        {icon}
      </div>

      <h4 className="mt-4 text-sm font-semibold text-[var(--text)]">
        {title}
      </h4>

      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[var(--muted)]">
        {description}
      </p>

      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className={cx(
            "mt-5 inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-xs font-semibold text-[var(--text)] transition hover:border-[#D4AF37]/40",
            FOCUS_RING,
          )}
        >
          <Plus size={13} />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

/* =============================================================================
   TABLE
============================================================================= */

function TableHeading({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cx(
        "px-3 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={cx(
        "px-3 py-3 text-xs text-[var(--muted)]",
        align === "right" && "text-right",
      )}
    >
      {children}
    </td>
  );
}

/* =============================================================================
   LOADING / ERROR
============================================================================= */

function WorkspaceLoading() {
  return (
    <div className="space-y-4">
      <div className="h-9 w-28 animate-pulse rounded-xl bg-[var(--soft)]" />

      <div className="h-[220px] animate-pulse rounded-[26px] border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-[var(--soft)]" />

          <div className="flex-1 space-y-3">
            <div className="h-5 w-48 rounded bg-[var(--soft)]" />
            <div className="h-3 w-64 rounded bg-[var(--soft)]" />
            <div className="h-3 w-3/4 rounded bg-[var(--soft)]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-[20px] border border-[var(--border)] bg-[var(--card)]"
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="h-80 animate-pulse rounded-[24px] border border-[var(--border)] bg-[var(--card)]" />
        <div className="h-80 animate-pulse rounded-[24px] border border-[var(--border)] bg-[var(--card)]" />
      </div>
    </div>
  );
}

function WorkspaceError({
  message,
  onBack,
  onRetry,
}: {
  message: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className={cx(
          "inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]",
          FOCUS_RING,
        )}
      >
        <ArrowLeft size={14} />
        All clients
      </button>

      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[26px] border border-red-500/20 bg-red-500/[0.04] px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
          <AlertCircle size={23} />
        </div>

        <h3 className="mt-5 text-lg font-semibold text-[var(--text)]">
          Client workspace could not be loaded
        </h3>

        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
          {message}
        </p>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className={cx(
              "inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-xs font-semibold text-[var(--text)]",
              FOCUS_RING,
            )}
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <button
            type="button"
            onClick={onRetry}
            style={{
              background: GOLD_GRADIENT,
            }}
            className={cx(
              "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold",
              FOCUS_RING,
            )}
          >
            <RefreshCw
              size={14}
              color={GOLD_INK}
            />

            <span style={{ color: GOLD_INK }}>
              Try again
            </span>
          </button>
        </div>
      </div>
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
            toast.tone === "success" &&
              "border-[#D4AF37]/40",
            toast.tone === "error" &&
              "border-red-500/30",
            toast.tone === "info" &&
              "border-[var(--border)]",
          )}
        >
          <span
            className={cx(
              "mt-0.5 shrink-0",
              toast.tone === "success" &&
                "text-[#B8912A]",
              toast.tone === "error" &&
                "text-red-600",
              toast.tone === "info" &&
                "text-[var(--muted)]",
            )}
          >
            {toast.tone === "error" ? (
              <AlertCircle size={16} />
            ) : toast.tone === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <Clock3 size={16} />
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