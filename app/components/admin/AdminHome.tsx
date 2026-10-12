"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";

import { useSearchParams } from "next/navigation";

import {
  ArrowLeft,
  ArrowUpRight,
  Maximize2,
  X,
} from "lucide-react";

import AdminShell from "./AdminShell";

import {
  AdminThemeProvider,
} from "./AdminThemeProvider";

import {
  ADMIN_TABS,
  ADMIN_TAB_ORDER,
  COMMAND_HOME_TAB,
  getCommandModule,
  isCommandExpandedTab,
  isCommandInternalNavigation,
  isCommandTab,
  adminTabFromSearchParam,
  filterSectionsByPermission,
  filterTabDefinitions,
  isModuleSecured,
  type AdminSection,
  type AdminTab,
  type AdminUser,
  type CommandExpandedTab,
} from "./adminNav";

/* ============================================================================
   TAB COMPONENTS

   Overview loads eagerly — it's the default landing view, so there is
   nothing to gain by deferring it. Every other tab is code-split with
   next/dynamic instead of a static import: this file used to statically
   import all ~68 tab modules, which meant the very first paint of
   /dashboard had to download, parse and compile every tab's JS —
   including multi-thousand-line ones like TeamTab and SocialMediaTab —
   before any of it was interactive, regardless of which single tab the
   person actually opened. Each tab's code now only loads the first time
   that tab is opened; TabLoadingFallback only ever appears during that
   one-time fetch, since the browser caches the module afterwards.
============================================================================ */

import dynamic from "next/dynamic";

import OverviewTab from "./tabs/OverviewTab";

function TabLoadingFallback() {
  return (
    <div className="flex min-h-[280px] w-full flex-col gap-3" aria-hidden="true">
      <div className="h-7 w-44 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
      <div className="h-28 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      <div className="h-28 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
    </div>
  );
}

