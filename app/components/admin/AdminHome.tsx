'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';

import {
  useSearchParams,
} from 'next/navigation';

import AdminShell from './AdminShell';

import {
  AdminThemeProvider,
} from './AdminThemeProvider';

import {
  ADMIN_SECTIONS,
  ADMIN_TABS,
  adminTabFromSearchParam,
  type AdminTab,
  type AdminUser,
} from './adminNav';

/* ============================================================================
   TAB COMPONENTS
============================================================================ */

import ActivityTab from './tabs/ActivityTab';
import AnalyticsTab from './tabs/AnalyticsTab';
import APIKeysTab from './tabs/APIKeysTab';
import ApprovalsTab from './tabs/ApprovalsTab';
import AuditLogsTab from './tabs/AuditLogsTab';
import AutomationsTab from './tabs/AutomationsTab';
import BackupsTab from './tabs/BackupsTab';
import BrandAssetsTab from './tabs/BrandAssetsTab';
import BugsTab from './tabs/BugsTab';
import CalendarTab from './tabs/CalendarTab';
import CampaignsTab from './tabs/CampaignsTab';
import ChangelogTab from './tabs/ChangelogTab';
import ClientHealthTab from './tabs/ClientHealthTab';
import ClientsTab from './tabs/ClientsTab';
import ComplianceTab from './tabs/ComplianceTab';
import ContactsTab from './tabs/ContactsTab';
import ContractsTab from './tabs/ContractsTab';
import DepartmentsTab from './tabs/DepartmentsTab';
import DeploymentsTab from './tabs/DeploymentsTab';
import DocumentsTab from './tabs/DocumentsTab';
import DomainsTab from './tabs/DomainsTab';
import EnvironmentsTab from './tabs/EnvironmentsTab';
import ExpensesTab from './tabs/ExpensesTab';
import FeatureRequestsTab from './tabs/FeatureRequestsTab';
import FeedbackTab from './tabs/FeedbackTab';
import FinanceTab from './tabs/FinanceTab';
import IncidentsTab from './tabs/IncidentsTab';
import IntegrationsTab from './tabs/IntegrationsTab';
import InvoicesTab from './tabs/InvoicesTab';
import KnowledgeBaseTab from './tabs/KnowledgeBaseTab';
import LeadsTab from './tabs/LeadsTab';
import LeaveTab from './tabs/LeaveTab';
import MeetingsTab from './tabs/MeetingsTab';
import MessagesTab from './tabs/MessagesTab';
import MilestonesTab from './tabs/MilestonesTab';
import MonitoringTab from './tabs/MonitoringTab';
import NotificationsTab from './tabs/NotificationsTab';
import OpportunitiesTab from './tabs/OpportunitiesTab';
import OverviewTab from './tabs/OverviewTab';
import PipelineTab from './tabs/PipelineTab';
import PoliciesTab from './tabs/PoliciesTab';
import ProductPortfolioTab from './tabs/ProductPortfolioTab';
import ProjectsTab from './tabs/ProjectsTab';
import ProposalsTab from './tabs/ProposalsTab';
import QATab from './tabs/QATab';
import QuotesTab from './tabs/QuotesTab';
import RecruitmentTab from './tabs/RecruitmentTab';
import ReleasesTab from './tabs/ReleasesTab';
import RepositoriesTab from './tabs/RepositoriesTab';
import RequirementsTab from './tabs/RequirementsTab';
import ResearchTab from './tabs/ResearchTab';
import RevenueTab from './tabs/RevenueTab';
import RisksTab from './tabs/RisksTab';
import RoadmapsTab from './tabs/RoadmapsTab';
import RolesPermissionsTab from './tabs/RolesPermissionsTab';
import SecurityTab from './tabs/SecurityTab';
import SEOAnalyticsTab from './tabs/SEOAnalyticsTab';
import SettingsTab from './tabs/SettingsTab';
import SocialMediaTab from './tabs/SocialMediaTab';
import SOPsTab from './tabs/SOPsTab';
import SprintsTab from './tabs/SprintsTab';
import SubscriptionsTab from './tabs/SubscriptionsTab';
import SupportTab from './tabs/SupportTab';
import SystemsTab from './tabs/SystemsTab';
import TasksTab from './tabs/TasksTab';
import TeamTab from './tabs/TeamTab';
import TicketsTab from './tabs/TicketsTab';
import TimesheetsTab from './tabs/TimesheetsTab';
import WebsiteMediaTab from './tabs/WebsiteMediaTab';
import WorkloadTab from './tabs/WorkloadTab';

/* ============================================================================
   TYPES
============================================================================ */

export type AdminHomeProps = {
  admin: AdminUser;
};

type TabComponent =
  ComponentType<Record<string, never>>;

export type NavigationDirection =
  | 'forward'
  | 'backward'
  | 'none';

/* ============================================================================
   COMPONENT REGISTRY
============================================================================ */

const TAB_COMPONENTS: Record<
  AdminTab,
  TabComponent
> = {
  /* --------------------------------------------------------------------------
     COMMAND
  -------------------------------------------------------------------------- */

  overview: OverviewTab,
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

  product_portfolio:
    ProductPortfolioTab,

  releases: ReleasesTab,

  feature_requests:
    FeatureRequestsTab,

  bugs: BugsTab,
  changelog: ChangelogTab,

  /* --------------------------------------------------------------------------
     GROWTH
  -------------------------------------------------------------------------- */

  website_media: WebsiteMediaTab,
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

  roles_permissions:
    RolesPermissionsTab,

  api_keys: APIKeysTab,
  settings: SettingsTab,
};

