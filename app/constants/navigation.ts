import {
  Activity,
  Building2,
  CircleDollarSign,
  CloudCog,
  FolderKanban,
  Headphones,
  LayoutDashboard,
  MessagesSquare,
  Settings,
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
  },
  {
    label: 'Clients',
    href: '/clients',
    icon: Building2,
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    label: 'Monitoring',
    href: '/monitoring',
    icon: Activity,
  },
  {
    label: 'Deployments',
    href: '/deployments',
    icon: CloudCog,
  },
  {
    label: 'Support',
    href: '/support',
    icon: Headphones,
  },
  {
    label: 'Finance',
    href: '/finance',
    icon: CircleDollarSign,
  },
  {
    label: 'Team',
    href: '/team',
    icon: Users,
  },
   
  {

  label: 'Messages',

  href: '/messages',

  icon: MessagesSquare,

},

  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];