'use client'

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import { dateLabel, money } from '@/lib/format'

/**
 * نظام اللغة (عربي / English).
 * الاستخدام: const { tr, m, d } = useLang()
 *   tr('نص عربي', 'English text')  ← بيرجّع النص حسب اللغة الحالية
 *   m(cents)                       ← السعر (جنيه / EGP)
 *   d(date)                        ← التاريخ
 * اللغة بتتحفظ في localStorage وبتغيّر lang/dir على <html> (RTL ↔ LTR) من غير ريفريش.
 */
export type Lang = 'ar' | 'en'
const KEY = 'rtx-lang'

type LangValue = {
  lang: Lang
  dir: 'rtl' | 'ltr'
  setLang: (lang: Lang) => void
  tr: (ar: string, en: string) => string
  m: (cents: number | null | undefined) => string
  d: (value: string | number | Date) => string
}

const enMoney = new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 })
const enDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const fallback: LangValue = {
  lang: 'ar',
  dir: 'rtl',
  setLang: () => {},
  tr: (ar) => ar,
  m: (cents) => money(cents),
  d: (value) => dateLabel(value),
}
const LangCtx = createContext<LangValue>(fallback)

/** لغة الصفحة الحالية للدوال اللي برّه React (زي رسائل الأخطاء) */
let current: Lang = 'ar'
export const currentLang = () => current

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar')

  // أول تحميل: اللغة المحفوظة (السكريبت في <head> بيظبط الاتجاه قبل الرسم)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      if (saved === 'en' || saved === 'ar') setLangState(saved)
    } catch {
      /* تجاهل */
    }
  }, [])

  useEffect(() => {
    current = lang
    const root = document.documentElement
    root.lang = lang
    root.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = lang === 'ar' ? 'RTX SHOP | كاش عند الاستلام' : 'RTX SHOP | Cash on delivery'
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* تجاهل */
    }
  }, [])

  const value = useMemo<LangValue>(
    () => ({
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      setLang,
      tr: (ar, en) => (lang === 'ar' ? ar : en),
      m: (cents) => (lang === 'ar' ? money(cents) : enMoney.format((cents ?? 0) / 100).replace(/\.00$/, '')),
      d: (input) => (lang === 'ar' ? dateLabel(input) : enDate.format(new Date(input))),
    }),
    [lang, setLang],
  )
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

export const useLang = () => useContext(LangCtx)

/** زر تبديل اللغة: كبسولة زجاجية بمؤشر بينزلق بين «عربي» و«EN» */
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang()
  const group = useId()
  return (
    <LayoutGroup id={`lang-${group}`}>
      <div className={`lang-switch ${className}`} role="group" aria-label="Language / اللغة">
        {(['ar', 'en'] as const).map((item) => (
          <button key={item} type="button" lang={item} className={lang === item ? 'on' : ''} aria-pressed={lang === item} onClick={() => setLang(item)}>
            {lang === item && <motion.span layoutId="lang-pill" className="lang-pill" transition={{ type: 'spring', stiffness: 460, damping: 34 }} />}
            <span>{item === 'ar' ? 'عربي' : 'EN'}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  )
}

/** كلمة ملوّنة: <Hue c="teal">كاش</Hue> — الألوان متنوعة ومضبوطة في CSS (--hue-*) */
export type HueName = 'teal' | 'amber' | 'sky' | 'lilac' | 'coral' | 'mist'
export function Hue({ c, children }: { c: HueName; children: ReactNode }) {
  return <span className={`hue hue-${c}`}>{children}</span>
}
