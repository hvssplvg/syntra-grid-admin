'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import {
  Bell,
  Building2,
  CheckSquare2,
  ChevronRight,
  CircleDollarSign,
  Command,
  Headphones,
  HelpCircle,
  LogOut,
  Moon,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';

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

type AdminSidebarProps = {
  admin: AdminUser;
  sections: AdminSection[];
  activeSection: AdminSection;
  activeTab: AdminTab;

  onSectionSelect: (
    section: AdminSection,
  ) => void;

  onTabSelect: (
    tab: AdminTab,
  ) => void;
};

type SectionMeta = {
  icon: LucideIcon;
  shortLabel: string;
};

type TooltipState = {
  id: string;
  label: string;
  description?: string;
  top: number;
  left: number;
} | null;

type TooltipTarget = {
  getBoundingClientRect: () => DOMRect;
};

type IndicatorPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
  ready: boolean;
};

/* ============================================================================
   SECTION META
============================================================================ */

const SECTION_META: Record<
  string,
  SectionMeta
> = {
  Command: {
    icon: Command,
    shortLabel: 'Command',
  },

  CRM: {
    icon: Building2,
    shortLabel: 'CRM',
  },

  Delivery: {
    icon: CheckSquare2,
    shortLabel: 'Delivery',
  },

  Commercial: {
    icon: CircleDollarSign,
    shortLabel: 'Commercial',
  },

  'Client Success': {
    icon: Headphones,
    shortLabel: 'Client Success',
  },

  Engineering: {
    icon: Wrench,
    shortLabel: 'Engineering',
  },

  Products: {
    icon: Package,
    shortLabel: 'Products',
  },

  Growth: {
    icon: Search,
    shortLabel: 'Growth',
  },

  Company: {
    icon: Users,
    shortLabel: 'Company',
  },

  Knowledge: {
    icon: HelpCircle,
    shortLabel: 'Knowledge',
  },

  Governance: {
    icon: ShieldCheck,
    shortLabel: 'Governance',
  },

  System: {
    icon: Settings,
    shortLabel: 'System',
  },
};

/* ============================================================================
   GROUP ORDER
============================================================================ */

const BUSINESS_SECTIONS = [
  'Command',
  'CRM',
  'Delivery',
  'Commercial',
  'Client Success',
] as const;

const PLATFORM_SECTIONS = [
  'Engineering',
  'Products',
  'Growth',
] as const;

const ORGANISATION_SECTIONS = [
  'Company',
  'Knowledge',
  'Governance',
] as const;

/* ============================================================================
   SHARED STYLES
============================================================================ */

const NAV_SURFACE = `
  relative

  flex
  w-[46px]
  shrink-0
  flex-col
  items-center

  rounded-[23px]

  border
  border-[var(--line)]

  bg-[var(--shell-translucent)]

  px-[5px]
  py-[6px]

  shadow-[var(--shadow-card)]

  backdrop-blur-xl

  min-[900px]:w-[48px]
`;

const UTILITY_SURFACE = `
  flex
  w-[46px]
  shrink-0
  flex-col
  items-center

  rounded-[23px]

  border
  border-[var(--line)]

  bg-[var(--shell-translucent)]

  px-[5px]
  py-[6px]

  shadow-[var(--shadow-card)]

  backdrop-blur-xl

  min-[900px]:w-[48px]
`;

const SLOT = `
  relative

  flex
  h-[31px]
  w-[31px]
  shrink-0

  items-center
  justify-center

  rounded-full

  transition-[color,transform]
  duration-150

  min-[900px]:h-[33px]
  min-[900px]:w-[33px]

  min-[1050px]:h-[35px]
  min-[1050px]:w-[35px]

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-[var(--primary)]
  focus-visible:ring-offset-1
  focus-visible:ring-offset-[var(--canvas)]
`;

const IDLE_SLOT = `
  text-[var(--text-muted)]

  hover:text-[var(--text)]
`;

const ACTIVE_SLOT = `
  text-[var(--primary-foreground)]
`;

/* ============================================================================
   COMPONENT
============================================================================ */

