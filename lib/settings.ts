import { getDb, type Db } from '@/lib/db'
import { ApiError } from '@/lib/errors'
import { parseCairoLocalInput, resolveFlashEnd, toCairoLocalInput } from '@/lib/flash'
import { toCents } from '@/lib/validate'

/**
 * إعدادات المتجر (شحن مجاني + موعد عروض النهارده). متخزنة في جدول meta الموجود (key/value)
 * فمفيش جدول جديد ولا migration مطلوب.
 */
const KEY_FREE_SHIPPING = 'setting_free_shipping_cents'
const KEY_FLASH_END = 'setting_flash_ends_at'

export type StoreSettings = { freeShippingThresholdCents: number | null; flashSaleEndsAt: string | null }

export async function readSettings(db?: Db): Promise<StoreSettings> {
  const conn = db ?? (await getDb())
  const rows = await conn.all<{ key: string; value: string }>('SELECT key, value FROM meta WHERE key IN (?, ?)', [KEY_FREE_SHIPPING, KEY_FLASH_END])
  const byKey = new Map(rows.map((row) => [row.key, row.value]))
  const threshold = Number(byKey.get(KEY_FREE_SHIPPING))
  return {
    freeShippingThresholdCents: Number.isFinite(threshold) && threshold > 0 ? threshold : null,
    flashSaleEndsAt: byKey.get(KEY_FLASH_END) ?? null,
  }
}

/** اللي بيتبعت للمتصفح مع الكتالوج */
export async function getPublicSettings(db?: Db) {
  const saved = await readSettings(db)
  const now = new Date()
  return {
    freeShippingThresholdCents: saved.freeShippingThresholdCents,
    flashEndsAt: resolveFlashEnd(saved.flashSaleEndsAt, now),
    serverNow: now.toISOString(),
  }
}

/** اللي بتشوفه لوحة التحكم (القيم المحفوظة نفسها، مش المحسوبة) */
export async function getAdminSettings() {
  const saved = await readSettings()
  return {
    freeShippingThresholdCents: saved.freeShippingThresholdCents,
    flashSaleEndsAt: saved.flashSaleEndsAt,
    flashSaleEndsAtLocal: saved.flashSaleEndsAt ? toCairoLocalInput(saved.flashSaleEndsAt) : '',
  }
}

const isEmpty = (value: unknown) => value === '' || value === null

async function put(db: Db, key: string, value: string | null) {
  if (value === null) await db.run('DELETE FROM meta WHERE key = ?', [key])
  else await db.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, value])
}

/** بيحدّث بس اللي مبعوت. قيمة فاضية = إلغاء الإعداد. */
export async function updateSettings(input: Record<string, unknown>) {
  const db = await getDb()
  if ('freeShippingThreshold' in input) {
    if (isEmpty(input.freeShippingThreshold)) {
      await put(db, KEY_FREE_SHIPPING, null)
    } else {
      const cents = toCents(input.freeShippingThreshold, 'حد الشحن المجاني')
      if (cents <= 0) throw new ApiError(400, 'حد الشحن المجاني لازم يبقى أكبر من صفر (أو سيبه فاضي لإلغاء الشحن المجاني)')
      await put(db, KEY_FREE_SHIPPING, String(cents))
    }
  }
  if ('flashEndsAt' in input) {
    if (isEmpty(input.flashEndsAt)) {
      await put(db, KEY_FLASH_END, null)
    } else {
      const date = typeof input.flashEndsAt === 'string' ? parseCairoLocalInput(input.flashEndsAt) : null
      if (!date) throw new ApiError(400, 'موعد انتهاء العرض مش صحيح')
      if (date.getTime() <= Date.now()) throw new ApiError(400, 'موعد انتهاء العرض لازم يبقى في المستقبل')
      await put(db, KEY_FLASH_END, date.toISOString())
    }
  }
  return getAdminSettings()
}
