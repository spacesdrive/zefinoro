import { api } from '@/lib/api/client'
import type {
  Invitation,
  InvitePreview,
  Member,
  Profile,
  Workspace,
  WorkspaceRole,
  WorkspaceSettings,
} from '@/types'

export const workspacesApi = {
  list: () => api.get<Workspace[]>('/workspaces').then((r) => r.data),

  get: (id: string) => api.get<Workspace>(`/workspaces/${id}`).then((r) => r.data),

  create: (input: { name: string; description?: string | null; avatarUrl?: string | null; currency?: string }) =>
    api.post<Workspace>('/workspaces', input).then((r) => r.data),

  update: (id: string, input: { name?: string; description?: string | null; avatarUrl?: string | null }) =>
    api.patch<Workspace>(`/workspaces/${id}`, input).then((r) => r.data),

  remove: (id: string) => api.delete<void>(`/workspaces/${id}`).then((r) => r.data),

  leave: (id: string) => api.post<void>(`/workspaces/${id}/leave`).then((r) => r.data),

  join: (inviteCode: string) =>
    api.post<Workspace>('/workspaces/join', { inviteCode }).then((r) => r.data),

  previewInvite: (code: string) =>
    api.get<InvitePreview>('/invitations/preview', { query: { code } }).then((r) => r.data),

  getSettings: (id: string) =>
    api.get<WorkspaceSettings>(`/workspaces/${id}/settings`).then((r) => r.data),

  updateSettings: (id: string, input: Partial<Omit<WorkspaceSettings, 'workspaceId'>>) =>
    api.patch<WorkspaceSettings>(`/workspaces/${id}/settings`, input).then((r) => r.data),
}

export const membersApi = {
  list: (workspaceId: string) =>
    api.get<Member[]>(`/workspaces/${workspaceId}/members`).then((r) => r.data),

  updateRole: (workspaceId: string, memberId: string, role: WorkspaceRole) =>
    api.patch<Member>(`/workspaces/${workspaceId}/members/${memberId}`, { role }).then((r) => r.data),

  remove: (workspaceId: string, memberId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/members/${memberId}`).then((r) => r.data),
}

export const invitationsApi = {
  list: (workspaceId: string) =>
    api.get<Invitation[]>(`/workspaces/${workspaceId}/invitations`).then((r) => r.data),

  create: (
    workspaceId: string,
    input: { role: 'admin' | 'member'; expiresInDays: number; maxUses: number; email?: string | null }
  ) => api.post<Invitation>(`/workspaces/${workspaceId}/invitations`, input).then((r) => r.data),

  revoke: (workspaceId: string, invitationId: string) =>
    api.post<void>(`/workspaces/${workspaceId}/invitations/${invitationId}/revoke`).then((r) => r.data),

  remove: (workspaceId: string, invitationId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/invitations/${invitationId}`).then((r) => r.data),
}

export const profileApi = {
  me: () => api.get<Profile>('/me').then((r) => r.data),
  update: (input: { fullName?: string; avatarUrl?: string | null; bio?: string | null }) =>
    api.patch<Profile>('/me', input).then((r) => r.data),
}
