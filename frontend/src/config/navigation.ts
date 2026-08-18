import {
  ArrowDownLeft,
  ArrowUpRight,
  LayoutDashboard,
  Palette,
  Receipt,
  Settings,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { WorkspaceRole } from '@/types'

export interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  /** Omit to allow every role. */
  roles?: WorkspaceRole[]
  items?: NavItem[]
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

/**
 * The single source of truth for the sidebar, the breadcrumbs and the command
 * palette - so a new page can never appear in one and be missing from another.
 */
export const navigation: NavGroup[] = [
  {
    title: 'General',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
      {
        title: 'Billing',
        url: '/billing',
        icon: Receipt,
        items: [
          { title: 'All Bills', url: '/billing', icon: Wallet },
          { title: 'Received', url: '/billing/received', icon: ArrowDownLeft },
          { title: 'Spent', url: '/billing/spent', icon: ArrowUpRight },
        ],
      },
      { title: 'Users', url: '/users', icon: Users },
    ],
  },
  {
    title: 'Workspace',
    items: [
      {
        title: 'Settings',
        url: '/settings/profile',
        icon: Settings,
        items: [
          { title: 'Profile', url: '/settings/profile', icon: User },
          { title: 'Appearance', url: '/settings/appearance', icon: Palette },
          { title: 'Accounts', url: '/settings/accounts', icon: ShieldCheck },
        ],
      },
    ],
  },
]

/** Human labels for route segments, used to build breadcrumbs. */
export const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  billing: 'Billing',
  received: 'Received',
  spent: 'Spent',
  users: 'Users',
  settings: 'Settings',
  profile: 'Profile',
  appearance: 'Appearance',
  accounts: 'Accounts',
  workspaces: 'Workspaces',
  onboarding: 'Onboarding',
}
