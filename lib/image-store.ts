import { createHash } from 'node:crypto'
import type { Db } from '@/lib/db'
import { ApiError } from '@/lib/errors'

/**
 * طبقة تخزين الصور.
 *  - لو BLOB_READ_WRITE_TOKEN متضبط (Vercel Blob): الصورة بتتحوّل WebP بـ 3 أحجام وتتخزن برا الداتابيز،
 *    والمنتج بيخزّن رابط النسخة 800 بس. اسم الملف بينتهي بـ -800.webp، ومحمّل الصور (lib/image-loader.ts)
 *    بيبدّل الرقم للحجم المناسب للشاشة من غير ما نخزّن أي حاجة زيادة.
 *  - لو مش متضبط: الصور بتفضل base64 في الداتابيز زي ما كانت، والصور القديمة كلها شغالة.
 *    وفي الحالتين مسار /api/products/:id/image بيقدّم WebP مصغّر حسب ?w= مع كاش طويل.
 */
export const IMAGE_WIDTHS = [480, 800, 1200] as const
export type ImageWidth = (typeof IMAGE_WIDTHS)[number]

const token = () => process.env.BLOB_READ_WRITE_TOKEN || ''
export const imageStoreEnabled = () => Boolean(token())

/** أقرب حجم مسموح (بنمنع أي عرض عشوائي عشان الكاش ميتملاش) */
export function snapWidth(value: unknown): ImageWidth {
  const wanted = Number(value)
  if (!Number.isFinite(wanted)) return 800
  return IMAGE_WIDTHS.find((width) => width >= wanted) ?? 1200
}

async function loadSharp() {
  try {
    return (await import('sharp')).default
  } catch {
    return null
  }
}

export function parseDataUrl(value: string | null | undefined) {
  const match = value?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  return match ? { contentType: match[1], body: Buffer.from(match[2], 'base64') } : null
}

async function toWebp(source: Buffer, width: number) {
  const sharp = await loadSharp()
  if (!sharp) return null
  return sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
}

/** نسخة مصغّرة WebP للمسار القديم؛ لو sharp مش متاح بيرجّع الأصلي زي ما هو */
export async function resizeLegacyImage(image: { contentType: string; body: Buffer }, width: ImageWidth) {
  try {
    const webp = await toWebp(image.body, width)
    if (webp) return { contentType: 'image/webp', body: webp }
  } catch (error) {
    console.error('[rtx-shop-images] resize failed', error)
  }
  return image
}

async function uploadVariants(productId: string, source: Buffer) {
  const { put } = await import('@vercel/blob')
  const hash = createHash('sha1').update(source).digest('hex').slice(0, 10)
  let main = ''
  for (const width of IMAGE_WIDTHS) {
    const webp = await toWebp(source, width)
    if (!webp) throw new Error('sharp مش متاح')
    const result = await put(`products/${productId}-${hash}-${width}.webp`, webp, {
      access: 'public',
      contentType: 'image/webp',
      token: token(),
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    if (width === 800) main = result.url
  }
  return main
}

/** بيحدد فين الصورة تتخزن: مخزن الصور لو متاح، وإلا زي الأول (base64 في الداتابيز) */
export async function storeUploadedImage(productId: string, imageData: string | null, imageUrl: string | null) {
  if (imageData && imageStoreEnabled()) {
    const parsed = parseDataUrl(imageData)
    if (parsed) {
      try {
        return { imageUrl: await uploadVariants(productId, parsed.body), imageData: null as string | null }
      } catch (error) {
        console.error('[rtx-shop-images] upload failed, keeping base64', error)
      }
    }
  }
  return { imageUrl: imageData ? null : imageUrl, imageData }
}

/** نقل دفعة من الصور القديمة (base64) لمخزن الصور. آمن للتكرار، والصورة القديمة بتفضل شغالة لحد ما تتنقل. */
export async function migrateLegacyImages(db: Db, batch: number) {
  if (!imageStoreEnabled()) throw new ApiError(400, 'مخزن الصور مش متضبط — ضيف BLOB_READ_WRITE_TOKEN الأول')
  const rows = await db.all<{ id: string; imageData: string }>('SELECT id, image_data FROM products WHERE image_data IS NOT NULL LIMIT ?', [batch])
  let migrated = 0
  const failed: string[] = []
  for (const row of rows) {
    const parsed = parseDataUrl(row.imageData)
    if (!parsed) { failed.push(row.id); continue }
    try {
      const url = await uploadVariants(row.id, parsed.body)
      await db.run('UPDATE products SET image_url = ?, image_data = NULL WHERE id = ? AND image_data IS NOT NULL', [url, row.id])
      migrated += 1
    } catch (error) {
      console.error('[rtx-shop-images] migrate failed', row.id, error)
      failed.push(row.id)
    }
  }
  const left = await db.get<{ total: number }>('SELECT COUNT(*) AS total FROM products WHERE image_data IS NOT NULL')
  return { migrated, failed: failed.length, remaining: Number(left?.total ?? 0) }
}
