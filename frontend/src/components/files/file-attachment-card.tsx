import { useState } from 'react'
import { Eye, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { FileTypeIcon } from './file-type-icon'
import { FileDownloadButton } from './download-button'
import { formatBytes } from '@/lib/format'
import { fileTypeLabel } from '@/lib/files'
import type { Attachment } from '@/types'
import { cn } from '@/lib/utils'

interface FileAttachmentCardProps {
  attachment: Attachment
  onPreview: (attachment: Attachment) => void
  onDelete?: (attachment: Attachment) => void
  className?: string
}

/**
 * One attachment in a transaction's detail view. Image attachments show their
 * thumbnail; everything else shows a typed icon.
 */
export function FileAttachmentCard({
  attachment,
  onPreview,
  onDelete,
  className,
}: FileAttachmentCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <div
        className={cn(
          'group bg-card flex items-center gap-3 rounded-lg border p-2.5 transition-colors',
          'hover:bg-accent/40',
          className
        )}
      >
        <button
          type="button"
          onClick={() => onPreview(attachment)}
          className="focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:ring-[3px] focus-visible:outline-none"
          aria-label={`Preview ${attachment.originalFilename}`}
        >
          {attachment.thumbnailUrl ? (
            <img
              src={attachment.thumbnailUrl}
              alt=""
              loading="lazy"
              className="size-10 shrink-0 rounded-md border object-cover"
            />
          ) : (
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md border">
              <FileTypeIcon
                mimeType={attachment.mimeType}
                filename={attachment.originalFilename}
                className="size-5"
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{attachment.originalFilename}</p>
            <p className="text-muted-foreground truncate text-xs">
              {fileTypeLabel(attachment.mimeType, attachment.originalFilename)} ·{' '}
              {formatBytes(attachment.fileSize)}
            </p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onPreview(attachment)}
            aria-label={`Preview ${attachment.originalFilename}`}
          >
            <Eye className="size-4" aria-hidden="true" />
          </Button>

          <FileDownloadButton attachment={attachment} variant="ghost" size="icon" className="size-8" />

          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive size-8"
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete ${attachment.originalFilename}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {onDelete && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this attachment?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-medium">{attachment.originalFilename}</span> will be permanently
                removed from this transaction and from file storage. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => onDelete(attachment)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
