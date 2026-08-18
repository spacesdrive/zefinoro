import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types/env'
import { ApiError } from '../lib/errors'
import { createUserClient } from '../lib/supabase'

/**
 * Verifies the caller's Supabase access token and attaches both the user and a
 * JWT-scoped Supabase client to the context.
 *
 * Verification is delegated to Supabase Auth (`getUser`) rather than decoding
 * the JWT locally: local decoding cannot detect a token revoked by a sign-out
 * or password change, and this Worker has no signing key to verify against.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized()
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    throw ApiError.unauthorized()
  }

  const supabase = createUserClient(c.env, token)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED')
  }

  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>

  c.set('supabase', supabase)
  c.set('accessToken', token)
  c.set('user', {
    id: data.user.id,
    email: data.user.email ?? '',
    fullName:
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      null,
    avatarUrl:
      (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
      (typeof meta.picture === 'string' && meta.picture) ||
      null,
  })

  await next()
})
