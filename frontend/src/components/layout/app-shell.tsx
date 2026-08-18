import { Fragment, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { AppSidebar } from './app-sidebar'
import { ThemeToggle } from './theme-toggle'
import { CommandMenu, useCommandMenu } from './command-menu'
import { TransactionDialog } from '@/components/billing/transaction-dialog'
import { ErrorBoundary } from '@/components/common/error-boundary'
import { routeLabels } from '@/config/navigation'

/** Turn the current pathname into breadcrumb segments. */
function useBreadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)

  return segments.map((segment, index) => ({
    label: routeLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1),
    href: `/${segments.slice(0, index + 1).join('/')}`,
    isLast: index === segments.length - 1,
  }))
}

/**
 * The authenticated application frame: sidebar, sticky header, content outlet.
 *
 * The command palette and the "add transaction" dialog live here so they are
 * reachable from every page and survive route changes.
 */
export function AppShell() {
  const crumbs = useBreadcrumbs()
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandMenu()
  const [transactionOpen, setTransactionOpen] = useState(false)

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b backdrop-blur transition-[width,height] ease-linear">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList>
                {crumbs.map((crumb) => (
                  <Fragment key={crumb.href}>
                    <BreadcrumbItem>
                      {crumb.isLast ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!crumb.isLast && <BreadcrumbSeparator />}
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommandOpen(true)}
                className="text-muted-foreground relative h-9 w-9 justify-start px-0 sm:w-56 sm:px-3"
                aria-label="Open command palette"
              >
                <Search className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline-flex">Search...</span>
                <kbd className="bg-muted pointer-events-none absolute top-1/2 right-1.5 hidden h-5 -translate-y-1/2 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>

              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
          {/* A page-level boundary keeps a crashing widget from taking down
              the sidebar and header with it. */}
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </SidebarInset>

      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onAddTransaction={() => setTransactionOpen(true)}
      />

      <TransactionDialog open={transactionOpen} onOpenChange={setTransactionOpen} />
    </SidebarProvider>
  )
}
