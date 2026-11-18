'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { fx, useFxEnabled } from './fx-store'
import type { Tier } from './crystal-scene'

const CrystalScene = dynamic(() => import('./crystal-scene'), { ssr: false })

function detectTier(): Tier | null {
  try {
    const canvas = document.createElement('canvas')
    if (!(canvas.getContext('webgl2') || canvas.getContext('webgl'))) return null
  } catch {
    return null
  }
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }
  if (nav.connection?.saveData) return null
  const weak = window.innerWidth < 768 || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
  return weak ? 'low' : 'high'
}

/**
 * خلفية الكريستال ثابتة ورا المتجر كله. لو WebGL مش متاح أو المستخدم طفّى التأثيرات
 * بيظهر بديل CSS خفيف (تدرّج + عنوان نصي) والموقع بيشتغل عادي.
 */
export function CrystalBackdrop({ ambient = false }: { ambient?: boolean }) {
  const enabled = useFxEnabled()
  const [tier, setTier] = useState<Tier | null>(null)

  useEffect(() => {
    fx.ambient = ambient
  }, [ambient])

  useEffect(() => {
    if (!enabled) {
      document.documentElement.dataset.fx = 'off'
      setTier(null)
      return
    }
    setTier(detectTier())
  }, [enabled])

  useEffect(() => {
    if (!enabled || !tier) return
    gsap.registerPlugin(ScrollTrigger)
    const onMove = (event: PointerEvent) => {
      fx.pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      fx.pointer.y = -((event.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        fx.scroll.y = window.scrollY / window.innerHeight
        fx.scroll.p = Math.min(1, fx.scroll.y / 0.9)
        fx.scroll.v = Math.max(-3, Math.min(3, self.getVelocity() / 1400))
      },
    })
    return () => {
      window.removeEventListener('pointermove', onMove)
      trigger.kill()
    }
  }, [enabled, tier])

  useEffect(() => () => void (document.documentElement.dataset.fx = 'off'), [])

  return (
    <div className="fx-layer" aria-hidden="true">
      <div className="fx-fallback" />
      {enabled && tier && <CrystalScene tier={tier} onReady={() => (document.documentElement.dataset.fx = 'on')} />}
    </div>
  )
}
