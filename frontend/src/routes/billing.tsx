import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Search, X } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/common/page-header'
import { TransactionsTable } from '@/components/billing/transactions-table'
import { TransactionDialog } from '@/components/billing/transaction-dialog'
import { TransactionDetailSheet } from '@/components/billing/transaction-detail-sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useCategories,
  useDeleteTransaction,
  useTransactions,
} from '@/features/transactions/hooks'
import { useDebounced } from '@/hooks/use-debounced'
import { useWorkspace } from '@/contexts/workspace-context'
import { useAuth } from '@/contexts/auth-context'
import type { Transaction, TransactionFilters, TransactionType } from '@/types'

type TabValue = 'all' | 'received' | 'spent'

const TAB_ROUTES: Record<TabValue, string> = {
  all: '/billing',
  received: '/billing/received',
  spent: '/billing/spent',
}

/**
 * Billing.
 *
 * The three tabs are real routes rather than local state, so a link to
 * /billing/spent opens on the right tab and the back button behaves.
 */
export default function BillingPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { canManage } = useWorkspace()
  const { user } = useAuth()

  const tab: TabValue = pathname.endsWith('/received')
    ? 'received'
    : pathname.endsWith('/spent')
      ? 'spent'
      : 'all'

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 350)

  const [categoryId, setCategoryId] = useState<string>('all')
  const [attachmentFilter, setAttachmentFilter] = useState<'all' | 'with' | 'without'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sortBy, setSortBy] = useState<TransactionFilters['sortBy']>('transaction_date')
  const [sortDir, setSortDir] = useState<TransactionFilters['sortDir']>('desc')

  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null)

  const typeFilter: TransactionType | undefined = tab === 'all' ? undefined : tab
  const { data: categories = [] } = useCategories(typeFilter)
  const deleteTransaction = useDeleteTransaction()

  // Any change to what is being filtered invalidates the current page number.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, categoryId, attachmentFilter, tab])

  // A category from the previous tab cannot apply to this one.
  useEffect(() => {
    setCategoryId('all')
  }, [tab])

  const filters = useMemo<TransactionFilters>(
    () => ({
      type: typeFilter,
      search: debouncedSearch || undefined,
      categoryId: categoryId === 'all' ? undefined : categoryId,
      hasAttachment:
        attachmentFilter === 'all' ? undefined : attachmentFilter === 'with' ? true : false,
      page,
      pageSize,
      sortBy,
      sortDir,
    }),
    [typeFilter, debouncedSearch, categoryId, attachmentFilter, page, pageSize, sortBy, sortDir]
  )

  const query = useTransactions(filters)

  const hasActiveFilters =
    Boolean(search) || categoryId !== 'all' || attachmentFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setCategoryId('all')
    setAttachmentFilter('all')
  }

  const canModify = (transaction: Transaction) =>
    canManage || transaction.createdBy.id === user?.id

  const copy = {
    all: {
      title: 'Billing',
      description: 'Every transaction recorded in this workspace.',
      emptyTitle: 'No transactions yet',
      emptyDescription: 'Start tracking your finances by adding your first transaction.',
    },
    received: {
      title: 'Received',
      description: 'Money that has come into this workspace.',
      emptyTitle: 'No money received yet',
      emptyDescription: 'Record income, invoices paid, or anything else that came in.',
    },
    spent: {
      title: 'Spent',
      description: 'Money that has gone out of this workspace.',
      emptyTitle: 'No spending recorded yet',
      emptyDescription: 'Record bills, purchases, or anything else that went out.',
    },
  }[tab]

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={copy.title}
          description={copy.description}
          actions={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Add transaction</span>
              <span className="sm:hidden">Add</span>
            </Button>
          }
        />

        <Tabs value={tab} onValueChange={(value) => navigate(TAB_ROUTES[value as TabValue])}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="received">Received</TabsTrigger>
            <TabsTrigger value="spent">Spent</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or description..."
              className="pl-8"
              aria-label="Search transactions"
            />
          </div>

          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[170px]" aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={attachmentFilter}
            onValueChange={(value) => setAttachmentFilter(value as typeof attachmentFilter)}
          >
            <SelectTrigger className="w-[160px]" aria-label="Filter by attachment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any attachment</SelectItem>
              <SelectItem value="with">With files</SelectItem>
              <SelectItem value="without">Without files</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>

        <TransactionsTable
          transactions={query.data?.items ?? []}
          meta={query.data?.meta}
          filters={filters}
          onFiltersChange={(next) => {
            if (next.page !== undefined) setPage(next.page)
            if (next.pageSize !== undefined) setPageSize(next.pageSize)
            if (next.sortBy !== undefined) setSortBy(next.sortBy)
            if (next.sortDir !== undefined) setSortDir(next.sortDir)
          }}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onSelect={setSelected}
          onEdit={setEditing}
          onDelete={setPendingDelete}
          onAdd={() => setAddOpen(true)}
          canModify={canModify}
          emptyTitle={hasActiveFilters ? 'No matching transactions' : copy.emptyTitle}
          emptyDescription={
            hasActiveFilters
              ? 'Try adjusting or clearing your filters to see more results.'
              : copy.emptyDescription
          }
        />
      </div>

      <TransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultType={tab === 'received' ? 'received' : 'spent'}
      />

      <TransactionDetailSheet
        transaction={selected}
        open={Boolean(selected)}
        onOpenChange={(next) => !next && setSelected(null)}
        onEdit={(transaction) => {
          setSelected(null)
          setEditing(transaction)
        }}
      />

      <TransactionDialog
        open={Boolean(editing)}
        onOpenChange={(next) => !next && setEditing(null)}
        transaction={editing}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{pendingDelete?.title}</span> will be permanently deleted
              along with any attached files, and your workspace totals will be recalculated. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) void deleteTransaction.mutateAsync(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
