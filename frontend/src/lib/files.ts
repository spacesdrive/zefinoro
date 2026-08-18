import type { PreviewKind } from '@/types'

/**
 * Client-side mirror of the Worker's file registry (`backend/src/lib/files.ts`).
 *
 * This copy exists to give immediate feedback in the picker - it is a
 * convenience, not a control. The server re-validates every attachment, so the
 * two lists must be kept in step but only the server's answer is binding.
 */

export type ResourceType = 'image' | 'video' | 'raw'

export interface FileTypeSpec {
  extensions: string[]
  mimes: string[]
  preview: PreviewKind
  resourceType: ResourceType
  maxBytes: number
}

const MB = 1024 * 1024

export const MAX_FILE_BYTES = 25 * MB
export const MAX_FILES_PER_TRANSACTION = 10

export const FILE_TYPES: FileTypeSpec[] = [
  { extensions: ['png'], mimes: ['image/png'], preview: 'image', resourceType: 'image', maxBytes: 10 * MB },
  { extensions: ['jpg', 'jpeg'], mimes: ['image/jpeg'], preview: 'image', resourceType: 'image', maxBytes: 10 * MB },
  { extensions: ['webp'], mimes: ['image/webp'], preview: 'image', resourceType: 'image', maxBytes: 10 * MB },
  { extensions: ['gif'], mimes: ['image/gif'], preview: 'image', resourceType: 'image', maxBytes: 10 * MB },
  { extensions: ['svg'], mimes: ['image/svg+xml'], preview: 'image', resourceType: 'image', maxBytes: 2 * MB },
  { extensions: ['heic', 'heif'], mimes: ['image/heic', 'image/heif'], preview: 'image', resourceType: 'image', maxBytes: 10 * MB },
  { extensions: ['bmp'], mimes: ['image/bmp'], preview: 'image', resourceType: 'image', maxBytes: 10 * MB },

  { extensions: ['pdf'], mimes: ['application/pdf'], preview: 'pdf', resourceType: 'image', maxBytes: 25 * MB },

  { extensions: ['mp4'], mimes: ['video/mp4'], preview: 'video', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['webm'], mimes: ['video/webm'], preview: 'video', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['mov'], mimes: ['video/quicktime'], preview: 'video', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['mp3'], mimes: ['audio/mpeg'], preview: 'audio', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['wav'], mimes: ['audio/wav', 'audio/x-wav'], preview: 'audio', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['m4a'], mimes: ['audio/mp4', 'audio/x-m4a'], preview: 'audio', resourceType: 'video', maxBytes: 25 * MB },
  { extensions: ['ogg'], mimes: ['audio/ogg', 'video/ogg'], preview: 'audio', resourceType: 'video', maxBytes: 25 * MB },

  { extensions: ['txt', 'md', 'log'], mimes: ['text/plain', 'text/markdown'], preview: 'text', resourceType: 'raw', maxBytes: 5 * MB },
  { extensions: ['csv'], mimes: ['text/csv', 'application/csv'], preview: 'csv', resourceType: 'raw', maxBytes: 5 * MB },
  { extensions: ['json'], mimes: ['application/json', 'text/json'], preview: 'json', resourceType: 'raw', maxBytes: 5 * MB },

  { extensions: ['doc'], mimes: ['application/msword'], preview: 'office', resourceType: 'raw', maxBytes: 25 * MB },
  {
    extensions: ['docx'],
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    preview: 'office', resourceType: 'raw', maxBytes: 25 * MB,
  },
  { extensions: ['xls'], mimes: ['application/vnd.ms-excel'], preview: 'office', resourceType: 'raw', maxBytes: 25 * MB },
  {
    extensions: ['xlsx'],
    mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    preview: 'office', resourceType: 'raw', maxBytes: 25 * MB,
  },
  { extensions: ['ppt'], mimes: ['application/vnd.ms-powerpoint'], preview: 'office', resourceType: 'raw', maxBytes: 25 * MB },
  {
    extensions: ['pptx'],
    mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    preview: 'office', resourceType: 'raw', maxBytes: 25 * MB,
  },

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

export type FileCheck = { ok: true; spec: FileTypeSpec } | { ok: false; message: string }

export function checkFile(file: File): FileCheck {
  if (file.size <= 0) return { ok: false, message: 'That file appears to be empty.' }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: `Files must be ${Math.floor(MAX_FILE_BYTES / MB)} MB or smaller.` }
  }

  const ext = extensionOf(file.name)
  const spec = findSpecByExtension(ext)
  if (!spec) {
    return { ok: false, message: ext ? `.${ext} files are not supported.` : 'That file type is not supported.' }
  }

  // Browsers occasionally report an empty type for less common formats; the
  // extension is trusted in that case and the server makes the final call.
  if (file.type && findSpecByMime(file.type) !== spec) {
    return { ok: false, message: 'That file does not match its extension.' }
  }

  if (file.size > spec.maxBytes) {
    return { ok: false, message: `.${ext} files must be ${Math.floor(spec.maxBytes / MB)} MB or smaller.` }
  }

  return { ok: true, spec }
}

export function previewKindOf(mimeType: string, filename: string): PreviewKind {
  return (findSpecByMime(mimeType) ?? findSpecByExtension(extensionOf(filename)))?.preview ?? 'unknown'
}

export const ACCEPT_ATTRIBUTE = FILE_TYPES.flatMap((spec) => spec.extensions.map((e) => `.${e}`)).join(',')

/** A short, human label for a file type, e.g. "PDF document". */
export function fileTypeLabel(mimeType: string, filename: string): string {
  const ext = extensionOf(filename).toUpperCase()
  const kind = previewKindOf(mimeType, filename)
  const labels: Record<PreviewKind, string> = {
    image: 'Image',
    pdf: 'PDF document',
    video: 'Video',
    audio: 'Audio',
    text: 'Text file',
    csv: 'Spreadsheet (CSV)',
    json: 'JSON file',
    office: 'Office document',
    archive: 'Archive',
    unknown: 'File',
  }
  return ext ? `${ext} · ${labels[kind]}` : labels[kind]
}
