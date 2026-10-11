import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckSquare2,
  CircleDollarSign,
  CloudCog,
  Code2,
  FileCheck2,
  FileText,
  FolderKanban,
  GitBranch,
  Globe2,
  Headphones,
  History,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Network,
  PackageCheck,
  Plug,
  ReceiptText,
  RefreshCcw,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TicketCheck,
  UserRoundPlus,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/* ============================================================================
   CORE TYPES
============================================================================ */

export type AdminTab =
  | "overview"
  | "analytics"
  | "activity"
  | "calendar"
  | "notifications"
  | "clients"
  | "contacts"
  | "leads"
  | "opportunities"
  | "pipeline"
  | "proposals"
  | "projects"
  | "tasks"
  | "milestones"
  | "roadmaps"
  | "sprints"
  | "requirements"
  | "qa"
  | "contracts"
  | "quotes"
  | "invoices"
  | "subscriptions"
  | "expenses"
  | "finance"
  | "revenue"
  | "support"
  | "tickets"
  | "client_health"
  | "feedback"
  | "messages"
  | "meetings"
  | "monitoring"
  | "deployments"
  | "systems"
  | "domains"
  | "environments"
  | "repositories"
  | "incidents"
  | "backups"
  | "product_portfolio"
  | "releases"
  | "feature_requests"
  | "bugs"
  | "changelog"
  | "seo_analytics"
  | "campaigns"
  | "social_media"
  | "brand_assets"
  | "team"
  | "departments"
  | "workload"
  | "timesheets"
  | "recruitment"
  | "leave"
  | "documents"
  | "knowledge_base"
  | "sops"
  | "research"
  | "compliance"
  | "risks"
  | "security"
  | "audit_logs"
  | "approvals"
  | "policies"
  | "automations"
  | "integrations"
  | "roles_permissions"
  | "api_keys"
  | "settings";

export type AdminSectionId =
  | "command"
  | "crm"
  | "delivery"
  | "commercial"
  | "client-success"
  | "engineering"
  | "products"
  | "growth"
  | "company"
  | "knowledge"
  | "governance"
  | "system";

export type AdminSectionLabel =
  | "Command"
  | "CRM"
  | "Delivery"
  | "Commercial"
  | "Client Success"
  | "Engineering"
  | "Products"
  | "Growth"
  | "Company"
  | "Knowledge"
  | "Governance"
  | "System";

export type AdminModuleStatus =
  | "live"
  | "planned";

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

export type AdminTabDefinition = {
  tab: AdminTab;
  title: string;
  description: string;
  section: AdminSectionLabel;
  icon: LucideIcon;
  status: AdminModuleStatus;
};

export type AdminSection = {
  id: AdminSectionId;
  label: AdminSectionLabel;
  description: string;
  icon: LucideIcon;
  items: AdminTabDefinition[];
};

/* ============================================================================
   COMMAND WORKSPACE

   Command is no longer presented as five independent navigation tabs.

   It becomes one unified workspace.

   Overview:
     Main wallpaper dashboard.

   Analytics:
     Expandable analytics workspace.

   Activity:
     Expandable activity workspace.

   Calendar:
     Expandable calendar workspace.

   Notifications:
     Expandable notifications workspace.

   IMPORTANT:

   We preserve all five AdminTab identifiers.

   Existing navigation, URL parameters, global search, notification links
   and other components can continue referencing these identifiers.

   The presentation layer determines whether a Command module appears
   as a dashboard widget or as an expanded workspace.
============================================================================ */

export const COMMAND_SECTION_ID = "command" as const;

export const COMMAND_HOME_TAB = "overview" as const;

export const COMMAND_TABS = [
  "overview",
  "analytics",
  "activity",
  "calendar",
  "notifications",
] as const satisfies readonly AdminTab[];

export type CommandTab =
  (typeof COMMAND_TABS)[number];

export type CommandExpandedTab =
  Exclude<CommandTab, "overview">;

/**
 * Modules that open inside the unified Command workspace.
 *
 * These are not displayed as secondary navigation tabs.
 */

export const COMMAND_EXPANDABLE_TABS = [
  "analytics",
  "activity",
  "calendar",
  "notifications",
] as const satisfies readonly CommandExpandedTab[];

/**
 * Determines whether a tab belongs to the Command workspace.
 *
 * Used by:
 * - AdminHome
 * - AdminShell
 * - AdminHeader
 * - OverviewTab
 */

export function isCommandTab(
  tab: AdminTab | string | null | undefined,
): tab is CommandTab {
  if (!tab) {
    return false;
  }

  return (
    COMMAND_TABS as readonly string[]
  ).includes(tab);
}

