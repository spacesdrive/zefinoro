import type { Context } from 'hono'
import type { z } from 'zod'
import type { AppEnv } from '../types/env'
import type { AttachmentRow, TransactionRow } from '../types/database'
import { ApiError, fromPostgrestError } from '../lib/errors'
import { buildPageMeta, created, noContent, ok, paginated } from '../lib/response'
import { serializeTransaction } from '../lib/serializers'
import { getValidated } from '../middleware/validate'
import { bumpWorkspaceVersion, getRedis } from '../lib/redis'
import { isOwnedCloudinaryUrl, transformsAllowed } from '../lib/cloudinary'
import { validateFile } from '../lib/files'
import { requireUuidParam } from '../lib/params'
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  updateTransactionSchema,
} from '../schemas'

/**
 * Selecting the full object graph in one round trip. The FK hint on `profiles`
 * is required because `transactions` could otherwise be joined to profiles
 * through more than one path.
 */
const FULL_SELECT = `
  *,
  category:categories(*),
  creator:profiles!transactions_created_by_fkey(id, full_name, email, avatar_url),
  attachments:transaction_attachments(*)
`

export async function listTransactions(c: Context<AppEnv>) {
  const query = getValidated<ListTransactionsQuery>(c)
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')

  let builder = supabase
    .from('transactions')
    .select(FULL_SELECT, { count: 'exact' })
    .eq('workspace_id', workspace.id)

  if (query.type) builder = builder.eq('type', query.type)
  if (query.categoryId) builder = builder.eq('category_id', query.categoryId)
  if (query.createdBy) builder = builder.eq('created_by', query.createdBy)
  if (query.from) builder = builder.gte('transaction_date', query.from)
  if (query.to) builder = builder.lte('transaction_date', query.to)
  if (query.minAmount != null) builder = builder.gte('amount', query.minAmount)
  if (query.maxAmount != null) builder = builder.lte('amount', query.maxAmount)

  if (query.hasAttachment === true) builder = builder.gt('attachment_count', 0)
  if (query.hasAttachment === false) builder = builder.eq('attachment_count', 0)

  if (query.search) {
    // Escape PostgREST's pattern metacharacters so a search for "100%" does not
    // silently become a wildcard.
    const term = query.search.replace(/[%_,()]/g, (m) => `\\${m}`)
    builder = builder.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
  }

  const offset = (query.page - 1) * query.pageSize
  builder = builder
    .order(query.sortBy, { ascending: query.sortDir === 'asc' })
    // A deterministic tiebreaker keeps pagination stable when many rows share a date.
    .order('created_at', { ascending: false })
    .range(offset, offset + query.pageSize - 1)

  const { data, error, count } = await builder
  if (error) throw fromPostgrestError(error)

  const cloudName = c.env.CLOUDINARY_CLOUD_NAME
  const allowTransforms = transformsAllowed(c.env)
  const items = (data ?? []).map((row) =>
    serializeTransaction(row as unknown as TransactionRow & Record<string, never>, cloudName, allowTransforms)
  )

  return paginated(c, items, buildPageMeta(query.page, query.pageSize, count ?? 0))
}

export async function getTransaction(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const id = requireUuidParam(c, 'transactionId')

  const { data, error } = await supabase
    .from('transactions')
    .select(FULL_SELECT)
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (error) throw fromPostgrestError(error)
  if (!data) throw ApiError.notFound('That transaction could not be found.')

  return ok(c, serializeTransaction(data as unknown as TransactionRow & Record<string, never>, c.env.CLOUDINARY_CLOUD_NAME, transformsAllowed(c.env)))
}

