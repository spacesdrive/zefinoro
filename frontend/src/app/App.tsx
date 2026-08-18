import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from './query-client'
import { AuthProvider } from '@/contexts/auth-context'
import { ThemeProvider } from '@/contexts/theme-context'
import { WorkspaceProvider } from '@/contexts/workspace-context'
import { RequireAuth, RequireGuest, RequireWorkspace } from '@/components/auth/guards'
import { AppShell } from '@/components/layout/app-shell'
import { ErrorBoundary } from '@/components/common/error-boundary'
import { FullPageLoader } from '@/components/common/states'
import { NotFoundPage } from '@/routes/not-found'

// Auth screens are small and needed immediately, so they stay in the main chunk.
import LoginPage from '@/routes/auth/login'
import SignupPage from '@/routes/auth/signup'
import AuthCallbackPage from '@/routes/auth/callback'

// The application pages are split per route - charts and tables are heavy and
// should not delay the first paint of a login screen.
const DashboardPage = lazy(() => import('@/routes/dashboard'))
const BillingPage = lazy(() => import('@/routes/billing'))
const UsersPage = lazy(() => import('@/routes/users'))
const OnboardingPage = lazy(() => import('@/routes/onboarding'))
const WorkspacesPage = lazy(() => import('@/routes/workspaces'))
const SettingsLayout = lazy(() => import('@/routes/settings/layout'))
const ProfileSettingsPage = lazy(() => import('@/routes/settings/profile'))
const AppearanceSettingsPage = lazy(() => import('@/routes/settings/appearance'))
const AccountSettingsPage = lazy(() => import('@/routes/settings/accounts'))

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            {/* AuthProvider sits inside the router because sign-out navigates. */}
            <AuthProvider>
              <WorkspaceProvider>
                <TooltipProvider delayDuration={300}>
                  <Suspense fallback={<FullPageLoader />}>
                    <Routes>
                      {/* - Public ------------------------------------------ */}
                      <Route element={<RequireGuest />}>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                      </Route>

                      <Route path="/auth/callback" element={<AuthCallbackPage />} />

                      {/* - Authenticated, no workspace required ------------- */}
                      <Route element={<RequireAuth />}>
                        <Route path="/onboarding" element={<OnboardingPage />} />
                        <Route path="/workspaces" element={<WorkspacesPage />} />
                        {/* A shared invite link lands here and is handed to the
                            join flow with the code prefilled. */}
                        <Route path="/join" element={<Navigate to="/onboarding?mode=join" replace />} />

                        {/* - Authenticated, workspace required -------------- */}
                        <Route element={<RequireWorkspace />}>
                          <Route element={<AppShell />}>
                            <Route index element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<DashboardPage />} />

                            <Route path="/billing" element={<BillingPage />} />
                            <Route path="/billing/received" element={<BillingPage />} />
                            <Route path="/billing/spent" element={<BillingPage />} />

                            <Route path="/users" element={<UsersPage />} />

                            <Route path="/settings" element={<SettingsLayout />}>
                              <Route index element={<Navigate to="/settings/profile" replace />} />
                              <Route path="profile" element={<ProfileSettingsPage />} />
                              <Route path="appearance" element={<AppearanceSettingsPage />} />
                              <Route path="accounts" element={<AccountSettingsPage />} />
                            </Route>
                          </Route>
                        </Route>
                      </Route>

                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>

                  <Toaster position="bottom-right" richColors closeButton />
                </TooltipProvider>
              </WorkspaceProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