const ActivityTab = dynamic(() => import("./tabs/ActivityTab"), { loading: TabLoadingFallback });
const AnalyticsTab = dynamic(() => import("./tabs/AnalyticsTab"), { loading: TabLoadingFallback });
const APIKeysTab = dynamic(() => import("./tabs/APIKeysTab"), { loading: TabLoadingFallback });
const ApprovalsTab = dynamic(() => import("./tabs/ApprovalsTab"), { loading: TabLoadingFallback });
const AuditLogsTab = dynamic(() => import("./tabs/AuditLogsTab"), { loading: TabLoadingFallback });
const AutomationsTab = dynamic(() => import("./tabs/AutomationsTab"), { loading: TabLoadingFallback });
const BackupsTab = dynamic(() => import("./tabs/BackupsTab"), { loading: TabLoadingFallback });
const BrandAssetsTab = dynamic(() => import("./tabs/BrandAssetsTab"), { loading: TabLoadingFallback });
const BugsTab = dynamic(() => import("./tabs/BugsTab"), { loading: TabLoadingFallback });
const CalendarTab = dynamic(() => import("./tabs/CalendarTab"), { loading: TabLoadingFallback });
const CampaignsTab = dynamic(() => import("./tabs/CampaignsTab"), { loading: TabLoadingFallback });
const ChangelogTab = dynamic(() => import("./tabs/ChangelogTab"), { loading: TabLoadingFallback });
const ClientHealthTab = dynamic(() => import("./tabs/ClientHealthTab"), { loading: TabLoadingFallback });
const ClientsTab = dynamic(() => import("./tabs/ClientsTab"), { loading: TabLoadingFallback });
const ComplianceTab = dynamic(() => import("./tabs/ComplianceTab"), { loading: TabLoadingFallback });
const ContactsTab = dynamic(() => import("./tabs/ContactsTab"), { loading: TabLoadingFallback });
const ContractsTab = dynamic(() => import("./tabs/ContractsTab"), { loading: TabLoadingFallback });
const DepartmentsTab = dynamic(() => import("./tabs/DepartmentsTab"), { loading: TabLoadingFallback });
const DeploymentsTab = dynamic(() => import("./tabs/DeploymentsTab"), { loading: TabLoadingFallback });
const DocumentsTab = dynamic(() => import("./tabs/DocumentsTab"), { loading: TabLoadingFallback });
const DomainsTab = dynamic(() => import("./tabs/DomainsTab"), { loading: TabLoadingFallback });
const EnvironmentsTab = dynamic(() => import("./tabs/EnvironmentsTab"), { loading: TabLoadingFallback });
const ExpensesTab = dynamic(() => import("./tabs/ExpensesTab"), { loading: TabLoadingFallback });
const FeatureRequestsTab = dynamic(() => import("./tabs/FeatureRequestsTab"), { loading: TabLoadingFallback });
const FeedbackTab = dynamic(() => import("./tabs/FeedbackTab"), { loading: TabLoadingFallback });
const FinanceTab = dynamic(() => import("./tabs/FinanceTab"), { loading: TabLoadingFallback });
const IncidentsTab = dynamic(() => import("./tabs/IncidentsTab"), { loading: TabLoadingFallback });
const IntegrationsTab = dynamic(() => import("./tabs/IntegrationsTab"), { loading: TabLoadingFallback });
const InvoicesTab = dynamic(() => import("./tabs/InvoicesTab"), { loading: TabLoadingFallback });
const KnowledgeBaseTab = dynamic(() => import("./tabs/KnowledgeBaseTab"), { loading: TabLoadingFallback });
const LeadsTab = dynamic(() => import("./tabs/LeadsTab"), { loading: TabLoadingFallback });
const LeaveTab = dynamic(() => import("./tabs/LeaveTab"), { loading: TabLoadingFallback });
const MeetingsTab = dynamic(() => import("./tabs/MeetingsTab"), { loading: TabLoadingFallback });
const MessagesTab = dynamic(() => import("./tabs/MessagesTab"), { loading: TabLoadingFallback });
const MilestonesTab = dynamic(() => import("./tabs/MilestonesTab"), { loading: TabLoadingFallback });
const MonitoringTab = dynamic(() => import("./tabs/MonitoringTab"), { loading: TabLoadingFallback });
const NotificationsTab = dynamic(() => import("./tabs/NotificationsTab"), { loading: TabLoadingFallback });
const OpportunitiesTab = dynamic(() => import("./tabs/OpportunitiesTab"), { loading: TabLoadingFallback });
const PipelineTab = dynamic(() => import("./tabs/PipelineTab"), { loading: TabLoadingFallback });
const PoliciesTab = dynamic(() => import("./tabs/PoliciesTab"), { loading: TabLoadingFallback });
const ProductPortfolioTab = dynamic(() => import("./tabs/ProductPortfolioTab"), { loading: TabLoadingFallback });
const ProjectsTab = dynamic(() => import("./tabs/ProjectsTab"), { loading: TabLoadingFallback });
const ProposalsTab = dynamic(() => import("./tabs/ProposalsTab"), { loading: TabLoadingFallback });
const QATab = dynamic(() => import("./tabs/QATab"), { loading: TabLoadingFallback });
const QuotesTab = dynamic(() => import("./tabs/QuotesTab"), { loading: TabLoadingFallback });
const RecruitmentTab = dynamic(() => import("./tabs/RecruitmentTab"), { loading: TabLoadingFallback });
const ReleasesTab = dynamic(() => import("./tabs/ReleasesTab"), { loading: TabLoadingFallback });
const RepositoriesTab = dynamic(() => import("./tabs/RepositoriesTab"), { loading: TabLoadingFallback });
const RequirementsTab = dynamic(() => import("./tabs/RequirementsTab"), { loading: TabLoadingFallback });
const ResearchTab = dynamic(() => import("./tabs/ResearchTab"), { loading: TabLoadingFallback });
const RevenueTab = dynamic(() => import("./tabs/RevenueTab"), { loading: TabLoadingFallback });
const RisksTab = dynamic(() => import("./tabs/RisksTab"), { loading: TabLoadingFallback });
const RoadmapsTab = dynamic(() => import("./tabs/RoadmapsTab"), { loading: TabLoadingFallback });
const RolesPermissionsTab = dynamic(() => import("./tabs/RolesPermissionsTab"), { loading: TabLoadingFallback });
const SecurityTab = dynamic(() => import("./tabs/SecurityTab"), { loading: TabLoadingFallback });
const SEOAnalyticsTab = dynamic(() => import("./tabs/SEOAnalyticsTab"), { loading: TabLoadingFallback });
const SettingsTab = dynamic(() => import("./tabs/SettingsTab"), { loading: TabLoadingFallback });
const SocialMediaTab = dynamic(() => import("./tabs/SocialMediaTab"), { loading: TabLoadingFallback });
const SOPsTab = dynamic(() => import("./tabs/SOPsTab"), { loading: TabLoadingFallback });
const SprintsTab = dynamic(() => import("./tabs/SprintsTab"), { loading: TabLoadingFallback });
const SubscriptionsTab = dynamic(() => import("./tabs/SubscriptionsTab"), { loading: TabLoadingFallback });
const SupportTab = dynamic(() => import("./tabs/SupportTab"), { loading: TabLoadingFallback });
const SystemsTab = dynamic(() => import("./tabs/SystemsTab"), { loading: TabLoadingFallback });
const TasksTab = dynamic(() => import("./tabs/TasksTab"), { loading: TabLoadingFallback });
const TeamTab = dynamic(() => import("./tabs/TeamTab"), { loading: TabLoadingFallback });
const TicketsTab = dynamic(() => import("./tabs/TicketsTab"), { loading: TabLoadingFallback });
const TimesheetsTab = dynamic(() => import("./tabs/TimesheetsTab"), { loading: TabLoadingFallback });
const WorkloadTab = dynamic(() => import("./tabs/WorkloadTab"), { loading: TabLoadingFallback });

