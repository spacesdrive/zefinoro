import { describe, expect, it } from 'vitest'
import { extensionOf, formatBytes, previewKindFor, validateFile } from '../src/lib/files'

const MB = 1024 * 1024

describe('validateFile', () => {
  it('accepts an ordinary receipt image', () => {
    const result = validateFile({ filename: 'receipt.png', mimeType: 'image/png', size: 120_000 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.spec.resourceType).toBe('image')
  })

  it('accepts filenames containing spaces and unicode', () => {
    expect(validateFile({ filename: 'Rent - March 2026.pdf', mimeType: 'application/pdf', size: 5000 }).ok).toBe(true)
    expect(validateFile({ filename: 'reçu café.jpg', mimeType: 'image/jpeg', size: 5000 }).ok).toBe(true)
  })

  it('rejects an executable disguised with an image extension', () => {
    // The extension says png, the declared type says otherwise: the two must agree.
    const result = validateFile({
      filename: 'payload.png',
      mimeType: 'application/x-msdownload',
      size: 1000,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FILE_TYPE_UNSUPPORTED')
  })

  it('rejects a mismatch between a supported extension and a supported MIME', () => {
    const result = validateFile({ filename: 'invoice.pdf', mimeType: 'image/png', size: 1000 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FILE_TYPE_MISMATCH')
  })

  it('rejects path separators and traversal in the filename', () => {
    for (const filename of ['../../etc/passwd.png', 'a/b.png', 'a\\b.png']) {
      const result = validateFile({ filename, mimeType: 'image/png', size: 1000 })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('FILE_NAME_INVALID')
    }
  })

  it('rejects unsupported types outright', () => {
    const result = validateFile({ filename: 'thing.exe', mimeType: 'application/x-msdownload', size: 1000 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FILE_TYPE_UNSUPPORTED')
  })

  it('enforces the global ceiling', () => {
    const result = validateFile({ filename: 'huge.mp4', mimeType: 'video/mp4', size: 30 * MB })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FILE_TOO_LARGE')
  })

  it('enforces the tighter per-type ceiling for SVG', () => {
    const result = validateFile({ filename: 'big.svg', mimeType: 'image/svg+xml', size: 4 * MB })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FILE_TOO_LARGE')
  })

  it('rejects empty files', () => {
    const result = validateFile({ filename: 'empty.png', mimeType: 'image/png', size: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FILE_EMPTY')
  })

  it('ignores MIME parameters such as charset', () => {
    expect(validateFile({ filename: 'notes.csv', mimeType: 'text/csv; charset=utf-8', size: 500 }).ok).toBe(true)
  })
})

describe('previewKindFor', () => {
  it('maps types to the renderer the browser can actually use', () => {
    expect(previewKindFor('image/png', 'a.png')).toBe('image')
    expect(previewKindFor('application/pdf', 'a.pdf')).toBe('pdf')
    expect(previewKindFor('video/mp4', 'a.mp4')).toBe('video')
    expect(previewKindFor('audio/mpeg', 'a.mp3')).toBe('audio')
    expect(previewKindFor('text/csv', 'a.csv')).toBe('csv')
    expect(previewKindFor('application/json', 'a.json')).toBe('json')
    expect(previewKindFor('application/zip', 'a.zip')).toBe('archive')
  })

  it('falls back to unknown for types with no in-browser renderer', () => {
    expect(previewKindFor('application/x-foo', 'a.foo')).toBe('unknown')
  })
})

describe('extensionOf', () => {
  it('takes the last segment and lowercases it', () => {
    expect(extensionOf('archive.tar.GZ')).toBe('gz')
  })

  it('returns empty for names with no extension', () => {
    expect(extensionOf('README')).toBe('')
    expect(extensionOf('trailing.')).toBe('')
  })
})

describe('formatBytes', () => {
  it('formats across unit boundaries', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * MB)).toBe('5.0 MB')
  })
})
