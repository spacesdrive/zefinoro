import type { Context } from 'hono'
import type { AppEnv } from '../types/env'
import type { DashboardStats, TransactionRow } from '../types/database'
import { fromPostgrestError } from '../lib/errors'
import { ok } from '../lib/response'
import { serializeTransaction } from '../lib/serializers'
import { getValidated } from '../middleware/validate'
import { CacheKeys, CacheTTL, cached, getRedis, getWorkspaceVersion } from '../lib/redis'
import { autoBucket, resolvePeriod } from '../lib/dates'
import { transformsAllowed } from '../lib/cloudinary'
import type { PeriodQuery } from '../schemas'

/**
 * All figures here are computed by Postgres from the transaction rows - the
 * client sends a period, never a total. Results are cached in Redis behind a
 * per-workspace version counter that every mutation bumps, so a new transaction
 * is reflected immediately rather than after the TTL.
 */

function periodOf(c: Context<AppEnv>) {
  const query = getValidated<PeriodQuery>(c)

  // Anchor relative presets to the caller's local date when they supply it, so
  // "today" means their today rather than UTC's.
  const anchor = query.today ? new Date(`${query.today}T12:00:00.000Z`) : new Date()

  const range = resolvePeriod(query.period, { from: query.from, to: query.to }, anchor)
  const bucket = query.bucket === 'auto' ? autoBucket(range) : query.bucket
  return { range, bucket }
}

export async function getDashboardStats(c: Context<AppEnv>) {
  const workspace = c.get('workspace')
  const supabase = c.get('supabase')
  const { range } = periodOf(c)

  const redis = getRedis(c.env)
  const version = await getWorkspaceVersion(redis, workspace.id)
  const key = `${CacheKeys.dashboardStats(workspace.id, range.from, range.to)}:v${version}`

  const stats = await cached(redis, key, CacheTTL.analytics, async () => {
    const { data, error } = await supabase.rpc('dashboard_stats', {
      p_workspace_id: workspace.id,
      p_from: range.from,
      p_to: range.to,
    })
    if (error) throw fromPostgrestError(error)
    return data as unknown as DashboardStats
  })

  return ok(c, withDeltas(stats))
}

/** Percentage change vs. the preceding period of equal length. */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1))
}

function withDeltas(stats: DashboardStats) {
  const received = Number(stats.received)
  const spent = Number(stats.spent)
  const balance = Number(stats.balance)
  const prev = stats.previous

  return {
    period: stats.period,
    previousPeriod: stats.previousPeriod,
    received,
    spent,
    balance,
    receivedCount: Number(stats.receivedCount),
    spentCount: Number(stats.spentCount),
    previous: {
      received: Number(prev.received),
      spent: Number(prev.spent),
      balance: Number(prev.balance),
    },
    change: {
      received: percentChange(received, Number(prev.received)),
      spent: percentChange(spent, Number(prev.spent)),
      balance: percentChange(balance, Number(prev.balance)),
    },
  }
}

export async function getSeries(c: Context<AppEnv>) {
  const workspace = c.get('workspace')
  const supabase = c.get('supabase')
  const { range, bucket } = periodOf(c)

  const redis = getRedis(c.env)
  const version = await getWorkspaceVersion(redis, workspace.id)
  const key = `${CacheKeys.series(workspace.id, range.from, range.to, bucket)}:v${version}`

  const series = await cached(redis, key, CacheTTL.analytics, async () => {
    const { data, error } = await supabase.rpc('transaction_series', {
      p_workspace_id: workspace.id,
      p_from: range.from,
      p_to: range.to,
      p_bucket: bucket,
    })
    if (error) throw fromPostgrestError(error)

    return (data ?? []).map((row) => {
      const receivedValue = Number(row.received)
      const spentValue = Number(row.spent)
      return {
        date: row.bucket,
        received: receivedValue,
        spent: spentValue,
        net: Number((receivedValue - spentValue).toFixed(2)),
      }
    })
  })

  return ok(c, series, { bucket, period: range })
}

export async function getCategoryBreakdown(c: Context<AppEnv>) {
  const workspace = c.get('workspace')
  const supabase = c.get('supabase')
  const { range } = periodOf(c)
  const type = c.req.query('type') === 'received' ? 'received' : 'spent'

  const redis = getRedis(c.env)
  const version = await getWorkspaceVersion(redis, workspace.id)
  const key = `${CacheKeys.breakdown(workspace.id, range.from, range.to, type)}:v${version}`

  const breakdown = await cached(redis, key, CacheTTL.analytics, async () => {
    const { data, error } = await supabase.rpc('category_breakdown', {
      p_workspace_id: workspace.id,
      p_from: range.from,
      p_to: range.to,
      p_type: type,
    })
    if (error) throw fromPostgrestError(error)

    return (data ?? []).map((row) => ({
      categoryId: row.category_id,
      name: row.category_name ?? 'Uncategorized',
      color: row.color,
      total: Number(row.total),
      count: Number(row.tx_count),
    }))
  })

  return ok(c, breakdown, { type, period: range })
}

/** Recent activity for the dashboard's "Recent Bills" panel. */
export async function getRecentTransactions(c: Context<AppEnv>) {
  const workspace = c.get('workspace')
  const supabase = c.get('supabase')

  const limitParam = Number(c.req.query('limit') ?? 8)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, limitParam), 25) : 8

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      category:categories(*),
      creator:profiles!transactions_created_by_fkey(id, full_name, email, avatar_url),
      attachments:transaction_attachments(*)
    `)
    .eq('workspace_id', workspace.id)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw fromPostgrestError(error)

  const cloudName = c.env.CLOUDINARY_CLOUD_NAME
  const allowTransforms = transformsAllowed(c.env)
  return ok(
    c,
    (data ?? []).map((row) =>
      serializeTransaction(row as unknown as TransactionRow & Record<string, never>, cloudName, allowTransforms)
    )
  )
}
