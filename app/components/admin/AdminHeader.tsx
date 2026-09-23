'use client';

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
} from 'react';

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
} from 'lucide-react';

import type {
  AdminSection,
  AdminTab,
  AdminUser,
} from './adminNav';

import {
  useAdminTheme,
} from './AdminThemeProvider';

/* ============================================================================
   TYPES
============================================================================ */

type AdminHeaderProps = {
  admin: AdminUser;
  sections: AdminSection[];
  activeSection: AdminSection;
  activeTab: AdminTab;

  onTabSelect: (
    tab: AdminTab,
  ) => void;
};

type SearchResult = {
  id: string;
  label: string;
  description: string;
  tab: AdminTab;
  section: string;
};

type ThemeMode =
  | 'light'
  | 'dark';

type TabIndicatorPosition = {
  left: number;
  width: number;
  ready: boolean;
};

/* ============================================================================
   WORKSPACE CONTEXT TYPES
============================================================================ */

type WorkspaceContextType =
  | 'company'
  | 'client';

type WorkspaceContext = {
  id: string;
  type: WorkspaceContextType;

  /**
   * Database Client.id when type === "client".
   *
   * Company-wide Syntra Grid context has no entityId.
   */
  entityId: string | null;

  label: string;
  shortLabel: string;
  description: string;

  logoUrl?: string | null;

  status?:
    | string
    | null;
};

/* ============================================================================
   CLIENT API TYPES

   Keep this deliberately small.

   AdminHeader only needs enough information to render the workspace selector.
   It does not need the entire Client model.
============================================================================ */

type ClientApiRecord = {
  id: string;

  name: string;

  displayName?:
    | string
    | null;

  slug?:
    | string
    | null;

  industry?:
    | string
    | null;

  description?:
    | string
    | null;

  logo?:
    | string
    | null;

  logoUrl?:
    | string
    | null;

  status:
    | string;

  productName?:
    | string
    | null;
};

type ClientsApiResponse = {
  clients?: ClientApiRecord[];

  data?: ClientApiRecord[];

  items?: ClientApiRecord[];

  error?: string;

  message?: string;
};

/* ============================================================================
   CONSTANTS
============================================================================ */

const WORKSPACE_STORAGE_KEY =
  'syntragrid.workspace-context';

const OPERATIONAL_CLIENT_STATUSES =
  new Set([
    'ACTIVE',
    'ONBOARDING',
    'PAUSED',
  ]);

const COMPANY_CONTEXT: WorkspaceContext =
  {
    id: 'company',
    type: 'company',
    entityId: null,

    label: 'Syntra Grid',
    shortLabel: 'SG',

    description:
      'Company-wide view',

    logoUrl: null,

    status: 'ACTIVE',
  };

/* ============================================================================
   COMPONENT
============================================================================ */

