'use client'

import { useRef, useState, type MouseEvent, type ReactNode } from 'react'

/** زر كريستال بحواف مقطوعة، وموجة نيون بتطلع من مكان الضغطة */
export function CrystalButton({ children, onClick, done = false, className = '' }: { children: ReactNode; onClick?: () => void; done?: boolean; className?: string }) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([])
  const counter = useRef(0)

  const click = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const keyboard = event.detail === 0
    const id = ++counter.current
    setRipples((list) => [...list, { id, x: keyboard ? rect.width / 2 : event.clientX - rect.left, y: keyboard ? rect.height / 2 : event.clientY - rect.top }])
    window.setTimeout(() => setRipples((list) => list.filter((item) => item.id !== id)), 700)
    onClick?.()
  }

  return (
    <button type="button" className={`btn-crystal ${done ? 'is-done' : ''} ${className}`} onClick={click}>
      <span className="btn-crystal-label">{children}</span>
      {ripples.map((r) => <span key={r.id} className="btn-crystal-ripple" style={{ left: r.x, top: r.y }} aria-hidden="true" />)}
    </button>
  )
}
