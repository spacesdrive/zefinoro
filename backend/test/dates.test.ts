import { describe, expect, it } from 'vitest'
import { autoBucket, daysBetween, resolvePeriod, toISODate } from '../src/lib/dates'

// A fixed "now" so the suite does not drift with the wall clock.
const NOW = new Date('2026-08-17T10:30:00.000Z')

describe('resolvePeriod', () => {
  it('treats today as a single inclusive day', () => {
    expect(resolvePeriod('today', undefined, NOW)).toEqual({ from: '2026-08-17', to: '2026-08-17' })
  })

  it('counts today as one of the last 7 days', () => {
    // 11th..17th inclusive is 7 days, not 8.
    expect(resolvePeriod('7d', undefined, NOW)).toEqual({ from: '2026-08-11', to: '2026-08-17' })
    expect(daysBetween(resolvePeriod('7d', undefined, NOW))).toBe(7)
  })

  it('resolves 30 and 90 day windows inclusively', () => {
    expect(daysBetween(resolvePeriod('30d', undefined, NOW))).toBe(30)
    expect(daysBetween(resolvePeriod('90d', undefined, NOW))).toBe(90)
  })

  it('starts this_month on the first of the month', () => {
    expect(resolvePeriod('this_month', undefined, NOW)).toEqual({ from: '2026-08-01', to: '2026-08-17' })
  })

  it('covers the whole of last month, including its final day', () => {
    expect(resolvePeriod('last_month', undefined, NOW)).toEqual({ from: '2026-07-01', to: '2026-07-31' })
  })

  it('handles a last_month that follows a 29-day February', () => {
    const march = new Date('2024-03-10T00:00:00.000Z') // 2024 is a leap year
    expect(resolvePeriod('last_month', undefined, march)).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })

  it('starts this_year on 1 January', () => {
    expect(resolvePeriod('this_year', undefined, NOW)).toEqual({ from: '2026-01-01', to: '2026-08-17' })
  })

  it('accepts a valid custom range', () => {
    expect(resolvePeriod('custom', { from: '2026-01-05', to: '2026-02-05' }, NOW))
      .toEqual({ from: '2026-01-05', to: '2026-02-05' })
  })

  it('swaps a reversed custom range rather than returning nothing', () => {
    expect(resolvePeriod('custom', { from: '2026-02-05', to: '2026-01-05' }, NOW))
      .toEqual({ from: '2026-01-05', to: '2026-02-05' })
  })

  it('falls back to 30 days when a custom range is incomplete or malformed', () => {
    const fallback = resolvePeriod('30d', undefined, NOW)
    expect(resolvePeriod('custom', { from: '2026-01-05' }, NOW)).toEqual(fallback)
    expect(resolvePeriod('custom', { from: 'nonsense', to: '2026-01-05' }, NOW)).toEqual(fallback)
  })
})

describe('autoBucket', () => {
  it('uses daily buckets for short ranges', () => {
    expect(autoBucket({ from: '2026-08-01', to: '2026-08-17' })).toBe('day')
  })

  it('switches to weekly past a quarter', () => {
    expect(autoBucket({ from: '2026-01-01', to: '2026-08-17' })).toBe('week')
  })

  it('switches to monthly past a year', () => {
    expect(autoBucket({ from: '2024-01-01', to: '2026-08-17' })).toBe('month')
  })
})

describe('toISODate', () => {
  it('emits YYYY-MM-DD', () => {
    expect(toISODate(NOW)).toBe('2026-08-17')
  })
})

describe('anchoring to the caller local date', () => {
  it('includes the caller today when UTC has not rolled over yet', () => {
    // 17 Aug 18:57 UTC is already 18 Aug in IST. Anchoring to the caller's date
    // keeps a transaction they just recorded inside "last 30 days".
    const anchor = new Date('2026-08-18T12:00:00.000Z')
    const range = resolvePeriod('30d', undefined, anchor)

    expect(range.to).toBe('2026-08-18')
    expect(range.from).toBe('2026-07-20')
  })

  it('would exclude that transaction without the anchor', () => {
    const utcNow = new Date('2026-08-17T18:57:00.000Z')
    expect(resolvePeriod('30d', undefined, utcNow).to).toBe('2026-08-17')
  })
})
