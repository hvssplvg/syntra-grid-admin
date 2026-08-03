'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';

type HeaderProps = {
  adminName: string;
  adminEmail: string;
  adminRole: string;
  collapsed: boolean;
  onOpenMobile: () => void;
  onSignOut: () => void;
};

export default function Header({
  adminName,
  adminEmail,
  adminRole,
  collapsed,
  onOpenMobile,
  onSignOut,
}: HeaderProps) {
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const initials = adminName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function closeAccountMenu() {
    setAccountMenuOpen(false);
  }

  function handleSignOut() {
    setAccountMenuOpen(false);
    onSignOut();
  }

  return (
    <header
      className={`fixed right-0 top-0 z-20 flex h-20 items-center border-b border-[#102A22]/[0.06] bg-white/90 px-5 backdrop-blur-xl transition-all duration-300 sm:px-7 ${
        collapsed ? 'lg:left-[88px]' : 'lg:left-[270px]'
      } left-0`}
    >
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={onOpenMobile}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#102A22]/10 bg-white text-[#102A22] transition hover:bg-[#F4F8FD] lg:hidden"
          >
            <Menu size={18} />
          </button>

          <div className="hidden min-w-[260px] items-center gap-2 rounded-xl border border-[#102A22]/[0.07] bg-[#F4F8FD]/70 px-3.5 py-2.5 md:flex">
            <Search
              size={15}
              className="shrink-0 text-[#5F6F68]/55"
            />

            <input
              type="search"
              placeholder="Search clients, projects, or tickets..."
              className="w-full bg-transparent text-sm text-[#102A22] outline-none placeholder:text-[#5F6F68]/45"
            />

            <kbd className="rounded-md border border-[#102A22]/[0.07] bg-white px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#5F6F68]">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Open notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#102A22]/[0.07] bg-white text-[#5F6F68] transition hover:bg-[#F4F8FD] hover:text-[#102A22]"
          >
            <Bell size={17} />

            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
          </button>

          <div className="h-8 w-px bg-[#102A22]/[0.07]" />

          <div ref={accountMenuRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              onClick={() => {
                setAccountMenuOpen((current) => !current);
              }}
              className="flex min-w-0 items-center gap-3 rounded-xl p-1.5 pr-2 transition hover:bg-[#F4F8FD]"
            >
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D4AF37]/20 bg-white shadow-sm">
                <Image
                  src="/images/syntra-logo.png"
                  alt="Syntra Grid"
                  fill
                  sizes="36px"
                  className="object-contain p-1"
                />
              </div>

              <div className="hidden min-w-0 text-left sm:block">
                <p className="max-w-[150px] truncate text-xs font-bold text-[#102A22]">
                  {adminName}
                </p>

                <p className="max-w-[170px] truncate text-[10px] font-medium text-[#5F6F68]">
                  {adminRole} · {adminEmail}
                </p>
              </div>

              <ChevronDown
                size={14}
                className={`hidden shrink-0 text-[#5F6F68] transition-transform duration-200 sm:block ${
                  accountMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {accountMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-2xl border border-[#102A22]/[0.08] bg-white p-1.5 shadow-[0_20px_60px_rgba(11,16,32,0.16)]"
              >
                <div className="border-b border-[#102A22]/[0.06] px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D4AF37]/20 bg-white">
                      <Image
                        src="/images/syntra-logo.png"
                        alt="Syntra Grid"
                        fill
                        sizes="40px"
                        className="object-contain p-1"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#102A22]">
                        {adminName || initials || 'Administrator'}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-[#5F6F68]">
                        {adminEmail}
                      </p>

                      <span className="mt-1 inline-flex rounded-full bg-[#0F6A4B]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#0F6A4B]">
                        {adminRole}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="py-1.5">
                  <HeaderMenuLink
                    href="/profile"
                    icon={UserRound}
                    label="Profile"
                    onClick={closeAccountMenu}
                  />

                  <HeaderMenuLink
                    href="/settings"
                    icon={Settings}
                    label="Account settings"
                    onClick={closeAccountMenu}
                  />

                  <HeaderMenuLink
                    href="/team"
                    icon={Users}
                    label="Team management"
                    onClick={closeAccountMenu}
                  />
                </div>

                <div className="border-t border-[#102A22]/[0.06] pt-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function HeaderMenuLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: typeof UserRound;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#5F6F68] transition hover:bg-[#F4F8FD] hover:text-[#102A22]"
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}