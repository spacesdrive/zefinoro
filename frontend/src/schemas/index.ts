import { z } from 'zod'

/**
 * Form schemas.
 *
 * These mirror the API's contract so users get immediate, field-level feedback.
 * The server validates independently - this copy is for the experience, not
 * for safety.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const isoDateSchema = z
  .string()
  .min(1, 'Pick a date.')
  .regex(ISO_DATE, 'Use the format YYYY-MM-DD.')
  .refine((v) => {
    // JavaScript rolls 2026-02-30 forward to March rather than rejecting it, so
    // the parsed value is compared back against the input.
    const parsed = new Date(`${v}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v
  }, 'That date does not exist.')

export const amountFieldSchema = z
  .string()
  .min(1, 'Enter an amount.')
  .refine((v) => {
    const n = Number(v.replace(/,/g, '').trim())
    return Number.isFinite(n)
  }, 'Enter a valid amount.')
  .refine((v) => Number(v.replace(/,/g, '')) > 0, 'Amount must be greater than zero.')
  .refine((v) => {
    const decimals = v.split('.')[1]
    return !decimals || decimals.length <= 2
  }, 'Use at most two decimal places.')

export const transactionFormSchema = z.object({
  type: z.enum(['received', 'spent'], { errorMap: () => ({ message: 'Choose Received or Spent.' }) }),
  amount: amountFieldSchema,
  currency: z.string().length(3, 'Choose a currency.'),
  title: z.string().trim().min(1, 'Give this transaction a title.').max(160, 'Keep the title under 160 characters.'),
  description: z.string().trim().max(2000, 'Keep the description under 2000 characters.').optional(),
  categoryId: z.string().optional(),
  transactionDate: isoDateSchema,
})

export type TransactionFormValues = z.infer<typeof transactionFormSchema>

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Passwords are limited to 72 characters.')

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Enter your name.').max(120, 'That name is too long.'),
    email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Those passwords do not match.',
    path: ['confirmPassword'],
  })

export const changePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Those passwords do not match.',
    path: ['confirmPassword'],
  })

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export const createWorkspaceFormSchema = z.object({
  name: z.string().trim().min(1, 'Give your workspace a name.').max(80, 'Keep the name under 80 characters.'),
  description: z.string().trim().max(500, 'Keep the description under 500 characters.').optional(),
  avatarUrl: z.string().trim().url('That does not look like a valid URL.').optional().or(z.literal('')),
  currency: z.string().length(3).default('INR'),
})

export const joinWorkspaceFormSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(1, 'Enter an invite code.')
    .refine((v) => v.replace(/-/g, '').length === 8, 'Invite codes are 8 characters, like NX7K-42PM.'),
})

export type CreateWorkspaceValues = z.infer<typeof createWorkspaceFormSchema>
export type JoinWorkspaceValues = z.infer<typeof joinWorkspaceFormSchema>

// ---------------------------------------------------------------------------
// Profile & invitations
// ---------------------------------------------------------------------------

export const profileFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.').max(120, 'That name is too long.'),
  avatarUrl: z.string().trim().url('That does not look like a valid URL.').optional().or(z.literal('')),
  bio: z.string().trim().max(500, 'Keep your bio under 500 characters.').optional(),
})

export const inviteFormSchema = z.object({
  role: z.enum(['admin', 'member']),
  expiresInDays: z.coerce.number().int().min(1).max(90),
  maxUses: z.coerce.number().int().min(1).max(100),
  email: z.string().trim().email('Enter a valid email address.').optional().or(z.literal('')),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>
export type InviteFormValues = z.infer<typeof inviteFormSchema>