export default function AdminSidebar({
  admin: _admin,
  sections,
  activeSection,
  activeTab,
  onSectionSelect,
  onTabSelect,
}: AdminSidebarProps) {
  const {
    theme,
    setTheme,
  } = useAdminTheme();

  const [
    signingOut,
    setSigningOut,
  ] = useState(false);

  const [
    tooltip,
    setTooltip,
  ] =
    useState<TooltipState>(
      null,
    );

  /* --------------------------------------------------------------------------
     NAVIGATION INDICATOR

     There is only ONE active background in the entire workspace rail.

     Each workspace button registers itself below. Whenever activeSection
     changes we measure the selected button and move this one indicator to it.
  -------------------------------------------------------------------------- */

  const navRef =
    useRef<HTMLElement | null>(
      null,
    );

  const buttonRefs =
    useRef<
      Map<
        string,
        HTMLButtonElement
      >
    >(new Map());

  const [
    indicator,
    setIndicator,
  ] =
    useState<IndicatorPosition>({
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      ready: false,
    });

  const registerButton =
    useCallback(
      (
        sectionId: string,
        node:
          | HTMLButtonElement
          | null,
      ) => {
        if (node) {
          buttonRefs.current.set(
            sectionId,
            node,
          );

          return;
        }

        buttonRefs.current.delete(
          sectionId,
        );
      },
      [],
    );

  const updateIndicator =
    useCallback(() => {
      const nav =
        navRef.current;

      const button =
        buttonRefs.current.get(
          activeSection.id,
        );

      if (
        !nav ||
        !button
      ) {
        return;
      }

      const navRect =
        nav.getBoundingClientRect();

      const buttonRect =
        button.getBoundingClientRect();

      setIndicator({
        top:
          buttonRect.top -
          navRect.top,
        left:
          buttonRect.left -
          navRect.left,
        width:
          buttonRect.width,
        height:
          buttonRect.height,
        ready: true,
      });
    }, [
      activeSection.id,
    ]);

  /*
   * useLayoutEffect is intentional here.
   *
   * The indicator gets its initial position before the browser paints,
   * avoiding the active background briefly appearing at 0,0.
   */
  useLayoutEffect(() => {
    updateIndicator();
  }, [
    updateIndicator,
    sections,
  ]);

  /*
   * Re-measure when the viewport changes because SLOT grows slightly at
   * different viewport breakpoints.
   */
  useEffect(() => {
    const handleResize =
      () => {
        updateIndicator();
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
    updateIndicator,
  ]);

  /* --------------------------------------------------------------------------
     WORKSPACE GROUPS
  -------------------------------------------------------------------------- */

  const businessSections =
    useMemo(
      () =>
        sections.filter(
          (section) =>
            BUSINESS_SECTIONS.includes(
              section.label as
                (typeof BUSINESS_SECTIONS)[number],
            ),
        ),
      [sections],
    );

  const platformSections =
    useMemo(
      () =>
        sections.filter(
          (section) =>
            PLATFORM_SECTIONS.includes(
              section.label as
                (typeof PLATFORM_SECTIONS)[number],
            ),
        ),
      [sections],
    );

  const organisationSections =
    useMemo(
      () =>
        sections.filter(
          (section) =>
            ORGANISATION_SECTIONS.includes(
              section.label as
                (typeof ORGANISATION_SECTIONS)[number],
            ),
        ),
      [sections],
    );

  const systemSection =
    useMemo(
      () =>
        sections.find(
          (section) =>
            section.label ===
            'System',
        ) ?? null,
      [sections],
    );

  const commandSection =
    useMemo(
      () =>
        sections.find(
          (section) =>
            section.label ===
            'Command',
        ) ?? null,
      [sections],
    );

  /* --------------------------------------------------------------------------
     TOOLTIP
  -------------------------------------------------------------------------- */

  const showTooltip =
    useCallback(
      (
        target: TooltipTarget,
        id: string,
        label: string,
        description?: string,
      ) => {
        const rect =
          target.getBoundingClientRect();

        setTooltip({
          id,
          label,
          description,

          top:
            rect.top +
            rect.height / 2,

          left:
            rect.right + 11,
        });
      },
      [],
    );

  const hideTooltip =
    useCallback(() => {
      setTooltip(null);
    }, []);

  /* --------------------------------------------------------------------------
     THEME
  -------------------------------------------------------------------------- */

  const toggleTheme =
    useCallback(() => {
      setTheme(
        theme === 'light'
          ? 'dark'
          : 'light',
      );
    }, [
      setTheme,
      theme,
    ]);

  const ThemeIcon =
    theme === 'light'
      ? Moon
      : Sun;

  const themeLabel =
    theme === 'light'
      ? 'Dark mode'
      : 'Light mode';

  /* --------------------------------------------------------------------------
     HELP
  -------------------------------------------------------------------------- */

  const openHelp =
    useCallback(() => {
      const clientSuccess =
        sections.find(
          (section) =>
            section.label ===
            'Client Success',
        );

      const support =
        clientSuccess?.items.find(
          (item) =>
            item.tab ===
            'support',
        );

      if (support) {
        onTabSelect(
          support.tab,
        );

        return;
      }

      if (clientSuccess) {
        onSectionSelect(
          clientSuccess,
        );
      }
    }, [
      onSectionSelect,
      onTabSelect,
      sections,
    ]);

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
        const response =
          await fetch(
            '/api/auth/signout',
            {
              method: 'POST',
            },
          );

        if (!response.ok) {
          console.warn(
            'Sign-out endpoint returned',
            response.status,
          );
        }
      } catch (error) {
        console.error(
          'Could not sign out:',
          error,
        );
      } finally {
        window.location.assign(
          '/login',
        );
      }
    }, [
      signingOut,
    ]);

  /* --------------------------------------------------------------------------
     INDICATOR STYLE
  -------------------------------------------------------------------------- */

  const indicatorStyle =
    useMemo<CSSProperties>(
      () => ({
        width:
          indicator.width,

        height:
          indicator.height,

        transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,

        opacity:
          indicator.ready
            ? 1
            : 0,
      }),
      [indicator],
    );

  /* --------------------------------------------------------------------------
     RENDER
  -------------------------------------------------------------------------- */

  return (
    <>
      <aside
        className="
          relative
          z-40

          flex
          h-full
          w-[54px]
          shrink-0
          flex-col
          items-center

          overflow-visible

          py-0.5
        "
        aria-label="Syntra Grid workspaces"
      >
        {/* ==================================================================
            BRAND
        ================================================================== */}

        <BrandButton
          active={
            activeSection.label ===
            'Command'
          }
          onClick={() => {
            if (
              commandSection
            ) {
              onSectionSelect(
                commandSection,
              );
            }
          }}
          onShowTooltip={
            showTooltip
          }
          onHideTooltip={
            hideTooltip
          }
        />

        {/* ==================================================================
            PRIMARY NAVIGATION
        ================================================================== */}

        <div
          className="
            flex
            min-h-0
            flex-1
            items-center
            justify-center

            py-1.5
          "
        >
          <nav
            ref={navRef}
            className={
              NAV_SURFACE
            }
            aria-label="Company workspaces"
          >
            {/* --------------------------------------------------------------
                ONE PERSISTENT ACTIVE INDICATOR

                It stays mounted and moves around the rail.
            -------------------------------------------------------------- */}

            <span
              aria-hidden="true"
              style={
                indicatorStyle
              }
              className="
                pointer-events-none
                absolute
                left-0
                top-0
                z-0

                rounded-full

                bg-[var(--primary)]

                shadow-[0_5px_14px_rgba(0,0,0,0.12)]

                transition-[transform,width,height,opacity]
                duration-[320ms]

                ease-[cubic-bezier(0.22,1,0.36,1)]

                motion-reduce:transition-none
              "
            >
              {/* Accent dot travels with the indicator */}

              <span
                className="
                  absolute
                  -right-[3px]
                  top-1/2

                  h-[5px]
                  w-[5px]

                  -translate-y-1/2

                  rounded-full

                  bg-[var(--accent)]

                  shadow-[0_0_0_2px_var(--canvas)]
                "
              />
            </span>

            {/* --------------------------------------------------------------
                BUSINESS
            -------------------------------------------------------------- */}

            <WorkspaceGroup
              sections={
                businessSections
              }
              activeSection={
                activeSection
              }
              onSelect={
                onSectionSelect
              }
              onShowTooltip={
                showTooltip
              }
              onHideTooltip={
                hideTooltip
              }
              registerButton={
                registerButton
              }
            />

            <RailDivider />

            {/* --------------------------------------------------------------
                PLATFORM
            -------------------------------------------------------------- */}

            <WorkspaceGroup
              sections={
                platformSections
              }
              activeSection={
                activeSection
              }
              onSelect={
                onSectionSelect
              }
              onShowTooltip={
                showTooltip
              }
              onHideTooltip={
                hideTooltip
              }
              registerButton={
                registerButton
              }
            />

            <RailDivider />

            {/* --------------------------------------------------------------
                ORGANISATION
            -------------------------------------------------------------- */}

            <WorkspaceGroup
              sections={
                organisationSections
              }
              activeSection={
                activeSection
              }
              onSelect={
                onSectionSelect
              }
              onShowTooltip={
                showTooltip
              }
              onHideTooltip={
                hideTooltip
              }
              registerButton={
                registerButton
              }
            />

            {/* --------------------------------------------------------------
                SYSTEM
            -------------------------------------------------------------- */}

            {systemSection && (
              <>
                <RailDivider />

                <WorkspaceButton
                  section={
                    systemSection
                  }
                  active={
                    activeSection.id ===
                    systemSection.id
                  }
                  onSelect={
                    onSectionSelect
                  }
                  onShowTooltip={
                    showTooltip
                  }
                  onHideTooltip={
                    hideTooltip
                  }
                  registerButton={
                    registerButton
                  }
                />
              </>
            )}
          </nav>
        </div>

        {/* ==================================================================
            UTILITIES

            Profile/account has deliberately been removed.

            Account controls live in AdminHeader only.
        ================================================================== */}

        <div
          className="
            shrink-0
            pb-0.5
          "
        >
          <div
            className={
              UTILITY_SURFACE
            }
          >
            <RailAction
              id="theme"
              label={
                themeLabel
              }
              description={`Currently using ${theme} mode`}
              icon={
                ThemeIcon
              }
              onClick={
                toggleTheme
              }
              onShowTooltip={
                showTooltip
              }
              onHideTooltip={
                hideTooltip
              }
            />

            <RailAction
              id="notifications"
              label="Notifications"
              description="Company alerts and notifications"
              icon={Bell}
              active={
                activeTab ===
                'notifications'
              }
              onClick={() =>
                onTabSelect(
                  'notifications',
                )
              }
              onShowTooltip={
                showTooltip
              }
              onHideTooltip={
                hideTooltip
              }
            />

            <RailAction
              id="help"
              label="Help"
              description="Open support"
              icon={
                HelpCircle
              }
              onClick={
                openHelp
              }
              onShowTooltip={
                showTooltip
              }
              onHideTooltip={
                hideTooltip
              }
            />

            <RailDivider
              compact
            />

            <RailAction
              id="logout"
              label={
                signingOut
                  ? 'Signing out…'
                  : 'Sign out'
              }
              description="End your session"
              icon={
                LogOut
              }
              disabled={
                signingOut
              }
              onClick={() =>
                void signOut()
              }
              onShowTooltip={
                showTooltip
              }
              onHideTooltip={
                hideTooltip
              }
            />
          </div>
        </div>
      </aside>

      {/* ==================================================================
          TOOLTIP
      ================================================================== */}

      {tooltip && (
        <RailTooltip
          tooltip={
            tooltip
          }
        />
      )}
    </>
  );
}

