import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Receipt,
  Trash2,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states'
import { displayName, formatCurrency, formatDate, initialsOf } from '@/lib/format'
import type { PageMeta, Transaction, TransactionFilters } from '@/types'
import { cn } from '@/lib/utils'

type ColumnId = 'title' | 'type' | 'amount' | 'category' | 'date' | 'createdBy' | 'attachment'

const COLUMNS: { id: ColumnId; label: string; sortKey?: TransactionFilters['sortBy'] }[] = [
  { id: 'title', label: 'Title', sortKey: 'title' },
  { id: 'type', label: 'Type', sortKey: 'type' },
  { id: 'amount', label: 'Amount', sortKey: 'amount' },
  { id: 'category', label: 'Category' },
  { id: 'date', label: 'Date', sortKey: 'transaction_date' },
  { id: 'createdBy', label: 'Created By' },
  { id: 'attachment', label: 'Files' },
]

interface TransactionsTableProps {
  transactions: Transaction[]
  meta?: PageMeta
  filters: TransactionFilters
  onFiltersChange: (next: TransactionFilters) => void
  isLoading: boolean
  isError: boolean
  onRetry?: () => void
  onSelect: (transaction: Transaction) => void
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
  onAdd: () => void
  canModify: (transaction: Transaction) => boolean
  emptyTitle?: string
  emptyDescription?: string
}

/**
 * The billing ledger.
 *
 * Sorting and pagination are server-driven - the table renders one page at a
 * time rather than sorting a partial set client-side, which would silently
 * reorder only the rows that happened to be loaded.
 */
