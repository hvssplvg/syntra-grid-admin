"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  Menu,
  X,
} from "lucide-react";

import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";

import {
  ADMIN_TABS,
  COMMAND_HOME_TAB,
  getSectionLandingTab,
  getVisibleSectionTabs,
  isCommandSection,
  shouldShowSectionTabBar,
  shouldUseCommandLayout,
  type AdminSection,
  type AdminTab,
  type AdminTabDefinition,
  type AdminUser,
} from "./adminNav";

import type {
  NavigationDirection,
} from "./AdminHome";

/* ============================================================================
   TYPES
============================================================================ */

export type AdminShellProps = {
  admin: AdminUser;

  activeTab: AdminTab;

  setActiveTab: (
    tab: AdminTab,
  ) => void;

  // Partial because a restricted employee identity only ever receives
  // definitions for the modules she's been granted — see
  // AdminHome.tsx's filteredTabDefinitions / filteredSections.
  tabDefinitions: Partial<
    Record<AdminTab, AdminTabDefinition>
  >;

  sections: AdminSection[];

  // False only for a restricted employee identity — see
  // AdminHome.tsx. Determines whether Command sections get the Owner's
  // unified Overview-wrapped presentation or behave like a normal
  // section (see getVisibleSectionTabs/shouldShowSectionTabBar/
  // getSectionLandingTab in adminNav.ts).
  isFullAccess?: boolean;

  navigationDirection:
    NavigationDirection;

  children: ReactNode;
};

type ContentTransitionState = {
  phase:
    | "idle"
    | "prepare"
    | "enter";

  direction:
    NavigationDirection;
};

/* ============================================================================
   CONSTANTS
============================================================================ */

const CONTENT_TRANSITION_DURATION = 220;

const CONTENT_TRANSITION_CLEANUP = 260;

/**
 * Standard workspace content.
 *
 * All workspaces outside Command retain their original
 * maximum width, spacing and overall presentation.
 */

const STANDARD_DESKTOP_CONTENT = `
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
`;

/**
 * Command workspace content.
 *
 * No maximum width.
 * No outer padding.
 *
 * The Overview component controls its own internal spacing,
 * while its wallpaper can cover the entire available area.
 */

const COMMAND_DESKTOP_CONTENT = `
  relative

  flex
  min-h-full
  w-full
  min-w-0

  flex-col

  p-0
`;

/**
 * Standard mobile content.
 */

const STANDARD_MOBILE_CONTENT = `
  mx-auto
  w-full
  max-w-[1800px]

  px-4
  pb-12
  pt-5

  sm:px-5
  sm:pb-14
  sm:pt-6
`;

/**
 * Command mobile content.
 *
 * No external padding or maximum-width restriction.
 */

const COMMAND_MOBILE_CONTENT = `
  relative

  flex
  min-h-full
  w-full
  min-w-0

  flex-col

  p-0
`;

/* ============================================================================
   COMPONENT
============================================================================ */

