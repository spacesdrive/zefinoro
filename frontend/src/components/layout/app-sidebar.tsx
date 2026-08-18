import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { navigation, type NavItem } from '@/config/navigation'
import { WorkspaceSwitcher } from './workspace-switcher'
import { NavUser } from './nav-user'
import { useWorkspace } from '@/contexts/workspace-context'

/**
 * Decide whether a nav entry represents the current page.
 *
 * Exact matching for leaf links, because `/billing` must not stay highlighted
 * while the user is on `/billing/received` - both would otherwise look active.
 */
function useIsActive() {
  const { pathname } = useLocation()

  return (url: string, hasChildren = false) => {
    if (hasChildren) return pathname === url || pathname.startsWith(`${url}/`)
    return pathname === url
  }
}

function NavEntry({ item }: { item: NavItem }) {
  const isActive = useIsActive()
  const { pathname } = useLocation()

  if (!item.items?.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
          <Link to={item.url}>
            {item.icon && <item.icon aria-hidden="true" />}
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  const sectionOpen = item.items.some((child) => pathname === child.url) || isActive(item.url, true)

  return (
    <Collapsible asChild defaultOpen={sectionOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={isActive(item.url, true)}>
            {item.icon && <item.icon aria-hidden="true" />}
            <span>{item.title}</span>
            <ChevronRight
              className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
              aria-hidden="true"
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((child) => (
              <SidebarMenuSubItem key={child.url}>
                <SidebarMenuSubButton asChild isActive={pathname === child.url}>
                  <Link to={child.url}>
                    {child.icon && <child.icon aria-hidden="true" />}
                    <span>{child.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function AppSidebar() {
  const { role } = useWorkspace()

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((group) => {
          const visible = group.items.filter(
            (item) => !item.roles || (role && item.roles.includes(role))
          )
          if (visible.length === 0) return null

          return (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              <SidebarMenu>
                {visible.map((item) => (
                  <NavEntry key={item.title} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
