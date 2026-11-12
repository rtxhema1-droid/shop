'use client'

// ═══════════ بوابة المتجر ثلاثية الأبعاد ═══════════
// 1) Preloader بعدّاد تقدّم  2) عرض ترويجي سينمائي بالسكرول (WebGL canvas واحد ثابت + GSAP master timeline + Lenis)
// 3) بعد «دخول المتجر»: لمبة 3D والسلسلة ملفوفة حواليها، شدّ الخيط = تشغيل النور = نموذج الدخول/التسجيل.
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { PROMISE, PROMISE_SUB, STORE_NAME } from '@/lib/config'
import { createStage, clamp, type Stage } from '@/lib/fx/kit'
import { fontsReady, hasFinePointer, isMobileViewport } from '@/lib/fx/env'
import { createLampState, LampScene, type LampState } from '@/lib/fx/lamp-scene'
import { createPromoState, PromoScene, type PromoState } from '@/lib/fx/promo-scene'
import { AuthForm, type Mode } from '../shop/auth'

type StageName = 'loading' | 'promo' | 'transition' | 'auth'
type Actions = { goAuth: (fast?: boolean) => void; toggleLamp: () => void; success: () => Promise<void>; scrollTo: (id: string) => void; boost: (v: number) => void }

const STEPS = [
  { n: '01', t: 'اختار منتجك', d: 'تصفّح الأقسام والأقسام الفرعية، أو دوّر بالاسم.' },
  { n: '02', t: 'اكتب عنوانك', d: 'اختار المحافظة واكتب عنوان التوصيل.' },
  { n: '03', t: PROMISE, d: 'ادفع للمندوب لما الطلب يوصلك.' },
  { n: '04', t: 'تابع طلبك', d: 'كل طلباتك وحالتها في حسابك.' },
]

