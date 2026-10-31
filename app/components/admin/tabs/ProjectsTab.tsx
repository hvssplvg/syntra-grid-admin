'use client';

/**
 * A real, standalone Projects list — Project.clientId is a real relation
 * and GET /api/admin/projects already accepted and applied a `clientId`
 * filter server-side (previously only used as a dropdown lookup; see
 * that route's doc comment). This was a genuine gap: a 12-line
 * placeholder sitting on top of fully real, already client-aware data.
 *
 * Filtering here follows the same pattern as Contracts/Campaigns/Client
 * Health: wire `useSelectedClient()`'s id into the query, show a
 * "Filtered to X" banner with a way back to company-wide. No create flow
 * is built here — Project creation involves fields (hosting, database,
 * category, client assignment) this pass doesn't attempt; this list is
 * read-only, consistent with not inventing functionality beyond what was
 * asked for.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Loader2,
  Pause,
  Search,
  Wrench,
} from 'lucide-react';
import { useSelectedClient } from '@/app/components/admin/SelectedClientContext';

type ProjectStatus = 'DEVELOPMENT' | 'TESTING' | 'ACTIVE' | 'MAINTENANCE' | 'PAUSED' | 'ARCHIVED';

type ProjectRecord = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  category: string;
  clientId: string;
  productionUrl: string | null;
  repositoryUrl: string | null;
  hostingProvider: string | null;
  framework: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    displayName: string | null;
    logoUrl: string | null;
  };
  _count: {
    tickets: number;
    incidents: number;
  };
};

type ProjectsResponse = {
  ok: boolean;
  projects?: ProjectRecord[];
  error?: string;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function clientLabel(client: ProjectRecord['client']) {
  return client.displayName || client.name;
}

const STATUS_TONE: Record<ProjectStatus, string> = {
  DEVELOPMENT: 'border-blue-500/20 bg-blue-500/10 text-blue-700',
  TESTING: 'border-violet-500/20 bg-violet-500/10 text-violet-700',
  ACTIVE: 'border-[color:var(--success-border,rgba(16,185,129,0.25))] bg-[var(--success-soft,rgba(16,185,129,0.1))] text-[var(--success,#047857)]',
  MAINTENANCE: 'border-[color:var(--warning-border,rgba(245,158,11,0.25))] bg-[var(--warning-soft,rgba(245,158,11,0.1))] text-[var(--warning,#b45309)]',
  PAUSED: 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
  ARCHIVED: 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]',
};

const STATUS_FILTERS: Array<{ id: 'ALL' | ProjectStatus; label: string }> = [
  { id: 'ALL', label: 'All statuses' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'DEVELOPMENT', label: 'Development' },
  { id: 'TESTING', label: 'Testing' },
  { id: 'MAINTENANCE', label: 'Maintenance' },
  { id: 'PAUSED', label: 'Paused' },
  { id: 'ARCHIVED', label: 'Archived' },
];

export default function ProjectsTab() {
  const { selectedClientId, selectClient } = useSelectedClient();

  const [projects, setProjects] = useState<ProjectRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProjectStatus>('ALL');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (selectedClientId) params.set('clientId', selectedClientId);

    fetch(`/api/admin/projects${params.toString() ? `?${params.toString()}` : ''}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then((response) => response.json().catch(() => ({ ok: false })) as Promise<ProjectsResponse>)
      .then((payload) => {
        if (!payload.ok || !Array.isArray(payload.projects)) {
          throw new Error(payload.error || 'Projects could not be loaded.');
        }
        setProjects(payload.projects);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Projects could not be loaded.');
      })
      .finally(() => setLoading(false));
  }, [selectedClientId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (projects ?? []).filter((project) => {
      if (statusFilter !== 'ALL' && project.status !== statusFilter) return false;
      if (!query) return true;
      return [project.name, project.slug, clientLabel(project.client), project.hostingProvider, project.framework]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [projects, search, statusFilter]);

  const counts = useMemo(() => {
    const list = projects ?? [];
    return {
      total: list.length,
      active: list.filter((p) => p.status === 'ACTIVE').length,
      maintenance: list.filter((p) => p.status === 'MAINTENANCE').length,
      archived: list.filter((p) => p.status === 'ARCHIVED' || p.status === 'PAUSED').length,
    };
  }, [projects]);

  const clientName = projects && projects.length > 0 ? clientLabel(projects[0].client) : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--text)]">Projects</h1>
          <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
            Development projects and the systems Syntra Grid builds and maintains for clients.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-[var(--line)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text)] hover:bg-[var(--surface-muted)]"
        >
          Refresh
        </button>
      </div>

      {selectedClientId ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-[11.5px] text-[var(--text-muted)]">
          <span>
            Filtered to <span className="font-semibold text-[var(--text)]">{clientName || 'one client'}</span> — set from the header&apos;s client switcher.
          </span>
          <button
            type="button"
            onClick={() => selectClient(null)}
            className="ml-auto text-[11px] font-semibold text-[var(--accent)] hover:underline"
          >
            Show all clients
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Projects', value: counts.total, icon: BriefcaseBusiness },
          { label: 'Active', value: counts.active, icon: CheckCircle2 },
          { label: 'Maintenance', value: counts.maintenance, icon: Wrench },
          { label: 'Paused / archived', value: counts.archived, icon: Pause },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="flex items-center gap-2 text-[var(--text-subtle)]">
              <item.icon size={13} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em]">{item.label}</span>
            </div>
            <p className="mt-1 text-[20px] font-semibold text-[var(--text)]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-[360px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects, clients, hosting"
            className="h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-9 pr-3 text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'ALL' | ProjectStatus)}
          className="h-9 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading && !projects ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)]">
          <Loader2 size={20} className="animate-spin text-[var(--text-subtle)]" />
        </div>
      ) : error ? (
        <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-[22px] border border-[var(--line)] bg-[var(--surface)] text-center">
          <AlertCircle size={18} className="text-[var(--text-subtle)]" />
          <p className="text-[11.5px] text-[var(--text-muted)]">{error}</p>
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-[22px] border border-[var(--line)] bg-[var(--surface)] text-center">
          <BriefcaseBusiness size={18} className="text-[var(--text-subtle)]" />
          <p className="text-[11.5px] text-[var(--text-muted)]">
            {selectedClientId ? 'No projects yet for this client.' : 'No projects yet.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)]">
          <div className="divide-y divide-[var(--line)]">
            {visibleProjects.map((project) => (
              <div key={project.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[12.5px] font-semibold text-[var(--text)]">{project.name}</p>
                    <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold', STATUS_TONE[project.status])}>
                      {formatEnum(project.status)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-[var(--text-subtle)]">
                    {!selectedClientId ? `${clientLabel(project.client)} · ` : ''}
                    {formatEnum(project.category)}
                    {project.hostingProvider ? ` · ${project.hostingProvider}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[10.5px] text-[var(--text-subtle)]">
                  {project.framework ? <span className="rounded-full border border-[var(--line)] px-2 py-0.5">{project.framework}</span> : null}
                  {project._count.incidents > 0 ? (
                    <span className="rounded-full border border-[color:var(--warning-border,rgba(245,158,11,0.25))] bg-[var(--warning-soft,rgba(245,158,11,0.1))] px-2 py-0.5 text-[var(--warning,#b45309)]">
                      {project._count.incidents} incident{project._count.incidents === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {project.productionUrl ? (
                    <a
                      href={project.productionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1 text-[10px] font-semibold text-[var(--text)] hover:bg-[var(--surface-muted)]"
                    >
                      <ExternalLink size={11} /> Live
                    </a>
                  ) : null}
                  {project.repositoryUrl ? (
                    <a
                      href={project.repositoryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1 text-[10px] font-semibold text-[var(--text)] hover:bg-[var(--surface-muted)]"
                    >
                      <GitBranch size={11} /> Repo
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
