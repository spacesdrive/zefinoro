import type { Context } from 'hono'
import type { AppEnv } from '../types/env'
import type { AttachmentRow, WorkspaceRow, WorkspaceSettingsRow } from '../types/database'
import { ApiError, fromPostgrestError } from '../lib/errors'
import { created, noContent, ok } from '../lib/response'
import { serializeWorkspace, serializeWorkspaceSettings } from '../lib/serializers'
import { getValidated } from '../middleware/validate'
import { bumpWorkspaceVersion, getRedis } from '../lib/redis'
import type {
  CreateWorkspaceInput,
  joinWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceSettingsSchema,
} from '../schemas'
import type { z } from 'zod'

export async function listWorkspaces(c: Context<AppEnv>) {
  const supabase = c.get('supabase')

  const { data, error } = await supabase.rpc('my_workspaces')
  if (error) throw fromPostgrestError(error)

  const workspaces = (data ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    description: w.description,
    avatarUrl: w.avatar_url,
    role: w.role,
    memberCount: Number(w.member_count),
    joinedAt: w.joined_at,
    createdAt: w.created_at,
  }))

  return ok(c, workspaces)
}

export async function createWorkspace(c: Context<AppEnv>) {
  const input = getValidated<CreateWorkspaceInput>(c)
  const supabase = c.get('supabase')

  // The RPC does workspace + owner membership + settings + seed categories in a
  // single transaction, so a failure part-way cannot leave an orphan workspace.
  const { data, error } = await supabase.rpc('create_workspace', {
    p_name: input.name,
    p_description: input.description ?? null,
    p_avatar_url: input.avatarUrl ?? null,
    p_currency: input.currency ?? 'INR',
  })

  if (error) throw fromPostgrestError(error)
  if (!data) throw ApiError.internal('The workspace could not be created.')

  const row = data as unknown as WorkspaceRow
  return created(c, serializeWorkspace(row, { role: 'owner', memberCount: 1 }))
}

export async function getWorkspace(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspace.id)
    .single()

  if (error) throw fromPostgrestError(error)

  const { count } = await supabase
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
    .eq('status', 'active')

  return ok(c, serializeWorkspace(data as WorkspaceRow, {
    role: workspace.role,
    memberCount: count ?? 0,
  }))
}

export async function updateWorkspace(c: Context<AppEnv>) {
  const input = getValidated<z.infer<typeof updateWorkspaceSchema>>(c)
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')

  const patch: Partial<WorkspaceRow> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description || null
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl || null

  const { data, error } = await supabase
    .from('workspaces')
    .update(patch)
    .eq('id', workspace.id)
    .select('*')
    .single()

  if (error) throw fromPostgrestError(error)

  await bumpWorkspaceVersion(getRedis(c.env), workspace.id)
  return ok(c, serializeWorkspace(data as WorkspaceRow, { role: workspace.role }))
}

export async function deleteWorkspace(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')

  // Postgres cascades the rows, but Cloudinary knows nothing about that. Collect
  // the assets while they are still readable, or deleting a workspace silently
  // orphans every file it owned and they bill against storage forever.
  const { data: assets } = await supabase
    .from('transaction_attachments')
    .select('cloudinary_public_id, resource_type')
    .eq('workspace_id', workspace.id)

  const { error } = await supabase.from('workspaces').delete().eq('id', workspace.id)
  if (error) throw fromPostgrestError(error)

  const rows = (assets ?? []) as Pick<AttachmentRow, 'cloudinary_public_id' | 'resource_type'>[]
  if (rows.length) {
    c.executionCtx.waitUntil(purgeWorkspaceAssets(c, rows))
  }

  await bumpWorkspaceVersion(getRedis(c.env), workspace.id)
  return noContent(c)
}

/**
 * Best-effort removal of a deleted workspace's files. Runs after the response,
 * so the user never waits on a third-party API to finish.
 */
