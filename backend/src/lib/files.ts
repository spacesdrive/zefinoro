/**
 * The single registry of what may be attached to a transaction.
 *
 * Both the browser and the Worker validate against this list. The browser copy
 * exists purely for fast feedback - this server-side copy is the one that
 * decides whether a row is written, because a client can claim any MIME type it
 * likes. We cross-check the declared MIME against the filename extension so a
 * `payload.exe` renamed to `.png` is rejected on the mismatch even though its
 * declared type looks fine.
 */

export type PreviewKind =
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'text'
  | 'csv'
  | 'json'
  | 'office'
  | 'archive'
  | 'unknown'

export type ResourceType = 'image' | 'video' | 'raw'

export interface FileTypeSpec {
  extensions: string[]
  mimes: string[]
  preview: PreviewKind
  resourceType: ResourceType
  /** Per-type ceiling in bytes. */
  maxBytes: number
}

const MB = 1024 * 1024

export const MAX_FILE_BYTES = 25 * MB
export const MAX_FILES_PER_TRANSACTION = 10

export const FILE_TYPES: FileTypeSpec[] = [
  // --- Images -------------------------------------------------------------
  { extensions: ['png'],  mimes: ['image/png'],  preview: 'image', resourceType: 'image', maxBytes: 10 * MB },
  { extensions: ['jpg', 'jpeg'], mimes: ['image/jpeg'], preview: 'image', resourceType: 'image', maxBytes: 10 * MB },
  { extensions: ['webp'], mimes: ['image/webp'], preview: 'image', resourceType: 'image', maxBytes: 10 * MB },
  { extensions: ['gif'],  mimes: ['image/gif'],  preview: 'image', resourceType: 'image', maxBytes: 10 * MB },
  { extensions: ['svg'],  mimes: ['image/svg+xml'], preview: 'image', resourceType: 'image', maxBytes: 2 * MB },
  { extensions: ['heic', 'heif'], mimes: ['image/heic', 'image/heif'], preview: 'image', resourceType: 'image', maxBytes: 10 * MB },
  { extensions: ['bmp'],  mimes: ['image/bmp'],  preview: 'image', resourceType: 'image', maxBytes: 10 * MB },

  // --- Documents ----------------------------------------------------------
  { extensions: ['pdf'],  mimes: ['application/pdf'], preview: 'pdf', resourceType: 'image', maxBytes: 25 * MB },

  // --- Video / audio ------------------------------------------------------
  { extensions: ['mp4'],  mimes: ['video/mp4'],  preview: 'video', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['webm'], mimes: ['video/webm'], preview: 'video', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['mov'],  mimes: ['video/quicktime'], preview: 'video', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['mp3'],  mimes: ['audio/mpeg'], preview: 'audio', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['wav'],  mimes: ['audio/wav', 'audio/x-wav'], preview: 'audio', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['m4a'],  mimes: ['audio/mp4', 'audio/x-m4a'], preview: 'audio', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['ogg'],  mimes: ['audio/ogg', 'video/ogg'], preview: 'audio', resourceType: 'video', maxBytes: 25 * MB },

  // --- Plain text and data ------------------------------------------------
  { extensions: ['txt', 'md', 'log'], mimes: ['text/plain', 'text/markdown'], preview: 'text', resourceType: 'raw', maxBytes: 5 * MB },
  { extensions: ['csv'],  mimes: ['text/csv', 'application/csv'], preview: 'csv', resourceType: 'raw', maxBytes: 5 * MB },
  { extensions: ['json'], mimes: ['application/json', 'text/json'], preview: 'json', resourceType: 'raw', maxBytes: 5 * MB },

  // --- Office -------------------------------------------------------------
  { extensions: ['doc'],  mimes: ['application/msword'], preview: 'office', resourceType: 'raw', maxBytes: 25 * MB },
  {
    extensions: ['docx'],
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    preview: 'office', resourceType: 'raw', maxBytes: 25 * MB,
  },
  { extensions: ['xls'],  mimes: ['application/vnd.ms-excel'], preview: 'office', resourceType: 'raw', maxBytes: 25 * MB },
  {
    extensions: ['xlsx'],
    mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    preview: 'office', resourceType: 'raw', maxBytes: 25 * MB,
  },
  { extensions: ['ppt'],  mimes: ['application/vnd.ms-powerpoint'], preview: 'office', resourceType: 'raw', maxBytes: 25 * MB },
  {
    extensions: ['pptx'],
    mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    preview: 'office', resourceType: 'raw', maxBytes: 25 * MB,
  },

  // --- Archives -----------------------------------------------------------
  { extensions: ['zip'], mimes: ['application/zip', 'application/x-zip-compressed'], preview: 'archive', resourceType: 'raw', maxBytes: 25 * MB },
]

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot < 0 || dot === filename.length - 1) return ''
  return filename.slice(dot + 1).toLowerCase()
}