/* ============================================================================
   TYPES
============================================================================ */

export type PermissionGrantData = {
  module: string;
  action: string;
  scope: string;
};

export type AdminIdentity = {
  isFullAccess: boolean;
  employeeId: string | null;
  departmentId: string | null;
  permissions: PermissionGrantData[];
};

export type AdminHomeProps = {
  admin: AdminUser;
  identity: AdminIdentity;
};

type TabComponent = ComponentType<Record<string, never>>;

export type NavigationDirection =
  | "forward"
  | "backward"
  | "none";

type CommandNavigationSource =
  | "widget"
  | "navigation"
  | "close";

type CommandWorkspaceProps = {
  admin: AdminUser;

  identity: AdminIdentity;

  activeTab: AdminTab;

  onNavigate: (tab: AdminTab) => void;

  onClose: () => void;
};

type ExpandedCommandModuleProps = {
  tab: CommandExpandedTab;

  onClose: () => void;
};

/* ============================================================================
   COMPONENT REGISTRY

   Overview is rendered separately because it requires authenticated
   user information and a navigation callback.

   The remaining components retain their existing implementations.
============================================================================ */

const TAB_COMPONENTS: Partial<
  Record<AdminTab, TabComponent>
> = {
  /* --------------------------------------------------------------------------
     COMMAND
  -------------------------------------------------------------------------- */

  analytics: AnalyticsTab,
  activity: ActivityTab,
  calendar: CalendarTab,
  notifications: NotificationsTab,

  /* --------------------------------------------------------------------------
     CRM
  -------------------------------------------------------------------------- */

  clients: ClientsTab,
  contacts: ContactsTab,
  leads: LeadsTab,
  opportunities: OpportunitiesTab,
  pipeline: PipelineTab,
  proposals: ProposalsTab,

  /* --------------------------------------------------------------------------
     DELIVERY
  -------------------------------------------------------------------------- */

  projects: ProjectsTab,
  tasks: TasksTab,
  milestones: MilestonesTab,
  roadmaps: RoadmapsTab,
  sprints: SprintsTab,
  requirements: RequirementsTab,
  qa: QATab,

  /* --------------------------------------------------------------------------
     COMMERCIAL
  -------------------------------------------------------------------------- */

  contracts: ContractsTab,
  quotes: QuotesTab,
  invoices: InvoicesTab,
  subscriptions: SubscriptionsTab,
  expenses: ExpensesTab,
  finance: FinanceTab,
  revenue: RevenueTab,

  /* --------------------------------------------------------------------------
     CLIENT SUCCESS
  -------------------------------------------------------------------------- */

  support: SupportTab,
  tickets: TicketsTab,
  client_health: ClientHealthTab,
  feedback: FeedbackTab,
  messages: MessagesTab,
  meetings: MeetingsTab,

  /* --------------------------------------------------------------------------
     ENGINEERING
  -------------------------------------------------------------------------- */

  monitoring: MonitoringTab,
  deployments: DeploymentsTab,
  systems: SystemsTab,
  domains: DomainsTab,
  environments: EnvironmentsTab,
  repositories: RepositoriesTab,
  incidents: IncidentsTab,
  backups: BackupsTab,

  /* --------------------------------------------------------------------------
     PRODUCTS
  -------------------------------------------------------------------------- */

  product_portfolio: ProductPortfolioTab,
  releases: ReleasesTab,
  feature_requests: FeatureRequestsTab,
  bugs: BugsTab,
  changelog: ChangelogTab,

  /* --------------------------------------------------------------------------
     GROWTH
  -------------------------------------------------------------------------- */

  seo_analytics: SEOAnalyticsTab,
  campaigns: CampaignsTab,
  social_media: SocialMediaTab,
  brand_assets: BrandAssetsTab,

  /* --------------------------------------------------------------------------
     COMPANY
  -------------------------------------------------------------------------- */

  team: TeamTab,
  departments: DepartmentsTab,
  workload: WorkloadTab,
  timesheets: TimesheetsTab,
  recruitment: RecruitmentTab,
  leave: LeaveTab,

  /* --------------------------------------------------------------------------
     KNOWLEDGE
  -------------------------------------------------------------------------- */

  documents: DocumentsTab,
  knowledge_base: KnowledgeBaseTab,
  sops: SOPsTab,
  research: ResearchTab,

  /* --------------------------------------------------------------------------
     GOVERNANCE
  -------------------------------------------------------------------------- */

  compliance: ComplianceTab,
  risks: RisksTab,
  security: SecurityTab,
  audit_logs: AuditLogsTab,
  approvals: ApprovalsTab,
  policies: PoliciesTab,

  /* --------------------------------------------------------------------------
     SYSTEM
  -------------------------------------------------------------------------- */

  automations: AutomationsTab,
  integrations: IntegrationsTab,
  roles_permissions: RolesPermissionsTab,
  api_keys: APIKeysTab,
  settings: SettingsTab,
};

