import type { Context } from 'hono'
import type { AppEnv } from '../types/env'
import type { AttachmentRow } from '../types/database'
import { ApiError, fromPostgrestError } from '../lib/errors'
import { created, noContent, ok } from '../lib/response'
import { serializeAttachment } from '../lib/serializers'
import { getValidated } from '../middleware/validate'
import { bumpWorkspaceVersion, getRedis } from '../lib/redis'
import {
  createUploadSignature,
  deleteFile,
  isOwnedCloudinaryUrl,
  transformsAllowed,
} from '../lib/cloudinary'
import { MAX_FILES_PER_TRANSACTION, validateFile } from '../lib/files'
import type { attachmentInputSchema, uploadSignatureSchema } from '../schemas'
import { requireUuidParam } from '../lib/params'
import type { z } from 'zod'

/**
 * Issue a short-lived signature for a direct browser upload.
 *
 * Uploads are always signed. An unsigned preset would be a bearer token sitting
 * in the JS bundle - anyone could read it and upload to the cloud from a
 * script. Signing per request means only an authenticated member of this
 * workspace can upload, and the destination folder is fixed server-side rather
 * than taken from the client.
 */
export async function getUploadConfig(c: Context<AppEnv>) {
  const input = getValidated<z.infer<typeof uploadSignatureSchema>>(c)
  const workspace = c.get('workspace')

  const check = validateFile({
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.fileSize,
  })
  if (!check.ok) throw ApiError.unprocessable(check.message, check.code)

  const sig = await createUploadSignature(c.env, workspace.id)

  return ok(c, {
    cloudName: sig.cloudName,
    apiKey: sig.apiKey,
    signature: sig.signature,
    timestamp: sig.timestamp,
    folder: sig.folder,
    resourceType: check.spec.resourceType,
    endpoint: `https://api.cloudinary.com/v1_1/${sig.cloudName}/${check.spec.resourceType}/upload`,
  })
}

export async function listAttachments(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const transactionId = requireUuidParam(c, 'transactionId')

  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('*')
    .eq('transaction_id', transactionId)
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: true })

  if (error) throw fromPostgrestError(error)

  const cloudName = c.env.CLOUDINARY_CLOUD_NAME
  return ok(c, (data ?? []).map((row) => serializeAttachment(row as AttachmentRow, cloudName, transformsAllowed(c.env))))
}

/** Attach an already-uploaded Cloudinary asset to an existing transaction. */
export async function addAttachment(c: Context<AppEnv>) {
  const input = getValidated<z.infer<typeof attachmentInputSchema>>(c)
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const user = c.get('user')
  const transactionId = requireUuidParam(c, 'transactionId')

  const check = validateFile({
    filename: input.originalFilename,
    mimeType: input.mimeType,
    size: input.fileSize,
  })
  if (!check.ok) throw ApiError.unprocessable(check.message, check.code)

  if (!isOwnedCloudinaryUrl(c.env, input.secureUrl)) {
    throw ApiError.unprocessable('That attachment URL is not recognised.', 'ATTACHMENT_URL_REJECTED')
  }

  const { count } = await supabase
    .from('transaction_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('transaction_id', transactionId)

  if ((count ?? 0) >= MAX_FILES_PER_TRANSACTION) {
    throw ApiError.unprocessable(
      `A transaction can have at most ${MAX_FILES_PER_TRANSACTION} attachments.`,
      'TOO_MANY_ATTACHMENTS'
    )
  }

  const { data, error } = await supabase
    .from('transaction_attachments')
    .insert({
      transaction_id: transactionId,
      workspace_id: workspace.id,
      uploaded_by: user.id,
      original_filename: input.originalFilename,
      mime_type: input.mimeType,
      file_size: input.fileSize,
      cloudinary_public_id: input.cloudinaryPublicId,
      secure_url: input.secureUrl,
      resource_type: input.resourceType,
    })
    .select('*')
    .single()

  if (error) throw fromPostgrestError(error)

  await bumpWorkspaceVersion(getRedis(c.env), workspace.id)
  return created(c, serializeAttachment(data as AttachmentRow, c.env.CLOUDINARY_CLOUD_NAME, transformsAllowed(c.env)))
}

export async function deleteAttachment(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const workspace = c.get('workspace')
  const attachmentId = requireUuidParam(c, 'attachmentId')

  const { data, error } = await supabase
    .from('transaction_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('workspace_id', workspace.id)
    .select('cloudinary_public_id, resource_type')
    .maybeSingle()

  if (error) throw fromPostgrestError(error)
  if (!data) throw ApiError.notFound('That attachment could not be found, or you cannot remove it.')

  const row = data as Pick<AttachmentRow, 'cloudinary_public_id' | 'resource_type'>

  // The database row is the source of truth for what the app shows, so it is
  // removed synchronously; the remote asset is best-effort.
  c.executionCtx.waitUntil(
    deleteFile(c.env, row.cloudinary_public_id, (row.resource_type || 'image') as 'image' | 'video' | 'raw')
      .then((res) => {
        if (!res.deleted) {
          console.warn('Cloudinary asset not deleted:', row.cloudinary_public_id, res.reason)
        }
      })
      .catch((err) => console.error('Cloudinary delete failed:', err))
  )

  await bumpWorkspaceVersion(getRedis(c.env), workspace.id)
  return noContent(c)
}
