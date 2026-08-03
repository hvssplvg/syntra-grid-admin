import {
  Activity,
  BarChart3,
  Building2,
  CircleDollarSign,
  CloudCog,
  FileSignature,
  FolderKanban,
  Headphones,
  LayoutDashboard,
  MessagesSquare,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type DashboardNavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

export const dashboardNavigation: DashboardNavigationItem[] = [
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
  {
    label: 'Clients',
    href: '/clients',
    icon: Building2,
    description: 'Manage client records, contacts and account status.',
  },
  {
    label: 'Contracts',
    href: '/contracts',
    icon: FileSignature,
    description: 'Manage agreements, signatures, values and renewals.',
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    description: 'Track client systems, delivery progress and maintenance.',
  },
  {
    label: 'Finance',
    href: '/finance',
    icon: CircleDollarSign,
    description: 'Review revenue, invoices, expenses and bank activity.',
  },
  {
    label: 'Support',
    href: '/support',
    icon: Headphones,
    description: 'Manage client support requests and open tickets.',
  },
  {
    label: 'Messages',
    href: '/messages',
    icon: MessagesSquare,
    description: 'View and respond to client conversations.',
  },
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
  {
    label: 'Team',
    href: '/team',
    icon: Users,
    description: 'Manage administrators, roles and permissions.',
  },
];