/* ============================================================================
   CONSTANTS
============================================================================ */

const COMMAND_MODULE_STYLES = `
  @keyframes sg-command-module-enter {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.99);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .sg-command-expanded {
    animation:
      sg-command-module-enter
      320ms
      cubic-bezier(0.22, 1, 0.36, 1)
      both;
  }

  @media (prefers-reduced-motion: reduce) {
    .sg-command-expanded {
      animation: none !important;
    }
  }
`;

/* ============================================================================
   NAVIGATION HELPERS
============================================================================ */

function getNavigationDirection(
  currentTab: AdminTab,
  nextTab: AdminTab,
): NavigationDirection {
  if (currentTab === nextTab) {
    return "none";
  }

  /*
   * Command is one workspace.

   * Expanding or closing a Command module should not trigger the
   * ordinary horizontal page transition used by other workspaces.
   */

  if (
    isCommandInternalNavigation(
      currentTab,
      nextTab,
    )
  ) {
    return "none";
  }

  const currentIndex =
    ADMIN_TAB_ORDER.indexOf(currentTab);

  const nextIndex =
    ADMIN_TAB_ORDER.indexOf(nextTab);

  if (
    currentIndex === -1 ||
    nextIndex === -1
  ) {
    return "none";
  }

  return nextIndex > currentIndex
    ? "forward"
    : "backward";
}

/* ============================================================================
   OVERVIEW NAVIGATION

   OverviewTab originally uses destination names.

   Most match AdminTab directly.

   The special "quick-action" and "attention" destinations require
   mapping to existing workspaces.

   This preserves compatibility with the current OverviewTab API.
============================================================================ */

type OverviewDestination = Parameters<
  NonNullable<
    ComponentProps<typeof OverviewTab>["onNavigate"]
  >
>[0];

function resolveOverviewDestination(
  destination: OverviewDestination,
): AdminTab {
  switch (destination) {
    case "quick-action":
      return "tasks";

    case "attention":
      return "tasks";

    case "portfolio":
      return "product_portfolio";

    default:
      return destination;
  }
}

/* ============================================================================
   MAIN COMPONENT
============================================================================ */