/**
 * Determines whether the current tab represents
 * an expanded Command module.
 */

export function isCommandExpandedTab(
  tab: AdminTab | string | null | undefined,
): tab is CommandExpandedTab {
  if (!tab) {
    return false;
  }

  return (
    COMMAND_EXPANDABLE_TABS as readonly string[]
  ).includes(tab);
}

/**
 * Determines whether an entire section uses
 * the unified Command layout.
 */

export function isCommandSection(
  section: AdminSection | AdminSectionId | null | undefined,
): boolean {
  if (!section) {
    return false;
  }

  if (typeof section === "string") {
    return section === COMMAND_SECTION_ID;
  }

  return section.id === COMMAND_SECTION_ID;
}

/**
 * Returns the correct Command workspace presentation.
 *
 * overview:
 *   Show the complete personalised dashboard.
 *
 * expanded:
 *   Show the requested module in the full Command content area.
 */

export type CommandPresentation =
  | {
      mode: "overview";
      module: null;
    }
  | {
      mode: "expanded";
      module: CommandExpandedTab;
    };

export function getCommandPresentation(
  tab: AdminTab,
): CommandPresentation | null {
  if (tab === COMMAND_HOME_TAB) {
    return {
      mode: "overview",
      module: null,
    };
  }

  if (isCommandExpandedTab(tab)) {
    return {
      mode: "expanded",
      module: tab,
    };
  }

  return null;
}

/**
 * Normalises an incoming Command tab.
 *
 * Useful when returning to Command from another workspace.
 */

export function resolveCommandTab(
  tab: AdminTab | string | null | undefined,
): CommandTab {
  if (isCommandTab(tab)) {
    return tab;
  }

  return COMMAND_HOME_TAB;
}

/**
 * Returns the main Command dashboard tab.
 *
 * Sidebar navigation should always open Overview rather
 * than restoring a previously expanded module.
 */

export function getCommandHomeTab(): CommandTab {
  return COMMAND_HOME_TAB;
}

/* ============================================================================
   COMMAND MODULE PRESENTATION CONFIGURATION

   This configuration controls labels and behaviour used by the redesigned
   Overview and expanded module interface.

   It does not replace ADMIN_TABS.

   ADMIN_TABS remains the canonical registry for the entire application.
============================================================================ */

export type CommandModuleDefinition = {
  tab: CommandExpandedTab;
  title: string;
  description: string;
  icon: LucideIcon;
  expandable: true;
  closable: true;
};

export const COMMAND_MODULES: Record<
  CommandExpandedTab,
  CommandModuleDefinition
> = {
  analytics: {
    tab: "analytics",
    title: "Analytics",
    description:
      "Company performance, growth and operational intelligence.",
    icon: BarChart3,
    expandable: true,
    closable: true,
  },

  activity: {
    tab: "activity",
    title: "Activity",
    description:
      "Important actions, changes and operational events.",
    icon: Activity,
    expandable: true,
    closable: true,
  },

  calendar: {
    tab: "calendar",
    title: "Calendar",
    description:
      "Meetings, deadlines, milestones and company events.",
    icon: CalendarDays,
    expandable: true,
    closable: true,
  },

  notifications: {
    tab: "notifications",
    title: "Notifications",
    description:
      "Operational alerts, updates and notifications requiring attention.",
    icon: Sparkles,
    expandable: true,
    closable: true,
  },
};

/**
 * Returns the ordered expandable module definitions.
 *
 * This ensures OverviewTab and AdminHome use the
 * same module configuration and ordering.
 */

export function getCommandModules(): CommandModuleDefinition[] {
  return COMMAND_EXPANDABLE_TABS.map(
    (tab) => COMMAND_MODULES[tab],
  );
}

/* ============================================================================
   TAB DEFINITIONS

   All existing modules are preserved.

   Command modules remain in this registry for compatibility with:
   - Existing components
   - Search
   - Deep links
   - History state
   - Navigation
   - Other workspaces
============================================================================ */

export const ADMIN_TABS: Record<
  AdminTab,
  AdminTabDefinition
