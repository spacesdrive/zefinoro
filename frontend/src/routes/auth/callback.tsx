import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FullPageLoader } from '@/components/common/states'
import { AuthLayout } from '@/components/auth/auth-layout'
import { useAuth } from '@/contexts/auth-context'

/**
 * OAuth landing page.
 *
 * The Supabase client parses the redirect fragment and establishes the session
 * on its own; this screen waits for that to finish and then routes onward.
 * Errors handed back by the provider arrive as query parameters and are shown
 * rather than swallowed.
 *
 * Identity linking lands here too, and it needs the wait to be explicit: the
 * user is *already* authenticated when they arrive, so navigating the moment
 * `status` reads "authenticated" would unmount this page while the fragment is
 * still being processed. Instead we wait for supabase-js to clear the hash,
 * then refresh so `app_metadata.providers` reflects the new identity.
 */
export default function AuthCallbackPage() {
  const { status, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [timedOut, setTimedOut] = useState(false)

  const providerError = params.get('error_description') ?? params.get('error')
  const next = params.get('next') ?? '/dashboard'

  useEffect(() => {
    if (providerError) return
    let cancelled = false

    const hasFragment = () => window.location.hash.includes('access_token')

    const finish = async () => {
      // Give supabase-js up to ~5s to consume the fragment it was handed.
      const deadline = Date.now() + 5000
      while (hasFragment() && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100))
      }
      if (cancelled) return

      await refreshUser().catch(() => {
        // A stale refresh token is not fatal here; the existing session stands.
      })
      if (!cancelled) navigate(next, { replace: true })
    }

    if (status === 'authenticated') {
      void finish()
      return () => {
        cancelled = true
      }
    }

    if (status === 'unauthenticated' && !hasFragment()) {
      // The session never materialised - send them back to sign in rather than
      // spinning forever.
      const timer = setTimeout(() => setTimedOut(true), 2500)
      return () => clearTimeout(timer)
    }
  }, [status, navigate, next, providerError, refreshUser])

  if (providerError || timedOut) {
    return (
      <AuthLayout
        title="Sign-in could not be completed"
        description="Something went wrong on the way back from your provider."
      >
        <div className="space-y-4 text-center">
          <div className="bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-full">
            <AlertCircle className="size-6" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground text-sm text-pretty">
            {providerError ?? 'The sign-in session did not complete. Please try again.'}
          </p>
          <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return <FullPageLoader label="Finishing sign-in" />
}