/* ============================================================================
   BRAND
============================================================================ */

function BrandButton({
  active,
  onClick,
  onShowTooltip,
  onHideTooltip,
}: {
  active: boolean;

  onClick: () => void;

  onShowTooltip: (
    target: TooltipTarget,
    id: string,
    label: string,
    description?: string,
  ) => void;

  onHideTooltip: () => void;
}) {
  const show = (
    target: TooltipTarget,
  ) => {
    onShowTooltip(
      target,
      'brand',
      'Syntra Grid',
      'Company operating console',
    );
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(
        event,
      ) =>
        show(
          event.currentTarget,
        )
      }
      onMouseLeave={
        onHideTooltip
      }
      onFocus={(
        event,
      ) =>
        show(
          event.currentTarget,
        )
      }
      onBlur={
        onHideTooltip
      }
      aria-label="Syntra Grid overview"
      className="
        group
        relative

        flex
        h-[44px]
        w-[44px]
        shrink-0
        items-center
        justify-center

        overflow-hidden

        rounded-[16px]

        border
        border-[var(--line)]

        bg-[var(--shell-translucent)]

        shadow-[var(--shadow-card)]

        backdrop-blur-xl

        transition
        duration-200

        hover:-translate-y-px

        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-[var(--primary)]
        focus-visible:ring-offset-2
        focus-visible:ring-offset-[var(--canvas)]
      "
    >
<span
  className="
    relative
    z-10

    flex
    h-[34px]
    w-[34px]
    items-center
    justify-center

    overflow-hidden
    rounded-[12px]
  "
>
  <Image
    src="/images/syntra-logo.png"
    alt="Syntra Grid"
    width={34}
    height={34}
    priority
    className="
      h-full
      w-full
      object-contain
    "
  />
</span>

      <span
        aria-hidden="true"
        className="
          absolute
          -right-1
          -top-1

          h-4
          w-4

          rounded-full

          bg-[var(--accent)]

          opacity-60
          blur-[6px]
        "
      />
    </button>
  );
}

