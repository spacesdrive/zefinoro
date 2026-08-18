import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Building2, Check, Loader2, UserPlus, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useCreateWorkspace, useInvitePreview, useJoinWorkspace } from '@/features/workspaces/hooks'
import { useWorkspace } from '@/contexts/workspace-context'
import {
  createWorkspaceFormSchema,
  joinWorkspaceFormSchema,
  type CreateWorkspaceValues,
  type JoinWorkspaceValues,
} from '@/schemas'
import { CURRENCIES } from '@/config'
import { initialsOf } from '@/lib/format'
import { cn } from '@/lib/utils'

type Mode = 'choose' | 'create' | 'join'

const INVITE_REASONS: Record<string, string> = {
  INVITE_INVALID: 'That code is not valid. Check it and try again.',
  INVITE_EXPIRED: 'That invite has expired. Ask for a new one.',
  INVITE_REVOKED: 'That invite has been revoked.',
  INVITE_EXHAUSTED: 'That invite has already been used.',
  ALREADY_MEMBER: 'You are already a member of this workspace.',
}

/**
 * Workspace onboarding.
 *
 * Reached after signup, and from the workspace switcher. A user with no
 * workspace cannot use the rest of the product, so this is the one authenticated
 * screen that renders outside the app shell.
 */
export default function OnboardingPage() {
  const [params] = useSearchParams()
  const { workspaces, isLoading } = useWorkspace()
  const navigate = useNavigate()

  const requested = params.get('mode')
  const [mode, setMode] = useState<Mode>(
    requested === 'create' || requested === 'join' ? requested : 'choose'
  )

  const hasWorkspaces = workspaces.length > 0

  return (
    <div className="bg-muted/40 flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
            <Wallet className="size-5" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === 'choose' ? 'Welcome to Zefinoro' : mode === 'create' ? 'Create a workspace' : 'Join a workspace'}
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            {mode === 'choose'
              ? "Let's get your workspace ready."
              : mode === 'create'
                ? 'A workspace holds your transactions, files and teammates.'
                : 'Enter the invite code someone shared with you.'}
          </p>
        </div>

        {mode === 'choose' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              icon={Building2}
              title="Create a workspace"
              description="Start fresh and invite people later."
              onClick={() => setMode('create')}
            />
            <ChoiceCard
              icon={UserPlus}
              title="Join a workspace"
              description="Use an invite code from a teammate."
              onClick={() => setMode('join')}
            />
          </div>
        )}

        {mode === 'create' && <CreateWorkspaceForm onBack={() => setMode('choose')} />}
        {mode === 'join' && <JoinWorkspaceForm onBack={() => setMode('choose')} />}

        {hasWorkspaces && !isLoading && (
          <p className="text-muted-foreground text-center text-sm">
            Already set up?{' '}
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-foreground font-medium underline underline-offset-4"
            >
              Go to your dashboard
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

function ChoiceCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Building2
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card hover:bg-accent/50 focus-visible:ring-ring/50 flex flex-col items-start gap-2 rounded-xl border p-5 text-left shadow-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <div className="bg-muted flex size-9 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-sm text-pretty">{description}</p>
      </div>
    </button>
  )
}

function CreateWorkspaceForm({ onBack }: { onBack: () => void }) {
  const createWorkspace = useCreateWorkspace()

  const form = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceFormSchema),
    defaultValues: { name: '', description: '', avatarUrl: '', currency: 'INR' },
  })

  const watchedName = form.watch('name')
  const watchedAvatar = form.watch('avatarUrl')

  const onSubmit = (values: CreateWorkspaceValues) => {
    createWorkspace.mutate({
      name: values.name,
      description: values.description?.trim() ? values.description.trim() : null,
      avatarUrl: values.avatarUrl?.trim() ? values.avatarUrl.trim() : null,
      currency: values.currency,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace details</CardTitle>
        <CardDescription>You will be its owner, and can invite others afterwards.</CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-12 rounded-lg">
                {watchedAvatar && <AvatarImage src={watchedAvatar} alt="" className="object-cover" />}
                <AvatarFallback className="rounded-lg">
                  {watchedName ? initialsOf(watchedName) : <Building2 className="size-5" aria-hidden="true" />}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{watchedName || 'Your workspace'}</p>
                <p className="text-muted-foreground text-xs">Owner</p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Personal finances" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="What is this workspace for?" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default currency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.symbol} {currency.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="avatarUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Logo URL <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://..." inputMode="url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormDescription>
              Default categories for income and spending are created for you.
            </FormDescription>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onBack} disabled={createWorkspace.isPending}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={createWorkspace.isPending}>
                {createWorkspace.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                Create workspace
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function JoinWorkspaceForm({ onBack }: { onBack: () => void }) {
  const [params] = useSearchParams()
  const joinWorkspace = useJoinWorkspace()

  const form = useForm<JoinWorkspaceValues>({
    resolver: zodResolver(joinWorkspaceFormSchema),
    defaultValues: { inviteCode: params.get('code') ?? '' },
  })

  const code = form.watch('inviteCode')
  const normalized = code.replace(/-/g, '').toUpperCase()
  const preview = useInvitePreview(normalized)

  // Format as the user types: NX7K42PM becomes NX7K-42PM.
  useEffect(() => {
    const raw = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const formatted = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4, 8)}` : raw
    if (formatted !== code) form.setValue('inviteCode', formatted)
  }, [code, form])

  const onSubmit = (values: JoinWorkspaceValues) => {
    joinWorkspace.mutate(values.inviteCode)
  }

  const previewData = preview.data
  const invalidReason =
    previewData && !previewData.valid ? INVITE_REASONS[previewData.reason ?? ''] ?? 'That code cannot be used.' : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite code</CardTitle>
        <CardDescription>Codes look like NX7K-42PM and are 8 characters long.</CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="inviteCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="NX7K-42PM"
                      autoComplete="off"
                      autoCapitalize="characters"
                      maxLength={9}
                      className="font-mono text-lg tracking-widest"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Validate before committing, so a bad code is caught without a
                failed join attempt. */}
            {preview.isFetching && (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Checking code...
              </p>
            )}

            {previewData?.valid && previewData.workspace && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
                <Avatar className="size-9 rounded-lg">
                  {previewData.workspace.avatarUrl && (
                    <AvatarImage src={previewData.workspace.avatarUrl} alt="" />
                  )}
                  <AvatarFallback className="rounded-lg text-xs">
                    {initialsOf(previewData.workspace.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{previewData.workspace.name}</p>
                  <p className="text-muted-foreground text-xs capitalize">
                    You will join as {previewData.role}
                  </p>
                </div>
                <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </div>
            )}

            {invalidReason && (
              <Alert variant="destructive">
                <AlertDescription>{invalidReason}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onBack} disabled={joinWorkspace.isPending}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </Button>
              <Button
                type="submit"
                className={cn('flex-1')}
                disabled={joinWorkspace.isPending || previewData?.valid === false}
              >
                {joinWorkspace.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Join workspace
              </Button>
            </div>
          </form>
        </Form>

        <p className="text-muted-foreground mt-4 text-center text-sm">
          Do not have a code?{' '}
          <Link to="/onboarding?mode=create" className="text-foreground font-medium underline underline-offset-4">
            Create your own workspace
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
