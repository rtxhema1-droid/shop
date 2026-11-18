import { useSyncExternalStore } from 'react'
import gsap from 'gsap'

/**
 * حالة مشتركة بين الـ Canvas والواجهة. القيم المتغيرة كل فريم (المؤشر، السكرول، الطيران) في كائن عادي
 * بيتقرأ جوه useFrame من غير ما يعمل Re-render لـ React.
 */
export const fx = {
  pointer: { x: 0, y: 0 }, // -1..1
  scroll: { y: 0, p: 0, v: 0 }, // y = المسافة بالشاشات، p = تقدّم الهيرو 0..1، v = سرعة التمرير
  fly: { z: 0, spin: 0, flash: 0, hue: 0 },
  intro: { z: 8 },
  heroVisible: false,
  ambient: false,
}

export type FlyKind = 'category' | 'product'

const hueOf = (seed: string | null | undefined) => {
  if (!seed) return 0
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 997
  return (h % 100) / 100
}

/** رحلة الكاميرا: بتقرب بسرعة جوه الكريستال وترجع، والكريستال بيلفّ ويتغيّر لونه حسب القسم */
export function flyThrough(kind: FlyKind, seed?: string | null) {
  if (typeof window === 'undefined' || !enabledNow()) return
  gsap.killTweensOf(fx.fly)
  const dive = kind === 'product' ? -3.4 : -2.4
  gsap
    .timeline()
    .to(fx.fly, { z: dive, flash: 1, duration: 0.38, ease: 'power3.in' })
    .to(fx.fly, { z: 0, flash: 0, duration: 0.95, ease: 'power3.out' })
  gsap.to(fx.fly, { spin: fx.fly.spin + (kind === 'product' ? 1.6 : 1.1), hue: kind === 'category' ? hueOf(seed) : fx.fly.hue, duration: 1.2, ease: 'power2.inOut', overwrite: false })
}

// ───────── تفضيل المستخدم (تشغيل/إيقاف التأثيرات) ─────────
type Pref = 'on' | 'off' | null
const KEY = 'rtx-fx'
const listeners = new Set<() => void>()
let reduced = false

const readPref = (): Pref => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'on' || v === 'off' ? v : null
  } catch {
    return null
  }
}
const enabledNow = () => {
  if (typeof window === 'undefined') return false
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const pref = readPref()
  return pref === 'on' || (pref !== 'off' && !reduced)
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

export function setFxEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* تجاهل */
  }
  listeners.forEach((cb) => cb())
}

/** true لو التأثيرات ثلاثية الأبعاد شغالة (افتراضي: شغالة إلا لو المستخدم طفاها أو جهازه بيفضّل حركة أقل) */
export function useFxEnabled() {
  return useSyncExternalStore(subscribe, enabledNow, () => false)
}