export function findSpecByExtension(ext: string): FileTypeSpec | undefined {
  return FILE_TYPES.find((spec) => spec.extensions.includes(ext.toLowerCase()))
}

export function findSpecByMime(mime: string): FileTypeSpec | undefined {
  const normalized = mime.toLowerCase().split(';')[0]?.trim() ?? ''
  return FILE_TYPES.find((spec) => spec.mimes.includes(normalized))
}

export interface FileValidationInput {
  filename: string
  mimeType: string
  size: number
}

export type FileValidationResult =
  | { ok: true; spec: FileTypeSpec }
  | { ok: false; code: string; message: string }

/**
 * Validate extension, MIME and size together. All three must agree.
 */
export function validateFile(input: FileValidationInput): FileValidationResult {
  const { filename, mimeType, size } = input

  if (!filename || filename.length > 255) {
    return { ok: false, code: 'FILE_NAME_INVALID', message: 'That filename is not valid.' }
  }

  // Reject path separators, traversal segments and control characters.
  // Spaces and unicode are fine - receipts get named "Rent - March.pdf".
  if (/[/\\]/.test(filename) || /[\u0000-\u001f]/.test(filename) || filename.includes("..")) {
    return { ok: false, code: 'FILE_NAME_INVALID', message: 'That filename contains illegal characters.' }
  }

  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, code: 'FILE_EMPTY', message: 'That file appears to be empty.' }
  }

  if (size > MAX_FILE_BYTES) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: `Files must be ${Math.floor(MAX_FILE_BYTES / MB)} MB or smaller.`,
    }
  }

  const ext = extensionOf(filename)
  const byExt = findSpecByExtension(ext)
  if (!byExt) {
    return {
      ok: false,
      code: 'FILE_TYPE_UNSUPPORTED',
      message: ext ? `.${ext} files are not supported.` : 'That file type is not supported.',
    }
  }

  const byMime = findSpecByMime(mimeType)
  if (!byMime) {
    return { ok: false, code: 'FILE_TYPE_UNSUPPORTED', message: 'That file type is not supported.' }
  }

  // The extension and the declared MIME must resolve to the same spec.
  if (byExt !== byMime) {
    return {
      ok: false,
      code: 'FILE_TYPE_MISMATCH',
      message: 'That file’s contents do not match its extension.',
    }
  }

  if (size > byExt.maxBytes) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: `.${ext} files must be ${Math.floor(byExt.maxBytes / MB)} MB or smaller.`,
    }
  }

  return { ok: true, spec: byExt }
}

export function previewKindFor(mimeType: string, filename: string): PreviewKind {
  return (findSpecByMime(mimeType) ?? findSpecByExtension(extensionOf(filename)))?.preview ?? 'unknown'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

/** Everything the file picker should advertise in its `accept` attribute. */
export const ACCEPT_ATTRIBUTE = FILE_TYPES.flatMap((spec) => [
  ...spec.extensions.map((e) => `.${e}`),
  ...spec.mimes,
]).join(',')
