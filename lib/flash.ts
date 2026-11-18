/**
 * منطق وقت «عروض النهارده» (بتوقيت القاهرة). دوال نقية بتشتغل في السيرفر والمتصفح.
 *  - لو المالك حدّد موعد انتهاء: بيتستخدم لحد ما يعدّي.
 *  - لو مفيش موعد متحدد: العرض بينتهي منتصف الليل بتوقيت القاهرة كل يوم.
 */
const CAIRO = 'Africa/Cairo'

function cairoParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAIRO, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute'), s: get('second') }
}

/** فرق التوقيت بين القاهرة و UTC (بالمللي ثانية) عند لحظة معينة — بيراعي التوقيت الصيفي */
function cairoOffsetMs(date: Date) {
  const p = cairoParts(date)
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000
}

/** وقت محلي بتوقيت القاهرة ← لحظة حقيقية */
function cairoLocalToDate(y: number, m: number, d: number, h: number, mi: number) {
  const guess = Date.UTC(y, m - 1, d, h, mi)
  const first = guess - cairoOffsetMs(new Date(guess))
  return new Date(guess - cairoOffsetMs(new Date(first)))
}

/** منتصف الليل التالي بتوقيت القاهرة */
export function nextCairoMidnight(now: Date) {
  const p = cairoParts(now)
  return cairoLocalToDate(p.y, p.m, p.d + 1, 0, 0)
}

/** "2026-11-07T23:59" (بتوقيت القاهرة) ← Date، أو null لو الصيغة غلط */
export function parseCairoLocalInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [, y, m, d, h, mi] = match.map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null
  const date = cairoLocalToDate(y, m, d, h, mi)
  return Number.isNaN(date.getTime()) ? null : date
}

/** ISO ← "YYYY-MM-DDTHH:mm" بتوقيت القاهرة (لحقل datetime-local) */
export function toCairoLocalInput(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const p = cairoParts(date)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${p.y}-${two(p.m)}-${two(p.d)}T${two(p.h)}:${two(p.mi)}`
}

/** موعد انتهاء العرض الفعلي: null معناها العرض منتهي ومخفي */
export function resolveFlashEnd(saved: string | null, now: Date) {
  if (!saved) return nextCairoMidnight(now).toISOString()
  const end = new Date(saved)
  return !Number.isNaN(end.getTime()) && end.getTime() > now.getTime() ? end.toISOString() : null
}
