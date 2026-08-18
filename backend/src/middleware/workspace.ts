import { createMiddleware } from 'hono/factory'
import type { AppEnv, WorkspaceRole } from '../types/env'
import { ApiError, fromPostgrestError } from '../lib/errors'

/**
 * Resolves `:workspaceId` into a verified membership.
 *
 * The workspace id is a client-supplied value, so it is never trusted: this
 * looks the caller's membership up under RLS, which means a non-member simply
 * gets no row back and is refused. Downstream handlers can then rely on
 * `c.get('workspace')` being a workspace the caller genuinely belongs to.
 */
export const requireWorkspace = createMiddleware<AppEnv>(async (c, next) => {
  const workspaceId = c.req.param('workspaceId')
  if (!workspaceId) {
    throw ApiError.badRequest('A workspace is required.', 'WORKSPACE_REQUIRED')
  }

  const supabase = c.get('supabase')
  const user = c.get('user')

  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw fromPostgrestError(error)

  if (!data) {
    // Deliberately 404, not 403: confirming a workspace exists to a non-member
    // leaks its existence.
    throw ApiError.notFound('That workspace could not be found.', 'WORKSPACE_NOT_FOUND')
  }

  c.set('workspace', { id: workspaceId, role: data.role as WorkspaceRole })
  await next()
})

const ROLE_RANK: Record<WorkspaceRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
}

/**
 * Gate a route on a minimum role. RLS enforces the same rules at the database
 * level - this exists so the API returns a clean 403 with a useful message
 * instead of an opaque empty result.
 */
export function requireRole(minimum: WorkspaceRole) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const workspace = c.get('workspace')
    if (!workspace) {
      throw ApiError.internal('Workspace context missing.', 'WORKSPACE_CONTEXT_MISSING')
    }

    if (ROLE_RANK[workspace.role] < ROLE_RANK[minimum]) {
      throw ApiError.forbidden(
        minimum === 'owner'
          ? 'Only the workspace owner can do that.'
          : 'You need admin access to do that.'
      )
    }

    await next()
  })
}

export const requireManager = requireRole('admin')
export const requireOwner = requireRole('owner')
