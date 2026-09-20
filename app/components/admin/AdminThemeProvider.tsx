'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/* ============================================================================
   TYPES
============================================================================ */

export type AdminTheme = 'light' | 'dark';

type AdminThemeContextValue = {
  theme: AdminTheme;
  setTheme: (theme: AdminTheme) => void;
  toggleTheme: () => void;
};

type AdminThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: AdminTheme;
};

/* ============================================================================
   CONSTANTS
============================================================================ */

const STORAGE_KEY = 'syntra-grid-admin-theme';

const AdminThemeContext =
  createContext<AdminThemeContextValue | null>(null);

/* ============================================================================
   THEME VARIABLES

   These variables are consumed by:

   AdminShell
   AdminSidebar
   AdminHeader
   AdminPageIdentity
   tabs/*
   common/*

   This means the rest of the admin should NOT need separate hard-coded
   light/dark Tailwind classes for the application chrome.
============================================================================ */

const LIGHT_THEME = {
  '--canvas': '#F1F1EE',

  '--shell': '#FFFFFF',
  '--shell-translucent': 'rgba(255, 255, 255, 0.88)',

  '--surface': '#FFFFFF',
  '--surface-muted': '#F5F5F2',
  '--surface-hover': '#ECEDEA',
  '--surface-elevated': '#FFFFFF',

  '--line': 'rgba(15, 23, 42, 0.075)',
  '--line-strong': 'rgba(15, 23, 42, 0.14)',

  '--text': '#111827',
  '--text-muted': '#667085',
  '--text-subtle': '#98A2B3',

  /*
   * Primary is intentionally dark/navy rather than gold.
   *
   * The reference architecture uses a strong neutral primary for selected
   * navigation, while the Syntra Grid gold remains an accent.
   */
  '--primary': '#0B1020',
  '--primary-hover': '#151C31',
  '--primary-foreground': '#FFFFFF',

  '--accent': '#B88A24',
  '--accent-strong': '#9C7015',
  '--accent-soft': '#D4AF37',
  '--accent-tint': 'rgba(212, 175, 55, 0.11)',

  '--success': '#0D9488',
  '--success-soft': 'rgba(20, 184, 166, 0.11)',

  '--warning': '#D97706',
  '--warning-soft': 'rgba(245, 158, 11, 0.11)',

  '--danger': '#DC2626',
  '--danger-soft': 'rgba(239, 68, 68, 0.10)',

  '--info': '#4F46E5',
  '--info-soft': 'rgba(99, 102, 241, 0.10)',

  '--tooltip-bg': 'rgba(255, 255, 255, 0.96)',

  '--shadow-card':
    '0 18px 50px rgba(15, 23, 42, 0.075), 0 2px 8px rgba(15, 23, 42, 0.035)',

  '--shadow-soft':
    '0 8px 24px rgba(15, 23, 42, 0.07)',

  '--shadow-popover':
    '0 20px 60px rgba(15, 23, 42, 0.14)',
} as const;

const DARK_THEME = {
  /*
   * The canvas should remain visibly different from the main application
   * shell. That separation is what makes the floating layout work.
   */
  '--canvas': '#090B10',

  '--shell': '#11141B',
  '--shell-translucent': 'rgba(17, 20, 27, 0.88)',

  '--surface': '#171A22',
  '--surface-muted': '#1D2029',
  '--surface-hover': '#242832',
  '--surface-elevated': '#1A1E27',

  '--line': 'rgba(255, 255, 255, 0.075)',
  '--line-strong': 'rgba(255, 255, 255, 0.14)',

  '--text': '#F4F4F5',
  '--text-muted': '#A1A7B3',
  '--text-subtle': '#737A88',

  /*
   * Selected navigation becomes light in dark mode so the contrast remains
   * deliberate rather than turning the entire interface black-on-black.
   */
  '--primary': '#F3F4F6',
  '--primary-hover': '#FFFFFF',
  '--primary-foreground': '#10131A',

  '--accent': '#D4AF37',
  '--accent-strong': '#E1C15C',
  '--accent-soft': '#E4C86B',
  '--accent-tint': 'rgba(212, 175, 55, 0.12)',

  '--success': '#2DD4BF',
  '--success-soft': 'rgba(45, 212, 191, 0.11)',

  '--warning': '#FBBF24',
  '--warning-soft': 'rgba(251, 191, 36, 0.11)',

  '--danger': '#F87171',
  '--danger-soft': 'rgba(248, 113, 113, 0.11)',

  '--info': '#818CF8',
  '--info-soft': 'rgba(129, 140, 248, 0.11)',

  '--tooltip-bg': 'rgba(24, 27, 35, 0.97)',

  '--shadow-card':
    '0 20px 60px rgba(0, 0, 0, 0.28), 0 2px 10px rgba(0, 0, 0, 0.18)',

  '--shadow-soft':
    '0 10px 30px rgba(0, 0, 0, 0.22)',

  '--shadow-popover':
    '0 24px 70px rgba(0, 0, 0, 0.42)',
} as const;

