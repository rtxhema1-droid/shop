'use client'

// ═══════════ رسالة الترحيب: بتنزل من فوق بكل حاجة 3D ═══════════
// سلسلة + بادج بإسم العميل + حلقة مكعبات ونجمة كروم، وبعدها الستارة بتطلع لفوق وتكشف المتجر.
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { PROMISE, PROMISE_SUB } from '@/lib/config'
import { createStage } from '@/lib/fx/kit'
import { fontsReady, isMobileViewport } from '@/lib/fx/env'
import { createWelcomeState, WelcomeScene } from '@/lib/fx/welcome-scene'

export default function WelcomeDrop({ name, onReveal, onDone, onFail }: { name: string; onReveal: () => void; onDone: () => void; onFail: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cb = useRef({ onReveal, onDone, onFail })
  cb.current = { onReveal, onDone, onFail }
  const first = name.trim().split(/\s+/)[0] || name

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    let disposed = false
    let revealed = false
    const mobile = isMobileViewport()
    let stage: ReturnType<typeof createStage>
    try {
      stage = createStage({ canvas, mobile, fov: 38 })
    } catch {
      cb.current.onFail()
      return
    }
    const scene = new WelcomeScene(stage, name)
    const W = createWelcomeState()
    const aspect = () => canvas.clientWidth / Math.max(1, canvas.clientHeight)
    const relayout = () => { stage.resize(); scene.layout(aspect()) }
    relayout()

    let mx = 0
    const onMove = (e: PointerEvent) => { mx = (e.clientX / window.innerWidth) * 2 - 1 }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', relayout)

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      W.mx += (mx - W.mx) * 0.06
      scene.update(W, dt)
      stage.render()
    }
    raf = requestAnimationFrame(frame)

    const reveal = () => {
      if (revealed) return
      revealed = true
      cb.current.onReveal()
    }
    let tl: gsap.core.Timeline | null = null
    void fontsReady().then(() => {
      if (disposed) return
      tl = gsap.timeline({ onComplete: () => cb.current.onDone() })
      tl.to(W, { y: 0, duration: 2.4, ease: 'elastic.out(1, 0.42)' }, 0.1) // السلسلة والبادج بينزلوا بارتداد
        .to(W, { sway: 0.22, duration: 3.2, ease: 'power2.out' }, 0.4)
        .to(W, { glow: 1, duration: 1.4, ease: 'power2.out' }, 0.3)
        .to(W, { sphere: 1, duration: 1.2, ease: 'power3.inOut' }, 0.5)
        .to(W, { ring: 1, duration: 1.3, ease: 'expo.inOut' }, 1.5)
        .to(W, { star: 1, duration: 1.3, ease: 'back.out(1.6)' }, 0.8)
        .from('.wd-copy > *', { y: 60, opacity: 0, filter: 'blur(14px)', duration: 1.1, stagger: 0.14, ease: 'power3.out' }, 1.1)
        .to({}, { duration: 1.5 }) // لحظة هدوء قبل الكشف
        .call(reveal, [], '>')
        .to(W, { y: 22, duration: 1.2, ease: 'power3.in' }, '>')
        .to(root, { yPercent: -100, duration: 1.2, ease: 'power4.inOut' }, '<0.15')
    })

    // لمسة/ضغطة = تخطّي سريع
    const skip = () => tl?.timeScale(3)
    root.addEventListener('click', skip)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      tl?.kill()
      gsap.killTweensOf(W)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', relayout)
      root.removeEventListener('click', skip)
      scene.dispose()
      stage.dispose()
    }
  }, [name])

  return (
    <div ref={rootRef} className="wd-root" role="status" aria-live="polite">
      <canvas ref={canvasRef} className="wd-canvas" aria-hidden="true" />
      <div className="wd-copy">
        <p className="wd-kicker">WELCOME TO RTX SHOP</p>
        <h2>أهلاً {first}</h2>
        <p className="wd-sub">{PROMISE} · {PROMISE_SUB}</p>
      </div>
    </div>
  )
}
