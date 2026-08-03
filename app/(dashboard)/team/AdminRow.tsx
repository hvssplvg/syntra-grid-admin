'use client';

// app/(dashboard)/team/AdminRow.tsx

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Loader2, ShieldOff } from 'lucide-react';

import { setAdminActive, setAdminRole } from './actions';

const ROLES = ['VIEWER', 'SUPPORT', 'DEVELOPER', 'FINANCE', 'ADMIN', 'OWNER'];

export function AdminRow({
  id,
  name,
  email,
  avatarUrl,
  role,
  active,
  linked,
  assignedTickets,
  isSelf,
  canManage,
  canGrantOwner,
}: {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  active: boolean;
  linked: boolean;
  assignedTickets: number;
  isSelf: boolean;
  canManage: boolean;
  canGrantOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function run(work: () => Promise<void>) {
    setError('');

    startTransition(async () => {
      try {
        await work();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'That did not work.');
      }
    });
  }

  const roles = canGrantOwner ? ROLES : ROLES.filter((value) => value !== 'OWNER');

  return (
    <li className={`px-5 py-4 sm:px-6 ${active ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-4">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1020] text-xs font-bold text-white">
            {initials(name)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#0B1020]">
            {name}
            {isSelf && (
              <span className="rounded-full bg-[#14B8A6]/10 px-2 py-0.5 text-[10px] font-bold text-[#0D9488]">
                You
              </span>
            )}
            {!active && (
              <span className="rounded-full bg-[#0B1020]/[0.06] px-2 py-0.5 text-[10px] font-bold text-[#5A6173]">
                No access
              </span>
            )}
            {active && !linked && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                Never signed in
              </span>
            )}
          </p>

          <p className="mt-0.5 truncate text-xs text-[#5A6173]">
            {email}
            {assignedTickets > 0 &&
              ` · ${assignedTickets} ${assignedTickets === 1 ? 'ticket' : 'tickets'} assigned`}
          </p>
        </div>

        {canManage ? (
          <div className="flex items-center gap-2">
            <select
              value={role}
              disabled={pending}
              onChange={(event) =>
                run(() => setAdminRole(id, event.target.value))
              }
              aria-label={`Role for ${name}`}
              className="h-9 rounded-xl border border-[#0B1020]/[0.08] bg-white px-2.5 text-xs font-bold text-[#0B1020] outline-none focus:border-[#0D9488] disabled:opacity-50"
            >
              {roles.map((value) => (
                <option key={value} value={value}>
                  {tidy(value)}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={pending || (isSelf && active)}
              onClick={() => run(() => setAdminActive(id, !active))}
              title={
                isSelf && active
                  ? 'You cannot remove your own access'
                  : active
                  ? 'Remove access'
                  : 'Restore access'
              }
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors disabled:opacity-40 ${
                active
                  ? 'border-[#0B1020]/[0.08] bg-white text-[#5A6173] hover:border-red-200 hover:text-red-600'
                  : 'border-[#14B8A6]/25 bg-white text-[#0D9488]'
              }`}
            >
              {pending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ShieldOff size={13} />
              )}
              {active ? 'Revoke' : 'Restore'}
            </button>
          </div>
        ) : (
          <span className="rounded-full bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-bold text-[#A87B1B]">
            {tidy(role)}
          </span>
        )}
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </li>
  );
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function tidy(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');
}