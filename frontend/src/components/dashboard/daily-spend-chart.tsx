import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Wallet } from 'lucide-react'
import { ChartSkeleton, EmptyState, ErrorState } from '@/components/common/states'
import { AXIS_STYLE, SERIES_COLORS } from './chart-theme'
import { formatBucketLabel, formatCurrency, formatCurrencyCompact } from '@/lib/format'
import type { SeriesPoint } from '@/types'

interface DailySpendChartProps {
  data: SeriesPoint[]
  bucket: 'day' | 'week' | 'month'
  currency: string
  isLoading: boolean
  isError: boolean
  onRetry?: () => void
}

/**
 * Money spent per bucket.
 *
 * One series, so no legend - the card title names it. Bars carry 4px rounded
 * tops anchored to the baseline and a small category gap, which reads as
 * discrete quantities rather than a continuous band.
 */
export function DailySpendChart({
  data,
  bucket,
  currency,
  isLoading,
  isError,
  onRetry,
}: DailySpendChartProps) {
  const hasValues = useMemo(() => data.some((point) => point.spent > 0), [data])

  if (isLoading) return <ChartSkeleton height={260} />
  if (isError) return <ErrorState onRetry={onRetry} className="py-10" />

  if (!hasValues) {
    return (
      <EmptyState
        icon={Wallet}
        title="No spending recorded"
        description="Spending in this period will show up here as soon as you add it."
        className="py-10"
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />

        <XAxis
          dataKey="date"
          {...AXIS_STYLE}
          tickMargin={8}
          minTickGap={20}
          className="fill-muted-foreground"
          tickFormatter={(value: string) => formatBucketLabel(value, bucket)}
        />
        <YAxis
          {...AXIS_STYLE}
          width={64}
          className="fill-muted-foreground"
          tickFormatter={(value: number) => formatCurrencyCompact(value, currency)}
        />

        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const point = payload[0]?.payload as SeriesPoint | undefined
            if (!point) return null

            return (
              <div className="bg-popover text-popover-foreground rounded-lg border p-3 text-sm shadow-md">
                <p className="mb-1 font-medium">{formatBucketLabel(String(label), bucket)}</p>
                <p className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: SERIES_COLORS.spent }}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">Spent</span>
                  <span className="ml-auto font-medium tabular-nums">
                    {formatCurrency(point.spent, currency)}
                  </span>
                </p>
              </div>
            )
          }}
        />

        <Bar dataKey="spent" name="Spent" fill={SERIES_COLORS.spent} radius={[4, 4, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  )
}
