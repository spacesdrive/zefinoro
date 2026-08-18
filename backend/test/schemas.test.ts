import { describe, expect, it } from 'vitest'
import {
  amountSchema,
  createTransactionSchema,
  createWorkspaceSchema,
  joinWorkspaceSchema,
  listTransactionsQuerySchema,
} from '../src/schemas'

describe('amountSchema', () => {
  it('accepts numbers and numeric strings', () => {
    expect(amountSchema.parse(1250.5)).toBe(1250.5)
    expect(amountSchema.parse('1250.50')).toBe(1250.5)
  })

  it('strips thousands separators typed by hand', () => {
    expect(amountSchema.parse('1,250.50')).toBe(1250.5)
  })

  it('rejects zero and negatives - direction is the transaction type, not the sign', () => {
    expect(amountSchema.safeParse(0).success).toBe(false)
    expect(amountSchema.safeParse(-10).success).toBe(false)
  })

  it('rejects more precision than the column can store', () => {
    // numeric(18,2) would silently round this; better to refuse it.
    expect(amountSchema.safeParse(10.999).success).toBe(false)
  })

  it('rejects values that are not numbers at all', () => {
    expect(amountSchema.safeParse('abc').success).toBe(false)
    expect(amountSchema.safeParse('').success).toBe(false)
    expect(amountSchema.safeParse(Number.NaN).success).toBe(false)
    expect(amountSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false)
  })
})

describe('createTransactionSchema', () => {
  const base = {
    type: 'spent' as const,
    amount: '499.99',
    title: 'Groceries',
    transactionDate: '2026-08-17',
  }

  it('accepts a minimal transaction with no attachment', () => {
    const parsed = createTransactionSchema.parse(base)
    expect(parsed.amount).toBe(499.99)
    expect(parsed.currency).toBe('INR')
    expect(parsed.attachments).toEqual([])
  })

  it('uppercases the currency code', () => {
    expect(createTransactionSchema.parse({ ...base, currency: 'usd' }).currency).toBe('USD')
  })

  it('requires a non-empty title', () => {
    expect(createTransactionSchema.safeParse({ ...base, title: '   ' }).success).toBe(false)
  })

  it('rejects an invalid transaction type', () => {
    expect(createTransactionSchema.safeParse({ ...base, type: 'transfer' }).success).toBe(false)
  })

  it('rejects a malformed date', () => {
    expect(createTransactionSchema.safeParse({ ...base, transactionDate: '17-08-2026' }).success).toBe(false)
    expect(createTransactionSchema.safeParse({ ...base, transactionDate: '2026-02-30' }).success).toBe(false)
  })

  it('rejects an attachment served over plain HTTP', () => {
    const result = createTransactionSchema.safeParse({
      ...base,
      attachments: [
        {
          originalFilename: 'r.png',
          mimeType: 'image/png',
          fileSize: 100,
          cloudinaryPublicId: 'x',
          secureUrl: 'http://res.cloudinary.com/a/image/upload/x.png',
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})

describe('createWorkspaceSchema', () => {
  it('trims the name', () => {
    expect(createWorkspaceSchema.parse({ name: '  Home  ' }).name).toBe('Home')
  })

  it('rejects an empty or overlong name', () => {
    expect(createWorkspaceSchema.safeParse({ name: '' }).success).toBe(false)
    expect(createWorkspaceSchema.safeParse({ name: 'x'.repeat(81) }).success).toBe(false)
  })
})

describe('joinWorkspaceSchema', () => {
  it('uppercases a lowercase code', () => {
    expect(joinWorkspaceSchema.parse({ inviteCode: 'nx7k-42pm' }).inviteCode).toBe('NX7K-42PM')
  })

  it('rejects codes of the wrong length', () => {
    expect(joinWorkspaceSchema.safeParse({ inviteCode: 'NX7K' }).success).toBe(false)
  })
})

describe('listTransactionsQuerySchema', () => {
  it('applies sensible defaults', () => {
    const q = listTransactionsQuerySchema.parse({})
    expect(q).toMatchObject({ page: 1, pageSize: 20, sortBy: 'transaction_date', sortDir: 'desc' })
  })

  it('coerces numeric query strings', () => {
    const q = listTransactionsQuerySchema.parse({ page: '3', pageSize: '50' })
    expect(q.page).toBe(3)
    expect(q.pageSize).toBe(50)
  })

  it('caps the page size so a client cannot ask for everything', () => {
    expect(listTransactionsQuerySchema.safeParse({ pageSize: '5000' }).success).toBe(false)
  })

  it('rejects sorting by an arbitrary column', () => {
    expect(listTransactionsQuerySchema.safeParse({ sortBy: 'created_by; drop table' }).success).toBe(false)
  })

  it('parses the attachment filter into a boolean', () => {
    expect(listTransactionsQuerySchema.parse({ hasAttachment: 'true' }).hasAttachment).toBe(true)
    expect(listTransactionsQuerySchema.parse({ hasAttachment: 'false' }).hasAttachment).toBe(false)
  })
})
