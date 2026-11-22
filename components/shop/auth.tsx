'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowUpRight, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { STORE_NAME } from '@/lib/config'
import { Hue, LangSwitch, useLang } from './i18n'
import { Field, Modal, api, errorText, formValues } from './shared'

type Mode = 'in' | 'up'
/** حالة الروبوت: بيتفاعل مع اللي بيحصل في الفورم */
type Mood = 'idle' | 'watching' | 'hiding' | 'busy' | 'error'

// ───────────────────────── نموذج الدخول/التسجيل (مشترك بين البوابة والمودال) ─────────────────────────

function AuthForm({ mode, onMode, compact, onMood }: { mode: Mode; onMode: (mode: Mode) => void; compact?: boolean; onMood?: (mood: Mood) => void }) {
  const { tr } = useLang()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    onMood?.('busy')
    const values = formValues(event)
    try {
      await api(mode === 'in' ? 'sign-in' : 'sign-up', 'POST', values)
      try { window.sessionStorage.setItem('rtx-welcome', mode) } catch {}
      window.location.reload()
    } catch (reason) {
      setError(errorText(reason, tr('حصلت مشكلة — جرب تاني', 'Something went wrong. Try again.')))
      setBusy(false)
      onMood?.('error')
    }
  }

  return (
    <form
      className="stack auth-form"
      onSubmit={submit}
      key={mode}
      onFocus={(event) => onMood?.((event.target as unknown as HTMLInputElement).name === 'password' && !show ? 'hiding' : 'watching')}
      onBlur={() => onMood?.('idle')}
    >
      {mode === 'up' && (
        <Field label={tr('الاسم', 'Name')}>
          <input name="name" required maxLength={100} autoComplete="name" placeholder={tr('الاسم بالكامل', 'Full name')} />
        </Field>
      )}
      {mode === 'in' ? (
        <Field label={tr('الموبايل أو اسم المستخدم', 'Phone or username')}>
          <input name="identifier" required maxLength={254} autoComplete="username" placeholder="01012345678" dir="ltr" inputMode="text" />
        </Field>
      ) : (
        <>
          <Field label={tr('الموبايل', 'Phone')}>
            <input name="phone" required autoComplete="tel" placeholder="01012345678" dir="ltr" inputMode="tel" />
          </Field>
          <Field label={tr('الإيميل (اختياري)', 'Email (optional)')}>
            <input name="email" type="email" maxLength={254} autoComplete="email" placeholder="name@example.com" dir="ltr" />
          </Field>
        </>
      )}
      <Field label={tr('كلمة السر', 'Password')} hint={mode === 'up' ? tr('8 على الأقل', '8+ characters') : undefined}>
        <div className="pw">
          <input name="password" type={show ? 'text' : 'password'} required minLength={mode === 'up' ? 8 : 1} maxLength={200} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} dir="ltr" />
          <button
            type="button"
            className="icon-btn"
            onClick={() => { const next = !show; setShow(next); onMood?.(next ? 'watching' : 'hiding') }}
            aria-label={show ? tr('إخفاء كلمة السر', 'Hide password') : tr('إظهار كلمة السر', 'Show password')}
          >
            {show ? <EyeOff /> : <Eye />}
          </button>
        </div>
      </Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-lg full-w auth-go" type="submit" disabled={busy}>
        {busy ? tr('بيترفع…', 'Lifting…') : mode === 'in' ? <>{tr('افتح الشتر', 'Open the shutter')} <ArrowUpRight /></> : tr('سجّلني', 'Sign me up')}
      </button>
      <button type="button" className="auth-swap" onClick={() => { onMode(mode === 'in' ? 'up' : 'in'); setError('') }}>
        {mode === 'in'
          ? <>{compact ? tr('عميل جديد؟', 'New here?') : tr('أول مرة هنا؟', 'First time here?')} <b>{tr('اكتب اسمك', 'Sign up')}</b></>
          : <>{tr('عندك حساب؟', 'Have an account?')} <b>{tr('ادخل', 'Sign in')}</b></>}
      </button>
    </form>
  )
}

