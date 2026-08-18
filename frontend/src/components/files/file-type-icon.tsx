import {
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  File as FileIcon,
} from 'lucide-react'
import type { PreviewKind } from '@/types'
import { previewKindOf } from '@/lib/files'
import { cn } from '@/lib/utils'

const ICONS: Record<PreviewKind, typeof FileIcon> = {
  image: FileImage,
  pdf: FileText,
  video: FileVideo,
  audio: FileAudio,
  text: FileText,
  csv: FileSpreadsheet,
  json: FileCode,
  office: FileSpreadsheet,
  archive: FileArchive,
  unknown: FileIcon,
}

/** Colour carries meaning here, so each family stays visually distinct. */
const TONES: Record<PreviewKind, string> = {
  image: 'text-violet-500',
  pdf: 'text-red-500',
  video: 'text-blue-500',
  audio: 'text-amber-500',
  text: 'text-slate-500',
  csv: 'text-emerald-500',
  json: 'text-orange-500',
  office: 'text-sky-500',
  archive: 'text-yellow-600',
  unknown: 'text-muted-foreground',
}

interface FileTypeIconProps {
  mimeType: string
  filename: string
  className?: string
  /** Set false inside an already-coloured surface such as a destructive row. */
  colored?: boolean
}

export function FileTypeIcon({ mimeType, filename, className, colored = true }: FileTypeIconProps) {
  const kind = previewKindOf(mimeType, filename)
  const Icon = ICONS[kind]

  return <Icon className={cn('size-4 shrink-0', colored && TONES[kind], className)} aria-hidden="true" />
}
