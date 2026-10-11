'use client';

/**
 * Read-only "my department" view for a restricted employee dashboard
 * account (Employee.adminUserId -> AdminUser.restrictedAccess === true,
 * granted team:VIEW at DEPARTMENT scope).
 *
 * Deliberately separate from TeamTab.tsx rather than a conditionally-safe
 * path through it — that file assumes a single privileged admin tree
 * (add/edit/offboard/access-management all sharing state). This component
 * only ever reads from the same, already department-scoped and
 * confidential-field-free API shape (app/api/admin/team, app/api/admin/
 * team/[id]) and renders nothing a colleague couldn't already see about
 * each other: name, job title, status, department, reporting line.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Building2, Users } from 'lucide-react';

type PersonSummary = {
  id: string;
  employeeRef?: string | null;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  avatarUrl?: string | null;
  jobTitle?: string;
  status?: string;
};

type Employee = PersonSummary & {
  workEmail?: string | null;
  country?: string | null;
  city?: string | null;
  employmentType?: string;
  workArrangement?: string | null;
  startDate?: string | null;
  department?: { id: string; name: string } | null;
  manager?: PersonSummary | null;
  directReports?: PersonSummary[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function fullName(person: PersonSummary) {
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

function initials(person: PersonSummary) {
  const first = person.firstName?.trim()?.[0] ?? '';
  const last = person.lastName?.trim()?.[0] ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

function prettyEnum(value?: string | null) {
  if (!value) return 'Not set';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function Avatar({ person, size = 40 }: { person: PersonSummary; size?: number }) {
  if (person.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatarUrl}
        alt=""
        style={{ height: size, width: size }}
        className="shrink-0 rounded-full border border-[var(--line)] object-cover"
      />
    );
  }

  return (
    <div
      style={{ height: size, width: size }}
      className="flex shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] text-[11px] font-bold text-[var(--text-muted)]"
    >
      {initials(person)}
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  if (!status) return null;

  const tone =
    status === 'ACTIVE'
      ? 'text-[var(--success,#047857)]'
      : 'text-[var(--text-subtle)]';

  return (
    <span className={cx('text-[9px] font-semibold', tone)}>
      {prettyEnum(status)}
    </span>
  );
}

export default function TeamDepartmentView({
  viewerDepartmentId,
  viewerEmployeeId,
}: {
  viewerDepartmentId: string | null;
  viewerEmployeeId: string | null;
}) {
  const [colleagues, setColleagues] = useState<Employee[]>([]);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/team', {
        credentials: 'include',
        cache: 'no-store',
      });

      const payload = (await response.json().catch(() => null)) as {
        employees?: Employee[];
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || 'Could not load your department.');
      }

      const list = payload?.employees ?? [];
      setColleagues(list);
      setDepartmentName(
        list.find((item) => item.department?.id === viewerDepartmentId)
          ?.department?.name ?? null,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load your department.',
      );
    } finally {
      setLoading(false);
    }
  }, [viewerDepartmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }

    let cancelled = false;
    setSelectedLoading(true);

    fetch(`/api/admin/team/${selectedId}`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((response) => response.json())
      .then((payload: { employee?: Employee }) => {
        if (!cancelled) setSelected(payload?.employee ?? null);
      })
      .catch(() => {
        if (!cancelled) setSelected(null);
      })
      .finally(() => {
        if (!cancelled) setSelectedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-[12px] text-[var(--text-muted)]">
        {error}
      </div>
    );
  }

  if (selectedId) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1.5 rounded-lg px-1 text-[11px] font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Back to department
        </button>

        {selectedLoading || !selected ? (
          <div className="h-64 animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)]" />
        ) : (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <div className="flex items-center gap-3">
              <Avatar person={selected} size={56} />
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--text)]">
                  {fullName(selected)}
                  {selected.id === viewerEmployeeId ? (
                    <span className="ml-2 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[9px] font-semibold text-[var(--text-subtle)]">
                      You
                    </span>
                  ) : null}
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {selected.jobTitle}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <DetailLine label="Department" value={selected.department?.name ?? 'Not assigned'} />
              <DetailLine label="Status" value={prettyEnum(selected.status)} />
              <DetailLine label="Employment type" value={prettyEnum(selected.employmentType)} />
              <DetailLine label="Work arrangement" value={prettyEnum(selected.workArrangement)} />
              <DetailLine
                label="Manager"
                value={selected.manager ? fullName(selected.manager) : 'None'}
              />
              {selected.id === viewerEmployeeId && selected.workEmail ? (
                <DetailLine label="Work email" value={selected.workEmail} />
              ) : null}
            </div>

            {selected.directReports && selected.directReports.length > 0 ? (
              <div className="mt-6 border-t border-[var(--line)] pt-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
                  Direct reports
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.directReports.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => setSelectedId(report.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text)] transition hover:border-[var(--text-subtle)]/40"
                    >
                      <Avatar person={report} size={18} />
                      {fullName(report)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
        <Building2 size={14} />
        {departmentName ? `${departmentName} · ` : ''}
        {colleagues.length} {colleagues.length === 1 ? 'person' : 'people'}
      </div>

      {colleagues.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-10 text-center">
          <Users size={22} className="text-[var(--text-subtle)]" />
          <p className="text-[12px] text-[var(--text-muted)]">
            No department colleagues to show yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {colleagues.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => setSelectedId(person.id)}
              className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--text-subtle)]/40 hover:shadow-sm"
            >
              <Avatar person={person} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-[var(--text)]">
                  {fullName(person)}
                  {person.id === viewerEmployeeId ? (
                    <span className="ml-1.5 text-[9px] font-semibold text-[var(--text-subtle)]">
                      (you)
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-[10px] text-[var(--text-muted)]">
                  {person.jobTitle}
                </p>
              </div>
              <StatusPill status={person.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
        {label}
      </p>
      <p className="mt-1 text-[12px] text-[var(--text)]">{value}</p>
    </div>
  );
}
