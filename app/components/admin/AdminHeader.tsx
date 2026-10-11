/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

import useSWR, { preload } from "swr";

import {
  CLIENTS_ENDPOINT,
  fetchClientsPayload,
} from "@/lib/clients/clientsApi";

import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  Command,
  LoaderCircle,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import type {
  AdminSection,
  AdminTab,
  AdminUser,
} from "./adminNav";

import {
  isCommandSection,
  shouldShowSectionTabBar,
} from "./adminNav";

import { useAdminTheme } from "./AdminThemeProvider";

/* =============================================================================
   TYPES
============================================================================= */

type AdminHeaderProps = {
  admin: AdminUser;
  sections: AdminSection[];
  activeSection: AdminSection;
  activeTab: AdminTab;
  onTabSelect: (tab: AdminTab) => void;
  isFullAccess?: boolean;
};

type SearchResult = {
  id: string;
  label: string;
  description: string;
  tab: AdminTab;
  section: string;
};

type ThemeMode = "light" | "dark";

type TabIndicatorPosition = {
  left: number;
  width: number;
  ready: boolean;
};

type WorkspaceContextType = "company" | "client";

type WorkspaceContext = {
  id: string;
  type: WorkspaceContextType;
  entityId: string | null;
  label: string;
  shortLabel: string;
  description: string;
  logoUrl?: string | null;
  status?: string | null;
};

type ClientApiRecord = {
  id: string;
  name: string;
  displayName?: string | null;
  slug?: string | null;
  industry?: string | null;
  description?: string | null;
  logo?: string | null;
  logoUrl?: string | null;
  status: string;
  productName?: string | null;
};

/* =============================================================================
   CURRENT USER PROFILE
============================================================================= */

type EmployeeProfile = {
  id: string;
  email: string;
  role: string;

  restrictedAccess: boolean;

  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  fullName: string;

  avatarUrl: string | null;
  jobTitle: string | null;

  employeeId: string | null;

  department: {
    id: string;
    name: string;
  } | null;
};

type ProfileApiResponse = {
  ok: boolean;
  profile?: EmployeeProfile;
  error?: string;
};

/* =============================================================================
   CONFIGURATION
============================================================================= */

const WORKSPACE_STORAGE_KEY =
  "syntragrid.workspace-context";

const COMPANY_LOGO_URL =
  "/images/syntra-logo.png";

const OPERATIONAL_CLIENT_STATUSES = new Set([
  "ACTIVE",
  "ONBOARDING",
  "PAUSED",
]);

const COMPANY_CONTEXT: WorkspaceContext = {
  id: "company",
  type: "company",
  entityId: null,
  label: "Syntra Grid",
  shortLabel: "SG",
  description: "Company-wide view",
  logoUrl: COMPANY_LOGO_URL,
  status: "ACTIVE",
};

/* =============================================================================
   PROFILE FETCHER
============================================================================= */

/**
 * Fetch only the authenticated user's profile.
 *
 * The /api/admin/me endpoint resolves the linked Employee record and returns:
 *
 * - Employee name
 * - Employee photograph
 * - Employee job title
 * - Employee department
 * - Authenticated account details
 *
 * This replaces the previous approach of downloading the entire Team list
 * just to retrieve the current user's profile photograph.
 */

async function fetchCurrentProfile(
  _key: string,
): Promise<EmployeeProfile> {
  const response = await fetch("/api/admin/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Unable to load your profile (${response.status}).`,
    );
  }

  const payload =
    (await response.json()) as ProfileApiResponse;

  if (!payload.ok || !payload.profile) {
    throw new Error(
      payload.error || "Unable to load your profile.",
    );
  }

  return payload.profile;
}

/* =============================================================================
   HELPERS
============================================================================= */

function cleanText(
  value: string | null | undefined,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function initials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatRole(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createShortLabel(value: string): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "CL";

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0].charAt(0) + words[1].charAt(0)
  ).toUpperCase();
}

function getClientContextDescription(
  client: ClientApiRecord,
): string {
  return (
    cleanText(client.productName) ||
    cleanText(client.industry) ||
    "Client workspace"
  );
}

function adminAvatarFallback(
  admin: AdminUser,
): string | null {
  const record = admin as AdminUser & {
    avatarUrl?: string | null;
  };

  return cleanText(record.avatarUrl) || null;
}

/**
 * Only show actions whose destination is actually present
 * in the user's permission-filtered navigation.
 */
function hasAccessibleTab(
  sections: AdminSection[],
  tab: AdminTab,
): boolean {
  return sections.some((section) =>
    section.items.some((item) => item.tab === tab),
  );
}

/* =============================================================================
   PROFILE AVATAR
============================================================================= */

