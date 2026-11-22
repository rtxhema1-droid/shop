'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Hue, useLang, type HueName } from './i18n'

type Line = { pre: string; post: string; sub: string }
type Variant = { ar: Line; en: Line }

/**
 * رسايل الدخول: مش «أهلاً بيك» العادية. كل فترة في اليوم ليها رسالتين،
 * والمتصفح بيختار واحدة عشوائي في كل دخول (والاسم بيتحط بين pre و post).
 */
const BY_PERIOD: Record<'morning' | 'day' | 'evening' | 'night', { hue: HueName; variants: Variant[] }> = {
  morning: {
    hue: 'amber',
    variants: [
      { ar: { pre: 'صباح النور يا ', post: '.', sub: 'الشتر اتفتح قبل القهوة.' }, en: { pre: 'Morning, ', post: '.', sub: 'The shutter went up before the coffee.' } },
      { ar: { pre: 'يوم جديد يا ', post: '.', sub: 'نفّضنا الرفوف عشانك.' }, en: { pre: 'New day, ', post: '.', sub: 'We dusted the shelves for you.' } },
    ],
  },
  day: {
    hue: 'sky',
    variants: [
      { ar: { pre: 'أهلاً يا ', post: '.', sub: 'الرفوف مستنياك من بدري.' }, en: { pre: 'Hey ', post: '.', sub: 'The shelves have been waiting.' } },
      { ar: { pre: 'جيت في وقتك يا ', post: '.', sub: 'كل حاجة في مكانها.' }, en: { pre: 'Perfect timing, ', post: '.', sub: 'Everything’s in its place.' } },
    ],
  },
  evening: {
    hue: 'lilac',
    variants: [
      { ar: { pre: 'مساء الخير يا ', post: '.', sub: 'ولّعنا الأنوار مخصوص.' }, en: { pre: 'Good evening, ', post: '.', sub: 'We switched the lights on just for you.' } },
      { ar: { pre: 'نوّرت يا ', post: '.', sub: '(والمصباح شاهد.)' }, en: { pre: 'You lit the place up, ', post: '.', sub: '(The lamp can confirm.)' } },
    ],
  },
  night: {
    hue: 'coral',
    variants: [
      { ar: { pre: 'لسه صاحي يا ', post: '؟', sub: 'المحل ساهر معاك.' }, en: { pre: 'Still up, ', post: '?', sub: 'The shop’s awake with you.' } },
      { ar: { pre: 'سهرانين سوا يا ', post: '.', sub: 'القهوة عليك.' }, en: { pre: 'Night owls, ', post: '.', sub: 'Coffee’s on you.' } },
    ],
  },
}
const NEWCOMER: Variant = {
  ar: { pre: 'اتكتب اسمك في الدفتر يا ', post: '.', sub: 'أهلاً بيك في المحل.' },
  en: { pre: 'You’re in the ledger, ', post: '.', sub: 'Welcome to the shop.' },
}

const periodOf = (hour: number) => (hour >= 5 && hour < 11 ? 'morning' : hour < 17 && hour >= 11 ? 'day' : hour >= 17 && hour < 23 ? 'evening' : 'night')

/** مدخل المتجر بعد الدخول: شتر المحل بيتفتح (بيطلع لفوق) والرسالة مكتوبة عليه */
export function EntranceIntro({ name, mode, onDone }: { name: string; mode: 'in' | 'up'; onDone: () => void }) {
  const { lang, tr } = useLang()
  const [lifting, setLifting] = useState(false)
  const done = useRef(onDone)
  done.current = onDone
  const reduced = useRef(false)

  const [pick] = useState(() => {
    const hour = new Date().getHours()
    const period = BY_PERIOD[periodOf(hour)]
    if (mode === 'up') return { hue: 'teal' as HueName, variant: NEWCOMER }
    return { hue: period.hue, variant: period.variants[Math.floor(Math.random() * period.variants.length)] }
  })

  useEffect(() => {
    const root = document.documentElement
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    root.dataset.intro = '1'
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => setLifting(true), reduced.current ? 1500 : 3300)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') setLifting(true)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      delete root.dataset.intro
    }
  }, [])

  useEffect(() => {
    if (!lifting) return
    delete document.documentElement.dataset.intro // المتجر يظهر وإحنا بنرفع الشتر
    const timer = window.setTimeout(() => done.current(), reduced.current ? 300 : 1300)
    return () => window.clearTimeout(timer)
  }, [lifting])

  const line = pick.variant[lang]
  const first = name.trim().split(/\s+/)[0] || ''
  const words = (text: string): ReactNode =>
    text.split(' ').filter(Boolean).map((word, index) => (
      <span key={index} className="intro-w" style={{ ['--i' as string]: index }}>{word}</span>
    ))

  return (
    <div className={`intro ${lifting ? 'lift' : ''}`} role="status" aria-live="polite" onClick={() => setLifting(true)}>
      <div className="intro-slats" aria-hidden="true" />
      <div className="intro-core">
        <svg className="intro-mark" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M26 6h12l12 22H14z" className="im-shade" />
          <circle cx="32" cy="34" r="7" className="im-bulb" />
          <path d="M20 40 6 62h52L44 40z" className="im-beam" />
        </svg>
        <div className="wordmark intro-word" aria-label="RTX SHOP"><span>RTX</span><i /><em>SHOP</em></div>
        <p className="intro-hi" lang={lang}>
          {words(line.pre)}
          <span className="intro-w intro-name" style={{ ['--i' as string]: line.pre.split(' ').filter(Boolean).length }}><Hue c="teal">{first}</Hue>{line.post}</span>
        </p>
        <p className="intro-sub"><Hue c={pick.hue}>{line.sub}</Hue></p>
        <button type="button" className="intro-skip" onClick={() => setLifting(true)}>{tr('ادخل', 'Enter')} <span aria-hidden="true">↑</span></button>
      </div>
      <div className="intro-handle" aria-hidden="true" />
    </div>
  )
}
