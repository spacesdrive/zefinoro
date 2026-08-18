import type { Context } from 'hono'
import type { AppEnv } from '../types/env'
import { ApiError } from './errors'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Read a required path parameter.
 *
 * Hono types params as possibly-undefined, and a malformed id would otherwise
 * reach PostgREST and come back as an opaque 500. Validating the shape here
 * turns that into a clean 400.
 */
export function requireParam(c: Context<AppEnv>, name: string): string {
  const value = c.req.param(name)
  if (!value) {
    throw ApiError.badRequest(`Missing ${name}.`, 'MISSING_PARAM')
  }
  return value
}

export function requireUuidParam(c: Context<AppEnv>, name: string): string {
  const value = requireParam(c, name)
  if (!UUID_RE.test(value)) {
    throw ApiError.badRequest('That identifier is not valid.', 'INVALID_ID')
  }
  return value
}
