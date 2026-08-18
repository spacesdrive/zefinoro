import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AuthLayoutProps {
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}

/**
 * The shell shared by every unauthenticated screen: a centred card with the
 * product mark above it, matching the reference project's auth pages.
 */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="bg-muted/40 flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-6">
        <Link
          to="/"
          className="focus-visible:ring-ring/50 flex items-center justify-center gap-2 rounded-md focus-visible:ring-[3px] focus-visible:outline-none"
        >
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <Wallet className="size-4" aria-hidden="true" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Zefinoro</span>
        </Link>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        {footer && <div className="text-muted-foreground text-center text-sm">{footer}</div>}

        <p className="text-muted-foreground text-center text-xs text-balance">
          Track what comes in, what goes out, and what is left.
        </p>
      </div>
    </div>
  )
}

export function GoogleButton({
  onClick,
  disabled,
  label = 'Continue with Google',
}: {
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    >
      <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
        <path
          fill="#EA4335"
          d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
        />
      </svg>
      {label}
    </button>
  )
}

export function OrSeparator() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card text-muted-foreground px-2">Or continue with</span>
      </div>
    </div>
  )
}
