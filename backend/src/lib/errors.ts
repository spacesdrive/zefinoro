import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Every error surfaced to a client is an ApiError with a stable machine code
 * and a message safe to render verbatim in the UI. Raw Postgres/Supabase
 * strings never reach the browser - `fromPostgrestError` maps them first.
 */
export class ApiError extends Error {
  readonly status: ContentfulStatusCode
  readonly code: string
  readonly details?: unknown

  constructor(
    status: ContentfulStatusCode,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(message = 'The request was invalid.', code = 'BAD_REQUEST', details?: unknown) {
    return new ApiError(400, code, message, details)
  }
  static unauthorized(message = 'You need to sign in to continue.', code = 'UNAUTHENTICATED') {
    return new ApiError(401, code, message)
  }
  static forbidden(message = 'You do not have permission to do that.', code = 'FORBIDDEN') {
    return new ApiError(403, code, message)
  }
  static notFound(message = 'That item could not be found.', code = 'NOT_FOUND') {
    return new ApiError(404, code, message)
  }
  static conflict(message = 'That conflicts with something that already exists.', code = 'CONFLICT') {
    return new ApiError(409, code, message)
  }
  static payloadTooLarge(message = 'That file is too large.', code = 'PAYLOAD_TOO_LARGE') {
    return new ApiError(413, code, message)
  }
  static unprocessable(message = 'Some fields need attention.', code = 'VALIDATION_ERROR', details?: unknown) {
    return new ApiError(422, code, message, details)
  }
  static tooManyRequests(message = 'Too many requests. Please slow down.', code = 'RATE_LIMITED') {
    return new ApiError(429, code, message)
  }
  static internal(message = 'Something went wrong on our side.', code = 'INTERNAL_ERROR') {
    return new ApiError(500, code, message)
  }
}

/**
 * Domain errors raised by `raise exception '<CODE>'` inside our RPCs, plus the
 * Postgres error classes we expect to see. Anything unmapped degrades to a
 * generic 500 so internals never leak.
 */
const DOMAIN_ERRORS: Record<string, { status: ContentfulStatusCode; message: string }> = {
  UNAUTHENTICATED:            { status: 401, message: 'You need to sign in to continue.' },
  FORBIDDEN:                  { status: 403, message: 'You do not have permission to do that.' },
  WORKSPACE_NAME_REQUIRED:    { status: 422, message: 'Please give the workspace a name.' },
  WORKSPACE_NAME_TOO_LONG:    { status: 422, message: 'Workspace names are limited to 80 characters.' },
  WORKSPACE_LAST_OWNER:       { status: 409, message: 'A workspace must always keep at least one owner.' },
  INVITE_INVALID:             { status: 404, message: 'That invite code is not valid.' },
  INVITE_EXPIRED:             { status: 410, message: 'That invite code has expired.' },
  INVITE_REVOKED:             { status: 410, message: 'That invite code has been revoked.' },
  INVITE_EXHAUSTED:           { status: 410, message: 'That invite code has already been used.' },
  ALREADY_MEMBER:             { status: 409, message: 'You are already a member of this workspace.' },
  CANNOT_INVITE_AS_OWNER:     { status: 422, message: 'Owners cannot be invited - assign the role after joining.' },
  INVALID_EXPIRY:             { status: 422, message: 'Choose an expiry between 1 and 90 days.' },
  INVITE_CODE_GENERATION_FAILED: { status: 500, message: 'Could not generate an invite code. Please try again.' },
  CATEGORY_NOT_FOUND:         { status: 422, message: 'That category no longer exists.' },
  CATEGORY_WORKSPACE_MISMATCH:{ status: 422, message: 'That category belongs to a different workspace.' },
  CATEGORY_TYPE_MISMATCH:     { status: 422, message: 'That category does not match the transaction type.' },
  TRANSACTION_NOT_FOUND:      { status: 404, message: 'That transaction could not be found.' },
  ATTACHMENT_WORKSPACE_MISMATCH: { status: 422, message: 'That attachment belongs to a different workspace.' },
  INVALID_DATE_RANGE:         { status: 422, message: 'Please choose a valid date range.' },
  INVALID_BUCKET:             { status: 422, message: 'Unsupported grouping interval.' },
}

interface PostgrestLikeError {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

/**
 * Translate a Supabase/PostgREST error into a client-safe ApiError.
 */
export function fromPostgrestError(error: PostgrestLikeError): ApiError {
  const raw = error.message ?? ''

  // Our own `raise exception 'CODE'` values arrive inside the message text.
  for (const [code, mapped] of Object.entries(DOMAIN_ERRORS)) {
    if (raw.includes(code)) {
      return new ApiError(mapped.status, code, mapped.message)
    }
  }

  switch (error.code) {
    case 'PGRST116': // no rows returned by .single()
      return ApiError.notFound()
    case '23505': // unique_violation
      return ApiError.conflict('That already exists.')
    case '23503': // foreign_key_violation
      return ApiError.unprocessable('A referenced item no longer exists.')
    case '23514': // check_violation
      return ApiError.unprocessable('Some values are outside the allowed range.')
    case '42501': // insufficient_privilege - an RLS policy refused the row
      return ApiError.forbidden()
    case 'PGRST301':
      return ApiError.unauthorized('Your session has expired. Please sign in again.')
    default:
      // The user gets a generic message, but an unmapped database failure is a
      // bug: log enough to identify it without making the operator reproduce it.
      console.error('Unmapped database error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      return ApiError.internal()
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}
