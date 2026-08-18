import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, ChevronsUpDown, LogOut, Palette, Settings, Sparkles } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/features/workspaces/hooks'
import { displayName, initialsOf } from '@/lib/format'

export function NavUser() {
  const { isMobile } = useSidebar()
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const navigate = useNavigate()
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  const name = profile?.fullName ?? (user?.user_metadata?.full_name as string | undefined) ?? null
  const email = profile?.email ?? user?.email ?? ''
  const avatar = profile?.avatarUrl ?? (user?.user_metadata?.avatar_url as string | undefined) ?? null

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                aria-label="Account menu"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="size-8 rounded-lg">
                  {avatar && <AvatarImage src={avatar} alt="" />}
                  <AvatarFallback className="rounded-lg text-xs">{initialsOf(name, email)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName({ fullName: name, email })}</span>
                  <span className="text-muted-foreground truncate text-xs">{email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 opacity-50" aria-hidden="true" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? 'bottom' : 'right'}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8 rounded-lg">
                    {avatar && <AvatarImage src={avatar} alt="" />}
                    <AvatarFallback className="rounded-lg text-xs">{initialsOf(name, email)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayName({ fullName: name, email })}</span>
                    <span className="text-muted-foreground truncate text-xs">{email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to="/settings/profile">
                    <BadgeCheck aria-hidden="true" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/appearance">
                    <Palette aria-hidden="true" />
                    Appearance
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/accounts">
                    <Settings aria-hidden="true" />
                    Account settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/workspaces">
                    <Sparkles aria-hidden="true" />
                    All workspaces
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmSignOut(true)}>
                <LogOut aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <AlertDialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Zefinoro?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to reach your workspaces. Nothing will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
