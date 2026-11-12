'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'

export function WelcomeToast({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), 5000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(onDone, 450)
    return () => window.clearTimeout(timer)
  }, [leaving, onDone])

  return (
    <div className="welcome-layer" role="status" aria-live="polite">
      <button type="button" className={`welcome-card${leaving ? ' leave' : ''}`} onClick={() => setLeaving(true)}>
        <span className="welcome-mark" aria-hidden="true"><ShoppingBag /></span>
        <span className="welcome-text">Welcome to RTX SHOP</span>
      </button>
    </div>
  )
}
