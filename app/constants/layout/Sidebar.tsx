'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Settings, X } from 'lucide-react';

import {
  dashboardSections,
  findActiveSection,
  isNavigationItemActive,
  systemNavigation,
} from '../../constants/navigation';

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSignOut: () => void;
};

export default function Sidebar({
  mobileOpen,
  onCloseMobile,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();
  const activeSection = findActiveSection(pathname);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-[#07150F]/35 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[78px] flex-col items-center',
          'border-r border-[#102A22]/[0.06]',
          'bg-[#F4F8F5]/95 backdrop-blur-xl',
          'transition-transform duration-300',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-[78px] w-full items-center justify-center">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            aria-label="Syntra Grid"
            className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[15px] border border-[#D4AF37]/20 bg-white shadow-[0_8px_24px_rgba(16,42,34,0.08)]"
          >
            <Image
              src="/images/syntra-logo.png"
              alt="Syntra Grid"
              fill
              priority
              sizes="44px"
              className="object-contain p-1.5"
            />
          </Link>
        </div>

        <div className="h-px w-8 bg-[#102A22]/[0.08]" />

        <nav className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto px-2 py-4">
          {dashboardSections.map((section) => {
            const Icon = section.icon;
            const active = activeSection?.id === section.id;
            const href = section.items[0]?.href ?? '/dashboard';

            return (
              <Link
                key={section.id}
                href={href}
                onClick={onCloseMobile}
                aria-label={section.label}
                title={section.label}
                className={[
                  'group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]',
                  'transition-all duration-200',
                  active
                    ? 'bg-[#102A22] text-white shadow-[0_8px_20px_rgba(16,42,34,0.18)]'
                    : 'text-[#6A7771] hover:bg-white hover:text-[#102A22] hover:shadow-sm',
                ].join(' ')}
              >
                {active && (
                  <span className="absolute -left-[10px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#D4AF37]" />
                )}

                <Icon
                  size={18}
                  strokeWidth={active ? 2.35 : 1.9}
                />

                <span className="pointer-events-none absolute left-[56px] z-[80] hidden whitespace-nowrap rounded-xl border border-[#102A22]/10 bg-[#102A22] px-3 py-2 text-xs font-semibold text-white shadow-xl group-hover:block">
                  {section.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex w-full flex-col items-center gap-2 border-t border-[#102A22]/[0.06] px-2 py-4">
          {systemNavigation.map((item) => {
            const active = isNavigationItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                aria-label={item.label}
                title={item.label}
                className={[
                  'group relative flex h-11 w-11 items-center justify-center rounded-[14px] transition-all duration-200',
                  active
                    ? 'bg-[#102A22] text-white'
                    : 'text-[#6A7771] hover:bg-white hover:text-[#102A22]',
                ].join(' ')}
              >
                <Settings size={18} />

                <span className="pointer-events-none absolute left-[56px] z-[80] hidden whitespace-nowrap rounded-xl bg-[#102A22] px-3 py-2 text-xs font-semibold text-white shadow-xl group-hover:block">
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="group relative flex h-11 w-11 items-center justify-center rounded-[14px] text-[#6A7771] transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} />

            <span className="pointer-events-none absolute left-[56px] z-[80] hidden whitespace-nowrap rounded-xl bg-[#102A22] px-3 py-2 text-xs font-semibold text-white shadow-xl group-hover:block">
              Sign out
            </span>
          </button>
        </div>

        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="absolute right-[-46px] top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#102A22] shadow-lg lg:hidden"
        >
          <X size={17} />
        </button>
      </aside>
    </>
  );
}