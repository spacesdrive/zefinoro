import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile, useUpdateProfile } from '@/features/workspaces/hooks'
import { profileFormSchema, type ProfileFormValues } from '@/schemas'
import { initialsOf } from '@/lib/format'

export default function ProfileSettingsPage() {
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { fullName: '', avatarUrl: '', bio: '' },
  })

  // The form is initialised from the server response rather than rendered
  // empty, so a slow network never shows a blank name field.
  useEffect(() => {
    if (!profile) return
    form.reset({
      fullName: profile.fullName ?? '',
      avatarUrl: profile.avatarUrl ?? '',
      bio: profile.bio ?? '',
    })
  }, [profile, form])

  const watchedAvatar = form.watch('avatarUrl')
  const watchedName = form.watch('fullName')

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate({
      fullName: values.fullName,
      avatarUrl: values.avatarUrl?.trim() ? values.avatarUrl.trim() : null,
      bio: values.bio?.trim() ? values.bio.trim() : null,
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-5">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          This is how you appear to other members of your workspaces.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                {watchedAvatar && <AvatarImage src={watchedAvatar} alt="" className="object-cover" />}
                <AvatarFallback className="text-lg">
                  {initialsOf(watchedName, profile?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium">{watchedName || 'Your name'}</p>
                <p className="text-muted-foreground truncate text-sm">{profile?.email}</p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Your full name" autoComplete="name" />
                  </FormControl>
                  <FormDescription>Shown on every transaction you record.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input value={profile?.email ?? ''} readOnly disabled />
              </FormControl>
              <FormDescription>
                Your email is managed by your sign-in method and cannot be changed here.
              </FormDescription>
            </FormItem>

            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Avatar URL <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." inputMode="url" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Bio <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="A short line about you." />
                  </FormControl>
                  <FormDescription>Up to 500 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={updateProfile.isPending || !form.formState.isDirty}>
              {updateProfile.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Update profile
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
