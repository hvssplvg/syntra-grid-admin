'use client';

import {
  Bell,
  Menu,
  Search,
} from 'lucide-react';

type HeaderProps = {
  adminName: string;
  adminEmail: string;
  adminRole: string;
  collapsed: boolean;
  onOpenMobile: () => void;
};

export default function Header({
  adminName,
  adminEmail,
  adminRole,
  collapsed,
  onOpenMobile,
}: HeaderProps) {
  const initials = adminName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

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
            onClick={onOpenMobile}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#102A22]/10 bg-white text-[#102A22] transition hover:bg-[#F4F8FD] lg:hidden"
          >
            <Menu size={18} />
          </button>

          <div className="hidden min-w-[260px] items-center gap-2 rounded-xl border border-[#102A22]/[0.07] bg-[#F4F8FD]/70 px-3.5 py-2.5 md:flex">
            <Search size={15} className="shrink-0 text-[#5F6F68]/55" />

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
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#102A22]/[0.07] bg-white text-[#5F6F68] transition hover:bg-[#F4F8FD] hover:text-[#102A22]"
          >
            <Bell size={17} />

            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
          </button>

          <div className="h-8 w-px bg-[#102A22]/[0.07]" />

          <button
            type="button"
            className="flex min-w-0 items-center gap-3 rounded-xl p-1.5 pr-2 transition hover:bg-[#F4F8FD]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F6A4B] to-[#1E4E8C] text-xs font-bold text-white">
              {initials || 'CG'}
            </div>

            <div className="hidden min-w-0 text-left sm:block">
              <p className="max-w-[150px] truncate text-xs font-bold text-[#102A22]">
                {adminName}
              </p>

              <p className="max-w-[150px] truncate text-[10px] font-medium text-[#5F6F68]">
                {adminRole} · {adminEmail}
              </p>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}