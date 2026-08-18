import type { Context } from 'hono'
import type { z } from 'zod'
import type { AppEnv } from '../types/env'
import type { ProfileRow, WorkspaceInvitationRow } from '../types/database'
import { ApiError, fromPostgrestError } from '../lib/errors'
import { created, noContent, ok } from '../lib/response'
import { serializeInvitation } from '../lib/serializers'
import { getValidated } from '../middleware/validate'
import type { createInvitationSchema } from '../schemas'
import { requireUuidParam } from '../lib/params'

type InvitationWithInviter = WorkspaceInvitationRow & { inviter: ProfileRow | null }

export async function listInvitations(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')

  const { data, error } = await supabase
    .from('workspace_invitations')
    .select('*, inviter:profiles!workspace_invitations_invited_by_fkey(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })

  if (error) throw fromPostgrestError(error)

  return ok(
    c,
    (data ?? []).map((row) => serializeInvitation(row as unknown as InvitationWithInviter, c.env.APP_URL))
  )
}

export async function createInvitation(c: Context<AppEnv>) {
  const input = getValidated<z.infer<typeof createInvitationSchema>>(c)
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')

  // Code generation, uniqueness retry and the manager check all live in the
  // RPC, so a client cannot mint a code for a workspace it does not manage.
  const { data, error } = await supabase.rpc('create_invitation', {
    p_workspace_id: workspace.id,
    p_role: input.role,
    p_expires_in_days: input.expiresInDays,
    p_max_uses: input.maxUses,
    p_email: input.email ?? null,
  })

  if (error) throw fromPostgrestError(error)
  if (!data) throw ApiError.internal('The invitation could not be created.')

  return created(c, serializeInvitation(data as unknown as InvitationWithInviter, c.env.APP_URL))
}

export async function revokeInvitation(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const invitationId = requireUuidParam(c, 'invitationId')

  // Revoking rather than deleting preserves the audit trail of who invited whom.
  const { data, error } = await supabase
    .from('workspace_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('workspace_id', workspace.id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()

  if (error) throw fromPostgrestError(error)
  if (!data) throw ApiError.notFound('That invitation could not be found, or it is already revoked.')

  return noContent(c)
}

export async function deleteInvitation(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const invitationId = requireUuidParam(c, 'invitationId')

  const { error } = await supabase
    .from('workspace_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('workspace_id', workspace.id)

  if (error) throw fromPostgrestError(error)
  return noContent(c)
}
