'use client'

import { createContext, useContext, useEffect, useRef, type FormEvent, type ReactNode, type RefObject } from 'react'
import { PackageOpen, X } from 'lucide-react'
import type { SessionUser } from './types'

export type ShopCtxValue = {
  user: SessionUser | null
  notify: (message: string) => void
  openAuth: (mode: 'in' | 'up') => void
  go: (view: 'store' | 'orders' | 'dash') => void
  reloadCatalog: () => Promise<void>
  reloadDashboard: () => Promise<void>
  signOut: () => Promise<void>
  theme: 'dark' | 'light'
  toggleTheme: () => void
}
export const ShopCtx = createContext<ShopCtxValue | null>(null)
export function useShop() {
  const value = useContext(ShopCtx)
  if (!value) throw new Error('ShopCtx مش موجود')
  return value
}

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : method === 'POST' || method === 'PATCH' ? '{}' : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'حصلت مشكلة — جرب تاني')
  return data as T
}

export const errorText = (reason: unknown, fallback = 'حصلت مشكلة — جرب تاني') => (reason instanceof Error ? reason.message : fallback)

export function formValues(event: FormEvent<HTMLFormElement>) {
  return Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>
}

export const statusLabels: Record<string, string> = {
  new: 'جديد',
  accepted: 'اتقبل',
  rejected: 'اترفض',
  delivered: 'اتسلّم',
  pending: 'مستني تأكيدك',
  confirmed: 'العميل أكد الاستلام',
  disputed: 'العميل بيقول مستلمش',
}

export function discountPercent(price: number, old: number | null | undefined) {
  if (!old || old <= price) return 0
  return Math.round(((old - price) / old) * 100)
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{statusLabels[status] ?? status}</span>
}

/** حالة فاضية: دايماً بتقترح الخطوة الجاية (action) */
export function Empty({ text, icon, action }: { text: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <PackageOpen />}</div>
      <p>{text}</p>
      {action && <div className="empty-actions">{action}</div>}
    </div>
  )
}

/** بيحبس التنقل بالكيبورد جوه النافذة/السلة وبيرجّع التركيز لما تتقفل */
export function useFocusTrap(open: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const node = ref.current
    if (!node) return
    const previous = document.activeElement as HTMLElement | null
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(
        (element) => element.getClientRects().length > 0,
      )
    const first = focusables()[0]
    ;(first ?? node).focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const start = list[0]
      const end = list[list.length - 1]
      if (event.shiftKey && document.activeElement === start) {
        event.preventDefault()
        end.focus()
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault()
        start.focus()
      }
    }
    node.addEventListener('keydown', onKey)
    return () => {
      node.removeEventListener('keydown', onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [open, ref])
}

export function Modal({ open, onClose, title, children, size = 'md' }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  useFocusTrap(open, ref)
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title ?? 'نافذة'} ref={ref} tabIndex={-1}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="إغلاق" type="button"><X /></button>
        {title && <h2 className="modal-title">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

/** بيصغّر الصورة في المتصفح قبل الرفع عشان الموقع يفضل سريع */
export async function imageToDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('الصورة لازم تبقى JPG أو PNG أو WEBP')
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('مقدرتش أقرأ الصورة دي'))
      element.src = url
    })
    for (const [max, quality] of [[900, 0.82], [800, 0.7], [640, 0.6], [480, 0.5]] as const) {
      const scale = Math.min(1, max / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('المتصفح مش بيدعم تجهيز الصور')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const data = canvas.toDataURL('image/jpeg', quality)
      if (data.length < 450_000) return data
    }
    throw new Error('الصورة كبيرة أوي — اختار صورة أصغر')
  } finally {
    URL.revokeObjectURL(url)
  }
}
