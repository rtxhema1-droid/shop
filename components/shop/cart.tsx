'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Minus, MessageCircle, Plus, ShoppingBag, Trash2, Truck, X } from 'lucide-react'
import { MAX_QTY_PER_PRODUCT, PLACEHOLDERS, PROMISE, STORE_NAME } from '@/lib/config'
import { parseEgyptianPhone } from '@/lib/phone'
import { money, whatsappLink } from '@/lib/format'
import { ProductImage } from './product-image'
import { Empty, Field, Modal, api, errorText, formValues, useFocusTrap, useShop } from './shared'
import type { Product, Zone } from './types'

export type CartLine = { product: Product; quantity: number }
export type PlacedOrder = {
  codes: string[]
  lines: CartLine[]
  subtotalCents: number
  shippingCents: number
  zoneName: string
  address: string
  phone: string
}

type Props = {
  open: boolean
  onClose: () => void
  lines: CartLine[]
  zones: Zone[]
  /** حد الشحن المجاني بالقرش (null = مفيش) */
  freeShippingThresholdCents: number | null
  onQty: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onOrdered: (placed: PlacedOrder) => void
}

/** شريط «باقي ليك X جنيه وتوصيلك يبقى مجاني» */
export function FreeShippingBar({ subtotalCents, thresholdCents }: { subtotalCents: number; thresholdCents: number | null }) {
  if (thresholdCents === null || subtotalCents <= 0) return null
  const done = subtotalCents >= thresholdCents
  const percent = Math.min(100, Math.round((subtotalCents / thresholdCents) * 100))
  return (
    <div className={`fs ${done ? 'done' : ''}`} role="status">
      <p>
        {done ? <><CheckCircle2 aria-hidden="true" /> <b>مبروك!</b> توصيلك مجاني</> : <>باقي ليك <b>{money(thresholdCents - subtotalCents)}</b> وتوصيلك يبقى مجاني</>}
      </p>
      <div className="fs-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="التقدم نحو الشحن المجاني"><i style={{ width: `${percent}%` }} /></div>
    </div>
  )
}