export default function AdminShell({
  admin,
  activeTab,
  setActiveTab,
  tabDefinitions,
  sections,
  isFullAccess = true,
  navigationDirection,
  children,
}: AdminShellProps) {
  /* --------------------------------------------------------------------------
     MOBILE NAVIGATION
  -------------------------------------------------------------------------- */

  const [
    mobileNavigationOpen,
    setMobileNavigationOpen,
  ] = useState(false);

  /* --------------------------------------------------------------------------
     CONTENT TRANSITIONS
  -------------------------------------------------------------------------- */

  const [
    contentTransition,
    setContentTransition,
  ] = useState<ContentTransitionState>({
    phase: "idle",
    direction: "none",
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
      ReturnType<typeof setTimeout> | null
    >(null);

  /* --------------------------------------------------------------------------
     NAVIGATION
  -------------------------------------------------------------------------- */

  // A restricted employee's Overview (see AdminHome.tsx/OverviewTab.tsx)
  // is never a member of her filtered sections/tabDefinitions — it's
  // always available to her independent of any grant — so neither
  // lookup below would ever find it for her, even though it's a
  // perfectly valid, intentional activeTab. Fail safe here instead of
  // falling through to the "could not be loaded" screen: synthesize the
  // same definition a full-access caller already sees for this tab.
  const activeDefinition =
    tabDefinitions[activeTab] ??
    sections
      .flatMap((section) => section.items)
      .find((item) => item.tab === activeTab) ??
    (activeTab === COMMAND_HOME_TAB
      ? ADMIN_TABS[COMMAND_HOME_TAB]
      : undefined);

  const activeSection =
    useMemo(() => {
      return (
        sections.find(
          (section) =>
            section.items.some(
              (item) =>
                item.tab === activeTab,
            ),
        ) ??
        sections[0] ??
        // Empty sections too (an employee with zero grants besides her
        // automatic Overview) — a minimal, inert section rather than
        // undefined, so the header/sidebar render instead of crashing.
        {
          id: "command",
          label: "Command",
          description: "",
          icon: ADMIN_TABS[COMMAND_HOME_TAB].icon,
          items:
            activeTab === COMMAND_HOME_TAB
              ? [ADMIN_TABS[COMMAND_HOME_TAB]]
              : [],
        }
      );
    }, [
      activeTab,
      sections,
    ]);

  /* --------------------------------------------------------------------------
     COMMAND LAYOUT
  -------------------------------------------------------------------------- */

  /**
   * Command has a dedicated layout.
   *
   * This applies to:
   * - Overview
   * - Analytics
   * - Activity
   * - Calendar
   * - Notifications
   *
   * All five use the same available workspace.
   *
   * Only Overview is the main screen.
   * The remaining four are expanded modules.
   */

  // Every account gets the same maximised Command layout for Overview
  // and its expandable modules — see AdminHome.tsx's isCommandWorkspace.
  const isCommandWorkspace =
    shouldUseCommandLayout(activeTab);

  const isCommandHome =
    activeTab === COMMAND_HOME_TAB;

  /* --------------------------------------------------------------------------
     VISIBLE NAVIGATION
  -------------------------------------------------------------------------- */

  /**
   * Command:
   *   No secondary navigation.
   *
   * Other workspaces:
   *   Preserve their configured tab navigation.
   */

  const showMobileTabBar =
    shouldShowSectionTabBar(
      activeSection,
      isFullAccess,
    );

  const visibleMobileTabs =
    useMemo(
      () =>
        getVisibleSectionTabs(
          activeSection,
          isFullAccess,
        ),
      [activeSection, isFullAccess],
    );

  /* --------------------------------------------------------------------------
     CONTENT CLASSES
  -------------------------------------------------------------------------- */

  const desktopContentClass =
    isCommandWorkspace
      ? COMMAND_DESKTOP_CONTENT
      : STANDARD_DESKTOP_CONTENT;

  const mobileContentClass =
    isCommandWorkspace
      ? COMMAND_MOBILE_CONTENT
      : STANDARD_MOBILE_CONTENT;

  /* --------------------------------------------------------------------------
     SELECT TAB
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

  /* --------------------------------------------------------------------------
     SELECT WORKSPACE SECTION
  -------------------------------------------------------------------------- */

  const selectSection =
    useCallback(
      (
        section: AdminSection,
      ) => {
        /**
         * Command is special.
         *
         * Clicking Command always opens the main Overview.
         *
         * If Analytics, Activity, Calendar or Notifications
         * is currently expanded, clicking Command closes
         * that module and returns to Overview.
         */

        if (
          isCommandSection(section)
        ) {
          if (
            activeTab !==
            COMMAND_HOME_TAB
          ) {
            setActiveTab(
              COMMAND_HOME_TAB,
            );
          }

          setMobileNavigationOpen(
            false,
          );

          return;
        }

        /**
         * For every other section, preserve the existing
         * behaviour.
         *
         * Clicking an already-active workspace does not
         * reset its currently selected tab.
         */

        if (
          activeSection.id ===
          section.id
        ) {
          setMobileNavigationOpen(
            false,
          );

          return;
        }

        const landingTab =
          getSectionLandingTab(
            section,
            isFullAccess,
          );

        setActiveTab(
          landingTab,
        );

        setMobileNavigationOpen(
          false,
        );
      },
      [
        activeSection.id,
        activeTab,
        setActiveTab,
        isFullAccess,
      ],
    );

  /* --------------------------------------------------------------------------
     CONTENT TRANSITION

     The shell remains mounted.

     We do not use:
       key={activeTab}

     We do not remount the entire workspace.

     Standard workspaces continue using directional
     content transitions.

     Command's internal module expansion does not use
     horizontal page transitions.
  -------------------------------------------------------------------------- */

  useEffect(() => {
    const previousTab =
      previousTabRef.current;

    if (
      previousTab === activeTab
    ) {
      return;
    }

    previousTabRef.current =
      activeTab;

    /* ------------------------------------------------------------------------
       CANCEL PREVIOUS TRANSITION
    ------------------------------------------------------------------------ */

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

    /* ------------------------------------------------------------------------
       REDUCED MOTION
    ------------------------------------------------------------------------ */

    const reduceMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

    if (
      reduceMotion ||
      navigationDirection === "none"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContentTransition({
        phase: "idle",
        direction: "none",
      });

      return;
    }

    /* ------------------------------------------------------------------------
       PREPARE
    ------------------------------------------------------------------------ */

    setContentTransition({
      phase: "prepare",
      direction:
        navigationDirection,
    });

    /* ------------------------------------------------------------------------
       ENTER
    ------------------------------------------------------------------------ */

    transitionFrameRef.current =
      requestAnimationFrame(() => {
        transitionFrameRef.current =
          requestAnimationFrame(() => {
            setContentTransition({
              phase: "enter",
              direction:
                navigationDirection,
            });

            transitionFrameRef.current =
              null;
          });
      });

    /* ------------------------------------------------------------------------
       FINISH
    ------------------------------------------------------------------------ */

    transitionTimerRef.current =
      setTimeout(() => {
        setContentTransition({
          phase: "idle",
          direction: "none",
        });

        transitionTimerRef.current =
          null;
      }, CONTENT_TRANSITION_CLEANUP);

    /* ------------------------------------------------------------------------
       CLEANUP
    ------------------------------------------------------------------------ */

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
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape"
      ) {
        setMobileNavigationOpen(
          false,
        );
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    mobileNavigationOpen,
  ]);

  /* --------------------------------------------------------------------------
     TRANSITION CLASS
  -------------------------------------------------------------------------- */

  const contentTransitionClass =
    useMemo(() => {
      if (
        contentTransition.phase ===
        "idle"
      ) {
        return [
          "translate-x-0",
          "opacity-100",
        ].join(" ");
      }

      if (
        contentTransition.phase ===
        "prepare"
      ) {
        if (
          contentTransition.direction ===
          "forward"
        ) {
          return [
            "translate-x-[14px]",
            "opacity-0",
            "transition-none",
          ].join(" ");
        }

        if (
          contentTransition.direction ===
          "backward"
        ) {
          return [
            "-translate-x-[14px]",
            "opacity-0",
            "transition-none",
          ].join(" ");
        }
      }

      return [
        "translate-x-0",
        "opacity-100",
        "transition-[transform,opacity]",
        `duration-[${CONTENT_TRANSITION_DURATION}ms]`,
        "ease-[cubic-bezier(0.22,1,0.36,1)]",
      ].join(" ");
    }, [
      contentTransition,
    ]);

  /* --------------------------------------------------------------------------
     CONTENT WRAPPER

     Command must fill the available shell height.

     Standard workspaces retain their original sizing.
  -------------------------------------------------------------------------- */

  const contentWrapperClass =
    isCommandWorkspace
      ? `
          relative
          flex
          min-h-full
          w-full
          min-w-0
          flex-col
          overflow-x-hidden
        `
      : `
          min-w-0
          overflow-x-hidden
        `;

  const animatedContentClass =
    isCommandWorkspace
      ? `
          relative
          flex
          min-h-full
          w-full
          min-w-0
          flex-col

          transform-gpu
          will-change-[transform,opacity]

          ${contentTransitionClass}
        `
      : `
          min-w-0

          transform-gpu
          will-change-[transform,opacity]

          ${contentTransitionClass}
        `;

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
            Admin navigation could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return (
    <>
      {/* ======================================================================
          DESKTOP
      ====================================================================== */}

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
        {/* ====================================================================
            EXISTING SIDEBAR

            No changes to the sidebar component or its appearance.
        ==================================================================== */}

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

        {/* ====================================================================
            MAIN WORKSPACE
        ==================================================================== */}

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
          {/* ==================================================================
              HEADER

              Header remains mounted across workspace navigation.

              AdminHeader will remove Command's secondary tab row
              in the next file update.

              Search, notifications, profile and workspace context
              remain available.
          ================================================================== */}

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
              activeTab={activeTab}
              onTabSelect={
                selectTab
              }
              isFullAccess={
                isFullAccess
              }
            />
          </div>

          {/* ==================================================================
              SCROLL AREA

              Command:
                Full available width.
                Full available height.
                No outer content spacing.
                Wallpaper can extend edge to edge.

              Other sections:
                Original standard content dimensions.
          ================================================================== */}

          <div
            id="admin-shell-scroll-area"
            data-workspace={
              activeSection.id
            }
            data-command={
              isCommandWorkspace
                ? "true"
                : "false"
            }
            data-command-home={
              isCommandHome
                ? "true"
                : "false"
            }
            className={`
              no-scrollbar

              relative

              min-h-0
              flex-1

              overflow-x-hidden
              overflow-y-auto

              overscroll-contain

              ${
                isCommandWorkspace
                  ? "bg-transparent"
                  : "bg-[var(--shell)]"
              }
            `}
          >
            {/* ================================================================
                CONTENT CONTAINER
            ================================================================ */}

            <div
              className={
                desktopContentClass
              }
            >
              {/* ==============================================================
                  STABLE CONTENT WRAPPER
              ============================================================== */}

              <div
                className={
                  contentWrapperClass
                }
              >
                {/* ============================================================
                    ANIMATED CONTENT

                    No key={activeTab}.

                    No forced remount.

                    The children naturally change when AdminHome changes
                    the selected workspace.

                    Command's expanded modules use their own animation.
                ============================================================ */}

                <div
                  className={
                    animatedContentClass
                  }
                >
                  {children}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ======================================================================
          MOBILE
      ====================================================================== */}

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
        {/* ====================================================================
            MOBILE WORKSPACE SHELL
        ==================================================================== */}

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
          {/* ==================================================================
              MOBILE HEADER
          ================================================================== */}

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
            {/* ================================================================
                PRIMARY MOBILE HEADER
            ================================================================ */}

            <div
              className={`
                flex
                items-center
                gap-3

                px-4

                sm:px-5

                ${
                  isCommandWorkspace
                    ? "h-[58px]"
                    : "h-[66px]"
                }
              `}
            >
              {/* ==============================================================
                  MENU BUTTON
              ============================================================== */}

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

              {/* ==============================================================
                  WORKSPACE LABEL

                  Command:
                    Display Command only.

                  Other workspaces:
                    Display section and active tab.
              ============================================================== */}

              <div
                className="
                  min-w-0
                  flex-1
                "
              >
                {isCommandWorkspace ? (
                  <>
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
                      Syntra Grid
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
                      Command
                    </p>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              {/* ==============================================================
                  PROFILE AVATAR
              ============================================================== */}

              <MobileAvatar
                name={
                  admin.fullName
                }
              />
            </div>

            {/* ================================================================
                MOBILE WORKSPACE TABS

                Command:
                  Hidden completely.

                Every other section:
                  Original tab behaviour.
            ================================================================ */}

            {showMobileTabBar && (
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
                {visibleMobileTabs.map(
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
                        aria-current={
                          selected
                            ? "page"
                            : undefined
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
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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

          {/* ==================================================================
              MOBILE CONTENT

              Command has no outer padding.

              The wallpaper and widgets can occupy the full width
              below the compact header.
          ================================================================== */}

          <div
            data-workspace={
              activeSection.id
            }
            data-command={
              isCommandWorkspace
                ? "true"
                : "false"
            }
            className={`
              no-scrollbar

              relative

              min-h-0
              flex-1

              overflow-x-hidden
              overflow-y-auto

              ${
                isCommandWorkspace
                  ? "bg-transparent"
                  : "bg-[var(--shell)]"
              }
            `}
          >
            {/* ================================================================
                MOBILE CONTENT CONTAINER
            ================================================================ */}

            <div
              className={
                mobileContentClass
              }
            >
              <div
                className={
                  contentWrapperClass
                }
              >
                <div
                  className={
                    animatedContentClass
                  }
                >
                  {children}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ======================================================================
          MOBILE NAVIGATION DRAWER
      ====================================================================== */}

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
          aria-label="Workspace navigation"
        >
          {/* ==================================================================
              BACKDROP
          ================================================================== */}

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

          {/* ==================================================================
              DRAWER
          ================================================================== */}

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
            {/* ================================================================
                DRAWER HEADER
            ================================================================ */}

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

            {/* ================================================================
                DRAWER NAVIGATION
            ================================================================ */}

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

                    const commandSection =
                      isCommandSection(
                        section,
                      );

                    const showSubNavigation =
                      selected &&
                      (!commandSection ||
                        !isFullAccess) &&
                      shouldShowSectionTabBar(
                        section,
                        isFullAccess,
                      );

                    const sectionTabs =
                      getVisibleSectionTabs(
                        section,
                        isFullAccess,
                      );

                    return (
                      <div
                        key={
                          section.id
                        }
                      >
                        {/* ====================================================
                            WORKSPACE BUTTON
                        ==================================================== */}

                        <button
                          type="button"
                          onClick={() =>
                            selectSection(
                              section,
                            )
                          }
                          aria-current={
                            selected
                              ? "page"
                              : undefined
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
                                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
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
                                    ? "text-white/60"
                                    : "text-[var(--text-subtle)]"
                                }
                              `}
                            >
                              {
                                section.description
                              }
                            </span>
                          </span>
                        </button>

                        {/* ====================================================
                            SUB-NAVIGATION

                            Command:
                              Never displayed.

                            Other workspaces:
                              Display normally when selected.
                        ==================================================== */}

                        {showSubNavigation && (
                          <div
                            className="
                              ml-6

                              border-l
                              border-[var(--line)]

                              py-1
                              pl-4
                            "
                          >
                            {sectionTabs.map(
                              (item) => (
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
                                  aria-current={
                                    item.tab ===
                                    activeTab
                                      ? "page"
                                      : undefined
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
                                        ? "bg-[var(--surface-muted)] text-[var(--text)]"
                                        : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
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

            {/* ================================================================
                DRAWER FOOTER
            ================================================================ */}

            <div
              className="
                shrink-0

                border-t
                border-[var(--line)]

                px-4
                py-3
              "
            >
              <div className="flex items-center gap-3">
                <MobileAvatar
                  name={
                    admin.fullName
                  }
                />

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
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

/* ============================================================================
   MOBILE AVATAR
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

        shrink-0

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

/* ============================================================================
   SYNTRA MARK
============================================================================ */

function SyntraMark() {
  return (
    <div
      className="
        flex

        h-10
        w-10

        shrink-0

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
    .join("");
}