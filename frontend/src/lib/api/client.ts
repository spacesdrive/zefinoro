import { config } from '@/config'
import { getAccessToken, supabase } from '@/lib/supabase/client'

/**
 * A typed error carrying the API's stable machine code, so callers can react to
 * specific failures (an exhausted invite, a stale session) without string
 * matching on prose.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  readonly requestId?: string

  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }

  /** Field-level messages from a 422, keyed by form field path. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {}
    const out: Record<string, string> = {}
    for (const issue of this.details as Array<{ path?: string; message?: string }>) {
      if (issue?.path && issue.message && !out[issue.path]) out[issue.path] = issue.message
    }
    return out
  }
}

interface ApiEnvelope<T> {
  data?: T
  meta?: Record<string, unknown>
  error?: { code: string; message: string; details?: unknown; requestId?: string }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  signal?: AbortSignal
  /** Set false for endpoints that do not need a session. */
  auth?: boolean
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${config.api.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  if (!query) return url

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

/**
 * Core request helper.
 *
 * A 401 is treated as a dead session: the local session is cleared so the app's
 * auth listener redirects to the login screen rather than leaving the user
 * clicking a UI that silently fails.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const { method = 'GET', body, query, signal, auth = true } = options

  const headers: Record<string, string> = { Accept: 'application/json' }

  if (auth) {
    const token = await getAccessToken()
    if (!token) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'You need to sign in to continue.')
    }
    headers.Authorization = `Bearer ${token}`
  }

  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.')
  }

  if (response.status === 204) {
    return { data: undefined as T }
  }

  let payload: ApiEnvelope<T> | null = null
  try {
    payload = (await response.json()) as ApiEnvelope<T>
  } catch {
    if (response.ok) return { data: undefined as T }
  }

  if (!response.ok) {
    const error = payload?.error
    if (response.status === 401) {
      // Drop the stale session so the auth listener can route to /login.
      await supabase.auth.signOut().catch(() => undefined)
    }
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.details,
      error?.requestId
    )
  }

  return { data: payload?.data as T, meta: payload?.meta }
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}

/** Human-readable message for any thrown value, for use in toasts. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}
