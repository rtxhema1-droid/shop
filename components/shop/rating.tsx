'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

/** متوسط التقييم المختصر على كارت المنتج: ★ 4.5 (12). مبيظهرش لو مفيش تقييمات. */
export function RatingBadge({ avg, count }: { avg: number | null | undefined; count: number | null | undefined }) {
  if (!count || avg == null) return null
  return (
    <span className="rating" aria-label={`التقييم ${avg} من 5 (${count} تقييم)`}>
      <Star aria-hidden="true" />
      <b>{avg}</b>
      <span>({count})</span>
    </span>
  )
}

/** 5 نجوم للعرض فقط */
export function StarsRow({ value, size = 'md' }: { value: number; size?: 'md' | 'lg' }) {
  return (
    <span className={`stars stars-${size}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n <= Math.round(value) ? 'on' : ''} />)}
    </span>
  )
}

/** اختيار التقييم (1–5) */
export function StarsInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="stars-input" role="radiogroup" aria-label="تقييمك من 5 نجوم" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} نجوم`} className={n <= shown ? 'on' : ''} onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(0)} onClick={() => onChange(n)}>
          <Star />
        </button>
      ))}
    </div>
  )
}
