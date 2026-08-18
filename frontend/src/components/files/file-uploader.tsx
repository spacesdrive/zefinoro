import { useCallback, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, RotateCcw, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { FileTypeIcon } from './file-type-icon'
import { ACCEPT_ATTRIBUTE, MAX_FILES_PER_TRANSACTION, checkFile } from '@/lib/files'
import { UploadCancelledError, uploadFile } from '@/lib/cloudinary/upload'
import { formatBytes } from '@/lib/format'
import type { AttachmentInput } from '@/types'
import { cn } from '@/lib/utils'

export interface PendingUpload {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'done' | 'error' | 'cancelled'
  progress: number
  error?: string
  result?: AttachmentInput
  cancel?: () => void
}

interface FileUploaderProps {
  workspaceId: string
  uploads: PendingUpload[]
  onChange: (uploads: PendingUpload[]) => void
  disabled?: boolean
  maxFiles?: number
}

/**
 * Drag-and-drop uploader with per-file progress, cancel and retry.
 *
 * Files upload immediately on selection rather than on form submit, so a slow
 * 20 MB video is not holding the "Save" button hostage. The parent reads
 * `uploads` to know which attachments are ready to attach.
 */
export function FileUploader({
  workspaceId,
  uploads,
  onChange,
  disabled = false,
  maxFiles = MAX_FILES_PER_TRANSACTION,
}: FileUploaderProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // A ref mirror keeps the async progress callbacks from closing over a stale
  // uploads array while several files upload at once.
  const uploadsRef = useRef(uploads)
  uploadsRef.current = uploads

  const patch = useCallback(
    (id: string, changes: Partial<PendingUpload>) => {
      onChange(uploadsRef.current.map((u) => (u.id === id ? { ...u, ...changes } : u)))
    },
    [onChange]
  )

  const startUpload = useCallback(
    (entry: PendingUpload) => {
      const handle = uploadFile(workspaceId, entry.file, {
        onProgress: (progress) => patch(entry.id, { progress }),
      })

      patch(entry.id, { status: 'uploading', progress: 0, error: undefined, cancel: handle.cancel })

      handle.promise
        .then((result) => patch(entry.id, { status: 'done', progress: 100, result }))
        .catch((err: unknown) => {
          if (err instanceof UploadCancelledError) {
            patch(entry.id, { status: 'cancelled', progress: 0 })
            return
          }
          patch(entry.id, {
            status: 'error',
            error: err instanceof Error ? err.message : 'The upload failed.',
          })
        })
    },
    [workspaceId, patch]
  )

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const remaining = maxFiles - uploadsRef.current.length
      if (remaining <= 0) return

      const accepted: PendingUpload[] = []

      for (const file of Array.from(files).slice(0, remaining)) {
        const check = checkFile(file)
        const entry: PendingUpload = {
          id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
          file,
          status: check.ok ? 'queued' : 'error',
          progress: 0,
          error: check.ok ? undefined : check.message,
        }
        accepted.push(entry)
      }

      onChange([...uploadsRef.current, ...accepted])

      // The list state has to land before the async callbacks start patching it.
      requestAnimationFrame(() => {
        accepted.filter((entry) => entry.status === 'queued').forEach(startUpload)
      })
    },
    [maxFiles, onChange, startUpload]
  )

  const remove = useCallback(
    (id: string) => {
      const entry = uploadsRef.current.find((u) => u.id === id)
      entry?.cancel?.()
      onChange(uploadsRef.current.filter((u) => u.id !== id))
    },
    [onChange]
  )

  const atCapacity = uploads.length >= maxFiles

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled || atCapacity ? -1 : 0}
        aria-disabled={disabled || atCapacity}
        aria-label="Add attachments. Drag files here or press Enter to browse."
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled && !atCapacity) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (disabled || atCapacity) return
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
        }}
        onClick={() => !disabled && !atCapacity && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !atCapacity) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center transition-colors',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
          dragging && 'border-primary bg-primary/5',
          (disabled || atCapacity) ? 'cursor-not-allowed opacity-60' : 'hover:bg-accent/40 cursor-pointer'
        )}
      >
        <Upload className="text-muted-foreground mb-2 size-5" aria-hidden="true" />
        <p className="text-sm font-medium">
          {atCapacity ? `Limit of ${maxFiles} files reached` : 'Drag & drop files here'}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {atCapacity ? 'Remove one to add another' : 'or click to browse · images, PDFs, video, documents · up to 25 MB'}
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          tabIndex={-1}
          disabled={disabled || atCapacity}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            // Reset so selecting the same file twice still fires a change.
            e.target.value = ''
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((upload) => (
            <li
              key={upload.id}
              className="bg-card flex items-center gap-3 rounded-lg border px-3 py-2.5"
            >
              <FileTypeIcon mimeType={upload.file.type} filename={upload.file.name} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{upload.file.name}</p>
                  {upload.status === 'done' && (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                  )}
                  {(upload.status === 'error' || upload.status === 'cancelled') && (
                    <AlertCircle className="text-destructive size-3.5 shrink-0" aria-hidden="true" />
                  )}
                </div>

                {upload.status === 'uploading' ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={upload.progress} className="h-1.5 flex-1" />
                    <span className="text-muted-foreground text-xs tabular-nums">{upload.progress}%</span>
                  </div>
                ) : (
                  <p
                    className={cn(
                      'mt-0.5 truncate text-xs',
                      upload.status === 'error' || upload.status === 'cancelled'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    )}
                  >
                    {upload.status === 'error' && (upload.error ?? 'Upload failed')}
                    {upload.status === 'cancelled' && 'Cancelled'}
                    {upload.status === 'done' && `Ready · ${formatBytes(upload.file.size)}`}
                    {upload.status === 'queued' && 'Waiting...'}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {(upload.status === 'error' || upload.status === 'cancelled') && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => startUpload(upload)}
                    aria-label={`Retry uploading ${upload.file.name}`}
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => remove(upload.id)}
                  aria-label={
                    upload.status === 'uploading'
                      ? `Cancel uploading ${upload.file.name}`
                      : `Remove ${upload.file.name}`
                  }
                >
                  <X className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Attachment payloads for the uploads that finished successfully. */
export function completedAttachments(uploads: PendingUpload[]): AttachmentInput[] {
  return uploads
    .filter((u): u is PendingUpload & { result: AttachmentInput } => u.status === 'done' && !!u.result)
    .map((u) => u.result)
}

export function hasUploadsInFlight(uploads: PendingUpload[]): boolean {
  return uploads.some((u) => u.status === 'uploading' || u.status === 'queued')
}