function ProfileAvatar({
  name,
  url,
  size = "small",
}: {
  name: string;
  url?: string | null;
  size?: "small" | "large";
}) {
  const [failedUrl, setFailedUrl] =
    useState<string | null>(null);

  const classes =
    size === "large"
      ? "h-10 w-10 text-[10px]"
      : "h-8 w-8 text-[9px]";

  const imageUrl = cleanText(url);

  const showImage =
    Boolean(imageUrl) &&
    failedUrl !== imageUrl;

  return (
    <span
      className={`
        flex shrink-0 items-center justify-center
        overflow-hidden rounded-full
        bg-[var(--primary)]
        font-bold uppercase tracking-[0.03em]
        text-[var(--primary-foreground)]
        ${classes}
      `}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`${name}'s profile picture`}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/* =============================================================================
   MAIN HEADER
============================================================================= */

export default function AdminHeader({
  admin,
  sections,
  activeSection,
  activeTab,
  onTabSelect,
  isFullAccess = true,
}: AdminHeaderProps) {
  const { theme, setTheme } = useAdminTheme();

  const commandWorkspace =
    isCommandSection(activeSection);

  const showTabBar =
    shouldShowSectionTabBar(
      activeSection,
      isFullAccess,
    );

  const ActiveSectionIcon =
    activeSection.icon;

  /* ===========================================================================
     REFS
  =========================================================================== */

  const searchInputRef =
    useRef<HTMLInputElement>(null);

  const profileRef =
    useRef<HTMLDivElement>(null);

  const contextRef =
    useRef<HTMLDivElement>(null);

  const notificationsRef =
    useRef<HTMLDivElement>(null);

  const tabRowRef =
    useRef<HTMLDivElement>(null);

  const tabButtonRefs =
    useRef<Map<AdminTab, HTMLButtonElement>>(
      new Map(),
    );

  /* ===========================================================================
     STATE
  =========================================================================== */

  const [
    tabIndicator,
    setTabIndicator,
  ] = useState<TabIndicatorPosition>({
    left: 0,
    width: 0,
    ready: false,
  });

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [contextOpen, setContextOpen] =
    useState(false);

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] = useState(false);

  const [signingOut, setSigningOut] =
    useState(false);

  /* ===========================================================================
     USER PROFILE
  =========================================================================== */

  const {
    data: employeeProfile,
    mutate: refreshProfile,
  } = useSWR(
    admin.id
      ? ["syntragrid:current-profile", admin.id] as const
      : null,

    ([key]) => fetchCurrentProfile(key),

    {
      dedupingInterval: 15_000,
      revalidateOnFocus: true,
      refreshInterval: 120_000,
      shouldRetryOnError: false,
    },
  );

  /**
   * Prefer the employee's actual name.
   *
   * For unrestricted accounts with no linked Employee record,
   * preserve the existing AdminUser name.
   */
  const profileName = useMemo(() => {
    const preferredName =
      cleanText(employeeProfile?.preferredName);

    const fullName =
      cleanText(employeeProfile?.fullName);

    return (
      preferredName ||
      fullName ||
      admin.fullName
    );
  }, [
    employeeProfile?.preferredName,
    employeeProfile?.fullName,
    admin.fullName,
  ]);

  /**
   * Employee.avatarUrl takes precedence.
   *
   * If no Employee photograph exists, use AdminUser.avatarUrl.
   */
  const profileAvatarUrl = useMemo(() => {
    return (
      cleanText(employeeProfile?.avatarUrl) ||
      adminAvatarFallback(admin)
    );
  }, [employeeProfile?.avatarUrl, admin]);

  /**
   * Never display VIEWER as the professional job title
   * for restricted employee accounts.
   */
  const profileJobTitle = useMemo(() => {
    const actualJobTitle =
      cleanText(employeeProfile?.jobTitle);

    if (!isFullAccess) {
      return actualJobTitle || "Team member";
    }

    return actualJobTitle || formatRole(admin.role);
  }, [
    employeeProfile?.jobTitle,
    isFullAccess,
    admin.role,
  ]);

  const profileDepartment =
    cleanText(employeeProfile?.department?.name) ||
    null;

  /* ===========================================================================
     PROFILE REFRESH EVENTS
  =========================================================================== */

  useEffect(() => {
    const refresh = () => {
      void refreshProfile();
    };

    window.addEventListener(
      "syntragrid:employee-avatar-updated",
      refresh,
    );

    window.addEventListener(
      "syntragrid:employee-profile-updated",
      refresh,
    );

    return () => {
      window.removeEventListener(
        "syntragrid:employee-avatar-updated",
        refresh,
      );

      window.removeEventListener(
        "syntragrid:employee-profile-updated",
        refresh,
      );
    };
  }, [refreshProfile]);

  /* ===========================================================================
     PERMITTED NAVIGATION
  =========================================================================== */

  const canOpenTeam =
    hasAccessibleTab(sections, "team");

  const canOpenSettings =
    hasAccessibleTab(sections, "settings");

  const canOpenNotifications =
    hasAccessibleTab(sections, "notifications");

  const canOpenClients =
    isFullAccess &&
    hasAccessibleTab(sections, "clients");

  /* ===========================================================================
     CLIENT WORKSPACES
     
     Restricted employees must not automatically request the
     unrestricted Clients API.

     Their workspace selector stays on Syntra Grid until a properly
     permission-scoped client workspace API is implemented.
  =========================================================================== */

  const {
    data: clientsPayload,
    error: clientsSwrError,
    isLoading: clientsLoading,
    mutate: reloadClients,
  } = useSWR(
    canOpenClients
      ? CLIENTS_ENDPOINT
      : null,

    fetchClientsPayload,

    {
      dedupingInterval: 60_000,
      focusThrottleInterval: 60_000,
      revalidateOnFocus: true,
    },
  );

  const clients = useMemo(
    () =>
      (
        clientsPayload?.clients ?? []
      ) as unknown as ClientApiRecord[],
    [clientsPayload],
  );

  const clientsError = clientsSwrError
    ? clientsSwrError instanceof Error
      ? clientsSwrError.message
      : "Could not load clients."
    : null;

  const loadClients = useCallback(
    async () => {
      if (!canOpenClients) return;
      await reloadClients();
    },
    [canOpenClients, reloadClients],
  );

  /* ===========================================================================
     WORKSPACE CONTEXT
  =========================================================================== */

  const [
    selectedContextId,
    setSelectedContextId,
  ] = useState(COMPANY_CONTEXT.id);

  const [
    contextHydrated,
    setContextHydrated,
  ] = useState(false);

  useEffect(() => {
    if (!isFullAccess) {
      setSelectedContextId(COMPANY_CONTEXT.id);
      setContextHydrated(true);
      return;
    }

    try {
      const stored =
        window.localStorage.getItem(
          WORKSPACE_STORAGE_KEY,
        );

      if (stored) {
        setSelectedContextId(stored);
      }
    } catch (error) {
      console.warn(
        "Could not restore workspace context:",
        error,
      );
    } finally {
      setContextHydrated(true);
    }
  }, [isFullAccess]);

  const clientContexts =
    useMemo<WorkspaceContext[]>(() => {
      if (!canOpenClients) {
        return [];
      }

      return clients
        .filter((client) =>
          OPERATIONAL_CLIENT_STATUSES.has(
            client.status.trim().toUpperCase(),
          ),
        )
        .map((client) => {
          const label =
            cleanText(client.displayName) ||
            cleanText(client.name) ||
            "Unnamed client";

          return {
            id: `client:${client.id}`,
            type: "client" as const,
            entityId: client.id,
            label,
            shortLabel:
              createShortLabel(label),
            description:
              getClientContextDescription(client),
            logoUrl:
              cleanText(client.logoUrl) ||
              cleanText(client.logo) ||
              null,
            status: client.status,
          };
        })
        .sort((a, b) =>
          a.label.localeCompare(
            b.label,
            undefined,
            { sensitivity: "base" },
          ),
        );
    }, [clients, canOpenClients]);

  const workspaceContexts =
    useMemo<WorkspaceContext[]>(
      () => [
        COMPANY_CONTEXT,
        ...clientContexts,
      ],
      [clientContexts],
    );

  const currentContext = useMemo(() => {
    if (!isFullAccess) {
      return COMPANY_CONTEXT;
    }

    return (
      workspaceContexts.find(
        (context) =>
          context.id === selectedContextId,
      ) ?? COMPANY_CONTEXT
    );
  }, [
    isFullAccess,
    workspaceContexts,
    selectedContextId,
  ]);

  useEffect(() => {
    if (!isFullAccess) return;
    if (!contextHydrated) return;
    if (clientsLoading) return;
    if (!clientsPayload) return;
    if (clientsSwrError) return;

    const exists = workspaceContexts.some(
      (context) =>
        context.id === selectedContextId,
    );

    if (exists) return;

    setSelectedContextId(
      COMPANY_CONTEXT.id,
    );

    try {
      window.localStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        COMPANY_CONTEXT.id,
      );
    } catch {
      // Optional local preference.
    }
  }, [
    isFullAccess,
    contextHydrated,
    clientsLoading,
    clientsPayload,
    clientsSwrError,
    workspaceContexts,
    selectedContextId,
  ]);

  const selectWorkspaceContext =
    useCallback(
      (contextId: string) => {
        if (!isFullAccess) return;

        const permitted =
          workspaceContexts.some(
            (context) =>
              context.id === contextId,
          );

        if (!permitted) return;

        setSelectedContextId(contextId);
        setContextOpen(false);

        try {
          window.localStorage.setItem(
            WORKSPACE_STORAGE_KEY,
            contextId,
          );
        } catch (error) {
          console.warn(
            "Could not persist workspace context:",
            error,
          );
        }
      },
      [isFullAccess, workspaceContexts],
    );

  /* ===========================================================================
     GLOBAL SEARCH
  =========================================================================== */

  const searchIndex =
    useMemo<SearchResult[]>(
      () =>
        sections.flatMap((section) =>
          section.items.map((item) => ({
            id: `${section.id}-${item.tab}`,
            label: item.title,
            description: item.description,
            tab: item.tab,
            section: section.label,
          })),
        ),
      [sections],
    );

  const searchResults =
    useMemo(() => {
      const query =
        searchQuery.trim().toLowerCase();

      if (!query) {
        return searchIndex.slice(0, 8);
      }

      return searchIndex
        .filter((item) =>
          [
            item.label,
            item.description,
            item.section,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
        .slice(0, 10);
    }, [searchIndex, searchQuery]);

  /* ===========================================================================
     TAB INDICATOR
  =========================================================================== */

  const registerTabButton =
    useCallback(
      (
        tab: AdminTab,
        node: HTMLButtonElement | null,
      ) => {
        if (node) {
          tabButtonRefs.current.set(
            tab,
            node,
          );
        } else {
          tabButtonRefs.current.delete(
            tab,
          );
        }
      },
      [],
    );

  const updateTabIndicator =
    useCallback(() => {
      if (!showTabBar) return;

      const row = tabRowRef.current;

      const button =
        tabButtonRefs.current.get(
          activeTab,
        );

      if (!row || !button) return;

      const horizontalInset = 8;

      setTabIndicator({
        left:
          button.offsetLeft +
          horizontalInset,

        width: Math.max(
          button.offsetWidth -
            horizontalInset * 2,
          12,
        ),

        ready: true,
      });
    }, [
      activeTab,
      showTabBar,
    ]);

  useLayoutEffect(() => {
    updateTabIndicator();
  }, [
    activeSection.id,
    activeTab,
    updateTabIndicator,
  ]);

  useEffect(() => {
    if (!showTabBar) return;

    window.addEventListener(
      "resize",
      updateTabIndicator,
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateTabIndicator,
      );
    };
  }, [
    showTabBar,
    updateTabIndicator,
  ]);

  useEffect(() => {
    if (!showTabBar) return;

    const button =
      tabButtonRefs.current.get(
        activeTab,
      );

    if (!button) return;

    const reduced =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

    button.scrollIntoView({
      behavior: reduced
        ? "auto"
        : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [
    activeTab,
    showTabBar,
  ]);

  const tabIndicatorStyle =
    useMemo<CSSProperties>(
      () => ({
        width: tabIndicator.width,
        transform: `translate3d(${tabIndicator.left}px,0,0)`,
        opacity:
          tabIndicator.ready ? 1 : 0,
      }),
      [tabIndicator],
    );

  /* ===========================================================================
     CLOSE MENUS ON OUTSIDE CLICK
  =========================================================================== */

  useEffect(() => {
    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        profileRef.current &&
        !profileRef.current.contains(target)
      ) {
        setProfileOpen(false);
      }

      if (
        contextRef.current &&
        !contextRef.current.contains(target)
      ) {
        setContextOpen(false);
      }

      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    };

    window.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
    };
  }, []);

  /* ===========================================================================
     KEYBOARD SHORTCUTS
  =========================================================================== */

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      const modifier =
        event.metaKey ||
        event.ctrlKey;

      if (
        modifier &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        setSearchOpen(true);
        setProfileOpen(false);
        setContextOpen(false);
        setNotificationsOpen(false);

        window.setTimeout(
          () =>
            searchInputRef.current?.focus(),
          20,
        );
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
        setContextOpen(false);
        setNotificationsOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, []);

  /* ===========================================================================
     ACTIONS
  =========================================================================== */

  const openSearch =
    useCallback(() => {
      setProfileOpen(false);
      setContextOpen(false);
      setNotificationsOpen(false);
      setSearchOpen(true);

      window.setTimeout(
        () =>
          searchInputRef.current?.focus(),
        20,
      );
    }, []);

  const selectSearchResult =
    useCallback(
      (result: SearchResult) => {
        onTabSelect(result.tab);
        setSearchOpen(false);
        setSearchQuery("");
      },
      [onTabSelect],
    );

  const signOut =
    useCallback(async () => {
      if (signingOut) return;

      setSigningOut(true);

      try {
        const response = await fetch(
          "/api/admin/signout",
          {
            method: "POST",
            credentials: "include",
            cache: "no-store",
          },
        );

        const payload = await response
          .json()
          .catch(() => null);

        if (
          !response.ok ||
          !payload?.ok
        ) {
          throw new Error(
            payload?.error ||
              "Could not sign out.",
          );
        }

        window.location.replace(
          "/login",
        );
      } catch (error) {
        console.error(
          "Could not sign out:",
          error,
        );

        setSigningOut(false);
      }
    }, [signingOut]);

  /* ===========================================================================
     RENDER
  =========================================================================== */

  return (
    <>
      <header
        data-workspace={activeSection.id}
        data-command={
          commandWorkspace
            ? "true"
            : "false"
        }
        className="
          relative
          border-b border-[var(--line)]
          bg-[var(--shell-translucent)]
          backdrop-blur-2xl
        "
      >
        {/* ================================================================
            MAIN HEADER ROW
        ================================================================ */}

        <div
          className={`
            flex items-center gap-3
            px-5 xl:px-7
            ${
              commandWorkspace
                ? "min-h-[56px]"
                : "min-h-[70px]"
            }
          `}
        >
          {/* ACTIVE SECTION */}

          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`
                flex shrink-0 items-center
                justify-center rounded-xl
                bg-[var(--surface-muted)]
                text-[var(--text)]
                ${
                  commandWorkspace
                    ? "h-8 w-8"
                    : "h-9 w-9"
                }
              `}
            >
              <ActiveSectionIcon
                size={
                  commandWorkspace
                    ? 15
                    : 16
                }
                strokeWidth={1.9}
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-[-0.015em] text-[var(--text)]">
                {activeSection.label}
              </p>

              <p className="mt-0.5 max-w-[250px] truncate text-[10px] text-[var(--text-subtle)]">
                {activeSection.description}
              </p>
            </div>
          </div>

          <div className="flex-1" />

          {/* ============================================================
              WORKSPACE SELECTOR
          ============================================================ */}

          <div
            ref={contextRef}
            className="relative"
          >
            <button
              type="button"
              onClick={() => {
                if (!isFullAccess) return;

                setContextOpen(
                  (value) => !value,
                );

                setProfileOpen(false);
                setNotificationsOpen(false);
              }}
              aria-expanded={contextOpen}
              aria-label={`Workspace context: ${currentContext.label}`}
              className="
                hidden h-10 items-center gap-2.5
                rounded-full border border-[var(--line)]
                bg-[var(--surface)]
                pl-1.5 pr-3 text-left shadow-sm
                transition-colors
                hover:bg-[var(--surface-muted)]
                xl:flex
              "
            >
              <WorkspaceAvatar
                context={currentContext}
                size="small"
              />

              <span className="min-w-0">
                <span className="block max-w-[145px] truncate text-[10px] font-semibold text-[var(--text)]">
                  {currentContext.label}
                </span>

                <span className="block max-w-[145px] truncate text-[8px] text-[var(--text-subtle)]">
                  {currentContext.description}
                </span>
              </span>

              {clientsLoading &&
              canOpenClients ? (
                <LoaderCircle
                  size={13}
                  className="animate-spin text-[var(--text-subtle)]"
                />
              ) : (
                <ChevronDown
                  size={13}
                  className={`
                    text-[var(--text-subtle)]
                    transition-transform
                    ${
                      contextOpen
                        ? "rotate-180"
                        : ""
                    }
                  `}
                />
              )}
            </button>

            {contextOpen &&
              isFullAccess && (
                <ContextMenu
                  currentContextId={
                    currentContext.id
                  }
                  contexts={
                    workspaceContexts
                  }
                  loading={
                    canOpenClients &&
                    clientsLoading
                  }
                  error={
                    canOpenClients
                      ? clientsError
                      : null
                  }
                  onRetry={() => {
                    void loadClients();
                  }}
                  onSelect={
                    selectWorkspaceContext
                  }
                />
              )}
          </div>

          {/* ============================================================
              SEARCH
          ============================================================ */}

          <button
            type="button"
            onClick={openSearch}
            aria-label="Search Syntra Grid"
            className="
              flex h-9 items-center gap-2
              rounded-full border border-[var(--line)]
              bg-[var(--surface)]
              px-3 text-[var(--text-muted)]
              shadow-sm transition-colors
              hover:bg-[var(--surface-muted)]
              hover:text-[var(--text)]
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[var(--primary)]
            "
          >
            <Search
              size={15}
              strokeWidth={1.9}
            />

            <span className="hidden text-[10px] font-medium xl:inline">
              Search
            </span>

            <span className="hidden items-center gap-0.5 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[8px] font-semibold text-[var(--text-subtle)] xl:flex">
              <Command size={8} />
              K
            </span>
          </button>

          {/* ============================================================
              NOTIFICATIONS
          ============================================================ */}

          {canOpenNotifications && (
            <div
              ref={notificationsRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(
                    (value) => !value,
                  );

                  setContextOpen(false);
                  setProfileOpen(false);
                }}
                aria-label="Notifications"
                aria-expanded={
                  notificationsOpen
                }
                className="
                  relative flex h-9 w-9
                  items-center justify-center
                  rounded-full
                  border border-[var(--line)]
                  bg-[var(--surface)]
                  text-[var(--text-muted)]
                  shadow-sm transition-colors
                  hover:bg-[var(--surface-muted)]
                  hover:text-[var(--text)]
                "
              >
                <Bell
                  size={16}
                  strokeWidth={1.9}
                />

                {isFullAccess && (
                  <span className="absolute right-[7px] top-[7px] h-1.5 w-1.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]" />
                )}
              </button>

              {notificationsOpen && (
                <NotificationsMenu
                  isFullAccess={
                    isFullAccess
                  }
                  onOpenNotifications={() => {
                    onTabSelect(
                      "notifications",
                    );

                    setNotificationsOpen(
                      false,
                    );
                  }}
                />
              )}
            </div>
          )}

          {/* ============================================================
              PROFILE
          ============================================================ */}

          <div
            ref={profileRef}
            className="relative"
          >
            <button
              type="button"
              onClick={() => {
                setProfileOpen(
                  (value) => !value,
                );

                setContextOpen(false);
                setNotificationsOpen(false);

                void refreshProfile();
              }}
              aria-label="Account menu"
              aria-expanded={
                profileOpen
              }
              className="
                flex h-9 items-center gap-2
                rounded-full
                border border-[var(--line)]
                bg-[var(--surface)]
                p-0.5 pr-2
                shadow-sm transition-colors
                hover:bg-[var(--surface-muted)]
              "
            >
              <ProfileAvatar
                name={profileName}
                url={profileAvatarUrl}
              />

              <ChevronDown
                size={12}
                className={`
                  hidden
                  text-[var(--text-subtle)]
                  transition-transform
                  xl:block
                  ${
                    profileOpen
                      ? "rotate-180"
                      : ""
                  }
                `}
              />
            </button>

            {profileOpen && (
              <ProfileMenu
                admin={admin}
                profileName={
                  profileName
                }
                avatarUrl={
                  profileAvatarUrl
                }
                jobTitle={
                  profileJobTitle
                }
                department={
                  profileDepartment
                }
                isFullAccess={
                  isFullAccess
                }
                canOpenTeam={
                  canOpenTeam
                }
                canOpenSettings={
                  canOpenSettings
                }
                theme={
                  theme as ThemeMode
                }
                signingOut={
                  signingOut
                }
                onThemeChange={
                  setTheme
                }
                onTeam={() => {
                  if (!canOpenTeam) return;

                  onTabSelect("team");
                  setProfileOpen(false);
                }}
                onSettings={() => {
                  if (
                    !canOpenSettings
                  ) {
                    return;
                  }

                  onTabSelect(
                    "settings",
                  );

                  setProfileOpen(false);
                }}
                onSignOut={() => {
                  void signOut();
                }}
              />
            )}
          </div>
        </div>

        {/* ================================================================
            SECTION TABS
        ================================================================ */}

        {showTabBar && (
          <div
            ref={tabRowRef}
            className="
              no-scrollbar relative
              flex min-h-[45px] items-end
              gap-1 overflow-x-auto
              overflow-y-hidden
              px-5 xl:px-7
            "
            aria-label={`${activeSection.label} tabs`}
          >
            <span
              aria-hidden="true"
              style={tabIndicatorStyle}
              className="
                pointer-events-none
                absolute bottom-0 left-0 z-20
                h-[2px] rounded-full
                bg-[var(--primary)]
                transition-[transform,width,opacity]
                duration-[300ms]
                ease-[cubic-bezier(0.22,1,0.36,1)]
                motion-reduce:transition-none
              "
            />

            {activeSection.items.map(
              (item) => {
                const selected =
                  item.tab === activeTab;

                const Icon =
                  item.icon;

                return (
                  <button
                    key={item.tab}
                    ref={(node) => {
                      registerTabButton(
                        item.tab,
                        node,
                      );
                    }}
                    type="button"
                    onClick={() =>
                      onTabSelect(
                        item.tab,
                      )
                    }
                    onMouseEnter={() => {
                      if (
                        canOpenClients &&
                        item.tab ===
                          "clients"
                      ) {
                        void preload(
                          CLIENTS_ENDPOINT,
                          fetchClientsPayload,
                        );
                      }
                    }}
                    onFocus={() => {
                      if (
                        canOpenClients &&
                        item.tab ===
                          "clients"
                      ) {
                        void preload(
                          CLIENTS_ENDPOINT,
                          fetchClientsPayload,
                        );
                      }
                    }}
                    aria-current={
                      selected
                        ? "page"
                        : undefined
                    }
                    className={`
                      group relative z-10
                      flex h-[45px] shrink-0
                      items-center gap-2 px-3
                      text-[11px] font-semibold
                      transition-[color,transform]
                      duration-200
                      ${
                        selected
                          ? "text-[var(--text)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }
                    `}
                  >
                    <Icon
                      size={13}
                      strokeWidth={
                        selected
                          ? 2.1
                          : 1.8
                      }
                    />

                    <span>
                      {item.title}
                    </span>

                    {item.status ===
                      "planned" && (
                      <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                        Soon
                      </span>
                    )}
                  </button>
                );
              },
            )}
          </div>
        )}
      </header>

      {/* ================================================================
          SEARCH PALETTE
      ================================================================ */}

      {searchOpen && (
        <SearchPalette
          query={searchQuery}
          results={searchResults}
          inputRef={
            searchInputRef
          }
          onQueryChange={
            setSearchQuery
          }
          onSelect={
            selectSearchResult
          }
          onClose={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }}
        />
      )}
    </>
  );
}

