import { NavLink, Outlet } from 'react-router-dom'
import { Palette, ShieldCheck, User } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/components/common/page-header'
import { cn } from '@/lib/utils'

const SETTINGS_NAV = [
  { title: 'Profile', url: '/settings/profile', icon: User },
  { title: 'Appearance', url: '/settings/appearance', icon: Palette },
  { title: 'Accounts', url: '/settings/accounts', icon: ShieldCheck },
]

/**
 * Settings frame: a vertical nav beside the active panel on desktop, which
 * becomes a horizontal scroller on narrow screens.
 */
export default function SettingsLayout() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account, appearance and workspace preferences."
      />

      <Separator />

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <nav
          aria-label="Settings sections"
          className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:w-48 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0"
        >
          {SETTINGS_NAV.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              className={({ isActive }) =>
                cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )
              }
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.title}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
