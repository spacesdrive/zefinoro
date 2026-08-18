import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../types/env'
import { ApiError } from '../lib/errors'
import { getRedis, rateLimit } from '../lib/redis'

interface RateLimitOptions {
  /** Namespace, so separate routes do not share a budget. */
  bucket: string
  limit: number
  windowSeconds: number
}

/**
 * Per-user fixed-window rate limiting, backed by Upstash.
 *
 * Fails open when Redis is unreachable: a cache outage should not lock people
 * out of their own ledger. The expensive, abusable routes (invite creation,
 * upload signing) are the ones that carry a limit.
 */
export function rateLimitBy({ bucket, limit, windowSeconds }: RateLimitOptions) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const redis = getRedis(c.env)
    const user = c.get('user')
    const subject = user?.id ?? c.req.header('CF-Connecting-IP') ?? 'anonymous'

    const result = await rateLimit(redis, bucket, subject, limit, windowSeconds)

    if (result && !result.allowed) {
      throw ApiError.tooManyRequests(
        `Too many requests. Try again in about ${Math.ceil(windowSeconds / 60)} minute(s).`
      )
    }

    if (result) {
      c.header('X-RateLimit-Limit', String(limit))
      c.header('X-RateLimit-Remaining', String(result.remaining))
    }

    await next()
  })
}
