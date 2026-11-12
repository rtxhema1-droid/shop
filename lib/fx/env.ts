// أدوات بيئة المتصفح للمؤثرات ثلاثية الأبعاد (آمنة تتنادى في المتصفح بس)

export const isMobileViewport = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const hasFinePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

/** هل الجهاز يدعم WebGL فعلاً؟ (لو لا، بنرجع للتصميم العادي من غير 3D) */
export function webglSupported(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
  } catch {
    return false
  }
}

/** اسم خط Cairo اللي next/font حمّله، عشان نرسم بيه جوه الـ canvas */
export function displayFont(): string {
  if (typeof window === 'undefined') return 'sans-serif'
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-cairo').trim()
  return v ? `${v}, sans-serif` : 'sans-serif'
}

export async function fontsReady(): Promise<void> {
  try {
    const family = displayFont()
    await Promise.all([document.fonts.load(`900 80px ${family}`, 'RTX SHOP'), document.fonts.load(`700 40px ${family}`, 'أهلاً شحن كاش')])
    await document.fonts.ready
  } catch {
    /* تجاهل: هنرسم بالخط الاحتياطي */
  }
}

export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
