import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  amount: number
  currency: string
  icon: LucideIcon
  change: number | null
  comparisonLabel: string
  /**
   * For spending, a rise is bad news - so the delta's colour has to be
   * interpreted per metric rather than "up is green".
   */
  higherIsBetter?: boolean
  footnote?: string
}

export function StatCard({
  title,
  amount,
  currency,
  icon: Icon,
  change,
  comparisonLabel,
  higherIsBetter = true,
  footnote,
}: StatCardProps) {
  const hasChange = change !== null && Number.isFinite(change)
  const rising = hasChange && change > 0
  const flat = hasChange && change === 0

  const positiveOutcome = higherIsBetter ? rising : !rising

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground size-4" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums-amount">{formatCurrency(amount, currency)}</div>

        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1 text-xs">
          {hasChange && !flat ? (
            <>
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium',
                  positiveOutcome ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                )}
              >
                {/* An arrow plus a signed number, so the trend never depends on
                    colour alone. */}
                {rising ? (
                  <TrendingUp className="size-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-3" aria-hidden="true" />
                )}
                {formatPercent(change)}
              </span>
              <span>{comparisonLabel}</span>
            </>
          ) : (
            <span>{footnote ?? (flat ? `No change ${comparisonLabel}` : 'No prior period to compare')}</span>
          )}
        </p>
      </CardContent>
    </Card>
  )
}
