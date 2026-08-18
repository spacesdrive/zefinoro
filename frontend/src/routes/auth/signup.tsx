import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MailCheck } from 'lucide-react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthLayout, GoogleButton, OrSeparator } from '@/components/auth/auth-layout'
import { useAuth } from '@/contexts/auth-context'
import { signupSchema, type SignupValues } from '@/schemas'

export default function SignupPage() {
  const { signUpWithPassword, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = async (values: SignupValues) => {
    setError(null)
    try {
      const { needsEmailConfirmation } = await signUpWithPassword({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
      })

      if (needsEmailConfirmation) {
        setAwaitingConfirmation(values.email)
        return
      }

      // A brand new account has no workspace yet, so onboarding comes first.
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.')
    }
  }

  const onGoogle = async () => {
    setError(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-up.')
      setGoogleLoading(false)
    }
  }

  if (awaitingConfirmation) {
    return (
      <AuthLayout
        title="Check your inbox"
        description="One more step before you can sign in."
        footer={
          <Link to="/login" className="text-foreground font-medium underline underline-offset-4">
            Back to sign in
          </Link>
        }
      >
        <div className="space-y-4 text-center">
          <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
            <MailCheck className="size-6" aria-hidden="true" />
          </div>
          <p className="text-sm text-pretty">
            We sent a confirmation link to{' '}
            <span className="font-medium">{awaitingConfirmation}</span>. Open it to activate your
            account, then sign in.
          </p>
          <Button variant="outline" className="w-full" onClick={() => setAwaitingConfirmation(null)}>
            Use a different email
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create an account"
      description="Start tracking your money in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-foreground font-medium underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Your name" autoComplete="name" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="name@example.com" autoComplete="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
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
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Create account
            </Button>
          </form>
        </Form>

        <OrSeparator />

        <GoogleButton onClick={() => void onGoogle()} disabled={googleLoading} label="Sign up with Google" />
      </div>
    </AuthLayout>
  )
}
