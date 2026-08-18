import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronsUpDown, Plus, UserPlus, Wallet } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useWorkspace } from '@/contexts/workspace-context'
import { initialsOf } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Workspace selector.
 *
 * Switching is routed through the workspace context so the previous tenant's
 * cached queries are evicted before the new dashboard renders.
 */
export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspace()
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!currentWorkspace) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" onClick={() => navigate('/onboarding')}>
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Wallet className="size-4" aria-hidden="true" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">No workspace</span>
              <span className="text-muted-foreground truncate text-xs">Create one to begin</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={`Current workspace: ${currentWorkspace.name}. Switch workspace`}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                {currentWorkspace.avatarUrl && (
                  <AvatarImage src={currentWorkspace.avatarUrl} alt="" className="object-cover" />
                )}
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground rounded-lg text-xs font-medium">
                  {initialsOf(currentWorkspace.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{currentWorkspace.name}</span>
                <span className="text-muted-foreground truncate text-xs capitalize">
                  {currentWorkspace.role}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Workspaces
            </DropdownMenuLabel>

            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onSelect={() => switchWorkspace(workspace.id)}
                className="gap-2 p-2"
              >
                <Avatar className="size-6 rounded-md">
                  {workspace.avatarUrl && <AvatarImage src={workspace.avatarUrl} alt="" className="object-cover" />}
                  <AvatarFallback className="rounded-md text-[10px]">
                    {initialsOf(workspace.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{workspace.name}</span>
                {workspace.id === currentWorkspace.id ? (
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Badge variant="secondary" className={cn('text-[10px] capitalize')}>
                    {workspace.role}
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem className="gap-2 p-2" onSelect={() => navigate('/onboarding?mode=create')}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-3.5" aria-hidden="true" />
              </div>
              <span className="text-muted-foreground font-medium">Create workspace</span>
            </DropdownMenuItem>

            <DropdownMenuItem className="gap-2 p-2" onSelect={() => navigate('/onboarding?mode=join')}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <UserPlus className="size-3.5" aria-hidden="true" />
              </div>
              <span className="text-muted-foreground font-medium">Join workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
