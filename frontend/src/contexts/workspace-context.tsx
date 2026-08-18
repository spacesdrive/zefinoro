import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { config } from '@/config'
import { queryKeys, workspaceScope } from '@/lib/api/query-keys'
import { workspacesApi } from '@/features/workspaces/api'
import { useAuth } from '@/contexts/auth-context'
import type { Workspace, WorkspaceRole } from '@/types'

interface WorkspaceContextValue {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  workspaceId: string | null
  role: WorkspaceRole | null
  /** Owner or admin - the tier that can manage members and settings. */
  canManage: boolean
  isOwner: boolean
  isLoading: boolean
  isError: boolean
  switchWorkspace: (id: string) => void
  refresh: () => Promise<unknown>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

const STORAGE_KEY = config.app.storageKeys.workspace

function readStoredWorkspaceId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(readStoredWorkspaceId)

  const {
    data: workspaces = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: workspacesApi.list,
    enabled: status === 'authenticated',
    staleTime: 30_000,
  })

  // Reconcile the remembered id against what the user can actually see. A
  // workspace they were removed from - or one belonging to a previously
  // signed-in account - must not stay selected.
  const currentWorkspace = useMemo(() => {
    if (workspaces.length === 0) return null
    const match = workspaces.find((w) => w.id === selectedId)
    return match ?? workspaces[0] ?? null
  }, [workspaces, selectedId])

  useEffect(() => {
    if (!currentWorkspace) return
    if (currentWorkspace.id === selectedId) return

    setSelectedId(currentWorkspace.id)
    try {
      localStorage.setItem(STORAGE_KEY, currentWorkspace.id)
    } catch {
      // Non-fatal: the selection simply will not survive a reload.
    }
  }, [currentWorkspace, selectedId])

  const switchWorkspace = useCallback(
    (id: string) => {
      if (id === selectedId) return

      const previous = selectedId
      setSelectedId(id)
      try {
        localStorage.setItem(STORAGE_KEY, id)
      } catch {
        // Ignore.
      }

      // Drop the previous workspace's cached queries outright. Merely marking
      // them stale would let React Query serve one tenant's transactions while
      // the next tenant's request is still in flight.
      if (previous) {
        queryClient.removeQueries({ queryKey: workspaceScope(previous) })
      }

      navigate('/dashboard')
    },
    [selectedId, queryClient, navigate]
  )

  const role = currentWorkspace?.role ?? null

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      currentWorkspace,
      workspaceId: currentWorkspace?.id ?? null,
      role,
      canManage: role === 'owner' || role === 'admin',
      isOwner: role === 'owner',
      isLoading,
      isError,
      switchWorkspace,
      refresh: refetch,
    }),
    [workspaces, currentWorkspace, role, isLoading, isError, switchWorkspace, refetch]
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>.')
  return ctx
}

/**
 * The current workspace id, for hooks that cannot render without one.
 * Throws rather than returning null so a missing guard surfaces immediately in
 * development instead of producing a request to `/workspaces/null/...`.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspaceId(): string {
  const { workspaceId } = useWorkspace()
  if (!workspaceId) throw new Error('No workspace selected. Render this inside a workspace guard.')
  return workspaceId
}
