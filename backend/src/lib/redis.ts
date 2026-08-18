import { Redis } from '@upstash/redis/cloudflare'
import type { Bindings } from '../types/env'

/**
 * Upstash Redis is a *cache*, never the source of truth. Every read falls
 * through to Postgres on a miss, and every failure is swallowed - a cache
 * outage must never take the API down with it.
 */

let client: Redis | null = null
let clientKey = ''

export function getRedis(env: Bindings): Redis | null {
  const url = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const key = `${url}:${token.slice(0, 8)}`
  if (!client || clientKey !== key) {
    client = new Redis({ url, token })
    clientKey = key
  }
  return client
}

export const CacheKeys = {
  dashboardStats: (ws: string, from: string, to: string) => `ws:${ws}:stats:${from}:${to}`,
  series: (ws: string, from: string, to: string, bucket: string) =>
    `ws:${ws}:series:${bucket}:${from}:${to}`,
  breakdown: (ws: string, from: string, to: string, type: string) =>
    `ws:${ws}:breakdown:${type}:${from}:${to}`,
  categories: (ws: string) => `ws:${ws}:categories`,
  memberCount: (ws: string) => `ws:${ws}:members:count`,
  /** Monotonic counter mixed into every analytics key for this workspace. */
  version: (ws: string) => `ws:${ws}:v`,
  rateLimit: (bucket: string, subject: string) => `rl:${bucket}:${subject}`,
} as const

export const CacheTTL = {
  analytics: 120,      // seconds - short, because money must look live
  categories: 600,
  memberCount: 300,
} as const

/**
 * Cache invalidation by *version bump* rather than key deletion.
 *
 * Upstash has no cheap wildcard delete, and SCAN across a shared keyspace is
 * slow and racy. Instead every analytics key embeds a per-workspace version
 * counter; bumping it orphans the whole generation at once, and the orphans
 * expire on their own TTL.
 */
export async function getWorkspaceVersion(redis: Redis | null, workspaceId: string): Promise<string> {
  if (!redis) return '0'
  try {
    const v = await redis.get<number | string>(CacheKeys.version(workspaceId))
    return v == null ? '0' : String(v)
  } catch {
    return '0'
  }
}

export async function bumpWorkspaceVersion(redis: Redis | null, workspaceId: string): Promise<void> {
  if (!redis) return
  try {
    await redis.incr(CacheKeys.version(workspaceId))
  } catch {
    // A failed bump would serve stale analytics for at most `CacheTTL.analytics`
    // seconds. Not worth failing the user's write over.
  }
}

/**
 * Read-through cache helper. Returns the fresh value on any cache error.
 */
export async function cached<T>(
  redis: Redis | null,
  key: string,
  ttlSeconds: number,
  produce: () => Promise<T>
): Promise<T> {
  if (!redis) return produce()

  try {
    const hit = await redis.get<T>(key)
    if (hit !== null && hit !== undefined) return hit
  } catch {
    return produce()
  }

  const value = await produce()

  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch {
    // Non-fatal: the value is already computed and correct.
  }

  return value
}

/**
 * Fixed-window rate limiter. Returns the remaining allowance, or null when
 * Redis is unavailable (fail-open - the API stays usable without a cache).
 */
export async function rateLimit(
  redis: Redis | null,
  bucket: string,
  subject: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number } | null> {
  if (!redis) return null

  const key = CacheKeys.rateLimit(bucket, subject)
  try {
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, windowSeconds)
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
  } catch {
    return null
  }
}
