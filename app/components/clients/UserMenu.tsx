'use client';

// components/layout/UserMenu.tsx
//
// Drop this into the navbar where the signed-in admin's name currently sits.
//
//   <UserMenu
//     name="Hassan"
//     email={admin.email}
//     role={admin.role}
//     avatarUrl={admin.avatarUrl}
//   />

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, LogOut, Settings, UserRound, Users } from 'lucide-react';

const MANAGE_ROLES = ['OWNER', 'ADMIN'];

export function UserMenu({
  name,
  email,
  role,
  avatarUrl,
  signOutHref = '/api/auth/signout',
}: {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  signOutHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape — both expected of a menu.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const canManageTeam = MANAGE_ROLES.includes(role);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-11 items-center gap-2.5 rounded-xl border border-[#0B1020]/[0.07] bg-white pl-1.5 pr-3 text-left transition-colors hover:border-[#D4AF37]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
      >
        <Avatar name={name} avatarUrl={avatarUrl} />

        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-xs font-bold text-[#0B1020]">{name}</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5A6173]">
            {tidyRole(role)}
          </span>
        </span>

        <ChevronDown
          size={14}
          className={`shrink-0 text-[#5A6173] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[#D4AF37]/15 bg-white shadow-[0_18px_40px_rgba(11,16,32,0.14)]"
        >
          <div className="flex items-center gap-3 border-b border-[#0B1020]/[0.06] p-4">
            <Avatar name={name} avatarUrl={avatarUrl} large />

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#0B1020]">{name}</p>
              <p className="truncate text-xs text-[#5A6173]">{email}</p>
            </div>
          </div>

          <div className="p-1.5">
            <Item
              href="/profile"
              icon={UserRound}
              label="Profile"
              onSelect={() => setOpen(false)}
            />

            {canManageTeam && (
              <Item
                href="/team"
                icon={Users}
                label="Team"
                onSelect={() => setOpen(false)}
              />
            )}

            <Item
              href="/settings"
              icon={Settings}
              label="Settings"
              onSelect={() => setOpen(false)}
            />
          </div>

          <div className="border-t border-[#0B1020]/[0.06] p-1.5">
            <a
              href={signOutHref}
              role="menuitem"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut size={15} aria-hidden />
              Sign out
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Item({
  href,
  icon: Icon,
  label,
  onSelect,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#5A6173] transition-colors hover:bg-[#FAFAF9] hover:text-[#0B1020]"
    >
      <Icon size={15} aria-hidden />
      {label}
    </Link>
  );
}

function Avatar({
  name,
  avatarUrl,
  large = false,
}: {
  name: string;
  avatarUrl?: string | null;
  large?: boolean;
}) {
  const size = large ? 'h-10 w-10 text-xs' : 'h-8 w-8 text-[10px]';

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={large ? 40 : 32}
        height={large ? 40 : 32}
        className={`${size} shrink-0 rounded-lg object-cover`}
      />
    );
  }

  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-[#0B1020] font-bold text-white`}
    >
      {initials(name)}
    </span>
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

function tidyRole(role: string) {
  return role.replaceAll('_', ' ').toLowerCase();
}