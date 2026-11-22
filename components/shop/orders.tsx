'use client'

import { Check, MapPin, MessageCircle, Phone, Truck, X } from 'lucide-react'
import { STORE_NAME } from '@/lib/config'
import { whatsappLink } from '@/lib/format'
import { Empty, StatusBadge, api, errorText, useShop, useStatusLabel } from './shared'
import type { Order } from './types'
import { useState } from 'react'
import { useLang } from './i18n'

export const orderCode = (id: string) => id.slice(0, 8).toUpperCase()
const customerWhatsApp = (phone: string) => `https://wa.me/2${phone.replace(/\D/g, '')}`

function Steps({ status }: { status: Order['status'] }) {
  const { tr } = useLang()
  if (status === 'rejected') return <div className="steps rejected"><span className="step on">{tr('الطلب اترفض', 'Order rejected')}</span></div>
  const order = ['new', 'accepted', 'delivered']
  const index = order.indexOf(status)
  const labels = [tr('اتسجّل', 'Placed'), tr('اتقبل وبيتجهّز', 'Accepted'), tr('اتسلّم', 'Delivered')]
  return (
    <div className="steps">
      {labels.map((label, position) => (
        <span key={label} className={`step ${position <= index ? 'on' : ''}`}>{label}</span>
      ))}
    </div>
  )
}

type Props = {
  order: Order
  mode: 'customer' | 'staff'
  canManage?: boolean
  busy?: boolean
  onAction?: (id: string, action: 'accept' | 'reject' | 'deliver') => void
  onVerify?: (id: string, confirmed: boolean) => void
}

