import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTypeIcon } from './file-type-icon'
import { FileDownloadButton } from './download-button'
import { formatBytes } from '@/lib/format'
import { fileTypeLabel } from '@/lib/files'
import type { Attachment } from '@/types'
import { cn } from '@/lib/utils'

interface FilePreviewDialogProps {
  attachment: Attachment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Attachment preview.
 *
 * Each file family gets the renderer the browser can genuinely handle: an image
 * viewer with zoom, a native video/audio player, an embedded PDF, fetched text
 * for plain formats. Anything a browser cannot display honestly says so and
 * offers download instead of pretending.
 */
export function FilePreviewDialog({ attachment, open, onOpenChange }: FilePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(92vw,1000px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1000px]">
        {attachment && (
          <>
            <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
              <DialogTitle className="flex items-center gap-2 pr-8 text-base">
                <FileTypeIcon mimeType={attachment.mimeType} filename={attachment.originalFilename} />
                <span className="truncate">{attachment.originalFilename}</span>
              </DialogTitle>
              <DialogDescription>
                {fileTypeLabel(attachment.mimeType, attachment.originalFilename)} ·{' '}
                {formatBytes(attachment.fileSize)}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-hidden">
              <PreviewBody attachment={attachment} />
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <Button variant="outline" size="sm" asChild>
                <a href={attachment.previewUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Open in new tab
                </a>
              </Button>
              <FileDownloadButton attachment={attachment} variant="default" size="sm" />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PreviewBody({ attachment }: { attachment: Attachment }) {
  switch (attachment.previewKind) {
    case 'image':
      return <ImagePreview attachment={attachment} />
    case 'pdf':
      return (
        <object data={attachment.previewUrl} type="application/pdf" className="h-[70vh] w-full">
          {/* Rendered when the browser has no built-in PDF viewer - mobile
              Safari and some Android browsers included. */}
          <UnsupportedNotice
            attachment={attachment}
            message="Your browser cannot display PDFs inline. Download it or open it in a new tab."
          />
        </object>
      )
    case 'video':
      return (
        <div className="flex items-center justify-center bg-black">
          <video src={attachment.previewUrl} controls className="max-h-[70vh] w-full" preload="metadata">
            Your browser cannot play this video.
          </video>
        </div>
      )
    case 'audio':
      return (
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
          <FileTypeIcon
            mimeType={attachment.mimeType}
            filename={attachment.originalFilename}
            className="size-10"
          />
          <audio src={attachment.previewUrl} controls className="w-full max-w-md">
            Your browser cannot play this audio file.
          </audio>
        </div>
      )
    case 'text':
    case 'csv':
    case 'json':
      return <TextPreview attachment={attachment} />
    default:
      return (
        <UnsupportedNotice
          attachment={attachment}
          message="This file type cannot be previewed in a browser."
        />
      )
  }
}

function ImagePreview({ attachment }: { attachment: Attachment }) {
  const [zoom, setZoom] = useState(1)

  return (
    <div className="relative">
      <div className="absolute top-3 right-3 z-10 flex gap-1.5">
        <Button
          variant="secondary"
          size="icon"
          className="size-8 shadow-sm"
          onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
          disabled={zoom <= 0.5}
          aria-label="Zoom out"
        >
          <ZoomOut className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="size-8 shadow-sm"
          onClick={() => setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
          disabled={zoom >= 4}
          aria-label="Zoom in"
        >
          <ZoomIn className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <ScrollArea className="h-[70vh]">
        <div className="flex min-h-[70vh] items-center justify-center p-4">
          <img
            src={attachment.previewUrl}
            alt={attachment.originalFilename}
            className="max-w-full origin-center object-contain transition-transform duration-150"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>
      </ScrollArea>
    </div>
  )
}

/**
 * Text-like formats are fetched and rendered as text. Cloudinary serves raw
 * assets with permissive CORS, and the size ceiling for these types is 5 MB, so
 * this stays cheap.
 */
function TextPreview({ attachment }: { attachment: Attachment }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; content: string }>({
    status: 'loading',
    content: '',
  })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading', content: '' })

    fetch(attachment.previewUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((text) => {
        // Guard against a pathological one-line file locking up the renderer.
        const clipped = text.length > 200_000 ? `${text.slice(0, 200_000)}\n\n... truncated` : text
        setState({ status: 'ready', content: clipped })
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setState({ status: 'error', content: '' })
      })

    return () => controller.abort()
  }, [attachment.previewUrl])

  if (state.status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center" role="status">
        <Loader2 className="text-muted-foreground size-5 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <UnsupportedNotice
        attachment={attachment}
        message="The file contents could not be loaded for preview."
      />
    )
  }

  if (attachment.previewKind === 'csv') {
    return <CsvTable content={state.content} />
  }

  const formatted =
    attachment.previewKind === 'json' ? safePrettyJson(state.content) : state.content

  return (
    <ScrollArea className="h-[70vh]">
      <pre className="p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap">{formatted}</pre>
    </ScrollArea>
  )
}

function safePrettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    // Malformed JSON is still worth showing verbatim.
    return raw
  }
}

/**
 * A deliberately simple CSV renderer: split on commas outside quotes. It is a
 * preview, not a parser - exotic dialects fall back to looking like text.
 */
function CsvTable({ content }: { content: string }) {
  const rows = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, 200)
    .map(splitCsvLine)

  if (rows.length === 0) {
    return <p className="text-muted-foreground p-6 text-sm">This file is empty.</p>
  }

  const [header, ...body] = rows

  return (
    <ScrollArea className="h-[70vh]">
      <div className="overflow-x-auto p-1">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              {header!.map((cell, i) => (
                <th key={i} className="border-b px-3 py-2 text-left font-medium whitespace-nowrap">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r} className={cn(r % 2 === 1 && 'bg-muted/30')}>
                {row.map((cell, c) => (
                  <td key={c} className="border-b px-3 py-1.5 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  )
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

function UnsupportedNotice({ attachment, message }: { attachment: Attachment; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <FileTypeIcon
        mimeType={attachment.mimeType}
        filename={attachment.originalFilename}
        className="size-10"
      />
      <div>
        <p className="text-sm font-medium">{attachment.originalFilename}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {fileTypeLabel(attachment.mimeType, attachment.originalFilename)} ·{' '}
          {formatBytes(attachment.fileSize)}
        </p>
      </div>
      <p className="text-muted-foreground max-w-sm text-sm text-pretty">{message}</p>
    </div>
  )
}
