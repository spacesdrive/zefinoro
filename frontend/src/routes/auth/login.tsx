import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import {
  Form,
  FormControl,
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
import { loginSchema, type LoginValues } from '@/schemas'

export default function LoginPage() {
  const { signInWithPassword, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Return the user to whatever they were trying to reach before the redirect.
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: LoginValues) => {
    setError(null)
    try {
      await signInWithPassword(values.email, values.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in.')
    }
  }

  const onGoogle = async () => {
    setError(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle(from)
      // The browser navigates away to Google; nothing after this runs on success.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in.')
      setGoogleLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to your account to continue."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-foreground font-medium underline underline-offset-4">
            Sign up
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="name@example.com"
                      autoComplete="email"
                      autoFocus
                    />
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
                    <Input {...field} type="password" autoComplete="current-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Sign in
            </Button>
          </form>
        </Form>

        <OrSeparator />

        <GoogleButton onClick={() => void onGoogle()} disabled={googleLoading} />
      </div>
    </AuthLayout>
  )
}
