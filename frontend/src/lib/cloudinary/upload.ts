import { api } from '@/lib/api/client'
import { checkFile, type ResourceType } from '@/lib/files'
import type { AttachmentInput } from '@/types'

/**
 * Direct browser-to-Cloudinary uploads.
 *
 * Files never pass through our Worker: a 25 MB video would not fit comfortably
 * in a Worker request, and proxying would double the transfer for no benefit.
 * The Worker instead issues a short-lived signature and later records the
 * returned metadata.
 *
 * XMLHttpRequest rather than fetch, because `fetch` still cannot report upload
 * progress and a silent 20 MB upload feels broken.
 */

interface UploadConfigResponse {
  cloudName: string
  endpoint: string
  folder: string
  resourceType: ResourceType
  apiKey: string
  signature: string
  timestamp: number
}

interface CloudinaryResponse {
  public_id: string
  secure_url: string
  resource_type: string
  bytes: number
  original_filename?: string
  error?: { message: string }
}

export interface UploadHandle {
  promise: Promise<AttachmentInput>
  cancel: () => void
}

export interface UploadCallbacks {
  onProgress?: (percent: number) => void
}

export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled.')
    this.name = 'UploadCancelledError'
  }
}

/**
 * Upload one file and resolve with the metadata the API needs to persist it.
 */
export function uploadFile(
  workspaceId: string,
  file: File,
  callbacks: UploadCallbacks = {}
): UploadHandle {
  let xhr: XMLHttpRequest | null = null
  let cancelled = false

  const promise = (async (): Promise<AttachmentInput> => {
    const check = checkFile(file)
    if (!check.ok) throw new Error(check.message)

    const { data: uploadConfig } = await api.post<UploadConfigResponse>(
      `/workspaces/${workspaceId}/uploads/sign`,
      { filename: file.name, mimeType: file.type || 'application/octet-stream', fileSize: file.size }
    )

    if (cancelled) throw new UploadCancelledError()

    const form = new FormData()
    form.append('file', file)
    // These three must match what the Worker signed, or Cloudinary rejects it.
    form.append('folder', uploadConfig.folder)
    form.append('api_key', uploadConfig.apiKey)
    form.append('timestamp', String(uploadConfig.timestamp))
    form.append('signature', uploadConfig.signature)

    const result = await new Promise<CloudinaryResponse>((resolve, reject) => {
      xhr = new XMLHttpRequest()
      xhr.open('POST', uploadConfig.endpoint, true)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          callbacks.onProgress?.(Math.round((event.loaded / event.total) * 100))
        }
      }

      xhr.onload = () => {
        let parsed: CloudinaryResponse | null = null
        try {
          parsed = JSON.parse(xhr!.responseText) as CloudinaryResponse
        } catch {
          reject(new Error('Cloudinary returned an unreadable response.'))
          return
        }

        if (xhr!.status >= 200 && xhr!.status < 300 && parsed?.secure_url) {
          resolve(parsed)
        } else {
          reject(new Error(parsed?.error?.message ?? 'The upload was rejected by the storage provider.'))
        }
      }

      xhr.onerror = () => reject(new Error('The upload failed. Check your connection and try again.'))
      xhr.onabort = () => reject(new UploadCancelledError())
      xhr.ontimeout = () => reject(new Error('The upload timed out.'))
      xhr.timeout = 5 * 60 * 1000

      xhr.send(form)
    })

    callbacks.onProgress?.(100)

    return {
      originalFilename: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      cloudinaryPublicId: result.public_id,
      secureUrl: result.secure_url,
      resourceType: (result.resource_type as AttachmentInput['resourceType']) ?? 'auto',
    }
  })()

  return {
    promise,
    cancel: () => {
      cancelled = true
      xhr?.abort()
    },
  }
}