/* ============================================================================
   GLOBAL TAB ORDER

   This gives every tab a stable position in the entire admin application.

   We use it to determine which direction the next page should enter from.

   Example:

   Overview -> Analytics
   = forward
   = new content enters from the right.

   Analytics -> Overview
   = backward
   = new content enters from the left.

   This also works when moving between entire sidebar workspaces.
============================================================================ */

const TAB_ORDER: AdminTab[] =
  ADMIN_SECTIONS.flatMap(
    (section) =>
      section.items.map(
        (item) => item.tab,
      ),
  );

/* ============================================================================
   HELPERS
============================================================================ */

function getNavigationDirection(
  currentTab: AdminTab,
  nextTab: AdminTab,
): NavigationDirection {
  if (
    currentTab === nextTab
  ) {
    return 'none';
  }

  const currentIndex =
    TAB_ORDER.indexOf(
      currentTab,
    );

  const nextIndex =
    TAB_ORDER.indexOf(
      nextTab,
    );

  /*
   * Safety fallback.
   *
   * Every valid admin tab should exist in TAB_ORDER, but if the navigation
   * structure is changed later and one is missing, we still avoid breaking
   * the transition system.
   */

  if (
    currentIndex === -1 ||
    nextIndex === -1
  ) {
    return 'none';
  }

  return nextIndex >
    currentIndex
    ? 'forward'
    : 'backward';
}

/* ============================================================================
   COMPONENT
============================================================================ */

export default function AdminHome({
  admin,
}: AdminHomeProps) {
  const searchParams =
    useSearchParams();

  /* --------------------------------------------------------------------------
     INITIAL TAB
  -------------------------------------------------------------------------- */

  const initialTab =
    useMemo<AdminTab>(
      () =>
        adminTabFromSearchParam(
          searchParams.get(
            'tab',
          ),
        ),
      [searchParams],
    );

  const [
    activeTab,
    setActiveTabState,
  ] =
    useState<AdminTab>(
      initialTab,
    );

  /* --------------------------------------------------------------------------
     NAVIGATION DIRECTION

     This is deliberately separate from activeTab.

     AdminShell will use this value to animate the new page in the correct
     direction without remounting the entire application shell.
  -------------------------------------------------------------------------- */

  const [
    navigationDirection,
    setNavigationDirection,
  ] =
    useState<NavigationDirection>(
      'none',
    );

  /*
   * Keep an immediately accessible copy of the current tab.
   *
   * This avoids relying on an asynchronous state update when several
   * navigation events happen quickly.
   */

  const activeTabRef =
    useRef<AdminTab>(
      initialTab,
    );

  /* --------------------------------------------------------------------------
     BACK / FORWARD

     We continue using native browser history.

     There is deliberately no router.push() or router.replace() here because
     switching admin modules is local UI state, not a Next.js route
     transition.
  -------------------------------------------------------------------------- */

  useEffect(() => {
    const handlePopState =
      () => {
        const params =
          new URLSearchParams(
            window.location.search,
          );

        const nextTab =
          adminTabFromSearchParam(
            params.get('tab'),
          );

        const currentTab =
          activeTabRef.current;

        const direction =
          getNavigationDirection(
            currentTab,
            nextTab,
          );

        activeTabRef.current =
          nextTab;

        setNavigationDirection(
          direction,
        );

        setActiveTabState(
          nextTab,
        );
      };

    window.addEventListener(
      'popstate',
      handlePopState,
    );

    return () => {
      window.removeEventListener(
        'popstate',
        handlePopState,
      );
    };
  }, []);

  /* --------------------------------------------------------------------------
     SWITCH TAB

     The sequence is intentionally:

     1. Determine where the next tab sits relative to the current tab.
     2. Store the animation direction.
     3. Update the current tab reference.
     4. Update React state immediately.
     5. Synchronise the URL using the History API.

     No Next.js navigation occurs.
  -------------------------------------------------------------------------- */

  const setActiveTab =
    useCallback(
      (
        nextTab: AdminTab,
      ) => {
        const currentTab =
          activeTabRef.current;

        if (
          currentTab ===
          nextTab
        ) {
          return;
        }

        const direction =
          getNavigationDirection(
            currentTab,
            nextTab,
          );

        /*
         * Update the ref before React renders the next tab.
         */

        activeTabRef.current =
          nextTab;

        setNavigationDirection(
          direction,
        );

        setActiveTabState(
          nextTab,
        );

        /* ---------------------------------------------------------------
           URL SYNCHRONISATION

           Keep Overview as the clean /dashboard URL.

           Other modules use:
           /dashboard?tab=analytics
           /dashboard?tab=projects
           etc.

           replaceState avoids a Next navigation and therefore avoids
           loading flashes or server rerenders.
        --------------------------------------------------------------- */

        const url =
          new URL(
            window.location.href,
          );

        if (
          nextTab ===
          'overview'
        ) {
          url.searchParams.delete(
            'tab',
          );
        } else {
          url.searchParams.set(
            'tab',
            nextTab,
          );
        }

        window.history.replaceState(
          window.history.state,
          '',
          `${url.pathname}${url.search}${url.hash}`,
        );
      },
      [],
    );

  /* --------------------------------------------------------------------------
     ACTIVE COMPONENT
  -------------------------------------------------------------------------- */

  const ActiveTabComponent =
    TAB_COMPONENTS[
      activeTab
    ];

  /* --------------------------------------------------------------------------
     RENDER
  -------------------------------------------------------------------------- */

  return (
    <AdminThemeProvider>
      <AdminShell
        admin={admin}
        activeTab={
          activeTab
        }
        setActiveTab={
          setActiveTab
        }
        tabDefinitions={
          ADMIN_TABS
        }
        navigationDirection={
          navigationDirection
        }
      >
        <ActiveTabComponent />
      </AdminShell>
    </AdminThemeProvider>
  );
}