export function OrderCard({ order, mode, canManage = false, busy = false, onAction, onVerify }: Props) {
  const { tr, m, d } = useLang()
  const label = useStatusLabel()
  const total = order.subtotalCents + order.shippingFeeCents
  const staff = mode === 'staff'
  return (
    <article className={`order status-${order.status}`}>
      <header className="order-head">
        <div>
          <strong className="order-code" dir="ltr">#{orderCode(order.id)}</strong>
          <small>{d(order.createdAt)}</small>
        </div>
        <StatusBadge status={order.status} />
      </header>
      {!staff && <Steps status={order.status} />}
      <ul className="order-items">
        {order.items.map((item) => (
          <li key={`${order.id}-${item.productId}`}>
            <span>{item.name} <b>× {item.quantity}</b></span>
            <span>{m(item.unitPriceCents * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="order-meta">
        {staff ? (
          <>
            <span><b>{order.customerName}</b></span>
            <a className="meta-link" href={`tel:${order.customerPhone}`}><Phone /> <span dir="ltr">{order.customerPhone}</span></a>
            <a className="meta-link wa" href={customerWhatsApp(order.customerPhone)} target="_blank" rel="noopener noreferrer"><MessageCircle /> {tr('واتساب العميل', 'Customer WhatsApp')}</a>
          </>
        ) : (
          <span>{tr('البائع:', 'Seller:')} <b>{order.storeName}</b></span>
        )}
        <span className="meta-addr"><MapPin /> {order.zoneName} — {order.deliveryAddress}</span>
        {order.notes && <span className="meta-note">{tr('ملاحظات:', 'Notes:')} {order.notes}</span>}
        {staff && <span className="muted">{tr('المتجر:', 'Store:')} {order.storeName}</span>}
      </div>
      <div className="order-totals">
        <div><span>{tr('المنتجات', 'Items')}</span><span>{m(order.subtotalCents)}</span></div>
        <div><span>{tr('الشحن', 'Shipping')}</span><span>{m(order.shippingFeeCents)}</span></div>
        <div className="grand"><span>{tr('الإجمالي عند الاستلام', 'Total on delivery')}</span><strong>{m(total)}</strong></div>
        {staff && order.commissionCents !== undefined && (
          <div className="commission"><span>{tr('عمولة المنصة', 'Platform commission')}</span><span>{m(order.commissionCents)}</span></div>
        )}
      </div>
      {order.status === 'delivered' && (
        <p className="verify-line">{tr('تأكيد العميل:', 'Customer confirmation:')} <b>{label(order.customerVerification)}</b></p>
      )}
      <footer className="order-actions">
        {staff && canManage && order.status === 'new' && (
          <>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => onAction?.(order.id, 'accept')}><Check /> {tr('قبول', 'Accept')}</button>
            <button className="btn btn-outline" type="button" disabled={busy} onClick={() => onAction?.(order.id, 'reject')}><X /> {tr('رفض', 'Reject')}</button>
          </>
        )}
        {staff && canManage && order.status === 'accepted' && (
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => onAction?.(order.id, 'deliver')}><Truck /> {tr('تم التسليم', 'Mark delivered')}</button>
        )}
        {!staff && order.status === 'delivered' && order.customerVerification === 'pending' && (
          <>
            <span className="muted">{tr('استلمت طلبك؟', 'Got your order?')}</span>
            <button className="btn btn-primary" type="button" onClick={() => onVerify?.(order.id, true)}>{tr('أيوه استلمت', 'Yes, received')}</button>
            <button className="btn btn-outline" type="button" onClick={() => onVerify?.(order.id, false)}>{tr('لسه مستلمتش', 'Not yet')}</button>
          </>
        )}
        {!staff && (
          <a className="btn btn-wa" href={whatsappLink(`أهلاً ${STORE_NAME}، بخصوص طلبي رقم ${orderCode(order.id)}`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> {tr('اسأل عن الطلب', 'Ask about this order')}</a>
        )}
      </footer>
    </article>
  )
}

export function CustomerOrders({ orders, onChanged, onShop }: { orders: Order[]; onChanged: () => Promise<void>; onShop: () => void }) {
  const { tr } = useLang()
  const { notify } = useShop()
  async function verify(id: string, confirmed: boolean) {
    try {
      await api(`orders/${id}/verify`, 'POST', { confirmed })
      await onChanged()
      notify(confirmed ? tr('شكراً ليك، نورتنا.', 'Thanks! Glad to have you.') : tr('وصلنا بلاغك وهنتواصل معاك في أقرب وقت.', 'Got your report. We’ll contact you shortly.'))
    } catch (reason) {
      notify(errorText(reason))
    }
  }
  return (
    <section className="section page-narrow">
      <div className="section-head"><div><h2>{tr('طلباتي', 'My orders')}</h2><p className="muted">{tr('حالة كل طلباتك هنا.', 'Track every order here.')}</p></div></div>
      {orders.length === 0 ? (
        <div>
          <Empty text={tr('لسه معملتش أي طلب.', 'No orders yet.')} />
          <div className="more"><button className="btn btn-primary btn-lg" type="button" onClick={onShop}>{tr('ابدأ التسوّق', 'Start shopping')}</button></div>
        </div>
      ) : (
        <div className="orders">
          {orders.map((order) => <OrderCard key={order.id} order={order} mode="customer" onVerify={verify} />)}
        </div>
      )}
    </section>
  )
}

export function useOrderActions(reload: () => Promise<void>) {
  const { tr } = useLang()
  const { notify } = useShop()
  const [busyId, setBusyId] = useState('')
  async function act(id: string, action: 'accept' | 'reject' | 'deliver') {
    setBusyId(id)
    try {
      await api(`orders/${id}/status`, 'PATCH', { action })
      await reload()
      notify(action === 'deliver' ? tr('تم تأكيد التسليم وإضافة العمولة', 'Delivery confirmed, commission added') : action === 'accept' ? tr('الطلب اتقبل', 'Order accepted') : tr('الطلب اترفض والمخزون رجع.', 'Order rejected, stock restored.'))
    } catch (reason) {
      notify(errorText(reason))
    } finally {
      setBusyId('')
    }
  }
  return { busyId, act }
}