> = {
  /* --------------------------------------------------------------------------
     COMMAND
  -------------------------------------------------------------------------- */

  overview: {
    tab: "overview",
    title: "Overview",
    description:
      "Operations, performance and anything needing attention across the company.",
    section: "Command",
    icon: LayoutDashboard,
    status: "live",
  },

  analytics: {
    tab: "analytics",
    title: "Analytics",
    description:
      "Company performance, growth and operational intelligence.",
    section: "Command",
    icon: BarChart3,
    status: "live",
  },

  activity: {
    tab: "activity",
    title: "Activity",
    description:
      "A timeline of important actions and changes across the company.",
    section: "Command",
    icon: Activity,
    status: "planned",
  },

  calendar: {
    tab: "calendar",
    title: "Calendar",
    description:
      "Meetings, deadlines, milestones and important company dates.",
    section: "Command",
    icon: CalendarDays,
    status: "planned",
  },

  notifications: {
    tab: "notifications",
    title: "Notifications",
    description:
      "Operational alerts and notifications requiring attention.",
    section: "Command",
    icon: Sparkles,
    status: "planned",
  },

  /* --------------------------------------------------------------------------
     CRM
  -------------------------------------------------------------------------- */

  clients: {
    tab: "clients",
    title: "Clients",
    description:
      "Client accounts, platforms and commercial relationships.",
    section: "CRM",
    icon: Building2,
    status: "live",
  },

  contacts: {
    tab: "contacts",
    title: "Contacts",
    description:
      "People and decision makers across client organisations.",
    section: "CRM",
    icon: Users,
    status: "planned",
  },

  leads: {
    tab: "leads",
    title: "Leads",
    description:
      "Potential clients and incoming commercial opportunities.",
    section: "CRM",
    icon: UserRoundPlus,
    status: "planned",
  },

  opportunities: {
    tab: "opportunities",
    title: "Opportunities",
    description:
      "Qualified business opportunities and their potential value.",
    section: "CRM",
    icon: Target,
    status: "planned",
  },

  pipeline: {
    tab: "pipeline",
    title: "Pipeline",
    description:
      "Track commercial opportunities through the sales process.",
    section: "CRM",
    icon: GitBranch,
    status: "planned",
  },

  proposals: {
    tab: "proposals",
    title: "Proposals",
    description:
      "Client proposals, scopes and commercial offers.",
    section: "CRM",
    icon: FileText,
    status: "planned",
  },

  /* --------------------------------------------------------------------------
     DELIVERY
  -------------------------------------------------------------------------- */

  projects: {
    tab: "projects",
    title: "Projects",
    description:
      "Client and internal projects delivered by Syntra Grid.",
    section: "Delivery",
    icon: FolderKanban,
    status: "live",
  },

  tasks: {
    tab: "tasks",
    title: "Tasks",
    description:
      "Work items across projects and internal operations.",
    section: "Delivery",
    icon: CheckSquare2,
    status: "planned",
  },

  milestones: {
    tab: "milestones",
    title: "Milestones",
    description:
      "Major project targets, deadlines and delivery checkpoints.",
    section: "Delivery",
    icon: Target,
    status: "planned",
  },

  roadmaps: {
    tab: "roadmaps",
    title: "Roadmaps",
    description:
      "Delivery plans for the months ahead across products and client systems.",
    section: "Delivery",
    icon: Network,
    status: "planned",
  },

  sprints: {
    tab: "sprints",
    title: "Sprints",
    description:
      "Development cycles and current delivery commitments.",
    section: "Delivery",
    icon: RefreshCcw,
    status: "planned",
  },

  requirements: {
    tab: "requirements",
    title: "Requirements",
    description:
      "Functional, performance and security requirements across projects.",
    section: "Delivery",
    icon: FileCheck2,
    status: "planned",
  },

  qa: {
    tab: "qa",
    title: "QA",
    description:
      "Testing, quality assurance and release readiness.",
    section: "Delivery",
    icon: ShieldCheck,
    status: "planned",
  },

  /* --------------------------------------------------------------------------
     COMMERCIAL
  -------------------------------------------------------------------------- */

  contracts: {
    tab: "contracts",
    title: "Contracts",
    description:
      "Client agreements, renewals and contractual obligations.",
    section: "Commercial",
    icon: BriefcaseBusiness,
    status: "live",
  },

  quotes: {
    tab: "quotes",
    title: "Quotes",
    description:
      "Commercial estimates and quotations issued to clients.",
    section: "Commercial",
    icon: ReceiptText,
    status: "planned",
  },

  invoices: {
    tab: "invoices",
    title: "Invoices",
    description:
      "Client invoices, payment status and outstanding balances.",
    section: "Commercial",
    icon: FileText,
    status: "planned",
  },

  subscriptions: {
    tab: "subscriptions",
    title: "Subscriptions",
    description:
      "Recurring client services, licences and subscriptions.",
    section: "Commercial",
    icon: RefreshCcw,
    status: "planned",
  },

  expenses: {
    tab: "expenses",
    title: "Expenses",
    description:
      "Operational and project expenditure across the company.",
    section: "Commercial",
    icon: ReceiptText,
    status: "planned",
  },

  finance: {
    tab: "finance",
    title: "Finance",
    description:
      "Banking, transactions and company financial operations.",
    section: "Commercial",
    icon: CircleDollarSign,
    status: "live",
  },

  revenue: {
    tab: "revenue",
    title: "Revenue",
    description:
      "Revenue performance across clients, projects and products.",
    section: "Commercial",
    icon: BarChart3,
    status: "planned",
  },

  /* --------------------------------------------------------------------------
     CLIENT SUCCESS
  -------------------------------------------------------------------------- */

  support: {
    tab: "support",
    title: "Support",
    description:
      "Client support operations and active requests.",
    section: "Client Success",
    icon: Headphones,
    status: "live",
  },

  tickets: {
    tab: "tickets",
    title: "Tickets",
    description:
      "Support tickets across all managed client systems.",
    section: "Client Success",
    icon: TicketCheck,
    status: "planned",
  },

  client_health: {
    tab: "client_health",
    title: "Client Health",
    description:
      "Relationship, support and service health for every client.",
    section: "Client Success",
    icon: Activity,
    status: "planned",
  },

  feedback: {
    tab: "feedback",
    title: "Feedback",
    description:
      "Client feedback, requests and satisfaction signals.",
    section: "Client Success",
    icon: MessageSquareText,
    status: "planned",
  },

  messages: {
    tab: "messages",
    title: "Messages",
    description:
      "Client conversations and internal communication.",
    section: "Client Success",
    icon: MessageSquareText,
    status: "live",
  },

  meetings: {
    tab: "meetings",
    title: "Meetings",
    description:
      "Client meetings, notes and follow up actions.",
    section: "Client Success",
    icon: CalendarDays,
    status: "planned",
  },

  /* --------------------------------------------------------------------------
     ENGINEERING
  -------------------------------------------------------------------------- */

  monitoring: {
    tab: "monitoring",
    title: "Monitoring",
    description:
      "Infrastructure and production platform health.",
    section: "Engineering",
    icon: Activity,
    status: "live",
  },

  deployments: {
    tab: "deployments",
    title: "Deployments",
    description:
      "Production releases and deployment activity.",
    section: "Engineering",
    icon: Rocket,
    status: "live",
  },

  systems: {
    tab: "systems",
    title: "Systems",
    description:
      "Registry of systems operated and maintained by Syntra Grid.",
    section: "Engineering",
    icon: Boxes,
    status: "planned",
  },

  domains: {
    tab: "domains",
    title: "Domains",
    description:
      "Domains, DNS ownership and renewal information.",
    section: "Engineering",
    icon: Globe2,
    status: "planned",
  },

  environments: {
    tab: "environments",
    title: "Environments",
    description:
      "Production, staging and development environments.",
    section: "Engineering",
    icon: CloudCog,
    status: "planned",
  },

  repositories: {
    tab: "repositories",
    title: "Repositories",
    description:
      "Source repositories across company and client projects.",
    section: "Engineering",
    icon: Code2,
    status: "planned",
  },

  incidents: {
    tab: "incidents",
    title: "Incidents",
    description:
      "Production incidents, outages and operational response.",
    section: "Engineering",
    icon: Wrench,
    status: "planned",
  },

  backups: {
    tab: "backups",
    title: "Backups",
    description:
      "Backup coverage and recovery readiness.",
    section: "Engineering",
    icon: RefreshCcw,
    status: "planned",
  },

  /* --------------------------------------------------------------------------
     PRODUCTS
  -------------------------------------------------------------------------- */

  product_portfolio: {
    tab: "product_portfolio",
    title: "Portfolio",
    description:
      "Syntra Grid products and internally owned platforms.",
    section: "Products",
    icon: Boxes,
    status: "planned",
  },

  releases: {
    tab: "releases",
    title: "Releases",
    description:
      "Product versions and release history.",
    section: "Products",
    icon: PackageCheck,
    status: "planned",
  },

  feature_requests: {
    tab: "feature_requests",
    title: "Feature Requests",
    description:
      "Requested improvements across products and client systems.",
    section: "Products",
    icon: Sparkles,
    status: "planned",
  },

  bugs: {
    tab: "bugs",
    title: "Bugs",
    description:
      "Known defects and product engineering issues.",
    section: "Products",
    icon: Wrench,
    status: "planned",
  },

  changelog: {
    tab: "changelog",
    title: "Changelog",
    description:
      "History of meaningful product and platform changes.",
    section: "Products",
    icon: History,
    status: "planned",
  },

  /* --------------------------------------------------------------------------
     GROWTH
  -------------------------------------------------------------------------- */

  seo_analytics: {
    tab: "seo_analytics",
    title: "SEO Analytics",
    description:
      "Search visibility and website performance.",
    section: "Growth",
    icon: Search,
    status: "planned",
  },

  campaigns: {
    tab: "campaigns",
    title: "Campaigns",
    description:
      "Marketing campaigns and growth initiatives.",
    section: "Growth",
    icon: Megaphone,
    status: "planned",
  },

  social_media: {
    tab: "social_media",
    title: "Social Media",
    description:
      "Social channels, publishing and engagement.",
    section: "Growth",
    icon: MessageSquareText,
    status: "planned",
  },

  brand_assets: {
    tab: "brand_assets",
    title: "Brand Assets",
    description:
      "Logos, identity assets and approved brand materials.",
    section: "Growth",
    icon: Sparkles,
    status: "planned",
  },

  /* --------------------------------------------------------------------------
     COMPANY
  -------------------------------------------------------------------------- */

  team: {
    tab: "team",
    title: "Team",
    description:
      "Everyone who works with Syntra Grid, their roles, reporting lines and dashboard access.",
    section: "Company",
    icon: Users,
    status: "live",
  },

  departments: {
    tab: "departments",
    title: "Departments",
    description:
      "Company structure, department leadership and team ownership.",
    section: "Company",
    icon: Building2,
    status: "live",
  },

  workload: {
    tab: "workload",
    title: "Workload",
    description:
      "Team capacity and allocation across company work.",
    section: "Company",
    icon: Activity,
    status: "planned",
  },

  timesheets: {
    tab: "timesheets",
    title: "Timesheets",
    description:
      "Recorded work and time allocation.",
    section: "Company",
    icon: History,
    status: "planned",
  },

  recruitment: {
    tab: "recruitment",
    title: "Recruitment",
    description:
      "Hiring requirements, candidates and recruitment activity.",
    section: "Company",
    icon: UserRoundPlus,
    status: "planned",
  },

  leave: {
    tab: "leave",
    title: "Leave",
    description:
      "Team leave and availability.",
    section: "Company",
    icon: CalendarDays,
    status: "planned",
  },

  /* --------------------------------------------------------------------------
     KNOWLEDGE
  -------------------------------------------------------------------------- */

  documents: {
    tab: "documents",
    title: "Documents",
    description:
      "Company and client documentation.",
    section: "Knowledge",
    icon: FileText,
    status: "planned",
  },

  knowledge_base: {
    tab: "knowledge_base",
    title: "Knowledge Base",
    description:
      "Reusable internal knowledge and technical guidance.",
    section: "Knowledge",
    icon: BookOpen,
    status: "planned",
  },

  sops: {
    tab: "sops",
    title: "SOPs",
    description:
      "Standard operating procedures for recurring work.",
    section: "Knowledge",
    icon: FileCheck2,
    status: "planned",
  },

  research: {
    tab: "research",
    title: "Research",
    description:
      "Research, technical investigations and company intelligence.",
    section: "Knowledge",
    icon: Search,
    status: "planned",
  },

  /* --------------------------------------------------------------------------
     GOVERNANCE
  -------------------------------------------------------------------------- */

  compliance: {
    tab: "compliance",
    title: "Compliance",
    description:
      "Company and client compliance obligations.",
    section: "Governance",
    icon: ShieldCheck,
    status: "planned",
  },

  risks: {
    tab: "risks",
    title: "Risks",
    description:
      "Operational, commercial and technical risk register.",
    section: "Governance",
    icon: Activity,
    status: "planned",
  },

  security: {
    tab: "security",
    title: "Security",
    description:
      "Security posture across Syntra Grid systems.",
    section: "Governance",
    icon: ShieldCheck,
    status: "planned",
  },

  audit_logs: {
    tab: "audit_logs",
    title: "Audit Logs",
    description:
      "Administrative and operational audit history.",
    section: "Governance",
    icon: History,
    status: "planned",
  },

  approvals: {
    tab: "approvals",
    title: "Approvals",
    description:
      "Items awaiting management approval.",
    section: "Governance",
    icon: CheckSquare2,
    status: "planned",
  },

  policies: {
    tab: "policies",
    title: "Policies",
    description:
      "Company policies and governance documentation.",
    section: "Governance",
    icon: FileText,
    status: "planned",
  },

  /* --------------------------------------------------------------------------
     SYSTEM
  -------------------------------------------------------------------------- */

  automations: {
    tab: "automations",
    title: "Automations",
    description:
      "Automated company workflows and operational rules.",
    section: "System",
    icon: Workflow,
    status: "planned",
  },

  integrations: {
    tab: "integrations",
    title: "Integrations",
    description:
      "External services connected to Syntra Grid.",
    section: "System",
    icon: Plug,
    status: "planned",
  },

  roles_permissions: {
    tab: "roles_permissions",
    title: "Roles & Permissions",
    description:
      "Administrative access and permission controls.",
    section: "System",
    icon: ShieldCheck,
    status: "planned",
  },

  api_keys: {
    tab: "api_keys",
    title: "API Keys",
    description:
      "Application credentials and API access management.",
    section: "System",
    icon: KeyRound,
    status: "planned",
  },

  settings: {
    tab: "settings",
    title: "Settings",
    description:
      "Configuration for the whole of Syntra Grid.",
    section: "System",
    icon: Settings,
    status: "live",
  },
};

