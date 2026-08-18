import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageLoader } from '@/components/common/states'
import { useAuth } from '@/contexts/auth-context'
import { useWorkspace } from '@/contexts/workspace-context'

/**
 * Requires a signed-in user.
 *
 * The `loading` state is honoured rather than treated as "signed out", so a
 * refresh does not bounce an authenticated user to the login screen while the
 * persisted session is still being restored.
 */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader label="Restoring your session" />

  if (status === 'unauthenticated') {
    // Remember where they were headed so login can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <Outlet />
}

/** Keeps signed-in users away from the login and signup screens. */
export function RequireGuest() {
  const { status } = useAuth()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />

  return <Outlet />
}

/**
 * Requires a selected workspace.
 *
 * Every workspace-scoped hook calls `useWorkspaceId()`, which throws without
 * one - so this guard has to resolve before any of those pages mount.
 */
export function RequireWorkspace() {
  const { workspaceId, isLoading, isError, workspaces } = useWorkspace()

  if (isLoading) return <FullPageLoader label="Loading your workspaces" />

  if (isError) {
    // Falling through to the picker gives the user a retry affordance rather
    // than a dead end.
    return <Navigate to="/workspaces" replace />
  }

  if (!workspaceId) {
    // No membership at all: onboarding, not the picker.
    return <Navigate to={workspaces.length === 0 ? '/onboarding' : '/workspaces'} replace />
  }

  return <Outlet />
}
