import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTheme, type Theme } from '@/contexts/theme-context'
import { useWorkspace } from '@/contexts/workspace-context'
import { useUpdateWorkspaceSettings, useWorkspaceSettings } from '@/features/workspaces/hooks'
import { CURRENCIES } from '@/config'
import { cn } from '@/lib/utils'

const THEMES: { value: Theme; label: string; description: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', description: 'Always use the light palette.', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Always use the dark palette.', icon: Moon },
  { value: 'system', label: 'System', description: 'Follow your device setting.', icon: Monitor },
]

export default function AppearanceSettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { canManage } = useWorkspace()
  const { data: settings } = useWorkspaceSettings()
  const updateSettings = useUpdateWorkspaceSettings()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Choose how Zefinoro looks. This preference is stored on this device.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as Theme)}
            className="grid gap-3 sm:grid-cols-3"
          >
            {THEMES.map((option) => {
              const active = theme === option.value

              return (
                <Label
                  key={option.value}
                  htmlFor={`theme-${option.value}`}
                  className={cn(
                    'relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors',
                    'hover:bg-accent/50',
                    active && 'border-primary bg-accent/40'
                  )}
                >
                  <RadioGroupItem value={option.value} id={`theme-${option.value}`} className="sr-only" />

                  <div className="flex items-center justify-between">
                    <option.icon className="size-5" aria-hidden="true" />
                    {active && <Check className="text-primary size-4" aria-hidden="true" />}
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-muted-foreground text-xs font-normal">{option.description}</p>
                  </div>
                </Label>
              )
            })}
          </RadioGroup>

          <p className="text-muted-foreground mt-4 text-sm">
            Currently showing the <span className="text-foreground font-medium">{resolvedTheme}</span>{' '}
            palette.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace preferences</CardTitle>
          <CardDescription>
            Defaults applied to everyone working in this workspace.
            {!canManage && ' Only owners and admins can change these.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="default-currency">Default currency</Label>
            <Select
              value={settings?.defaultCurrency ?? 'INR'}
              disabled={!canManage || updateSettings.isPending}
              onValueChange={(value) => updateSettings.mutate({ defaultCurrency: value })}
            >
              <SelectTrigger id="default-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.code} - {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">
              Pre-selected when adding a transaction. Existing records keep the currency they were
              recorded in.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
