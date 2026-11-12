import { ApiError } from '@/lib/errors'
import { parseEgyptianPhone } from '@/lib/phone'

export function cleanText(value: unknown, label: string, max = 200) {
  if (typeof value !== 'string') throw new ApiError(400, `${label} مطلوب`)
  const result = value.trim()
  if (!result) throw new ApiError(400, `${label} مطلوب`)
  if (result.length > max) throw new ApiError(400, `${label} طويل أوي (الحد الأقصى ${max} حرف)`)
  return result
}

export function optionalText(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export { normalizeDigits } from '@/lib/phone'

/** رقم موبايل مصري: 01XXXXXXXXX (بنقبل +20 و 0020 كمان) */
export function normalizePhone(value: unknown, label = 'رقم الموبايل') {
  if (typeof value !== 'string') throw new ApiError(400, `${label} مطلوب`)
  const phone = parseEgyptianPhone(value)
  if (!phone) throw new ApiError(400, `${label} مش صحيح — لازم يبقى زي 01012345678`)
  return phone
}

export function optionalEmail(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'شكل الإيميل مش صحيح')
  return email
}

export function cleanUsername(value: unknown) {
  const username = cleanText(value, 'اسم المستخدم', 32).toLowerCase()
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new ApiError(400, 'اسم المستخدم لازم يبقى إنجليزي (حروف وأرقام) من 3 لـ 32 حرف')
  return username
}

export function requirePassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 200) {
    throw new ApiError(400, 'كلمة السر لازم تبقى 8 حروف أو أرقام على الأقل')
  }
  return value
}

/** جنيه -> قرش */
export function toCents(value: unknown, label = 'السعر') {
  const amount = Number(value)
  if (value === '' || value === null || value === undefined || !Number.isFinite(amount) || amount < 0 || amount > 100_000_000) {
    throw new ApiError(400, `${label} مش صحيح`)
  }
  return Math.round(amount * 100)
}

export function toPercent(value: unknown, label = 'نسبة العمولة') {
  const percent = Number(value)
  if (value === '' || value === null || value === undefined || !Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new ApiError(400, `${label} لازم تبقى بين 0 و 100`)
  }
  return Math.round(percent * 100) / 100
}

export function toStock(value: unknown) {
  const stock = Number(value)
  if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) throw new ApiError(400, 'الكمية المتاحة مش صحيحة')
  return stock
}

export function cleanImageUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const url = value.trim().slice(0, 1000)
  if (!/^https:\/\//i.test(url)) throw new ApiError(400, 'رابط الصورة لازم يبدأ بـ https://')
  return url
}

export function cleanImageData(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  if (value.length > 600_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    throw new ApiError(400, 'الصورة مش مقبولة — استخدم صورة JPG أو PNG أو WEBP أصغر')
  }
  return value
}

/** حقل مواصفات اختياري (نص قصير) */
export function optionalSpec(value: unknown, max = 200) {
  const text = optionalText(value, max)
  return text || null
}

/** مدة التوصيل بالأيام: الاتنين مع بعض أو ولا واحد */
export function toDeliveryDays(min: unknown, max: unknown) {
  const empty = (value: unknown) => value === '' || value === null || value === undefined
  if (empty(min) && empty(max)) return { min: null, max: null }
  if (empty(min) || empty(max)) throw new ApiError(400, 'اكتب أقل وأقصى مدة توصيل (أو سيبهم فاضيين)')
  const low = Number(min)
  const high = Number(max)
  if (!Number.isInteger(low) || !Number.isInteger(high) || low < 0 || high > 60 || low > high) {
    throw new ApiError(400, 'مدة التوصيل لازم تبقى أيام صحيحة، والأقل مش أكبر من الأقصى')
  }
  return { min: low, max: high }
}