/* ============================================================================
   WORKSPACE GROUP
============================================================================ */

function WorkspaceGroup({
  sections,
  activeSection,
  onSelect,
  onShowTooltip,
  onHideTooltip,
  registerButton,
}: {
  sections: AdminSection[];

  activeSection:
    AdminSection;

  onSelect: (
    section: AdminSection,
  ) => void;

  onShowTooltip: (
    target: TooltipTarget,
    id: string,
    label: string,
    description?: string,
  ) => void;

  onHideTooltip:
    () => void;

  registerButton: (
    sectionId: string,
    node:
      | HTMLButtonElement
      | null,
  ) => void;
}) {
  return (
    <div
      className="
        relative
        z-10

        flex
        flex-col
        items-center

        gap-[1px]
      "
    >
      {sections.map(
        (section) => (
          <WorkspaceButton
            key={
              section.id
            }
            section={
              section
            }
            active={
              activeSection.id ===
              section.id
            }
            onSelect={
              onSelect
            }
            onShowTooltip={
              onShowTooltip
            }
            onHideTooltip={
              onHideTooltip
            }
            registerButton={
              registerButton
            }
          />
        ),
      )}
    </div>
  );
}

/* ============================================================================
   WORKSPACE BUTTON
============================================================================ */

function WorkspaceButton({
  section,
  active,
  onSelect,
  onShowTooltip,
  onHideTooltip,
  registerButton,
}: {
  section: AdminSection;

  active: boolean;

  onSelect: (
    section: AdminSection,
  ) => void;

  onShowTooltip: (
    target: TooltipTarget,
    id: string,
    label: string,
    description?: string,
  ) => void;

  onHideTooltip:
    () => void;

  registerButton: (
    sectionId: string,
    node:
      | HTMLButtonElement
      | null,
  ) => void;
}) {
  const meta =
    SECTION_META[
      section.label
    ];

  const Icon =
    meta?.icon ??
    section.icon;

  const label =
    meta?.shortLabel ??
    section.label;

  const show = (
    target: TooltipTarget,
  ) => {
    onShowTooltip(
      target,
      section.id,
      label,
      section.description,
    );
  };

  return (
    <button
      ref={(node) => {
        registerButton(
          section.id,
          node,
        );
      }}
      type="button"
      aria-label={label}
      aria-current={
        active
          ? 'page'
          : undefined
      }
      onClick={() =>
        onSelect(
          section,
        )
      }
      onMouseEnter={(
        event,
      ) =>
        show(
          event.currentTarget,
        )
      }
      onMouseLeave={
        onHideTooltip
      }
      onFocus={(
        event,
      ) =>
        show(
          event.currentTarget,
        )
      }
      onBlur={
        onHideTooltip
      }
      className={`
        ${SLOT}

        z-10

        ${
          active
            ? ACTIVE_SLOT
            : IDLE_SLOT
        }
      `}
    >
      {/* ---------------------------------------------------------------
          Idle hover surface.

          The active background itself is NOT rendered here anymore.
          That belongs to the single moving indicator in the parent nav.
      --------------------------------------------------------------- */}

      {!active && (
        <span
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            inset-0
            -z-[1]

            rounded-full

            bg-transparent

            transition-colors
            duration-150

            group-hover:bg-[var(--surface-muted)]
          "
        />
      )}

      <Icon
        size={15}
        strokeWidth={
          active
            ? 2.1
            : 1.75
        }
        className="
          relative
          z-10

          transition-[color,transform]
          duration-200

          min-[1050px]:h-4
          min-[1050px]:w-4
        "
      />
    </button>
  );
}

