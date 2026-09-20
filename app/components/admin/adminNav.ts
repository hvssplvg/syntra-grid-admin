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
} from 'lucide-react';

/* ============================================================================
   CORE TYPES
============================================================================ */

export type AdminTab =
  | 'overview'
  | 'analytics'
  | 'activity'
  | 'calendar'
  | 'notifications'
  | 'clients'
  | 'contacts'
  | 'leads'
  | 'opportunities'
  | 'pipeline'
  | 'proposals'
  | 'projects'
  | 'tasks'
  | 'milestones'
  | 'roadmaps'
  | 'sprints'
  | 'requirements'
  | 'qa'
  | 'contracts'
  | 'quotes'
  | 'invoices'
  | 'subscriptions'
  | 'expenses'
  | 'finance'
  | 'revenue'
  | 'support'
  | 'tickets'
  | 'client_health'
  | 'feedback'
  | 'messages'
  | 'meetings'
  | 'monitoring'
  | 'deployments'
  | 'systems'
  | 'domains'
  | 'environments'
  | 'repositories'
  | 'incidents'
  | 'backups'
  | 'product_portfolio'
  | 'releases'
  | 'feature_requests'
  | 'bugs'
  | 'changelog'
  | 'website_media'
  | 'seo_analytics'
  | 'campaigns'
  | 'social_media'
  | 'brand_assets'
  | 'team'
  | 'departments'
  | 'workload'
  | 'timesheets'
  | 'recruitment'
  | 'leave'
  | 'documents'
  | 'knowledge_base'
  | 'sops'
  | 'research'
  | 'compliance'
  | 'risks'
  | 'security'
  | 'audit_logs'
  | 'approvals'
  | 'policies'
  | 'automations'
  | 'integrations'
  | 'roles_permissions'
  | 'api_keys'
  | 'settings';

export type AdminSectionId =
  | 'command'
  | 'crm'
  | 'delivery'
  | 'commercial'
  | 'client-success'
  | 'engineering'
  | 'products'
  | 'growth'
  | 'company'
  | 'knowledge'
  | 'governance'
  | 'system';

export type AdminSectionLabel =
  | 'Command'
  | 'CRM'
  | 'Delivery'
  | 'Commercial'
  | 'Client Success'
  | 'Engineering'
  | 'Products'
  | 'Growth'
  | 'Company'
  | 'Knowledge'
  | 'Governance'
  | 'System';

export type AdminModuleStatus =
  | 'live'
  | 'planned';

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
   TAB DEFINITIONS
============================================================================ */

export const ADMIN_TABS: Record<
  AdminTab,
  AdminTabDefinition