/* ============================================================================
   SECTION DEFINITIONS
============================================================================ */

type SectionBase = Omit<
  AdminSection,
  "items"
>;

const SECTION_BASES: SectionBase[] = [
  {
    id: "command",
    label: "Command",
    description:
      "Unified company dashboard and operational intelligence.",
    icon: LayoutDashboard,
  },

  {
    id: "crm",
    label: "CRM",
    description:
      "Clients, contacts and commercial opportunities.",
    icon: Building2,
  },

  {
    id: "delivery",
    label: "Delivery",
    description:
      "Projects, work and delivery management.",
    icon: FolderKanban,
  },

  {
    id: "commercial",
    label: "Commercial",
    description:
      "Contracts, billing and financial operations.",
    icon: CircleDollarSign,
  },

  {
    id: "client-success",
    label: "Client Success",
    description:
      "Support, communication and client relationships.",
    icon: Headphones,
  },

  {
    id: "engineering",
    label: "Engineering",
    description:
      "Infrastructure, deployments and production systems.",
    icon: Wrench,
  },

  {
    id: "products",
    label: "Products",
    description:
      "Syntra Grid products, releases and development.",
    icon: Boxes,
  },

  {
    id: "growth",
    label: "Growth",
    description:
      "Website, brand, marketing and acquisition.",
    icon: Megaphone,
  },

  {
    id: "company",
    label: "Company",
    description:
      "People, teams and internal operations.",
    icon: Users,
  },

  {
    id: "knowledge",
    label: "Knowledge",
    description:
      "Documents, procedures and company knowledge.",
    icon: BookOpen,
  },

  {
    id: "governance",
    label: "Governance",
    description:
      "Security, compliance, risk and oversight.",
    icon: ShieldCheck,
  },

  {
    id: "system",
    label: "System",
    description:
      "Integrations, access and platform configuration.",
    icon: Settings,
  },
];

