'use client'

import { Gem } from 'lucide-react'
import { setFxEnabled, useFxEnabled } from './fx-store'

/** تشغيل/إيقاف تأثيرات الـ 3D (مفيد للأجهزة الضعيفة أو توفير الباقة) */
export function FxToggle() {
  const on = useFxEnabled()
  return (
    <button className={`icon-btn fx-toggle ${on ? 'on' : ''}`} type="button" aria-pressed={on} onClick={() => setFxEnabled(!on)} aria-label={on ? 'إيقاف تأثيرات الـ 3D' : 'تشغيل تأثيرات الـ 3D'} data-tip={on ? 'تأثيرات 3D: شغالة' : 'تأثيرات 3D: مقفولة'}>
      <Gem />
    </button>
  )
}
