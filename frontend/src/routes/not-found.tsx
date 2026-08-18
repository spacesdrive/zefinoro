import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="bg-muted text-muted-foreground mx-auto mb-5 flex size-12 items-center justify-center rounded-full">
          <Compass className="size-6" aria-hidden="true" />
        </div>

        <p className="text-muted-foreground text-sm font-medium">404</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground mt-2 text-sm text-pretty">
          The page you were looking for does not exist, or you may not have access to it.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Go back
          </Button>
          <Button asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
