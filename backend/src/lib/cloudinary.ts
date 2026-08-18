import type { Bindings } from '../types/env'
import { ApiError } from './errors'

/**
 * Cloudinary integration.
 *
 * Uploads go browser -> Cloudinary directly (never proxied through the Worker),
 * so a 25 MiB video does not have to fit in a Worker's memory or request limit.
 * The Worker's job is to (a) hand out short-lived upload signatures, and
 * (b) record the resulting asset metadata in Postgres after re-validating it.
 * Destructive calls are always signed and server-side.
 */

export type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto'

export interface CloudinaryUploadResult {
  public_id: string
  secure_url: string
  resource_type: string
  bytes: number
  format?: string
  original_filename?: string
}

export interface SignaturePayload {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
}

function requireConfig(env: Bindings) {
  const cloudName = env.CLOUDINARY_CLOUD_NAME
  if (!cloudName) {
    throw ApiError.internal('File storage is not configured.', 'CLOUDINARY_NOT_CONFIGURED')
  }
  return { cloudName }
}

async function sha1Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Cloudinary signs the alphabetically-sorted, `&`-joined parameter string with
 * the API secret appended.
 */
export async function signParams(
  params: Record<string, string | number>,
  apiSecret: string
): Promise<string> {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return sha1Hex(`${toSign}${apiSecret}`)
}

/**
 * Whether derived (transformed) delivery URLs may be used on this cloud.
 * Off unless explicitly enabled - see the note in `serializeAttachment`.
 */
export function transformsAllowed(env: Bindings): boolean {
  return env.CLOUDINARY_ENABLE_TRANSFORMS === 'true'
}

/**
 * Issue a short-lived signature for a direct browser upload, scoped to a
 * workspace folder. Requires the API key/secret pair.
 */
export async function createUploadSignature(
  env: Bindings,
  workspaceId: string
): Promise<SignaturePayload> {
  const { cloudName } = requireConfig(env)
  const apiKey = env.CLOUDINARY_API_KEY
  const apiSecret = env.CLOUDINARY_API_SECRET

  if (!apiKey || !apiSecret) {
    throw ApiError.internal('File storage is not fully configured.', 'CLOUDINARY_NOT_CONFIGURED')
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = `zefinoro/${workspaceId}`

  // Only the folder and timestamp are signed; Cloudinary rejects the upload if
  // the client alters either.
  const signature = await signParams({ folder, timestamp }, apiSecret)
  return { signature, timestamp, apiKey, cloudName, folder }
}

/**
 * Delete an asset. Requires signed credentials; when they are absent the caller
 * is told so it can still drop the database row rather than fail the request.
 */
export async function deleteFile(
  env: Bindings,
  publicId: string,
  resourceType: CloudinaryResourceType = 'image'
): Promise<{ deleted: boolean; reason?: string }> {
  const { cloudName } = requireConfig(env)
  const apiKey = env.CLOUDINARY_API_KEY
  const apiSecret = env.CLOUDINARY_API_SECRET

  if (!apiKey || !apiSecret) {
    return { deleted: false, reason: 'CLOUDINARY_NOT_CONFIGURED' }
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const signature = await signParams({ public_id: publicId, timestamp }, apiSecret)

  const type = resourceType === 'auto' ? 'image' : resourceType
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  })

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${type}/destroy`,
    { method: 'POST', body }
  )

  if (!res.ok) {
    return { deleted: false, reason: `HTTP_${res.status}` }
  }

  const json = (await res.json()) as { result?: string }
  return { deleted: json.result === 'ok' || json.result === 'not found' }
}

/**
 * Sanitise a filename for use inside `fl_attachment:<name>`.
 *
 * The value sits in a transformation path segment, so anything Cloudinary uses
 * as a delimiter breaks the URL. A dot is the surprising one: passing
 * "receipt.png" returns 400, because the extension terminates the segment.
 * Cloudinary appends the correct extension itself, so the stem is all it wants.
 */
function attachmentName(filename: string): string {
  const dot = filename.lastIndexOf('.')
  const stem = dot > 0 ? filename.slice(0, dot) : filename
  return stem
    .replace(/[^\w\-. ]+/g, '')  // strip separators and anything exotic
    .replace(/[.\s]+/g, '_')     // no dots or spaces inside the segment
    .slice(0, 100)
}

/**
 * Build a delivery URL with optional transformations.
 *
 * `raw` assets cannot be transformed, and `fl_attachment` is what turns a
 * delivery URL into a download rather than an inline render.
 */
export function buildDeliveryUrl(
  cloudName: string,
  publicId: string,
  resourceType: CloudinaryResourceType,
  options: { download?: boolean; transformation?: string; filename?: string } = {}
): string {
  const type = resourceType === 'auto' ? 'image' : resourceType
  const segments = [`https://res.cloudinary.com/${cloudName}/${type}/upload`]

  const transforms: string[] = []
  if (options.transformation && type !== 'raw') transforms.push(options.transformation)
  if (options.download) {
    const name = options.filename ? attachmentName(options.filename) : ''
    transforms.push(name ? `fl_attachment:${name}` : 'fl_attachment')
  }
  if (transforms.length) segments.push(transforms.join('/'))

  segments.push(publicId)
  return segments.join('/')
}

