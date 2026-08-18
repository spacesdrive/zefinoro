import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Attachment } from '@/types'
import { cn } from '@/lib/utils'

interface DownloadButtonProps {
  attachment: Attachment
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

/**
 * Download an attachment, keeping its original filename.
 *
 * Two routes, chosen by what the storage account allows:
 *
 *  - When the URL carries `fl_attachment`, Cloudinary already sets the
 *    Content-Disposition header. A plain anchor streams it straight to disk,
 *    which matters for a 25 MB video.
 *  - Otherwise - the cloud has Strict Transformations enabled, so no
 *    transformation is permitted - the `download` attribute is ignored because
 *    the URL is cross-origin, and the file would open in a tab named after its
 *    opaque public id. Fetching it and saving a same-origin blob preserves the
 *    name. It buffers the file in memory, which is the price of that setting.
 */
export function FileDownloadButton({
  attachment,
  variant = 'outline',
  size = 'sm',
  className,
}: DownloadButtonProps) {
  const [busy, setBusy] = useState(false)
  const streamsDirectly = attachment.downloadUrl.includes('fl_attachment')

  const handleBlobDownload = async () => {
    setBusy(true)
    try {
      const response = await fetch(attachment.downloadUrl, { mode: 'cors' })
      if (!response.ok) throw new Error(`The file could not be downloaded (HTTP ${response.status}).`)

      const objectUrl = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = attachment.originalFilename
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      // Revoking immediately can cancel the save in some browsers.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
    } catch (error) {
      toast.error('Could not download that file', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  if (streamsDirectly) {
    return (
      <Button variant={variant} size={size} className={cn(className)} asChild>
        <a
          href={attachment.downloadUrl}
          download={attachment.originalFilename}
          aria-label={`Download ${attachment.originalFilename}`}
        >
          <Download className="size-4" aria-hidden="true" />
          {size !== 'icon' && 'Download'}
        </a>
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={() => void handleBlobDownload()}
      disabled={busy}
      aria-label={`Download ${attachment.originalFilename}`}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      {size !== 'icon' && 'Download'}
    </Button>
  )
}
