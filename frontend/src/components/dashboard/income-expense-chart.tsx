import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState, ChartSkeleton, ErrorState } from '@/components/common/states'
import { AXIS_STYLE, SERIES_COLORS, SERIES_LABELS } from './chart-theme'
import { formatBucketLabel, formatCurrency, formatCurrencyCompact } from '@/lib/format'
import { TrendingUp } from 'lucide-react'
import type { SeriesPoint } from '@/types'

interface IncomeExpenseChartProps {
  data: SeriesPoint[]
  bucket: 'day' | 'week' | 'month'
  currency: string
  isLoading: boolean
  isError: boolean
  onRetry?: () => void
}

/**
 * Money received against money spent over time.
 *
 * A single shared y-axis - two scales on one chart would let the reader draw
 * comparisons the data does not support. Both series are area-filled at low
 * opacity with a 2px stroke, so overlap stays legible.
 */
export function IncomeExpenseChart({
  data,
  bucket,
  currency,
  isLoading,
  isError,
  onRetry,
}: IncomeExpenseChartProps) {
  const hasValues = useMemo(
    () => data.some((point) => point.received > 0 || point.spent > 0),
    [data]
  )

  if (isLoading) return <ChartSkeleton height={300} />
  if (isError) return <ErrorState onRetry={onRetry} className="py-10" />

  if (!hasValues) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Nothing to chart yet"
        description="Once you record transactions in this period, the comparison will appear here."
        className="py-10"
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="fill-received" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={SERIES_COLORS.received} stopOpacity={0.28} />
            <stop offset="95%" stopColor={SERIES_COLORS.received} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fill-spent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={SERIES_COLORS.spent} stopOpacity={0.28} />
            <stop offset="95%" stopColor={SERIES_COLORS.spent} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />

        <XAxis
          dataKey="date"
          {...AXIS_STYLE}
          tickMargin={8}
          minTickGap={24}
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
          cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '4 4' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const point = payload[0]?.payload as SeriesPoint | undefined
            if (!point) return null

            return (
              <div className="bg-popover text-popover-foreground min-w-44 rounded-lg border p-3 text-sm shadow-md">
                <p className="mb-2 font-medium">{formatBucketLabel(String(label), bucket)}</p>
                <dl className="space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: SERIES_COLORS.received }}
                        aria-hidden="true"
                      />
                      {SERIES_LABELS.received}
                    </dt>
                    <dd className="font-medium tabular-nums">{formatCurrency(point.received, currency)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: SERIES_COLORS.spent }}
                        aria-hidden="true"
                      />
                      {SERIES_LABELS.spent}
                    </dt>
                    <dd className="font-medium tabular-nums">{formatCurrency(point.spent, currency)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t pt-1">
                    <dt className="text-muted-foreground">Net</dt>
                    <dd className="font-medium tabular-nums">{formatCurrency(point.net, currency)}</dd>
                  </div>
                </dl>
              </div>
            )
          }}
        />

        {/* Two series always carry a legend, so identity never rests on colour alone. */}
        <Legend
          verticalAlign="top"
          height={32}
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="text-muted-foreground text-xs">{value}</span>}
        />

        <Area
          type="monotone"
          dataKey="received"
          name={SERIES_LABELS.received}
          stroke={SERIES_COLORS.received}
          strokeWidth={2}
          fill="url(#fill-received)"
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
        <Area
          type="monotone"
          dataKey="spent"
          name={SERIES_LABELS.spent}
          stroke={SERIES_COLORS.spent}
          strokeWidth={2}
          fill="url(#fill-spent)"
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
