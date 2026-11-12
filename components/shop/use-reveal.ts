'use client'

import { useEffect, useRef } from 'react'

/**
 * ظهور ناعم للعنصر لما يدخل الشاشة (IntersectionObserver).
 * العنصر اللي ظاهر أصلاً وقت التحميل مبيتخباش خالص (من غير وميض)، والحركة بتتلغي لو المستخدم مفعّل «تقليل الحركة».
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = element.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) return
    element.classList.add('reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          // stagger بسيط حسب ترتيب العنصر وسط إخوته (الكروت بتدخل ورا بعض)
          const el = entry.target as HTMLElement
          const index = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0
          el.style.transitionDelay = `${(index % 6) * 70}ms`
          window.setTimeout(() => { el.style.transitionDelay = '' }, 1200)
          el.classList.add('reveal-in')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return ref
}