// ───────────────────────── الروبوت (بيتابع المؤشر بعينه) ─────────────────────────

function Robot({ lit, mood, up }: { lit: boolean; mood: Mood; up: boolean }) {
  const ref = useRef<SVGGElement>(null)
  useEffect(() => {
    if (!lit || mood === 'hiding') return
    const node = ref.current
    if (!node) return
    if (mood === 'watching') {
      node.style.setProperty('--px', '0px')
      node.style.setProperty('--py', '3.4px')
      return
    }
    const onMove = (event: PointerEvent) => {
      const box = node.getBoundingClientRect()
      const dx = event.clientX - (box.left + box.width / 2)
      const dy = event.clientY - (box.top + box.height / 2)
      const len = Math.hypot(dx, dy) || 1
      const reach = Math.min(1, len / 240)
      node.style.setProperty('--px', `${((dx / len) * 3.6 * reach).toFixed(2)}px`)
      node.style.setProperty('--py', `${((dy / len) * 3.6 * reach).toFixed(2)}px`)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [lit, mood])

  const mouth = !lit ? 'M52 78h16' : mood === 'error' ? 'M50 82q10-8 20 0' : mood === 'busy' ? 'M56 78h8' : 'M49 76q11 9 22 0'
  return (
    <g ref={ref} className={`bot ${lit ? 'awake' : 'asleep'} mood-${mood}`}>
      <line x1="60" y1="9" x2="60" y2="24" className="bot-line" />
      <circle cx="60" cy="6" r="4.5" className="bot-tip" />
      <rect x="3" y="52" width="14" height="34" rx="7" className="bot-ear" />
      <rect x="103" y="52" width="14" height="34" rx="7" className="bot-ear" />
      <rect x="14" y="22" width="92" height="90" rx="32" className="bot-head" />
      <rect x="26" y="40" width="68" height="46" rx="20" className="bot-screen" />
      {lit ? (
        <g className="bot-eyes">
          {[46, 74].map((x) => (
            <g key={x} transform={`translate(${x} 60)`}>
              <circle r="9.5" className="bot-eye" />
              <circle r="4.4" className="bot-pupil" />
            </g>
          ))}
        </g>
      ) : (
        <g className="bot-closed">
          <path d="M37 61q9 6 18 0M65 61q9 6 18 0" />
        </g>
      )}
      <path d={mouth} className="bot-mouth" />
      {!lit && <text x="100" y="26" className="bot-z">z<tspan dx="3" dy="-7">Z</tspan></text>}
      <clipPath id="bot-clip"><rect x="14" y="22" width="92" height="90" rx="32" /></clipPath>
      <g clipPath="url(#bot-clip)">
        <g className={`bot-hands ${mood === 'hiding' && lit ? 'up' : ''}`}>
          <rect x="30" y="48" width="27" height="26" rx="12" />
          <rect x="63" y="48" width="27" height="26" rx="12" />
        </g>
      </g>
      {up && lit && <circle cx="104" cy="30" r="3.4" className="bot-spark" />}
    </g>
  )
}

// ───────────────────────── المصباح والخيط ─────────────────────────

function Lamp({ lit, onToggle }: { lit: boolean; onToggle: () => void }) {
  const { tr } = useLang()
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ y: number; moved: boolean } | null>(null)

  const down = (event: ReactPointerEvent<SVGGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { y: event.clientY, moved: false }
    setDragging(true)
  }
  const move = (event: ReactPointerEvent<SVGGElement>) => {
    if (!start.current) return
    const dy = Math.max(0, Math.min(44, event.clientY - start.current.y))
    if (dy > 4) start.current.moved = true
    setPull(dy)
  }
  const release = () => {
    if (!start.current) return
    const { moved } = start.current
    const long = pull > 16
    start.current = null
    setDragging(false)
    setPull(0)
    if (long || !moved) onToggle()
  }
  const key = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  const end = 150 + pull
  return (
    <>
      <defs>
        <linearGradient id="lamp-beam" gradientUnits="userSpaceOnUse" x1="0" y1="108" x2="0" y2="356">
          <stop offset="0" stopColor="#7DF3D6" stopOpacity="0.5" />
          <stop offset="1" stopColor="#7DF3D6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lamp-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1B2C38" />
          <stop offset="0.5" stopColor="#4A5C6A" />
          <stop offset="1" stopColor="#16242E" />
        </linearGradient>
        <radialGradient id="lamp-bulb" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#B8FFF0" />
          <stop offset="1" stopColor="#35E0BE" />
        </radialGradient>
      </defs>
      <polygon points="116,110 144,110 236,356 24,356" className={`lamp-beam ${lit ? 'on' : ''}`} fill="url(#lamp-beam)" />
      <g className={`lamp ${lit ? 'on' : ''}`}>
        <line x1="130" y1="0" x2="130" y2="58" className="lamp-wire" />
        <path d="M112 58H148L180 104H80Z" fill="url(#lamp-shade)" className="lamp-shade" />
        <ellipse cx="130" cy="104" rx="50" ry="5" className="lamp-rim" />
        <ellipse cx="130" cy="110" rx="14" ry="8.5" className={`lamp-bulb ${lit ? 'on' : ''}`} fill={lit ? 'url(#lamp-bulb)' : '#2B3B47'} />
        <g
          className={`lamp-cord ${dragging ? 'drag' : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={lit}
          aria-label={lit ? tr('اشدّ الخيط تاني لو عايز تطفّي', 'Pull the cord again to switch off') : tr('اشدّ الخيط عشان تنوّر', 'Pull the cord to switch on')}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={key}
        >
          <rect x="158" y="96" width="30" height="96" fill="transparent" />
          <line x1="173" y1="98" x2={173} y2={end} className="cord-line" />
          <circle cx="173" cy={end + 5} r="6" className="cord-bead" />
          <path d={`M168 ${end + 15}h10l-5 7z`} className="cord-hint" />
        </g>
      </g>
    </>
  )
}

// ───────────────────────── رسايل الروبوت (مش المعتاد) ─────────────────────────

function BotLine({ lit, mood, mode }: { lit: boolean; mood: Mood; mode: Mode }) {
  const { tr } = useLang()
  if (!lit) return <>{tr('…zZz… الأنوار مطفية. شدّ الخيط وصحّيني.', '…zZz… lights are off. Pull the cord, wake me.')}</>
  if (mood === 'hiding') return <>{tr('قفلت عيني. ', 'Eyes shut. ')}<Hue c="amber">{tr('وعد.', 'Promise.')}</Hue></>
  if (mood === 'watching') return <>{tr('تمام، ', 'Got it, ')}<Hue c="sky">{tr('شايفك', 'I see you')}</Hue>{tr('… كمّل.', '… go on.')}</>
  if (mood === 'busy') return <>{tr('ثواني… ', 'Hold on… ')}<Hue c="teal">{tr('بشدّ الشتر.', 'lifting the shutter.')}</Hue></>
  if (mood === 'error') return <>{tr('لأ… ', 'Nope… ')}<Hue c="coral">{tr('مش دي.', 'not that one.')}</Hue>{tr(' جرّب تاني.', ' Try again.')}</>
  return mode === 'in'
    ? <>{tr('نوّرنا… ', 'Lights are on… ')}<Hue c="teal">{tr('مين الزبون؟', 'who’s the customer?')}</Hue></>
    : <>{tr('زبون جديد؟ ', 'A new customer? ')}<Hue c="lilac">{tr('الدفتر فاضي', 'the ledger’s empty')}</Hue>{tr(' ومستنيك.', ' and waiting.')}</>
}

// قطرات المية على الخلفية (ثابتة عشان مفيش اختلاف بين السيرفر والمتصفح)
const DROPS = (() => {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: 34 }, () => ({ x: rand() * 100, y: rand() * 100, s: 6 + rand() ** 2 * 44, o: 0.35 + rand() * 0.65 }))
})()

/** أول شاشة بيشوفها الزائر — المحل «مقفول» لحد ما يشدّ الخيط ويدخل */
export function WelcomeAuthScreen() {
  const { tr } = useLang()
  const [mode, setMode] = useState<Mode>('in')
  const [lit, setLit] = useState(false)
  const [mood, setMood] = useState<Mood>('idle')
  const [swinging, setSwinging] = useState(false)

  const toggle = () => {
    setLit((value) => !value)
    setSwinging(true)
    window.setTimeout(() => setSwinging(false), 900)
  }

  return (
    <main className={`gate ${lit ? 'is-lit' : ''}`}>
      <div className="gate-drops" aria-hidden="true">
        {DROPS.map((drop, index) => (
          <i key={index} style={{ left: `${drop.x}%`, top: `${drop.y}%`, width: drop.s, height: drop.s, opacity: drop.o }} />
        ))}
      </div>
      <div className="gate-top"><LangSwitch /></div>
      <section className="lamp-card">
        <div className="lamp-stage">
          <svg viewBox="0 0 260 360" className={`lamp-svg ${swinging ? 'swing' : ''}`} role="group" aria-label={tr('مصباح', 'Lamp')}>
            <Lamp lit={lit} onToggle={toggle} />
            <g transform="translate(70 226)" aria-hidden="true"><Robot lit={lit} mood={mood} up={mode === 'up'} /></g>
          </svg>
          <p className="bot-say" key={`${lit}-${mood}-${mode}`} aria-live="polite"><BotLine lit={lit} mood={mood} mode={mode} /></p>
        </div>
        <div className="lamp-panel" onFocusCapture={() => !lit && setLit(true)} onPointerDown={() => !lit && setLit(true)}>
          <header className="lamp-head">
            <div className="wordmark" aria-label="RTX SHOP"><span>RTX</span><i /><em>SHOP</em></div>
            <h1>
              {!lit
                ? <>{tr('المحل ', 'We’re ')}<Hue c="amber">{tr('مقفول.', 'closed.')}</Hue></>
                : mode === 'in'
                  ? <>{tr('النور ', 'Lights ')}<Hue c="teal">{tr('ولّع.', 'on.')}</Hue> {tr('إنت ', '')}<Hue c="lilac">{tr('مين؟', 'Who’s there?')}</Hue></>
                  : <>{tr('اكتب اسمك في ', 'Sign the ')}<Hue c="sky">{tr('الدفتر.', 'ledger.')}</Hue></>}
            </h1>
            <p>{lit ? (mode === 'in' ? tr('ادخل بالموبايل وكلمة السر.', 'Phone and password. That’s it.') : tr('ثواني وتبقى منّا.', 'Takes a minute.')) : tr('اشدّ الخيط، أو اضغط على أي حقل.', 'Pull the cord, or tap any field.')}</p>
          </header>
          <AuthForm mode={mode} onMode={setMode} onMood={setMood} />
        </div>
      </section>
    </main>
  )
}

export function AuthModal({ mode, onMode, onClose }: { mode: Mode | null; onMode: (mode: Mode) => void; onClose: () => void }) {
  const { tr } = useLang()
  return (
    <Modal open={mode !== null} onClose={onClose} size="sm">
      <div className="auth-head">
        <span className="auth-icon">{mode === 'up' ? <UserPlus /> : <LogIn />}</span>
        <h2>{mode === 'up' ? tr(`حسابك في ${STORE_NAME}`, `Your ${STORE_NAME} account`) : tr('أهلاً بعودتك', 'Welcome back')}</h2>
        <p>{mode === 'up' ? tr('بالموبايل. ثواني وتخلص.', 'Just your phone. Takes a minute.') : tr('سجّل دخولك وكمّل طلبك.', 'Sign in to finish your order.')}</p>
      </div>
      {mode && <AuthForm mode={mode} onMode={onMode} compact />}
    </Modal>
  )
}