/* ============================================================================
   DIVIDER
============================================================================ */

function RailDivider({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`
        relative
        z-10

        mx-auto

        w-[18px]
        shrink-0

        border-t
        border-[var(--line)]

        ${
          compact
            ? 'my-[3px]'
            : 'my-[4px]'
        }
      `}
    />
  );
}

/* ============================================================================
   ACTION
============================================================================ */

function RailAction({
  id,
  label,
  description,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
  onShowTooltip,
  onHideTooltip,
}: {
  id: string;

  label: string;

  description?: string;

  icon: LucideIcon;

  active?: boolean;

  disabled?: boolean;

  onClick: () => void;

  onShowTooltip: (
    target: TooltipTarget,
    id: string,
    label: string,
    description?: string,
  ) => void;

  onHideTooltip:
    () => void;
}) {
  const show = (
    target: TooltipTarget,
  ) => {
    onShowTooltip(
      target,
      id,
      label,
      description,
    );
  };

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={
        active ||
        undefined
      }
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      onMouseEnter={(
        event,
      ) =>
        show(
          event.currentTarget,
        )
      }
      onMouseLeave={
        onHideTooltip
      }
      onFocus={(
        event,
      ) =>
        show(
          event.currentTarget,
        )
      }
      onBlur={
        onHideTooltip
      }
      className={`
        ${SLOT}

        ${
          active
            ? ACTIVE_SLOT
            : IDLE_SLOT
        }

        ${
          !active
            ? 'hover:bg-[var(--surface-muted)]'
            : ''
        }

        disabled:pointer-events-none
        disabled:opacity-35
      `}
    >
      {active && (
        <span
          aria-hidden="true"
          className="
            absolute
            inset-0

            rounded-full

            bg-[var(--primary)]

            shadow-[0_5px_14px_rgba(0,0,0,0.12)]
          "
        />
      )}

      <Icon
        size={15}
        strokeWidth={
          active
            ? 2.1
            : 1.75
        }
        className="
          relative
          z-10

          min-[1050px]:h-4
          min-[1050px]:w-4
        "
      />
    </button>
  );
}

