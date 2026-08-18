import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

/**
 * Authentication state machine.
 *
 *   loading -> (session found)    -> authenticated
 *           -> (no session)       -> unauthenticated
 *
 * `loading` exists so protected routes can wait rather than bouncing a signed-in
 * user to /login during the moment before the persisted session is restored --
 * the single most common cause of "it logged me out on refresh".
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  user: User | null
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (params: { email: string; password: string; fullName: string }) => Promise<{ needsEmailConfirmation: boolean }>
  signInWithGoogle: (redirectPath?: string) => Promise<void>
  linkGoogle: () => Promise<void>
  unlinkGoogle: () => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Supabase reports auth failures with terse, sometimes technical strings.
 * These are the ones users actually hit, rewritten as something actionable.
 */
function humanizeAuthError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'That email or password is not correct.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email address first - check your inbox for the link.'
  }
  if (normalized.includes('user already registered') || normalized.includes('already been registered')) {
    return 'An account with that email already exists. Try signing in instead.'
  }
  if (normalized.includes('password should be at least')) {
    return 'Please choose a password of at least 8 characters.'
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Could not reach the authentication service. Check your connection.'
  }
  if (normalized.includes('identity is already linked') || normalized.includes('already been taken')) {
    return 'That Google account is already connected to another Zefinoro account.'
  }
  if (normalized.includes('manual linking is disabled')) {
    return 'Account linking is turned off for this project.'
  }
  return message
}

function assertOk(error: { message: string } | null): void {
  if (error) throw new Error(humanizeAuthError(error.message))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setStatus(data.session ? 'authenticated' : 'unauthenticated')
      })
      .catch(() => {
        if (active) setStatus('unauthenticated')
      })

    // Covers sign-in, sign-out, token refresh and the OAuth redirect landing.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setStatus(nextSession ? 'authenticated' : 'unauthenticated')
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    assertOk(error)
  }, [])

  const signUpWithPassword = useCallback(
    async ({ email, password, fullName }: { email: string; password: string; fullName: string }) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      assertOk(error)

      // When email confirmation is enabled Supabase returns a user with no
      // session; the caller shows a "check your inbox" screen instead of
      // routing into the app.
      return { needsEmailConfirmation: Boolean(data.user && !data.session) }
    },
    []
  )

  const signInWithGoogle = useCallback(async (redirectPath = '/') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    assertOk(error)
  }, [])

  /**
   * Attach a Google identity to the account the user is already signed in to,
   * so the same person can use either method afterwards. Redirects out to
   * Google and returns to /auth/callback, exactly like signing in.
   */
  const linkGoogle = useCallback(async () => {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/settings/accounts')}`,
      },
    })
    assertOk(error)
  }, [])

  const unlinkGoogle = useCallback(async () => {
    const { data, error: listError } = await supabase.auth.getUserIdentities()
    assertOk(listError)

    const identities = data?.identities ?? []
    const google = identities.find((identity) => identity.provider === 'google')
    if (!google) throw new Error('No Google account is connected.')

    // Supabase refuses to remove the only identity, which would leave the
    // account unreachable. Say so plainly rather than surfacing its error.
    if (identities.length <= 1) {
      throw new Error('This is the only way to sign in. Set a password first, then disconnect Google.')
    }

    const { error } = await supabase.auth.unlinkIdentity(google)
    assertOk(error)
    // Refresh so app_metadata.providers reflects the change immediately.
    const { data: refreshed } = await supabase.auth.refreshSession()
    if (refreshed.session) setSession(refreshed.session)
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    assertOk(error)
  }, [])

  /**
   * Pull a fresh session. `app_metadata.providers` only changes server-side, so
   * after linking or unlinking an identity the local copy is stale until this
   * runs.
   */
  const refreshUser = useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session) setSession(data.session)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setStatus('unauthenticated')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      linkGoogle,
      unlinkGoogle,
      updatePassword,
      refreshUser,
      signOut,
    }),
    [
      status,
      session,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      linkGoogle,
      unlinkGoogle,
      updatePassword,
      refreshUser,
      signOut,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.')
  return ctx
}
