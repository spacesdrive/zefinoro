import type {
  AttachmentRow,
  CategoryRow,
  ProfileRow,
  TransactionRow,
  WorkspaceInvitationRow,
  WorkspaceMemberRow,
  WorkspaceRow,
  WorkspaceSettingsRow,
} from '../types/database'
import {
  getDownloadUrl,
  getPdfThumbnailUrl,
  getPreviewUrl,
  getThumbnailUrl,
  type CloudinaryResourceType,
} from './cloudinary'
import { previewKindFor } from './files'

/**
 * DB rows are snake_case; the API speaks camelCase. Converting in one place
 * keeps column names an implementation detail rather than a public contract.
 */

export interface SerializedProfile {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  bio: string | null
  createdAt: string
}

export function serializeProfile(row: ProfileRow): SerializedProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    createdAt: row.created_at,
  }
}

/** A compact author reference for embedding in transactions and members. */
export interface SerializedActor {
  id: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

export function serializeActor(row: Partial<ProfileRow> & { id: string }): SerializedActor {
  return {
    id: row.id,
    fullName: row.full_name ?? null,
    email: row.email ?? '',
    avatarUrl: row.avatar_url ?? null,
  }
}

export function serializeWorkspace(row: WorkspaceRow, extras?: { role?: string; memberCount?: number }) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    avatarUrl: row.avatar_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(extras?.role ? { role: extras.role } : {}),
    ...(extras?.memberCount != null ? { memberCount: extras.memberCount } : {}),
  }
}

export function serializeMember(
  row: WorkspaceMemberRow & { profile?: ProfileRow | null }
) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    invitedBy: row.invited_by,
    user: row.profile ? serializeActor(row.profile) : null,
  }
}

export function serializeInvitation(
  row: WorkspaceInvitationRow & { inviter?: ProfileRow | null },
  appUrl?: string
) {
  const expired = new Date(row.expires_at).getTime() <= Date.now()
  const exhausted = row.use_count >= row.max_uses
  const status = row.revoked_at ? 'revoked' : expired ? 'expired' : exhausted ? 'used' : 'active'

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    inviteCode: row.invite_code,
    email: row.email,
    role: row.role,
    maxUses: row.max_uses,
    useCount: row.use_count,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    status,
    inviteUrl: appUrl ? `${appUrl}/join?code=${encodeURIComponent(row.invite_code)}` : null,
    invitedBy: row.inviter ? serializeActor(row.inviter) : null,
  }
}

export function serializeCategory(row: CategoryRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    type: row.type,
    color: row.color,
    icon: row.icon,
    isSystem: row.is_system,
  }
}

export interface SerializedAttachment {
  id: string
  transactionId: string
  originalFilename: string
  mimeType: string
  fileSize: number
  resourceType: string
  previewKind: string
  secureUrl: string
  previewUrl: string
  downloadUrl: string
  thumbnailUrl: string | null
  uploadedBy: string
  createdAt: string
}

/**
 * Attachment URLs.
 *
 * By default these are the plain `secure_url` Cloudinary returned at upload
 * time. Transformed delivery URLs (thumbnails, `fl_attachment` downloads) are
 * only emitted when the cloud is known to permit them.
 *
 * The reason is Cloudinary's "Strict Transformations" setting: with it enabled
 * - as it is on the default configuration - *any* transformation in the path
 * returns 401, including a plain resize or an attachment flag, while the
 * untransformed URL serves fine. Deriving clever URLs unconditionally produces
 * an attachment list where every image is a broken icon. Downloads instead
 * preserve their filename client-side via a blob, which needs no transformation
 * at all.
 */
export function serializeAttachment(
  row: AttachmentRow,
  cloudName: string | undefined,
  allowTransforms = false
): SerializedAttachment {
  const resourceType = (row.resource_type || 'image') as CloudinaryResourceType
  const previewKind = previewKindFor(row.mime_type, row.original_filename)

  // A PDF stored as an image resource can be rasterised, which yields a real
  // page preview in the list rather than a generic icon.
  const canRasterisePdf = previewKind === 'pdf' && resourceType === 'image'

  const derived =
    cloudName && allowTransforms
      ? {
          previewUrl: getPreviewUrl(
            cloudName,
            row.cloudinary_public_id,
            resourceType,
            previewKind === 'pdf' ? 'pdf' : undefined
          ),
          downloadUrl: getDownloadUrl(cloudName, row.cloudinary_public_id, resourceType, row.original_filename),
          thumbnailUrl:
            previewKind === 'image'
              ? getThumbnailUrl(cloudName, row.cloudinary_public_id)
              : canRasterisePdf
                ? getPdfThumbnailUrl(cloudName, row.cloudinary_public_id)
                : null,
        }
      : {
          previewUrl: row.secure_url,
          downloadUrl: row.secure_url,
          // Rasterising a PDF page is itself a transformation, so it is not
          // available here either; the list falls back to a typed icon.
          thumbnailUrl: previewKind === 'image' ? row.secure_url : null,
        }

  return {
    id: row.id,
    transactionId: row.transaction_id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    resourceType: row.resource_type,
    previewKind,
    secureUrl: row.secure_url,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    ...derived,
  }
}

export interface TransactionJoins {
  category?: CategoryRow | null
  creator?: ProfileRow | null
  attachments?: AttachmentRow[] | null
}

export function serializeTransaction(
  row: TransactionRow & TransactionJoins,
  cloudName: string | undefined,
  allowTransforms = false
) {
  const attachments = (row.attachments ?? []).map((a) =>
    serializeAttachment(a, cloudName, allowTransforms)
  )

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    // `numeric` arrives as a string from PostgREST; the API always emits a number.
    amount: typeof row.amount === 'string' ? Number(row.amount) : row.amount,
    currency: row.currency,
    title: row.title,
    description: row.description,
    transactionDate: row.transaction_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: row.category ? serializeCategory(row.category) : null,
    createdBy: row.creator ? serializeActor(row.creator) : { id: row.created_by, fullName: null, email: '', avatarUrl: null },
    attachments,
    attachmentCount: attachments.length,
  }
}

export function serializeWorkspaceSettings(row: WorkspaceSettingsRow) {
  return {
    workspaceId: row.workspace_id,
    defaultCurrency: row.default_currency,
    timezone: row.timezone,
    dateFormat: row.date_format,
    fiscalYearStart: row.fiscal_year_start,
  }
}
