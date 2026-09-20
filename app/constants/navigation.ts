import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Camera,
  CircleDollarSign,
  CloudCog,
  FileSignature,
  FolderKanban,
  Headphones,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type DashboardNavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

export type DashboardSection = {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  items: DashboardNavigationItem[];
};

export const dashboardSections: DashboardSection[] = [
  {
    id: 'command',
    label: 'Command Centre',
    shortLabel: 'Command',
    icon: LayoutDashboard,
    description: 'Company-wide performance, activity and intelligence.',
    items: [
      {
        label: 'Overview',
        href: '/dashboard',
        icon: LayoutDashboard,
        description: 'View company performance and recent activity.',
      },
      {
        label: 'Analytics',
        href: '/analytics',
        icon: BarChart3,
        description:
          'Analyse revenue, client growth, project performance and platform activity.',
      },
    ],
  },

  {
    id: 'clients',
    label: 'Clients',
    shortLabel: 'Clients',
    icon: Building2,
    description: 'Manage relationships, communication and client accounts.',
    items: [
      {
        label: 'Clients',
        href: '/clients',
        icon: Building2,
        description: 'Manage client records, contacts and account status.',
      },
      {
        label: 'Messages',
        href: '/messages',
        icon: MessagesSquare,
        description: 'View and respond to client conversations.',
      },
    ],
  },

  {
    id: 'delivery',
    label: 'Delivery',
    shortLabel: 'Delivery',
    icon: FolderKanban,
    description: 'Manage projects, delivery and client support.',
    items: [
      {
        label: 'Projects',
        href: '/projects',
        icon: FolderKanban,
        description: 'Track client systems, delivery progress and maintenance.',
      },
      {
        label: 'Support',
        href: '/support',
        icon: Headphones,
        description: 'Manage client support requests and open tickets.',
      },
    ],
  },

  {
    id: 'commercial',
    label: 'Commercial',
    shortLabel: 'Commercial',
    icon: BriefcaseBusiness,
    description: 'Contracts, finance and commercial operations.',
    items: [
      {
        label: 'Contracts',
        href: '/contracts',
        icon: FileSignature,
        description: 'Manage agreements, signatures, values and renewals.',
      },
      {
        label: 'Finance',
        href: '/finance',
        icon: CircleDollarSign,
        description: 'Review revenue, invoices, expenses and bank activity.',
      },
    ],
  },

  {
    id: 'engineering',
    label: 'Engineering',
    shortLabel: 'Engineering',
    icon: CloudCog,
    description: 'Production systems, health and deployments.',
    items: [
      {
        label: 'Monitoring',
        href: '/monitoring',
        icon: Activity,
        description: 'Monitor uptime, system health and integrations.',
      },
      {
        label: 'Deployments',
        href: '/deployments',
        icon: CloudCog,
        description: 'Review releases, environments and deployment activity.',
      },
    ],
  },

  {
    id: 'growth',
    label: 'Growth & Brand',
    shortLabel: 'Growth',
    icon: Megaphone,
    description: 'Website, media, brand and growth operations.',
    items: [
      {
        label: 'Website & Media',
        href: '/website-media',
        icon: Camera,
        description: 'Manage website images, videos and other media assets.',
      },
    ],
  },

  {
    id: 'company',
    label: 'Company',
    shortLabel: 'Company',
    icon: Users,
    description: 'People, access and internal company operations.',
    items: [
      {
        label: 'Team',
        href: '/team',
        icon: Users,
        description: 'Manage administrators, roles and permissions.',
      },
    ],
  },
];

export const systemNavigation: DashboardNavigationItem[] = [
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Manage Syntra Grid system and account settings.',
  },
];

export const dashboardNavigation = [
  ...dashboardSections.flatMap((section) => section.items),
  ...systemNavigation,
];

export function isNavigationItemActive(
  pathname: string,
  href: string,
) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findActiveSection(pathname: string) {
  return (
    dashboardSections.find((section) =>
      section.items.some((item) =>
        isNavigationItemActive(pathname, item.href),
      ),
    ) ?? null
  );
}

export function findActiveNavigationItem(pathname: string) {
  return (
    dashboardNavigation.find((item) =>
      isNavigationItemActive(pathname, item.href),
    ) ?? null
  );
}

export function findSectionById(id: string) {
  return dashboardSections.find((section) => section.id === id) ?? null;
}

export const navigationMeta = {
  product: 'Syntra Grid',
  workspace: 'Company OS',
  securityIcon: ShieldCheck,
};