/* ============================================================================
   PROVIDER
============================================================================ */

export function AdminThemeProvider({
  children,
  defaultTheme = 'light',
}: AdminThemeProviderProps) {
  /*
   * Keep the initial render deterministic.
   *
   * Reading localStorage directly inside useState would cause hydration
   * differences between server and browser rendering.
   */
  const [theme, setThemeState] =
    useState<AdminTheme>(defaultTheme);

  const [hydrated, setHydrated] =
    useState(false);

  /* --------------------------------------------------------------------------
     INITIAL THEME
  -------------------------------------------------------------------------- */

  useEffect(() => {
    let nextTheme: AdminTheme = defaultTheme;

    try {
      const saved =
        window.localStorage.getItem(STORAGE_KEY);

      if (
        saved === 'light' ||
        saved === 'dark'
      ) {
        nextTheme = saved;
      } else if (
        window.matchMedia(
          '(prefers-color-scheme: dark)',
        ).matches
      ) {
        nextTheme = 'dark';
      }
    } catch {
      /*
       * localStorage can fail in restrictive/private browser environments.
       * The admin should still work using defaultTheme.
       */
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(nextTheme);
    setHydrated(true);
  }, [defaultTheme]);

  /* --------------------------------------------------------------------------
     SET THEME
  -------------------------------------------------------------------------- */

  const setTheme = useCallback(
    (nextTheme: AdminTheme) => {
      setThemeState(nextTheme);

      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          nextTheme,
        );
      } catch {
        // Persistence is optional; theme switching should still work.
      }
    },
    [],
  );

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next =
        current === 'light'
          ? 'dark'
          : 'light';

      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          next,
        );
      } catch {
        // Ignore storage failures.
      }

      return next;
    });
  }, []);

  /* --------------------------------------------------------------------------
     APPLY DOCUMENT METADATA

     This also lets native controls/browser chrome understand whether the
     current interface is light or dark.
  -------------------------------------------------------------------------- */

  useEffect(() => {
    if (!hydrated) return;

    const root =
      document.documentElement;

    root.dataset.adminTheme = theme;

    root.style.colorScheme = theme;

    /*
     * We deliberately do NOT add/remove Tailwind's global `dark` class here.
     * This admin has its own theme system and should not unexpectedly change
     * unrelated public/auth pages.
     */
  }, [theme, hydrated]);

  /* --------------------------------------------------------------------------
     CONTEXT
  -------------------------------------------------------------------------- */

  const value =
    useMemo<AdminThemeContextValue>(
      () => ({
        theme,
        setTheme,
        toggleTheme,
      }),
      [
        theme,
        setTheme,
        toggleTheme,
      ],
    );

  const variables =
    theme === 'dark'
      ? DARK_THEME
      : LIGHT_THEME;

  return (
    <AdminThemeContext.Provider
      value={value}
    >
      <div
        data-admin-theme={theme}
        suppressHydrationWarning
        style={
          variables as React.CSSProperties
        }
        className="
          admin-theme-root
          min-h-[100dvh]
          bg-[var(--canvas)]
          text-[var(--text)]
        "
      >
        {children}
      </div>
    </AdminThemeContext.Provider>
  );
}

/* ============================================================================
   HOOK
============================================================================ */

export function useAdminTheme() {
  const context =
    useContext(AdminThemeContext);

  if (!context) {
    throw new Error(
      'useAdminTheme must be used inside AdminThemeProvider.',
    );
  }

  return context;
}