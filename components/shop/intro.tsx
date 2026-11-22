'use client'

import { useEffect, useRef, useState } from 'react'
import { Logo } from './logo'

/**
 * مقدمة زي الفيديو: اللوجو في نص الشاشة، الاسم بيتفتح جنبه، وبعدين اللوجو بيطلع لمكانه في الهيدر
 * والمتجر بيظهر بالتدريج. أي ضغطة أو Enter/Esc بتخطّي المقدمة.
 */
export function LogoIntro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'show' | 'fly'>('show')
  const box = useRef<HTMLDivElement>(null)
  const done = useRef(onDone)
  done.current = onDone
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setPhase('fly'), reduced.current ? 700 : 2700)
    const skip = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') setPhase('fly')
    }
    window.addEventListener('keydown', skip)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', skip)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'fly') return
    const logo = box.current
    const target = document.querySelector<HTMLElement>('.header .zlogo')
    if (logo && target && !reduced.current) {
      const a = logo.getBoundingClientRect()
      const b = target.getBoundingClientRect()
      if (a.width > 0 && b.width > 0) {
        const dx = b.left + b.width / 2 - (a.left + a.width / 2)
        const dy = b.top + b.height / 2 - (a.top + a.height / 2)
        logo.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${b.width / a.width})`
      }
    }
    delete document.documentElement.dataset.intro // المتجر يبدأ يظهر وإحنا بنرفع اللوجو
    const end = window.setTimeout(() => done.current(), reduced.current ? 250 : 1250)
    return () => {
      window.clearTimeout(end)
      delete document.documentElement.dataset.zi
    }
  }, [phase])

  return (
    <div className={`zi ${phase === 'fly' ? 'fly' : ''}`} role="presentation" onClick={() => setPhase('fly')}>
      <div className="zi-logo" ref={box}>
        <Logo />
      </div>
    </div>
  )
}
