"use client";

// Technology Operations — Deployment management. First real UI over the
// Deployment model (confirmed this session: zero write call sites
// anywhere in the app before this route existed). Manual recording
// only — no automated provider integration exists, so this records that
// a deployment happened; it never triggers one. Follows
// ClientHealthTab.tsx's exact structure and style constants.

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  ExternalLink,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  X,
} from "lucide-react";

import { useSelectedClient } from "@/app/components/admin/SelectedClientContext";
import { CLIENTS_ENDPOINT, fetchClientsPayload } from "@/lib/clients/clientsApi";
import {
  DeploymentsApiError,
  fetchDeploymentDetail,
  fetchDeploymentsList,
  recordDeploymentApi,
  type DeploymentDetail,
  type DeploymentStatus,
  type DeploymentSummary,
} from "@/lib/deployments/deploymentsApi";

const CARD = "rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
const BTN_PRIMARY = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 text-[11.5px] font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50";
const BTN_SECONDARY = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[11.5px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const STATUS_META: Record<DeploymentStatus, { label: string; colour: string; bg: string }> = {
  SUCCESS: { label: "Success", colour: "#059669", bg: "rgba(5,150,105,0.1)" },
  FAILED: { label: "Failed", colour: "#dc2626", bg: "rgba(220,38,38,0.1)" },
  IN_PROGRESS: { label: "In progress", colour: "#2563eb", bg: "rgba(37,99,235,0.1)" },
  ROLLED_BACK: { label: "Rolled back", colour: "#d97706", bg: "rgba(217,119,6,0.1)" },
};

function formatRelativeTime(iso: string | null) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

type LoadStatus = "loading" | "ready" | "error";

export default function DeploymentsTab() {
  const { selectedClientId, selectClient } = useSelectedClient();

  const [items, setItems] = useState<DeploymentSummary[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DeploymentStatus | "">("");
  const [recordOpen, setRecordOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    setError(null);
    fetchDeploymentsList({ clientId: selectedClientId || undefined, status: statusFilter || undefined })
      .then((result) => {
        setItems(result);
        setStatus("ready");
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Could not load deployments.");
        setStatus("error");
      });
  }, [selectedClientId, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const counts = useMemo(() => {
    return {
      total: items.length,
      failed: items.filter((item) => item.status === "FAILED").length,
    };
  }, [items]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text)]">Deployments</h1>
          <p className="mt-1 max-w-[560px] text-[12px] leading-5 text-[var(--text-muted)]">
            Records that a deployment happened — branch, commit, environment and outcome. This does not trigger a real deployment; it only keeps a real history of ones that already happened.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={status === "loading"} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
            <RefreshCw size={13} className={status === "loading" ? "animate-spin" : undefined} />
            Refresh
          </button>
          <button type="button" onClick={() => setRecordOpen(true)} className={cx(BTN_PRIMARY, FOCUS, "h-9")}>
            <Plus size={13} />
            Record Deployment
          </button>
        </div>
      </div>

      {selectedClientId && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-[11.5px] text-[var(--text-muted)]">
          <span>
            Filtered to <span className="font-semibold text-[var(--text)]">{items[0]?.client?.displayName || items[0]?.client?.name || "one client"}</span> — set from the header&apos;s client switcher.
          </span>
          <button type="button" onClick={() => selectClient(null)} className={cx(FOCUS, "ml-auto text-[11px] font-semibold text-[var(--accent)] hover:underline")}>
            Show all deployments
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={cx(CARD, "p-3")}>
          <span className="block text-[15px] font-semibold text-[var(--text)]">{counts.total}</span>
          <span className="block text-[10px] text-[var(--text-muted)]">Recorded deployments</span>
        </div>
        <div className={cx(CARD, "p-3")}>
          <span className={cx("block text-[15px] font-semibold", counts.failed > 0 ? "text-[var(--danger)]" : "text-[var(--text)]")}>{counts.failed}</span>
          <span className="block text-[10px] text-[var(--text-muted)]">Failed</span>
        </div>
      </div>

      <div className={cx(CARD, "p-4")}>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DeploymentStatus | "")} className={cx(FOCUS, "h-9 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11.5px] text-[var(--text)]")}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>{meta.label}</option>
            ))}
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
              <Rocket size={22} className="text-[var(--text-subtle)]" />
              <p className="text-[12.5px] font-medium text-[var(--text)]">No deployments recorded yet</p>
              <p className="max-w-[360px] text-[11px] text-[var(--text-muted)]">Record one manually — no automated provider integration is connected yet.</p>
            </div>
          )}

          {status === "ready" && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
                    <th className="px-2 py-2">Project</th>
                    <th className="px-2 py-2">Environment</th>
                    <th className="px-2 py-2">Branch / Commit</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Duration</th>
                    <th className="px-2 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((deployment) => {
                    const meta = STATUS_META[deployment.status as DeploymentStatus] ?? { label: deployment.status, colour: "#6b7280", bg: "rgba(107,114,128,0.1)" };
                    return (
                      <tr key={deployment.id} onClick={() => setDetailId(deployment.id)} className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-muted)]">
                        <td className="px-2 py-3">
                          <span className="block truncate text-[11.5px] font-medium text-[var(--text)]">{deployment.project.name}</span>
                          <span className="block truncate text-[10px] text-[var(--text-subtle)]">{deployment.client?.displayName || deployment.client?.name || "—"}</span>
                        </td>
                        <td className="px-2 py-3 text-[11px] text-[var(--text-muted)]">{deployment.environment ?? "—"}</td>
                        <td className="px-2 py-3 text-[11px] text-[var(--text-muted)]">
                          <span className="flex items-center gap-1"><GitBranch size={10} />{deployment.branch ?? "—"}{deployment.commitHash ? ` · ${deployment.commitHash.slice(0, 7)}` : ""}</span>
                        </td>
                        <td className="px-2 py-3">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: meta.colour, backgroundColor: meta.bg }}>{meta.label}</span>
                        </td>
                        <td className="px-2 py-3 text-[11px] text-[var(--text-muted)]">{formatDuration(deployment.durationMs)}</td>
                        <td className="px-2 py-3 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(deployment.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {recordOpen && (
        <RecordDeploymentDialog
          defaultClientId={selectedClientId}
          onClose={() => setRecordOpen(false)}
          onRecorded={() => {
            setRecordOpen(false);
            load();
          }}
        />
      )}

      {detailId && <DeploymentDetailPanel deploymentId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

/* ============================================================================
   RECORD DIALOG
============================================================================ */

type ClientOption = { id: string; name: string; displayName: string | null };
type ProjectOption = { id: string; name: string; clientId: string };

function RecordDeploymentDialog({ defaultClientId, onClose, onRecorded }: { defaultClientId: string | null; onClose: () => void; onRecorded: () => void }) {
  const { data: clientsPayload } = useSWR(CLIENTS_ENDPOINT, fetchClientsPayload, { dedupingInterval: 60_000 });
  const clients = useMemo(() => (clientsPayload?.clients ?? []) as unknown as ClientOption[], [clientsPayload]);

  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [environment, setEnvironment] = useState("");
  const [status, setStatus] = useState<DeploymentStatus>("SUCCESS");
  const [branch, setBranch] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [commitTitle, setCommitTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [deploymentUrl, setDeploymentUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(() => {
    if (!clientId) {
      setProjects([]);
      return;
    }
    fetch(`/api/admin/projects?clientId=${encodeURIComponent(clientId)}`, { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setProjects(Array.isArray(payload?.projects) ? payload.projects : []))
      .catch(() => setProjects([]));
  }, [clientId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProjects();
  }, [loadProjects]);

  const submit = async () => {
    if (!projectId) return;
    setSubmitting(true);
    setError(null);
    try {
      await recordDeploymentApi({
        projectId,
        provider: provider.trim() || null,
        environment: environment.trim() || null,
        status,
        branch: branch.trim() || null,
        commitHash: commitHash.trim() || null,
        commitTitle: commitTitle.trim() || null,
        deploymentUrl: deploymentUrl.trim() || null,
        finishedAt: new Date().toISOString(),
      });
      onRecorded();
    } catch (caught) {
      setError(caught instanceof DeploymentsApiError ? caught.message : "Could not record this deployment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal aria-label="Record a deployment" className="fixed inset-0 z-[320] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-[460px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)]">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[var(--text)]">Record a deployment</h3>
          <button type="button" onClick={onClose} aria-label="Close" className={cx(FOCUS, "flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]")}>
            <X size={14} />
          </button>
        </div>

        <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">This records that a deployment already happened — it does not deploy anything.</p>

        <div className="mt-3 max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
          <div>
            <label htmlFor="deployment-client" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Client</label>
            <select id="deployment-client" value={clientId} onChange={(event) => { setClientId(event.target.value); setProjectId(""); }} className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")}>
              <option value="">Select a client…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.displayName || client.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="deployment-project" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Project</label>
            <select id="deployment-project" value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={!clientId} className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)] disabled:opacity-50")}>
              <option value="">Select a project…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="deployment-environment" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Environment</label>
              <input id="deployment-environment" value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="production" className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
            </div>
            <div>
              <label htmlFor="deployment-status" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Status</label>
              <select id="deployment-status" value={status} onChange={(event) => setStatus(event.target.value as DeploymentStatus)} className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")}>
                {Object.entries(STATUS_META).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="deployment-branch" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Branch</label>
              <input id="deployment-branch" value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="main" className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
            </div>
            <div>
              <label htmlFor="deployment-commit" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Commit hash</label>
              <input id="deployment-commit" value={commitHash} onChange={(event) => setCommitHash(event.target.value)} placeholder="a1b2c3d" className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
            </div>
          </div>

          <div>
            <label htmlFor="deployment-commit-title" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Commit title</label>
            <input id="deployment-commit-title" value={commitTitle} onChange={(event) => setCommitTitle(event.target.value)} className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
          </div>

          <div>
            <label htmlFor="deployment-provider" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Provider</label>
            <input id="deployment-provider" value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Vercel" className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
          </div>

          <div>
            <label htmlFor="deployment-url" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Reference URL</label>
            <input id="deployment-url" value={deploymentUrl} onChange={(event) => setDeploymentUrl(event.target.value)} placeholder="https://vercel.com/…" className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
          </div>
        </div>

        {error && <p className="mt-2 text-[11px] text-[var(--danger)]">{error}</p>}

        <button type="button" disabled={submitting || !projectId} onClick={() => void submit()} className={cx(BTN_PRIMARY, FOCUS, "mt-4 h-9 w-full disabled:opacity-50")}>
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Record deployment
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   DETAIL PANEL — correlation banner
============================================================================ */

function DeploymentDetailPanel({ deploymentId, onClose }: { deploymentId: string; onClose: () => void }) {
  const [deployment, setDeployment] = useState<DeploymentDetail | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    fetchDeploymentDetail(deploymentId)
      .then((result) => {
        setDeployment(result);
        setStatus("ready");
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Could not load this deployment.");
        setStatus("error");
      });
  }, [deploymentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div role="dialog" aria-modal aria-label="Deployment detail" className="fixed inset-0 z-[300] flex justify-end bg-black/45" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-[480px] flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-popover)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
          <h2 className="text-[14px] font-semibold text-[var(--text)]">{deployment ? deployment.project.name : "Deployment"}</h2>
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

          {deployment && status === "ready" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--text-muted)]">
                <span>Environment: <span className="text-[var(--text)]">{deployment.environment ?? "—"}</span></span>
                <span>Status: <span className="font-semibold" style={{ color: STATUS_META[deployment.status as DeploymentStatus]?.colour }}>{deployment.status}</span></span>
                <span>Branch: <span className="text-[var(--text)]">{deployment.branch ?? "—"}</span></span>
                <span>Commit: <span className="text-[var(--text)]">{deployment.commitHash ?? "—"}</span></span>
                <span>Duration: <span className="text-[var(--text)]">{formatDuration(deployment.durationMs)}</span></span>
                <span>When: <span className="text-[var(--text)]">{formatRelativeTime(deployment.createdAt)}</span></span>
              </div>

              {deployment.deploymentUrl && (
                <a href={deployment.deploymentUrl} target="_blank" rel="noreferrer" className={cx(FOCUS, "flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--accent)] hover:underline")}>
                  <ExternalLink size={12} /> View deployment reference
                </a>
              )}

              {deployment.correlation.hasPossibleCorrelation && (
                <div className="rounded-xl border border-[var(--warning-border,rgba(245,158,11,0.25))] bg-[var(--warning-soft,rgba(245,158,11,0.08))] p-3">
                  <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--warning,#b45309)]">
                    <AlertTriangle size={13} /> Possible correlation — not proof of causation
                  </p>
                  <p className="mt-1 text-[10.5px] leading-5 text-[var(--text-muted)]">
                    {deployment.correlation.failingChecks.length} monitoring check{deployment.correlation.failingChecks.length === 1 ? "" : "s"} failed within 2 hours of this deployment finishing. This may or may not be related — investigate before concluding the deployment caused it.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {deployment.correlation.failingChecks.slice(0, 5).map((check) => (
                      <li key={check.id} className="text-[10px] text-[var(--text-subtle)]">{check.monitoredEndpointLabel} · {check.status} · {formatRelativeTime(check.checkedAt)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
