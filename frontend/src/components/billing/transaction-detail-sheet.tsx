import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Loader2, Pencil, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { FileAttachmentCard } from '@/components/files/file-attachment-card'
import { FilePreviewDialog } from '@/components/files/file-preview-dialog'
import { useDeleteAttachment, useDeleteTransaction } from '@/features/transactions/hooks'
import { displayName, formatCurrency, formatDate, formatDateTime, initialsOf } from '@/lib/format'
import { useWorkspace } from '@/contexts/workspace-context'
import { useAuth } from '@/contexts/auth-context'
import type { Attachment, Transaction } from '@/types'
import { cn } from '@/lib/utils'

interface TransactionDetailSheetProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (transaction: Transaction) => void
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3 py-2">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

export function TransactionDetailSheet({
  transaction,
  open,
  onOpenChange,
  onEdit,
}: TransactionDetailSheetProps) {
  const { canManage } = useWorkspace()
  const { user } = useAuth()
  const [preview, setPreview] = useState<Attachment | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteTransaction = useDeleteTransaction()
  const deleteAttachment = useDeleteAttachment()

  if (!transaction) return null

  // Members own their own records; managers can act on anything in the workspace.
  const isAuthor = user?.id === transaction.createdBy.id
  const canModify = isAuthor || canManage
  const isReceived = transaction.type === 'received'

  const handleDelete = async () => {
    await deleteTransaction.mutateAsync(transaction.id)
    setConfirmDelete(false)
    onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="space-y-2 border-b px-6 py-4 text-left">
            <div className="flex items-start justify-between gap-3 pr-6">
              <SheetTitle className="text-pretty">{transaction.title}</SheetTitle>
              <Badge variant={isReceived ? 'secondary' : 'outline'} className="shrink-0 gap-1 capitalize">
                {isReceived ? (
                  <ArrowDownLeft className="size-3" aria-hidden="true" />
                ) : (
                  <ArrowUpRight className="size-3" aria-hidden="true" />
                )}
                {transaction.type}
              </Badge>
            </div>
            <SheetDescription
              className={cn(
                'text-2xl font-bold tabular-nums-amount',
                isReceived ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
              )}
            >
              {isReceived ? '+' : '-'}
              {formatCurrency(transaction.amount, transaction.currency)}
            </SheetDescription>
          </SheetHeader>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-5 px-6 py-5">
              <dl className="divide-y">
                <DetailRow label="Date">{formatDate(transaction.transactionDate)}</DetailRow>

                <DetailRow label="Category">
                  {transaction.category ? (
                    <span className="inline-flex items-center gap-2">
                      {transaction.category.color && (
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: transaction.category.color }}
                          aria-hidden="true"
                        />
                      )}
                      {transaction.category.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Uncategorized</span>
                  )}
                </DetailRow>

                <DetailRow label="Created by">
                  <span className="inline-flex items-center gap-2">
                    <Avatar className="size-5">
                      {transaction.createdBy.avatarUrl && (
                        <AvatarImage src={transaction.createdBy.avatarUrl} alt="" />
                      )}
                      <AvatarFallback className="text-[9px]">
                        {initialsOf(transaction.createdBy.fullName, transaction.createdBy.email)}
                      </AvatarFallback>
                    </Avatar>
                    {displayName(transaction.createdBy)}
                  </span>
                </DetailRow>

                <DetailRow label="Created">{formatDateTime(transaction.createdAt)}</DetailRow>

                {transaction.updatedAt !== transaction.createdAt && (
                  <DetailRow label="Last updated">{formatDateTime(transaction.updatedAt)}</DetailRow>
                )}
              </dl>

              {transaction.description && (
                <div className="space-y-1.5">
                  <h3 className="text-muted-foreground text-sm">Description</h3>
                  <p className="text-sm whitespace-pre-wrap">{transaction.description}</p>
                </div>
              )}

              <Separator />

              <div className="space-y-2.5">
                <h3 className="text-sm font-medium">
                  Attachments{' '}
                  <span className="text-muted-foreground font-normal">
                    ({transaction.attachments.length})
                  </span>
                </h3>

                {transaction.attachments.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                    No files attached to this transaction.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {transaction.attachments.map((attachment) => (
                      <FileAttachmentCard
                        key={attachment.id}
                        attachment={attachment}
                        onPreview={setPreview}
                        onDelete={
                          canModify ? (att) => void deleteAttachment.mutateAsync(att.id) : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {canModify && (
            <SheetFooter className="flex-row gap-2 border-t px-6 py-4">
              <Button variant="outline" className="flex-1" onClick={() => onEdit(transaction)}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive flex-1"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <FilePreviewDialog
        attachment={preview}
        open={Boolean(preview)}
        onOpenChange={(next) => !next && setPreview(null)}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{transaction.title}</span> and its{' '}
              {transaction.attachments.length} attachment(s) will be permanently deleted, and your
              workspace totals will be recalculated. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTransaction.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleteTransaction.isPending}
            >
              {deleteTransaction.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Delete transaction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
