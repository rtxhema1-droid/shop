'use client'

import { useEffect, useRef } from 'react'

/**
 * كل ما `bump` يزيد (إضافة للسلة) بتطلع جوهرة مضيئة من مكان آخر ضغطة وتطير لأيقونة السلة،
 * وبعدها الأيقونة بتنبض. بتتجاهل المستخدمين اللي مفعّلين «تقليل الحركة».
 */
export function CartFly({ bump }: { bump: number }) {
  const last = useRef({ x: 0, y: 0, t: 0 })
  const seen = useRef(bump)

  useEffect(() => {
    const down = (event: PointerEvent) => {
      last.current = { x: event.clientX, y: event.clientY, t: performance.now() }
    }
    window.addEventListener('pointerdown', down, { capture: true, passive: true })
    return () => window.removeEventListener('pointerdown', down, { capture: true })
  }, [])

  useEffect(() => {
    if (bump === seen.current) return
    seen.current = bump
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof Element.prototype.animate !== 'function') return
    const target = Array.from(document.querySelectorAll<HTMLElement>('.cart-btn, .dock-item[aria-label^="السلة"]')).find((node) => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0
    })
    if (!target) return
    const to = target.getBoundingClientRect()
    const recent = performance.now() - last.current.t < 1500
    const from = recent ? last.current : { x: window.innerWidth / 2, y: window.innerHeight * 0.6 }
    const dx = to.left + to.width / 2 - from.x
    const dy = to.top + to.height / 2 - from.y
    const orb = document.createElement('div')
    orb.className = 'fly-orb'
    orb.setAttribute('aria-hidden', 'true')
    document.body.appendChild(orb)
    const run = orb.animate(
      [
        { transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(1)`, opacity: 1 },
        { transform: `translate3d(${from.x + dx * 0.5}px, ${from.y + dy * 0.5 - 90}px, 0) scale(1.25)`, opacity: 1, offset: 0.5 },
        { transform: `translate3d(${from.x + dx}px, ${from.y + dy}px, 0) scale(0.25)`, opacity: 0.25 },
      ],
      { duration: 720, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
    )
    run.onfinish = () => {
      orb.remove()
      target.classList.remove('hit')
      void target.offsetWidth
      target.classList.add('hit')
      window.setTimeout(() => target.classList.remove('hit'), 700)
    }
    run.oncancel = () => orb.remove()
  }, [bump])

  return null
}
