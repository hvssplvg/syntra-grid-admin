"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Headphones,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldQuestion,
  Trash2,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import { ClientMark } from "@/lib/clients/ClientMark";
import { useSelectedClient } from "@/app/components/admin/SelectedClientContext";
import {
  acknowledgeIncidentApi,
  addMonitoredEndpointApi,
  deleteMonitoredEndpointApi,
  fetchClientHealthDetail,
  fetchClientHealthList,
  resolveIncidentApi,
  type ClientHealthDetail,
  type ClientHealthItem,
  type ClientHealthStatus,
  type HealthDimension,
} from "@/lib/client-health/clientHealthApi";

/* ============================================================================
   STYLE CONSTANTS — matches the established Syntra Grid admin look
   (rounded-[xx] cards, var(--line)/var(--surface)/var(--text) tokens)
   used throughout the other tabs.
============================================================================ */

const CARD = "rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
const BTN_PRIMARY = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 text-[11.5px] font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50";
const BTN_SECONDARY = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[11.5px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ============================================================================
   STATUS / DIMENSION METADATA
============================================================================ */

const STATUS_META: Record<ClientHealthStatus, { label: string; colour: string; bg: string; icon: LucideIcon }> = {
  HEALTHY: { label: "Healthy", colour: "#059669", bg: "rgba(5,150,105,0.1)", icon: CheckCircle2 },
  NEEDS_ATTENTION: { label: "Needs Attention", colour: "#d97706", bg: "rgba(217,119,6,0.1)", icon: AlertTriangle },
  AT_RISK: { label: "At Risk", colour: "#dc2626", bg: "rgba(220,38,38,0.1)", icon: AlertTriangle },
  UNKNOWN: { label: "Unknown", colour: "#6b7280", bg: "rgba(107,114,128,0.1)", icon: ShieldQuestion },
};

const DIMENSION_META: Record<HealthDimension, { label: string; icon: LucideIcon }> = {
  monitoring: { label: "Monitoring", icon: Wrench },
  support: { label: "Support", icon: Headphones },
  delivery: { label: "Delivery", icon: Activity },
  commercial: { label: "Commercial", icon: CircleDollarSign },
};

function StatusBadge({ status }: { status: ClientHealthStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
      style={{ color: meta.colour, backgroundColor: meta.bg }}
    >
      <Icon size={12} strokeWidth={2} />
      {meta.label}
    </span>
  );
}

function formatRelativeTime(iso: string | null) {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatMoney(amount: number) {
  return amount.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
}

/* ============================================================================
   MAIN COMPONENT
============================================================================ */

type LoadStatus = "loading" | "ready" | "error";

export default function ClientHealthTab() {
  const searchParams = useSearchParams();
  // Deep-link default filter — set when another workspace navigates here
  // with a specific focus in mind (?focus=monitoring|support|commercial).
  // Purely a starting point: the admin can change it immediately, and it
  // never restricts which clients are fetched beyond what the filter
  // controls below already do.
  const initialFocus = searchParams.get("focus");
  const initialDimension: HealthDimension | "" = initialFocus === "monitoring" || initialFocus === "support" || initialFocus === "delivery" || initialFocus === "commercial" ? initialFocus : "";

  const [items, setItems] = useState<ClientHealthItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ClientHealthStatus | "">("");
  const [dimensionFilter, setDimensionFilter] = useState<HealthDimension | "">(initialDimension);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");

  // The row whose detail panel is open — unrelated to the GLOBAL
  // selected-client switcher below (useSelectedClient), just which row
  // the admin clicked in THIS page's own list.
  const [detailClientId, setDetailClientId] = useState<string | null>(null);

  // The app-wide client-context switcher (header) — when set, this page
  // narrows to just that client, same as every other client-aware view.
  const { selectedClientId, selectClient } = useSelectedClient();

  const load = useCallback(() => {
    setStatus("loading");
    setError(null);
    fetchClientHealthList({
      status: statusFilter || undefined,
      dimension: dimensionFilter || undefined,
      priority: priorityFilter || undefined,
      search: search.trim() || undefined,
      clientId: selectedClientId || undefined,
    })
      .then((result) => {
        setItems(result);
        setStatus("ready");
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Could not load Client Health.");
        setStatus("error");
      });
  }, [statusFilter, dimensionFilter, priorityFilter, search, selectedClientId]);

  useEffect(() => {
    const handle = window.setTimeout(load, search ? 300 : 0);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dimensionFilter, priorityFilter, search, selectedClientId]);

  const summary = useMemo(() => {
    const counts: Record<ClientHealthStatus, number> = { HEALTHY: 0, NEEDS_ATTENTION: 0, AT_RISK: 0, UNKNOWN: 0 };
    for (const item of items) counts[item.health.status] += 1;
    return counts;
  }, [items]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text)]">Client Health</h1>
          <p className="mt-1 max-w-[560px] text-[12px] leading-5 text-[var(--text-muted)]">
            Operational and commercial health for every client, computed from real support tickets, contracts, billing and website monitoring — never decorative numbers.
          </p>
        </div>
        <button type="button" onClick={load} disabled={status === "loading"} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
          <RefreshCw size={13} className={status === "loading" ? "animate-spin" : undefined} />
          Refresh
        </button>
      </div>

      {selectedClientId && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-[11.5px] text-[var(--text-muted)]">
          <span>
            Filtered to <span className="font-semibold text-[var(--text)]">{items[0]?.client.displayName || items[0]?.client.name || "one client"}</span> — set from the header&apos;s client switcher.
          </span>
          <button type="button" onClick={() => selectClient(null)} className={cx(FOCUS, "ml-auto text-[11px] font-semibold text-[var(--accent)] hover:underline")}>
            Show all clients
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(STATUS_META) as ClientHealthStatus[]).map((key) => {
          const meta = STATUS_META[key];
          const Icon = meta.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter((current) => (current === key ? "" : key))}
              className={cx(
                CARD,
                FOCUS,
                "flex items-center gap-3 p-4 text-left transition-colors",
                statusFilter === key ? "ring-2 ring-[var(--accent)]" : "hover:bg-[var(--surface-muted)]",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ color: meta.colour, backgroundColor: meta.bg }}>
                <Icon size={16} />
              </span>
              <span>
                <span className="block text-[18px] font-semibold text-[var(--text)]">{summary[key]}</span>
                <span className="block text-[10.5px] text-[var(--text-muted)]">{meta.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={cx(CARD, "p-4")}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients"
              className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-8 pr-3 text-[12px] text-[var(--text)]")}
            />
          </div>

          <select
            value={dimensionFilter}
            onChange={(event) => setDimensionFilter(event.target.value as HealthDimension | "")}
            className={cx(FOCUS, "h-9 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11.5px] text-[var(--text)]")}
          >
            <option value="">All services</option>
            {(Object.keys(DIMENSION_META) as HealthDimension[]).map((key) => (
              <option key={key} value={key}>
                {DIMENSION_META[key].label}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className={cx(FOCUS, "h-9 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11.5px] text-[var(--text)]")}
          >
            <option value="">All priorities</option>
            <option value="STANDARD">Standard</option>
            <option value="IMPORTANT">Important</option>
            <option value="STRATEGIC">Strategic</option>
          </select>

          {(statusFilter || dimensionFilter || priorityFilter || search) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("");
                setDimensionFilter("");
                setPriorityFilter("");
                setSearch("");
              }}
              className={cx(BTN_SECONDARY, FOCUS, "h-9")}
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className={cx(CARD, "overflow-hidden")}>
        {status === "loading" && items.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-[var(--text-subtle)]" />
          </div>
        )}

        {status === "error" && (
          <div className="p-6 text-center text-[12px] text-[var(--danger)]">{error}</div>
        )}

        {status !== "error" && status !== "loading" && items.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-[13px] font-medium text-[var(--text)]">No clients match these filters.</p>
            <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">Nothing has been fabricated here — adjust the filters or check the CRM for client records.</p>
          </div>
        )}

        {items.length > 0 && (
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-[10.5px] uppercase tracking-wide text-[var(--text-subtle)]">
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Support</th>
                <th className="px-3 py-3 font-semibold">Monitoring</th>
                <th className="px-3 py-3 font-semibold">Next renewal</th>
                <th className="px-3 py-3 font-semibold">Outstanding</th>
                <th className="px-3 py-3 font-semibold">Last checked</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.client.id}
                  onClick={() => setDetailClientId(item.client.id)}
                  className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-muted)]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <ClientMark logo={item.client.logoUrl} name={item.client.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-medium text-[var(--text)]">{item.client.displayName || item.client.name}</span>
                        <span className="block text-[10px] text-[var(--text-subtle)]">{item.client.priority === "STRATEGIC" ? "Strategic" : item.client.priority === "IMPORTANT" ? "Important" : "Standard"}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={item.health.status} />
                  </td>
                  <td className="px-3 py-3 text-[var(--text-muted)]">
                    {item.overdueTicketCount > 0 ? (
                      <span className="font-medium text-[var(--danger)]">{item.overdueTicketCount} overdue</span>
                    ) : item.openTicketCount > 0 ? (
                      `${item.openTicketCount} open`
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 text-[var(--text-muted)]">
                    {item.monitoredEndpointCount > 0 ? `${item.monitoredEndpointCount} endpoint${item.monitoredEndpointCount > 1 ? "s" : ""}` : "Not configured"}
                  </td>
                  <td className="px-3 py-3 text-[var(--text-muted)]">{formatDate(item.nextRenewalAt)}</td>
                  <td className="px-3 py-3 text-[var(--text-muted)]">{item.outstandingAmount > 0 ? formatMoney(item.outstandingAmount) : "—"}</td>
                  <td className="px-3 py-3 text-[var(--text-muted)]">{formatRelativeTime(item.lastCheckedAt)}</td>
                  <td className="px-3 py-3">
                    <ChevronRight size={14} className="text-[var(--text-subtle)]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailClientId && <ClientHealthDetailPanel clientId={detailClientId} onClose={() => setDetailClientId(null)} onChanged={load} />}
    </div>
  );
}

/* ============================================================================
   DETAIL PANEL
============================================================================ */

const SEVERITY_DOT: Record<string, string> = { risk: "#dc2626", attention: "#d97706", info: "#6b7280" };

function ClientHealthDetailPanel({ clientId, onClose, onChanged }: { clientId: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<ClientHealthDetail | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [addEndpointOpen, setAddEndpointOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setStatus("loading");
    fetchClientHealthDetail(clientId)
      .then((result) => {
        setDetail(result);
        setStatus("ready");
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Could not load this client.");
        setStatus("error");
      });
  }, [clientId]);

  useEffect(() => {
    // Fetch-on-mount/clientId-change — reload's own setStatus("loading")
    // is the expected start of that fetch, not a derived-state loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const handleDeleteEndpoint = async (id: string) => {
    setBusyId(id);
    try {
      await deleteMonitoredEndpointApi(id);
      reload();
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const handleAcknowledge = async (id: string) => {
    setBusyId(id);
    try {
      await acknowledgeIncidentApi(id);
      reload();
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const handleResolve = async (id: string) => {
    setBusyId(id);
    try {
      await resolveIncidentApi(id);
      reload();
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div role="dialog" aria-modal aria-label="Client health detail" className="fixed inset-0 z-[300] flex justify-end bg-black/45" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-[560px] flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-popover)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
          <h2 className="text-[14px] font-semibold text-[var(--text)]">{detail ? detail.client.displayName || detail.client.name : "Client health"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={cx(FOCUS, "flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]")}>
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {status === "loading" && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-[var(--text-subtle)]" />
            </div>
          )}

          {status === "error" && <p className="text-[12px] text-[var(--danger)]">{error}</p>}

          {detail && status === "ready" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <ClientMark logo={detail.client.logoUrl} name={detail.client.name} size="md" />
                <StatusBadge status={detail.health.status} />
              </div>

              <section>
                <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Why this status</h3>
                {detail.health.reasons.length === 0 ? (
                  <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                    {detail.health.applicableDimensions.length <= 1
                      ? "Nothing is configured yet for this client — there's no evidence either way."
                      : "No issues found across everything that's applicable to this client."}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {detail.health.reasons.map((reason, index) => {
                      const Icon = DIMENSION_META[reason.dimension].icon;
                      return (
                        <li key={index} className="flex items-start gap-2 text-[12px] text-[var(--text)]">
                          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SEVERITY_DOT[reason.severity] }} />
                          <Icon size={13} className="mt-[1px] shrink-0 text-[var(--text-subtle)]" />
                          <span>{reason.summary}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between">
                  <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Monitored endpoints</h3>
                  <button type="button" onClick={() => setAddEndpointOpen(true)} className={cx(BTN_SECONDARY, FOCUS, "h-7 px-2 text-[10.5px]")}>
                    <Plus size={11} />
                    Add
                  </button>
                </div>

                {detail.monitoredEndpoints.length === 0 ? (
                  <p className="mt-2 text-[12px] text-[var(--text-muted)]">Not configured — adding a URL here is what authorises Syntra Grid to monitor it. Nothing is checked automatically before that.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {detail.monitoredEndpoints.map((endpoint) => {
                      const latest = endpoint.healthChecks[0];
                      return (
                        <li key={endpoint.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                          <span className="min-w-0">
                            <span className="block truncate text-[11.5px] font-medium text-[var(--text)]">{endpoint.label}</span>
                            <span className="block truncate text-[10px] text-[var(--text-subtle)]">{endpoint.url}</span>
                            <span className="block text-[10px] text-[var(--text-subtle)]">
                              {latest ? `${latest.status} · ${latest.responseTimeMs ?? "?"}ms · ${formatRelativeTime(latest.checkedAt)}` : "Awaiting first check"}
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={busyId === endpoint.id}
                            onClick={() => void handleDeleteEndpoint(endpoint.id)}
                            className={cx(FOCUS, "shrink-0 rounded-md p-1.5 text-[var(--text-subtle)] hover:bg-[var(--surface)] hover:text-[var(--danger)]")}
                            aria-label={`Stop monitoring ${endpoint.label}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Incidents</h3>
                {detail.incidents.length === 0 ? (
                  <p className="mt-2 text-[12px] text-[var(--text-muted)]">None recorded.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {detail.incidents.map((incident) => (
                      <li key={incident.id} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block text-[11.5px] font-medium text-[var(--text)]">{incident.title}</span>
                            <span className="block text-[10px] text-[var(--text-subtle)]">
                              {incident.status} · started {formatRelativeTime(incident.startedAt)}
                              {incident.resolved && incident.resolvedAt ? ` · resolved ${formatRelativeTime(incident.resolvedAt)}` : ""}
                            </span>
                          </span>
                          {!incident.resolved && (
                            <div className="flex shrink-0 gap-1.5">
                              {!incident.acknowledgedAt && (
                                <button type="button" disabled={busyId === incident.id} onClick={() => void handleAcknowledge(incident.id)} className={cx(BTN_SECONDARY, FOCUS, "h-6 px-2 text-[10px]")}>
                                  Acknowledge
                                </button>
                              )}
                              <button type="button" disabled={busyId === incident.id} onClick={() => void handleResolve(incident.id)} className={cx(BTN_PRIMARY, FOCUS, "h-6 px-2 text-[10px]")}>
                                Resolve
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="grid grid-cols-2 gap-3 text-[11.5px]">
                <div className="rounded-xl bg-[var(--surface-muted)] p-3">
                  <span className="block text-[10px] text-[var(--text-subtle)]">Projects</span>
                  <span className="mt-0.5 block font-semibold text-[var(--text)]">{detail.projects.length}</span>
                </div>
                <div className="rounded-xl bg-[var(--surface-muted)] p-3">
                  <span className="block text-[10px] text-[var(--text-subtle)]">Contracts</span>
                  <span className="mt-0.5 block font-semibold text-[var(--text)]">{detail.contracts.length}</span>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {detail && addEndpointOpen && (
        <AddEndpointDialog
          clientId={detail.client.id}
          onClose={() => setAddEndpointOpen(false)}
          onAdded={() => {
            setAddEndpointOpen(false);
            reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/* ============================================================================
   ADD ENDPOINT — the explicit authorisation step for monitoring a URL.
============================================================================ */

function AddEndpointDialog({ clientId, onClose, onAdded }: { clientId: string; onClose: () => void; onAdded: () => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!label.trim() || !url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await addMonitoredEndpointApi({ clientId, label: label.trim(), url: url.trim() });
      onAdded();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this endpoint.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal aria-label="Add a monitored endpoint" className="fixed inset-0 z-[320] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)]">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[var(--text)]">Add a monitored endpoint</h3>
          <button type="button" onClick={onClose} aria-label="Close" className={cx(FOCUS, "flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]")}>
            <X size={14} />
          </button>
        </div>

        <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
          This is the authorisation step — Syntra Grid will only ever check this exact URL, on a schedule, from the server. Private and internal addresses are rejected automatically.
        </p>

        <div className="mt-3 space-y-2.5">
          <div>
            <label className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Label</label>
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Production website" className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">URL</label>
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
          </div>
        </div>

        {error && <p className="mt-2 text-[11px] text-[var(--danger)]">{error}</p>}

        <button type="button" disabled={submitting || !label.trim() || !url.trim()} onClick={() => void submit()} className={cx(BTN_PRIMARY, FOCUS, "mt-4 h-9 w-full disabled:opacity-50")}>
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Add endpoint
        </button>
      </div>
    </div>
  );
}