/* =============================================================================
   WORKSPACE AVATAR
============================================================================= */

function WorkspaceAvatar({
  context,
  size = "medium",
}: {
  context: WorkspaceContext;
  size?: "small" | "medium";
}) {
  const sizeClass =
    size === "small"
      ? "h-7 w-7 rounded-full text-[8px]"
      : "h-9 w-9 rounded-xl text-[9px]";

  const [failedUrl, setFailedUrl] =
    useState<string | null>(null);

  if (
    context.logoUrl &&
    failedUrl !== context.logoUrl
  ) {
    return (
      <span
        className={`
          relative flex shrink-0
          items-center justify-center
          overflow-hidden
          border border-[var(--line)]
          bg-white
          ${sizeClass}
        `}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={context.logoUrl}
          alt={
            context.type === "company"
              ? "Syntra Grid logo"
              : `${context.label} logo`
          }
          className="h-full w-full object-contain p-0.5"
          onError={() =>
            setFailedUrl(
              context.logoUrl ?? null,
            )
          }
        />
      </span>
    );
  }

  return (
    <span
      className={`
        flex shrink-0 items-center
        justify-center
        bg-[var(--primary)]
        font-bold tracking-[0.02em]
        text-[var(--primary-foreground)]
        ${sizeClass}
      `}
    >
      {context.shortLabel}
    </span>
  );
}

