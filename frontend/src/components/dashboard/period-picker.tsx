import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PERIOD_OPTIONS, type PeriodValue } from '@/config'
import { formatDate, toDateInputValue } from '@/lib/format'

export interface PeriodState {
  period: PeriodValue
  from?: string
  to?: string
}

interface PeriodPickerProps {
  value: PeriodState
  onChange: (next: PeriodState) => void
}

/**
 * Period selector for the dashboard.
 *
 * The presets are resolved server-side - the client sends `period=this_month`,
 * not a pair of dates it computed itself - so "this month" means the same
 * thing regardless of the browser's clock. Only a custom range sends explicit
 * bounds.
 */
export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const [open, setOpen] = useState(false)
  const today = toDateInputValue(new Date())
  const [draft, setDraft] = useState({ from: value.from ?? '', to: value.to ?? today })

  const applyCustom = () => {
    if (!draft.from || !draft.to) return
    const [from, to] = draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from]
    onChange({ period: 'custom', from, to })
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value.period}
        onValueChange={(next) => {
          const period = next as PeriodValue
          if (period === 'custom') {
            setOpen(true)
            return
          }
          onChange({ period })
        }}
      >
        <SelectTrigger className="w-[170px]" aria-label="Select period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Choose a custom date range">
            <CalendarDays className="size-4" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="space-y-3">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Custom range</h4>
              {value.period === 'custom' && value.from && value.to && (
                <p className="text-muted-foreground text-xs">
                  Showing {formatDate(value.from)} to {formatDate(value.to)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="range-from" className="text-xs">
                  From
                </Label>
                <Input
                  id="range-from"
                  type="date"
                  max={today}
                  value={draft.from}
                  onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="range-to" className="text-xs">
                  To
                </Label>
                <Input
                  id="range-to"
                  type="date"
                  max={today}
                  value={draft.to}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                />
              </div>
            </div>

            <Button className="w-full" size="sm" onClick={applyCustom} disabled={!draft.from || !draft.to}>
              Apply range
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