> = {
  overview: {
    tab: 'overview',
    title: 'Overview',
    description:
      'Company-wide operations, performance and anything requiring attention.',
    section: 'Command',
    icon: LayoutDashboard,
    status: 'live',
  },

  analytics: {
    tab: 'analytics',
    title: 'Analytics',
    description:
      'Company performance, growth and operational intelligence.',
    section: 'Command',
    icon: BarChart3,
    status: 'live',
  },

  activity: {
    tab: 'activity',
    title: 'Activity',
    description:
      'A company-wide timeline of important actions and changes.',
    section: 'Command',
    icon: Activity,
    status: 'planned',
  },

  calendar: {
    tab: 'calendar',
    title: 'Calendar',
    description:
      'Meetings, deadlines, milestones and important company dates.',
    section: 'Command',
    icon: CalendarDays,
    status: 'planned',
  },

  notifications: {
    tab: 'notifications',
    title: 'Notifications',
    description:
      'Operational alerts and notifications requiring attention.',
    section: 'Command',
    icon: Sparkles,
    status: 'planned',
  },

  clients: {
    tab: 'clients',
    title: 'Clients',
    description:
      'Client accounts, platforms and commercial relationships.',
    section: 'CRM',
    icon: Building2,
    status: 'live',
  },

  contacts: {
    tab: 'contacts',
    title: 'Contacts',
    description:
      'People and decision-makers across client organisations.',
    section: 'CRM',
    icon: Users,
    status: 'planned',
  },

  leads: {
    tab: 'leads',
    title: 'Leads',
    description:
      'Potential clients and incoming commercial opportunities.',
    section: 'CRM',
    icon: UserRoundPlus,
    status: 'planned',
  },

  opportunities: {
    tab: 'opportunities',
    title: 'Opportunities',
    description:
      'Qualified business opportunities and their potential value.',
    section: 'CRM',
    icon: Target,
    status: 'planned',
  },

  pipeline: {
    tab: 'pipeline',
    title: 'Pipeline',
    description:
      'Track commercial opportunities through the sales process.',
    section: 'CRM',
    icon: GitBranch,
    status: 'planned',
  },

  proposals: {
    tab: 'proposals',
    title: 'Proposals',
    description:
      'Client proposals, scopes and commercial offers.',
    section: 'CRM',
    icon: FileText,
    status: 'planned',
  },

  projects: {
    tab: 'projects',
    title: 'Projects',
    description:
      'Client and internal projects delivered by Syntra Grid.',
    section: 'Delivery',
    icon: FolderKanban,
    status: 'live',
  },

  tasks: {
    tab: 'tasks',
    title: 'Tasks',
    description:
      'Work items across projects and internal operations.',
    section: 'Delivery',
    icon: CheckSquare2,
    status: 'planned',
  },

  milestones: {
    tab: 'milestones',
    title: 'Milestones',
    description:
      'Major project targets, deadlines and delivery checkpoints.',
    section: 'Delivery',
    icon: Target,
    status: 'planned',
  },

  roadmaps: {
    tab: 'roadmaps',
    title: 'Roadmaps',
    description:
      'Long-term delivery plans across products and client systems.',
    section: 'Delivery',
    icon: Network,
    status: 'planned',
  },

  sprints: {
    tab: 'sprints',
    title: 'Sprints',
    description:
      'Development cycles and current delivery commitments.',
    section: 'Delivery',
    icon: RefreshCcw,
    status: 'planned',
  },

  requirements: {
    tab: 'requirements',
    title: 'Requirements',
    description:
      'Functional and non-functional requirements across projects.',
    section: 'Delivery',
    icon: FileCheck2,
    status: 'planned',
  },

  qa: {
    tab: 'qa',
    title: 'QA',
    description:
      'Testing, quality assurance and release readiness.',
    section: 'Delivery',
    icon: ShieldCheck,
    status: 'planned',
  },

  contracts: {
    tab: 'contracts',
    title: 'Contracts',
    description:
      'Client agreements, renewals and contractual obligations.',
    section: 'Commercial',
    icon: BriefcaseBusiness,
    status: 'live',
  },

  quotes: {
    tab: 'quotes',
    title: 'Quotes',
    description:
      'Commercial estimates and quotations issued to clients.',
    section: 'Commercial',
    icon: ReceiptText,
    status: 'planned',
  },

  invoices: {
    tab: 'invoices',
    title: 'Invoices',
    description:
      'Client invoices, payment status and outstanding balances.',
    section: 'Commercial',
    icon: FileText,
    status: 'planned',
  },

  subscriptions: {
    tab: 'subscriptions',
    title: 'Subscriptions',
    description:
      'Recurring client services, licences and subscriptions.',
    section: 'Commercial',
    icon: RefreshCcw,
    status: 'planned',
  },

  expenses: {
    tab: 'expenses',
    title: 'Expenses',
    description:
      'Operational and project-related company expenditure.',
    section: 'Commercial',
    icon: ReceiptText,
    status: 'planned',
  },

  finance: {
    tab: 'finance',
    title: 'Finance',
    description:
      'Banking, transactions and company financial operations.',
    section: 'Commercial',
    icon: CircleDollarSign,
    status: 'live',
  },

  revenue: {
    tab: 'revenue',
    title: 'Revenue',
    description:
      'Revenue performance across clients, projects and products.',
    section: 'Commercial',
    icon: BarChart3,
    status: 'planned',
  },

  support: {
    tab: 'support',
    title: 'Support',
    description:
      'Client support operations and active requests.',
    section: 'Client Success',
    icon: Headphones,
    status: 'live',
  },

  tickets: {
    tab: 'tickets',
    title: 'Tickets',
    description:
      'Support tickets across all managed client systems.',
    section: 'Client Success',
    icon: TicketCheck,
    status: 'planned',
  },

  client_health: {
    tab: 'client_health',
    title: 'Client Health',
    description:
      'Relationship, support and service health for every client.',
    section: 'Client Success',
    icon: Activity,
    status: 'planned',
  },

  feedback: {
    tab: 'feedback',
    title: 'Feedback',
    description:
      'Client feedback, requests and satisfaction signals.',
    section: 'Client Success',
    icon: MessageSquareText,
    status: 'planned',
  },

  messages: {
    tab: 'messages',
    title: 'Messages',
    description:
      'Client conversations and internal communication.',
    section: 'Client Success',
    icon: MessageSquareText,
    status: 'live',
  },

  meetings: {
    tab: 'meetings',
    title: 'Meetings',
    description:
      'Client meetings, notes and follow-up actions.',
    section: 'Client Success',
    icon: CalendarDays,
    status: 'planned',
  },

  monitoring: {
    tab: 'monitoring',
    title: 'Monitoring',
    description:
      'Infrastructure and production platform health.',
    section: 'Engineering',
    icon: Activity,
    status: 'live',
  },

  deployments: {
    tab: 'deployments',
    title: 'Deployments',
    description:
      'Production releases and deployment activity.',
    section: 'Engineering',
    icon: Rocket,
    status: 'live',
  },

  systems: {
    tab: 'systems',
    title: 'Systems',
    description:
      'Registry of systems operated and maintained by Syntra Grid.',
    section: 'Engineering',
    icon: Boxes,
    status: 'planned',
  },

  domains: {
    tab: 'domains',
    title: 'Domains',
    description:
      'Domains, DNS ownership and renewal information.',
    section: 'Engineering',
    icon: Globe2,
    status: 'planned',
  },

  environments: {
    tab: 'environments',
    title: 'Environments',
    description:
      'Production, staging and development environments.',
    section: 'Engineering',
    icon: CloudCog,
    status: 'planned',
  },

  repositories: {
    tab: 'repositories',
    title: 'Repositories',
    description:
      'Source repositories across company and client projects.',
    section: 'Engineering',
    icon: Code2,
    status: 'planned',
  },

  incidents: {
    tab: 'incidents',
    title: 'Incidents',
    description:
      'Production incidents, outages and operational response.',
    section: 'Engineering',
    icon: Wrench,
    status: 'planned',
  },

  backups: {
    tab: 'backups',
    title: 'Backups',
    description:
      'Backup coverage and recovery readiness.',
    section: 'Engineering',
    icon: RefreshCcw,
    status: 'planned',
  },

  product_portfolio: {
    tab: 'product_portfolio',
    title: 'Portfolio',
    description:
      'Syntra Grid products and internally owned platforms.',
    section: 'Products',
    icon: Boxes,
    status: 'planned',
  },

  releases: {
    tab: 'releases',
    title: 'Releases',
    description:
      'Product versions and release history.',
    section: 'Products',
    icon: PackageCheck,
    status: 'planned',
  },

  feature_requests: {
    tab: 'feature_requests',
    title: 'Feature Requests',
    description:
      'Requested improvements across products and client systems.',
    section: 'Products',
    icon: Sparkles,
    status: 'planned',
  },

  bugs: {
    tab: 'bugs',
    title: 'Bugs',
    description:
      'Known defects and product engineering issues.',
    section: 'Products',
    icon: Wrench,
    status: 'planned',
  },

  changelog: {
    tab: 'changelog',
    title: 'Changelog',
    description:
      'History of meaningful product and platform changes.',
    section: 'Products',
    icon: History,
    status: 'planned',
  },

  website_media: {
    tab: 'website_media',
    title: 'Website & Media',
    description:
      'Syntra Grid website projects and media management.',
    section: 'Growth',
    icon: Globe2,
    status: 'live',
  },

  seo_analytics: {
    tab: 'seo_analytics',
    title: 'SEO Analytics',
    description:
      'Search visibility and website performance.',
    section: 'Growth',
    icon: Search,
    status: 'planned',
  },

  campaigns: {
    tab: 'campaigns',
    title: 'Campaigns',
    description:
      'Marketing campaigns and growth initiatives.',
    section: 'Growth',
    icon: Megaphone,
    status: 'planned',
  },

  social_media: {
    tab: 'social_media',
    title: 'Social Media',
    description:
      'Social channels, publishing and engagement.',
    section: 'Growth',
    icon: MessageSquareText,
    status: 'planned',
  },

  brand_assets: {
    tab: 'brand_assets',
    title: 'Brand Assets',
    description:
      'Logos, identity assets and approved brand materials.',
    section: 'Growth',
    icon: Sparkles,
    status: 'planned',
  },

  team: {
    tab: 'team',
    title: 'Team',
    description:
      'Syntra Grid administrators, people and access.',
    section: 'Company',
    icon: Users,
    status: 'live',
  },

  departments: {
    tab: 'departments',
    title: 'Departments',
    description:
      'Company structure, departments and responsibilities.',
    section: 'Company',
    icon: Building2,
    status: 'planned',
  },

  workload: {
    tab: 'workload',
    title: 'Workload',
    description:
      'Team capacity and allocation across company work.',
    section: 'Company',
    icon: Activity,
    status: 'planned',
  },

  timesheets: {
    tab: 'timesheets',
    title: 'Timesheets',
    description:
      'Recorded work and time allocation.',
    section: 'Company',
    icon: History,
    status: 'planned',
  },

  recruitment: {
    tab: 'recruitment',
    title: 'Recruitment',
    description:
      'Hiring requirements, candidates and recruitment activity.',
    section: 'Company',
    icon: UserRoundPlus,
    status: 'planned',
  },

  leave: {
    tab: 'leave',
    title: 'Leave',
    description:
      'Team leave and availability.',
    section: 'Company',
    icon: CalendarDays,
    status: 'planned',
  },

  documents: {
    tab: 'documents',
    title: 'Documents',
    description:
      'Company and client documentation.',
    section: 'Knowledge',
    icon: FileText,
    status: 'planned',
  },

  knowledge_base: {
    tab: 'knowledge_base',
    title: 'Knowledge Base',
    description:
      'Reusable internal knowledge and technical guidance.',
    section: 'Knowledge',
    icon: BookOpen,
    status: 'planned',
  },

  sops: {
    tab: 'sops',
    title: 'SOPs',
    description:
      'Standard operating procedures for recurring work.',
    section: 'Knowledge',
    icon: FileCheck2,
    status: 'planned',
  },

  research: {
    tab: 'research',
    title: 'Research',
    description:
      'Research, technical investigations and company intelligence.',
    section: 'Knowledge',
    icon: Search,
    status: 'planned',
  },

  compliance: {
    tab: 'compliance',
    title: 'Compliance',
    description:
      'Company and client compliance obligations.',
    section: 'Governance',
    icon: ShieldCheck,
    status: 'planned',
  },

  risks: {
    tab: 'risks',
    title: 'Risks',
    description:
      'Operational, commercial and technical risk register.',
    section: 'Governance',
    icon: Activity,
    status: 'planned',
  },

  security: {
    tab: 'security',
    title: 'Security',
    description:
      'Security posture across Syntra Grid systems.',
    section: 'Governance',
    icon: ShieldCheck,
    status: 'planned',
  },

  audit_logs: {
    tab: 'audit_logs',
    title: 'Audit Logs',
    description:
      'Administrative and operational audit history.',
    section: 'Governance',
    icon: History,
    status: 'planned',
  },

  approvals: {
    tab: 'approvals',
    title: 'Approvals',
    description:
      'Items awaiting management approval.',
    section: 'Governance',
    icon: CheckSquare2,
    status: 'planned',
  },

  policies: {
    tab: 'policies',
    title: 'Policies',
    description:
      'Company policies and governance documentation.',
    section: 'Governance',
    icon: FileText,
    status: 'planned',
  },

  automations: {
    tab: 'automations',
    title: 'Automations',
    description:
      'Automated company workflows and operational rules.',
    section: 'System',
    icon: Workflow,
    status: 'planned',
  },

  integrations: {
    tab: 'integrations',
    title: 'Integrations',
    description:
      'External services connected to Syntra Grid.',
    section: 'System',
    icon: Plug,
    status: 'planned',
  },

  roles_permissions: {
    tab: 'roles_permissions',
    title: 'Roles & Permissions',
    description:
      'Administrative access and permission controls.',
    section: 'System',
    icon: ShieldCheck,
    status: 'planned',
  },

  api_keys: {
    tab: 'api_keys',
    title: 'API Keys',
    description:
      'Application credentials and API access management.',
    section: 'System',
    icon: KeyRound,
    status: 'planned',
  },

  settings: {
    tab: 'settings',
    title: 'Settings',
    description:
      'Company-wide Syntra Grid configuration.',
    section: 'System',
    icon: Settings,
    status: 'live',
  },
};

