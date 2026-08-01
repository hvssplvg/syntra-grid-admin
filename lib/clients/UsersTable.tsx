'use client';

// components/clients/UsersTable.tsx

import { useMemo, useState } from 'react';
import { ArrowUpDown, Download, Search, X } from 'lucide-react';

import type { EsteemUserRow } from '@/lib/integrations/firebase/getUsers';

type RoleFilter = 'all' | 'student' | 'teacher' | 'admin' | 'staff';
type StatusFilter = 'all' | 'deactivated' | 'never-signed-in' | 'out-of-sync' | 'no-dashboard';
type SortKey = 'name' | 'id' | 'role' | 'created';

const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  teacher: 'Teacher',
  admin: 'Admin',
  staff: 'Staff',
  unknown: 'No role',
};

const ROLE_PILL: Record<string, string> = {
  student: 'bg-[#14B8A6]/10 text-[#0D9488]',
  teacher: 'bg-[#D4AF37]/12 text-[#A87B1B]',
  admin: 'bg-[#0B1020]/[0.06] text-[#0B1020]',
  staff: 'bg-[#5A6173]/10 text-[#5A6173]',
  unknown: 'bg-red-50 text-red-700',
};

export function UsersTable({ users }: { users: EsteemUserRow[] }) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('name');

  const roleCounts = useMemo(() => {
    const base: Record<RoleFilter, number> = {
      all: users.length,
      student: 0,
      teacher: 0,
      admin: 0,
      staff: 0,
    };
    for (const user of users) {
      if (user.role in base) base[user.role as RoleFilter] += 1;
    }
    return base;
  }, [users]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const rows = users.filter((user) => {
      if (role !== 'all' && user.role !== role) return false;

      if (status === 'deactivated' && user.isActive) return false;
      if (status === 'never-signed-in' && !user.neverSignedIn) return false;
      if (status === 'out-of-sync' && user.mirrored) return false;
      if (status === 'no-dashboard' && user.dashboardAccess !== false) return false;

      if (!needle) return true;
      return [
        user.fullName,
        user.email,
        user.displayId,
        user.className ?? '',
        user.position ?? '',
        user.subjects.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    const sorters: Record<SortKey, (a: EsteemUserRow, b: EsteemUserRow) => number> = {
      name: (a, b) => a.fullName.localeCompare(b.fullName),
      id: (a, b) => a.displayId.localeCompare(b.displayId),
      role: (a, b) => a.role.localeCompare(b.role) || a.fullName.localeCompare(b.fullName),
      created: (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
    };

    return [...rows].sort(sorters[sort]);
  }, [users, search, role, status, sort]);

  const filtersActive = search !== '' || role !== 'all' || status !== 'all';

  function clearFilters() {
    setSearch('');
    setRole('all');
    setStatus('all');
  }

  function exportCsv() {
    const header = [
      'Name',
      'ID',
      'Role',
      'Email',
      'Position',
      'Class',
      'Subjects',
      'Active',
      'Signed in',
      'Dashboard access',
      'Permissions',
      'Mirror record',
      'Created',
    ];

    const rows = filtered.map((user) => [
      user.fullName,
      user.displayId,
      ROLE_LABEL[user.role] ?? user.role,
      user.email,
      user.position ?? '',
      user.className ?? '',
      user.subjects.join('; '),
      user.isActive ? 'Active' : 'Deactivated',
      user.neverSignedIn ? 'Never' : 'Yes',
      user.dashboardAccess === null ? 'n/a' : user.dashboardAccess ? 'Yes' : 'No',
      user.permissionScope === 'full'
        ? 'Full'
        : user.permissionScope === null
        ? 'n/a'
        : String(user.permissionScope),
      user.mirrored ? 'Present' : 'Missing',
      user.createdAt ?? '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `esteem-users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-3xl border border-[#D4AF37]/15 bg-white shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-[#0B1020]/[0.06] p-4 sm:p-5 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search accounts</span>
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6173]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, ID, email, class or subject"
            className="h-10 w-full rounded-xl border border-[#0B1020]/[0.08] bg-[#FAFAF9] pl-10 pr-3 text-sm text-[#0B1020] outline-none transition-colors placeholder:text-[#5A6173] focus:border-[#0D9488] focus:bg-white"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="h-10 rounded-xl border border-[#0B1020]/[0.08] bg-white px-3 text-sm font-semibold text-[#0B1020] outline-none focus:border-[#0D9488]"
          >
            <option value="all">All accounts</option>
            <option value="never-signed-in">Never signed in</option>
            <option value="deactivated">Deactivated</option>
            <option value="out-of-sync">Missing mirror record</option>
            <option value="no-dashboard">No dashboard access</option>
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-10 rounded-xl border border-[#0B1020]/[0.08] bg-white px-3 text-sm font-semibold text-[#0B1020] outline-none focus:border-[#0D9488]"
          >
            <option value="name">Sort by name</option>
            <option value="id">Sort by ID</option>
            <option value="role">Sort by role</option>
            <option value="created">Newest first</option>
          </select>

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D4AF37]/20 bg-white px-3.5 text-sm font-bold text-[#A87B1B] transition-colors hover:bg-[#D4AF37]/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A87B1B]"
          >
            <Download size={15} aria-hidden />
            Export
          </button>
        </div>
      </div>

      {/* Role tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#0B1020]/[0.06] px-4 py-3 sm:px-5">
        {(['all', 'student', 'teacher', 'admin', 'staff'] as RoleFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRole(key)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              role === key
                ? 'bg-[#0B1020] text-white'
                : 'bg-[#0B1020]/[0.04] text-[#5A6173] hover:text-[#0B1020]'
            }`}
          >
            {key === 'all' ? 'All' : ROLE_LABEL[key]}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                role === key ? 'bg-white/15' : 'bg-white'
              }`}
            >
              {roleCounts[key]}
            </span>
          </button>
        ))}

        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-[#0D9488] transition-colors hover:text-[#0B1020]"
          >
            <X size={12} aria-hidden />
            Clear filters
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="px-4 pt-3 text-xs font-semibold text-[#5A6173] sm:px-5">
        {filtered.length === users.length
          ? `${users.length} accounts`
          : `${filtered.length} of ${users.length} accounts`}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="px-4 py-14 text-center sm:px-5">
          <p className="text-sm font-bold text-[#0B1020]">Nothing matches those filters</p>
          <p className="mt-1 text-sm text-[#5A6173]">
            Try a different search term, or clear the filters to see the full roster.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto p-4 sm:p-5">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#0B1020]/[0.08]">
                <Th>Account</Th>
                <Th>ID</Th>
                <Th>Role</Th>
                <Th>Class / position</Th>
                <Th>Access</Th>
                <Th>Status</Th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.uid}
                  className="border-b border-[#0B1020]/[0.05] transition-colors last:border-0 hover:bg-[#FAFAF9]"
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <Avatar user={user} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#0B1020]">
                          {user.fullName}
                        </p>
                        <p className="truncate text-xs text-[#5A6173]">
                          {user.email || 'No email on record'}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 pr-4 font-mono text-xs text-[#5A6173]">
                    {user.displayId || '—'}
                  </td>

                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        ROLE_PILL[user.role] ?? ROLE_PILL.unknown
                      }`}
                    >
                      {ROLE_LABEL[user.role] ?? user.role}
                    </span>
                  </td>

                  <td className="py-3 pr-4 text-sm text-[#0B1020]">
                    {user.className || user.position || '—'}
                    {user.subjects.length > 0 && (
                      <span className="mt-0.5 block truncate text-xs text-[#5A6173]">
                        {user.subjects.slice(0, 3).join(', ')}
                        {user.subjects.length > 3 && ` +${user.subjects.length - 3}`}
                      </span>
                    )}
                  </td>

                  <td className="py-3 pr-4 text-xs font-semibold">
                    <AccessCell user={user} />
                  </td>

                  <td className="py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {!user.isActive && <Tag tone="muted">Deactivated</Tag>}
                      {user.neverSignedIn && <Tag tone="warn">Never signed in</Tag>}
                      {!user.mirrored && <Tag tone="bad">No mirror record</Tag>}
                      {user.isActive && !user.neverSignedIn && user.mirrored && (
                        <Tag tone="ok">Active</Tag>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── pieces ─────────────────────── */

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="pb-2.5 pr-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6173]">
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown size={9} className="opacity-0" aria-hidden />
      </span>
    </th>
  );
}

function Avatar({ user }: { user: EsteemUserRow }) {
  if (user.photoURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.photoURL}
        alt=""
        loading="lazy"
        className="h-9 w-9 shrink-0 rounded-xl object-cover"
      />
    );
  }

  const initials = user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-[10px] font-bold text-[#5A6173]">
      {initials || '?'}
    </span>
  );
}

function AccessCell({ user }: { user: EsteemUserRow }) {
  if (user.role === 'student' || user.role === 'teacher') {
    return <span className="text-[#5A6173]">Own portal</span>;
  }

  if (user.dashboardAccess === false) {
    return <span className="text-red-600">No dashboard</span>;
  }

  if (user.permissionScope === 'full') {
    return <span className="text-[#A87B1B]">Full access</span>;
  }

  if (user.permissionScope === 0) {
    return <span className="text-amber-600">No modules</span>;
  }

  return (
    <span className="text-[#0B1020]">
      {user.permissionScope} modules
      {user.accessLevel === 'custom' && (
        <span className="ml-1 font-normal text-[#5A6173]">· custom</span>
      )}
    </span>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'ok' | 'warn' | 'bad' | 'muted';
}) {
  const map = {
    ok: 'bg-[#14B8A6]/10 text-[#0D9488]',
    warn: 'bg-amber-100 text-amber-700',
    bad: 'bg-red-50 text-red-700',
    muted: 'bg-[#0B1020]/[0.05] text-[#5A6173]',
  } as const;

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${map[tone]}`}>
      {children}
    </span>
  );
}