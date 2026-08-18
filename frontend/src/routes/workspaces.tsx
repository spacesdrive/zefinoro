import { useNavigate } from 'react-router-dom'
import { Building2, Plus, UserPlus, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/common/states'
import { useWorkspace } from '@/contexts/workspace-context'
import { formatDate, initialsOf } from '@/lib/format'

/**
 * Workspace picker.
 *
 * Shown when a signed-in user has several workspaces and no clear default, and
 * reachable from the account menu at any time.
 */
export default function WorkspacesPage() {
  const { workspaces, currentWorkspace, switchWorkspace, isLoading, isError, refresh } = useWorkspace()
  const navigate = useNavigate()

  return (
    <div className="bg-muted/40 flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Your workspaces</h1>
          <p className="text-muted-foreground text-sm">Choose a workspace to open.</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 py-4">
                  <Skeleton className="size-11 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <Card>
            <ErrorState
              title="Could not load your workspaces"
              onRetry={() => void refresh()}
            />
          </Card>
        ) : workspaces.length === 0 ? (
          <Card>
            <EmptyState
              icon={Building2}
              title="You are not a member of any workspace"
              description="Create your own workspace, or join an existing one with an invite code."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => navigate('/onboarding?mode=create')}>
                    <Plus className="size-4" aria-hidden="true" />
                    Create workspace
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/onboarding?mode=join')}>
                    <UserPlus className="size-4" aria-hidden="true" />
                    Join workspace
                  </Button>
                </div>
              }
            />
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {workspaces.map((workspace) => (
                <Card key={workspace.id} className="overflow-hidden transition-colors hover:border-primary/40">
                  <button
                    type="button"
                    onClick={() => switchWorkspace(workspace.id)}
                    className="focus-visible:ring-ring/50 flex w-full items-center gap-4 px-6 py-4 text-left focus-visible:ring-[3px] focus-visible:outline-none"
                  >
                    <Avatar className="size-11 rounded-lg">
                      {workspace.avatarUrl && (
                        <AvatarImage src={workspace.avatarUrl} alt="" className="object-cover" />
                      )}
                      <AvatarFallback className="rounded-lg">{initialsOf(workspace.name)}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{workspace.name}</p>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {workspace.role}
                        </Badge>
                        {workspace.id === currentWorkspace?.id && (
                          <Badge variant="outline" className="text-[10px]">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" aria-hidden="true" />
                          {workspace.memberCount} member{workspace.memberCount === 1 ? '' : 's'}
                        </span>
                        {workspace.joinedAt && <span>Joined {formatDate(workspace.joinedAt)}</span>}
                      </p>
                    </div>

                    <Button variant="ghost" size="sm" asChild={false} tabIndex={-1}>
                      Open
                    </Button>
                  </button>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => navigate('/onboarding?mode=create')}>
                <Plus className="size-4" aria-hidden="true" />
                Create workspace
              </Button>
              <Button variant="outline" onClick={() => navigate('/onboarding?mode=join')}>
                <UserPlus className="size-4" aria-hidden="true" />
                Join workspace
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
