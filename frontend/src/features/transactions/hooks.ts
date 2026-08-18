import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys, workspaceScope } from '@/lib/api/query-keys'
import { errorMessage } from '@/lib/api/client'
import { useWorkspaceId } from '@/contexts/workspace-context'
import {
  analyticsApi,
  categoriesApi,
  transactionsApi,
  type CreateTransactionInput,
  type PeriodParams,
  type UpdateTransactionInput,
} from './api'
import type { AttachmentInput, TransactionFilters, TransactionType } from '@/types'

/**
 * Invalidate everything derived from the ledger.
 *
 * Totals, charts, the table and the recent list all read the same rows, so a
 * single write has to refresh all of them; scoping to the workspace keeps other
 * tenants' caches untouched.
 */
function useInvalidateWorkspaceData() {
  const queryClient = useQueryClient()
  const workspaceId = useWorkspaceId()
  return () => queryClient.invalidateQueries({ queryKey: workspaceScope(workspaceId) })
}

export function useTransactions(filters: TransactionFilters) {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: queryKeys.transactions(workspaceId, filters),
    queryFn: () => transactionsApi.list(workspaceId, filters),
    // Keeps the previous page on screen while the next one loads, so the table
    // does not collapse to a skeleton on every pagination click.
    placeholderData: keepPreviousData,
  })
}

export function useTransaction(transactionId: string | null) {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: queryKeys.transaction(workspaceId, transactionId ?? ''),
    queryFn: () => transactionsApi.get(workspaceId, transactionId!),
    enabled: Boolean(transactionId),
  })
}

export function useCreateTransaction() {
  const workspaceId = useWorkspaceId()
  const invalidate = useInvalidateWorkspaceData()

  return useMutation({
    mutationFn: (input: CreateTransactionInput) => transactionsApi.create(workspaceId, input),
    // Deliberately not optimistic: a transaction that appears in the ledger and
    // then vanishes because the server rejected it is far worse than a brief
    // spinner when the subject is money.
    onSuccess: async (transaction) => {
      await invalidate()
      toast.success('Transaction added', { description: transaction.title })
    },
    onError: (error) => toast.error('Could not add the transaction', { description: errorMessage(error) }),
  })
}

export function useUpdateTransaction() {
  const workspaceId = useWorkspaceId()
  const invalidate = useInvalidateWorkspaceData()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTransactionInput }) =>
      transactionsApi.update(workspaceId, id, input),
    onSuccess: async () => {
      await invalidate()
      toast.success('Transaction updated')
    },
    onError: (error) => toast.error('Could not update the transaction', { description: errorMessage(error) }),
  })
}

export function useDeleteTransaction() {
  const workspaceId = useWorkspaceId()
  const invalidate = useInvalidateWorkspaceData()

  return useMutation({
    mutationFn: (id: string) => transactionsApi.remove(workspaceId, id),
    onSuccess: async () => {
      await invalidate()
      toast.success('Transaction deleted')
    },
    onError: (error) => toast.error('Could not delete the transaction', { description: errorMessage(error) }),
  })
}

export function useAddAttachment() {
  const workspaceId = useWorkspaceId()
  const invalidate = useInvalidateWorkspaceData()

  return useMutation({
    mutationFn: ({ transactionId, input }: { transactionId: string; input: AttachmentInput }) =>
      transactionsApi.addAttachment(workspaceId, transactionId, input),
    onSuccess: async () => {
      await invalidate()
      toast.success('File attached')
    },
    onError: (error) => toast.error('Could not attach the file', { description: errorMessage(error) }),
  })
}

/**
 * Attach several already-uploaded files to an existing transaction.
 *
 * Posting them one at a time through `useAddAttachment` would fire a toast per
 * file; this reports once for the batch.
 */
export function useAddAttachments() {
  const workspaceId = useWorkspaceId()
  const invalidate = useInvalidateWorkspaceData()

  return useMutation({
    mutationFn: async ({ transactionId, inputs }: { transactionId: string; inputs: AttachmentInput[] }) => {
      const saved = []
      for (const input of inputs) {
        saved.push(await transactionsApi.addAttachment(workspaceId, transactionId, input))
      }
      return saved
    },
    onSuccess: async (saved) => {
      await invalidate()
      if (saved.length) {
        toast.success(saved.length === 1 ? 'File attached' : `${saved.length} files attached`)
      }
    },
    onError: (error) => toast.error('Could not attach the files', { description: errorMessage(error) }),
  })
}

export function useDeleteAttachment() {
  const workspaceId = useWorkspaceId()
  const invalidate = useInvalidateWorkspaceData()

  return useMutation({
    mutationFn: (attachmentId: string) => transactionsApi.removeAttachment(workspaceId, attachmentId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Attachment removed')
    },
    onError: (error) => toast.error('Could not remove the attachment', { description: errorMessage(error) }),
  })
}

export function useCategories(type?: TransactionType) {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: [...queryKeys.categories(workspaceId), type ?? 'all'],
    queryFn: () => categoriesApi.list(workspaceId, type),
    staleTime: 5 * 60_000,
  })
}

export function useCreateCategory() {
  const workspaceId = useWorkspaceId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { name: string; type: TransactionType; color?: string | null }) =>
      categoriesApi.create(workspaceId, input),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories(workspaceId) })
      toast.success('Category created', { description: category.name })
    },
    onError: (error) => toast.error('Could not create the category', { description: errorMessage(error) }),
  })
}

export function useDeleteCategory() {
  const workspaceId = useWorkspaceId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (categoryId: string) => categoriesApi.remove(workspaceId, categoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceScope(workspaceId) })
      toast.success('Category deleted')
    },
    onError: (error) => toast.error('Could not delete the category', { description: errorMessage(error) }),
  })
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export function useDashboardStats(params: PeriodParams) {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: queryKeys.stats(workspaceId, params.period, params.from, params.to),
    queryFn: () => analyticsApi.stats(workspaceId, params),
    placeholderData: keepPreviousData,
  })
}

export function useTransactionSeries(params: PeriodParams & { bucket?: string }) {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: [...queryKeys.series(workspaceId, params.period, params.from, params.to), params.bucket ?? 'auto'],
    queryFn: () => analyticsApi.series(workspaceId, params),
    placeholderData: keepPreviousData,
  })
}

export function useCategoryBreakdown(params: PeriodParams & { type?: TransactionType }) {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: queryKeys.breakdown(workspaceId, params.period, params.type ?? 'spent', params.from, params.to),
    queryFn: () => analyticsApi.breakdown(workspaceId, params),
    placeholderData: keepPreviousData,
  })
}

export function useRecentTransactions(limit = 8) {
  const workspaceId = useWorkspaceId()
  return useQuery({
    queryKey: queryKeys.recent(workspaceId, limit),
    queryFn: () => analyticsApi.recent(workspaceId, limit),
  })
}
