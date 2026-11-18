'use client'

import { Check, MapPin, MessageCircle, Phone, Truck, X } from 'lucide-react'
import { STORE_NAME } from '@/lib/config'
import { dateLabel, money, whatsappLink } from '@/lib/format'
import { Empty, StatusBadge, api, errorText, statusLabels, useShop } from './shared'
import type { Order } from './types'
import { useState } from 'react'

export const orderCode = (id: string) => id.slice(0, 8).toUpperCase()
const customerWhatsApp = (phone: string) => `https://wa.me/2${phone.replace(/\D/g, '')}`

function Steps({ status }: { status: Order['status'] }) {
  if (status === 'rejected') return <div className="steps rejected"><span className="step on">الطلب اترفض</span></div>
  const order = ['new', 'accepted', 'delivered']
  const index = order.indexOf(status)
  const labels = ['اتسجّل', 'اتقبل وبيتجهّز', 'اتسلّم']
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
  const total = order.subtotalCents + order.shippingFeeCents
  const staff = mode === 'staff'
  return (
    <article className={`order status-${order.status}`}>
      <header className="order-head">
        <div>
          <strong className="order-code" dir="ltr">#{orderCode(order.id)}</strong>
          <small>{dateLabel(order.createdAt)}</small>
        </div>
        <StatusBadge status={order.status} />
      </header>
      {!staff && <Steps status={order.status} />}
      <ul className="order-items">
        {order.items.map((item) => (
          <li key={`${order.id}-${item.productId}`}>
            <span>{item.name} <b>× {item.quantity}</b></span>
            <span>{money(item.unitPriceCents * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="order-meta">
        {staff ? (
          <>
            <span><b>{order.customerName}</b></span>
            <a className="meta-link" href={`tel:${order.customerPhone}`}><Phone /> <span dir="ltr">{order.customerPhone}</span></a>
            <a className="meta-link wa" href={customerWhatsApp(order.customerPhone)} target="_blank" rel="noopener noreferrer"><MessageCircle /> واتساب العميل</a>
          </>
        ) : (
          <span>البائع: <b>{order.storeName}</b></span>
        )}
        <span className="meta-addr"><MapPin /> {order.zoneName} — {order.deliveryAddress}</span>
        {order.notes && <span className="meta-note">ملاحظات: {order.notes}</span>}
        {staff && <span className="muted">المتجر: {order.storeName}</span>}
      </div>
      <div className="order-totals">
        <div><span>المنتجات</span><span>{money(order.subtotalCents)}</span></div>
        <div><span>الشحن</span><span>{money(order.shippingFeeCents)}</span></div>
        <div className="grand"><span>الإجمالي عند الاستلام</span><strong>{money(total)}</strong></div>
        {staff && order.commissionCents !== undefined && (
          <div className="commission"><span>عمولة المنصة</span><span>{money(order.commissionCents)}</span></div>
        )}
      </div>
      {order.status === 'delivered' && (
        <p className="verify-line">تأكيد العميل: <b>{statusLabels[order.customerVerification]}</b></p>
      )}
      <footer className="order-actions">
        {staff && canManage && order.status === 'new' && (
          <>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => onAction?.(order.id, 'accept')}><Check /> قبول</button>
            <button className="btn btn-outline" type="button" disabled={busy} onClick={() => onAction?.(order.id, 'reject')}><X /> رفض</button>
          </>
        )}
        {staff && canManage && order.status === 'accepted' && (
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => onAction?.(order.id, 'deliver')}><Truck /> تم التسليم</button>
        )}
        {!staff && order.status === 'delivered' && order.customerVerification === 'pending' && (
          <>
            <span className="muted">استلمت طلبك؟</span>
            <button className="btn btn-primary" type="button" onClick={() => onVerify?.(order.id, true)}>أيوه استلمت</button>
            <button className="btn btn-outline" type="button" onClick={() => onVerify?.(order.id, false)}>لسه مستلمتش</button>
          </>
        )}
        {!staff && (
          <a className="btn btn-wa" href={whatsappLink(`أهلاً ${STORE_NAME}، بخصوص طلبي رقم ${orderCode(order.id)}`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> اسأل عن الطلب</a>
        )}
      </footer>
    </article>
  )
}

export function CustomerOrders({ orders, onChanged, onShop }: { orders: Order[]; onChanged: () => Promise<void>; onShop: () => void }) {
  const { notify } = useShop()
  async function verify(id: string, confirmed: boolean) {
    try {
      await api(`orders/${id}/verify`, 'POST', { confirmed })
      await onChanged()
      notify(confirmed ? 'شكراً ليك، نورتنا.' : 'وصلنا بلاغك وهنتواصل معاك في أقرب وقت.')
    } catch (reason) {
      notify(errorText(reason))
    }
  }
  return (
    <section className="section page-narrow">
      <div className="section-head"><div><h2>طلباتي</h2><p className="muted">تابع حالة كل طلباتك من هنا</p></div></div>
      {orders.length === 0 ? (
        <div>
          <Empty text="لسه معملتش أي طلب." />
          <div className="more"><button className="btn btn-primary btn-lg" type="button" onClick={onShop}>ابدأ التسوّق</button></div>
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
  const { notify } = useShop()
  const [busyId, setBusyId] = useState('')
  async function act(id: string, action: 'accept' | 'reject' | 'deliver') {
    setBusyId(id)
    try {
      await api(`orders/${id}/status`, 'PATCH', { action })
      await reload()
      notify(action === 'deliver' ? 'تم تأكيد التسليم وإضافة العمولة' : action === 'accept' ? 'الطلب اتقبل' : 'الطلب اترفض والمخزون رجع.')
    } catch (reason) {
      notify(errorText(reason))
    } finally {
      setBusyId('')
    }
  }
  return { busyId, act }
}