/* =============================================================================
   WORKSPACE CONTEXT MENU
============================================================================= */

function ContextMenu({
  currentContextId,
  contexts,
  loading,
  error,
  onRetry,
  onSelect,
}: {
  currentContextId: string;
  contexts: WorkspaceContext[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (id: string) => void;
}) {
  const companyContext =
    contexts.find(
      (context) =>
        context.type === "company",
    ) ?? COMPANY_CONTEXT;

  const clientContexts =
    contexts.filter(
      (context) =>
        context.type === "client",
    );

  return (
    <div className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[300px] overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface-elevated)] shadow-[var(--shadow-popover)]">
      <div className="border-b border-[var(--line)] px-4 pb-3 pt-3.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
          Workspace context
        </p>

        <p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">
          Choose whose operation you are working with.
        </p>
      </div>

      <div className="no-scrollbar max-h-[390px] overflow-y-auto p-2">
        <ContextMenuItem
          context={
            companyContext
          }
          selected={
            companyContext.id ===
            currentContextId
          }
          onSelect={onSelect}
        />

        <div className="mb-1 mt-2 flex items-center gap-2 px-2.5">
          <Building2
            size={10}
            className="text-[var(--text-subtle)]"
          />

          <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
            Clients
          </span>

          {!loading &&
            !error && (
              <span className="ml-auto rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[7px] font-bold text-[var(--text-subtle)]">
                {clientContexts.length}
              </span>
            )}
        </div>

        {loading && (
          <div className="flex items-center gap-3 rounded-xl px-3 py-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)]">
              <LoaderCircle
                size={14}
                className="animate-spin text-[var(--text-subtle)]"
              />
            </span>

            <div>
              <p className="text-[10px] font-semibold text-[var(--text)]">
                Loading clients
              </p>

              <p className="mt-0.5 text-[8px] text-[var(--text-muted)]">
                Syncing workspace contexts…
              </p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-500/15 bg-red-500/[0.05] p-3">
            <p className="text-[10px] font-semibold text-red-500">
              Clients unavailable
            </p>

            <p className="mt-1 line-clamp-2 text-[8px] leading-4 text-[var(--text-muted)]">
              {error}
            </p>

            <button
              type="button"
              onClick={onRetry}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[8px] font-semibold text-[var(--text)] hover:bg-[var(--surface-muted)]"
            >
              <RefreshCw size={10} />
              Try again
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          clientContexts.map(
            (context) => (
              <ContextMenuItem
                key={context.id}
                context={context}
                selected={
                  context.id ===
                  currentContextId
                }
                onSelect={
                  onSelect
                }
              />
            ),
          )}

        {!loading &&
          !error &&
          !clientContexts.length && (
            <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-5 text-center">
              <Building2
                size={17}
                className="mx-auto text-[var(--text-subtle)]"
              />

              <p className="mt-2 text-[10px] font-semibold text-[var(--text)]">
                No operational clients
              </p>

              <p className="mt-1 text-[8px] leading-4 text-[var(--text-muted)]">
                Active, onboarding and paused clients will appear here automatically.
              </p>
            </div>
          )}
      </div>

      <div className="border-t border-[var(--line)] px-4 py-2.5">
        <p className="text-[8px] leading-4 text-[var(--text-subtle)]">
          Client workspaces are connected to the Syntra Grid client directory.
        </p>
      </div>
    </div>
  );
}

