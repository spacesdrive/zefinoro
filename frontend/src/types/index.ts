export type WorkspaceRole = 'owner' | 'admin' | 'member'
export type TransactionType = 'received' | 'spent'
export type MemberStatus = 'active' | 'invited' | 'suspended'

export type PreviewKind =
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'text'
  | 'csv'
  | 'json'
  | 'office'
  | 'archive'
  | 'unknown'

export interface Profile {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  bio: string | null
  createdAt: string
}

export interface Actor {
  id: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

export interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  avatarUrl: string | null
  role: WorkspaceRole
  memberCount: number
  joinedAt?: string
  createdAt: string
}

export interface WorkspaceSettings {
  workspaceId: string
  defaultCurrency: string
  timezone: string
  dateFormat: string
  fiscalYearStart: number
}

export interface Category {
  id: string
  workspaceId: string
  name: string
  type: TransactionType
  color: string | null
  icon: string | null
  isSystem: boolean
}

export interface Attachment {
  id: string
  transactionId: string
  originalFilename: string
  mimeType: string
  fileSize: number
  resourceType: string
  previewKind: PreviewKind
  secureUrl: string
  previewUrl: string
  downloadUrl: string
  thumbnailUrl: string | null
  uploadedBy: string
  createdAt: string
}

export interface Transaction {
  id: string
  workspaceId: string
  type: TransactionType
  amount: number
  currency: string
  title: string
  description: string | null
  transactionDate: string
  createdAt: string
  updatedAt: string
  category: Category | null
  createdBy: Actor
  attachments: Attachment[]
  attachmentCount: number
}

export interface Member {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  status: MemberStatus
  joinedAt: string
  invitedBy: string | null
  user: Actor | null
}

export type InvitationStatus = 'active' | 'expired' | 'revoked' | 'used'

export interface Invitation {
  id: string
  workspaceId: string
  inviteCode: string
  email: string | null
  role: WorkspaceRole
  maxUses: number
  useCount: number
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  createdAt: string
  status: InvitationStatus
  inviteUrl: string | null
  invitedBy: Actor | null
}

export interface DashboardStats {
  period: { from: string; to: string }
  previousPeriod: { from: string; to: string }
  received: number
  spent: number
  balance: number
  receivedCount: number
  spentCount: number
  previous: { received: number; spent: number; balance: number }
  change: {
    received: number | null
    spent: number | null
    balance: number | null
  }
}

export interface SeriesPoint {
  date: string
  received: number
  spent: number
  net: number
}

export interface CategorySlice {
  categoryId: string | null
  name: string
  color: string | null
  total: number
  count: number
}

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface TransactionFilters {
  type?: TransactionType
  categoryId?: string
  createdBy?: string
  search?: string
  from?: string
  to?: string
  minAmount?: number
  maxAmount?: number
  hasAttachment?: boolean
  page?: number
  pageSize?: number
  sortBy?: 'transaction_date' | 'amount' | 'title' | 'created_at' | 'type'
  sortDir?: 'asc' | 'desc'
}

export interface InvitePreview {
  valid: boolean
  reason: string | null
  workspace: { id: string; name: string; avatarUrl: string | null } | null
  role: WorkspaceRole | null
}

/** Metadata the client sends after a direct-to-Cloudinary upload. */
export interface AttachmentInput {
  originalFilename: string
  mimeType: string
  fileSize: number
  cloudinaryPublicId: string
  secureUrl: string
  resourceType: 'image' | 'video' | 'raw' | 'auto'
}
