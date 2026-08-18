import { createMiddleware } from 'hono/factory'
import type { z } from 'zod'
import type { AppEnv } from '../types/env'
import { ApiError } from '../lib/errors'
import { zodIssues } from './error'

/**
 * Parse and validate a JSON body, storing the typed result on the context.
 * Handlers read it back with `getValidated<T>(c)` rather than re-parsing.
 */
const VALIDATED = Symbol.for('zefinoro.validated')

export function validateBody<S extends z.ZodTypeAny>(schema: S) {
  return createMiddleware<AppEnv>(async (c, next) => {
    let raw: unknown
    try {
      raw = await c.req.json()
    } catch {
      throw ApiError.badRequest('Expected a JSON body.', 'INVALID_JSON')
    }

    const result = schema.safeParse(raw)
    if (!result.success) {
      throw ApiError.unprocessable('Some fields need attention.', 'VALIDATION_ERROR', zodIssues(result.error))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(c as any)[VALIDATED] = result.data
    await next()
  })
}

export function validateQuery<S extends z.ZodTypeAny>(schema: S) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const result = schema.safeParse(c.req.query())
    if (!result.success) {
      throw ApiError.unprocessable('Some filters are invalid.', 'VALIDATION_ERROR', zodIssues(result.error))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(c as any)[VALIDATED] = result.data
    await next()
  })
}

export function getValidated<T>(c: unknown): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (c as any)[VALIDATED] as T
}
