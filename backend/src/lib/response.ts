import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { AppEnv } from '../types/env'

export interface ApiSuccess<T> {
  data: T
  meta?: Record<string, unknown>
}

export interface ApiFailure {
  error: {
    code: string
    message: string
    details?: unknown
    requestId?: string
  }
}

export function ok<T>(c: Context<AppEnv>, data: T, meta?: Record<string, unknown>) {
  const body: ApiSuccess<T> = meta ? { data, meta } : { data }
  return c.json(body, 200)
}

export function created<T>(c: Context<AppEnv>, data: T) {
  return c.json<ApiSuccess<T>>({ data }, 201)
}

export function noContent(c: Context<AppEnv>) {
  return c.body(null, 204)
}

export function fail(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  details?: unknown
) {
  const body: ApiFailure = {
    error: { code, message, requestId: c.get('requestId') },
  }
  if (details !== undefined) body.error.details = details
  return c.json(body, status)
}

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function paginated<T>(c: Context<AppEnv>, items: T[], meta: PageMeta) {
  return c.json<ApiSuccess<T[]>>({ data: items, meta: meta as unknown as Record<string, unknown> }, 200)
}

export function buildPageMeta(page: number, pageSize: number, total: number): PageMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
  }
}
