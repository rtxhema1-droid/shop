'use client'

import type { ReactNode } from 'react'

/** زر عادي بدل زر الكريستال */
export function CrystalButton({ children, onClick, done = false, className = '' }: { children: ReactNode; onClick?: () => void; done?: boolean; className?: string }) {
  return (
    <button type="button" className={`btn-crystal ${done ? 'is-done' : ''} ${className}`} onClick={onClick}>
      <span className="btn-crystal-label">{children}</span>
    </button>
  )
}
