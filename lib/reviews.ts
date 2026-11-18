import { getDb, makeId, nowIso } from '@/lib/db'
import { ApiError, type SessionUser } from '@/lib/store'
import { optionalText } from '@/lib/validate'

/** تقييمات المنتجات: نجوم 1–5 + تعليق اختياري. العميل بيقيّم المنتج مرة واحدة، ولو قيّمه تاني التقييم بيتحدّث. */
export type Review = { id: string; rating: number; comment: string; userName: string; createdAt: string; mine: boolean }
export type RatingSummary = { avg: number | null; count: number; distribution: number[] }

/** الاسم الأول بس (خصوصية) */
const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'عميل'

export async function getReviews(productId: string, viewerId: string | null, limit = 30): Promise<Review[]> {
  const db = await getDb()
  const rows = await db.all<{ id: string; rating: number; comment: string; createdAt: string; userId: string; name: string }>(
    `SELECT r.id, r.rating, r.comment, r.created_at, r.user_id, u.name
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ? ORDER BY r.created_at DESC LIMIT ?`,
    [productId, limit],
  )
  return rows.map((row) => ({ id: row.id, rating: Number(row.rating), comment: row.comment, userName: firstName(row.name), createdAt: row.createdAt, mine: viewerId !== null && row.userId === viewerId }))
}

export async function getRatingSummary(productId: string): Promise<RatingSummary> {
  const db = await getDb()
  const rows = await db.all<{ rating: number; total: number }>('SELECT rating, COUNT(*) AS total FROM reviews WHERE product_id = ? GROUP BY rating', [productId])
  const distribution = [0, 0, 0, 0, 0]
  let sum = 0
  let count = 0
  for (const row of rows) {
    const stars = Number(row.rating)
    const total = Number(row.total)
    if (stars >= 1 && stars <= 5) distribution[stars - 1] = total
    sum += stars * total
    count += total
  }
  return { avg: count ? Math.round((sum / count) * 10) / 10 : null, count, distribution }
}

export async function saveReview(user: SessionUser, productId: string, input: Record<string, unknown>) {
  if (user.role !== 'user') throw new ApiError(403, 'التقييم متاح لحسابات العملاء بس')
  const rating = Number(input.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(400, 'اختار تقييم من 1 لـ 5 نجوم')
  const comment = optionalText(input.comment, 500)
  const db = await getDb()
  if (!(await db.get('SELECT id FROM products WHERE id = ? AND active = 1', [productId]))) throw new ApiError(404, 'المنتج مش موجود')
  await db.run(
    `INSERT INTO reviews (id, product_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (product_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = excluded.created_at`,
    [makeId(), productId, user.id, rating, comment, nowIso()],
  )
}

/** المالك يمسح أي تقييم (إشراف)، والعميل يمسح تقييمه هو */
export async function deleteReview(actor: SessionUser, id: string) {
  const db = await getDb()
  const review = await db.get<{ userId: string }>('SELECT user_id FROM reviews WHERE id = ?', [id])
  if (!review) throw new ApiError(404, 'التقييم مش موجود')
  if (actor.role !== 'owner' && review.userId !== actor.id) throw new ApiError(403, 'مش مسموحلك تمسح التقييم ده')
  await db.run('DELETE FROM reviews WHERE id = ?', [id])
}
