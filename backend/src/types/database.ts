/**
 * NOTE: every shape here is a `type` alias rather than an `interface`.
 * supabase-js constrains its schema generic to `Record<string, unknown>`, and
 * TypeScript only grants implicit index signatures to type aliases - an
 * interface silently fails the constraint and the whole client degrades to
 * `never`, which surfaces as baffling "not assignable to never[]" errors.
 *
 * Hand-maintained mirror of the SQL in `supabase/migrations`.
 *
 * Regenerate with:
 *   supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type WorkspaceRole = 'owner' | 'admin' | 'member'
export type TransactionType = 'received' | 'spent'
export type MemberStatus = 'active' | 'invited' | 'suspended'

export type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
  updated_at: string
}

export type WorkspaceRow = {
  id: string
  name: string
  slug: string
  description: string | null
  avatar_url: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type WorkspaceMemberRow = {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  status: MemberStatus
  invited_by: string | null
  joined_at: string
  created_at: string
  updated_at: string
}

export type WorkspaceInvitationRow = {
  id: string
  workspace_id: string
  invite_code: string
  email: string | null
  invited_by: string
  role: WorkspaceRole
  max_uses: number
  use_count: number
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
}

export type CategoryRow = {
  id: string
  workspace_id: string
  name: string
  type: TransactionType
  color: string | null
  icon: string | null
  is_system: boolean
  created_at: string
  updated_at: string
}

export type TransactionRow = {
  id: string
  workspace_id: string
  created_by: string
  type: TransactionType
  amount: number
  currency: string
  title: string
  description: string | null
  category_id: string | null
  transaction_date: string
  /** Maintained by the `attachments_sync_count` trigger. */
  attachment_count: number
  created_at: string
  updated_at: string
}

export type AttachmentRow = {
  id: string
  transaction_id: string
  workspace_id: string
  uploaded_by: string
  original_filename: string
  mime_type: string
  file_size: number
  cloudinary_public_id: string
  secure_url: string
  resource_type: string
  created_at: string
}

export type WorkspaceSettingsRow = {
  workspace_id: string
  default_currency: string
  timezone: string
  date_format: string
  fiscal_year_start: number
  created_at: string
  updated_at: string
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>
      workspaces: Table<WorkspaceRow>
      workspace_members: Table<WorkspaceMemberRow>
      workspace_invitations: Table<WorkspaceInvitationRow>
      categories: Table<CategoryRow>
      transactions: Table<TransactionRow>
      transaction_attachments: Table<AttachmentRow>
      workspace_settings: Table<WorkspaceSettingsRow>
    }
    Views: { [_ in never]: never }
    Functions: {
      create_workspace: {
        Args: {
          p_name: string
          p_description?: string | null
          p_avatar_url?: string | null
          p_currency?: string
        }
        Returns: WorkspaceRow
      }
      create_invitation: {
        Args: {
          p_workspace_id: string
          p_role?: WorkspaceRole
          p_expires_in_days?: number
          p_max_uses?: number
          p_email?: string | null
        }
        Returns: WorkspaceInvitationRow
      }
      join_workspace: {
        Args: { p_invite_code: string }
        Returns: WorkspaceRow
      }
      preview_invitation: {
        Args: { p_invite_code: string }
        Returns: Array<{
          workspace_id: string | null
          workspace_name: string | null
          workspace_avatar_url: string | null
          role: WorkspaceRole | null
          valid: boolean
          reason: string | null
        }>
      }
      dashboard_stats: {
        Args: { p_workspace_id: string; p_from: string; p_to: string }
        Returns: DashboardStats
      }
      transaction_series: {
        Args: {
          p_workspace_id: string
          p_from: string
          p_to: string
          p_bucket?: 'day' | 'week' | 'month'
        }
        Returns: Array<{ bucket: string; received: number; spent: number }>
      }
      category_breakdown: {
        Args: {
          p_workspace_id: string
          p_from: string
          p_to: string
          p_type?: TransactionType
        }
        Returns: Array<{
          category_id: string | null
          category_name: string
          color: string | null
          total: number
          tx_count: number
        }>
      }
      my_workspaces: {
        Args: Record<PropertyKey, never>
        Returns: Array<
          Pick<WorkspaceRow, 'id' | 'name' | 'slug' | 'description' | 'avatar_url' | 'created_at'> & {
            role: WorkspaceRole
            member_count: number
            joined_at: string
          }
        >
      }
      is_workspace_member: { Args: { ws: string }; Returns: boolean }
      is_workspace_manager: { Args: { ws: string }; Returns: boolean }
    }
    Enums: {
      workspace_role: WorkspaceRole
      transaction_type: TransactionType
      member_status: MemberStatus
    }
    CompositeTypes: { [_ in never]: never }
  }
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
}