export default function AdminHeader({
  admin,
  sections,
  activeSection,
  activeTab,
  onTabSelect,
}: AdminHeaderProps) {
  const {
    theme,
    setTheme,
  } = useAdminTheme();

  const searchInputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const profileRef =
    useRef<HTMLDivElement>(
      null,
    );

  const contextRef =
    useRef<HTMLDivElement>(
      null,
    );

  const notificationsRef =
    useRef<HTMLDivElement>(
      null,
    );

  /* --------------------------------------------------------------------------
     TAB INDICATOR REFS
  -------------------------------------------------------------------------- */

  const tabRowRef =
    useRef<HTMLDivElement>(
      null,
    );

  const tabButtonRefs =
    useRef<
      Map<
        AdminTab,
        HTMLButtonElement
      >
    >(new Map());

  const [
    tabIndicator,
    setTabIndicator,
  ] =
    useState<TabIndicatorPosition>({
      left: 0,
      width: 0,
      ready: false,
    });

  /* --------------------------------------------------------------------------
     UI STATE
  -------------------------------------------------------------------------- */

  const [
    searchOpen,
    setSearchOpen,
  ] = useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('');

  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);

  const [
    contextOpen,
    setContextOpen,
  ] = useState(false);

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] = useState(false);

  const [
    signingOut,
    setSigningOut,
  ] = useState(false);

  /* --------------------------------------------------------------------------
     WORKSPACE CONTEXT STATE
  -------------------------------------------------------------------------- */

  const [
    clients,
    setClients,
  ] =
    useState<ClientApiRecord[]>(
      [],
    );

  const [
    clientsLoading,
    setClientsLoading,
  ] = useState(true);

  const [
    clientsError,
    setClientsError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    selectedContextId,
    setSelectedContextId,
  ] =
    useState<string>(
      COMPANY_CONTEXT.id,
    );

  const [
    contextHydrated,
    setContextHydrated,
  ] = useState(false);

  const ActiveSectionIcon =
    activeSection.icon;

  /* --------------------------------------------------------------------------
     LOAD SAVED WORKSPACE CONTEXT
  -------------------------------------------------------------------------- */

  useEffect(() => {
    try {
      const stored =
        window.localStorage.getItem(
          WORKSPACE_STORAGE_KEY,
        );

      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedContextId(
          stored,
        );
      }
    } catch (error) {
      console.warn(
        'Could not restore workspace context:',
        error,
      );
    } finally {
      setContextHydrated(
        true,
      );
    }
  }, []);

  /* --------------------------------------------------------------------------
     LOAD CLIENTS

     Reuses:
       GET /api/admin/clients

     No Prisma is imported into this client component.
  -------------------------------------------------------------------------- */

  const loadClients =
    useCallback(async () => {
      setClientsLoading(
        true,
      );

      setClientsError(
        null,
      );

      try {
        const response =
          await fetch(
            '/api/admin/clients',
            {
              method:
                'GET',

              credentials:
                'include',

              cache:
                'no-store',

              headers: {
                Accept:
                  'application/json',
              },
            },
          );

        const payload =
          (await response
            .json()
            .catch(
              () => null,
            )) as
            | ClientsApiResponse
            | ClientApiRecord[]
            | null;

        if (
          !response.ok
        ) {
          const message =
            !Array.isArray(
              payload,
            )
              ? payload?.error ??
                payload?.message
              : null;

          throw new Error(
            message ||
              `Could not load clients (${response.status}).`,
          );
        }

        /*
         * Support the common response shapes so this header remains resilient:
         *
         * { clients: [...] }
         * { data: [...] }
         * { items: [...] }
         * [...]
         */

        let records:
          ClientApiRecord[] =
          [];

        if (
          Array.isArray(
            payload,
          )
        ) {
          records =
            payload;
        } else if (
          Array.isArray(
            payload?.clients,
          )
        ) {
          records =
            payload.clients;
        } else if (
          Array.isArray(
            payload?.data,
          )
        ) {
          records =
            payload.data;
        } else if (
          Array.isArray(
            payload?.items,
          )
        ) {
          records =
            payload.items;
        }

        setClients(
          records,
        );
      } catch (error) {
        console.error(
          'Could not load workspace clients:',
          error,
        );

        setClients(
          [],
        );

        setClientsError(
          error instanceof
            Error
            ? error.message
            : 'Could not load clients.',
        );
      } finally {
        setClientsLoading(
          false,
        );
      }
    }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClients();
  }, [
    loadClients,
  ]);

  /* --------------------------------------------------------------------------
     CLIENT WORKSPACE CONTEXTS
  -------------------------------------------------------------------------- */

  const clientContexts =
    useMemo<
      WorkspaceContext[]
    >(() => {
      return clients
        .filter(
          (client) =>
            OPERATIONAL_CLIENT_STATUSES.has(
              client.status
                .trim()
                .toUpperCase(),
            ),
        )
        .map(
          (client) => {
            const label =
              cleanText(
                client.displayName,
              ) ||
              cleanText(
                client.name,
              ) ||
              'Unnamed client';

            return {
              id: `client:${client.id}`,

              type:
                'client' as const,

              entityId:
                client.id,

              label,

              shortLabel:
                createShortLabel(
                  label,
                ),

              description:
                getClientContextDescription(
                  client,
                ),

              logoUrl:
                cleanText(
                  client.logoUrl,
                ) ||
                cleanText(
                  client.logo,
                ) ||
                null,

              status:
                client.status,
            };
          },
        )
        .sort((a, b) =>
          a.label.localeCompare(
            b.label,
            undefined,
            {
              sensitivity:
                'base',
            },
          ),
        );
    }, [
      clients,
    ]);

  /* --------------------------------------------------------------------------
     ALL WORKSPACE CONTEXTS
  -------------------------------------------------------------------------- */

  const workspaceContexts =
    useMemo<
      WorkspaceContext[]
    >(() => {
      return [
        COMPANY_CONTEXT,
        ...clientContexts,
      ];
    }, [
      clientContexts,
    ]);

  /* --------------------------------------------------------------------------
     CURRENT WORKSPACE CONTEXT
  -------------------------------------------------------------------------- */

  const currentContext =
    useMemo<
      WorkspaceContext
    >(() => {
      return (
        workspaceContexts.find(
          (context) =>
            context.id ===
            selectedContextId,
        ) ??
        COMPANY_CONTEXT
      );
    }, [
      selectedContextId,
      workspaceContexts,
    ]);

  /* --------------------------------------------------------------------------
     VALIDATE SAVED CONTEXT

     If the selected client was archived/deleted/no longer returned by the API,
     automatically return to the company-wide Syntra Grid context.
  -------------------------------------------------------------------------- */

  useEffect(() => {
    if (
      !contextHydrated ||
      clientsLoading
    ) {
      return;
    }

    const exists =
      workspaceContexts.some(
        (context) =>
          context.id ===
          selectedContextId,
      );

    if (exists) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedContextId(
      COMPANY_CONTEXT.id,
    );

    try {
      window.localStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        COMPANY_CONTEXT.id,
      );
    } catch {
      // Storage may be unavailable.
    }
  }, [
    clientsLoading,
    contextHydrated,
    selectedContextId,
    workspaceContexts,
  ]);

  /* --------------------------------------------------------------------------
     SELECT WORKSPACE CONTEXT
  -------------------------------------------------------------------------- */

  const selectWorkspaceContext =
    useCallback(
      (
        contextId: string,
      ) => {
        setSelectedContextId(
          contextId,
        );

        setContextOpen(
          false,
        );

        try {
          window.localStorage.setItem(
            WORKSPACE_STORAGE_KEY,
            contextId,
          );
        } catch (error) {
          console.warn(
            'Could not persist workspace context:',
            error,
          );
        }

        /*
         * For now the selection is persisted locally.
         *
         * The next architectural step is moving this state into a
         * WorkspaceContextProvider so every admin tab can consume the same
         * selected context.
         */
      },
      [],
    );

  /* --------------------------------------------------------------------------
     SEARCH INDEX
  -------------------------------------------------------------------------- */

  const searchIndex =
    useMemo<SearchResult[]>(
      () => {
        return sections.flatMap(
          (section) =>
            section.items.map(
              (item) => ({
                id: `${section.id}-${item.tab}`,

                label:
                  item.title,

                description:
                  item.description,

                tab:
                  item.tab,

                section:
                  section.label,
              }),
            ),
        );
      },
      [
        sections,
      ],
    );

  const searchResults =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      if (!query) {
        return searchIndex.slice(
          0,
          8,
        );
      }

      return searchIndex
        .filter((item) => {
          const haystack = [
            item.label,
            item.description,
            item.section,
          ]
            .join(' ')
            .toLowerCase();

          return haystack.includes(
            query,
          );
        })
        .slice(0, 10);
    }, [
      searchIndex,
      searchQuery,
    ]);

  /* --------------------------------------------------------------------------
     REGISTER TAB BUTTONS
  -------------------------------------------------------------------------- */

  const registerTabButton =
    useCallback(
      (
        tab: AdminTab,
        node:
          | HTMLButtonElement
          | null,
      ) => {
        if (node) {
          tabButtonRefs.current.set(
            tab,
            node,
          );

          return;
        }

        tabButtonRefs.current.delete(
          tab,
        );
      },
      [],
    );

  /* --------------------------------------------------------------------------
     UPDATE TAB INDICATOR
  -------------------------------------------------------------------------- */

  const updateTabIndicator =
    useCallback(() => {
      const row =
        tabRowRef.current;

      const button =
        tabButtonRefs.current.get(
          activeTab,
        );

      if (
        !row ||
        !button
      ) {
        return;
      }

      const horizontalInset =
        8;

      setTabIndicator({
        left:
          button.offsetLeft +
          horizontalInset,

        width:
          Math.max(
            button.offsetWidth -
              horizontalInset *
                2,
            12,
          ),

        ready:
          true,
      });
    }, [
      activeTab,
    ]);

  useLayoutEffect(() => {
    updateTabIndicator();
  }, [
    activeSection.id,
    activeTab,
    updateTabIndicator,
  ]);

  useEffect(() => {
    const handleResize =
      () => {
        updateTabIndicator();
      };

    window.addEventListener(
      'resize',
      handleResize,
    );

    return () => {
      window.removeEventListener(
        'resize',
        handleResize,
      );
    };
  }, [
    updateTabIndicator,
  ]);

  useEffect(() => {
    const button =
      tabButtonRefs.current.get(
        activeTab,
      );

    if (!button) {
      return;
    }

    const reduceMotion =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

    button.scrollIntoView({
      behavior:
        reduceMotion
          ? 'auto'
          : 'smooth',

      block:
        'nearest',

      inline:
        'nearest',
    });
  }, [
    activeTab,
  ]);

  /* --------------------------------------------------------------------------
     TAB INDICATOR STYLE
  -------------------------------------------------------------------------- */

  const tabIndicatorStyle =
    useMemo<CSSProperties>(
      () => ({
        width:
          tabIndicator.width,

        transform: `translate3d(${tabIndicator.left}px, 0, 0)`,

        opacity:
          tabIndicator.ready
            ? 1
            : 0,
      }),
      [
        tabIndicator,
      ],
    );

  /* --------------------------------------------------------------------------
     CLOSE POPOVERS WHEN CLICKING OUTSIDE
  -------------------------------------------------------------------------- */

  useEffect(() => {
    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      const target =
        event.target;

      if (
        !(target instanceof Node)
      ) {
        return;
      }

      if (
        profileRef.current &&
        !profileRef.current.contains(
          target,
        )
      ) {
        setProfileOpen(
          false,
        );
      }

      if (
        contextRef.current &&
        !contextRef.current.contains(
          target,
        )
      ) {
        setContextOpen(
          false,
        );
      }

      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(
          target,
        )
      ) {
        setNotificationsOpen(
          false,
        );
      }
    };

    window.addEventListener(
      'pointerdown',
      handlePointerDown,
    );

    return () => {
      window.removeEventListener(
        'pointerdown',
        handlePointerDown,
      );
    };
  }, []);

  /* --------------------------------------------------------------------------
     KEYBOARD SHORTCUTS
  -------------------------------------------------------------------------- */

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      const modifier =
        event.metaKey ||
        event.ctrlKey;

      if (
        modifier &&
        event.key.toLowerCase() ===
          'k'
      ) {
        event.preventDefault();

        setSearchOpen(
          true,
        );

        setProfileOpen(
          false,
        );

        setContextOpen(
          false,
        );

        setNotificationsOpen(
          false,
        );

        window.setTimeout(
          () => {
            searchInputRef.current?.focus();
          },
          20,
        );
      }

      if (
        event.key ===
        'Escape'
      ) {
        setSearchOpen(
          false,
        );

        setProfileOpen(
          false,
        );

        setContextOpen(
          false,
        );

        setNotificationsOpen(
          false,
        );
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, []);

  /* --------------------------------------------------------------------------
     OPEN SEARCH
  -------------------------------------------------------------------------- */

  const openSearch =
    useCallback(() => {
      setProfileOpen(
        false,
      );

      setContextOpen(
        false,
      );

      setNotificationsOpen(
        false,
      );

      setSearchOpen(
        true,
      );

      window.setTimeout(
        () => {
          searchInputRef.current?.focus();
        },
        20,
      );
    }, []);

  /* --------------------------------------------------------------------------
     SEARCH RESULT
  -------------------------------------------------------------------------- */

  const selectSearchResult =
    useCallback(
      (
        result: SearchResult,
      ) => {
        onTabSelect(
          result.tab,
        );

        setSearchOpen(
          false,
        );

        setSearchQuery(
          '',
        );
      },
      [
        onTabSelect,
      ],
    );

  /* --------------------------------------------------------------------------
     SIGN OUT
  -------------------------------------------------------------------------- */