/* ============================================================================
   ADMIN SECTIONS

   IMPORTANT:

   Command retains its complete internal tab registry.

   This is deliberate.

   AdminShell and AdminHeader will hide Command's secondary navigation.

   AdminHome will decide whether to display:
     - Overview
     - Expanded Analytics
     - Expanded Activity
     - Expanded Calendar
     - Expanded Notifications

   Other sections continue using their existing navigation.

   Do not remove the four expandable Command tabs from this registry,
   because existing navigation and search depend on them.
============================================================================ */

export const ADMIN_SECTIONS: AdminSection[] =
  SECTION_BASES.map((section) => ({
    ...section,

    items: Object.values(
      ADMIN_TABS,
    ).filter(
      (tab) =>
        tab.section === section.label,
    ),
  }));

/* ============================================================================
   COMMAND SECTION ACCESSORS
============================================================================ */

/**
 * Returns the Command section.
 */

export function getCommandSection(): AdminSection {
  const section = ADMIN_SECTIONS.find(
    (item) =>
      item.id === COMMAND_SECTION_ID,
  );

  if (!section) {
    throw new Error(
      "Command workspace is not configured.",
    );
  }

  return section;
}

/**
 * Returns the visible top-level navigation entries
 * for a particular section.
 *
 * Command returns only Overview because its other modules
 * are accessed through expandable widgets.
 *
 * Other sections return their normal tabs.
 *
 * This function can be used by AdminHeader and mobile navigation.
 */

