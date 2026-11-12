'use client'

// ═══════════ حركة المتجر (بعد الدخول) ═══════════
// 1) سلسلة معدنية 3D بتعدّي الشاشة مع سرعة السكرول (canvas شفاف خفيف)
// 2) ميل 3D للكروت مع لمعة تتبع المؤشر
// 3) دخول المنتجات والأقسام بحركة عمق (stagger) بعد رسالة الترحيب
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Chain, clamp, createStage, lerp, makeGlow, makePath, mulberry, smooth } from '@/lib/fx/kit'
import { hasFinePointer, isMobileViewport, prefersReducedMotion, webglSupported } from '@/lib/fx/env'
import * as THREE from 'three'

export type MotionPhase = 'idle' | 'hold' | 'enter'

const TILT_SELECTOR = '.card, .cat-tile, .hero-art'
const ENTER_SELECTOR = '.header, .hero-copy > *, .hero-art, .trust-item, .cat-tile, .card'

const inViewport = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < window.innerHeight * 1.05
}

export default function StoreMotion({ phase }: { phase: MotionPhase }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useRef(false)

  // ── ميل 3D للكروت
  useEffect(() => {
    reduce.current = prefersReducedMotion()
    if (reduce.current) return
    document.documentElement.classList.add('fx3d')
    let current: HTMLElement | null = null
    const reset = (el: HTMLElement | null) => {
      if (!el) return
      el.style.removeProperty('--rx')
      el.style.removeProperty('--ry')
      el.classList.remove('is-tilt')
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const target = (e.target as HTMLElement | null)?.closest?.(TILT_SELECTOR) as HTMLElement | null
      if (target !== current) {
        reset(current)
        current = target
      }
      if (!target) return
      const r = target.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      target.classList.add('is-tilt')
      target.style.setProperty('--rx', `${((0.5 - py) * 9).toFixed(2)}deg`)
      target.style.setProperty('--ry', `${((px - 0.5) * 11).toFixed(2)}deg`)
      target.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`)
      target.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`)
    }
    const onLeave = () => { reset(current); current = null }
    if (hasFinePointer()) {
      document.addEventListener('pointermove', onMove, { passive: true })
      document.addEventListener('pointerleave', onLeave)
    }
    return () => {
      document.documentElement.classList.remove('fx3d')
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      reset(current)
    }
  }, [])

  // ── السلسلة اللي بتعدّي مع السكرول + انفجار الكرستالات عند المنتجات (canvas شفاف واحد)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || prefersReducedMotion() || !webglSupported()) return
    const mobile = isMobileViewport()
    let stage: ReturnType<typeof createStage>
    try {
      stage = createStage({ canvas, mobile, alpha: true, post: false, fov: 40 })
    } catch {
      return
    }
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    const rand = mulberry(99)

    // السلسلة
    const pathA = makePath([V(-15, -7.5, 0), V(-7, -3.2, 2), V(0, 0.4, 3.2), V(7, 3.4, 2), V(15, 7.5, 0)])
    const pathB = makePath([V(-15, 6.5, 0), V(-7, 2.6, 2.5), V(1, -1, 3.4), V(8, -3.4, 2), V(15, -6.8, 0)])
    const chain = new Chain(mobile ? 60 : 120, mobile ? 0.55 : 0.4, mobile)
    chain.material.color.setRGB(0.92, 0.93, 0.96)
    chain.material.roughness = 0.1
    chain.material.transparent = true
    chain.material.opacity = 0

    // الكرستالات: octahedron مستطيل (شكل كريستال) بخامة زجاجية قزحية
    const N = mobile ? 26 : 64
    const geo = new THREE.OctahedronGeometry(0.5, 0)
    geo.scale(0.6, 1.25, 0.6)
    const crystalMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.04, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, transparent: true, opacity: 0, flatShading: true })
    const crystals = new THREE.InstancedMesh(geo, crystalMat, N)
    crystals.frustumCulled = false
    const palette = [0xff2a3a, 0x19f0ff, 0xffffff, 0xff6a78, 0x7ff8ff].map((c) => new THREE.Color(c))
    type Seed = { dir: THREE.Vector3; speed: number; home: THREE.Vector3; depth: number; size: number; spin: THREE.Vector3; ph: number }
    const seeds: Seed[] = []
    for (let i = 0; i < N; i++) {
      crystals.setColorAt(i, palette[Math.floor(rand() * palette.length)])
      seeds.push({
        dir: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.2).normalize(),
        speed: 7 + rand() * 11,
        home: new THREE.Vector3((rand() - 0.5) * 2, (rand() - 0.5) * 2, -2 + rand() * 6), // x,y بنسبة من حجم الشاشة
        depth: 0.4 + rand() * 1.2,
        size: 0.35 + rand() * 0.9,
        spin: new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1),
        ph: rand() * 6.28,
      })
    }
    // موجة صدمة + وميض
    const shock = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0x19f0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    shock.position.z = 1
    const flash = makeGlow('rgba(255,90,100,1)', 8)
    flash.position.z = 1.5

    const key = new THREE.DirectionalLight(0xffffff, 2.4)
    key.position.set(3, 5, 6)
    const cyan = new THREE.DirectionalLight(0x19f0ff, 3)
    cyan.position.set(-5, 2, 4)
    stage.camera.position.set(0, 0, 10)
    stage.scene.environmentIntensity = 1.1
    stage.scene.add(key, cyan, chain.mesh, crystals, shock, flash)

    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const eu = new THREE.Euler()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()
    let y = window.scrollY
    let vel = 0
    let phaseV = 0
    let raf = 0
    let last = performance.now()
    let wasVisible = true
    let inProducts = false
    let bt = 99 // الوقت من لحظة الانفجار
    let cVis = 0
    let tick = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      const ny = window.scrollY
      const dy = ny - y
      y = ny

      // هل العميل وصل لقسم المنتجات؟ لو دخله من برّه → انفجار
      if (tick++ % 6 === 0) {
        const el = document.getElementById('products')
        const r = el?.getBoundingClientRect()
        const now_in = !!r && r.top < window.innerHeight * 0.62 && r.bottom > window.innerHeight * 0.25
        if (now_in && !inProducts) bt = 0
        inProducts = now_in
      }
      bt += dt
      cVis = lerp(cVis, inProducts ? 1 : 0, inProducts ? 0.1 : 0.06)

      // سلسلة السكرول
      vel = lerp(vel, Math.abs(dy) / Math.max(dt, 0.001), 0.12)
      const vis = smooth(250, 2200, vel)
      chain.mesh.visible = vis > 0.01
      chain.material.opacity = vis * 0.96
      if (chain.mesh.visible) {
        phaseV += Math.sign(dy) * Math.min(Math.abs(dy), 160) * 0.03 + dt * 0.6 * vis
        chain.update({ a: pathA, b: pathB, mix: (Math.sin(ny * 0.0011) + 1) / 2, phase: phaseV, grow: 1, edge: 1, sway: 0, time: t })
        chain.mesh.rotation.z = Math.sin(ny * 0.0007) * 0.12
      }

      // الكرستالات
      const cShow = cVis > 0.01
      crystals.visible = cShow
      const burstOn = bt < 1.4
      shock.visible = burstOn
      flash.visible = burstOn
      if (cShow) {
        const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight)
        const hy = 4.2
        const hx = hy * aspect * 1.05
        crystalMat.opacity = Math.min(1, cVis) * 0.92
        const ex = 1 - Math.pow(1 - clamp(bt / 1.1, 0, 1), 3) // easeOutCubic لانطلاق الشظايا
        const settle = smooth(0.7, 2.4, bt)
        for (let i = 0; i < N; i++) {
          const s = seeds[i]
          // موضع الانفجار (من نص الشاشة لبرّه)
          const bx = s.dir.x * s.speed * ex * 0.9
          const by = s.dir.y * s.speed * ex * 0.7
          const bz = s.dir.z * s.speed * ex * 0.5 + 2
          // موضع الطيران الدايم: باراللاكس مع السكرول وتلف الأطراف
          const span = hy * 2.4
          const fy = ((((s.home.y * hy + ny * 0.0042 * s.depth + Math.sin(t * 0.5 + s.ph) * 0.25) % span) + span * 1.5) % span) - span / 2
          const fx = s.home.x * hx + Math.cos(t * 0.4 + s.ph) * 0.3
          pos.set(lerp(bx, fx, settle), lerp(by, fy, settle), lerp(bz, s.home.z, settle))
          eu.set(t * s.spin.x * 0.8 + s.ph, t * s.spin.y * 0.9, t * s.spin.z * 0.6 + bt * 3 * (1 - settle))
          q.setFromEuler(eu)
          const pop = smooth(0, 0.25, bt)
          const k = s.size * 0.55 * pop * (mobile ? 0.8 : 1)
          scl.set(k, k, k)
          m4.compose(pos, q, scl)
          crystals.setMatrixAt(i, m4)
        }
        crystals.instanceMatrix.needsUpdate = true
      }
      if (burstOn) {
        const u = clamp(bt / 1.4, 0, 1)
        const rs = 0.3 + u * 16
        shock.scale.set(rs, rs, 1)
        ;(shock.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.8
        const fl = Math.max(0, 1 - bt / 0.55)
        ;(flash.material as THREE.SpriteMaterial).opacity = fl
        flash.scale.setScalar(4 + bt * 26)
      }

      if (!chain.mesh.visible && !cShow && !wasVisible) return // مفيش حاجة تترسم
      wasVisible = chain.mesh.visible || cShow
      stage.render()
    }
    raf = requestAnimationFrame(frame)
    const onResize = () => stage.resize()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      stage.dispose()
    }
  }, [])

  // ── دخول العناصر بعد الترحيب: بنخبّي اللي ظاهر وقت الترحيب، وبعدين نطلّعه بعمق وstagger
  const targets = useRef<HTMLElement[]>([])
  useEffect(() => {
    if (reduce.current) return
    if (phase === 'hold') {
      targets.current = Array.from(document.querySelectorAll<HTMLElement>(ENTER_SELECTOR)).filter(inViewport)
      gsap.set(targets.current, { opacity: 0 })
    }
    if (phase === 'enter') {
      const els = targets.current.length ? targets.current : Array.from(document.querySelectorAll<HTMLElement>(ENTER_SELECTOR)).filter(inViewport)
      const header = els.filter((el) => el.classList.contains('header'))
      const rest = els.filter((el) => !el.classList.contains('header'))
      document.documentElement.classList.add('fx-entering')
      const tl = gsap.timeline({ onComplete: () => { document.documentElement.classList.remove('fx-entering'); gsap.set(els, { clearProps: 'transform,opacity,filter' }) } })
      tl.fromTo(header, { opacity: 0, yPercent: -100 }, { opacity: 1, yPercent: 0, duration: 0.9, ease: 'power3.out' }, 0)
        .fromTo(rest, { opacity: 0, y: 90, z: -240, rotationX: -26, transformPerspective: 900, transformOrigin: '50% 100%' }, { opacity: 1, y: 0, z: 0, rotationX: 0, duration: 1.25, ease: 'power3.out', stagger: { amount: 0.9, from: 'start' } }, 0.1)
      return () => { tl.kill() }
    }
  }, [phase])

  return <canvas ref={canvasRef} className="sc-canvas" aria-hidden="true" />
}


