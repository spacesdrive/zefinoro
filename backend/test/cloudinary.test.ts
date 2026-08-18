import { describe, expect, it } from 'vitest'
import {
  buildDeliveryUrl,
  getDownloadUrl,
  getPdfThumbnailUrl,
  getPreviewUrl,
  getThumbnailUrl,
  isOwnedCloudinaryUrl,
} from '../src/lib/cloudinary'
import type { Bindings } from '../src/types/env'

const CLOUD = 'dbh4azua9'
const env = { CLOUDINARY_CLOUD_NAME: CLOUD } as unknown as Bindings

describe('getDownloadUrl', () => {
  it('drops the extension from fl_attachment', () => {
    // Cloudinary returns 400 for `fl_attachment:receipt.png` - the dot
    // terminates the transformation segment. It re-adds the extension itself.
    const url = getDownloadUrl(CLOUD, 'zefinoro/ws/abc', 'image', 'receipt.png')
    expect(url).toContain('fl_attachment:receipt')
    expect(url).not.toContain('fl_attachment:receipt.png')
  })

  it('replaces inner dots and spaces, which would also break the segment', () => {
    const url = getDownloadUrl(CLOUD, 'zefinoro/ws/abc', 'image', 'Rent March 2026.final.pdf')
    const flag = url.split('/').find((s) => s.startsWith('fl_attachment:'))!
    expect(flag).toBe('fl_attachment:Rent_March_2026_final')
  })

  it('strips path separators and other delimiters', () => {
    const url = getDownloadUrl(CLOUD, 'zefinoro/ws/abc', 'image', 'a/b,c:d.png')
    const flag = url.split('/').find((s) => s.startsWith('fl_attachment:'))!
    expect(flag).toBe('fl_attachment:abcd')
  })

  it('falls back to a bare flag when nothing usable survives', () => {
    const url = getDownloadUrl(CLOUD, 'zefinoro/ws/abc', 'image', '///.png')
    expect(url).toContain('/fl_attachment/')
  })
})

describe('buildDeliveryUrl', () => {
  it('never transforms raw assets', () => {
    const url = buildDeliveryUrl(CLOUD, 'zefinoro/ws/doc', 'raw', { transformation: 'c_limit,w_100' })
    expect(url).not.toContain('c_limit')
    expect(url).toContain('/raw/upload/')
  })

  it('places the transformation before the public id', () => {
    expect(getThumbnailUrl(CLOUD, 'zefinoro/ws/img')).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,w_96,h_96,q_auto,f_auto/zefinoro/ws/img`
    )
  })
})

describe('isOwnedCloudinaryUrl', () => {
  it('accepts our own cloud over https', () => {
    expect(isOwnedCloudinaryUrl(env, `https://res.cloudinary.com/${CLOUD}/image/upload/x.png`)).toBe(true)
  })

  it('rejects another account, plain http, and unrelated hosts', () => {
    expect(isOwnedCloudinaryUrl(env, 'https://res.cloudinary.com/someoneelse/image/upload/x.png')).toBe(false)
    expect(isOwnedCloudinaryUrl(env, `http://res.cloudinary.com/${CLOUD}/image/upload/x.png`)).toBe(false)
    expect(isOwnedCloudinaryUrl(env, `https://evil.example.com/${CLOUD}/image/upload/x.png`)).toBe(false)
    expect(isOwnedCloudinaryUrl(env, 'not-a-url')).toBe(false)
  })

  it('rejects a lookalike host that merely ends with the cloud name', () => {
    expect(isOwnedCloudinaryUrl(env, `https://res.cloudinary.com.evil.com/${CLOUD}/x.png`)).toBe(false)
  })
})

describe('PDF handling', () => {
  it('delivers a PDF untransformed so the viewer keeps its pages', () => {
    // f_auto/c_limit would rasterise the file into a picture of page one.
    const url = getPreviewUrl(CLOUD, 'zefinoro/ws/doc', 'image', 'pdf')
    expect(url).toBe(`https://res.cloudinary.com/${CLOUD}/image/upload/zefinoro/ws/doc.pdf`)
    expect(url).not.toContain('c_limit')
    expect(url).not.toContain('f_auto')
  })

  it('still resizes ordinary images', () => {
    expect(getPreviewUrl(CLOUD, 'zefinoro/ws/img', 'image')).toContain('c_limit,w_1600')
  })

  it('renders page one as a JPEG for the list thumbnail', () => {
    // A rasterised page is an ordinary image, so it is delivered even when
    // Cloudinary's "allow delivery of PDF and ZIP" setting is off.
    const url = getPdfThumbnailUrl(CLOUD, 'zefinoro/ws/doc')
    expect(url).toContain('pg_1')
    expect(url).toContain('f_jpg')
    expect(url).toMatch(/\.jpg$/)
  })
})
