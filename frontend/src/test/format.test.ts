import { describe, expect, it } from 'vitest'
import {
  displayName,
  formatBytes,
  formatCurrency,
  formatPercent,
  initialsOf,
  toDateInputValue,
} from '@/lib/format'

describe('formatCurrency', () => {
  it('formats rupees with the correct symbol and two decimals', () => {
    expect(formatCurrency(1234.5, 'INR')).toContain('1,234.50')
    expect(formatCurrency(1234.5, 'INR')).toContain('₹')
  })

  it('handles other currencies', () => {
    expect(formatCurrency(99, 'USD')).toContain('99.00')
  })

  it('formats negative balances rather than dropping the sign', () => {
    expect(formatCurrency(-500, 'INR')).toContain('500.00')
    expect(formatCurrency(-500, 'INR')).toMatch(/-|\(/)
  })

  it('degrades to a plain number for an unknown currency code', () => {
    // An invalid code must not throw and take a dashboard down with it.
    expect(() => formatCurrency(10, 'XYZ')).not.toThrow()
  })

  it('formats zero', () => {
    expect(formatCurrency(0, 'INR')).toContain('0.00')
  })
})

describe('formatPercent', () => {
  it('prefixes a positive change with a plus sign', () => {
    expect(formatPercent(12.3)).toBe('+12.3%')
  })

  it('keeps the minus on a negative change', () => {
    expect(formatPercent(-4)).toBe('-4.0%')
  })

  it('renders an em dash when there is nothing to compare', () => {
    expect(formatPercent(null)).toBe('--')
    expect(formatPercent(undefined)).toBe('--')
  })
})

describe('initialsOf', () => {
  it('takes the first and last initials of a full name', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL')
  })

  it('uses two letters for a single name', () => {
    expect(initialsOf('Ada')).toBe('AD')
  })

  it('falls back to the email local part when there is no name', () => {
    expect(initialsOf(null, 'ada.lovelace@example.com')).toBe('AL')
  })

  it('returns a placeholder when it has nothing to work with', () => {
    expect(initialsOf(null)).toBe('?')
    expect(initialsOf('   ')).toBe('?')
  })

  it('ignores middle names', () => {
    expect(initialsOf('Ada King Lovelace')).toBe('AL')
  })
})

describe('displayName', () => {
  it('prefers the full name', () => {
    expect(displayName({ fullName: 'Ada', email: 'a@b.c' })).toBe('Ada')
  })

  it('falls back to the email, then to Unknown', () => {
    expect(displayName({ fullName: null, email: 'a@b.c' })).toBe('a@b.c')
    expect(displayName(null)).toBe('Unknown')
  })
})

describe('formatBytes', () => {
  it('formats across unit boundaries', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(1024 * 1024 * 5)).toBe('5.0 MB')
  })

  it('rejects nonsense sizes rather than printing NaN', () => {
    expect(formatBytes(Number.NaN)).toBe('--')
    expect(formatBytes(-1)).toBe('--')
  })
})

describe('toDateInputValue', () => {
  it('emits YYYY-MM-DD in local time', () => {
    // Constructed with local components, so this is independent of timezone.
    expect(toDateInputValue(new Date(2026, 7, 17))).toBe('2026-08-17')
  })

  it('zero-pads single-digit months and days', () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
