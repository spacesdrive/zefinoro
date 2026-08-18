import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Paperclip, Receipt } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states'
import { displayName, formatCurrency, formatDate, initialsOf } from '@/lib/format'
import type { Transaction } from '@/types'
import { cn } from '@/lib/utils'

interface RecentBillsProps {
  transactions: Transaction[]
  isLoading: boolean
  isError: boolean
  onSelect: (transaction: Transaction) => void
  onAdd: () => void
  onRetry?: () => void
}

export function RecentBills({
  transactions,
  isLoading,
  isError,
  onSelect,
  onAdd,
  onRetry,
}: RecentBillsProps) {
  if (isLoading) return <ListSkeleton rows={6} />
  if (isError) return <ErrorState onRetry={onRetry} className="py-8" />

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No transactions yet"
        description="Start tracking your finances by adding your first transaction."
        action={<Button onClick={onAdd}>Add transaction</Button>}
        className="py-8"
      />
    )
  }

  return (
    <div className="space-y-1">
      {transactions.map((transaction) => {
        const isReceived = transaction.type === 'received'

        return (
          <button
            key={transaction.id}
            type="button"
            onClick={() => onSelect(transaction)}
            className="hover:bg-accent/50 focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
          >
            <Avatar className="size-9 shrink-0">
              {transaction.createdBy.avatarUrl && (
                <AvatarImage src={transaction.createdBy.avatarUrl} alt="" />
              )}
              <AvatarFallback className="text-xs">
                {initialsOf(transaction.createdBy.fullName, transaction.createdBy.email)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium">{transaction.title}</p>
                {transaction.attachmentCount > 0 && (
                  <Paperclip
                    className="text-muted-foreground size-3 shrink-0"
                    aria-label={`${transaction.attachmentCount} attachment(s)`}
                  />
                )}
              </div>
              <p className="text-muted-foreground truncate text-xs">
                {displayName(transaction.createdBy)} · {formatDate(transaction.transactionDate)}
                {transaction.category && ` · ${transaction.category.name}`}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className="hidden gap-1 text-[10px] capitalize sm:inline-flex">
                {isReceived ? (
                  <ArrowDownLeft className="size-3" aria-hidden="true" />
                ) : (
                  <ArrowUpRight className="size-3" aria-hidden="true" />
                )}
                {transaction.type}
              </Badge>

              <span
                className={cn(
                  'text-sm font-medium tabular-nums-amount',
                  isReceived ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                )}
              >
                {isReceived ? '+' : '-'}
                {formatCurrency(transaction.amount, transaction.currency)}
              </span>
            </div>
          </button>
        )
      })}

      <div className="pt-2">
        <Button variant="ghost" size="sm" className="w-full" asChild>
          <Link to="/billing">View all transactions</Link>
        </Button>
      </div>
    </div>
  )
}
