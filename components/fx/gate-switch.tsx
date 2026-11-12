'use client'

// بيختار بوابة الدخول: 3D لو الجهاز يدعم WebGL والمستخدم مش مفعّل «تقليل الحركة»، غير كده الشاشة العادية.
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { prefersReducedMotion, webglSupported } from '@/lib/fx/env'
import { WelcomeAuthScreen } from '../shop/auth'

// three/gsap بتتحمّل بس عند الحاجة (lazy) ومش على السيرفر
const GateExperience = dynamic(() => import('./gate-experience'), { ssr: false })

export function GateSwitch() {
  const [kind, setKind] = useState<'pending' | '3d' | 'plain'>('pending')
  useEffect(() => {
    setKind(webglSupported() && !prefersReducedMotion() ? '3d' : 'plain')
  }, [])
  if (kind === 'pending') return <div className="gx-boot" aria-hidden="true" />
  if (kind === 'plain') return <WelcomeAuthScreen />
  return <GateExperience onFail={() => setKind('plain')} />
}
