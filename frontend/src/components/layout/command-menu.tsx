import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  LayoutDashboard,
  LogOut,
  Moon,
  Palette,
  Plus,
  Receipt,
  ShieldCheck,
  Sun,
  User,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useTheme } from '@/contexts/theme-context'
import { useWorkspace } from '@/contexts/workspace-context'
import { useAuth } from '@/contexts/auth-context'
import { initialsOf } from '@/lib/format'

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddTransaction?: () => void
}

/**
 * Global command palette (Cmd/Ctrl + K).
 *
 * Every entry performs a real action - navigation, workspace switching, theme
 * changes, sign-out - rather than merely searching a static list.
 */
export function CommandMenu({ open, onOpenChange, onAddTransaction }: CommandMenuProps) {
  const navigate = useNavigate()
  const { setTheme, resolvedTheme } = useTheme()
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspace()
  const { signOut } = useAuth()

  const run = useCallback(
    (action: () => void) => {
      onOpenChange(false)
      // Let the dialog finish closing before navigating, otherwise the exit
      // animation fights the route transition.
      requestAnimationFrame(action)
    },
    [onOpenChange]
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette" description="Search pages and actions">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => run(() => navigate('/dashboard'))}>
            <LayoutDashboard aria-hidden="true" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/billing'))}>
            <Receipt aria-hidden="true" />
            <span>Billing</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/billing/received'))}>
            <ArrowDownLeft aria-hidden="true" />
            <span>Received</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/billing/spent'))}>
            <ArrowUpRight aria-hidden="true" />
            <span>Spent</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/users'))}>
            <Users aria-hidden="true" />
            <span>Users</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => run(() => navigate('/settings/profile'))}>
            <User aria-hidden="true" />
            <span>Profile</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/settings/appearance'))}>
            <Palette aria-hidden="true" />
            <span>Appearance</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/settings/accounts'))}>
            <ShieldCheck aria-hidden="true" />
            <span>Accounts</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {onAddTransaction && (
            <CommandItem onSelect={() => run(onAddTransaction)}>
              <Plus aria-hidden="true" />
              <span>Add transaction</span>
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem onSelect={() => run(() => navigate('/onboarding?mode=create'))}>
            <Building2 aria-hidden="true" />
            <span>Create workspace</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/onboarding?mode=join'))}>
            <UserPlus aria-hidden="true" />
            <span>Join workspace</span>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))}
          >
            {resolvedTheme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            <span>Switch to {resolvedTheme === 'dark' ? 'light' : 'dark'} theme</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => void signOut().then(() => navigate('/login')))}>
            <LogOut aria-hidden="true" />
            <span>Sign out</span>
          </CommandItem>
        </CommandGroup>

        {workspaces.length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch workspace">
              {workspaces
                .filter((w) => w.id !== currentWorkspace?.id)
                .map((workspace) => (
                  <CommandItem
                    key={workspace.id}
                    onSelect={() => run(() => switchWorkspace(workspace.id))}
                  >
                    <span className="bg-muted flex size-4 items-center justify-center rounded text-[9px] font-medium">
                      {initialsOf(workspace.name)}
                    </span>
                    <span>{workspace.name}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

/** Wires up the Cmd/Ctrl+K shortcut and owns the palette's open state. */
export function useCommandMenu() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return { open, setOpen }
}
