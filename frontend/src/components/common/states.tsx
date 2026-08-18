import type { LucideIcon } from 'lucide-react'
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * The three states every async surface needs. Keeping them here means an empty
 * transactions table and an empty members table look like the same product.
 */

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-1.5 max-w-sm text-sm text-pretty">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Could not load this',
  description = 'Something went wrong while fetching your data. Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)} role="alert">
      <div className="bg-destructive/10 text-destructive mb-4 flex size-12 items-center justify-center rounded-full">
        <AlertCircle className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-1.5 max-w-sm text-sm text-pretty">{description}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  )
}

export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">{label}...</p>
      </div>
    </div>
  )
}

/** Matches the real KPI card so the layout does not shift when data lands. */
export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  )
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="flex w-full flex-col justify-end gap-2 px-2" style={{ height }} aria-hidden="true">
      <div className="flex h-full items-end gap-2">
        {[45, 70, 35, 85, 55, 92, 40, 65, 75, 50, 80, 60].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  )
}

export function TableSkeleton({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full space-y-3" aria-hidden="true">
      <div className="flex gap-4 border-b pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-1.5">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