export function TransactionsTable({
  transactions,
  meta,
  filters,
  onFiltersChange,
  isLoading,
  isError,
  onRetry,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
  canModify,
  emptyTitle = 'No transactions yet',
  emptyDescription = 'Start tracking your finances by adding your first transaction.',
}: TransactionsTableProps) {
  const [hidden, setHidden] = useState<Set<ColumnId>>(new Set())
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const visibleColumns = useMemo(() => COLUMNS.filter((c) => !hidden.has(c.id)), [hidden])

  const toggleSort = (sortKey: TransactionFilters['sortBy']) => {
    if (!sortKey) return
    const sameColumn = filters.sortBy === sortKey
    onFiltersChange({
      ...filters,
      sortBy: sortKey,
      sortDir: sameColumn && filters.sortDir === 'desc' ? 'asc' : 'desc',
      page: 1,
    })
  }

  const page = meta?.page ?? filters.page ?? 1
  const totalPages = meta?.totalPages ?? 1
  const allSelected = transactions.length > 0 && selectedRows.size === transactions.length

  if (isLoading) {
    return (
      <div className="rounded-lg border p-4">
        <TableSkeleton rows={8} columns={visibleColumns.length + 1} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border">
        <ErrorState
          title="Could not load transactions"
          description="Something went wrong while fetching this workspace's ledger."
          onRetry={onRetry}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {selectedRows.size > 0
            ? `${selectedRows.size} of ${transactions.length} row(s) selected`
            : meta
              ? `${meta.total} transaction${meta.total === 1 ? '' : 's'}`
              : null}
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNS.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={!hidden.has(column.id)}
                onCheckedChange={(checked) =>
                  setHidden((prev) => {
                    const next = new Set(prev)
                    if (checked) next.delete(column.id)
                    else next.add(column.id)
                    return next
                  })
                }
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-lg border">
          <EmptyState
            icon={Receipt}
            title={emptyTitle}
            description={emptyDescription}
            action={<Button onClick={onAdd}>Add transaction</Button>}
          />
        </div>
      ) : (
        <>
          {/* The wrapper scrolls rather than the page, so narrow screens never
              produce a horizontally-scrolling document. */}
          <div className="w-full overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) =>
                        setSelectedRows(checked ? new Set(transactions.map((t) => t.id)) : new Set())
                      }
                      aria-label="Select all rows on this page"
                    />
                  </TableHead>

                  {visibleColumns.map((column) => (
                    <TableHead
                      key={column.id}
                      className={cn(column.id === 'amount' && 'text-right')}
                      aria-sort={
                        filters.sortBy === column.sortKey
                          ? filters.sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      {column.sortKey ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn('-ml-3 h-8', column.id === 'amount' && '-mr-3 ml-auto')}
                          onClick={() => toggleSort(column.sortKey)}
                        >
                          {column.label}
                          <ArrowUpDown className="size-3.5 opacity-50" aria-hidden="true" />
                        </Button>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  ))}

                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {transactions.map((transaction) => {
                  const isReceived = transaction.type === 'received'
                  const modifiable = canModify(transaction)

                  return (
                    <TableRow
                      key={transaction.id}
                      data-state={selectedRows.has(transaction.id) ? 'selected' : undefined}
                      className="cursor-pointer"
                      onClick={() => onSelect(transaction)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedRows.has(transaction.id)}
                          onCheckedChange={(checked) =>
                            setSelectedRows((prev) => {
                              const next = new Set(prev)
                              if (checked) next.add(transaction.id)
                              else next.delete(transaction.id)
                              return next
                            })
                          }
                          aria-label={`Select ${transaction.title}`}
                        />
                      </TableCell>

                      {visibleColumns.map((column) => {
                        switch (column.id) {
                          case 'title':
                            return (
                              <TableCell key={column.id} className="max-w-[240px] font-medium">
                                <span className="block truncate">{transaction.title}</span>
                              </TableCell>
                            )
                          case 'type':
                            return (
                              <TableCell key={column.id}>
                                <Badge variant="outline" className="gap-1 capitalize">
                                  {isReceived ? (
                                    <ArrowDownLeft className="size-3" aria-hidden="true" />
                                  ) : (
                                    <ArrowUpRight className="size-3" aria-hidden="true" />
                                  )}
                                  {transaction.type}
                                </Badge>
                              </TableCell>
                            )
                          case 'amount':
                            return (
                              <TableCell
                                key={column.id}
                                className={cn(
                                  'text-right font-medium tabular-nums-amount',
                                  isReceived && 'text-emerald-600 dark:text-emerald-400'
                                )}
                              >
                                {isReceived ? '+' : '-'}
                                {formatCurrency(transaction.amount, transaction.currency)}
                              </TableCell>
                            )
                          case 'category':
                            return (
                              <TableCell key={column.id}>
                                {transaction.category ? (
                                  <span className="inline-flex items-center gap-1.5 text-sm">
                                    {transaction.category.color && (
                                      <span
                                        className="size-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: transaction.category.color }}
                                        aria-hidden="true"
                                      />
                                    )}
                                    {transaction.category.name}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">--</span>
                                )}
                              </TableCell>
                            )
                          case 'date':
                            return (
                              <TableCell key={column.id} className="text-muted-foreground text-sm whitespace-nowrap">
                                {formatDate(transaction.transactionDate)}
                              </TableCell>
                            )
                          case 'createdBy':
                            return (
                              <TableCell key={column.id}>
                                <span className="flex items-center gap-2 text-sm">
                                  <Avatar className="size-6">
                                    {transaction.createdBy.avatarUrl && (
                                      <AvatarImage src={transaction.createdBy.avatarUrl} alt="" />
                                    )}
                                    <AvatarFallback className="text-[9px]">
                                      {initialsOf(
                                        transaction.createdBy.fullName,
                                        transaction.createdBy.email
                                      )}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="max-w-[120px] truncate">
                                    {displayName(transaction.createdBy)}
                                  </span>
                                </span>
                              </TableCell>
                            )
                          case 'attachment':
                            return (
                              <TableCell key={column.id}>
                                {transaction.attachmentCount > 0 ? (
                                  <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
                                    <Paperclip className="size-3.5" aria-hidden="true" />
                                    {transaction.attachmentCount}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">--</span>
                                )}
                              </TableCell>
                            )
                          default:
                            return null
                        }
                      })}

                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Actions for ${transaction.title}`}
                            >
                              <MoreHorizontal className="size-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => onSelect(transaction)}>
                              View details
                            </DropdownMenuItem>
                            {modifiable && (
                              <>
                                <DropdownMenuItem onSelect={() => onEdit(transaction)}>
                                  <Pencil aria-hidden="true" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => onDelete(transaction)}
                                >
                                  <Trash2 aria-hidden="true" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Rows per page</span>
              <Select
                value={String(filters.pageSize ?? 20)}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, pageSize: Number(value), page: 1 })
                }
              >
                <SelectTrigger className="h-8 w-[72px]" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm" aria-live="polite">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page <= 1}
                  onClick={() => onFiltersChange({ ...filters, page: page - 1 })}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page >= totalPages}
                  onClick={() => onFiltersChange({ ...filters, page: page + 1 })}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
