'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react';

import { dashboardNavigation } from '../../constants/navigation';

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onSignOut: () => void;
};

const PREMIUM_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const WASH =
  'linear-gradient(135deg, rgba(212,175,55,0.18), rgba(20,184,166,0.13)), #FFFFFF';

export default function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();

  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(
    new Map(),
  );

  const [indicator, setIndicator] = useState<{
    top: number;
    height: number;
  } | null>(null);

  const [indicatorReady, setIndicatorReady] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const activeHref =
    dashboardNavigation.find((item) => isActive(item.href))
      ?.href ?? null;

  const measureIndicator = () => {
    if (!activeHref || !navRef.current) {
      return;
    }

    const element = itemRefs.current.get(activeHref);

    if (!element) {
      return;
    }

    const navBox = navRef.current.getBoundingClientRect();
    const elementBox = element.getBoundingClientRect();

    setIndicator({
      top: elementBox.top - navBox.top,
      height: elementBox.height,
    });
  };

  useLayoutEffect(() => {
    measureIndicator();

    const animationFrame = requestAnimationFrame(() => {
      setIndicatorReady(true);
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHref, collapsed]);

  useEffect(() => {
    if (!navRef.current) {
      return;
    }

    const observer = new ResizeObserver(() => {
      measureIndicator();
    });

    observer.observe(navRef.current);

    return () => {
      observer.disconnect();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-[#0B1020]/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
        />
      )}

      <aside
        style={{ background: WASH }}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#D4AF37]/15 text-[#0B1020] shadow-[8px_0_24px_rgba(11,16,32,0.05)] backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:z-30 ${
          collapsed ? 'lg:w-[88px]' : 'lg:w-[270px]'
        } ${
          mobileOpen
            ? 'w-[280px] translate-x-0'
            : 'w-[280px] -translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-[#D4AF37]/15 px-5">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className={`flex min-w-0 items-center ${
              collapsed ? 'justify-center' : 'gap-3'
            }`}
          >
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#D4AF37]/20 bg-white shadow-lg shadow-[#D4AF37]/15">
              <Image
                src="/images/syntra-logo.png"
                alt="Syntra Grid logo"
                fill
                priority
                sizes="44px"
                className="object-contain p-1.5"
              />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-base font-bold tracking-tight text-[#0B1020]">
                  Syntra Grid
                </p>

                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.15em] text-[#5A6173]">
                  Admin Control Centre
                </p>
              </div>
            )}
          </Link>

          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onCloseMobile}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#5A6173] transition hover:bg-[#0B1020]/[0.06] hover:text-[#0B1020] lg:hidden"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          {!collapsed && (
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5A6173]/70">
              Workspace
            </p>
          )}

          <nav ref={navRef} className="relative space-y-1.5">
            {indicator && (
              <div
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 rounded-xl bg-[#FFF8E1] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.25)]"
                style={{
                  top: indicator.top,
                  height: indicator.height,
                  transition: indicatorReady
                    ? `top 420ms ${PREMIUM_EASE}, height 420ms ${PREMIUM_EASE}, opacity 200ms ease`
                    : 'none',
                  opacity: 1,
                }}
              />
            )}

            {dashboardNavigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  title={collapsed ? item.label : undefined}
                  ref={(element) => {
                    if (element) {
                      itemRefs.current.set(item.href, element);
                    } else {
                      itemRefs.current.delete(item.href);
                    }
                  }}
                  className={`group relative z-10 flex h-12 items-center rounded-xl transition-colors duration-200 ease-out ${
                    collapsed
                      ? 'justify-center px-0'
                      : 'gap-3 px-3.5'
                  } ${
                    active
                      ? 'text-[#0B1020]'
                      : 'text-[#5A6173] hover:bg-[#0B1020]/[0.04] hover:text-[#0B1020]'
                  }`}
                >
                  {active && (
                    <span className="absolute -left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[#D4AF37] to-[#A87B1B]" />
                  )}

                  <Icon
                    size={18}
                    strokeWidth={active ? 2.4 : 2}
                    className="shrink-0 transition-transform duration-200"
                  />

                  {!collapsed && (
                    <span className="truncate text-sm font-semibold">
                      {item.label}
                    </span>
                  )}

                  {collapsed && (
                    <span className="pointer-events-none absolute left-[66px] z-50 hidden whitespace-nowrap rounded-lg border border-[#D4AF37]/30 bg-[#0B1020] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:block group-hover:opacity-100">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#D4AF37]/15 p-3">
          <button
            type="button"
            onClick={onSignOut}
            className={`flex h-11 w-full items-center rounded-xl text-[#5A6173] transition-colors duration-200 hover:bg-red-500/10 hover:text-red-600 ${
              collapsed ? 'justify-center' : 'gap-3 px-3.5'
            }`}
          >
            <LogOut size={17} />

            {!collapsed && (
              <span className="text-sm font-semibold">
                Sign out
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            className={`mt-2 hidden h-10 w-full items-center rounded-xl bg-[#0B1020]/[0.04] text-[#5A6173] transition-colors duration-200 hover:bg-[#0B1020]/10 hover:text-[#0B1020] lg:flex ${
              collapsed
                ? 'justify-center'
                : 'justify-between px-3.5'
            }`}
          >
            {!collapsed && (
              <span className="text-xs font-semibold">
                Collapse sidebar
              </span>
            )}

            {collapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}