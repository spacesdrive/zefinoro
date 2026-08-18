import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Check, KeyRound, Link2, Loader2, LogOut, Mail, Trash2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/contexts/auth-context'
import { useWorkspace } from '@/contexts/workspace-context'
import { useDeleteWorkspace, useLeaveWorkspace } from '@/features/workspaces/hooks'
import { changePasswordSchema, type ChangePasswordValues } from '@/schemas'
import { formatDate } from '@/lib/format'

export default function AccountSettingsPage() {
  const { user, updatePassword, signOut, linkGoogle, unlinkGoogle } = useAuth()
  const { currentWorkspace, isOwner } = useWorkspace()
  const navigate = useNavigate()

  const deleteWorkspace = useDeleteWorkspace()
  const leaveWorkspace = useLeaveWorkspace()

  const [linkingGoogle, setLinkingGoogle] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  // Supabase records which providers are linked to the account.
  const providers: string[] = (user?.app_metadata?.providers as string[] | undefined) ??
    (user?.app_metadata?.provider ? [user.app_metadata.provider as string] : [])
  const hasGoogle = providers.includes('google')
  const hasPassword = providers.includes('email')

  const onConnectGoogle = async () => {
    setLinkingGoogle(true)
    try {
      // Redirects out to Google; the page unloads, so there is no success path
      // to handle here.
      await linkGoogle()
    } catch (error) {
      setLinkingGoogle(false)
      toast.error('Could not connect Google', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const onDisconnectGoogle = async () => {
    try {
      await unlinkGoogle()
      toast.success('Google disconnected')
      setConfirmUnlink(false)
    } catch (error) {
      toast.error('Could not disconnect Google', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const onChangePassword = async (values: ChangePasswordValues) => {
    try {
      await updatePassword(values.password)
      toast.success('Password updated')
      form.reset()
    } catch (error) {
      toast.error('Could not update your password', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
          <CardDescription>The sign-in methods linked to this account.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
                <Mail className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Email</p>
                <p className="text-muted-foreground truncate text-sm">{user?.email}</p>
              </div>
            </div>
            <Badge variant={hasPassword ? 'secondary' : 'outline'} className="shrink-0 gap-1">
              {hasPassword && <Check className="size-3" aria-hidden="true" />}
              {hasPassword ? 'Connected' : 'Not used'}
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
                <GoogleMark />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Google</p>
                <p className="text-muted-foreground truncate text-sm">
                  {hasGoogle ? user?.email : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={hasGoogle ? 'secondary' : 'outline'} className="gap-1">
                {hasGoogle && <Check className="size-3" aria-hidden="true" />}
                {hasGoogle ? 'Connected' : 'Not connected'}
              </Badge>

              {hasGoogle ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmUnlink(true)}
                  // Removing the only way in would lock the account out.
                  disabled={!hasPassword}
                  title={
                    hasPassword
                      ? 'Disconnect this Google account'
                      : 'Set a password first, so you keep a way to sign in'
                  }
                >
                  <Unlink className="size-4" aria-hidden="true" />
                  Disconnect
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => void onConnectGoogle()} disabled={linkingGoogle}>
                  {linkingGoogle ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Link2 className="size-4" aria-hidden="true" />
                  )}
                  Connect
                </Button>
              )}
            </div>
          </div>

          {!hasGoogle && (
            <p className="text-muted-foreground text-sm">
              Connect Google to sign in with one click. You will keep your email and password too.
            </p>
          )}
          {hasGoogle && !hasPassword && (
            <p className="text-muted-foreground text-sm">
              Google is currently your only way in. Set a password below before disconnecting it.
            </p>
          )}

          <p className="text-muted-foreground text-sm">
            Account created {user?.created_at ? formatDate(user.created_at) : '--'}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            {hasPassword
              ? 'Change the password used to sign in with your email address.'
              : 'Set a password so you can sign in with email as well as Google.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onChangePassword)} className="space-y-4 sm:max-w-sm">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" autoComplete="new-password" />
                    </FormControl>
                    <FormDescription>At least 8 characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" autoComplete="new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                <KeyRound className="size-4" aria-hidden="true" />
                {hasPassword ? 'Change password' : 'Set password'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Sign out of Zefinoro on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </CardContent>
      </Card>

      {currentWorkspace && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Danger zone
            </CardTitle>
            <CardDescription>
              Actions here affect <span className="font-medium">{currentWorkspace.name}</span> and
              cannot be undone.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Leave this workspace</p>
                <p className="text-muted-foreground text-sm">
                  You will lose access until someone invites you back.
                </p>
              </div>
              <Button variant="outline" onClick={() => setConfirmLeave(true)}>
                Leave workspace
              </Button>
            </div>

            {isOwner && (
              <>
                <Separator />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Delete this workspace</p>
                    <p className="text-muted-foreground text-sm">
                      Permanently deletes every transaction, attachment and member.
                    </p>
                  </div>
                  <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete workspace
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to sign in with Google. Your email and password will keep
              working, and your data is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void onDisconnectGoogle()
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {currentWorkspace?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will immediately lose access to its transactions, files and members. Anything you
              created stays in the workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void leaveWorkspace.mutateAsync().then(() => setConfirmLeave(false))
              }}
              disabled={leaveWorkspace.isPending}
            >
              {leaveWorkspace.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Leave workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          setConfirmDelete(next)
          if (!next) setDeleteConfirmText('')
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {currentWorkspace?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Every transaction, attachment, category and membership in this workspace will be
              permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Typing the name is deliberate friction: this is the single most
              destructive action in the product. */}
          <div className="space-y-2">
            <label htmlFor="confirm-workspace-name" className="text-sm font-medium">
              Type <span className="font-mono">{currentWorkspace?.name}</span> to confirm
            </label>
            <Input
              id="confirm-workspace-name"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteWorkspace.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteConfirmText !== currentWorkspace?.name || deleteWorkspace.isPending}
              onClick={(e) => {
                e.preventDefault()
                void deleteWorkspace.mutateAsync().then(() => setConfirmDelete(false))
              }}
            >
              {deleteWorkspace.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
      />
    </svg>
  )
}
