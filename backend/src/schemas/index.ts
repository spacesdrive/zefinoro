import { z } from 'zod'
import { ISO_DATE } from '../lib/dates'
import { MAX_FILE_BYTES } from '../lib/files'

/**
 * Request schemas. These are the API's contract; the frontend mirrors them for
 * form-level validation, but only these decide what reaches the database.
 */

export const uuid = z.string().uuid('That identifier is not valid.')

/**
 * A calendar date that actually exists.
 *
 * A plain `new Date()` check is not enough: JavaScript silently rolls
 * "2026-02-30" over to 2 March rather than reporting an error, so the parsed
 * date is compared back against the input.
 */
export const isoDate = z
  .string()
  .regex(ISO_DATE, 'Use the format YYYY-MM-DD.')
  .refine((v) => {
    const parsed = new Date(`${v}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v
  }, 'That date does not exist.')

export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code, e.g. INR.')

export const transactionType = z.enum(['received', 'spent'], {
  errorMap: () => ({ message: 'Choose either Received or Spent.' }),
})

export const workspaceRole = z.enum(['owner', 'admin', 'member'])
export const assignableRole = z.enum(['admin', 'member'], {
  errorMap: () => ({ message: 'Choose either Admin or Member.' }),
})

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------
export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'Give your workspace a name.').max(80, 'Keep the name under 80 characters.'),
  description: z.string().trim().max(500, 'Keep the description under 500 characters.').optional().nullable(),
  avatarUrl: z.string().url('That does not look like a valid URL.').max(1000).optional().nullable(),
  currency: currencyCode.optional().default('INR'),
})

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1, 'Give your workspace a name.').max(80).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    avatarUrl: z.string().url().max(1000).optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')

export const joinWorkspaceSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(8, 'Invite codes are 8 characters.')
    .max(9, 'Invite codes are 8 characters.'),
})

export const workspaceSettingsSchema = z
  .object({
    defaultCurrency: currencyCode.optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    dateFormat: z.string().trim().min(1).max(32).optional(),
    fiscalYearStart: z.number().int().min(1).max(12).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------
export const createInvitationSchema = z.object({
  role: assignableRole.default('member'),
  expiresInDays: z.number().int().min(1).max(90).default(7),
  maxUses: z.number().int().min(1).max(100).default(1),
  email: z.string().trim().email('Enter a valid email address.').optional().nullable(),
})

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
export const updateMemberSchema = z.object({
  role: workspaceRole,
})

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/**
 * Money arrives as a string or number and is normalised to 2dp. Rejecting
 * more than 2 decimal places keeps the client honest about what will actually
 * be stored in `numeric(18,2)` - silently rounding someone's money is worse
 * than telling them.
 */
export const amountSchema = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim())
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid amount.' })
      return z.NEVER
    }
    return n
  })
  .refine((n) => n > 0, 'Amount must be greater than zero.')
  .refine((n) => n <= 9_999_999_999_999.99, 'That amount is too large.')
  .refine((n) => Number.isInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, {
    message: 'Use at most two decimal places.',
  })
  .transform((n) => Math.round(n * 100) / 100)

export const attachmentInputSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(160),
  fileSize: z.number().int().positive().max(MAX_FILE_BYTES),
  cloudinaryPublicId: z.string().trim().min(1).max(400),
  secureUrl: z.string().url().startsWith('https://', 'Attachments must be served over HTTPS.').max(1500),
  resourceType: z.enum(['image', 'video', 'raw', 'auto']).default('auto'),
})

export const createTransactionSchema = z.object({
  type: transactionType,
  amount: amountSchema,
  currency: currencyCode.optional().default('INR'),
  title: z.string().trim().min(1, 'Give this transaction a title.').max(160, 'Keep the title under 160 characters.'),
  description: z.string().trim().max(2000, 'Keep the description under 2000 characters.').optional().nullable(),
  categoryId: uuid.optional().nullable(),
  transactionDate: isoDate,
  attachments: z.array(attachmentInputSchema).max(10, 'Attach at most 10 files.').optional().default([]),
})

export const updateTransactionSchema = z
  .object({
    type: transactionType.optional(),
    amount: amountSchema.optional(),
    currency: currencyCode.optional(),
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    categoryId: uuid.optional().nullable(),
    transactionDate: isoDate.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')

const sortableColumns = ['transaction_date', 'amount', 'title', 'created_at', 'type'] as const

export const listTransactionsQuerySchema = z.object({
  type: transactionType.optional(),
  categoryId: uuid.optional(),
  createdBy: uuid.optional(),
  search: z.string().trim().max(160).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  minAmount: z.coerce.number().nonnegative().optional(),
  maxAmount: z.coerce.number().nonnegative().optional(),
  hasAttachment: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(sortableColumns).default('transaction_date'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Give the category a name.').max(60),
  type: transactionType,
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #22c55e.').optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
})

export const updateCategorySchema = createCategorySchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  'Nothing to update.'
)

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Enter your name.').max(120).optional(),
    avatarUrl: z.string().url('That does not look like a valid URL.').max(1000).optional().nullable(),
    bio: z.string().trim().max(500, 'Keep your bio under 500 characters.').optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.')

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export const periodQuerySchema = z.object({
  period: z
    .enum(['today', '7d', '30d', '90d', '12m', 'this_month', 'last_month', 'this_year', 'custom'])
    .default('30d'),
  from: isoDate.optional(),
  to: isoDate.optional(),
  bucket: z.enum(['day', 'week', 'month', 'auto']).default('auto'),
  /**
   * The caller's local calendar date, used only to anchor relative presets.
   *
   * Without it the server resolves "today" in UTC, so a user in IST recording a
   * transaction just after midnight would see it fall outside "last 30 days" --
   * their day had rolled over while UTC's had not. The figures are still
   * computed entirely from stored rows; the client only says which day it is
   * where they are.
   */
  today: isoDate.optional(),
})

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------
export const uploadSignatureSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(160),
  fileSize: z.number().int().positive(),
})

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type PeriodQuery = z.infer<typeof periodQuerySchema>
