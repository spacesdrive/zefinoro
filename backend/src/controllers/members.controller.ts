import type { Context } from 'hono'
import type { z } from 'zod'
import type { AppEnv } from '../types/env'
import type { ProfileRow, WorkspaceMemberRow } from '../types/database'
import { ApiError, fromPostgrestError } from '../lib/errors'
import { noContent, ok } from '../lib/response'
import { serializeMember } from '../lib/serializers'
import { getValidated } from '../middleware/validate'
import { bumpWorkspaceVersion, getRedis } from '../lib/redis'
import type { updateMemberSchema } from '../schemas'
import { requireUuidParam } from '../lib/params'

type MemberWithProfile = WorkspaceMemberRow & { profile: ProfileRow | null }

export async function listMembers(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')

  const { data, error } = await supabase
    .from('workspace_members')
    .select('*, profile:profiles!workspace_members_user_id_fkey(id, full_name, email, avatar_url, created_at)')
    .eq('workspace_id', workspace.id)
    .order('role', { ascending: true })
    .order('joined_at', { ascending: true })

  if (error) throw fromPostgrestError(error)

  return ok(c, (data ?? []).map((row) => serializeMember(row as unknown as MemberWithProfile)))
}

export async function updateMemberRole(c: Context<AppEnv>) {
  const input = getValidated<z.infer<typeof updateMemberSchema>>(c)
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const user = c.get('user')
  const memberId = requireUuidParam(c, 'memberId')

  const { data: target, error: readErr } = await supabase
    .from('workspace_members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (readErr) throw fromPostgrestError(readErr)
  if (!target) throw ApiError.notFound('That member could not be found.')

  // Only an owner may create or remove another owner. Admins can shuffle
  // members and admins, but cannot promote themselves past their own ceiling.
  if ((input.role === 'owner' || target.role === 'owner') && workspace.role !== 'owner') {
    throw ApiError.forbidden('Only the workspace owner can change owner roles.')
  }

  if (target.user_id === user.id && target.role === 'owner' && input.role !== 'owner') {
    // Let the last-owner trigger have the final word, but give a clear message
    // for the common case of an owner trying to demote themselves.
    const { count } = await supabase
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
      .eq('role', 'owner')

    if ((count ?? 0) <= 1) {
      throw ApiError.conflict(
        'You are the only owner. Promote someone else before changing your own role.',
        'WORKSPACE_LAST_OWNER'
      )
    }
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .update({ role: input.role })
    .eq('id', memberId)
    .eq('workspace_id', workspace.id)
    .select('*, profile:profiles!workspace_members_user_id_fkey(id, full_name, email, avatar_url, created_at)')
    .maybeSingle()

  if (error) throw fromPostgrestError(error)
  if (!data) throw ApiError.notFound('That member could not be found.')

  await bumpWorkspaceVersion(getRedis(c.env), workspace.id)
  return ok(c, serializeMember(data as unknown as MemberWithProfile))
}

export async function removeMember(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const user = c.get('user')
  const memberId = requireUuidParam(c, 'memberId')

  const { data: target, error: readErr } = await supabase
    .from('workspace_members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (readErr) throw fromPostgrestError(readErr)
  if (!target) throw ApiError.notFound('That member could not be found.')

  if (target.user_id === user.id) {
    throw ApiError.badRequest('Use "Leave workspace" to remove yourself.', 'CANNOT_REMOVE_SELF')
  }

  if (target.role === 'owner' && workspace.role !== 'owner') {
    throw ApiError.forbidden('Only the workspace owner can remove another owner.')
  }

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', workspace.id)

  if (error) throw fromPostgrestError(error)

  await bumpWorkspaceVersion(getRedis(c.env), workspace.id)
  return noContent(c)
}