export function getVisibleSectionTabs(
  section: AdminSection,
  isFullAccess = true,
): AdminTabDefinition[] {
  if (isCommandSection(section)) {
    // Command always collapses to its Overview-only presentation — for
    // every account, not just full-access ones. Analytics, Activity,
    // Calendar and Notifications are reachable as permission-gated
    // widgets inside Overview (see OverviewTab.tsx's employee branch),
    // never as separate navigation tabs.
    return section.items.filter(
      (item) =>
        item.tab === COMMAND_HOME_TAB,
    );
  }

  return section.items;
}

/**
 * Whether a section should display a horizontal tab bar.
 *
 * Command never displays one, for any caller — Overview's own widgets
 * are the navigation for Analytics, Activity, Calendar and
 * Notifications.
 */

export function shouldShowSectionTabBar(
  section: AdminSection,
  isFullAccess = true,
): boolean {
  if (isCommandSection(section)) {
    return false;
  }

  return section.items.length > 1;
}

/**
 * Returns the default landing tab of a section.
 *
 * Command always opens Overview, for any caller.
 */

export function getSectionLandingTab(
  section: AdminSection,
  isFullAccess = true,
): AdminTab {
  if (isCommandSection(section)) {
    return COMMAND_HOME_TAB;
  }

  return (
    section.items[0]?.tab ??
    COMMAND_HOME_TAB
  );
}

