import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database'

/**
 * Bindings are injected by the Workers runtime.
 *
 * Secrets (`wrangler secret put ...`) are deliberately *not* prefixed with
 * VITE_ - they never reach the browser bundle. Only SUPABASE_URL and
 * SUPABASE_ANON_KEY are also present client-side, and both are safe to expose
 * because every table is guarded by RLS.
 */
export interface Bindings {
  /** Static asset binding for the built SPA. */
  ASSETS: Fetcher

  ENVIRONMENT: string
  APP_URL: string

  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string

  UPSTASH_REDIS_REST_URL?: string
  UPSTASH_REDIS_REST_TOKEN?: string

  CLOUDINARY_CLOUD_NAME?: string
  CLOUDINARY_API_KEY?: string
  CLOUDINARY_API_SECRET?: string
  /**
   * Set to "true" only on a cloud where Strict Transformations is disabled.
   * When unset, the API serves plain delivery URLs, which always work.
   */
  CLOUDINARY_ENABLE_TRANSFORMS?: string
}

export interface AuthUser {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
}

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface WorkspaceContext {
  id: string
  role: WorkspaceRole
}

/**
 * Values middleware attaches to the request context.
 */
export interface Variables {
  requestId: string
  /** Supabase client scoped to the caller's JWT, so RLS applies to every query. */
  supabase: SupabaseClient<Database>
  user: AuthUser
  accessToken: string
  workspace: WorkspaceContext
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}
