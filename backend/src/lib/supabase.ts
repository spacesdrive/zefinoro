import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Bindings } from '../types/env'
import type { Database } from '../types/database'

/**
 * A Supabase client bound to the *caller's* access token.
 *
 * This is the only client the API uses. Because every query runs as the signed
 * in user, Row Level Security - not application code - is the last line of
 * defence for workspace isolation. There is deliberately no service-role client
 * anywhere in this Worker: a leaked service key would bypass every policy, and
 * nothing here needs that power.
 */
export function createUserClient(env: Bindings, accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      // The Worker is stateless; tokens arrive per request.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

/**
 * An anonymous client, used only for token verification.
 */
export function createAnonClient(env: Bindings): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