/* ============================================================================
   PERMISSION FILTERING

   Restricted employee dashboard accounts (see
   lib/auth/current-admin.ts getCurrentIdentity/hasPermission) only see
   nav sections/tabs they hold at least a VIEW grant for. Full-access
   callers (every account that existed before the access/permissions
   system, regardless of role) get ADMIN_SECTIONS untouched — this must
   never change what the Owner, or any other pre-existing account, sees.

   The Owner's Overview (COMMAND_HOME_TAB) is hard-excluded here,
   unconditionally — it is never grantable and never appears for a
   restricted caller, regardless of what any grant row might say. The
   employee-specific Overview is designed separately. Every OTHER
   Command tab (Analytics, Activity, Calendar, Notifications) is
   grantable individually like any other module, and — exactly like the
   Owner's — never appears as its own navigation tab; it's reachable
   only as a permission-gated widget inside Overview (see the employee
   branch of OverviewTab.tsx) or via global search. The Command section
   itself is never dropped for having zero granted items (see the
   isCommandSection(section) escape below) so it's always reachable.
============================================================================ */

export function filterSectionsByPermission(
  isFullAccess: boolean,
  hasModuleAccess: (tab: AdminTab) => boolean,
): AdminSection[] {
  if (isFullAccess) {
    return ADMIN_SECTIONS;
  }

  return ADMIN_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        item.tab !== COMMAND_HOME_TAB &&
        hasModuleAccess(item.tab),
    ),
  })).filter(
    (section) =>
      section.items.length > 0 ||
      // Command always survives, even with zero granted modules — her
      // personalised Overview is automatic and must always be reachable
      // from the sidebar, exactly like the Owner's.
      isCommandSection(section),
  );
}

export function filterTabDefinitions(
  sections: AdminSection[],
): Partial<Record<AdminTab, AdminTabDefinition>> {
  return Object.fromEntries(
    sections
      .flatMap((section) => section.items)
      .map((item) => [item.tab, item]),
  ) as Partial<Record<AdminTab, AdminTabDefinition>>;
}

/**
 * Every AdminTab that can be granted to a restricted employee at all,
 * i.e. every tab except the Owner's Overview — derived from ADMIN_TABS
 * at runtime, so a newly added tab is automatically grantable without
 * touching this file again.
 */
export function getGrantableTabs(): AdminTabDefinition[] {
  return Object.values(ADMIN_TABS).filter(
    (item) => item.tab !== COMMAND_HOME_TAB,
  );
}

/**
 * Modules whose backend has actually been updated to consult the
 * permission-grant system (requirePermission / scoped queries) for a
 * restricted identity. A grant for any OTHER module is still stored
 * (the Owner can configure anything, and it takes effect automatically
 * the moment a module is added here) but has no effect yet — nav
 * visibility and every route for that module still fail closed for a
 * restricted account, by default, via requireAdmin()'s own
 * restrictedAccess check (lib/auth/current-admin.ts). Growth placeholder
 * tabs and Analytics/Activity/Notifications are included because they
 * have no backend at all yet (nothing to protect).
 */
export const SECURED_MODULE_KEYS: ReadonlySet<AdminTab> = new Set([
  "team",
  "leave",
  "calendar",
  "analytics",
  "activity",
  "notifications",
  "social_media",
  "campaigns",
  "brand_assets",
  "seo_analytics",
]);

export function isModuleSecured(tab: AdminTab): boolean {
  return SECURED_MODULE_KEYS.has(tab);
}

/* ============================================================================
   TAB HELPERS
============================================================================ */

/**
 * Validates any tab identifier.
 */

export function isAdminTab(
  value: string | null | undefined,
): value is AdminTab {
  if (!value) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(
    ADMIN_TABS,
    value,
  );
}

