import { createClient } from '@supabase/supabase-js'
import { config } from '@/config'

/**
 * The browser's Supabase client.
 *
 * It owns the session (persisted to localStorage, refreshed automatically) and
 * handles the OAuth redirect hash. Data access itself goes through our own API,
 * which forwards the access token so RLS applies - this client is used for
 * authentication only.
 */
export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