/* ============================================================================
   TOOLTIP
============================================================================ */

function RailTooltip({
  tooltip,
}: {
  tooltip:
    NonNullable<TooltipState>;
}) {
  return (
    <div
      className="
        pointer-events-none
        fixed
        z-[200]

        hidden

        -translate-y-1/2

        lg:block
      "
      style={{
        top:
          tooltip.top,

        left:
          tooltip.left,
      }}
    >
      <div
        className="
          relative

          min-w-[140px]
          max-w-[230px]

          rounded-[13px]

          border
          border-[var(--line)]

          bg-[var(--tooltip-bg)]

          px-3
          py-2.5

          shadow-[var(--shadow-popover)]

          backdrop-blur-xl
        "
      >
        <span
          aria-hidden="true"
          className="
            absolute
            -left-1
            top-1/2

            h-2
            w-2

            -translate-y-1/2
            rotate-45

            border-b
            border-l
            border-[var(--line)]

            bg-[var(--tooltip-bg)]
          "
        />

        <p
          className="
            relative

            text-[11px]
            font-semibold

            text-[var(--text)]
          "
        >
          {
            tooltip.label
          }
        </p>

        {tooltip.description && (
          <p
            className="
              relative

              mt-1

              text-[9px]
              leading-[15px]

              text-[var(--text-muted)]
            "
          >
            {
              tooltip.description
            }
          </p>
        )}

        <div
          className="
            relative

            mt-2

            flex
            items-center
            gap-1

            text-[7px]
            font-semibold
            uppercase
            tracking-[0.09em]

            text-[var(--text-subtle)]
          "
        >
          Open

          <ChevronRight
            size={9}
            strokeWidth={2}
          />
        </div>
      </div>
    </div>
  );
}