/* =============================================================================
   WORKSPACE CONTEXT ITEM
============================================================================= */

function ContextMenuItem({
  context,
  selected,
  onSelect,
}: {
  context: WorkspaceContext;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onSelect(context.id)
      }
      className={`
        flex w-full items-center
        gap-3 rounded-xl
        px-2.5 py-2.5
        text-left transition-colors
        hover:bg-[var(--surface-muted)]
        ${
          selected
            ? "bg-[var(--surface-muted)]"
            : ""
        }
      `}
    >
      <WorkspaceAvatar
        context={context}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="block min-w-0 truncate text-[11px] font-semibold text-[var(--text)]">
            {context.label}
          </span>

          {context.type ===
            "client" &&
            context.status && (
              <ClientStatusDot
                status={
                  context.status
                }
              />
            )}
        </span>

        <span className="mt-0.5 block truncate text-[9px] text-[var(--text-muted)]">
          {context.description}
        </span>
      </span>

      {selected && (
        <Check
          size={14}
          className="shrink-0 text-[var(--accent)]"
        />
      )}
    </button>
  );
}

/* =============================================================================
   CLIENT STATUS DOT
============================================================================= */

function ClientStatusDot({
  status,
}: {
  status: string;
}) {
  const normalized =
    status.trim().toUpperCase();

  const className =
    normalized === "ACTIVE"
      ? "bg-[var(--success)]"
      : normalized === "ONBOARDING"
        ? "bg-[var(--info)]"
        : normalized === "PAUSED"
          ? "bg-[var(--warning)]"
          : "bg-[var(--text-subtle)]";

  return (
    <span
      title={formatRole(normalized)}
      className={`
        h-1.5 w-1.5 shrink-0
        rounded-full
        ${className}
      `}
    />
  );
}

