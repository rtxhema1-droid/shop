'use client'

import { useEffect, useRef, useState } from 'react'

const two = (n: number) => String(n).padStart(2, '0')

/**
 * عداد تنازلي لحد موعد انتهاء العرض. بيتحسب على وقت السيرفر (serverNow) عشان ساعة جهاز العميل متأثرش.
 * مبيرسمش الأرقام إلا بعد التحميل في المتصفح (عشان ميبقاش في اختلاف بين السيرفر والمتصفح).
 */
export function Countdown({ endsAt, serverNow, onExpire }: { endsAt: string; serverNow: string; onExpire?: () => void }) {
  const [left, setLeft] = useState<number | null>(null)
  const expired = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    expired.current = false
    const skew = Date.parse(serverNow) - Date.now()
    const end = Date.parse(endsAt)
    const tick = () => {
      const remaining = Math.max(0, end - (Date.now() + skew))
      setLeft(remaining)
      if (remaining === 0 && !expired.current) {
        expired.current = true
        onExpireRef.current?.()
      }
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [endsAt, serverNow])

  const total = left === null ? null : Math.floor(left / 1000)
  const days = total === null ? 0 : Math.floor(total / 86400)
  const hours = total === null ? 0 : Math.floor((total % 86400) / 3600)
  const minutes = total === null ? 0 : Math.floor((total % 3600) / 60)
  const seconds = total === null ? 0 : total % 60
  const text = (value: number) => (total === null ? '--' : two(value))
  return (
    <div className="cd" dir="ltr" role="timer" aria-label="الوقت المتبقي على انتهاء العرض">
      {days > 0 && <><b>{days}<small>يوم</small></b><i>:</i></>}
      <b>{text(hours)}<small>ساعة</small></b><i>:</i>
      <b>{text(minutes)}<small>دقيقة</small></b><i>:</i>
      <b>{text(seconds)}<small>ثانية</small></b>
    </div>
  )
}
