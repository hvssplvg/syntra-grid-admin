"use client";

// Technology Operations — technical incidents view. A READ-ONLY filter
// over the EXISTING Incident model (lib/incidents/server.ts's
// TECHNICAL_INCIDENT_CATEGORIES) — never a second write path.
// Acknowledge/resolve reuse the exact same route Client Health already
// uses (re-exported from clientHealthApi.ts), so an incident acted on
// here has the identical lifecycle it would have anywhere else it's
// shown. Follows ClientHealthTab.tsx's exact structure and style
// constants.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";

import { useSelectedClient } from "@/app/components/admin/SelectedClientContext";
import { CLIENTS_ENDPOINT, fetchClientsPayload } from "@/lib/clients/clientsApi";
import useSWR from "swr";
import {
  acknowledgeIncidentApi,
  createManualIncidentApi,
  fetchTechnicalIncidentsList,
  IncidentsApiError,
  resolveIncidentApi,
  type TechnicalIncidentRecord,
} from "@/lib/incidents/incidentsApi";

const CARD = "rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
const BTN_PRIMARY = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 text-[11.5px] font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50";
const BTN_SECONDARY = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[11.5px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const CATEGORY_LABEL: Record<string, string> = {
  MONITORING_OUTAGE: "Monitoring outage",
  MONITORING_DEGRADED: "Monitoring degraded",
  DEPLOYMENT_FAILURE: "Deployment failure",
  INFRASTRUCTURE_INCIDENT: "Infrastructure",
};

const CATEGORIES = Object.keys(CATEGORY_LABEL);

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type LoadStatus = "loading" | "ready" | "error";

export default function IncidentsTab() {
  const { selectedClientId, selectClient } = useSelectedClient();

  const [items, setItems] = useState<TechnicalIncidentRecord[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [resolvedFilter, setResolvedFilter] = useState<"" | "true" | "false">("false");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(() => {
    setStatus("loading");
    setError(null);
    fetchTechnicalIncidentsList({
      clientId: selectedClientId || undefined,
      category: categoryFilter || undefined,
      resolved: resolvedFilter === "" ? undefined : resolvedFilter === "true",
    })
      .then((result) => {
        setItems(result);
        setStatus("ready");
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Could not load incidents.");
        setStatus("error");
      });
  }, [selectedClientId, categoryFilter, resolvedFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleAcknowledge = async (id: string) => {
    setBusyId(id);
    try {
      await acknowledgeIncidentApi(id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const handleResolve = async (id: string) => {
    setBusyId(id);
    try {
      await resolveIncidentApi(id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = items.filter((item) => !item.resolved).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text)]">Technical Incidents</h1>
          <p className="mt-1 max-w-[560px] text-[12px] leading-5 text-[var(--text-muted)]">
            Monitoring outages, deployment failures and infrastructure incidents — the same Incident rows Client Health already tracks. Acknowledging or resolving here updates the one shared record everywhere it&apos;s shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={status === "loading"} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
            <RefreshCw size={13} className={status === "loading" ? "animate-spin" : undefined} />
            Refresh
          </button>
          <button type="button" onClick={() => setLogOpen(true)} className={cx(BTN_PRIMARY, FOCUS, "h-9")}>
            <Plus size={13} />
            Log Incident
          </button>
        </div>
      </div>

      {selectedClientId && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-[11.5px] text-[var(--text-muted)]">
          <span>Filtered to the client selected in the header.</span>
          <button type="button" onClick={() => selectClient(null)} className={cx(FOCUS, "ml-auto text-[11px] font-semibold text-[var(--accent)] hover:underline")}>
            Show all incidents
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={cx(CARD, "p-3")}>
          <span className={cx("block text-[15px] font-semibold", activeCount > 0 ? "text-[var(--danger)]" : "text-[var(--text)]")}>{activeCount}</span>
          <span className="block text-[10px] text-[var(--text-muted)]">Active</span>
        </div>
        <div className={cx(CARD, "p-3")}>
          <span className="block text-[15px] font-semibold text-[var(--text)]">{items.length}</span>
          <span className="block text-[10px] text-[var(--text-muted)]">Shown</span>
        </div>
      </div>

      <div className={cx(CARD, "p-4")}>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={cx(FOCUS, "h-9 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11.5px] text-[var(--text)]")}>
            <option value="">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{CATEGORY_LABEL[category]}</option>
            ))}
          </select>
          <select aria-label="Filter by resolved status" value={resolvedFilter} onChange={(event) => setResolvedFilter(event.target.value as "" | "true" | "false")} className={cx(FOCUS, "h-9 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11.5px] text-[var(--text)]")}>
            <option value="false">Active only</option>
            <option value="true">Resolved only</option>
            <option value="">All</option>
          </select>
        </div>

        <div className="mt-4">
          {status === "loading" && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-[var(--text-subtle)]" />
            </div>
          )}

          {status === "error" && <p className="text-[12px] text-[var(--danger)]">{error}</p>}

          {status === "ready" && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <CheckCircle2 size={22} className="text-[var(--success)]" />
              <p className="text-[12.5px] font-medium text-[var(--text)]">No incidents to show</p>
              <p className="max-w-[360px] text-[11px] text-[var(--text-muted)]">Nothing in this filter — a quiet incidents list is a good sign, not an empty one.</p>
            </div>
          )}

          {status === "ready" && items.length > 0 && (
            <ul className="space-y-2">
              {items.map((incident) => (
                <li key={incident.id} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle size={12} className={incident.resolved ? "text-[var(--text-subtle)]" : "text-[var(--danger)]"} />
                        <span className="block truncate text-[12px] font-medium text-[var(--text)]">{incident.title}</span>
                      </span>
                      <span className="mt-0.5 block text-[10px] text-[var(--text-subtle)]">
                        {CATEGORY_LABEL[incident.category ?? ""] ?? incident.category ?? "Uncategorised"} · {incident.client?.displayName || incident.client?.name || "Syntra Grid"} · {formatRelativeTime(incident.startedAt)}
                        {incident.monitoredEndpoint ? ` · ${incident.monitoredEndpoint.label}` : ""}
                      </span>
                    </span>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cx("text-[10px] font-semibold", incident.resolved ? "text-[var(--success)]" : "text-[var(--danger)]")}>{incident.resolved ? "Resolved" : "Open"}</span>
                      {!incident.resolved && !incident.acknowledgedAt && (
                        <button type="button" disabled={busyId === incident.id} onClick={() => void handleAcknowledge(incident.id)} className={cx(BTN_SECONDARY, FOCUS, "h-7 px-2 text-[10.5px]")}>
                          Acknowledge
                        </button>
                      )}
                      {!incident.resolved && (
                        <button type="button" disabled={busyId === incident.id} onClick={() => void handleResolve(incident.id)} className={cx(BTN_PRIMARY, FOCUS, "h-7 px-2 text-[10.5px]")}>
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {logOpen && (
        <LogIncidentDialog
          defaultClientId={selectedClientId}
          onClose={() => setLogOpen(false)}
          onLogged={() => {
            setLogOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ============================================================================
   MANUAL LOG DIALOG — for ad hoc infra issues with no endpoint behind them
============================================================================ */

type ClientOption = { id: string; name: string; displayName: string | null };

function LogIncidentDialog({ defaultClientId, onClose, onLogged }: { defaultClientId: string | null; onClose: () => void; onLogged: () => void }) {
  const { data: clientsPayload } = useSWR(CLIENTS_ENDPOINT, fetchClientsPayload, { dedupingInterval: 60_000 });
  const clients = (clientsPayload?.clients ?? []) as unknown as ClientOption[];

  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("warning");
  const [category, setCategory] = useState<"INFRASTRUCTURE_INCIDENT" | "DEPLOYMENT_FAILURE">("INFRASTRUCTURE_INCIDENT");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createManualIncidentApi({
        title: title.trim(),
        description: description.trim() || null,
        severity,
        category,
        clientId: clientId || null,
      });
      onLogged();
    } catch (caught) {
      setError(caught instanceof IncidentsApiError ? caught.message : "Could not log this incident.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal aria-label="Log a technical incident" className="fixed inset-0 z-[320] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)]">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text)]"><ShieldAlert size={14} /> Log a technical incident</h3>
          <button type="button" onClick={onClose} aria-label="Close" className={cx(FOCUS, "flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]")}>
            <X size={14} />
          </button>
        </div>

        <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">For ad hoc infrastructure issues with no monitored endpoint behind them. Monitoring-triggered incidents still open automatically — this is a separate, manual path.</p>

        <div className="mt-3 space-y-2.5">
          <div>
            <label htmlFor="incident-title" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Title</label>
            <input id="incident-title" value={title} onChange={(event) => setTitle(event.target.value)} className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
          </div>
          <div>
            <label htmlFor="incident-description" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Description</label>
            <textarea id="incident-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className={cx(FOCUS, "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text)]")} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="incident-category" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Category</label>
              <select id="incident-category" value={category} onChange={(event) => setCategory(event.target.value as "INFRASTRUCTURE_INCIDENT" | "DEPLOYMENT_FAILURE")} className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")}>
                <option value="INFRASTRUCTURE_INCIDENT">Infrastructure</option>
                <option value="DEPLOYMENT_FAILURE">Deployment failure</option>
              </select>
            </div>
            <div>
              <label htmlFor="incident-severity" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Severity</label>
              <select id="incident-severity" value={severity} onChange={(event) => setSeverity(event.target.value)} className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")}>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="incident-client" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Client (optional — leave blank for Syntra Grid internal)</label>
            <select id="incident-client" value={clientId} onChange={(event) => setClientId(event.target.value)} className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")}>
              <option value="">Syntra Grid (internal)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.displayName || client.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mt-2 text-[11px] text-[var(--danger)]">{error}</p>}

        <button type="button" disabled={submitting || !title.trim()} onClick={() => void submit()} className={cx(BTN_PRIMARY, FOCUS, "mt-4 h-9 w-full disabled:opacity-50")}>
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Log incident
        </button>
      </div>
    </div>
  );
}
