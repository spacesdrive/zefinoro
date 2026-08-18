/**
 * Date-range resolution for dashboard and analytics queries.
 *
 * Everything is computed in UTC and exchanged as `YYYY-MM-DD` strings, matching
 * the `date` column type. Keeping the boundary logic here (rather than in the
 * browser) means the server, not the client, decides what "this month" means.
 */

export type PeriodPreset =
  | 'today'
  | '7d'
  | '30d'
  | '90d'
  | '12m'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom'

export interface DateRange {
  from: string
  to: string
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function parseISODate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function addDaysUTC(d: Date, days: number): Date {
  const copy = new Date(d.getTime())
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

/**
 * Resolve a preset into a concrete inclusive range.
 * `custom` requires both bounds and falls back to the last 30 days if either is
 * missing or malformed.
 */
export function resolvePeriod(
  preset: PeriodPreset,
  custom?: { from?: string; to?: string },
  now: Date = new Date()
): DateRange {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  switch (preset) {
    case 'today':
      return { from: toISODate(today), to: toISODate(today) }

    case '7d':
      return { from: toISODate(addDaysUTC(today, -6)), to: toISODate(today) }

    case '30d':
      return { from: toISODate(addDaysUTC(today, -29)), to: toISODate(today) }

    case '90d':
      return { from: toISODate(addDaysUTC(today, -89)), to: toISODate(today) }

    case '12m': {
      const from = new Date(today.getTime())
      from.setUTCMonth(from.getUTCMonth() - 11)
      from.setUTCDate(1)
      return { from: toISODate(from), to: toISODate(today) }
    }

    case 'this_month': {
      const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
      return { from: toISODate(from), to: toISODate(today) }
    }

    case 'last_month': {
      const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
      // Day 0 of the current month is the last day of the previous one.
      const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))
      return { from: toISODate(from), to: toISODate(to) }
    }

    case 'this_year': {
      const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1))
      return { from: toISODate(from), to: toISODate(today) }
    }

    case 'custom': {
      const from = custom?.from && parseISODate(custom.from) ? custom.from : null
      const to = custom?.to && parseISODate(custom.to) ? custom.to : null
      if (!from || !to) return resolvePeriod('30d', undefined, now)
      return from <= to ? { from, to } : { from: to, to: from }
    }

    default:
      return resolvePeriod('30d', undefined, now)
  }
}

/**
 * Pick a sensible chart bucket for a range: daily up to ~3 months, weekly up to
 * a year, monthly beyond. Prevents a 12-month chart rendering 365 bars.
 */
export function autoBucket(range: DateRange): 'day' | 'week' | 'month' {
  const from = parseISODate(range.from)
  const to = parseISODate(range.to)
  if (!from || !to) return 'day'

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  if (days <= 92) return 'day'
  if (days <= 400) return 'week'
  return 'month'
}

export function daysBetween(range: DateRange): number {
  const from = parseISODate(range.from)
  const to = parseISODate(range.to)
  if (!from || !to) return 0
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
}