/* ============================================================================
   SECTION DEFINITIONS
============================================================================ */

type SectionBase = Omit<
  AdminSection,
  'items'
>;

const SECTION_BASES: SectionBase[] = [
  {
    id: 'command',
    label: 'Command',
    description:
      'Company overview and operational intelligence.',
    icon: LayoutDashboard,
  },
  {
    id: 'crm',
    label: 'CRM',
    description:
      'Clients, contacts and commercial opportunities.',
    icon: Building2,
  },
  {
    id: 'delivery',
    label: 'Delivery',
    description:
      'Projects, work and delivery management.',
    icon: FolderKanban,
  },
  {
    id: 'commercial',
    label: 'Commercial',
    description:
      'Contracts, billing and financial operations.',
    icon: CircleDollarSign,
  },
  {
    id: 'client-success',
    label: 'Client Success',
    description:
      'Support, communication and client relationships.',
    icon: Headphones,
  },
  {
    id: 'engineering',
    label: 'Engineering',
    description:
      'Infrastructure, deployments and production systems.',
    icon: Wrench,
  },
  {
    id: 'products',
    label: 'Products',
    description:
      'Syntra Grid products, releases and development.',
    icon: Boxes,
  },
  {
    id: 'growth',
    label: 'Growth',
    description:
      'Website, brand, marketing and acquisition.',
    icon: Megaphone,
  },
  {
    id: 'company',
    label: 'Company',
    description:
      'People, teams and internal operations.',
    icon: Users,
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    description:
      'Documents, procedures and company knowledge.',
    icon: BookOpen,
  },
  {
    id: 'governance',
    label: 'Governance',
    description:
      'Security, compliance, risk and oversight.',
    icon: ShieldCheck,
  },
  {
    id: 'system',
    label: 'System',
    description:
      'Integrations, access and platform configuration.',
    icon: Settings,
  },
];

export const ADMIN_SECTIONS: AdminSection[] =
  SECTION_BASES.map((section) => ({
    ...section,
    items: Object.values(
      ADMIN_TABS,
    ).filter(
      (tab) =>
        tab.section ===
        section.label,
    ),
  }));

/* ============================================================================
   HELPERS
============================================================================ */

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

export function adminTabFromSearchParam(
  value: string | null | undefined,
): AdminTab {
  return isAdminTab(value)
    ? value
    : 'overview';
}

export function findSectionForTab(
  tab: AdminTab,
): AdminSection {
  return (
    ADMIN_SECTIONS.find((section) =>
      section.items.some(
        (item) =>
          item.tab === tab,
      ),
    ) ?? ADMIN_SECTIONS[0]
  );
}