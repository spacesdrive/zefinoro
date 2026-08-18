import { useState } from 'react'
import { Ban, Copy, Loader2, MoreHorizontal, Shield, Trash2, UserPlus, Users2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states'
import { InviteDialog } from '@/components/users/invite-dialog'
import {
  useDeleteInvitation,
  useInvitations,
  useMembers,
  useRemoveMember,
  useRevokeInvitation,
  useUpdateMemberRole,
} from '@/features/workspaces/hooks'
import { useWorkspace } from '@/contexts/workspace-context'
import { useAuth } from '@/contexts/auth-context'
import { displayName, formatDate, initialsOf } from '@/lib/format'
import type { Invitation, Member, WorkspaceRole } from '@/types'

const ROLE_VARIANTS: Record<WorkspaceRole, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
}

export default function UsersPage() {
  const { canManage, isOwner, role } = useWorkspace()
  const { user } = useAuth()

  const membersQuery = useMembers()
  const invitationsQuery = useInvitations()
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()
  const revokeInvitation = useRevokeInvitation()
  const deleteInvitation = useDeleteInvitation()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null)
  const [pendingInviteDeletion, setPendingInviteDeletion] = useState<Invitation | null>(null)

  const members = membersQuery.data ?? []
  const invitations = invitationsQuery.data ?? []
  const admins = members.filter((m) => m.role === 'owner' || m.role === 'admin')

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Invite code copied', { description: code })
    } catch {
      // Clipboard access is denied in some browsers/contexts; show the code so
      // it can still be copied by hand.
      toast.error('Could not copy automatically', { description: `Your code is ${code}` })
    }
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Users"
          description="Manage who can see and record transactions in this workspace."
          actions={
            canManage && (
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-4" aria-hidden="true" />
                Invite member
              </Button>
            )
          }
        />

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="admins">Admin</TabsTrigger>
            {canManage && <TabsTrigger value="invites">Invitations</TabsTrigger>}
          </TabsList>

          <TabsContent value="members" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All members</CardTitle>
                <CardDescription>
                  {members.length} {members.length === 1 ? 'person has' : 'people have'} access to this
                  workspace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MembersTable
                  members={members}
                  isLoading={membersQuery.isLoading}
                  isError={membersQuery.isError}
                  onRetry={() => void membersQuery.refetch()}
                  currentUserId={user?.id}
                  canManage={canManage}
                  isOwner={isOwner}
                  currentRole={role}
                  onChangeRole={(memberId, nextRole) =>
                    void updateRole.mutateAsync({ memberId, role: nextRole })
                  }
                  onRemove={setPendingRemoval}
                  onInvite={() => setInviteOpen(true)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Owners & admins</CardTitle>
                <CardDescription>
                  People who can manage members, invitations and workspace settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MembersTable
                  members={admins}
                  isLoading={membersQuery.isLoading}
                  isError={membersQuery.isError}
                  onRetry={() => void membersQuery.refetch()}
                  currentUserId={user?.id}
                  canManage={canManage}
                  isOwner={isOwner}
                  currentRole={role}
                  onChangeRole={(memberId, nextRole) =>
                    void updateRole.mutateAsync({ memberId, role: nextRole })
                  }
                  onRemove={setPendingRemoval}
                  onInvite={() => setInviteOpen(true)}
                  emptyTitle="No admins yet"
                  emptyDescription="Promote a member to admin so they can help manage this workspace."
                />
              </CardContent>
            </Card>
          </TabsContent>

          {canManage && (
            <TabsContent value="invites" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Invitations</CardTitle>
                  <CardDescription>
                    Share a code and anyone with it can join this workspace, until it expires or is
                    revoked.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {invitationsQuery.isLoading ? (
                    <TableSkeleton rows={4} columns={5} />
                  ) : invitationsQuery.isError ? (
                    <ErrorState onRetry={() => void invitationsQuery.refetch()} />
                  ) : invitations.length === 0 ? (
                    <EmptyState
                      icon={UserPlus}
                      title="No invitations yet"
                      description="Create an invite code to bring someone into this workspace."
                      action={<Button onClick={() => setInviteOpen(true)}>Invite member</Button>}
                    />
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Code</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Uses</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invitations.map((invitation) => (
                            <TableRow key={invitation.id}>
                              <TableCell className="font-mono text-sm font-medium">
                                {invitation.inviteCode}
                              </TableCell>
                              <TableCell className="capitalize">{invitation.role}</TableCell>
                              <TableCell className="tabular-nums">
                                {invitation.useCount} / {invitation.maxUses}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                {formatDate(invitation.expiresAt)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={invitation.status === 'active' ? 'secondary' : 'outline'}
                                  className="capitalize"
                                >
                                  {invitation.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    onClick={() => void copyCode(invitation.inviteCode)}
                                    aria-label={`Copy invite code ${invitation.inviteCode}`}
                                  >
                                    <Copy className="size-4" aria-hidden="true" />
                                  </Button>
                                  {invitation.status === 'active' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-muted-foreground hover:text-foreground size-8"
                                      onClick={() => void revokeInvitation.mutateAsync(invitation.id)}
                                      disabled={revokeInvitation.isPending}
                                      title="Revoke this invite"
                                      aria-label={`Revoke invite ${invitation.inviteCode}`}
                                    >
                                      <Ban className="size-4" aria-hidden="true" />
                                    </Button>
                                  )}

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive size-8"
                                    onClick={() => setPendingInviteDeletion(invitation)}
                                    title="Delete this invite"
                                    aria-label={`Delete invite ${invitation.inviteCode}`}
                                  >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <AlertDialog
        open={Boolean(pendingInviteDeletion)}
        onOpenChange={(next) => !next && setPendingInviteDeletion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invite?</AlertDialogTitle>
            <AlertDialogDescription>
              The code{' '}
              <span className="font-mono font-medium">{pendingInviteDeletion?.inviteCode}</span> will be
              removed from this list for good.
              {pendingInviteDeletion?.status === 'active'
                ? ' It is still active, so anyone holding it loses access immediately.'
                : ' It is already inactive, so nobody can use it either way.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInvitation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (!pendingInviteDeletion) return
                void deleteInvitation
                  .mutateAsync(pendingInviteDeletion.id)
                  .then(() => setPendingInviteDeletion(null))
              }}
              disabled={deleteInvitation.isPending}
            >
              {deleteInvitation.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Delete invite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRemoval)}
        onOpenChange={(next) => !next && setPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{displayName(pendingRemoval?.user)}</span> will immediately
              lose access to this workspace and everything in it. Transactions they created will
              remain. You can invite them back at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMember.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (!pendingRemoval) return
                void removeMember.mutateAsync(pendingRemoval.id).then(() => setPendingRemoval(null))
              }}
              disabled={removeMember.isPending}
            >
              {removeMember.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface MembersTableProps {
  members: Member[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  currentUserId: string | undefined
  canManage: boolean
  isOwner: boolean
  currentRole: WorkspaceRole | null
  onChangeRole: (memberId: string, role: WorkspaceRole) => void
  onRemove: (member: Member) => void
  onInvite: () => void
  emptyTitle?: string
  emptyDescription?: string
}

function MembersTable({
  members,
  isLoading,
  isError,
  onRetry,
  currentUserId,
  canManage,
  isOwner,
  onChangeRole,
  onRemove,
  onInvite,
  emptyTitle = 'No members yet',
  emptyDescription = 'Invite someone to start collaborating on this workspace.',
}: MembersTableProps) {
  if (isLoading) return <TableSkeleton rows={5} columns={5} />
  if (isError) return <ErrorState onRetry={onRetry} />

  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users2}
        title={emptyTitle}
        description={emptyDescription}
        action={canManage ? <Button onClick={onInvite}>Invite member</Button> : undefined}
      />
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Member</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const isSelf = member.userId === currentUserId
            // Only an owner may touch another owner's role or membership.
            const canActOnMember = canManage && !isSelf && (member.role !== 'owner' || isOwner)

            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      {member.user?.avatarUrl && <AvatarImage src={member.user.avatarUrl} alt="" />}
                      <AvatarFallback className="text-xs">
                        {initialsOf(member.user?.fullName, member.user?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {displayName(member.user)}
                        {isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="text-muted-foreground max-w-[220px] truncate text-sm">
                  {member.user?.email ?? '--'}
                </TableCell>

                <TableCell>
                  <Badge variant={ROLE_VARIANTS[member.role]} className="gap-1 capitalize">
                    {member.role === 'owner' && <Shield className="size-3" aria-hidden="true" />}
                    {member.role}
                  </Badge>
                </TableCell>

                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {formatDate(member.joinedAt)}
                </TableCell>

                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {member.status}
                  </Badge>
                </TableCell>

                <TableCell>
                  {canActOnMember && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Actions for ${displayName(member.user)}`}
                        >
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Change role</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={member.role}
                          onValueChange={(value) => onChangeRole(member.id, value as WorkspaceRole)}
                        >
                          {isOwner && <DropdownMenuRadioItem value="owner">Owner</DropdownMenuRadioItem>}
                          <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="member">Member</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onRemove(member)}>
                          <Trash2 aria-hidden="true" />
                          Remove from workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
