import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'

/**
 * Formatting helpers.
 *
 * Amounts are always stored as numbers plus a currency code and formatted at
 * the edge - a formatted string is never treated as a value.
 */

const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(currency: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${currency}:${JSON.stringify(options)}`
  const cached = formatterCache.get(key)
  if (cached) return cached

  let formatter: Intl.NumberFormat
  try {
    formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency, ...options })
  } catch {
    // An unknown currency code should degrade to a plain number, not crash a page.
    formatter = new Intl.NumberFormat('en-IN', { style: 'decimal', ...options })
  }
  formatterCache.set(key, formatter)
  return formatter
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return getFormatter(currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

/** Whole-rupee display for dense surfaces such as chart axes. */
export function formatCurrencyCompact(amount: number, currency = 'INR'): string {
  const abs = Math.abs(amount)
  if (abs >= 1000) {
    return getFormatter(currency, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return getFormatter(currency, { maximumFractionDigits: 0 }).format(amount)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function toDate(value: string | Date): Date | null {
  const date = typeof value === 'string' ? parseISO(value) : value
  return isValid(date) ? date : null
}

export function formatDate(value: string | Date, pattern = 'dd MMM yyyy'): string {
  const date = toDate(value)
  return date ? format(date, pattern) : '--'
}

export function formatDateTime(value: string | Date): string {
  const date = toDate(value)
  return date ? format(date, 'dd MMM yyyy, h:mm a') : '--'
}

export function formatRelative(value: string | Date): string {
  const date = toDate(value)
  if (!date) return '--'
  return `${formatDistanceToNowStrict(date)} ago`
}

/** `YYYY-MM-DD` in local time, for date inputs and API filters. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '--'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

/** Initials for avatar fallbacks, from a name or failing that an email. */
export function initialsOf(name: string | null | undefined, email?: string | null): string {
  const source = name?.trim() || email?.split('@')[0] || ''
  if (!source) return '?'

  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

export function displayName(actor: { fullName: string | null; email: string } | null | undefined): string {
  if (!actor) return 'Unknown'
  return actor.fullName?.trim() || actor.email || 'Unknown'
}

/** Label a chart bucket according to how wide the bucket is. */
export function formatBucketLabel(date: string, bucket: 'day' | 'week' | 'month'): string {
  const parsed = toDate(date)
  if (!parsed) return date
  if (bucket === 'month') return format(parsed, 'MMM yyyy')
  if (bucket === 'week') return format(parsed, 'dd MMM')
  return format(parsed, 'dd MMM')
}