/** A small, cheap thumbnail for image attachments in lists. */
export function getThumbnailUrl(cloudName: string, publicId: string, size = 96): string {
  return buildDeliveryUrl(cloudName, publicId, 'image', {
    transformation: `c_fill,w_${size},h_${size},q_auto,f_auto`,
  })
}

/**
 * First page of a PDF, rendered to a JPEG thumbnail.
 *
 * Worth having for its own sake, but it also sidesteps Cloudinary's "Allow
 * delivery of PDF and ZIP files" security setting: that blocks serving the
 * *PDF*, while a rendered raster page is an ordinary image and is delivered
 * normally. So the attachment list still shows a real preview even on an
 * account where PDF delivery is switched off.
 *
 * Requires the asset to have been uploaded as `resource_type: image`; a `raw`
 * upload is an opaque blob that Cloudinary will not rasterise.
 */
export function getPdfThumbnailUrl(cloudName: string, publicId: string, size = 96): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,w_${size},h_${size},pg_1,f_jpg,q_auto/${publicId}.jpg`
}

export function getPreviewUrl(
  cloudName: string,
  publicId: string,
  resourceType: CloudinaryResourceType,
  format?: string
): string {
  // A PDF is stored as an image resource but must be delivered untouched: an
  // f_auto/c_limit transformation would rasterise it into a picture of page one
  // and the embedded viewer would lose its pages, text and links.
  if (format === 'pdf') {
    return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}.pdf`
  }
  if (resourceType === 'image') {
    return buildDeliveryUrl(cloudName, publicId, 'image', {
      transformation: 'c_limit,w_1600,q_auto,f_auto',
    })
  }
  return buildDeliveryUrl(cloudName, publicId, resourceType)
}

export function getDownloadUrl(
  cloudName: string,
  publicId: string,
  resourceType: CloudinaryResourceType,
  filename?: string
): string {
  return buildDeliveryUrl(cloudName, publicId, resourceType, { download: true, filename })
}

/**
 * Confirm an asset really exists in our cloud before trusting client-supplied
 * metadata. Uses the public delivery URL, so it works without API credentials.
 */
export function isOwnedCloudinaryUrl(env: Bindings, url: string): boolean {
  const cloudName = env.CLOUDINARY_CLOUD_NAME
  if (!cloudName) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    if (host !== 'res.cloudinary.com' && !host.endsWith('.cloudinary.com')) return false
    return parsed.pathname.startsWith(`/${cloudName}/`)
  } catch {
    return false
  }
}
