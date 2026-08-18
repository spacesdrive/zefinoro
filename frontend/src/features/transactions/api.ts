import { api } from '@/lib/api/client'
import type {
  Attachment,
  AttachmentInput,
  Category,
  CategorySlice,
  DashboardStats,
  PageMeta,
  SeriesPoint,
  Transaction,
  TransactionFilters,
  TransactionType,
} from '@/types'

export interface CreateTransactionInput {
  type: TransactionType
  amount: number
  currency: string
  title: string
  description?: string | null
  categoryId?: string | null
  transactionDate: string
  attachments?: AttachmentInput[]
}

export type UpdateTransactionInput = Partial<Omit<CreateTransactionInput, 'attachments'>>

function toQuery(filters: TransactionFilters): Record<string, string | number | boolean | undefined> {
  return {
    type: filters.type,
    categoryId: filters.categoryId,
    createdBy: filters.createdBy,
    search: filters.search,
    from: filters.from,
    to: filters.to,
    minAmount: filters.minAmount,
    maxAmount: filters.maxAmount,
    hasAttachment: filters.hasAttachment,
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  }
}

export const transactionsApi = {
  list: async (workspaceId: string, filters: TransactionFilters) => {
    const res = await api.get<Transaction[]>(`/workspaces/${workspaceId}/transactions`, {
      query: toQuery(filters),
    })
    return { items: res.data, meta: res.meta as unknown as PageMeta }
  },

  get: (workspaceId: string, transactionId: string) =>
    api.get<Transaction>(`/workspaces/${workspaceId}/transactions/${transactionId}`).then((r) => r.data),

  create: (workspaceId: string, input: CreateTransactionInput) =>
    api.post<Transaction>(`/workspaces/${workspaceId}/transactions`, input).then((r) => r.data),

  update: (workspaceId: string, transactionId: string, input: UpdateTransactionInput) =>
    api
      .patch<Transaction>(`/workspaces/${workspaceId}/transactions/${transactionId}`, input)
      .then((r) => r.data),

  remove: (workspaceId: string, transactionId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/transactions/${transactionId}`).then((r) => r.data),

  addAttachment: (workspaceId: string, transactionId: string, input: AttachmentInput) =>
    api
      .post<Attachment>(`/workspaces/${workspaceId}/transactions/${transactionId}/attachments`, input)
      .then((r) => r.data),

  removeAttachment: (workspaceId: string, attachmentId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/attachments/${attachmentId}`).then((r) => r.data),
}

export const categoriesApi = {
  list: (workspaceId: string, type?: TransactionType) =>
    api
      .get<Category[]>(`/workspaces/${workspaceId}/categories`, { query: { type } })
      .then((r) => r.data),

  create: (
    workspaceId: string,
    input: { name: string; type: TransactionType; color?: string | null; icon?: string | null }
  ) => api.post<Category>(`/workspaces/${workspaceId}/categories`, input).then((r) => r.data),

  update: (workspaceId: string, categoryId: string, input: { name?: string; color?: string | null }) =>
    api.patch<Category>(`/workspaces/${workspaceId}/categories/${categoryId}`, input).then((r) => r.data),

  remove: (workspaceId: string, categoryId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/categories/${categoryId}`).then((r) => r.data),
}

export interface PeriodParams {
  period: string
  from?: string
  to?: string
}

/**
 * The browser's local calendar date, sent with every analytics request.
 *
 * The server resolves relative presets ("last 30 days") against this rather
 * than against UTC. Without it, a user east of UTC who records a transaction
 * just after midnight sees it excluded from the current window, because their
 * day had rolled over and the server's had not.
 */
function localToday(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export const analyticsApi = {
  stats: (workspaceId: string, params: PeriodParams) =>
    api
      .get<DashboardStats>(`/workspaces/${workspaceId}/stats`, {
        query: { ...params, today: localToday() },
      })
      .then((r) => r.data),

  series: async (workspaceId: string, params: PeriodParams & { bucket?: string }) => {
    const res = await api.get<SeriesPoint[]>(`/workspaces/${workspaceId}/series`, {
      query: { ...params, today: localToday() },
    })
    return {
      points: res.data,
      bucket: ((res.meta?.bucket as string) ?? 'day') as 'day' | 'week' | 'month',
    }
  },

  breakdown: (workspaceId: string, params: PeriodParams & { type?: TransactionType }) =>
    api
      .get<CategorySlice[]>(`/workspaces/${workspaceId}/breakdown`, {
        query: { ...params, today: localToday() },
      })
      .then((r) => r.data),

  recent: (workspaceId: string, limit = 8) =>
    api.get<Transaction[]>(`/workspaces/${workspaceId}/recent`, { query: { limit } }).then((r) => r.data),
}