/**
 * Resolves the tab from the URL.
 *
 * Examples:
 *
 * /admin
 *   -> overview
 *
 * /admin?tab=overview
 *   -> overview
 *
 * /admin?tab=analytics
 *   -> analytics
 *
 * /admin?tab=calendar
 *   -> calendar
 *
 * /admin?tab=clients
 *   -> clients
 *
 * Invalid tabs fall back to Overview.
 *
 * Existing deep links remain compatible.
 */

export function adminTabFromSearchParam(
  value: string | null | undefined,
): AdminTab {
  return isAdminTab(value)
    ? value
    : COMMAND_HOME_TAB;
}

/**
 * Finds the parent workspace for any tab.
 *
 * All Command modules resolve to Command.
 */

export function findSectionForTab(
  tab: AdminTab,
): AdminSection {
  return (
    ADMIN_SECTIONS.find(
      (section) =>
        section.items.some(
          (item) =>
            item.tab === tab,
        ),
    ) ?? ADMIN_SECTIONS[0]
  );
}

/**
 * Returns the correct navigation destination
 * when entering a workspace from the sidebar.
 *
 * Command:
 *   Always Overview.
 *
 * Other workspaces:
 *   Their configured landing tab.
 */

export function getSidebarNavigationTarget(
  section: AdminSection,
): AdminTab {
  return getSectionLandingTab(section);
}

/**
 * Returns the title used in the main workspace header.
 *
 * Command:
 *   Always "Command".
 *
 * Other sections:
 *   Existing section labels.
 */

export function getWorkspaceHeaderTitle(
  tab: AdminTab,
): string {
  const section =
    findSectionForTab(tab);

  if (isCommandSection(section)) {
    return "Command";
  }

  return section.label;
}

/**
 * Determines whether the content should use
 * the maximised Command workspace layout.
 *
 * This includes the Overview and all four
 * expanded modules.
 */

export function shouldUseCommandLayout(
  tab: AdminTab,
): boolean {
  return isCommandTab(tab);
}

/**
 * Returns the module definition for an expanded
 * Command tab.
 */

export function getCommandModule(
  tab: AdminTab,
): CommandModuleDefinition | null {
  if (!isCommandExpandedTab(tab)) {
    return null;
  }

  return COMMAND_MODULES[tab];
}

/**
 * Determines whether clicking Close should
 * return the user to Overview.
 */

export function canCloseCommandModule(
  tab: AdminTab,
): boolean {
  return isCommandExpandedTab(tab);
}

/* ============================================================================
   NAVIGATION ORDER

   Used for determining transition direction.

   The order remains consistent with ADMIN_SECTIONS.

   Command modules are included because they remain
   valid navigation destinations even though their
   tab bar is hidden.
============================================================================ */

export const ADMIN_TAB_ORDER: AdminTab[] =
  ADMIN_SECTIONS.flatMap(
    (section) =>
      section.items.map(
        (item) => item.tab,
      ),
  );

/* ============================================================================
   COMMAND NAVIGATION HELPERS
============================================================================ */

/**
 * Opens a Command module.
 *
 * Returns the requested tab identifier when it belongs
 * to Command, otherwise falls back to Overview.
 *
 * This helper does not perform navigation itself.
 *
 * AdminHome remains responsible for synchronising:
 * - React state
 * - URL
 * - Browser history
 * - Transitions
 */

export function resolveCommandDestination(
  requestedTab: AdminTab,
): CommandTab {
  return isCommandTab(requestedTab)
    ? requestedTab
    : COMMAND_HOME_TAB;
}

/**
 * Returns the destination when an expanded
 * Command module is closed.
 */

export function getCommandCloseDestination(): CommandTab {
  return COMMAND_HOME_TAB;
}

/**
 * Determines whether a navigation event represents
 * opening a Command module from Overview.
 */

export function isOpeningCommandModule(
  currentTab: AdminTab,
  nextTab: AdminTab,
): boolean {
  return (
    currentTab === COMMAND_HOME_TAB &&
    isCommandExpandedTab(nextTab)
  );
}

/**
 * Determines whether a navigation event represents
 * closing an expanded Command module.
 */

export function isClosingCommandModule(
  currentTab: AdminTab,
  nextTab: AdminTab,
): boolean {
  return (
    isCommandExpandedTab(currentTab) &&
    nextTab === COMMAND_HOME_TAB
  );
}

/**
 * Determines whether navigation stays inside
 * the Command workspace.
 */

export function isCommandInternalNavigation(
  currentTab: AdminTab,
  nextTab: AdminTab,
): boolean {
  return (
    isCommandTab(currentTab) &&
    isCommandTab(nextTab)
  );
}

/* ============================================================================
   END
============================================================================ */