/* =============================================================================
   NOTIFICATIONS MENU
============================================================================= */

function NotificationsMenu({
  onOpenNotifications,
  isFullAccess,
}: {
  onOpenNotifications: () => void;
  isFullAccess: boolean;
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[320px] overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface-elevated)] shadow-[var(--shadow-popover)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5">
        <div>
          <p className="text-[12px] font-semibold text-[var(--text)]">
            Notifications
          </p>

          <p className="mt-0.5 text-[9px] text-[var(--text-muted)]">
            {isFullAccess
              ? "Company activity requiring attention"
              : "Your workspace updates"}
          </p>
        </div>

        {isFullAccess && (
          <span className="rounded-full bg-[var(--accent-tint)] px-2 py-1 text-[8px] font-bold text-[var(--accent)]">
            3 new
          </span>
        )}
      </div>

      <div className="p-2">
        {isFullAccess ? (
          <>
            <NotificationItem
              title="Deployment completed"
              description="A production deployment completed successfully."
              time="18m"
              tone="success"
            />

            <NotificationItem
              title="Support request"
              description="A client support ticket is waiting for review."
              time="42m"
              tone="warning"
            />

            <NotificationItem
              title="Platform check"
              description="All connected production systems are responding."
              time="1h"
              tone="info"
            />
          </>
        ) : (
          <div className="px-4 py-8 text-center">
            <Bell
              size={19}
              className="mx-auto text-[var(--text-subtle)]"
            />

            <p className="mt-3 text-[11px] font-semibold text-[var(--text)]">
              Your notifications
            </p>

            <p className="mt-1 text-[9px] leading-5 text-[var(--text-muted)]">
              Open your notifications workspace to see your updates.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line)] p-2">
        <button
          type="button"
          onClick={
            onOpenNotifications
          }
          className="w-full rounded-xl px-3 py-2.5 text-center text-[10px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}

/* =============================================================================
   NOTIFICATION ITEM
============================================================================= */

function NotificationItem({
  title,
  description,
  time,
  tone,
}: {
  title: string;
  description: string;
  time: string;
  tone:
    | "success"
    | "warning"
    | "info";
}) {
  const toneClass = {
    success: "bg-[var(--success)]",
    warning: "bg-[var(--warning)]",
    info: "bg-[var(--info)]",
  }[tone];

  return (
    <div className="flex gap-3 rounded-xl px-2.5 py-3 transition-colors hover:bg-[var(--surface-muted)]">
      <span
        className={`
          mt-1.5 h-2 w-2
          shrink-0 rounded-full
          ${toneClass}
        `}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-semibold text-[var(--text)]">
            {title}
          </p>

          <span className="shrink-0 text-[8px] text-[var(--text-subtle)]">
            {time}
          </span>
        </div>

        <p className="mt-1 text-[9px] leading-4 text-[var(--text-muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}

/* =============================================================================
   PROFILE MENU
============================================================================= */

function ProfileMenu({
  admin,
  profileName,
  avatarUrl,
  jobTitle,
  department,
  isFullAccess,
  canOpenTeam,
  canOpenSettings,
  theme,
  signingOut,
  onThemeChange,
  onTeam,
  onSettings,
  onSignOut,
}: {
  admin: AdminUser;
  profileName: string;
  avatarUrl?: string | null;
  jobTitle: string;
  department: string | null;
  isFullAccess: boolean;
  canOpenTeam: boolean;
  canOpenSettings: boolean;
  theme: ThemeMode;
  signingOut: boolean;
  onThemeChange: (
    theme: ThemeMode,
  ) => void;
  onTeam: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[290px] overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface-elevated)] shadow-[var(--shadow-popover)]">
      {/* ================================================================
          PROFILE DETAILS
      ================================================================ */}

      <div className="border-b border-[var(--line)] p-4">
        <div className="flex items-start gap-3">
          <ProfileAvatar
            name={profileName}
            url={avatarUrl}
            size="large"
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-[var(--text)]">
              {profileName}
            </p>

            {!isFullAccess && (
              <p className="mt-1 text-[10px] font-medium leading-4 text-[var(--text-muted)]">
                {jobTitle}
              </p>
            )}

            {!isFullAccess &&
              department && (
                <p className="mt-1 text-[9px] leading-4 text-[var(--text-subtle)]">
                  {department}
                </p>
              )}

            <p className="mt-2 truncate text-[9px] text-[var(--text-muted)]">
              {admin.email}
            </p>
          </div>
        </div>

        {/* Keep existing role badge for unrestricted users. */}

        {isFullAccess && (
          <span className="mt-3 inline-flex rounded-full bg-[var(--accent-tint)] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
            {formatRole(admin.role)}
          </span>
        )}
      </div>

      {/* ================================================================
          ACCOUNT ACTIONS
      ================================================================ */}

      <div className="p-2">
        {canOpenTeam && (
          <ProfileAction
            icon={UserRound}
            label="My account"
            description="Profile and account details"
            onClick={onTeam}
          />
        )}

        {canOpenTeam && (
          <ProfileAction
            icon={Users}
            label="Team"
            description={
              isFullAccess
                ? "People and access"
                : "My department"
            }
            onClick={onTeam}
          />
        )}

        {canOpenSettings && (
          <ProfileAction
            icon={Settings}
            label="Settings"
            description="Syntra Grid configuration"
            onClick={
              onSettings
            }
          />
        )}
      </div>

      {/* ================================================================
          APPEARANCE
      ================================================================ */}

      <div className="border-y border-[var(--line)] p-3">
        <p className="px-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
          Appearance
        </p>

        <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-muted)] p-1">
          <button
            type="button"
            onClick={() =>
              onThemeChange("light")
            }
            className={`
              flex items-center
              justify-center gap-1.5
              rounded-lg px-2 py-2
              text-[9px] font-semibold
              transition-colors
              ${
                theme === "light"
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-muted)]"
              }
            `}
          >
            <Sun size={12} />
            Light
          </button>

          <button
            type="button"
            onClick={() =>
              onThemeChange("dark")
            }
            className={`
              flex items-center
              justify-center gap-1.5
              rounded-lg px-2 py-2
              text-[9px] font-semibold
              transition-colors
              ${
                theme === "dark"
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-muted)]"
              }
            `}
          >
            <Moon size={12} />
            Dark
          </button>
        </div>
      </div>

      {/* ================================================================
          SIGN OUT
      ================================================================ */}

      <div className="p-2">
        <button
          type="button"
          disabled={signingOut}
          onClick={onSignOut}
          className="
            flex w-full items-center
            gap-3 rounded-xl
            px-3 py-2.5
            text-left text-red-500
            transition-colors
            hover:bg-red-500/10
            disabled:pointer-events-none
            disabled:opacity-50
          "
        >
          <LogOut
            size={14}
            strokeWidth={1.9}
          />

          <span className="text-[10px] font-semibold">
            {signingOut
              ? "Signing out…"
              : "Sign out"}
          </span>
        </button>
      </div>
    </div>
  );
}