export default function GateExperience({ onFail }: { onFail: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loaderRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const promoRef = useRef<HTMLDivElement>(null)
  const authRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const actions = useRef<Actions | null>(null)
  const onFailRef = useRef(onFail)
  onFailRef.current = onFail

  const [stage, setStage] = useState<StageName>('loading')
  const [mode, setMode] = useState<Mode>('in')
  const [lampOn, setLampOn] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    let disposed = false
    const mobile = isMobileViewport()
    gsap.registerPlugin(ScrollTrigger)

    let stg: Stage
    try {
      stg = createStage({ canvas, mobile })
    } catch {
      onFailRef.current()
      return
    }
    const promo = new PromoScene(stg)
    const lamp = new LampScene(stg)
    const S: PromoState = createPromoState()
    const L: LampState = createLampState()
    let mode: StageName = 'loading'
    let lightBg = true
    const mouse = { tx: 0, ty: 0, x: 0, y: 0 }
    let master: gsap.core.Timeline | null = null

    const aspect = () => canvas.clientWidth / Math.max(1, canvas.clientHeight)
    const relayout = () => {
      stg.resize()
      promo.layout(aspect())
      lamp.layout(aspect())
    }
    relayout()

    // ── Lenis (سكرول ناعم) متزامن مع ScrollTrigger
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
    lenis.stop()
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    document.documentElement.classList.add('gx-lock')

    // ── حلقة الرسم
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      mouse.x += (mouse.tx - mouse.x) * 0.06
      mouse.y += (mouse.ty - mouse.y) * 0.06
      if (mode === 'auth') {
        L.mx = mouse.x
        L.my = mouse.y
        promo.group.visible = false
        lamp.update(L, dt)
      } else {
        S.mx = mouse.x
        S.my = mouse.y
        lamp.hide()
        promo.group.visible = true
        promo.update(S, dt)
        if (promo.lightBg !== lightBg) {
          lightBg = promo.lightBg
          root.dataset.light = lightBg ? '1' : '0'
        }
      }
      stg.render()
    }
    raf = requestAnimationFrame(frame)

    // ── الماوس: باراللاكس + الكرسر المخصص + تفاعل الخيط
    const fine = hasFinePointer()
    const ring = ringRef.current
    const dot = dotRef.current
    const ringX = ring && gsap.quickTo(ring, 'x', { duration: 0.4, ease: 'power3' })
    const ringY = ring && gsap.quickTo(ring, 'y', { duration: 0.4, ease: 'power3' })
    const setBig = (v: boolean) => ring?.classList.toggle('big', v)
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1
      if (fine && dot) {
        gsap.set(dot, { x: e.clientX, y: e.clientY })
        ringX?.(e.clientX)
        ringY?.(e.clientY)
      }
      if (mode === 'auth' && e.target === canvas) {
        const r = canvas.getBoundingClientRect()
        const hit = lamp.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
        canvas.style.cursor = hit ? 'pointer' : ''
        setBig(hit)
      }
    }
    const onOver = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest?.('a, button, input, label, [data-cursor]')) setBig(true)
      else if (mode !== 'auth') setBig(false)
    }
    const onDown = (e: PointerEvent) => {
      if (mode !== 'auth') return
      const r = canvas.getBoundingClientRect()
      if (lamp.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)) actions.current?.toggleLamp()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerover', onOver)
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('resize', relayout)
    const onLost = (e: Event) => { e.preventDefault(); onFailRef.current() }
    canvas.addEventListener('webglcontextlost', onLost)

    // ───────────── السكرول: الـ master timeline (يحرّك الكاميرا والمجسمات والثيم) ─────────────
    const buildMaster = () => {
      const el = promoRef.current
      if (!el) return
      const secs = Array.from(el.querySelectorAll<HTMLElement>('.gx-sec'))
      const total = el.scrollHeight
      const vh = window.innerHeight
      // موضع منتصف كل قسم كنسبة من السكرول الكلي
      const pc = secs.map((s) => clamp((s.offsetTop + s.offsetHeight / 2 - vh / 2) / Math.max(1, total - vh), 0, 1))
      const D = 100
      const at = (k: number) => pc[k] * D
      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.9 } })
      tl.to(S, { scroll: 1, duration: D }, 0) // تقدّم السكرول الكلي (باراللاكس + حركة السلسلة)
      const arrive = (k: number, vars: gsap.TweenVars) => {
        const gap = Math.max(4, at(k) - at(k - 1))
        tl.to(S, { ...vars, ease: 'power2.inOut', duration: gap * 0.62 }, Math.max(0, at(k) - gap * 0.67))
      }
      // 2) WORK: النجمة بتتحطم، السلسلة بتعدّي الشاشة، الكروت بتظهر
      arrive(1, { theme: 1, shatter: 1, path: 1, cx: 1.5, cy: 0.6, cz: 11.5, disperse: 1.3, debrisScale: 0.85, chainSpeed: 0.9, spin: 1.6 })
      // 3) SERVICES: أسود بتوهج أحمر، السلسلة فضّية لامعة، الكاميرا بتقرّب
      arrive(2, { theme: 2, shatter: 1.15, path: 2, cx: -0.5, cy: -0.3, cz: 5.4, lx: 0.6, chainSilver: 1, disperse: 2.4, debrisScale: 0.55, chainSpeed: 0.6 })
      // 4) SHOWCASE: أحمر/أسود + سيان نيون، سلسلة سريعة + motion blur، النجمة بتتجمّع تاني
      arrive(3, { theme: 3, shatter: 0.1, path: 3, cx: -2.2, cy: 1.2, cz: 8.6, lx: 0.5, chainSpeed: 5.5, blur: 0.62, neon: 1, disperse: 0.4, debrisScale: 1, spin: 3.2 })
      // 5) FOOTER: السلسلة بتهدى وبتتعلّق من فوق شايلة البادج
      arrive(4, { theme: 4, path: 4, cx: 0, cy: 1, cz: 9.6, lx: 0, ly: 1, chainSpeed: 0.12, blur: 0, sway: 0.3, badge: 1, starScale: 0, debrisScale: 0.3, disperse: 3, neon: 0.4 })
      master = tl

      // ظهور نصوص الأقسام (غير الهيرو) بحركة ناعمة
      gsap.utils.toArray<HTMLElement>('.gx-sec:not(.gx-hero) [data-in]').forEach((node) => {
        gsap.from(node, { y: 56, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: node, start: 'top 90%', toggleActions: 'play none none reverse' } })
      })
    }

    // ───────────── البوت: preloader ← الإنترو ─────────────
    const prog = { v: 0 }
    const paint = () => {
      const n = Math.round(prog.v)
      if (countRef.current) countRef.current.textContent = String(n).padStart(3, '0')
      if (barRef.current) barRef.current.style.transform = `scaleX(${prog.v / 100})`
    }
    const to = (v: number, d: number) => new Promise<void>((res) => { gsap.to(prog, { v, duration: d, ease: 'power1.out', overwrite: true, onUpdate: paint, onComplete: () => res() }) })

    const boot = async () => {
      const started = performance.now()
      void to(22, 0.8)
      await fontsReady()
      if (disposed) return
      await promo.loadAssets((p) => { void to(22 + p * 70, 0.5) })
      if (disposed) return
      promo.layout(aspect())
      const wait = 1800 - (performance.now() - started)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      await to(100, 0.45)
      if (disposed) return
      buildMaster()
      mode = 'promo'
      setStage('promo')
      // الإنترو: المكعبات متبعثرة ← كورة ← حلقة، والنجمة تظهر، والسلسلة تلف حواليها
      const intro = gsap.timeline({ onComplete: () => { lenis.start(); document.documentElement.classList.remove('gx-lock') } })
      intro
        .to(loaderRef.current, { yPercent: -100, duration: 1, ease: 'power4.inOut' })
        .to(S, { starScale: 1, duration: 1.5, ease: 'back.out(1.5)' }, 0.5)
        .to(S, { sphere: 1, duration: 1.7, ease: 'power3.inOut' }, 0.6)
        .to(S, { ring: 1, duration: 1.5, ease: 'expo.inOut' }, 2.1)
        .to(S, { chainGrow: 1, duration: 2.6, ease: 'power2.out' }, 1.6)
        .to(S, { introCam: 0, duration: 2.8, ease: 'expo.out' }, 0.5)
        .from('.gx-hero [data-in]', { y: 70, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out' }, 1.8)
        .from('.gx-nav', { y: -40, opacity: 0, duration: 0.9, ease: 'power3.out' }, 1.6)
    }
    void boot()

    // ───────────── العبور من العرض للّمبة ─────────────
    const goAuth = (fast = false) => {
      if (mode !== 'promo') return
      mode = 'transition'
      setStage('transition')
      lenis.stop()
      master?.scrollTrigger?.kill()
      master?.kill()
      master = null
      ScrollTrigger.getAll().forEach((st) => st.kill())
      const tl = gsap.timeline()
      tl.to(promoRef.current, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 0)
        .to('.gx-nav', { opacity: 0, duration: 0.4 }, 0)
        .to(S, { cx: 0, cy: 0, cz: 1.6, lx: 0, ly: 0, lz: 0, blur: 0.85, duration: 1.15, ease: 'power3.in' }, 0)
        .to(flashRef.current, { opacity: 1, duration: 0.45, ease: 'power2.in' }, 0.75)
        .call(() => {
          if (disposed) return
          if (promoRef.current) promoRef.current.style.display = 'none'
          window.scrollTo(0, 0)
          root.dataset.light = '0'
          mode = 'auth'
          setStage('auth')
          lamp.layout(aspect())
        })
        .to(flashRef.current, { opacity: 0, duration: 1, ease: 'power2.out' })
        .to(L, { show: 1, duration: 1.5, ease: 'expo.out' }, '<')
        .to(L, { grow: 1, duration: 2.4, ease: 'power2.out' }, '<0.15')
        .fromTo(cardRef.current, { opacity: 0, y: 40 }, { opacity: 0.45, y: 0, duration: 1, ease: 'power3.out' }, '<0.3')
      if (fast) tl.timeScale(2.2)
    }

    // ───────────── اللمبة: شدّ الخيط ─────────────
    let on = false
    const toggleLamp = () => {
      if (mode !== 'auth') return
      on = !on
      gsap.timeline().to(L, { pull: 1, duration: 0.12, ease: 'power1.out' }).to(L, { pull: 0, duration: 0.7, ease: 'elastic.out(1, 0.35)' })
      gsap.to(L, { on: on ? 1 : 0, duration: 0.7, ease: 'power2.out' })
      gsap.to(cardRef.current, { opacity: on ? 1 : 0.45, duration: 0.7 })
      setLampOn(on)
      if (on) window.setTimeout(() => cardRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus({ preventScroll: true }), 650)
    }

    // نجاح تسجيل الدخول: وميض + اقتراب، وبعدها الصفحة بتتحمّل بالمتجر
    const success = () =>
      new Promise<void>((res) => {
        const tl = gsap.timeline({ onComplete: () => res() })
        tl.to(L, { success: 1, duration: 0.45, ease: 'power2.out' })
          .to(L, { dolly: 1, duration: 0.9, ease: 'power3.in' }, 0.1)
          .to(flashRef.current, { opacity: 1, duration: 0.35, ease: 'power2.in' }, 0.7)
      })

    actions.current = {
      goAuth,
      toggleLamp,
      success,
      boost: (v) => { gsap.to(S, { boost: v, duration: 0.5, ease: 'power2.out', overwrite: 'auto' }) },
      scrollTo: (id) => {
        const target = root.querySelector<HTMLElement>(`#${id}`)
        if (target) lenis.scrollTo(target, { duration: 1.6 })
      },
    }

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      gsap.ticker.remove(tick)
      gsap.killTweensOf([S, L, prog])
      master?.kill()
      ScrollTrigger.getAll().forEach((st) => st.kill())
      lenis.destroy()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', relayout)
      root.removeEventListener('pointerover', onOver)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('webglcontextlost', onLost)
      document.documentElement.classList.remove('gx-lock')
      promo.dispose()
      lamp.dispose()
      stg.dispose()
      actions.current = null
    }
  }, [])

  const go = (id: string) => actions.current?.scrollTo(id)

  return (
    <div ref={rootRef} className="gx-root" data-stage={stage} data-light="1">
      <canvas ref={canvasRef} className="gx-canvas" aria-hidden="true" />

      {/* ───── Preloader ───── */}
      <div ref={loaderRef} className="gx-loader" role="status" aria-live="polite" aria-label="جاري التحميل">
        <span className="gx-loader-logo">{STORE_NAME}</span>
        <div className="gx-count"><span ref={countRef}>000</span><small>%</small></div>
        <div className="gx-bar"><i ref={barRef} /></div>
      </div>

      {/* ───── ناف بسيط ثابت: لوجو + 3 روابط ───── */}
      <header className="gx-nav" hidden={stage === 'auth'}>
        <a className="gx-logo" href="#top" onClick={(e) => { e.preventDefault(); go('top') }} data-cursor><b>RTX</b><i /><em>SHOP</em></a>
        <nav aria-label="روابط العرض">
          <a href="#work" onClick={(e) => { e.preventDefault(); go('work') }}>المنتجات</a>
          <a href="#services" onClick={(e) => { e.preventDefault(); go('services') }}>الخطوات</a>
          <a href="#start" onClick={(e) => { e.preventDefault(); go('start') }}>ابدأ</a>
        </nav>
        <button type="button" className="gx-skip" onClick={() => actions.current?.goAuth(true)} data-cursor>دخول</button>
      </header>

      {/* ───── العرض الترويجي (600vh) ───── */}
      <div ref={promoRef} className="gx-promo">
        <section id="top" className="gx-sec gx-hero">
          <div className="gx-hero-foot">
            <div>
              <p className="gx-label" data-in>RTX SHOP — متجر إلكتروني مصري</p>
              <p className="gx-lead" data-in>متجر تحسّه<br />قبل ما تلمسه.</p>
              <p className="gx-mini" data-in>{PROMISE} · {PROMISE_SUB}</p>
            </div>
            <button type="button" className="gx-cta" onClick={() => actions.current?.goAuth()} data-in data-cursor>
              <span>دخول المتجر</span>
              <i className="gx-toggle" aria-hidden="true"><b /></i>
            </button>
          </div>
          <span className="gx-scroll" data-in aria-hidden="true">اسحب لتحت</span>
        </section>

        <section id="work" className="gx-sec gx-work">
          <div className="gx-copy">
            <p className="gx-label" data-in>01 — المنتجات</p>
            <h2 data-in>كل اللي محتاجه،<br />في مكان واحد.</h2>
            <p className="gx-p" data-in>أقسام وأقسام فرعية، وتجّار كتير، وكل منتج بسعره وصورته — ويوصلك لحد باب البيت.</p>
          </div>
        </section>

        <section id="services" className="gx-sec gx-services">
          <div className="gx-copy">
            <p className="gx-label" data-in>02 — إزاي بتطلب</p>
            <ul className="gx-list">
              {STEPS.map((s) => (
                <li key={s.n} data-in data-cursor onPointerEnter={() => actions.current?.boost(1)} onPointerLeave={() => actions.current?.boost(0)}>
                  <span className="gx-n">{s.n}</span>
                  <strong>{s.t}</strong>
                  <em>{s.d}</em>
                  <i aria-hidden="true">←</i>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="showcase" className="gx-sec gx-show">
          <div className="gx-copy">
            <p className="gx-label" data-in>03 — الإحساس</p>
            <h2 data-in className="gx-neon-rim">اطلب وانت مرتاح،<br />وادفع كاش للمندوب.</h2>
            <p className="gx-p" data-in>{PROMISE_SUB}. حسابك وطلباتك وكل حاجة في مكان واحد.</p>
          </div>
        </section>

        <section id="start" className="gx-sec gx-end">
          <div className="gx-copy">
            <p className="gx-label" data-in>04 — ابدأ</p>
            <h2 data-in className="gx-neon">تسوّق حاجة<br />تحب تلمسها.</h2>
            <button type="button" className="gx-cta gx-cta-lg" onClick={() => actions.current?.goAuth()} data-in data-cursor>
              <span>دخول المتجر</span>
              <i className="gx-toggle" aria-hidden="true"><b /></i>
            </button>
          </div>
        </section>
      </div>

      {/* ───── مرحلة اللمبة + الدخول/التسجيل ───── */}
      <div ref={authRef} className="gx-auth" hidden={stage !== 'auth'}>
        <div className="gx-auth-in">
          <div className="gx-lamp-space" aria-hidden="true" />
          <div ref={cardRef} className={`gx-card${lampOn ? ' on' : ''}`} style={{ opacity: 0 }}>
            <div className="gx-card-head">
              <div className="wordmark" aria-label={STORE_NAME}><span>RTX</span><i /><em>SHOP</em></div>
              <h1>{mode === 'in' ? 'أهلاً بعودتك' : 'إنشاء حساب جديد'}</h1>
              <p>{mode === 'in' ? 'سجّل دخولك لتصفّح المنتجات ومتابعة طلباتك.' : 'حساب واحد بالموبايل، وطلباتك كلها في مكان واحد.'}</p>
            </div>
            <button type="button" className="gx-pull" aria-pressed={lampOn} onClick={() => actions.current?.toggleLamp()} data-cursor>
              <i aria-hidden="true" />{lampOn ? 'اطفي النور' : 'اسحب الخيط لتشغيل النور'}
            </button>
            <fieldset className="gx-fields" disabled={!lampOn}>
              <AuthForm mode={mode} onMode={setMode} onSuccess={() => actions.current?.success()} />
            </fieldset>
            <p className="gx-msg" role="status">{lampOn ? '' : 'اسحب خيط اللمبة (أو اضغط الزر) عشان يتفتح النموذج.'}</p>
            <button type="button" className="gx-back" onClick={() => window.location.reload()} data-cursor>← رجوع للعرض</button>
          </div>
        </div>
      </div>

      <div ref={flashRef} className="gx-flash" aria-hidden="true" />
      <div ref={ringRef} className="gx-ring" aria-hidden="true" />
      <div ref={dotRef} className="gx-dot" aria-hidden="true" />
    </div>
  )
}
