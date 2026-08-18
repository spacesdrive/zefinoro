import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { queryKeys, workspaceScope } from '@/lib/api/query-keys'
import { errorMessage } from '@/lib/api/client'
import { useWorkspace, useWorkspaceId } from '@/contexts/workspace-context'
import { config } from '@/config'
import { invitationsApi, membersApi, profileApi, workspacesApi } from './api'
import type { WorkspaceRole, WorkspaceSettings } from '@/types'

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: profileApi.me,
    staleTime: 60_000,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: profileApi.update,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me })
      toast.success('Profile updated')
    },
    onError: (error) => toast.error('Could not update your profile', { description: errorMessage(error) }),
  })
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export function useCreateWorkspace() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: workspacesApi.create,
    onSuccess: async (workspace) => {
      // Select the new workspace before navigating, so the dashboard does not
      // render one frame against the old one.
      try {
        localStorage.setItem(config.app.storageKeys.workspace, workspace.id)
      } catch {
        // Ignore.
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces })
      toast.success('Workspace created', { description: workspace.name })
      navigate('/dashboard')
    },
    onError: (error) => toast.error('Could not create the workspace', { description: errorMessage(error) }),
  })
}

export function useJoinWorkspace() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (inviteCode: string) => workspacesApi.join(inviteCode),
    onSuccess: async (workspace) => {
      try {
        localStorage.setItem(config.app.storageKeys.workspace, workspace.id)
      } catch {
        // Ignore.
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces })
      toast.success(`Joined ${workspace.name}`)
      navigate('/dashboard')
    },
    onError: (error) => toast.error('Could not join that workspace', { description: errorMessage(error) }),
  })
}

export function useInvitePreview(code: string) {
  return useQuery({
    queryKey: queryKeys.invitePreview(code),
    queryFn: () => workspacesApi.previewInvite(code),
    // Only look up codes that are the right shape, so we do not probe the
    // endpoint on every keystroke.
    enabled: code.replace(/-/g, '').length === 8,
    retry: false,
  })
}

export function useUpdateWorkspace() {
  const workspaceId = useWorkspaceId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { name?: string; description?: string | null; avatarUrl?: string | null }) =>
      workspacesApi.update(workspaceId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces })
      await queryClient.invalidateQueries({ queryKey: workspaceScope(workspaceId) })
      toast.success('Workspace updated')
    },
    onError: (error) => toast.error('Could not update the workspace', { description: errorMessage(error) }),
  })
}

export function useDeleteWorkspace() {
  const workspaceId = useWorkspaceId()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => workspacesApi.remove(workspaceId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: workspaceScope(workspaceId) })
      try {
        localStorage.removeItem(config.app.storageKeys.workspace)
      } catch {
        // Ignore.
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces })
      toast.success('Workspace deleted')
      navigate('/workspaces')
    },
    onError: (error) => toast.error('Could not delete the workspace', { description: errorMessage(error) }),
  })
}

export function useLeaveWorkspace() {
  const workspaceId = useWorkspaceId()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => workspacesApi.leave(workspaceId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: workspaceScope(workspaceId) })
      try {
        localStorage.removeItem(config.app.storageKeys.workspace)
      } catch {
        // Ignore.
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces })
      toast.success('You left the workspace')
      navigate('/workspaces')
    },
    onError: (error) => toast.error('Could not leave the workspace', { description: errorMessage(error) }),
  })
}

export function useWorkspaceSettings() {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: queryKeys.settings(workspaceId),
    queryFn: () => workspacesApi.getSettings(workspaceId),
  })
}

export function useUpdateWorkspaceSettings() {
  const workspaceId = useWorkspaceId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Partial<Omit<WorkspaceSettings, 'workspaceId'>>) =>
      workspacesApi.updateSettings(workspaceId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceScope(workspaceId) })
      toast.success('Workspace preferences saved')
    },
    onError: (error) => toast.error('Could not save preferences', { description: errorMessage(error) }),
  })
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export function useMembers() {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: queryKeys.members(workspaceId),
    queryFn: () => membersApi.list(workspaceId),
  })
}

export function useUpdateMemberRole() {
  const workspaceId = useWorkspaceId()
  const queryClient = useQueryClient()
  const { refresh } = useWorkspace()

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: WorkspaceRole }) =>
      membersApi.updateRole(workspaceId, memberId, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) })
      // The caller may have changed their own role, which changes what the
      // sidebar and settings pages are allowed to show.
      await refresh()
      toast.success('Role updated')
    },
    onError: (error) => toast.error('Could not update that role', { description: errorMessage(error) }),
  })
}

export function useRemoveMember() {
  const workspaceId = useWorkspaceId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) => membersApi.remove(workspaceId, memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) })
      toast.success('Member removed')
    },
    onError: (error) => toast.error('Could not remove that member', { description: errorMessage(error) }),
  })
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export function useInvitations() {
  const workspaceId = useWorkspaceId()
  const { canManage } = useWorkspace()

  return useQuery({
    queryKey: queryKeys.invitations(workspaceId),
    queryFn: () => invitationsApi.list(workspaceId),
    enabled: canManage,
  })
}

export function useCreateInvitation() {
  const workspaceId = useWorkspaceId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      role: 'admin' | 'member'
      expiresInDays: number
      maxUses: number
      email?: string | null
    }) => invitationsApi.create(workspaceId, input),
    onSuccess: async (invitation) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations(workspaceId) })
      toast.success('Invite created', { description: invitation.inviteCode })
    },
    onError: (error) => toast.error('Could not create an invite', { description: errorMessage(error) }),
  })
}

export function useDeleteInvitation() {
  const workspaceId = useWorkspaceId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invitationId: string) => invitationsApi.remove(workspaceId, invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations(workspaceId) })
      toast.success('Invite deleted')
    },
    onError: (error) => toast.error('Could not delete that invite', { description: errorMessage(error) }),
  })
}

export function useRevokeInvitation() {
  const workspaceId = useWorkspaceId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invitationId: string) => invitationsApi.revoke(workspaceId, invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations(workspaceId) })
      toast.success('Invite revoked')
    },
    onError: (error) => toast.error('Could not revoke that invite', { description: errorMessage(error) }),
  })
}
