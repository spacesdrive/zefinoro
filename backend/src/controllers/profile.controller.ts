import type { Context } from 'hono'
import type { z } from 'zod'
import type { AppEnv } from '../types/env'
import type { ProfileRow } from '../types/database'
import { fromPostgrestError } from '../lib/errors'
import { ok } from '../lib/response'
import { serializeProfile } from '../lib/serializers'
import { getValidated } from '../middleware/validate'
import type { updateProfileSchema } from '../schemas'

/**
 * The signed-in user plus their profile row.
 *
 * The profile is normally created by the `on_auth_user_created` trigger, but a
 * user who signed up before that trigger existed (or whose insert raced) would
 * otherwise see an empty settings page - so it is created on demand here.
 */
export async function getMe(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const user = c.get('user')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw fromPostgrestError(error)

  if (!data) {
    const { data: inserted, error: insertErr } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        avatar_url: user.avatarUrl,
      })
      .select('*')
      .single()

    if (insertErr) throw fromPostgrestError(insertErr)
    return ok(c, serializeProfile(inserted as ProfileRow))
  }

  return ok(c, serializeProfile(data as ProfileRow))
}

export async function updateMe(c: Context<AppEnv>) {
  const input = getValidated<z.infer<typeof updateProfileSchema>>(c)
  const supabase = c.get('supabase')
  const user = c.get('user')

  const patch: Partial<ProfileRow> = {}
  if (input.fullName !== undefined) patch.full_name = input.fullName
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl || null
  if (input.bio !== undefined) patch.bio = input.bio || null

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('*')
    .single()

  if (error) throw fromPostgrestError(error)

  return ok(c, serializeProfile(data as ProfileRow))
}