/* =============================================================================
   PROFILE ACTION
============================================================================= */

function ProfileAction({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-muted)]">
        <Icon
          size={14}
          strokeWidth={1.8}
        />
      </span>

      <span className="min-w-0">
        <span className="block text-[10px] font-semibold text-[var(--text)]">
          {label}
        </span>

        <span className="mt-1 block text-[8px] text-[var(--text-muted)]">
          {description}
        </span>
      </span>
    </button>
  );
}

/* =============================================================================
   SEARCH PALETTE
============================================================================= */

function SearchPalette({
  query,
  results,
  inputRef,
  onQueryChange,
  onSelect,
  onClose,
}: {
  query: string;
  results: SearchResult[];
  inputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (
    value: string,
  ) => void;
  onSelect: (
    result: SearchResult,
  ) => void;
  onClose: () => void;
}) {
  const [
    selectedIndex,
    setSelectedIndex,
  ] = useState(0);

  const changeQuery =
    useCallback(
      (value: string) => {
        setSelectedIndex(0);
        onQueryChange(value);
      },
      [onQueryChange],
    );

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (
      event.key === "ArrowDown"
    ) {
      event.preventDefault();

      setSelectedIndex(
        (current) =>
          Math.min(
            current + 1,
            Math.max(
              results.length - 1,
              0,
            ),
          ),
      );

      return;
    }

    if (
      event.key === "ArrowUp"
    ) {
      event.preventDefault();

      setSelectedIndex(
        (current) =>
          Math.max(
            current - 1,
            0,
          ),
      );

      return;
    }

    if (
      event.key === "Enter" &&
      results[selectedIndex]
    ) {
      event.preventDefault();

      onSelect(
        results[selectedIndex],
      );
    }
  };

  return (
    <div
      className="
        fixed inset-0 z-[150]
        flex items-start justify-center
        bg-black/30 px-4 pt-[10vh]
        backdrop-blur-[3px]
      "
      role="dialog"
      aria-modal="true"
      aria-label="Search Syntra Grid"
    >
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative z-10 w-full max-w-[620px] overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--surface-elevated)] shadow-[var(--shadow-popover)]">
        {/* SEARCH FIELD */}

        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
          <Search
            size={17}
            className="shrink-0 text-[var(--text-subtle)]"
          />

          <input
            ref={inputRef}
            value={query}
            onChange={(event) =>
              changeQuery(
                event.target.value,
              )
            }
            onKeyDown={
              handleKeyDown
            }
            placeholder="Search Syntra Grid…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
          />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
          >
            <X size={15} />
          </button>
        </div>

        {/* RESULTS */}

        <div className="no-scrollbar max-h-[420px] overflow-y-auto p-2">
          {results.length ===
          0 ? (
            <div className="px-5 py-12 text-center">
              <Search
                size={20}
                className="mx-auto text-[var(--text-subtle)]"
              />

              <p className="mt-3 text-[11px] font-semibold text-[var(--text)]">
                Nothing found
              </p>

              <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                Try another page, client or module.
              </p>
            </div>
          ) : (
            results.map(
              (result, index) => (
                <button
                  key={result.id}
                  type="button"
                  onMouseEnter={() =>
                    setSelectedIndex(
                      index,
                    )
                  }
                  onClick={() =>
                    onSelect(
                      result,
                    )
                  }
                  className={`
                    flex w-full
                    items-center gap-3
                    rounded-xl
                    px-3 py-3
                    text-left
                    transition-colors
                    duration-100
                    ${
                      index ===
                      selectedIndex
                        ? "bg-[var(--surface-muted)]"
                        : ""
                    }
                  `}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]">
                    <Search
                      size={13}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[11px] font-semibold text-[var(--text)]">
                        {result.label}
                      </span>

                      <span className="shrink-0 rounded-full bg-[var(--accent-tint)] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.06em] text-[var(--accent)]">
                        {result.section}
                      </span>
                    </span>

                    <span className="mt-1 block truncate text-[9px] text-[var(--text-muted)]">
                      {result.description}
                    </span>
                  </span>
                </button>
              ),
            )
          )}
        </div>

        {/* FOOTER */}

        <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5 text-[8px] text-[var(--text-subtle)]">
          <span>
            ↑ ↓ Navigate · Enter Open
          </span>

          <span>
            ESC Close
          </span>
        </div>
      </div>
    </div>
  );
}