export function CartDrawer({ open, onClose, lines, zones, freeShippingThresholdCents, onQty, onRemove, onOrdered }: Props) {
  const { user, openAuth, notify } = useShop()
  const [step, setStep] = useState<'cart' | 'checkout'>('cart')
  const [zoneId, setZoneId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const drawerRef = useRef<HTMLElement>(null)
  useFocusTrap(open, drawerRef)

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) setStep('cart')
  }, [open])
  useEffect(() => {
    if (lines.length === 0) setStep('cart')
  }, [lines.length])

  const sellers = new Set(lines.map((line) => line.product.vendorId)).size
  const zone = zones.find((item) => item.id === zoneId)
  const subtotal = lines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0)
  const freeShipping = freeShippingThresholdCents !== null && subtotal >= freeShippingThresholdCents
  const shipping = zone && !freeShipping ? zone.shippingFeeCents * sellers : 0
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)
  const eta = zone?.deliveryDaysMin != null && zone.deliveryDaysMax != null
    ? zone.deliveryDaysMin === zone.deliveryDaysMax ? `${zone.deliveryDaysMax} يوم` : `من ${zone.deliveryDaysMin} إلى ${zone.deliveryDaysMax} أيام`
    : null

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) {
      notify('سجّل دخول الأول عشان تكمل الطلب')
      openAuth('in')
      return
    }
    if (!zone) {
      setError('اختار المحافظة الأول')
      return
    }
    const values = formValues(event)
    const phone = parseEgyptianPhone(values.phone)
    if (!phone) {
      setPhoneError('رقم الموبايل لازم يبقى مصري زي 01012345678')
      return
    }
    setPhoneError('')
    setBusy(true)
    setError('')
    try {
      const result = await api<{ orders: Array<{ code: string; shippingFeeCents?: number }> }>('orders', 'POST', {
        phone,
        address: values.address,
        notes: values.notes,
        zoneId: zone.id,
        items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      })
      onOrdered({
        codes: result.orders.map((order) => order.code),
        lines,
        subtotalCents: subtotal,
        shippingCents: result.orders.reduce((sum, order) => sum + (order.shippingFeeCents ?? 0), 0),
        zoneName: zone.name,
        address: values.address,
        phone,
      })
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`drawer-wrap ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="سلة المشتريات" ref={drawerRef} tabIndex={-1}>
        <header className="drawer-head">
          {step === 'checkout' ? (
            <button className="icon-btn" onClick={() => setStep('cart')} aria-label="رجوع" type="button"><ArrowRight /></button>
          ) : (
            <span className="drawer-icon"><ShoppingBag /></span>
          )}
          <h2>{step === 'cart' ? `السلة (${count})` : 'إتمام الطلب'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق" type="button"><X /></button>
        </header>

        {lines.length === 0 ? (
          <div className="drawer-body"><Empty text="السلة فاضية." icon={<ShoppingBag />} action={<button type="button" className="btn btn-primary" onClick={onClose}>كمّل تصفّح المنتجات</button>} /></div>
        ) : step === 'cart' ? (
          <>
            <div className="drawer-body">
              <FreeShippingBar subtotalCents={subtotal} thresholdCents={freeShippingThresholdCents} />
              <ul className="cart-list">
                {lines.map(({ product, quantity }) => (
                  <li key={product.id} className="cart-line">
                    <div className="cart-thumb"><ProductImage src={product.imageUrl} alt={product.name} sizes="72px" showPlaceholderText={false} /></div>
                    <div className="cart-info">
                      <strong>{product.name}</strong>
                      <small>{product.storeName}</small>
                      <div className="qty">
                        <button type="button" onClick={() => onQty(product.id, quantity - 1)} aria-label="قلل الكمية"><Minus /></button>
                        <span>{quantity}</span>
                        <button type="button" onClick={() => onQty(product.id, quantity + 1)} disabled={quantity >= Math.min(product.stock, MAX_QTY_PER_PRODUCT)} aria-label="زوّد الكمية"><Plus /></button>
                      </div>
                    </div>
                    <div className="cart-side">
                      <strong>{money(product.priceCents * quantity)}</strong>
                      <button type="button" className="icon-btn danger" onClick={() => onRemove(product.id)} aria-label="شيل من السلة"><Trash2 /></button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <footer className="drawer-foot">
              <div className="sum-row"><span>إجمالي المنتجات</span><strong>{money(subtotal)}</strong></div>
              <p className="muted tiny"><Truck /> {freeShipping ? 'التوصيل مجاني على طلبك ده' : 'الشحن ومدة التوصيل بيتحددوا حسب المحافظة في الخطوة الجاية'}</p>
              <button className="btn btn-primary btn-lg" type="button" onClick={() => setStep('checkout')}>كمّل الطلب</button>
            </footer>
          </>
        ) : (
          <form className="drawer-form" onSubmit={placeOrder}>
            <div className="drawer-body stack">
              {!user && <p className="notice">لازم تسجّل دخول عشان تأكّد الطلب — هنفتحلك الشاشة أول ما تدوس تأكيد.</p>}
              <Field label="رقم موبايلك للتواصل" hint="رقم مصري: 010 / 011 / 012 / 015 وبعدها 8 أرقام">
                <input name="phone" required defaultValue={user?.phone ?? ''} placeholder="01012345678" dir="ltr" inputMode="tel" autoComplete="tel" aria-invalid={phoneError ? true : undefined} aria-describedby={phoneError ? 'phone-error' : undefined} onChange={() => phoneError && setPhoneError('')} />
                {phoneError && <span className="field-error" id="phone-error" role="alert">{phoneError}</span>}
              </Field>
              <Field label="المحافظة">
                <select value={zoneId} onChange={(event) => setZoneId(event.target.value)} required>
                  <option value="">اختار المحافظة…</option>
                  {zones.map((item) => <option key={item.id} value={item.id}>{item.name} — {freeShipping ? 'شحن مجاني' : `شحن ${money(item.shippingFeeCents)}`}</option>)}
                </select>
              </Field>
              <Field label="العنوان بالتفصيل" hint="الشارع، رقم العمارة، الدور، أقرب علامة مميزة">
                <textarea name="address" required rows={3} maxLength={300} placeholder="مثال: 12 شارع التحرير، الدقي، الدور التالت شقة 7" />
              </Field>
              <Field label="ملاحظات (اختياري)">
                <input name="notes" maxLength={300} placeholder="أي حاجة تحب نعرفها عن الطلب" />
              </Field>
              {zone ? (
                eta ? (
                  <div className="eta"><Truck /><div><strong>التوصيل المتوقع لـ {zone.name}: {eta}</strong><span className="muted">من لحظة تأكيد الطلب.</span></div></div>
                ) : (
                  <div className="eta todo"><Truck /><div>{PLACEHOLDERS.delivery}</div></div>
                )
              ) : (
                <p className="muted tiny"><Truck /> اختار المحافظة عشان تشوف مدة التوصيل المتوقعة قبل التأكيد.</p>
              )}
              <FreeShippingBar subtotalCents={subtotal} thresholdCents={freeShippingThresholdCents} />
              <div className="summary">
                <div className="sum-row"><span>المنتجات ({count})</span><span>{money(subtotal)}</span></div>
                <div className="sum-row"><span>الشحن{sellers > 1 && !freeShipping ? ` (${sellers} تجار)` : ''}</span><span>{freeShipping ? 'مجاني' : zone ? money(shipping) : '—'}</span></div>
                <div className="sum-row total"><span>الإجمالي عند الاستلام</span><strong>{money(subtotal + shipping)}</strong></div>
                <p className="muted tiny">{PROMISE} — مفيش أي دفع أونلاين.</p>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
            <footer className="drawer-foot">
              <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? 'بنسجل طلبك…' : 'تأكيد الطلب'}</button>
            </footer>
          </form>
        )}
      </aside>
    </div>
  )
}

export function OrderSuccess({ placed, onClose, onOrders }: { placed: PlacedOrder | null; onClose: () => void; onOrders: () => void }) {
  const { user } = useShop()
  if (!placed) return <Modal open={false} onClose={onClose}><span /></Modal>
  const total = placed.subtotalCents + placed.shippingCents
  const text = [
    `أهلاً ${STORE_NAME}`,
    `أنا ${user?.name ?? ''} وعملت طلب جديد${placed.codes.length ? ` (رقم ${placed.codes.join(' + ')})` : ''}.`,
    '',
    'المنتجات:',
    ...placed.lines.map((line) => `• ${line.product.name} × ${line.quantity} — ${money(line.product.priceCents * line.quantity)}`),
    '',
    `الإجمالي عند الاستلام: ${money(total)} (شامل الشحن)`,
    `المحافظة: ${placed.zoneName}`,
    `العنوان: ${placed.address}`,
    `موبايلي: ${placed.phone}`,
  ].join('\n')
  return (
    <Modal open onClose={onClose} size="sm">
      <div className="success">
        <span className="success-icon"><CheckCircle2 /></span>
        <h2>طلبك اتسجّل بنجاح</h2>
        <p>رقم الطلب: <b dir="ltr">{placed.codes.join(' · ')}</b></p>
        <p className="muted">هنتواصل معاك لتأكيد الطلب، وتدفع كاش عند الاستلام. الإجمالي: <b>{money(total)}</b></p>
        <a className="btn btn-wa btn-lg" href={whatsappLink(text)} target="_blank" rel="noopener noreferrer"><MessageCircle /> ابعت تفاصيل الطلب على واتساب</a>
        <button className="btn btn-ghost" type="button" onClick={onOrders}>تابع طلباتي</button>
      </div>
    </Modal>
  )
}
