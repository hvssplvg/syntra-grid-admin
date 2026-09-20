'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  Menu,
  X,
} from 'lucide-react';

import AdminHeader from './AdminHeader';
import AdminPageIdentity from './AdminPageIdentity';
import AdminSidebar from './AdminSidebar';

import {
  ADMIN_SECTIONS,
  type AdminSection,
  type AdminTab,
  type AdminTabDefinition,
  type AdminUser,
} from './adminNav';

import type {
  NavigationDirection,
} from './AdminHome';

/* ============================================================================
   TYPES
============================================================================ */

export type AdminShellProps = {
  admin: AdminUser;

  activeTab: AdminTab;

  setActiveTab: (
    tab: AdminTab,
  ) => void;

  tabDefinitions: Record<
    AdminTab,
    AdminTabDefinition
  >;

  navigationDirection:
    NavigationDirection;

  children: ReactNode;
};

type ContentTransitionState = {
  phase:
    | 'idle'
    | 'prepare'
    | 'enter';

  direction:
    NavigationDirection;
};

/* ============================================================================
   COMPONENT
============================================================================ */

export default function AdminShell({
  admin,
  activeTab,
  setActiveTab,
  tabDefinitions,
  navigationDirection,
  children,
}: AdminShellProps) {
  const [
    mobileNavigationOpen,
    setMobileNavigationOpen,
  ] = useState(false);

  /*
   * The transition is intentionally controlled by the shell rather than by
   * remounting the shell itself.
   *
   * We only animate the content region.
   */
  const [
    contentTransition,
    setContentTransition,
  ] =
    useState<ContentTransitionState>({
      phase: 'idle',
      direction: 'none',
    });

  const previousTabRef =
    useRef<AdminTab>(
      activeTab,
    );

  const transitionFrameRef =
    useRef<number | null>(
      null,
    );

  const transitionTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  /* --------------------------------------------------------------------------
     NAVIGATION
  -------------------------------------------------------------------------- */

  const sections =
    ADMIN_SECTIONS;

  const activeDefinition =
    tabDefinitions[
      activeTab
    ];

  const activeSection =
    useMemo(() => {
      return (
        sections.find(
          (section) =>
            section.items.some(
              (item) =>
                item.tab ===
                activeTab,
            ),
        ) ??
        sections[0]
      );
    }, [
      activeTab,
      sections,
    ]);

  /* --------------------------------------------------------------------------
     ACTIONS
  -------------------------------------------------------------------------- */

  const selectTab =
    useCallback(
      (tab: AdminTab) => {
        setActiveTab(tab);

        setMobileNavigationOpen(
          false,
        );
      },
      [setActiveTab],
    );

  const selectSection =
    useCallback(
      (
        section: AdminSection,
      ) => {
        if (
          activeSection.id ===
          section.id
        ) {
          setMobileNavigationOpen(
            false,
          );

          return;
        }

        const firstTab =
          section.items[0]?.tab;

        if (!firstTab) {
          return;
        }

        setActiveTab(
          firstTab,
        );

        setMobileNavigationOpen(
          false,
        );
      },
      [
        activeSection.id,
        setActiveTab,
      ],
    );

  /* --------------------------------------------------------------------------
     CONTENT TRANSITION

     IMPORTANT:

     We do NOT put key={activeTab} on the content wrapper.

     We do NOT use the old admin-tab-enter class.

     The active tab component itself naturally changes in AdminHome, while
     this stable wrapper handles only the visual movement.

     prepare:
       New content begins a few pixels toward the navigation direction.

     enter:
       Browser animates it into its resting position.

     idle:
       Transition is finished.
  -------------------------------------------------------------------------- */

  useEffect(() => {
    const previousTab =
      previousTabRef.current;

    if (
      previousTab ===
      activeTab
    ) {
      return;
    }

    previousTabRef.current =
      activeTab;

    if (
      transitionFrameRef.current !==
      null
    ) {
      cancelAnimationFrame(
        transitionFrameRef.current,
      );
    }

    if (
      transitionTimerRef.current
    ) {
      clearTimeout(
        transitionTimerRef.current,
      );
    }

    /*
     * Respect reduced-motion preferences.
     */
    const reduceMotion =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

    if (
      reduceMotion ||
      navigationDirection ===
        'none'
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContentTransition({
        phase: 'idle',
        direction: 'none',
      });

      return;
    }

    setContentTransition({
      phase: 'prepare',
      direction:
        navigationDirection,
    });

    /*
     * Two animation frames make sure the browser paints the starting
     * position before we ask it to animate to the resting position.
     */
    transitionFrameRef.current =
      requestAnimationFrame(
        () => {
          transitionFrameRef.current =
            requestAnimationFrame(
              () => {
                setContentTransition({
                  phase: 'enter',
                  direction:
                    navigationDirection,
                });

                transitionFrameRef.current =
                  null;
              },
            );
        },
      );

    transitionTimerRef.current =
      setTimeout(
        () => {
          setContentTransition({
            phase: 'idle',
            direction: 'none',
          });

          transitionTimerRef.current =
            null;
        },
        260,
      );

    return () => {
      if (
        transitionFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          transitionFrameRef.current,
        );

        transitionFrameRef.current =
          null;
      }

      if (
        transitionTimerRef.current
      ) {
        clearTimeout(
          transitionTimerRef.current,
        );

        transitionTimerRef.current =
          null;
      }
    };
  }, [
    activeTab,
    navigationDirection,
  ]);

  /* --------------------------------------------------------------------------
     MOBILE DRAWER
  -------------------------------------------------------------------------- */

  useEffect(() => {
    if (
      !mobileNavigationOpen
    ) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      'hidden';

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === 'Escape'
      ) {
        setMobileNavigationOpen(
          false,
        );
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    mobileNavigationOpen,
  ]);

  /* --------------------------------------------------------------------------
     CONTENT TRANSITION CLASS
  -------------------------------------------------------------------------- */

  const contentTransitionClass =
    useMemo(() => {
      if (
        contentTransition.phase ===
        'idle'
      ) {
        return [
          'translate-x-0',
          'opacity-100',
        ].join(' ');
      }

      if (
        contentTransition.phase ===
        'prepare'
      ) {
        if (
          contentTransition.direction ===
          'forward'
        ) {
          return [
            'translate-x-[14px]',
            'opacity-0',
            'transition-none',
          ].join(' ');
        }

        if (
          contentTransition.direction ===
          'backward'
        ) {
          return [
            '-translate-x-[14px]',
            'opacity-0',
            'transition-none',
          ].join(' ');
        }
      }

      /*
       * ENTER
       *
       * Both directions animate back to zero.
       */
      return [
        'translate-x-0',
        'opacity-100',
        'transition-[transform,opacity]',
        'duration-[220ms]',
        'ease-[cubic-bezier(0.22,1,0.36,1)]',
      ].join(' ');
    }, [
      contentTransition,
    ]);

  /* --------------------------------------------------------------------------
     SAFETY
  -------------------------------------------------------------------------- */

  if (
    !activeDefinition ||
    !activeSection
  ) {
    return (
      <div
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-[var(--canvas)]
          p-6
        "
      >
        <div
          className="
            rounded-[24px]
            border
            border-[var(--line)]
            bg-[var(--shell)]
            p-8
            text-center
            shadow-[var(--shadow-card)]
          "
        >
          <p
            className="
              text-sm
              font-semibold
              text-[var(--text)]
            "
          >
            Admin navigation could
            not be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ====================================================================
          DESKTOP
      ==================================================================== */}

      <main
        className="
          hidden
          h-[100dvh]
          min-h-0
          gap-3
          overflow-hidden
          bg-[var(--canvas)]
          p-3
          text-[var(--text)]
          lg:flex
          xl:gap-4
          xl:p-4
        "
      >
        <AdminSidebar
          admin={admin}
          sections={sections}
          activeSection={
            activeSection
          }
          activeTab={activeTab}
          onSectionSelect={
            selectSection
          }
          onTabSelect={
            selectTab
          }
        />

        <section
          className="
            relative
            flex
            min-w-0
            flex-1
            flex-col
            overflow-hidden
            rounded-[28px]
            border
            border-[var(--line)]
            bg-[var(--shell)]
            shadow-[var(--shadow-card)]
          "
        >
          {/* ---------------------------------------------------------------
              HEADER

              The header remains mounted while content changes.
          --------------------------------------------------------------- */}

          <div
            className="
              relative
              z-30
              shrink-0
            "
          >
            <AdminHeader
              admin={admin}
              sections={sections}
              activeSection={
                activeSection
              }
              activeTab={
                activeTab
              }
              onTabSelect={
                selectTab
              }
            />
          </div>

          {/* ---------------------------------------------------------------
              SCROLL AREA
          --------------------------------------------------------------- */}

          <div
            id="admin-shell-scroll-area"
            className="
              no-scrollbar
              min-h-0
              flex-1
              overflow-x-hidden
              overflow-y-auto
              overscroll-contain
            "
          >
            <div
              className="
                mx-auto
                w-full
                max-w-[1800px]
                px-5
                pb-12
                pt-6
                xl:px-7
                xl:pb-14
                xl:pt-7
                2xl:px-8
              "
            >
              {/* -----------------------------------------------------------
                  PAGE IDENTITY

                  We keep this outside the sliding content region so the
                  application feels anchored while modules change.
              ----------------------------------------------------------- */}

              <AdminPageIdentity
                section={
                  activeSection
                }
                tab={
                  activeDefinition
                }
              />

              {/* -----------------------------------------------------------
                  CONTENT

                  Stable wrapper.

                  NO:
                    key={activeTab}

                  NO:
                    admin-tab-enter

                  Only the content inside this area moves.
              ----------------------------------------------------------- */}

              <div
                className="
                  mt-6
                  min-w-0
                  overflow-x-hidden
                  xl:mt-7
                "
              >
                <div
                  className={`
                    min-w-0
                    transform-gpu
                    will-change-[transform,opacity]
                    ${contentTransitionClass}
                  `}
                >
                  {children}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ====================================================================
          MOBILE
      ==================================================================== */}

      <main
        className="
          flex
          min-h-[100dvh]
          flex-col
          bg-[var(--canvas)]
          text-[var(--text)]
          lg:hidden
        "
      >
        <section
          className="
            relative
            flex
            min-h-[100dvh]
            min-w-0
            flex-1
            flex-col
            overflow-hidden
            bg-[var(--shell)]
            sm:m-2
            sm:min-h-[calc(100dvh-16px)]
            sm:rounded-[26px]
            sm:border
            sm:border-[var(--line)]
            sm:shadow-[var(--shadow-card)]
          "
        >
          {/* ---------------------------------------------------------------
              MOBILE HEADER
          --------------------------------------------------------------- */}

          <div
            className="
              sticky
              top-0
              z-40
              shrink-0
              border-b
              border-[var(--line)]
              bg-[var(--shell-translucent)]
              backdrop-blur-2xl
            "
          >
            <div
              className="
                flex
                h-[66px]
                items-center
                gap-3
                px-4
                sm:px-5
              "
            >
              <button
                type="button"
                onClick={() =>
                  setMobileNavigationOpen(
                    true,
                  )
                }
                aria-label="Open navigation"
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-[var(--line)]
                  bg-[var(--surface)]
                  text-[var(--text)]
                  transition-colors
                  duration-150
                  hover:bg-[var(--surface-muted)]
                "
              >
                <Menu
                  size={18}
                  strokeWidth={1.9}
                />
              </button>

              <div
                className="
                  min-w-0
                  flex-1
                "
              >
                <p
                  className="
                    truncate
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.14em]
                    text-[var(--text-subtle)]
                  "
                >
                  {
                    activeSection.label
                  }
                </p>

                <p
                  className="
                    mt-0.5
                    truncate
                    text-[15px]
                    font-semibold
                    tracking-[-0.015em]
                    text-[var(--text)]
                  "
                >
                  {
                    activeDefinition.title
                  }
                </p>
              </div>

              <MobileAvatar
                name={
                  admin.fullName
                }
              />
            </div>

            {/* -------------------------------------------------------------
                MOBILE WORKSPACE TABS
            ------------------------------------------------------------- */}

            {activeSection.items
              .length > 1 && (
              <div
                className="
                  no-scrollbar
                  flex
                  gap-1
                  overflow-x-auto
                  px-3
                  pb-2.5
                  sm:px-4
                "
              >
                {activeSection.items.map(
                  (item) => {
                    const selected =
                      item.tab ===
                      activeTab;

                    return (
                      <button
                        key={
                          item.tab
                        }
                        type="button"
                        onClick={() =>
                          selectTab(
                            item.tab,
                          )
                        }
                        className={`
                          shrink-0
                          rounded-full
                          px-3.5
                          py-2
                          text-[11px]
                          font-semibold
                          transition-[background-color,color,transform]
                          duration-200
                          ${
                            selected
                              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                              : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
                          }
                        `}
                      >
                        {
                          item.title
                        }
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>

          {/* ---------------------------------------------------------------
              MOBILE CONTENT
          --------------------------------------------------------------- */}

          <div
            className="
              no-scrollbar
              min-h-0
              flex-1
              overflow-x-hidden
              overflow-y-auto
            "
          >
            <div
              className="
                mx-auto
                w-full
                max-w-[1800px]
                px-4
                pb-12
                pt-5
                sm:px-5
                sm:pb-14
                sm:pt-6
              "
            >
              <AdminPageIdentity
                section={
                  activeSection
                }
                tab={
                  activeDefinition
                }
                compact
              />

              <div
                className="
                  mt-5
                  min-w-0
                  overflow-x-hidden
                  sm:mt-6
                "
              >
                <div
                  className={`
                    min-w-0
                    transform-gpu
                    will-change-[transform,opacity]
                    ${contentTransitionClass}
                  `}
                >
                  {children}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ====================================================================
          MOBILE DRAWER
      ==================================================================== */}

      {mobileNavigationOpen && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            lg:hidden
          "
          role="dialog"
          aria-modal="true"
        >
          {/* ---------------------------------------------------------------
              BACKDROP
          --------------------------------------------------------------- */}

          <button
            type="button"
            aria-label="Close navigation"
            onClick={() =>
              setMobileNavigationOpen(
                false,
              )
            }
            className="
              absolute
              inset-0
              bg-black/35
              backdrop-blur-[2px]
            "
          />

          {/* ---------------------------------------------------------------
              DRAWER
          --------------------------------------------------------------- */}

          <aside
            className="
              absolute
              bottom-2
              left-2
              top-2
              flex
              w-[min(88vw,360px)]
              flex-col
              overflow-hidden
              rounded-[28px]
              border
              border-[var(--line)]
              bg-[var(--shell)]
              shadow-[0_28px_80px_rgba(0,0,0,0.28)]
            "
          >
            {/* -------------------------------------------------------------
                DRAWER HEADER
            ------------------------------------------------------------- */}

            <div
              className="
                flex
                items-center
                gap-3
                border-b
                border-[var(--line)]
                px-4
                py-4
              "
            >
              <SyntraMark />

              <div
                className="
                  min-w-0
                  flex-1
                "
              >
                <p
                  className="
                    truncate
                    text-sm
                    font-semibold
                    text-[var(--text)]
                  "
                >
                  Syntra Grid
                </p>

                <p
                  className="
                    mt-0.5
                    truncate
                    text-[11px]
                    text-[var(--text-muted)]
                  "
                >
                  Company console
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMobileNavigationOpen(
                    false,
                  )
                }
                aria-label="Close navigation"
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-full
                  text-[var(--text-muted)]
                  transition-colors
                  hover:bg-[var(--surface-muted)]
                  hover:text-[var(--text)]
                "
              >
                <X size={18} />
              </button>
            </div>

            {/* -------------------------------------------------------------
                DRAWER NAVIGATION
            ------------------------------------------------------------- */}

            <div
              className="
                no-scrollbar
                min-h-0
                flex-1
                overflow-y-auto
                p-3
              "
            >
              <div className="space-y-1">
                {sections.map(
                  (section) => {
                    const Icon =
                      section.icon;

                    const selected =
                      section.id ===
                      activeSection.id;

                    return (
                      <div
                        key={
                          section.id
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            selectSection(
                              section,
                            )
                          }
                          className={`
                            flex
                            w-full
                            items-center
                            gap-3
                            rounded-2xl
                            px-3
                            py-3
                            text-left
                            transition-colors
                            duration-150
                            ${
                              selected
                                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                                : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)]'
                            }
                          `}
                        >
                          <Icon
                            size={17}
                            strokeWidth={
                              selected
                                ? 2
                                : 1.8
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
                                block
                                truncate
                                text-[13px]
                                font-semibold
                              "
                            >
                              {
                                section.label
                              }
                            </span>

                            <span
                              className={`
                                mt-0.5
                                block
                                truncate
                                text-[10px]
                                ${
                                  selected
                                    ? 'text-white/60'
                                    : 'text-[var(--text-subtle)]'
                                }
                              `}
                            >
                              {
                                section.description
                              }
                            </span>
                          </span>
                        </button>

                        {/* -------------------------------------------------
                            ACTIVE WORKSPACE TABS
                        ------------------------------------------------- */}

                        {selected && (
                          <div
                            className="
                              ml-6
                              border-l
                              border-[var(--line)]
                              py-1
                              pl-4
                            "
                          >
                            {section.items.map(
                              (
                                item,
                              ) => (
                                <button
                                  key={
                                    item.tab
                                  }
                                  type="button"
                                  onClick={() =>
                                    selectTab(
                                      item.tab,
                                    )
                                  }
                                  className={`
                                    block
                                    w-full
                                    rounded-xl
                                    px-3
                                    py-2
                                    text-left
                                    text-[11px]
                                    font-medium
                                    transition-colors
                                    duration-150
                                    ${
                                      item.tab ===
                                      activeTab
                                        ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
                                    }
                                  `}
                                >
                                  {
                                    item.title
                                  }
                                </button>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

/* ============================================================================
   SMALL COMPONENTS
============================================================================ */

function MobileAvatar({
  name,
}: {
  name: string;
}) {
  return (
    <div
      className="
        flex
        h-9
        w-9
        items-center
        justify-center
        rounded-full
        bg-[var(--primary)]
        text-[10px]
        font-bold
        text-[var(--primary-foreground)]
      "
    >
      {initials(name)}
    </div>
  );
}

function SyntraMark() {
  return (
    <div
      className="
        flex
        h-10
        w-10
        items-center
        justify-center
        rounded-[13px]
        bg-[var(--primary)]
        text-[12px]
        font-black
        text-[var(--primary-foreground)]
      "
    >
      SG
    </div>
  );
}

/* ============================================================================
   HELPERS
============================================================================ */

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