const signOut =
  useCallback(async () => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      const response = await fetch(
        '/api/admin/signout',
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        },
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error ||
            'Could not sign out.',
        );
      }

      window.location.replace(
        '/login',
      );
    } catch (error) {
      console.error(
        'Could not sign out:',
        error,
      );

      setSigningOut(false);
    }
  }, [signingOut]);
  /* --------------------------------------------------------------------------
     RENDER
  -------------------------------------------------------------------------- */

  return (
    <>
      <header
        className="
          relative
          border-b
          border-[var(--line)]
          bg-[var(--shell-translucent)]
          backdrop-blur-2xl
        "
      >
        {/* ==================================================================
            TOP ROW
        ================================================================== */}

        <div
          className="
            flex
            min-h-[70px]
            items-center
            gap-4
            px-5
            xl:px-7
          "
        >
          {/* ---------------------------------------------------------------
              ACTIVE WORKSPACE
          --------------------------------------------------------------- */}

          <div
            className="
              flex
              min-w-0
              items-center
              gap-3
            "
          >
            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-[var(--surface-muted)]
                text-[var(--text)]
              "
            >
              <ActiveSectionIcon
                size={16}
                strokeWidth={1.9}
              />
            </div>

            <div className="min-w-0">
              <p
                className="
                  truncate
                  text-[13px]
                  font-semibold
                  tracking-[-0.015em]
                  text-[var(--text)]
                "
              >
                {
                  activeSection.label
                }
              </p>

              <p
                className="
                  mt-0.5
                  max-w-[250px]
                  truncate
                  text-[10px]
                  text-[var(--text-subtle)]
                "
              >
                {
                  activeSection.description
                }
              </p>
            </div>
          </div>

          <div className="flex-1" />

          {/* ---------------------------------------------------------------
              WORKSPACE CONTEXT
          --------------------------------------------------------------- */}

          <div
            ref={
              contextRef
            }
            className="relative"
          >
            <button
              type="button"
              onClick={() => {
                setContextOpen(
                  (current) =>
                    !current,
                );

                setProfileOpen(
                  false,
                );

                setNotificationsOpen(
                  false,
                );
              }}
              aria-expanded={
                contextOpen
              }
              aria-label={`Workspace context: ${currentContext.label}`}
              className="
                hidden
                h-10
                items-center
                gap-2.5
                rounded-full
                border
                border-[var(--line)]
                bg-[var(--surface)]
                pl-1.5
                pr-3
                text-left
                shadow-sm
                transition-colors
                duration-150
                hover:bg-[var(--surface-muted)]
                xl:flex
              "
            >
              <WorkspaceAvatar
                context={
                  currentContext
                }
                size="small"
              />

              <span className="min-w-0">
                <span
                  className="
                    block
                    max-w-[145px]
                    truncate
                    text-[10px]
                    font-semibold
                    text-[var(--text)]
                  "
                >
                  {
                    currentContext.label
                  }
                </span>

                <span
                  className="
                    block
                    max-w-[145px]
                    truncate
                    text-[8px]
                    text-[var(--text-subtle)]
                  "
                >
                  {
                    currentContext.description
                  }
                </span>
              </span>

              {clientsLoading ? (
                <LoaderCircle
                  size={13}
                  className="
                    animate-spin
                    text-[var(--text-subtle)]
                  "
                />
              ) : (
                <ChevronDown
                  size={13}
                  className={`
                    text-[var(--text-subtle)]
                    transition-transform
                    duration-150

                    ${
                      contextOpen
                        ? 'rotate-180'
                        : ''
                    }
                  `}
                />
              )}
            </button>

            {contextOpen && (
              <ContextMenu
                currentContextId={
                  currentContext.id
                }
                contexts={
                  workspaceContexts
                }
                loading={
                  clientsLoading
                }
                error={
                  clientsError
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

          {/* ---------------------------------------------------------------
              SEARCH
          --------------------------------------------------------------- */}

          <button
            type="button"
            onClick={
              openSearch
            }
            className="
              flex
              h-10
              items-center
              gap-2
              rounded-full
              border
              border-[var(--line)]
              bg-[var(--surface)]
              px-3
              text-[var(--text-muted)]
              shadow-sm
              transition-colors
              duration-150
              hover:bg-[var(--surface-muted)]
              hover:text-[var(--text)]
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[var(--primary)]
            "
            aria-label="Search Syntra Grid"
          >
            <Search
              size={15}
              strokeWidth={1.9}
            />

            <span
              className="
                hidden
                text-[10px]
                font-medium
                xl:inline
              "
            >
              Search
            </span>

            <span
              className="
                hidden
                items-center
                gap-0.5
                rounded-md
                border
                border-[var(--line)]
                bg-[var(--surface-muted)]
                px-1.5
                py-0.5
                text-[8px]
                font-semibold
                text-[var(--text-subtle)]
                xl:flex
              "
            >
              <Command
                size={8}
              />
              K
            </span>
          </button>

          {/* ---------------------------------------------------------------
              NOTIFICATIONS
          --------------------------------------------------------------- */}

          <div
            ref={
              notificationsRef
            }
            className="relative"
          >
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(
                  (current) =>
                    !current,
                );

                setContextOpen(
                  false,
                );

                setProfileOpen(
                  false,
                );
              }}
              aria-label="Notifications"
              aria-expanded={
                notificationsOpen
              }
              className="
                relative
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-full
                border
                border-[var(--line)]
                bg-[var(--surface)]
                text-[var(--text-muted)]
                shadow-sm
                transition-colors
                duration-150
                hover:bg-[var(--surface-muted)]
                hover:text-[var(--text)]
              "
            >
              <Bell
                size={16}
                strokeWidth={1.9}
              />

              <span
                className="
                  absolute
                  right-[8px]
                  top-[8px]
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-[var(--accent)]
                  ring-2
                  ring-[var(--surface)]
                "
              />
            </button>

            {notificationsOpen && (
              <NotificationsMenu
                onOpenNotifications={() => {
                  onTabSelect(
                    'notifications',
                  );

                  setNotificationsOpen(
                    false,
                  );
                }}
              />
            )}
          </div>

          {/* ---------------------------------------------------------------
              PROFILE
          --------------------------------------------------------------- */}

          <div
            ref={
              profileRef
            }
            className="relative"
          >
            <button
              type="button"
              onClick={() => {
                setProfileOpen(
                  (current) =>
                    !current,
                );

                setContextOpen(
                  false,
                );

                setNotificationsOpen(
                  false,
                );
              }}
              aria-expanded={
                profileOpen
              }
              className="
                flex
                h-10
                items-center
                gap-2
                rounded-full
                border
                border-[var(--line)]
                bg-[var(--surface)]
                p-1
                pr-2
                shadow-sm
                transition-colors
                duration-150
                hover:bg-[var(--surface-muted)]
              "
            >
              <span
                className="
                  flex
                  h-8
                  w-8
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-[var(--primary)]
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.03em]
                  text-[var(--primary-foreground)]
                "
              >
                {initials(
                  admin.fullName,
                )}
              </span>

              <ChevronDown
                size={12}
                className={`
                  hidden
                  text-[var(--text-subtle)]
                  transition-transform
                  duration-150
                  xl:block

                  ${
                    profileOpen
                      ? 'rotate-180'
                      : ''
                  }
                `}
              />
            </button>

            {profileOpen && (
              <ProfileMenu
                admin={
                  admin
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
                  onTabSelect(
                    'team',
                  );

                  setProfileOpen(
                    false,
                  );
                }}
                onSettings={() => {
                  onTabSelect(
                    'settings',
                  );

                  setProfileOpen(
                    false,
                  );
                }}
                onSignOut={() =>
                  void signOut()
                }
              />
            )}
          </div>
        </div>

        {/* ==================================================================
            WORKSPACE TAB ROW
        ================================================================== */}

        <div
          ref={
            tabRowRef
          }
          className="
            no-scrollbar
            relative
            flex
            min-h-[45px]
            items-end
            gap-1
            overflow-x-auto
            overflow-y-hidden
            px-5
            xl:px-7
          "
          aria-label={`${activeSection.label} tabs`}
        >
          {/* Moving indicator */}

          <span
            aria-hidden="true"
            style={
              tabIndicatorStyle
            }
            className="
              pointer-events-none
              absolute
              bottom-0
              left-0
              z-20
              h-[2px]
              rounded-full
              bg-[var(--primary)]
              transition-[transform,width,opacity]
              duration-[300ms]
              ease-[cubic-bezier(0.22,1,0.36,1)]
              motion-reduce:transition-none
            "
          />

          {/* Tab buttons */}

          {activeSection.items.map(
            (item) => {
              const selected =
                item.tab ===
                activeTab;

              const Icon =
                item.icon;

              return (
                <button
                  ref={(node) => {
                    registerTabButton(
                      item.tab,
                      node,
                    );
                  }}
                  key={
                    item.tab
                  }
                  type="button"
                  onClick={() =>
                    onTabSelect(
                      item.tab,
                    )
                  }
                  aria-current={
                    selected
                      ? 'page'
                      : undefined
                  }
                  className={`
                    group
                    relative
                    z-10
                    flex
                    h-[45px]
                    shrink-0
                    items-center
                    gap-2
                    px-3
                    text-[11px]
                    font-semibold
                    transition-[color,transform]
                    duration-200

                    ${
                      selected
                        ? 'text-[var(--text)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
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
                    className="
                      transition-[color,transform]
                      duration-200
                    "
                  />

                  <span>
                    {
                      item.title
                    }
                  </span>

                  {item.status ===
                    'planned' && (
                    <span
                      className="
                        rounded-full
                        bg-[var(--surface-muted)]
                        px-1.5
                        py-0.5
                        text-[7px]
                        font-bold
                        uppercase
                        tracking-[0.08em]
                        text-[var(--text-subtle)]
                      "
                    >
                      Soon
                    </span>
                  )}
                </button>
              );
            },
          )}
        </div>
      </header>

      {/* ====================================================================
          SEARCH
      ==================================================================== */}

      {searchOpen && (
        <SearchPalette
          query={
            searchQuery
          }
          results={
            searchResults
          }
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
            setSearchOpen(
              false,
            );

            setSearchQuery(
              '',
            );
          }}
        />
      )}
    </>
  );
}

/* ============================================================================
   WORKSPACE AVATAR
============================================================================ */

function WorkspaceAvatar({
  context,
  size = 'medium',
}: {
  context: WorkspaceContext;

  size?:
    | 'small'
    | 'medium';
}) {
  const sizeClass =
    size === 'small'
      ? 'h-7 w-7 rounded-full text-[8px]'
      : 'h-9 w-9 rounded-xl text-[9px]';

  if (
    context.logoUrl
  ) {
    return (
      <span
        className={`
          relative
          flex
          shrink-0
          items-center
          justify-center
          overflow-hidden
          border
          border-[var(--line)]
          bg-white
          ${sizeClass}
        `}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            context.logoUrl
          }
          alt=""
          className="
            h-full
            w-full
            object-cover
          "
        />
      </span>
    );
  }

  return (
    <span
      className={`
        flex
        shrink-0
        items-center
        justify-center
        bg-[var(--primary)]
        font-bold
        tracking-[0.02em]
        text-[var(--primary-foreground)]
        ${sizeClass}
      `}
    >
      {
        context.shortLabel
      }
    </span>
  );
}

/* ============================================================================
   CONTEXT MENU
============================================================================ */

function ContextMenu({
  currentContextId,
  contexts,
  loading,
  error,
  onRetry,
  onSelect,
}: {
  currentContextId: string;

  contexts:
    WorkspaceContext[];

  loading: boolean;

  error:
    | string
    | null;

  onRetry:
    () => void;

  onSelect: (
    contextId: string,
  ) => void;
}) {
  const companyContext =
    contexts.find(
      (context) =>
        context.type ===
        'company',
    ) ??
    COMPANY_CONTEXT;

  const clientContexts =
    contexts.filter(
      (context) =>
        context.type ===
        'client',
    );

  return (
    <div
      className="
        absolute
        right-0
        top-[calc(100%+10px)]
        z-[80]
        w-[300px]
        overflow-hidden
        rounded-[20px]
        border
        border-[var(--line)]
        bg-[var(--surface-elevated)]
        shadow-[var(--shadow-popover)]
      "
    >
      {/* ---------------------------------------------------------------
          HEADER
      --------------------------------------------------------------- */}

      <div
        className="
          border-b
          border-[var(--line)]
          px-4
          pb-3
          pt-3.5
        "
      >
        <p
          className="
            text-[9px]
            font-bold
            uppercase
            tracking-[0.14em]
            text-[var(--text-subtle)]
          "
        >
          Workspace context
        </p>

        <p
          className="
            mt-1
            text-[10px]
            leading-4
            text-[var(--text-muted)]
          "
        >
          Choose whose operation
          you are working with.
        </p>
      </div>

      <div
        className="
          no-scrollbar
          max-h-[390px]
          overflow-y-auto
          p-2
        "
      >
        {/* ---------------------------------------------------------------
            SYNTRA GRID
        --------------------------------------------------------------- */}

        <ContextMenuItem
          context={
            companyContext
          }
          selected={
            companyContext.id ===
            currentContextId
          }
          onSelect={
            onSelect
          }
        />

        {/* ---------------------------------------------------------------
            CLIENT DIVIDER
        --------------------------------------------------------------- */}

        <div
          className="
            mb-1
            mt-2
            flex
            items-center
            gap-2
            px-2.5
          "
        >
          <Building2
            size={10}
            className="
              text-[var(--text-subtle)]
            "
          />

          <span
            className="
              text-[8px]
              font-bold
              uppercase
              tracking-[0.12em]
              text-[var(--text-subtle)]
            "
          >
            Clients
          </span>

          {!loading &&
            !error && (
              <span
                className="
                  ml-auto
                  rounded-full
                  bg-[var(--surface-muted)]
                  px-1.5
                  py-0.5
                  text-[7px]
                  font-bold
                  text-[var(--text-subtle)]
                "
              >
                {
                  clientContexts.length
                }
              </span>
            )}
        </div>

        {/* ---------------------------------------------------------------
            LOADING
        --------------------------------------------------------------- */}

        {loading && (
          <div
            className="
              flex
              items-center
              gap-3
              rounded-xl
              px-3
              py-4
            "
          >
            <span
              className="
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-[var(--surface-muted)]
              "
            >
              <LoaderCircle
                size={14}
                className="
                  animate-spin
                  text-[var(--text-subtle)]
                "
              />
            </span>

            <div>
              <p
                className="
                  text-[10px]
                  font-semibold
                  text-[var(--text)]
                "
              >
                Loading clients
              </p>

              <p
                className="
                  mt-0.5
                  text-[8px]
                  text-[var(--text-muted)]
                "
              >
                Syncing workspace
                contexts…
              </p>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------
            ERROR
        --------------------------------------------------------------- */}

        {!loading &&
          error && (
            <div
              className="
                rounded-xl
                border
                border-red-500/15
                bg-red-500/[0.05]
                p-3
              "
            >
              <p
                className="
                  text-[10px]
                  font-semibold
                  text-red-500
                "
              >
                Clients unavailable
              </p>

              <p
                className="
                  mt-1
                  line-clamp-2
                  text-[8px]
                  leading-4
                  text-[var(--text-muted)]
                "
              >
                {error}
              </p>

              <button
                type="button"
                onClick={
                  onRetry
                }
                className="
                  mt-2.5
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  border
                  border-[var(--line)]
                  bg-[var(--surface)]
                  px-2.5
                  py-1.5
                  text-[8px]
                  font-semibold
                  text-[var(--text)]
                  transition-colors
                  hover:bg-[var(--surface-muted)]
                "
              >
                <RefreshCw
                  size={10}
                />

                Try again
              </button>
            </div>
          )}

        {/* ---------------------------------------------------------------
            CLIENTS
        --------------------------------------------------------------- */}

        {!loading &&
          !error &&
          clientContexts.map(
            (context) => (
              <ContextMenuItem
                key={
                  context.id
                }
                context={
                  context
                }
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

        {/* ---------------------------------------------------------------
            EMPTY
        --------------------------------------------------------------- */}

        {!loading &&
          !error &&
          clientContexts.length ===
            0 && (
            <div
              className="
                rounded-xl
                border
                border-dashed
                border-[var(--line)]
                px-4
                py-5
                text-center
              "
            >
              <Building2
                size={17}
                className="
                  mx-auto
                  text-[var(--text-subtle)]
                "
              />

              <p
                className="
                  mt-2
                  text-[10px]
                  font-semibold
                  text-[var(--text)]
                "
              >
                No operational
                clients
              </p>

              <p
                className="
                  mt-1
                  text-[8px]
                  leading-4
                  text-[var(--text-muted)]
                "
              >
                Active, onboarding
                and paused clients
                will appear here
                automatically.
              </p>
            </div>
          )}
      </div>

      {/* ---------------------------------------------------------------
          FOOTER
      --------------------------------------------------------------- */}

      <div
        className="
          border-t
          border-[var(--line)]
          px-4
          py-2.5
        "
      >
        <p
          className="
            text-[8px]
            leading-4
            text-[var(--text-subtle)]
          "
        >
          Client workspaces are
          connected to the Syntra
          Grid client directory.
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
   CONTEXT MENU ITEM
============================================================================ */

function ContextMenuItem({
  context,
  selected,
  onSelect,
}: {
  context:
    WorkspaceContext;

  selected:
    boolean;

  onSelect: (
    contextId: string,
  ) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onSelect(
          context.id,
        )
      }
      className={`
        flex
        w-full
        items-center
        gap-3
        rounded-xl
        px-2.5
        py-2.5
        text-left
        transition-colors
        duration-150
        hover:bg-[var(--surface-muted)]

        ${
          selected
            ? 'bg-[var(--surface-muted)]'
            : ''
        }
      `}
    >
      <WorkspaceAvatar
        context={
          context
        }
      />

      <span
        className="
          min-w-0
          flex-1
        "
      >
        <span
          className="
            flex
            items-center
            gap-2
          "
        >
          <span
            className="
              block
              min-w-0
              truncate
              text-[11px]
              font-semibold
              text-[var(--text)]
            "
          >
            {
              context.label
            }
          </span>

          {context.type ===
            'client' &&
            context.status && (
              <ClientStatusDot
                status={
                  context.status
                }
              />
            )}
        </span>

        <span
          className="
            mt-0.5
            block
            truncate
            text-[9px]
            text-[var(--text-muted)]
          "
        >
          {
            context.description
          }
        </span>
      </span>

      {selected && (
        <Check
          size={14}
          className="
            shrink-0
            text-[var(--accent)]
          "
        />
      )}
    </button>
  );
}

/* ============================================================================
   CLIENT STATUS DOT
============================================================================ */

function ClientStatusDot({
  status,
}: {
  status: string;
}) {
  const normalized =
    status
      .trim()
      .toUpperCase();

  let className =
    'bg-[var(--text-subtle)]';

  if (
    normalized ===
    'ACTIVE'
  ) {
    className =
      'bg-[var(--success)]';
  }

  if (
    normalized ===
    'ONBOARDING'
  ) {
    className =
      'bg-[var(--info)]';
  }

  if (
    normalized ===
    'PAUSED'
  ) {
    className =
      'bg-[var(--warning)]';
  }

  return (
    <span
      title={formatRole(
        normalized,
      )}
      className={`
        h-1.5
        w-1.5
        shrink-0
        rounded-full
        ${className}
      `}
    />
  );
}

/* ============================================================================
   NOTIFICATIONS
============================================================================ */

function NotificationsMenu({
  onOpenNotifications,
}: {
  onOpenNotifications:
    () => void;
}) {
  return (
    <div
      className="
        absolute
        right-0
        top-[calc(100%+10px)]
        z-[80]
        w-[320px]
        overflow-hidden
        rounded-[20px]
        border
        border-[var(--line)]
        bg-[var(--surface-elevated)]
        shadow-[var(--shadow-popover)]
      "
    >
      <div
        className="
          flex
          items-center
          justify-between
          border-b
          border-[var(--line)]
          px-4
          py-3.5
        "
      >
        <div>
          <p
            className="
              text-[12px]
              font-semibold
              text-[var(--text)]
            "
          >
            Notifications
          </p>

          <p
            className="
              mt-0.5
              text-[9px]
              text-[var(--text-muted)]
            "
          >
            Company activity
            requiring attention
          </p>
        </div>

        <span
          className="
            rounded-full
            bg-[var(--accent-tint)]
            px-2
            py-1
            text-[8px]
            font-bold
            text-[var(--accent)]
          "
        >
          3 new
        </span>
      </div>

      <div className="p-2">
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
      </div>

      <div
        className="
          border-t
          border-[var(--line)]
          p-2
        "
      >
        <button
          type="button"
          onClick={
            onOpenNotifications
          }
          className="
            w-full
            rounded-xl
            px-3
            py-2.5
            text-center
            text-[10px]
            font-semibold
            text-[var(--text-muted)]
            transition-colors
            hover:bg-[var(--surface-muted)]
            hover:text-[var(--text)]
          "
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}

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
    | 'success'
    | 'warning'
    | 'info';
}) {
  const toneClass: Record<
    | 'success'
    | 'warning'
    | 'info',
    string
  > = {
    success:
      'bg-[var(--success)]',

    warning:
      'bg-[var(--warning)]',

    info:
      'bg-[var(--info)]',
  };

  return (
    <div
      className="
        flex
        gap-3
        rounded-xl
        px-2.5
        py-3
        transition-colors
        hover:bg-[var(--surface-muted)]
      "
    >
      <span
        className={`
          mt-1.5
          h-2
          w-2
          shrink-0
          rounded-full
          ${toneClass[tone]}
        `}
      />

      <div
        className="
          min-w-0
          flex-1
        "
      >
        <div
          className="
            flex
            items-start
            justify-between
            gap-3
          "
        >
          <p
            className="
              text-[10px]
              font-semibold
              text-[var(--text)]
            "
          >
            {title}
          </p>

          <span
            className="
              shrink-0
              text-[8px]
              text-[var(--text-subtle)]
            "
          >
            {time}
          </span>
        </div>

        <p
          className="
            mt-1
            text-[9px]
            leading-4
            text-[var(--text-muted)]
          "
        >
          {description}
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
   PROFILE
============================================================================ */

function ProfileMenu({
  admin,
  theme,
  signingOut,
  onThemeChange,
  onTeam,
  onSettings,
  onSignOut,
}: {
  admin: AdminUser;

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
    <div
      className="
        absolute
        right-0
        top-[calc(100%+10px)]
        z-[80]
        w-[270px]
        overflow-hidden
        rounded-[20px]
        border
        border-[var(--line)]
        bg-[var(--surface-elevated)]
        shadow-[var(--shadow-popover)]
      "
    >
      {/* Identity */}

      <div
        className="
          border-b
          border-[var(--line)]
          p-4
        "
      >
        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <span
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-[var(--primary)]
              text-[10px]
              font-bold
              uppercase
              text-[var(--primary-foreground)]
            "
          >
            {initials(
              admin.fullName,
            )}
          </span>

          <div className="min-w-0">
            <p
              className="
                truncate
                text-[11px]
                font-semibold
                text-[var(--text)]
              "
            >
              {
                admin.fullName
              }
            </p>

            <p
              className="
                mt-0.5
                truncate
                text-[9px]
                text-[var(--text-muted)]
              "
            >
              {
                admin.email
              }
            </p>
          </div>
        </div>

        <span
          className="
            mt-3
            inline-flex
            rounded-full
            bg-[var(--accent-tint)]
            px-2
            py-1
            text-[8px]
            font-bold
            uppercase
            tracking-[0.08em]
            text-[var(--accent)]
          "
        >
          {formatRole(
            admin.role,
          )}
        </span>
      </div>

      {/* Navigation */}

      <div className="p-2">
        <ProfileAction
          icon={
            UserRound
          }
          label="My account"
          description="Profile and account details"
          onClick={
            onTeam
          }
        />

        <ProfileAction
          icon={
            Users
          }
          label="Team"
          description="People and access"
          onClick={
            onTeam
          }
        />

        <ProfileAction
          icon={
            Settings
          }
          label="Settings"
          description="Syntra Grid configuration"
          onClick={
            onSettings
          }
        />
      </div>

      {/* Theme */}

      <div
        className="
          border-y
          border-[var(--line)]
          p-3
        "
      >
        <p
          className="
            px-1
            text-[8px]
            font-bold
            uppercase
            tracking-[0.12em]
            text-[var(--text-subtle)]
          "
        >
          Appearance
        </p>

        <div
          className="
            mt-2
            grid
            grid-cols-2
            gap-1
            rounded-xl
            bg-[var(--surface-muted)]
            p-1
          "
        >
          <button
            type="button"
            onClick={() =>
              onThemeChange(
                'light',
              )
            }
            className={`
              flex
              items-center
              justify-center
              gap-1.5
              rounded-lg
              px-2
              py-2
              text-[9px]
              font-semibold
              transition-colors

              ${
                theme ===
                'light'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text-muted)]'
              }
            `}
          >
            <Sun
              size={12}
            />
            Light
          </button>

          <button
            type="button"
            onClick={() =>
              onThemeChange(
                'dark',
              )
            }
            className={`
              flex
              items-center
              justify-center
              gap-1.5
              rounded-lg
              px-2
              py-2
              text-[9px]
              font-semibold
              transition-colors

              ${
                theme ===
                'dark'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text-muted)]'
              }
            `}
          >
            <Moon
              size={12}
            />
            Dark
          </button>
        </div>
      </div>

      {/* Sign out */}

      <div className="p-2">
        <button
          type="button"
          disabled={
            signingOut
          }
          onClick={
            onSignOut
          }
          className="
            flex
            w-full
            items-center
            gap-3
            rounded-xl
            px-3
            py-2.5
            text-left
            text-red-500
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

          <span
            className="
              text-[10px]
              font-semibold
            "
          >
            {signingOut
              ? 'Signing out…'
              : 'Sign out'}
          </span>
        </button>
      </div>
    </div>
  );
}

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
      onClick={
        onClick
      }
      className="
        flex
        w-full
        items-center
        gap-3
        rounded-xl
        px-3
        py-2.5
        text-left
        transition-colors
        hover:bg-[var(--surface-muted)]
      "
    >
      <span
        className="
          flex
          h-8
          w-8
          shrink-0
          items-center
          justify-center
          rounded-xl
          bg-[var(--surface-muted)]
          text-[var(--text-muted)]
        "
      >
        <Icon
          size={14}
          strokeWidth={1.8}
        />
      </span>

      <span className="min-w-0">
        <span
          className="
            block
            text-[10px]
            font-semibold
            text-[var(--text)]
          "
        >
          {label}
        </span>

        <span
          className="
            mt-0.5
            block
            text-[8px]
            text-[var(--text-muted)]
          "
        >
          {description}
        </span>
      </span>
    </button>
  );
}

/* ============================================================================
   SEARCH PALETTE
============================================================================ */

function SearchPalette({
  query,
  results,
  inputRef,
  onQueryChange,
  onSelect,
  onClose,
}: {
  query: string;

  results:
    SearchResult[];

  inputRef:
    RefObject<
      HTMLInputElement | null
    >;

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
      (
        value: string,
      ) => {
        setSelectedIndex(
          0,
        );

        onQueryChange(
          value,
        );
      },
      [
        onQueryChange,
      ],
    );

  const handleKeyDown = (
    event:
      ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (
      event.key ===
      'ArrowDown'
    ) {
      event.preventDefault();

      setSelectedIndex(
        (current) =>
          Math.min(
            current + 1,
            Math.max(
              results.length -
                1,
              0,
            ),
          ),
      );

      return;
    }

    if (
      event.key ===
      'ArrowUp'
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
      event.key ===
        'Enter' &&
      results[selectedIndex]
    ) {
      event.preventDefault();

      onSelect(
        results[
          selectedIndex
        ],
      );
    }
  };

  return (
    <div
      className="
        fixed
        inset-0
        z-[150]
        flex
        items-start
        justify-center
        bg-black/30
        px-4
        pt-[10vh]
        backdrop-blur-[3px]
      "
      role="dialog"
      aria-modal="true"
      aria-label="Search Syntra Grid"
    >
      <button
        type="button"
        aria-label="Close search"
        onClick={
          onClose
        }
        className="
          absolute
          inset-0
          cursor-default
        "
      />

      <div
        className="
          relative
          z-10
          w-full
          max-w-[620px]
          overflow-hidden
          rounded-[24px]
          border
          border-[var(--line)]
          bg-[var(--surface-elevated)]
          shadow-[var(--shadow-popover)]
        "
      >
        {/* Input */}

        <div
          className="
            flex
            items-center
            gap-3
            border-b
            border-[var(--line)]
            px-4
          "
        >
          <Search
            size={17}
            className="
              shrink-0
              text-[var(--text-subtle)]
            "
          />

          <input
            ref={
              inputRef
            }
            value={
              query
            }
            onChange={(
              event,
            ) =>
              changeQuery(
                event.target
                  .value,
              )
            }
            onKeyDown={
              handleKeyDown
            }
            placeholder="Search Syntra Grid…"
            className="
              h-14
              min-w-0
              flex-1
              bg-transparent
              text-[13px]
              text-[var(--text)]
              outline-none
              placeholder:text-[var(--text-subtle)]
            "
          />

          <button
            type="button"
            onClick={
              onClose
            }
            aria-label="Close search"
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-full
              text-[var(--text-muted)]
              transition-colors
              hover:bg-[var(--surface-muted)]
              hover:text-[var(--text)]
            "
          >
            <X
              size={15}
            />
          </button>
        </div>

        {/* Results */}

        <div
          className="
            no-scrollbar
            max-h-[420px]
            overflow-y-auto
            p-2
          "
        >
          {results.length ===
          0 ? (
            <div
              className="
                px-5
                py-12
                text-center
              "
            >
              <Search
                size={20}
                className="
                  mx-auto
                  text-[var(--text-subtle)]
                "
              />

              <p
                className="
                  mt-3
                  text-[11px]
                  font-semibold
                  text-[var(--text)]
                "
              >
                Nothing found
              </p>

              <p
                className="
                  mt-1
                  text-[9px]
                  text-[var(--text-muted)]
                "
              >
                Try another page,
                client or module.
              </p>
            </div>
          ) : (
            results.map(
              (
                result,
                index,
              ) => (
                <button
                  key={
                    result.id
                  }
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
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-xl
                    px-3
                    py-3
                    text-left
                    transition-colors
                    duration-100

                    ${
                      index ===
                      selectedIndex
                        ? 'bg-[var(--surface-muted)]'
                        : ''
                    }
                  `}
                >
                  <span
                    className="
                      flex
                      h-9
                      w-9
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                      border
                      border-[var(--line)]
                      bg-[var(--surface)]
                      text-[var(--text-muted)]
                    "
                  >
                    <Search
                      size={13}
                    />
                  </span>

                  <span
                    className="
                      min-w-0
                      flex-1
                    "
                  >
                    <span
                      className="
                        flex
                        items-center
                        gap-2
                      "
                    >
                      <span
                        className="
                          truncate
                          text-[11px]
                          font-semibold
                          text-[var(--text)]
                        "
                      >
                        {
                          result.label
                        }
                      </span>

                      <span
                        className="
                          shrink-0
                          rounded-full
                          bg-[var(--accent-tint)]
                          px-1.5
                          py-0.5
                          text-[7px]
                          font-bold
                          uppercase
                          tracking-[0.06em]
                          text-[var(--accent)]
                        "
                      >
                        {
                          result.section
                        }
                      </span>
                    </span>

                    <span
                      className="
                        mt-1
                        block
                        truncate
                        text-[9px]
                        text-[var(--text-muted)]
                      "
                    >
                      {
                        result.description
                      }
                    </span>
                  </span>
                </button>
              ),
            )
          )}
        </div>

        <div
          className="
            flex
            items-center
            justify-between
            border-t
            border-[var(--line)]
            px-4
            py-2.5
            text-[8px]
            text-[var(--text-subtle)]
          "
        >
          <span>
            ↑ ↓ Navigate · Enter
            Open
          </span>

          <span>
            ESC Close
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   HELPERS
============================================================================ */

function cleanText(
  value:
    | string
    | null
    | undefined,
) {
  if (
    typeof value !==
    'string'
  ) {
    return '';
  }

  return value.trim();
}

function createShortLabel(
  value: string,
) {
  const words =
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    words.length === 0
  ) {
    return 'CL';
  }

  if (
    words.length === 1
  ) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    words[0]
      .charAt(0) +
    words[1]
      .charAt(0)
  ).toUpperCase();
}

function getClientContextDescription(
  client: ClientApiRecord,
) {
  const productName =
    cleanText(
      client.productName,
    );

  if (productName) {
    return productName;
  }

  const industry =
    cleanText(
      client.industry,
    );

  if (industry) {
    return industry;
  }

  return 'Client workspace';
}

function initials(
  value: string,
) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part
        .charAt(0)
        .toUpperCase(),
    )
    .join('');
}

function formatRole(
  value: string,
) {
  return value
    .replaceAll(
      '_',
      ' ',
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}