export default function AdminHome({
  admin,
  identity,
}: AdminHomeProps) {
  const searchParams = useSearchParams();

  /* --------------------------------------------------------------------------
     PERMISSION-FILTERED NAVIGATION

     isFullAccess is true for every account that existed before the
     access/permissions system, regardless of role — ADMIN_SECTIONS stays
     completely untouched for them. Only a restricted employee account
     (created via Employee -> Access -> Grant Dashboard Access) ever sees
     a filtered nav here.
  -------------------------------------------------------------------------- */

  const hasModuleAccess = useCallback(
    (tab: AdminTab) =>
      isModuleSecured(tab) &&
      identity.permissions.some(
        (grant) => grant.module === tab && grant.action === "VIEW",
      ),
    [identity.permissions],
  );

  const filteredSections = useMemo<AdminSection[]>(
    () =>
      filterSectionsByPermission(
        identity.isFullAccess,
        hasModuleAccess,
      ),
    [identity.isFullAccess, hasModuleAccess],
  );

  const filteredTabDefinitions = useMemo(
    () =>
      identity.isFullAccess
        ? ADMIN_TABS
        : filterTabDefinitions(filteredSections),
    [identity.isFullAccess, filteredSections],
  );

  // 'overview' is never a grant — filterSectionsByPermission excludes it
  // unconditionally — but every restricted employee still gets her own
  // personalised Overview automatically (see OverviewTab.tsx's employee
  // branch), so it's always permitted and always the landing default for
  // her, independent of whatever else she's been granted. A full-access
  // caller is unaffected: her own Overview still means the Owner's
  // unified Command workspace, exactly as before.
  const isTabPermitted = useCallback(
    (tab: AdminTab) =>
      identity.isFullAccess ||
      tab === COMMAND_HOME_TAB ||
      Object.prototype.hasOwnProperty.call(
        filteredTabDefinitions,
        tab,
      ),
    [identity.isFullAccess, filteredTabDefinitions],
  );

  const fallbackLandingTab: AdminTab = COMMAND_HOME_TAB;

  const resolveTab = useCallback(
    (value: string | null | undefined) => {
      const resolved = adminTabFromSearchParam(value);
      return isTabPermitted(resolved)
        ? resolved
        : fallbackLandingTab;
    },
    [isTabPermitted, fallbackLandingTab],
  );

  /* --------------------------------------------------------------------------
     INITIAL TAB
  -------------------------------------------------------------------------- */

  const initialTab = useMemo<AdminTab>(
    () => resolveTab(searchParams.get("tab")),
    [searchParams, resolveTab],
  );

  const [activeTab, setActiveTabState] =
    useState<AdminTab>(initialTab);

  const [
    navigationDirection,
    setNavigationDirection,
  ] = useState<NavigationDirection>("none");

  const activeTabRef =
    useRef<AdminTab>(initialTab);

  /*
   * Keep track of how a Command module was opened.
   *
   * This is useful for future transitions, analytics
   * and restoring the correct overview experience.
   */

  const commandNavigationSourceRef =
    useRef<CommandNavigationSource>(
      "navigation",
    );

  /* --------------------------------------------------------------------------
     SCROLL POSITION

     Preserve the Overview's scroll position when the user
     opens an expanded Command module.

     On closing the module, restore the previous position.
  -------------------------------------------------------------------------- */

  const overviewScrollPositionRef =
    useRef(0);

  const restoreOverviewScrollRef =
    useRef(false);

  const previousRenderedTabRef =
    useRef<AdminTab>(initialTab);

  /* --------------------------------------------------------------------------
     SYNCHRONISE TAB STATE

     This is the central navigation function used by:

     - Sidebar
     - Header
     - Overview widgets
     - Search
     - Notifications
     - Expanded Command modules

     Navigation stays client-side and does not trigger
     a Next.js route transition.
  -------------------------------------------------------------------------- */

  const navigateToTab = useCallback(
    (
      nextTab: AdminTab,
      source: CommandNavigationSource = "navigation",
    ) => {
      const currentTab =
        activeTabRef.current;

      if (currentTab === nextTab) {
        return;
      }

      const direction =
        getNavigationDirection(
          currentTab,
          nextTab,
        );

      commandNavigationSourceRef.current =
        source;

      /* ---------------------------------------------------------------
         PRESERVE OVERVIEW SCROLL POSITION
      --------------------------------------------------------------- */

      if (
        currentTab === COMMAND_HOME_TAB &&
        isCommandExpandedTab(nextTab)
      ) {
        const scrollArea =
          document.getElementById(
            "admin-shell-scroll-area",
          );

        overviewScrollPositionRef.current =
          scrollArea?.scrollTop ??
          window.scrollY;
      }

      if (
        isCommandExpandedTab(currentTab) &&
        nextTab === COMMAND_HOME_TAB
      ) {
        restoreOverviewScrollRef.current = true;
      } else {
        restoreOverviewScrollRef.current = false;
      }

      /* ---------------------------------------------------------------
         UPDATE STATE
      --------------------------------------------------------------- */

      activeTabRef.current = nextTab;

      setNavigationDirection(direction);

      setActiveTabState(nextTab);

      /* ---------------------------------------------------------------
         URL SYNCHRONISATION

         Keep the existing replaceState behaviour.

         Overview:
           /admin

         Expanded Command:
           /admin?tab=analytics
           /admin?tab=activity
           /admin?tab=calendar
           /admin?tab=notifications

         Other workspaces:
           /admin?tab=clients
           /admin?tab=projects

         No Next.js router navigation occurs.
      --------------------------------------------------------------- */

      const url = new URL(
        window.location.href,
      );

      if (nextTab === COMMAND_HOME_TAB) {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set(
          "tab",
          nextTab,
        );
      }

      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    },
    [],
  );

  /* --------------------------------------------------------------------------
     PUBLIC TAB NAVIGATION

     AdminShell still receives the same setActiveTab prop,
     so its existing sidebar and header integration remains compatible.
  -------------------------------------------------------------------------- */

  const setActiveTab = useCallback(
    (tab: AdminTab) => {
      navigateToTab(
        tab,
        "navigation",
      );
    },
    [navigateToTab],
  );

  /* --------------------------------------------------------------------------
     OPEN COMMAND MODULE
  -------------------------------------------------------------------------- */

  const openCommandModule = useCallback(
    (tab: CommandExpandedTab) => {
      navigateToTab(
        tab,
        "widget",
      );
    },
    [navigateToTab],
  );

  /* --------------------------------------------------------------------------
     CLOSE COMMAND MODULE
  -------------------------------------------------------------------------- */

  const closeCommandModule = useCallback(
    () => {
      navigateToTab(
        COMMAND_HOME_TAB,
        "close",
      );
    },
    [navigateToTab],
  );

  /* --------------------------------------------------------------------------
     OVERVIEW DESTINATION HANDLER

     Existing Overview buttons can continue using onNavigate.
  -------------------------------------------------------------------------- */

  const handleOverviewNavigate = useCallback(
    (destination: OverviewDestination) => {
      const tab =
        resolveOverviewDestination(
          destination,
        );

      if (isCommandExpandedTab(tab)) {
        openCommandModule(tab);
        return;
      }

      navigateToTab(
        tab,
        "widget",
      );
    },
    [
      navigateToTab,
      openCommandModule,
    ],
  );

  /* --------------------------------------------------------------------------
     BROWSER BACK / FORWARD

     Preserve the existing native browser history integration.

     Unlike router.push(), this does not cause a server-side
     authentication round trip.
  -------------------------------------------------------------------------- */

  useEffect(() => {
    const handlePopState = () => {
      const params =
        new URLSearchParams(
          window.location.search,
        );

      const nextTab = resolveTab(
        params.get("tab"),
      );

      const currentTab =
        activeTabRef.current;

      if (currentTab === nextTab) {
        return;
      }

      const direction =
        getNavigationDirection(
          currentTab,
          nextTab,
        );

      if (
        currentTab === COMMAND_HOME_TAB &&
        isCommandExpandedTab(nextTab)
      ) {
        const scrollArea =
          document.getElementById(
            "admin-shell-scroll-area",
          );

        overviewScrollPositionRef.current =
          scrollArea?.scrollTop ??
          window.scrollY;
      }

      restoreOverviewScrollRef.current =
        isCommandExpandedTab(currentTab) &&
        nextTab === COMMAND_HOME_TAB;

      activeTabRef.current = nextTab;

      setNavigationDirection(direction);

      setActiveTabState(nextTab);
    };

    window.addEventListener(
      "popstate",
      handlePopState,
    );

    return () => {
      window.removeEventListener(
        "popstate",
        handlePopState,
      );
    };
  }, [resolveTab]);

  /* --------------------------------------------------------------------------
     SCROLL HANDLING

     When changing between unrelated workspaces, start at the top.

     When closing a Command module, restore the Overview's previous
     position where possible.
  -------------------------------------------------------------------------- */

  useEffect(() => {
    if (
      previousRenderedTabRef.current ===
      activeTab
    ) {
      return;
    }

    previousRenderedTabRef.current =
      activeTab;

    const scrollArea =
      document.getElementById(
        "admin-shell-scroll-area",
      );

    const shouldRestore =
      restoreOverviewScrollRef.current;

    restoreOverviewScrollRef.current =
      false;

    const frame = requestAnimationFrame(
      () => {
        if (scrollArea) {
          scrollArea.scrollTop =
            shouldRestore
              ? overviewScrollPositionRef.current
              : 0;

          return;
        }

        window.scrollTo({
          top: shouldRestore
            ? overviewScrollPositionRef.current
            : 0,
          behavior: "instant",
        });
      },
    );

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [activeTab]);

  /* --------------------------------------------------------------------------
     ACTIVE WORKSPACE
  -------------------------------------------------------------------------- */

  // The unified "Overview + expandable widgets" presentation applies to
  // every account. A restricted employee can be granted
  // Calendar/Analytics/Activity/Notifications individually, and reaches
  // them as permission-gated widgets inside her own Overview (see
  // OverviewTab.tsx's employee branch) — never as a standalone tab.
  const isCommandWorkspace =
    isCommandTab(activeTab);

  /* --------------------------------------------------------------------------
     RENDER
  -------------------------------------------------------------------------- */

  return (
    <AdminThemeProvider>
      <AdminShell
        admin={admin}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabDefinitions={filteredTabDefinitions}
        sections={filteredSections}
        isFullAccess={identity.isFullAccess}
        navigationDirection={
          navigationDirection
        }
      >
        {isCommandWorkspace ? (
          <CommandWorkspace
            admin={admin}
            identity={identity}
            activeTab={activeTab}
            onNavigate={(tab) => {
              if (isCommandExpandedTab(tab)) {
                openCommandModule(tab);
                return;
              }

              navigateToTab(
                tab,
                "widget",
              );
            }}
            onClose={closeCommandModule}
            onOverviewNavigate={
              handleOverviewNavigate
            }
          />
        ) : (
          <StandardWorkspace
            activeTab={activeTab}
          />
        )}
      </AdminShell>
    </AdminThemeProvider>
  );
}

/* ============================================================================
   COMMAND WORKSPACE

   One unified operating environment.

   Overview:
     Displays the wallpaper dashboard.

   Expanded module:
     Displays the corresponding existing component
     inside the same Command workspace.
============================================================================ */

function CommandWorkspace({
  admin,
  identity,
  activeTab,
  onNavigate,
  onClose,
  onOverviewNavigate,
}: CommandWorkspaceProps & {
  onOverviewNavigate: (
    destination: OverviewDestination,
  ) => void;
}) {
  const expanded =
    isCommandExpandedTab(activeTab);

  return (
    <div className="relative min-h-full w-full min-w-0">
      <style>{COMMAND_MODULE_STYLES}</style>

      {/* ================================================================
          OVERVIEW

          We keep the Overview mounted while a Command module is open.

          This preserves local component state such as:
          - Wallpaper preferences
          - Widget visibility
          - Local customisation UI state
          - Other future dashboard preferences

          The Overview is hidden while the expanded module is active.
      ================================================================ */}

      <div
        className={
          expanded
            ? "pointer-events-none absolute inset-x-0 top-0 invisible"
            : "relative visible"
        }
        aria-hidden={expanded}
        inert={expanded}
      >
        <OverviewTab
          admin={admin}
          identity={identity}
          onNavigate={
            onOverviewNavigate
          }
        />
      </div>

      {/* ================================================================
          EXPANDED MODULE
      ================================================================ */}

      {expanded && (
        <ExpandedCommandModule
          tab={activeTab}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/* ============================================================================
   EXPANDED COMMAND MODULE

   Reuses the existing page components.

   No duplicated Analytics, Activity, Calendar or Notifications logic.
============================================================================ */

function ExpandedCommandModule({
  tab,
  onClose,
}: ExpandedCommandModuleProps) {
  const moduleDefinition =
    getCommandModule(tab);

  const ModuleComponent =
    TAB_COMPONENTS[tab];

  if (
    !moduleDefinition ||
    !ModuleComponent
  ) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <p className="text-sm font-semibold text-[var(--text)]">
            This Command module is unavailable.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)]"
          >
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }

  const Icon =
    moduleDefinition.icon;

  return (
    <section
      className="
        sg-command-expanded
        relative
        flex
        min-h-[calc(100dvh-160px)]
        w-full
        min-w-0
        flex-col
      "
      aria-label={`${moduleDefinition.title} workspace`}
    >
      {/* ================================================================
          EXPANDED WORKSPACE HEADER
      ================================================================ */}

      <div
        className="
          sticky
          top-0
          z-20

          flex
          min-h-[76px]
          items-center
          justify-between
          gap-4

          border-b
          border-[var(--line)]

          bg-[var(--shell-translucent)]

          px-5
          py-3

          backdrop-blur-2xl

          sm:px-7
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center

              rounded-[14px]

              border
              border-[var(--line)]

              bg-[var(--surface-muted)]

              text-[var(--text)]
            "
          >
            <Icon
              size={19}
              strokeWidth={1.8}
            />
          </span>

          <div className="min-w-0">
            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <p
                className="
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-[var(--text-subtle)]
                "
              >
                Command
              </p>

              <ChevronSeparator />

              <p
                className="
                  truncate
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-[var(--text-subtle)]
                "
              >
                Expanded workspace
              </p>
            </div>

            <h1
              className="
                mt-1
                truncate
                text-[19px]
                font-semibold
                tracking-[-0.035em]
                text-[var(--text)]

                sm:text-[22px]
              "
            >
              {moduleDefinition.title}
            </h1>
          </div>
        </div>

        {/* ============================================================
            CLOSE / RETURN
        ============================================================ */}

        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${moduleDefinition.title} and return to Overview`}
          className="
            group

            inline-flex
            h-10
            shrink-0
            items-center
            justify-center
            gap-2

            rounded-full

            border
            border-[var(--line)]

            bg-[var(--surface)]

            px-3

            text-[11px]
            font-semibold
            text-[var(--text)]

            transition-[background-color,transform]
            duration-200

            hover:-translate-y-px
            hover:bg-[var(--surface-muted)]

            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-[var(--primary)]

            sm:px-4
          "
        >
          <ArrowLeft
            size={15}
            className="
              transition-transform
              duration-200
              group-hover:-translate-x-0.5
            "
          />

          <span className="hidden sm:inline">
            Back to Overview
          </span>

          <span className="sm:hidden">
            Back
          </span>

          <X
            size={14}
            className="hidden opacity-50 sm:block"
          />
        </button>
      </div>

      {/* ================================================================
          MODULE CONTENT

          The original component is mounted here.

          We do not duplicate any of its internal functionality.

          AdminShell will provide the maximised Command content area
          after its corresponding update.
      ================================================================ */}

      <div
        className="
          relative

          min-h-0
          min-w-0
          flex-1

          px-4
          pb-8
          pt-5

          sm:px-6
          sm:pt-6

          xl:px-8
          xl:pt-7
        "
      >
        <ModuleComponent />
      </div>
    </section>
  );
}

/* ============================================================================
   STANDARD WORKSPACE

   Every non-Command workspace continues using the original
   component registry and navigation flow.
============================================================================ */

function StandardWorkspace({
  activeTab,
}: {
  activeTab: AdminTab;
}) {
  const ActiveTabComponent =
    TAB_COMPONENTS[activeTab];

  if (!ActiveTabComponent) {
    return (
      <div
        className="
          rounded-2xl
          border
          border-[var(--line)]
          bg-[var(--surface)]
          p-8
          text-center
        "
      >
        <p className="text-sm font-semibold text-[var(--text)]">
          This workspace could not be loaded.
        </p>
      </div>
    );
  }

  return <ActiveTabComponent />;
}

/* ============================================================================
   SMALL COMPONENTS
============================================================================ */

function ChevronSeparator() {
  return (
    <ArrowUpRight
      size={11}
      className="text-[var(--text-subtle)]"
      aria-hidden="true"
    />
  );
}