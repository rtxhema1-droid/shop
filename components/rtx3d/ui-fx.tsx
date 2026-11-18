'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'

/**
 * أدوات الواجهة: شريط تقدّم التمرير، زر الرجوع لأعلى بحلقة تقدّم، إضاءة بتتبع المؤشر،
 * وعلامة data-scrolled على <html> عشان الهيدر يتوهّج بعد النزول.
 * كله بيتحدّث بـ rAF وtransform/opacity بس، ومن غير re-render مع كل سكرول.
 */
export function UiFx() {
  const bar = useRef<HTMLDivElement>(null)
  const ring = useRef<SVGCircleElement>(null)
  const glow = useRef<HTMLDivElement>(null)
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    let frame = 0
    let top = false
    let scrolled = false
    const update = () => {
      frame = 0
      const max = Math.max(1, root.scrollHeight - window.innerHeight)
      const p = Math.min(1, Math.max(0, window.scrollY / max))
      if (bar.current) bar.current.style.transform = `scaleX(${p})`
      if (ring.current) ring.current.style.strokeDashoffset = String(100 - p * 100)
      const s = window.scrollY > 24
      if (s !== scrolled) {
        scrolled = s
        if (s) root.dataset.scrolled = '1'
        else delete root.dataset.scrolled
      }
      const t = window.scrollY > 640
      if (t !== top) {
        top = t
        setShowTop(t)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
      delete root.dataset.scrolled
    }
  }, [])

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = document.documentElement
    let frame = 0
    let x = 0
    let y = 0
    const paint = () => {
      frame = 0
      glow.current?.style.setProperty('transform', `translate3d(${x}px, ${y}px, 0)`)
    }
    const move = (event: PointerEvent) => {
      x = event.clientX
      y = event.clientY
      glow.current?.classList.add('on')
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const leave = () => glow.current?.classList.remove('on')
    window.addEventListener('pointermove', move, { passive: true })
    root.addEventListener('mouseleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      root.removeEventListener('mouseleave', leave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
      <div className="scroll-progress" ref={bar} aria-hidden="true" />
      <div className="cursor-glow" ref={glow} aria-hidden="true" />
      <button
        type="button"
        className={`to-top ${showTop ? 'show' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="الرجوع لأعلى الصفحة"
        aria-hidden={!showTop}
        tabIndex={showTop ? 0 : -1}
        data-tip="لأعلى"
      >
        <svg className="to-top-ring" viewBox="0 0 40 40" aria-hidden="true">
          <circle className="to-top-track" cx="20" cy="20" r="18" />
          <circle ref={ring} className="to-top-bar" cx="20" cy="20" r="18" pathLength={100} />
        </svg>
        <ArrowUp aria-hidden="true" />
      </button>
    </>
  )
}
