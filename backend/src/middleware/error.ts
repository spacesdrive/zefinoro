import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import type { AppEnv } from '../types/env'
import { ApiError, isApiError } from '../lib/errors'
import { fail } from '../lib/response'

interface FieldIssue {
  path: string
  message: string
}

export function zodIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}

/**
 * Terminal error handler.
 *
 * Anything that is not an explicitly-constructed ApiError is treated as a bug:
 * it is logged in full for the operator, and reduced to a generic message for
 * the user. Stack traces and Postgres internals never cross the wire.
 */
export function onError(err: Error, c: Context<AppEnv>): Response {
  const requestId = c.get('requestId')

  if (isApiError(err)) {
    if (err.status >= 500) {
      console.error(`[${requestId}] ApiError ${err.code}:`, err.message)
    }
    return fail(c, err.status, err.code, err.message, err.details)
  }

  if (err instanceof ZodError) {
    return fail(c, 422, 'VALIDATION_ERROR', 'Some fields need attention.', zodIssues(err))
  }

  if (err instanceof HTTPException) {
    const status = err.status
    if (status === 404) {
      return fail(c, 404, 'NOT_FOUND', 'That endpoint does not exist.')
    }
    return fail(c, status, 'HTTP_ERROR', status >= 500 ? 'Something went wrong on our side.' : err.message)
  }

  console.error(`[${requestId}] Unhandled error:`, err?.stack ?? err)
  const generic = ApiError.internal()
  return fail(c, generic.status, generic.code, generic.message)
}

export function onNotFound(c: Context<AppEnv>): Response {
  return fail(c, 404, 'NOT_FOUND', 'That endpoint does not exist.')
}
