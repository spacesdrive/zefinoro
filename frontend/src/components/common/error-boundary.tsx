import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /** Rendered instead of the default panel, e.g. for a widget-level boundary. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Application error boundary.
 *
 * Users see a recovery panel, never a stack trace. The details are logged to
 * the console for developers and would be the hook for an error reporter.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="bg-destructive/10 text-destructive mx-auto mb-5 flex size-12 items-center justify-center rounded-full">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            The page ran into an unexpected problem. Your data has not been affected.
          </p>

          {import.meta.env.DEV && (
            <pre className="bg-muted text-muted-foreground mt-4 max-h-40 overflow-auto rounded-md p-3 text-left text-xs">
              {error.message}
            </pre>
          )}

          <div className="mt-6 flex items-center justify-center gap-3">
            <Button onClick={this.reset}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Try again
            </Button>
            <Button variant="outline" onClick={() => window.location.assign('/dashboard')}>
              Go to dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
