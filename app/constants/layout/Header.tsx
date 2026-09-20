'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

import {
  findActiveNavigationItem,
  findActiveSection,
  isNavigationItemActive,
} from '../../constants/navigation';

type HeaderProps = {
  adminName: string;
  adminEmail: string;
  adminRole: string;
  onOpenMobile: () => void;
  onSignOut: () => void;
};

export default function Header({
  adminName,
  adminEmail,
  adminRole,
  onOpenMobile,
  onSignOut,
}: HeaderProps) {
  const pathname = usePathname();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const activeSection = findActiveSection(pathname);
  const activeItem = findActiveNavigationItem(pathname);

  const workspaceTitle =
    activeSection?.label ??
    activeItem?.label ??
    'Syntra Grid';

  const workspaceDescription =
    activeSection?.description ??
    activeItem?.description ??
    'Company operating system';

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

  function handleSignOut() {
    setAccountMenuOpen(false);
    onSignOut();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#102A22]/[0.06] bg-white/90 backdrop-blur-xl">
      <div className="flex min-h-[76px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onOpenMobile}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#102A22]/10 bg-white text-[#102A22] lg:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#829089]">
            <span>Syntra Grid</span>
            <span className="text-[#D4AF37]">/</span>
            <span>{workspaceTitle}</span>
          </div>

          <div className="mt-1 flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-lg font-bold tracking-[-0.02em] text-[#102A22]">
              {workspaceTitle}
            </h1>

            <p className="hidden truncate text-xs text-[#6A7771] xl:block">
              {workspaceDescription}
            </p>
          </div>
        </div>

        <div className="hidden min-w-[280px] max-w-[390px] flex-1 items-center gap-2 rounded-xl border border-[#102A22]/[0.07] bg-[#F4F8F5] px-3.5 py-2.5 md:flex">
          <Search size={15} className="shrink-0 text-[#6A7771]/60" />

          <input
            type="search"
            placeholder="Search Syntra Grid..."
            className="w-full bg-transparent text-sm text-[#102A22] outline-none placeholder:text-[#6A7771]/50"
          />

          <kbd className="rounded-md border border-[#102A22]/[0.07] bg-white px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#6A7771]">
            ⌘K
          </kbd>
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#102A22]/[0.07] bg-white text-[#6A7771] transition hover:bg-[#F4F8F5] hover:text-[#102A22]"
        >
          <Bell size={17} />

          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
        </button>

        <div ref={accountMenuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            onClick={() => setAccountMenuOpen((current) => !current)}
            className="flex items-center gap-2 rounded-xl border border-transparent p-1.5 transition hover:border-[#102A22]/[0.06] hover:bg-[#F4F8F5]"
          >
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-[#D4AF37]/20 bg-white">
              <Image
                src="/images/syntra-logo.png"
                alt="Syntra Grid"
                fill
                sizes="36px"
                className="object-contain p-1"
              />
            </div>

            <div className="hidden min-w-0 text-left sm:block">
              <p className="max-w-[130px] truncate text-xs font-bold text-[#102A22]">
                {adminName}
              </p>

              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#6A7771]">
                {tidyRole(adminRole)}
              </p>
            </div>

            <ChevronDown
              size={13}
              className={`hidden text-[#6A7771] transition-transform sm:block ${
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
                <p className="truncate text-sm font-bold text-[#102A22]">
                  {adminName}
                </p>

                <p className="mt-0.5 truncate text-xs text-[#6A7771]">
                  {adminEmail}
                </p>

                <span className="mt-2 inline-flex rounded-full bg-[#102A22]/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#102A22]">
                  {tidyRole(adminRole)}
                </span>
              </div>

              <div className="py-1.5">
                <MenuLink
                  href="/profile"
                  icon={UserRound}
                  label="Profile"
                  onClick={() => setAccountMenuOpen(false)}
                />

                <MenuLink
                  href="/settings"
                  icon={Settings}
                  label="Settings"
                  onClick={() => setAccountMenuOpen(false)}
                />

                <MenuLink
                  href="/team"
                  icon={Users}
                  label="Team"
                  onClick={() => setAccountMenuOpen(false)}
                />
              </div>

              <div className="border-t border-[#102A22]/[0.06] pt-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeSection && activeSection.items.length > 0 && (
        <div className="overflow-x-auto border-t border-[#102A22]/[0.045] px-4 sm:px-6 lg:px-8">
          <nav className="flex min-w-max items-center gap-1">
            {activeSection.items.map((item) => {
              const active = isNavigationItemActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'relative flex h-12 items-center px-3 text-xs font-semibold transition-colors',
                    active
                      ? 'text-[#102A22]'
                      : 'text-[#75827C] hover:text-[#102A22]',
                  ].join(' ')}
                >
                  {item.label}

                  {active && (
                    <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-[#D4AF37]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuLink({
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
      className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#6A7771] transition hover:bg-[#F4F8F5] hover:text-[#102A22]"
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

function tidyRole(role: string) {
  return role
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}