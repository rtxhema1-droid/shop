'use client'

import { useRef, type PointerEvent, type ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

/**
 * كارت زجاجي بيميل مع المؤشر (rotateX/rotateY) ولمعة بتتبع الماوس.
 * اللمس مبيعملش ميلان عشان التمرير يفضل طبيعي. --hx/--hy بتتحدّث لطبقات المنصّة جوه الكارت.
 */
export function HoloCard({ children, className = '', strength = 9 }: { children: ReactNode; className?: string; strength?: number }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const sx = useSpring(mx, { stiffness: 220, damping: 22, mass: 0.4 })
  const sy = useSpring(my, { stiffness: 220, damping: 22, mass: 0.4 })
  const rotateY = useTransform(sx, [0, 1], [-strength, strength])
  const rotateX = useTransform(sy, [0, 1], [strength, -strength])
  const px = useTransform(sx, (v) => `${v * 100}%`)
  const py = useTransform(sy, (v) => `${v * 100}%`)
  const sheen = useMotionTemplate`radial-gradient(280px circle at ${px} ${py}, rgba(255,255,255,0.2), rgba(79,227,198,0.1) 40%, transparent 70%)`

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const node = ref.current
    if (!node || reduce || event.pointerType === 'touch') return
    const rect = node.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    mx.set(x)
    my.set(y)
    node.style.setProperty('--hx', String((x - 0.5) * 2))
    node.style.setProperty('--hy', String((y - 0.5) * 2))
  }
  const leave = () => {
    mx.set(0.5)
    my.set(0.5)
    ref.current?.style.setProperty('--hx', '0')
    ref.current?.style.setProperty('--hy', '0')
  }

  return (
    <motion.div ref={ref} className={`holo ${className}`} style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 900 }} onPointerMove={move} onPointerLeave={leave}>
      {children}
      <motion.span className="holo-sheen" aria-hidden="true" style={{ background: sheen }} />
    </motion.div>
  )
}

/** منصّة هولوجرام تحت المنتج: حلقات متوهجة بتتحرك بعكس المؤشر */
export function HoloPodium() {
  return (
    <span className="holo-podium" aria-hidden="true">
      <i /><i /><i />
    </span>
  )
}