async function purgeWorkspaceAssets(
  c: Context<AppEnv>,
  rows: Pick<AttachmentRow, 'cloudinary_public_id' | 'resource_type'>[]
) {
  const { deleteFile } = await import('../lib/cloudinary')
  for (const row of rows) {
    try {
      const result = await deleteFile(
        c.env,
        row.cloudinary_public_id,
        (row.resource_type || 'image') as 'image' | 'video' | 'raw'
      )
      if (!result.deleted) {
        console.warn('Workspace asset not deleted:', row.cloudinary_public_id, result.reason)
      }
    } catch (err) {
      console.error('Workspace asset cleanup failed:', row.cloudinary_public_id, err)
    }
  }
}

export async function joinWorkspace(c: Context<AppEnv>) {
  const input = getValidated<z.infer<typeof joinWorkspaceSchema>>(c)
  const supabase = c.get('supabase')

  const { data, error } = await supabase.rpc('join_workspace', {
    p_invite_code: input.inviteCode,
  })

  if (error) throw fromPostgrestError(error)
  if (!data) throw ApiError.notFound('That invite code is not valid.', 'INVITE_INVALID')

  const row = data as unknown as WorkspaceRow
  await bumpWorkspaceVersion(getRedis(c.env), row.id)
  return created(c, serializeWorkspace(row))
}

/** Validate an invite code without consuming it, for the join screen preview. */
export async function previewInvitation(c: Context<AppEnv>) {
  const code = c.req.query('code')
  if (!code) throw ApiError.badRequest('An invite code is required.', 'INVITE_CODE_REQUIRED')

  const supabase = c.get('supabase')
  const { data, error } = await supabase.rpc('preview_invitation', { p_invite_code: code })
  if (error) throw fromPostgrestError(error)

  const row = Array.isArray(data) ? data[0] : null
  if (!row) return ok(c, { valid: false, reason: 'INVITE_INVALID' })

  return ok(c, {
    valid: row.valid,
    reason: row.reason,
    workspace: row.workspace_id
      ? { id: row.workspace_id, name: row.workspace_name, avatarUrl: row.workspace_avatar_url }
      : null,
    role: row.role,
  })
}

export async function leaveWorkspace(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const user = c.get('user')

  // The last-owner database trigger is what actually prevents orphaning a
  // workspace; this check just produces a friendlier message first.
  if (workspace.role === 'owner') {
    const { count } = await supabase
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
      .eq('role', 'owner')

    if ((count ?? 0) <= 1) {
      throw ApiError.conflict(
        'You are the only owner. Transfer ownership or delete the workspace instead.',
        'WORKSPACE_LAST_OWNER'
      )
    }
  }

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)

  if (error) throw fromPostgrestError(error)
  return noContent(c)
}

export async function getSettings(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')

  const { data, error } = await supabase
    .from('workspace_settings')
    .select('*')
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (error) throw fromPostgrestError(error)

  if (!data) {
    // Older workspaces may predate the settings table; return the defaults
    // rather than 404-ing a page that should always render.
    return ok(c, {
      workspaceId: workspace.id,
      defaultCurrency: 'INR',
      timezone: 'Asia/Kolkata',
      dateFormat: 'dd MMM yyyy',
      fiscalYearStart: 4,
    })
  }

  return ok(c, serializeWorkspaceSettings(data as WorkspaceSettingsRow))
}

export async function updateSettings(c: Context<AppEnv>) {
  const input = getValidated<z.infer<typeof workspaceSettingsSchema>>(c)
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')

  const patch: Partial<WorkspaceSettingsRow> = { workspace_id: workspace.id }
  if (input.defaultCurrency !== undefined) patch.default_currency = input.defaultCurrency
  if (input.timezone !== undefined) patch.timezone = input.timezone
  if (input.dateFormat !== undefined) patch.date_format = input.dateFormat
  if (input.fiscalYearStart !== undefined) patch.fiscal_year_start = input.fiscalYearStart

  const { data, error } = await supabase
    .from('workspace_settings')
    .upsert(patch, { onConflict: 'workspace_id' })
    .select('*')
    .single()

  if (error) throw fromPostgrestError(error)

  await bumpWorkspaceVersion(getRedis(c.env), workspace.id)
  return ok(c, serializeWorkspaceSettings(data as WorkspaceSettingsRow))
}
