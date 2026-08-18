import { describe, expect, it } from 'vitest'
import {
  isoDateSchema,
  joinWorkspaceFormSchema,
  loginSchema,
  signupSchema,
  transactionFormSchema,
} from '@/schemas'
import { checkFile, previewKindOf } from '@/lib/files'

describe('transactionFormSchema', () => {
  const base = {
    type: 'spent' as const,
    amount: '499.99',
    currency: 'INR',
    title: 'Groceries',
    transactionDate: '2026-08-17',
  }

  it('accepts a valid transaction', () => {
    expect(transactionFormSchema.safeParse(base).success).toBe(true)
  })

  it('rejects zero and negative amounts - direction is the type, not the sign', () => {
    expect(transactionFormSchema.safeParse({ ...base, amount: '0' }).success).toBe(false)
    expect(transactionFormSchema.safeParse({ ...base, amount: '-5' }).success).toBe(false)
  })

  it('rejects more than two decimal places', () => {
    expect(transactionFormSchema.safeParse({ ...base, amount: '10.999' }).success).toBe(false)
  })

  it('rejects a non-numeric amount', () => {
    expect(transactionFormSchema.safeParse({ ...base, amount: 'lots' }).success).toBe(false)
  })

  it('requires a title', () => {
    expect(transactionFormSchema.safeParse({ ...base, title: '  ' }).success).toBe(false)
  })
})

describe('isoDateSchema', () => {
  it('accepts a real date', () => {
    expect(isoDateSchema.safeParse('2026-08-17').success).toBe(true)
  })

  it('rejects a date that does not exist', () => {
    // JavaScript would roll this forward to 2 March rather than complaining.
    expect(isoDateSchema.safeParse('2026-02-30').success).toBe(false)
  })

  it('accepts 29 February in a leap year but not otherwise', () => {
    expect(isoDateSchema.safeParse('2024-02-29').success).toBe(true)
    expect(isoDateSchema.safeParse('2026-02-29').success).toBe(false)
  })

  it('rejects the wrong format', () => {
    expect(isoDateSchema.safeParse('17-08-2026').success).toBe(false)
  })
})

describe('signupSchema', () => {
  const base = {
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'supersecret',
    confirmPassword: 'supersecret',
  }

  it('accepts matching passwords', () => {
    expect(signupSchema.safeParse(base).success).toBe(true)
  })

  it('reports a mismatch on the confirm field, where the user can see it', () => {
    const result = signupSchema.safeParse({ ...base, confirmPassword: 'different' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword'])
    }
  })

  it('enforces a minimum password length', () => {
    expect(signupSchema.safeParse({ ...base, password: 'short', confirmPassword: 'short' }).success).toBe(
      false
    )
  })

  it('rejects a malformed email', () => {
    expect(signupSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('requires both fields', () => {
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false)
  })
})

describe('joinWorkspaceFormSchema', () => {
  it('accepts a code with or without the dash', () => {
    expect(joinWorkspaceFormSchema.safeParse({ inviteCode: 'NX7K-42PM' }).success).toBe(true)
    expect(joinWorkspaceFormSchema.safeParse({ inviteCode: 'NX7K42PM' }).success).toBe(true)
  })

  it('rejects a code of the wrong length', () => {
    expect(joinWorkspaceFormSchema.safeParse({ inviteCode: 'NX7K' }).success).toBe(false)
  })
})

describe('checkFile', () => {
  function fakeFile(name: string, type: string, size: number): File {
    const file = new File(['x'], name, { type })
    // File size is read-only, so it is stubbed for the size checks.
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  it('accepts a receipt image', () => {
    expect(checkFile(fakeFile('receipt.png', 'image/png', 5000)).ok).toBe(true)
  })

  it('rejects an unsupported type', () => {
    expect(checkFile(fakeFile('bad.exe', 'application/x-msdownload', 5000)).ok).toBe(false)
  })

  it('rejects a file above the global ceiling', () => {
    expect(checkFile(fakeFile('huge.mp4', 'video/mp4', 30 * 1024 * 1024)).ok).toBe(false)
  })

  it('rejects a MIME type that contradicts the extension', () => {
    expect(checkFile(fakeFile('invoice.pdf', 'image/png', 5000)).ok).toBe(false)
  })

  it('trusts the extension when the browser reports no type', () => {
    expect(checkFile(fakeFile('notes.csv', '', 5000)).ok).toBe(true)
  })
})

describe('previewKindOf', () => {
  it('maps each family to a renderer the browser can use', () => {
    expect(previewKindOf('image/png', 'a.png')).toBe('image')
    expect(previewKindOf('application/pdf', 'a.pdf')).toBe('pdf')
    expect(previewKindOf('video/mp4', 'a.mp4')).toBe('video')
    expect(previewKindOf('text/csv', 'a.csv')).toBe('csv')
  })

  it('admits when there is no renderer', () => {
    expect(previewKindOf('application/x-thing', 'a.thing')).toBe('unknown')
  })
})
