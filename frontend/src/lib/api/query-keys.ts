import type { TransactionFilters } from '@/types'

/**
 * Query keys.
 *
 * Every workspace-scoped key carries the workspace id as its second segment.
 * That is what makes switching workspaces safe: the cache for workspace A can
 * never be read as workspace B's, and `invalidateWorkspace(id)` can drop one
 * tenant's data without touching another's.
 */
export const queryKeys = {
  me: ['me'] as const,
  workspaces: ['workspaces'] as const,

  workspace: (id: string) => ['workspace', id] as const,
  settings: (id: string) => ['workspace', id, 'settings'] as const,
  categories: (id: string) => ['workspace', id, 'categories'] as const,
  members: (id: string) => ['workspace', id, 'members'] as const,
  invitations: (id: string) => ['workspace', id, 'invitations'] as const,

  stats: (id: string, period: string, from?: string, to?: string) =>
    ['workspace', id, 'stats', period, from ?? '', to ?? ''] as const,
  series: (id: string, period: string, from?: string, to?: string) =>
    ['workspace', id, 'series', period, from ?? '', to ?? ''] as const,
  breakdown: (id: string, period: string, type: string, from?: string, to?: string) =>
    ['workspace', id, 'breakdown', type, period, from ?? '', to ?? ''] as const,
  recent: (id: string, limit: number) => ['workspace', id, 'recent', limit] as const,

  transactions: (id: string, filters: TransactionFilters) =>
    ['workspace', id, 'transactions', filters] as const,
  transaction: (id: string, transactionId: string) =>
    ['workspace', id, 'transaction', transactionId] as const,

  invitePreview: (code: string) => ['invite-preview', code] as const,
} as const

/** Every cached entry belonging to one workspace. */
export const workspaceScope = (id: string) => ['workspace', id] as const
