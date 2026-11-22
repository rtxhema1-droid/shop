'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Minus, MessageCircle, Plus, ShoppingBag, Trash2, Truck, X } from 'lucide-react'
import { MAX_QTY_PER_PRODUCT, PLACEHOLDERS, STORE_NAME } from '@/lib/config'
import { parseEgyptianPhone } from '@/lib/phone'
import { money, whatsappLink } from '@/lib/format'
import { ProductImage } from './product-image'
import { Empty, Field, Modal, api, errorText, formValues, useFocusTrap, useShop } from './shared'
import type { Product, Zone } from './types'
import { useLang } from './i18n'

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
  onQty: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onOrdered: (placed: PlacedOrder) => void
}

export function CartDrawer({ open, onClose, lines, zones, onQty, onRemove, onOrdered }: Props) {
  const { tr, m } = useLang()
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
  const shipping = zone ? zone.shippingFeeCents * sellers : 0
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)
  const eta = zone?.deliveryDaysMin != null && zone.deliveryDaysMax != null
    ? zone.deliveryDaysMin === zone.deliveryDaysMax ? tr(`${zone.deliveryDaysMax} يوم`, `${zone.deliveryDaysMax} day(s)`) : tr(`من ${zone.deliveryDaysMin} إلى ${zone.deliveryDaysMax} أيام`, `${zone.deliveryDaysMin}–${zone.deliveryDaysMax} days`)
    : null

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) {
      notify(tr('سجّل دخول الأول عشان تكمل الطلب', 'Sign in first to place your order'))
      openAuth('in')
      return
    }
    if (!zone) {
      setError(tr('اختار المحافظة الأول', 'Pick a governorate first'))
      return
    }
    const values = formValues(event)
    const phone = parseEgyptianPhone(values.phone)
    if (!phone) {
      setPhoneError(tr('رقم الموبايل لازم يبقى مصري زي 01012345678', 'Use an Egyptian number like 01012345678'))
      return
    }
    setPhoneError('')
    setBusy(true)
    setError('')
    try {
      const result = await api<{ orders: Array<{ code: string }> }>('orders', 'POST', {
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
        shippingCents: shipping,
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
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={tr('سلة المشتريات', 'Shopping cart')} ref={drawerRef} tabIndex={-1}>
        <header className="drawer-head">
          {step === 'checkout' ? (
            <button className="icon-btn" onClick={() => setStep('cart')} aria-label={tr('رجوع', 'Back')} type="button"><ArrowRight /></button>
          ) : (
            <span className="drawer-icon"><ShoppingBag /></span>
          )}
          <h2>{step === 'cart' ? tr(`السلة (${count})`, `Cart (${count})`) : tr('إتمام الطلب', 'Checkout')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={tr('إغلاق', 'Close')} type="button"><X /></button>
        </header>

        {lines.length === 0 ? (
          <div className="drawer-body"><Empty text={tr('السلة فاضية.', 'Your cart is empty.')} icon={<ShoppingBag />} action={<button type="button" className="btn btn-primary" onClick={onClose}>{tr('كمّل تصفّح المنتجات', 'Keep browsing')}</button>} /></div>
        ) : step === 'cart' ? (
          <>
            <div className="drawer-body">
              <ul className="cart-list">
                {lines.map(({ product, quantity }) => (
                  <li key={product.id} className="cart-line">
                    <div className="cart-thumb"><ProductImage src={product.imageUrl} alt={product.name} sizes="72px" showPlaceholderText={false} /></div>
                    <div className="cart-info">
                      <strong>{product.name}</strong>
                      <small>{product.storeName}</small>
                      <div className="qty">
                        <button type="button" onClick={() => onQty(product.id, quantity - 1)} aria-label={tr('قلل الكمية', 'Decrease quantity')}><Minus /></button>
                        <span>{quantity}</span>
                        <button type="button" onClick={() => onQty(product.id, quantity + 1)} disabled={quantity >= Math.min(product.stock, MAX_QTY_PER_PRODUCT)} aria-label={tr('زوّد الكمية', 'Increase quantity')}><Plus /></button>
                      </div>
                    </div>
                    <div className="cart-side">
                      <strong>{m(product.priceCents * quantity)}</strong>
                      <button type="button" className="icon-btn danger" onClick={() => onRemove(product.id)} aria-label={tr('شيل من السلة', 'Remove from cart')}><Trash2 /></button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <footer className="drawer-foot">
              <div className="sum-row"><span>{tr('إجمالي المنتجات', 'Subtotal')}</span><strong>{m(subtotal)}</strong></div>
              <p className="muted tiny"><Truck /> {tr('الشحن والتوصيل حسب المحافظة في الخطوة الجاية.', 'Shipping and delivery time depend on your governorate (next step).')}</p>
              <button className="btn btn-primary btn-lg" type="button" onClick={() => setStep('checkout')}>{tr('كمّل الطلب', 'Continue')}</button>
            </footer>
          </>
        ) : (
          <form className="drawer-form" onSubmit={placeOrder}>
            <div className="drawer-body stack">
              {!user && <p className="notice">{tr('سجّل دخول عشان تأكّد الطلب.', 'Sign in to confirm your order.')}</p>}
              <Field label={tr('رقم موبايلك للتواصل', 'Your phone number')} hint={tr('رقم مصري: 010 / 011 / 012 / 015 وبعدها 8 أرقام', 'Egyptian number: 010 / 011 / 012 / 015 + 8 digits')}>
                <input name="phone" required defaultValue={user?.phone ?? ''} placeholder="01012345678" dir="ltr" inputMode="tel" autoComplete="tel" aria-invalid={phoneError ? true : undefined} aria-describedby={phoneError ? 'phone-error' : undefined} onChange={() => phoneError && setPhoneError('')} />
                {phoneError && <span className="field-error" id="phone-error" role="alert">{phoneError}</span>}
              </Field>
              <Field label={tr('المحافظة', 'Governorate')}>
                <select value={zoneId} onChange={(event) => setZoneId(event.target.value)} required>
                  <option value="">{tr('اختار المحافظة…', 'Choose governorate…')}</option>
                  {zones.map((item) => <option key={item.id} value={item.id}>{item.name} {tr('— شحن', '— shipping')} {m(item.shippingFeeCents)}</option>)}
                </select>
              </Field>
              <Field label={tr('العنوان بالتفصيل', 'Full address')} hint={tr('الشارع، رقم العمارة، الدور، أقرب علامة مميزة', 'Street, building, floor, nearest landmark')}>
                <textarea name="address" required rows={3} maxLength={300} placeholder={tr('مثال: 12 شارع التحرير، الدقي، الدور التالت شقة 7', 'e.g. 12 Tahrir St, Dokki, 3rd floor, apt 7')} />
              </Field>
              <Field label={tr('ملاحظات (اختياري)', 'Notes (optional)')}>
                <input name="notes" maxLength={300} placeholder={tr('أي حاجة تحب نعرفها عن الطلب', 'Anything we should know?')} />
              </Field>
              {zone ? (
                eta ? (
                  <div className="eta"><Truck /><div><strong>{tr('التوصيل المتوقع لـ', 'Expected delivery to')} {zone.name}: {eta}</strong><span className="muted">{tr('من لحظة تأكيد الطلب.', 'Counted from order confirmation.')}</span></div></div>
                ) : (
                  <div className="eta todo"><Truck /><div>{tr(PLACEHOLDERS.delivery, '[Delivery time — set by the owner]')}</div></div>
                )
              ) : (
                <p className="muted tiny"><Truck /> {tr('اختار المحافظة عشان تشوف مدة التوصيل.', 'Choose a governorate to see the delivery time.')}</p>
              )}
              <div className="summary">
                <div className="sum-row"><span>{tr('المنتجات', 'Items')} ({count})</span><span>{m(subtotal)}</span></div>
                <div className="sum-row"><span>{tr('الشحن', 'Shipping')}{sellers > 1 ? tr(` (${sellers} تجار)`, ` (${sellers} sellers)`) : ''}</span><span>{zone ? m(shipping) : '—'}</span></div>
                <div className="sum-row total"><span>{tr('الإجمالي عند الاستلام', 'Total on delivery')}</span><strong>{m(subtotal + shipping)}</strong></div>
                <p className="muted tiny">{tr('كاش عند الاستلام — مفيش دفع أونلاين.', 'Cash on delivery. No online payment.')}</p>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
            <footer className="drawer-foot">
              <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? tr('بنسجل طلبك…', 'Placing order…') : tr('تأكيد الطلب', 'Place order')}</button>
            </footer>
          </form>
        )}
      </aside>
    </div>
  )
}

export function OrderSuccess({ placed, onClose, onOrders }: { placed: PlacedOrder | null; onClose: () => void; onOrders: () => void }) {
  const { tr, m } = useLang()
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
        <h2>{tr('طلبك اتسجّل بنجاح', 'Order placed!')}</h2>
        <p>{tr('رقم الطلب:', 'Order no.:')} <b dir="ltr">{placed.codes.join(' · ')}</b></p>
        <p className="muted">{tr('هنكلّمك نأكّد، وتدفع كاش عند الاستلام. الإجمالي:', 'We’ll call to confirm. You pay cash on arrival. Total:')} <b>{m(total)}</b></p>
        <a className="btn btn-wa btn-lg" href={whatsappLink(text)} target="_blank" rel="noopener noreferrer"><MessageCircle /> {tr('ابعت تفاصيل الطلب على واتساب', 'Send details on WhatsApp')}</a>
        <button className="btn btn-ghost" type="button" onClick={onOrders}>{tr('تابع طلباتي', 'Track my orders')}</button>
      </div>
    </Modal>
  )
}
