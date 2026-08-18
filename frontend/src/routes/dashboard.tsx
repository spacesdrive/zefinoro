import { useState } from 'react'
import { Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { StatCardSkeleton } from '@/components/common/states'
import { StatCard } from '@/components/dashboard/stat-card'
import { PeriodPicker, type PeriodState } from '@/components/dashboard/period-picker'
import { IncomeExpenseChart } from '@/components/dashboard/income-expense-chart'
import { DailySpendChart } from '@/components/dashboard/daily-spend-chart'
import { RecentBills } from '@/components/dashboard/recent-bills'
import { TransactionDialog } from '@/components/billing/transaction-dialog'
import { TransactionDetailSheet } from '@/components/billing/transaction-detail-sheet'
import {
  useDashboardStats,
  useRecentTransactions,
  useTransactionSeries,
} from '@/features/transactions/hooks'
import { useWorkspaceSettings } from '@/features/workspaces/hooks'
import { formatDate } from '@/lib/format'
import type { Transaction } from '@/types'

const COMPARISON_LABEL: Record<string, string> = {
  today: 'vs yesterday',
  '7d': 'vs previous 7 days',
  '30d': 'vs previous 30 days',
  '90d': 'vs previous 90 days',
  '12m': 'vs previous 12 months',
  this_month: 'vs last month',
  last_month: 'vs the month before',
  this_year: 'vs last year',
  custom: 'vs the preceding period',
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodState>({ period: '30d' })
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const { data: settings } = useWorkspaceSettings()
  const currency = settings?.defaultCurrency ?? 'INR'

  const statsQuery = useDashboardStats(period)
  const seriesQuery = useTransactionSeries(period)
  const recentQuery = useRecentTransactions(8)

  const stats = statsQuery.data
  const comparison = COMPARISON_LABEL[period.period] ?? 'vs the preceding period'

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description={
            stats
              ? `${formatDate(stats.period.from)} - ${formatDate(stats.period.to)}`
              : 'An overview of money in, money out, and what is left.'
          }
          actions={
            <>
              <PeriodPicker value={period} onChange={setPeriod} />
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Add transaction</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </>
          }
        />

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statsQuery.isLoading || !stats ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                title="Total Received"
                amount={stats.received}
                currency={currency}
                icon={TrendingUp}
                change={stats.change.received}
                comparisonLabel={comparison}
                higherIsBetter
              />
              <StatCard
                title="Total Spent"
                amount={stats.spent}
                currency={currency}
                icon={TrendingDown}
                change={stats.change.spent}
                comparisonLabel={comparison}
                higherIsBetter={false}
              />
              <StatCard
                title="Money Left"
                amount={stats.balance}
                currency={currency}
                icon={Wallet}
                change={stats.change.balance}
                comparisonLabel={comparison}
                higherIsBetter
                footnote={
                  stats.receivedCount + stats.spentCount === 1
                    ? '1 transaction in this period'
                    : `${stats.receivedCount + stats.spentCount} transactions in this period`
                }
              />
            </>
          )}
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-7">
          <Card className="min-w-0 lg:col-span-4">
            <CardHeader>
              <CardTitle>Money Received vs Money Spent</CardTitle>
              <CardDescription>
                How much came in against how much went out over the selected period.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 pl-2">
              <IncomeExpenseChart
                data={seriesQuery.data?.points ?? []}
                bucket={seriesQuery.data?.bucket ?? 'day'}
                currency={currency}
                isLoading={seriesQuery.isLoading}
                isError={seriesQuery.isError}
                onRetry={() => void seriesQuery.refetch()}
              />
            </CardContent>
          </Card>

          <Card className="min-w-0 lg:col-span-3">
            <CardHeader>
              <CardTitle>Recent Bills</CardTitle>
              <CardDescription>The latest transactions recorded in this workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <RecentBills
                transactions={recentQuery.data ?? []}
                isLoading={recentQuery.isLoading}
                isError={recentQuery.isError}
                onSelect={setSelected}
                onAdd={() => setAddOpen(true)}
                onRetry={() => void recentQuery.refetch()}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Money Spent Daily</CardTitle>
            <CardDescription>
              Spending per {seriesQuery.data?.bucket ?? 'day'}, so recurring outflows stand out.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 pl-2">
            <DailySpendChart
              data={seriesQuery.data?.points ?? []}
              bucket={seriesQuery.data?.bucket ?? 'day'}
              currency={currency}
              isLoading={seriesQuery.isLoading}
              isError={seriesQuery.isError}
              onRetry={() => void seriesQuery.refetch()}
            />
          </CardContent>
        </Card>
      </div>

      <TransactionDialog open={addOpen} onOpenChange={setAddOpen} />

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
    </>
  )
}