export async function createTransaction(c: Context<AppEnv>) {
  const input = getValidated<CreateTransactionInput>(c)
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const user = c.get('user')

  // Re-validate every attachment server-side. The browser already checked, but
  // the browser is not a security boundary - and an attachment claiming to
  // live in someone else's Cloudinary account is rejected outright.
  for (const att of input.attachments ?? []) {
    const check = validateFile({
      filename: att.originalFilename,
      mimeType: att.mimeType,
      size: att.fileSize,
    })
    if (!check.ok) {
      throw ApiError.unprocessable(check.message, check.code)
    }
    if (!isOwnedCloudinaryUrl(c.env, att.secureUrl)) {
      throw ApiError.unprocessable('That attachment URL is not recognised.', 'ATTACHMENT_URL_REJECTED')
    }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      workspace_id: workspace.id,
      created_by: user.id,
      type: input.type,
      amount: input.amount,
      currency: input.currency ?? 'INR',
      title: input.title,
      description: input.description || null,
      category_id: input.categoryId || null,
      transaction_date: input.transactionDate,
    })
    .select('id')
    .single()

  if (error) throw fromPostgrestError(error)

  const transactionId = (data as { id: string }).id

  if (input.attachments?.length) {
    const { error: attErr } = await supabase.from('transaction_attachments').insert(
      input.attachments.map((att) => ({
        transaction_id: transactionId,
        workspace_id: workspace.id,
        uploaded_by: user.id,
        original_filename: att.originalFilename,
        mime_type: att.mimeType,
        file_size: att.fileSize,
        cloudinary_public_id: att.cloudinaryPublicId,
        secure_url: att.secureUrl,
        resource_type: att.resourceType,
      }))
    )

    if (attErr) {
      // Postgres has no cross-statement rollback for us here, so the transaction
      // row would otherwise survive without its files. Remove it and report the
      // failure rather than leaving a half-recorded expense behind.
      await supabase.from('transactions').delete().eq('id', transactionId)
      throw fromPostgrestError(attErr)
    }
  }

  await bumpWorkspaceVersion(getRedis(c.env), workspace.id)

  const { data: full, error: readErr } = await supabase
    .from('transactions')
    .select(FULL_SELECT)
    .eq('id', transactionId)
    .single()

  if (readErr) throw fromPostgrestError(readErr)

  return created(c, serializeTransaction(full as unknown as TransactionRow & Record<string, never>, c.env.CLOUDINARY_CLOUD_NAME, transformsAllowed(c.env)))
}

export async function updateTransaction(c: Context<AppEnv>) {
  const input = getValidated<z.infer<typeof updateTransactionSchema>>(c)
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const id = requireUuidParam(c, 'transactionId')

  const patch: Partial<TransactionRow> = {}
  if (input.type !== undefined) patch.type = input.type
  if (input.amount !== undefined) patch.amount = input.amount
  if (input.currency !== undefined) patch.currency = input.currency
  if (input.title !== undefined) patch.title = input.title
  if (input.description !== undefined) patch.description = input.description || null
  if (input.categoryId !== undefined) patch.category_id = input.categoryId || null
  if (input.transactionDate !== undefined) patch.transaction_date = input.transactionDate

  // Changing the type can strand a category that only exists for the old type;
  // the database trigger would reject it, so clear it unless one was supplied.
  if (input.type !== undefined && input.categoryId === undefined) {
    const { data: existing } = await supabase
      .from('transactions')
      .select('type, category_id')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .maybeSingle()

    if (existing && existing.type !== input.type && existing.category_id) {
      patch.category_id = null
    }
  }

  const { data, error } = await supabase
    .from('transactions')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .select(FULL_SELECT)
    .maybeSingle()

  if (error) throw fromPostgrestError(error)
  if (!data) throw ApiError.notFound('That transaction could not be found, or you cannot edit it.')

  await bumpWorkspaceVersion(getRedis(c.env), workspace.id)
  return ok(c, serializeTransaction(data as unknown as TransactionRow & Record<string, never>, c.env.CLOUDINARY_CLOUD_NAME, transformsAllowed(c.env)))
}

export async function deleteTransaction(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const id = requireUuidParam(c, 'transactionId')

  const { data: attachments } = await supabase
    .from('transaction_attachments')
    .select('cloudinary_public_id, resource_type')
    .eq('transaction_id', id)
    .eq('workspace_id', workspace.id)

  const { data, error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .select('id')
    .maybeSingle()

  if (error) throw fromPostgrestError(error)
  if (!data) throw ApiError.notFound('That transaction could not be found, or you cannot delete it.')

  // Attachment rows cascade; the Cloudinary assets do not. Clean them up in the
  // background so the response is not held up by a third-party API.
  const rows = (attachments ?? []) as Pick<AttachmentRow, 'cloudinary_public_id' | 'resource_type'>[]
  if (rows.length) {
    c.executionCtx.waitUntil(cleanupAssets(c, rows))
  }

  await bumpWorkspaceVersion(getRedis(c.env), workspace.id)
  return noContent(c)
}

async function cleanupAssets(
  c: Context<AppEnv>,
  rows: Pick<AttachmentRow, 'cloudinary_public_id' | 'resource_type'>[]
) {
  const { deleteFile } = await import('../lib/cloudinary')
  for (const row of rows) {
    try {
      await deleteFile(
        c.env,
        row.cloudinary_public_id,
        (row.resource_type || 'image') as 'image' | 'video' | 'raw'
      )
    } catch (err) {
      console.error('Cloudinary cleanup failed for', row.cloudinary_public_id, err)
    }
  }
}
