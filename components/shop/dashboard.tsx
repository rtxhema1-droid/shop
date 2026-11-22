'use client'

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  Bell, CheckCheck, ChevronLeft, CircleDollarSign, Clock3, ImagePlus, KeyRound, LayoutDashboard, LayoutGrid, LogOut,
  Package, Pencil, Plus, Save, Search, ShoppingBag, Store, Trash2, Truck, Users, Wallet, X,
} from 'lucide-react'
import { Eye, EyeOff } from 'lucide-react'
import { buildTree, categoryPath, countByCategory } from './category-utils'
import { OrderCard, orderCode, useOrderActions } from './orders'
import { Empty, Field, Modal, StatusBadge, api, errorText, formValues, imageToDataUrl, useShop } from './shared'
import type { Category, Dashboard, Order, Product, SessionUser, Zone } from './types'
import { Hue, LangSwitch, useLang } from './i18n'

type Props = { user: SessionUser; dashboard: Dashboard; categories: Category[]; zones: Zone[]; reload: () => Promise<void>; reloadCatalog: () => Promise<void>; onStore: () => void }

const permissionOptions = [
  { key: 'manage_products', ar: 'إدارة المنتجات (إضافة وتعديل وحذف)', en: 'Manage products (add, edit, delete)' },
  { key: 'view_orders', ar: 'عرض طلبات المتجر', en: 'View store orders' },
  { key: 'manage_orders', ar: 'تحديث حالة الطلبات (قبول / رفض / تسليم)', en: 'Update order status (accept / reject / deliver)' },
] as const

type Tone = 'teal' | 'sky' | 'amber' | 'lilac' | 'coral' | 'green' | 'blue' | 'purple'

function Metric({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note?: string; tone: Tone }) {
  return (
    <article className="metric">
      <span className={`metric-icon tone-${tone}`}>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
      {note && <em>{note}</em>}
    </article>
  )
}

const STATUS_COLOR: Record<string, string> = { new: 'var(--hue-amber)', accepted: 'var(--hue-sky)', delivered: 'var(--hue-teal)', rejected: 'var(--hue-coral)' }

/** أعمدة الطلبات لآخر 7 أيام */
function WeekBars({ orders }: { orders: Order[] }) {
  const { tr, lang, m } = useLang()
  const days = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' })
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date()
      day.setHours(0, 0, 0, 0)
      day.setDate(day.getDate() - (6 - index))
      const next = new Date(day)
      next.setDate(next.getDate() + 1)
      const inDay = orders.filter((order) => {
        const at = new Date(order.createdAt)
        return at >= day && at < next
      })
      const sales = inDay.filter((order) => order.status !== 'rejected').reduce((sum, order) => sum + order.subtotalCents + order.shippingFeeCents, 0)
      return { label: fmt.format(day), count: inDay.length, sales }
    })
  }, [orders, lang])
  const max = Math.max(1, ...days.map((day) => day.count))
  const none = days.every((day) => day.count === 0)
  return (
    <div className="bars-wrap">
      <ul className="bars" role="img" aria-label={tr('الطلبات آخر 7 أيام', 'Orders, last 7 days')}>
        {days.map((day, index) => (
          <li key={index} className="bar" style={{ '--h': `${Math.max(day.count ? 10 : 4, (day.count / max) * 100)}%`, '--i': index } as CSSProperties} title={`${day.count} · ${m(day.sales)}`}>
            <b>{day.count}</b>
            <i />
            <span>{day.label}</span>
          </li>
        ))}
      </ul>
      {none && <p className="bars-empty">{tr('مفيش طلبات الأسبوع ده.', 'No orders this week.')}</p>}
    </div>
  )
}

/** دايرة حالة الطلبات */
function StatusDonut({ orders }: { orders: Order[] }) {
  const { tr } = useLang()
  const list: Array<[string, string]> = [['new', tr('جديد', 'New')], ['accepted', tr('اتقبل', 'Accepted')], ['delivered', tr('اتسلّم', 'Delivered')], ['rejected', tr('اترفض', 'Rejected')]]
  const total = orders.length
  const C = 2 * Math.PI * 42
  let acc = 0
  const parts = list.map(([key, label]) => {
    const count = orders.filter((order) => order.status === key).length
    const len = total ? (count / total) * C : 0
    const part = { key, label, count, len, off: acc }
    acc += len
    return part
  })
  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" role="img" aria-label={tr('حالة الطلبات', 'Order status')}>
        <circle cx="50" cy="50" r="42" className="donut-track" />
        {parts.filter((part) => part.count > 0).map((part) => (
          <circle key={part.key} cx="50" cy="50" r="42" className="donut-seg" style={{ stroke: STATUS_COLOR[part.key] }} strokeDasharray={`${Math.max(0, part.len - (parts.filter((p) => p.count > 0).length > 1 ? 2.5 : 0))} ${C}`} strokeDashoffset={-part.off} transform="rotate(-90 50 50)" />
        ))}
        <text x="50" y="49" className="donut-n">{total}</text>
        <text x="50" y="62" className="donut-l">{tr('طلب', 'orders')}</text>
      </svg>
      <ul className="donut-legend">
        {parts.map((part) => (
          <li key={part.key}><i style={{ background: STATUS_COLOR[part.key] }} />{part.label}<b>{part.count}</b></li>
        ))}
      </ul>
    </div>
  )
}

export function DashboardApp({ user, dashboard, categories, zones, reload, reloadCatalog, onStore }: Props) {
  const { tr, lang } = useLang()
  const { signOut } = useShop()
  const isOwner = user.role === 'owner'
  const perms = new Set(dashboard.permissions)
  const canOrders = isOwner || perms.has('view_orders')
  const canManageOrders = isOwner || perms.has('manage_orders')
  const canProducts = isOwner || perms.has('manage_products')

  const groups = [
    {
      title: tr('الرئيسية', 'Main'),
      items: [
        { id: 'overview', label: tr('نظرة عامة', 'Overview'), icon: LayoutDashboard, show: true },
        { id: 'orders', label: tr('الطلبات', 'Orders'), icon: Package, show: canOrders, badge: dashboard.stats.pending },
        { id: 'products', label: tr('المنتجات', 'Products'), icon: ShoppingBag, show: canProducts },
      ],
    },
    {
      title: tr('المتجر', 'Store'),
      items: [
        { id: 'categories', label: tr('الأقسام', 'Categories'), icon: LayoutGrid, show: isOwner },
        { id: 'vendors', label: tr('التجار', 'Vendors'), icon: Users, show: isOwner },
        { id: 'shipping', label: tr('الشحن', 'Shipping'), icon: Truck, show: isOwner },
        { id: 'wallet', label: tr('العمولات', 'Commissions'), icon: Wallet, show: isOwner },
      ],
    },
    {
      title: tr('النظام', 'System'),
      items: [
        { id: 'notifications', label: tr('الإشعارات', 'Notifications'), icon: Bell, show: isOwner, badge: dashboard.unreadCount },
        { id: 'account', label: tr('حسابي', 'Account'), icon: KeyRound, show: true },
      ],
    },
  ].map((group) => ({ ...group, items: group.items.filter((item) => item.show) })).filter((group) => group.items.length > 0)
  const flat = groups.flatMap((group) => group.items)
  const [page, setPage] = useState('overview')
  const [search, setSearch] = useState('')
  const [searchKey, setSearchKey] = useState(0)
  const current = flat.some((item) => item.id === page) ? page : 'overview'
  const first = user.name.split(' ')[0]
  const hour = new Date().getHours()
  const hello = lang === 'ar' ? (hour < 12 ? 'صباح الخير' : 'مساء الخير') : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) void reload()
    }, 20_000)
    return () => clearInterval(timer)
  }, [reload])

  function runSearch(event: FormEvent) {
    event.preventDefault()
    setPage(canOrders ? 'orders' : 'products')
    setSearchKey((value) => value + 1)
  }

  return (
    <div className="dash">
      <aside className="dash-side">
        <div className="dash-brand"><span className="logo-mark"><Store /></span><div><strong>RTX SHOP</strong><small>{isOwner ? tr('لوحة المالك', 'Owner console') : tr('لوحة التاجر', 'Vendor console')}</small></div></div>
        <nav className="dash-nav" aria-label={tr('القائمة', 'Menu')}>
          {groups.map((group) => (
            <div key={group.title} className="dash-group">
              <p>{group.title}</p>
              {group.items.map((item) => (
                <button key={item.id} type="button" className={current === item.id ? 'on' : ''} aria-current={current === item.id ? 'page' : undefined} onClick={() => setPage(item.id)}>
                  <item.icon /><span>{item.label}</span>
                  {item.badge ? <b>{item.badge}</b> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="dash-foot">
          <button type="button" onClick={onStore}><ChevronLeft /> {tr('رجوع للمتجر', 'Back to store')}</button>
          <button type="button" className="danger" onClick={() => void signOut()}><LogOut /> {tr('خروج', 'Sign out')}</button>
        </div>
      </aside>
      <div className="dash-col">
        <header className="dash-bar">
          <form className="dash-search" onSubmit={runSearch} role="search">
            <Search />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('دوّر في الطلبات والمنتجات…', 'Search orders and products…')} aria-label={tr('بحث', 'Search')} maxLength={80} />
            <kbd aria-hidden="true">⏎</kbd>
          </form>
          <div className="dash-bar-end">
            <LangSwitch />
            {isOwner && (
              <button type="button" className="dash-bell" onClick={() => setPage('notifications')} aria-label={tr('الإشعارات', 'Notifications')}>
                <Bell />
                {dashboard.unreadCount > 0 && <b>{dashboard.unreadCount}</b>}
              </button>
            )}
            <div className="dash-user" title={user.name}>
              <span className="dash-avatar">{user.name.slice(0, 1)}</span>
              <div><strong>{first}</strong><small>{isOwner ? tr('صاحب المتجر', 'Owner') : tr('تاجر', 'Vendor')}</small></div>
            </div>
          </div>
        </header>
        <main className="dash-main">
          <div className="dash-head">
            <div>
              {current === 'overview'
                ? <h1>{hello}، <Hue c="teal">{first}</Hue></h1>
                : <h1>{flat.find((item) => item.id === current)?.label}</h1>}
              <p className="dash-sub">{current === 'overview' ? tr('ده ملخص متجرك النهارده.', 'Here’s your store today.') : tr('RTX SHOP — لوحة التحكم', 'RTX SHOP — control panel')}</p>
            </div>
            <button className="btn btn-outline" type="button" onClick={onStore}><Store /> {tr('شوف المتجر', 'View store')}</button>
          </div>
          {isOwner && dashboard.weakOwnerPassword && (
            <div className="notice notice-warn" role="alert">
              {tr('كلمة سر المالك لسه هي الافتراضية. غيّرها دلوقتي من «حسابي».', 'Your owner password is still the default. Change it now in “Account”.')}
              <button type="button" className="link" onClick={() => setPage('account')}>{tr('غيّر كلمة السر', 'Change password')}</button>
            </div>
          )}
          <div className="dash-content" key={`${current}:${searchKey}`}>
            {current === 'overview' && <Overview user={user} dashboard={dashboard} categories={categories} canOrders={canOrders} canProducts={canProducts} go={setPage} />}
            {current === 'orders' && <OrdersPage orders={dashboard.orders} canManage={canManageOrders} reload={reload} initialQuery={search} />}
            {current === 'products' && <ProductsPage dashboard={dashboard} categories={categories} isOwner={isOwner} reload={async () => { await reload(); await reloadCatalog() }} initialQuery={search} />}
            {current === 'categories' && <CategoriesPage categories={categories} products={dashboard.products} reload={async () => { await reload(); await reloadCatalog() }} />}
            {current === 'vendors' && <VendorsPage dashboard={dashboard} reload={reload} />}
            {current === 'shipping' && <ShippingPage zones={zones} reload={reloadCatalog} />}
            {current === 'wallet' && <WalletPage dashboard={dashboard} />}
            {current === 'notifications' && <NotificationsPage dashboard={dashboard} reload={reload} go={setPage} />}
            {current === 'account' && <AccountPage user={user} />}
          </div>
        </main>
      </div>
    </div>
  )
}

// ───────────────────────── نظرة عامة ─────────────────────────

export function Overview({ user, dashboard, categories, canOrders, canProducts, go }: { user: SessionUser; dashboard: Dashboard; categories: Category[]; canOrders: boolean; canProducts: boolean; go: (id: string) => void }) {
  const { tr, m, d } = useLang()
  const isOwner = user.role === 'owner'
  const { stats } = dashboard
  return (
    <div className="stack-lg">
      {canOrders ? (
        <>
          <div className="dash-split">
            <section className="panel">
              <div className="panel-head"><h3>{tr('الطلبات — آخر 7 أيام', 'Orders — last 7 days')}</h3></div>
              <WeekBars orders={dashboard.orders} />
            </section>
            <section className="panel">
              <div className="panel-head"><h3>{tr('حالة الطلبات', 'Order status')}</h3></div>
              <StatusDonut orders={dashboard.orders} />
            </section>
          </div>
          <div className="metrics">
            {isOwner && <Metric tone="teal" icon={<CircleDollarSign />} label={tr('رصيد العمولات', 'Commission balance')} value={m(dashboard.wallet?.balanceCents)} note={tr('من الطلبات المتسلّمة', 'From delivered orders')} />}
            <Metric tone="sky" icon={<Package />} label={tr('كل الطلبات', 'All orders')} value={String(stats.total)} />
            <Metric tone="amber" icon={<Clock3 />} label={tr('طلبات جديدة', 'New orders')} value={String(stats.pending)} note={tr('مستنية قرارك', 'Waiting for you')} />
            <Metric tone="lilac" icon={<Truck />} label={tr('اتسلّمت', 'Delivered')} value={String(stats.delivered)} note={`${tr('مبيعات', 'Sales')} ${m(stats.salesCents)}`} />
            {!isOwner && <Metric tone="teal" icon={<CircleDollarSign />} label={tr('صافي أرباحك', 'Your net profit')} value={m(stats.salesCents - dashboard.commissionTotalCents)} note={`${tr('بعد عمولة المنصة', 'After platform commission')} ${m(dashboard.commissionTotalCents)}`} />}
            <Metric tone="coral" icon={<ShoppingBag />} label={tr('المنتجات', 'Products')} value={String(dashboard.products.length)} />
            {isOwner && <Metric tone="sky" icon={<Users />} label={tr('التجار', 'Vendors')} value={String(dashboard.vendors.length)} />}
            {isOwner && <Metric tone="amber" icon={<LayoutGrid />} label={tr('الأقسام', 'Categories')} value={String(categories.length)} />}
          </div>
          <section className="panel">
            <div className="panel-head"><h3>{tr('آخر الطلبات', 'Latest orders')}</h3><button className="link" type="button" onClick={() => go('orders')}>{tr('كل الطلبات', 'All orders')} →</button></div>
            {dashboard.orders.length === 0 ? <Empty text={tr('مفيش طلبات لسه.', 'No orders yet.')} /> : (
              <ul className="mini-list">
                {dashboard.orders.slice(0, 6).map((order) => (
                  <li key={order.id}>
                    <strong dir="ltr">#{orderCode(order.id)}</strong>
                    <span>{order.customerName}</span>
                    <span className="muted">{d(order.createdAt)}</span>
                    <b>{m(order.subtotalCents + order.shippingFeeCents)}</b>
                    <StatusBadge status={order.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="notice">{tr('عرض الطلبات مش مفعّل لحسابك. اطلب من صاحب المتجر يفعّله.', 'Order access isn’t enabled for your account. Ask the store owner.')}</p>
      )}
      <div className="quick">
        {canProducts && <button type="button" onClick={() => go('products')}><span><Plus /></span><div><strong>{tr('ضيف منتج', 'Add a product')}</strong><small>{tr('صورة وسعر ومخزون', 'Photo, price, stock')}</small></div></button>}
        {isOwner && <button type="button" onClick={() => go('vendors')}><span><Users /></span><div><strong>{tr('ضيف تاجر', 'Add a vendor')}</strong><small>{tr('حساب لتاجر جديد', 'A new vendor account')}</small></div></button>}
        {isOwner && <button type="button" onClick={() => go('categories')}><span><LayoutGrid /></span><div><strong>{tr('نظّم الأقسام', 'Organise categories')}</strong><small>{tr('أجهزة، ساعات، سماعات…', 'Devices, watches, audio…')}</small></div></button>}
      </div>
    </div>
  )
}



// ───────────────────────── الطلبات ─────────────────────────

export function OrdersPage({ orders, canManage, reload, initialQuery = '' }: { orders: Order[]; canManage: boolean; reload: () => Promise<void>; initialQuery?: string }) {
  const { tr } = useLang()
  const { busyId, act } = useOrderActions(reload)
  const [filter, setFilter] = useState<'all' | Order['status']>('all')
  const [query, setQuery] = useState(initialQuery)
  const shown = orders.filter((order) => {
    if (filter !== 'all' && order.status !== filter) return false
    const hay = `${orderCode(order.id)} ${order.customerName} ${order.customerPhone} ${order.items.map((item) => item.name).join(' ')}`.toLowerCase()
    return hay.includes(query.trim().toLowerCase())
  })
  const filters: Array<['all' | Order['status'], string]> = [['all', tr('الكل', 'All')], ['new', tr('جديد', 'New')], ['accepted', tr('اتقبل', 'Accepted')], ['delivered', tr('اتسلّم', 'Delivered')], ['rejected', tr('اترفض', 'Rejected')]]
  return (
    <div className="stack-lg">
      <div className="toolbar">
        <div className="chips">{filters.map(([key, label]) => <button key={key} type="button" className={`chip ${filter === key ? 'on' : ''}`} onClick={() => setFilter(key)}>{label}</button>)}</div>
        <label className="search small"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr('دوّر باسم العميل أو رقمه أو كود الطلب', 'Search by name, phone or order code')} /></label>
      </div>
      {shown.length === 0 ? <Empty text={tr('مفيش طلبات مطابقة.', 'No matching orders.')} /> : (
        <div className="orders">{shown.map((order) => <OrderCard key={order.id} order={order} mode="staff" canManage={canManage} busy={busyId === order.id} onAction={(id, action) => void act(id, action)} />)}</div>
      )}
    </div>
  )
}

// ───────────────────────── المنتجات ─────────────────────────

export function ProductForm({ product, categories, sellers, isOwner, onClose, onSaved }: { product: Product | null; categories: Category[]; sellers: Dashboard['sellers']; isOwner: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const { tr } = useLang()
  const { notify } = useShop()
  const tree = useMemo(() => buildTree(categories), [categories])
  const [imageData, setImageData] = useState<string | null>(null)
  const [clearImage, setClearImage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const preview = imageData ?? (clearImage ? null : product?.imageUrl ?? null)

  async function pick(file: File | undefined) {
    if (!file) return
    try {
      setImageData(await imageToDataUrl(file))
      setClearImage(false)
      setError('')
    } catch (reason) {
      setError(errorText(reason))
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = formValues(event)
    const payload: Record<string, unknown> = {
      name: values.name,
      categoryId: values.categoryId,
      price: values.price,
      oldPrice: values.oldPrice,
      stock: values.stock,
      description: values.description,
      battery: values.battery,
      warranty: values.warranty,
      boxContents: values.boxContents,
      imageUrl: imageData ? '' : values.imageUrl,
    }
    if (imageData) payload.imageData = imageData
    if (clearImage && !imageData && !values.imageUrl) payload.clearImage = true
    if (isOwner) {
      payload.vendorId = values.vendorId
      payload.commissionPercent = values.commissionPercent
      if (product) payload.active = new FormData(form).get('active') === 'on'
    }
    setBusy(true)
    setError('')
    try {
      if (product) await api(`products/${product.id}`, 'PATCH', payload)
      else await api('products', 'POST', payload)
      await onSaved()
      notify(product ? tr('تم حفظ التعديلات', 'Changes saved') : tr('تم إضافة المنتج', 'Product added'))
      onClose()
    } catch (reason) {
      setError(errorText(reason))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={product ? tr('تعديل المنتج', 'Edit product') : tr('منتج جديد', 'New product')} size="lg">
      <form className="form-grid" onSubmit={submit}>
        <Field label={tr('اسم المنتج', 'Product name')} className="span2"><input name="name" required maxLength={120} defaultValue={product?.name ?? ''} placeholder={tr('مثال: سماعة بلوتوث RTX Pro', 'e.g. RTX Pro Bluetooth headset')} /></Field>
        <Field label={tr('القسم', 'Category')}>
          <select name="categoryId" required defaultValue={product?.categoryId ?? ''}>
            <option value="" disabled>{tr('اختار القسم…', 'Choose category…')}</option>
            {tree.map((top) => (
              <optgroup key={top.id} label={`${top.icon} ${top.name}`}>
                <option value={top.id}>{top.name} {tr('(عام)', '(general)')}</option>
                {top.children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        {isOwner && (
          <Field label={tr('البائع', 'Seller')}>
            <select name="vendorId" defaultValue={product?.vendorId ?? sellers[0]?.id}>
              {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.storeName}</option>)}
            </select>
          </Field>
        )}
        <Field label={tr('السعر (ج.م)', 'Price (EGP)')}><input name="price" type="number" min="0" step="0.01" required defaultValue={product ? product.priceCents / 100 : ''} inputMode="decimal" /></Field>
        <Field label={tr('السعر قبل الخصم (اختياري)', 'Price before discount (optional)')} hint={tr('لو كتبته هيظهر خصم على المنتج', 'Shows a discount badge on the product')}><input name="oldPrice" type="number" min="0" step="0.01" defaultValue={product?.oldPriceCents ? product.oldPriceCents / 100 : ''} inputMode="decimal" /></Field>
        <Field label={tr('الكمية في المخزون', 'Stock quantity')}><input name="stock" type="number" min="0" step="1" required defaultValue={product?.stock ?? 1} inputMode="numeric" /></Field>
        {isOwner && (
          <Field label={tr('عمولتك على المنتج (%)', 'Your commission on this product (%)')} hint={tr('النسبة اللي بتاخدها من كل بيعة — إنت بس اللي بتحددها', 'Your cut of each sale. Only you can set it')}>
            <input name="commissionPercent" type="number" min="0" max="100" step="0.5" required defaultValue={product?.commissionPercent ?? 10} inputMode="decimal" />
          </Field>
        )}
        <div className="field span2">
          <span className="field-label">{tr('صورة المنتج', 'Product image')}</span>
          <div className="imgpick">
            <div className="imgpick-prev">{preview ? <img src={preview} alt="" /> : <ImagePlus />}</div>
            <div className="stack-sm">
              <label className="btn btn-outline"><ImagePlus /> {tr('اختار صورة', 'Choose image')}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void pick(event.target.files?.[0])} /></label>
              {preview && <button type="button" className="btn btn-ghost" onClick={() => { setImageData(null); setClearImage(true) }}><Trash2 /> {tr('شيل الصورة', 'Remove image')}</button>}
              <small className="muted">{tr('بتتصغّر تلقائي عشان الموقع يفضل سريع', 'Resized automatically to keep the site fast')}</small>
            </div>
          </div>
          {!imageData && <input name="imageUrl" type="url" dir="ltr" placeholder={tr('أو الصق رابط صورة (https://…)', 'Or paste an image link (https://…)')} defaultValue={product?.imageUrl && !product.imageUrl.startsWith('/api/') ? product.imageUrl : ''} />}
        </div>
        <Field label={tr('البطارية (اختياري)', 'Battery (optional)')}><input name="battery" maxLength={200} defaultValue={product?.battery ?? ''} placeholder={tr('مثال: تشغيل حتى 30 ساعة', 'e.g. up to 30 hours')} /></Field>
        <Field label={tr('مدة الضمان (اختياري)', 'Warranty (optional)')}><input name="warranty" maxLength={200} defaultValue={product?.warranty ?? ''} placeholder={tr('اكتبها فقط لو متأكد منها', 'Only fill in if you’re sure')} /></Field>
        <Field label={tr('محتويات العلبة (اختياري)', 'Box contents (optional)')} className="span2"><input name="boxContents" maxLength={400} defaultValue={product?.boxContents ?? ''} placeholder={tr('مثال: السماعة، كابل شحن، دليل الاستخدام', 'e.g. headset, charging cable, manual')} /></Field>
        <Field label={tr('وصف المنتج', 'Description')} className="span2"><textarea name="description" rows={4} maxLength={3000} defaultValue={product?.description ?? ''} placeholder={tr('تفاصيل إضافية عن المنتج', 'More details about the product')} /></Field>
        {isOwner && product && <label className="check span2"><input type="checkbox" name="active" defaultChecked={product.active !== false} /> {tr('ظاهر في المتجر', 'Visible in store')}</label>}
        {error && <p className="form-error span2" role="alert">{error}</p>}
        <div className="form-actions span2">
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}><Save /> {busy ? tr('بنحفظ…', 'Saving…') : tr('حفظ', 'Save')}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>{tr('إلغاء', 'Cancel')}</button>
        </div>
      </form>
    </Modal>
  )
}

function CommissionEditor({ product, onSaved }: { product: Product; onSaved: () => Promise<void> }) {
  const { tr } = useLang()
  const { notify } = useShop()
  const [value, setValue] = useState(String(product.commissionPercent ?? 0))
  const changed = Number(value) !== Number(product.commissionPercent ?? 0)
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      await api(`products/${product.id}/commission`, 'PATCH', { percent: value })
      await onSaved()
      notify(tr('تم تحديث العمولة', 'Commission updated'))
    } catch (reason) {
      notify(errorText(reason))
    }
  }
  return (
    <form className="commission-edit" onSubmit={save}>
      <label><span>{tr('عمولتك', 'Your cut')}</span><input type="number" min="0" max="100" step="0.5" value={value} onChange={(event) => setValue(event.target.value)} aria-label={tr('نسبة العمولة', 'Commission rate')} /><i>%</i></label>
      {changed && <button type="submit" className="btn btn-primary btn-sm"><Save /> {tr('حفظ', 'Save')}</button>}
    </form>
  )
}

export function ProductsPage({ dashboard, categories, isOwner, reload, initialQuery = '' }: { dashboard: Dashboard; categories: Category[]; isOwner: boolean; reload: () => Promise<void>; initialQuery?: string }) {
  const { tr, m } = useLang()
  const { notify } = useShop()
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [query, setQuery] = useState(initialQuery)
  const [cat, setCat] = useState('')
  const tree = useMemo(() => buildTree(categories), [categories])
  const shown = dashboard.products.filter((product) => {
    if (query && !product.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    if (!cat) return true
    const node = categories.find((item) => item.id === cat)
    return product.categoryId === cat || (node && !node.parentId && categories.find((item) => item.id === product.categoryId)?.parentId === cat)
  })

  async function setVisible(product: Product, visible: boolean) {
    try {
      await api(`products/${product.id}/visibility`, 'PATCH', { active: visible })
      await reload()
      notify(visible ? tr('المنتج ظهر في المتجر تاني.', 'Product is visible again.') : tr('المنتج اتخفى من المتجر.', 'Product hidden from the store.'))
    } catch (reason) {
      notify(errorText(reason))
    }
  }

  async function removeForever(product: Product) {
    if (!window.confirm(tr(`تحذف «${product.name}» نهائياً؟ مش هينفع ترجع فيه.`, `Delete “${product.name}” permanently? This can’t be undone.`))) return
    try {
      await api(`products/${product.id}/permanent`, 'DELETE')
      await reload()
      notify(tr('المنتج اتحذف نهائياً.', 'Product deleted.'))
    } catch (reason) {
      notify(errorText(reason))
    }
  }

  async function hide(product: Product) {
    if (!window.confirm(tr(`تخفي «${product.name}» من المتجر؟ الطلبات القديمة هتفضل محفوظة.`, `Hide “${product.name}” from the store? Past orders stay intact.`))) return
    try {
      await api(`products/${product.id}`, 'DELETE')
      await reload()
      notify(tr('المنتج اتخفى من المتجر.', 'Product hidden from the store.'))
    } catch (reason) {
      notify(errorText(reason))
    }
  }

  return (
    <div className="stack-lg">
      <div className="toolbar">
        <label className="search small"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr('دوّر في المنتجات', 'Search products')} /></label>
        <select value={cat} onChange={(event) => setCat(event.target.value)} aria-label={tr('فلتر القسم', 'Filter by category')}>
          <option value="">{tr('كل الأقسام', 'All categories')}</option>
          {tree.map((top) => (
            <optgroup key={top.id} label={`${top.icon} ${top.name}`}>
              <option value={top.id}>{top.name} {tr('(الكل)', '(all)')}</option>
              {top.children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
            </optgroup>
          ))}
        </select>
        <button className="btn btn-primary" type="button" onClick={() => setEditing('new')}><Plus /> {tr('منتج جديد', 'New product')}</button>
      </div>
      {shown.length === 0 ? <Empty text={dashboard.products.length ? tr('مفيش منتجات مطابقة.', 'No matching products.') : tr('ضيف أول منتج وابدأ البيع 🚀', 'Add your first product and start selling 🚀')} /> : (
        <div className="plist">
          {shown.map((product) => (
            <article key={product.id} className={`prow ${product.active === false ? 'off' : ''}`}>
              <div className="prow-img">{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <ShoppingBag />}</div>
              <div className="prow-info">
                <strong>{product.name}</strong>
                <small>{categoryPath(categories, product.categoryId)}{isOwner ? ` · ${product.storeName}` : ''}</small>
                <div className="prow-tags">
                  <span className="price-mini">{m(product.priceCents)}</span>
                  <span className={`stock ${product.stock === 0 ? 'zero' : product.stock <= 3 ? 'low' : ''}`}>{tr('المخزون:', 'Stock:')} {product.stock}</span>
                  {product.active === false && <span className="badge badge-rejected">{tr('مخفي', 'Hidden')}</span>}
                </div>
              </div>
              <div className="prow-side">
                {isOwner ? <CommissionEditor key={`${product.id}-${product.commissionPercent}`} product={product} onSaved={reload} /> : <span className="chip static">{tr('عمولة المنصة', 'Platform commission')} {product.commissionPercent}%</span>}
                <div className="prow-actions">
                  <button className="btn btn-outline btn-sm" type="button" onClick={() => setEditing(product)}><Pencil /> {tr('تعديل', 'Edit')}</button>
                  {product.active !== false
                    ? <button className="btn btn-ghost btn-sm" type="button" onClick={() => void hide(product)}><EyeOff /> {tr('إخفاء', 'Hide')}</button>
                    : <button className="btn btn-ghost btn-sm" type="button" onClick={() => void setVisible(product, true)}><Eye /> {tr('إظهار', 'Show')}</button>}
                  {isOwner && <button className="btn btn-ghost btn-sm danger" type="button" onClick={() => void removeForever(product)}><Trash2 /> {tr('حذف نهائي', 'Delete')}</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && <ProductForm key={editing === 'new' ? 'new' : editing.id} product={editing === 'new' ? null : editing} categories={categories} sellers={dashboard.sellers} isOwner={isOwner} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  )
}

// ───────────────────────── الأقسام ─────────────────────────

type CategoryDialog = { mode: 'create'; parent: Category | null } | { mode: 'edit'; category: Category }

export function CategoriesPage({ categories, products, reload }: { categories: Category[]; products: Product[]; reload: () => Promise<void> }) {
  const { tr } = useLang()
  const { notify } = useShop()
  const tree = useMemo(() => buildTree(categories), [categories])
  const counts = useMemo(() => countByCategory(categories, products), [categories, products])
  const [dialog, setDialog] = useState<CategoryDialog | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dialog) return
    const values = formValues(event)
    setBusy(true)
    setError('')
    try {
      if (dialog.mode === 'edit') await api(`categories/${dialog.category.id}`, 'PATCH', values)
      else await api('categories', 'POST', { ...values, parentId: dialog.parent?.id ?? '' })
      await reload()
      notify(tr('تم حفظ القسم', 'Category saved'))
      setDialog(null)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }
  async function remove(category: Category) {
    if (!window.confirm(tr(`تمسح قسم «${category.name}»؟`, `Delete the category “${category.name}”?`))) return
    try {
      await api(`categories/${category.id}`, 'DELETE')
      await reload()
      notify(tr('القسم اتمسح.', 'Category deleted.'))
    } catch (reason) {
      notify(errorText(reason))
    }
  }
  const editing = dialog?.mode === 'edit' ? dialog.category : null
  const title = dialog?.mode === 'edit' ? tr('تعديل القسم', 'Edit category') : dialog?.parent ? tr(`قسم فرعي جديد داخل «${dialog.parent.name}»`, `New sub-category in “${dialog.parent.name}”`) : tr('قسم رئيسي جديد', 'New main category')

  return (
    <div className="stack-lg">
      <div className="toolbar">
        <p className="muted grow">{tr('زي: «الأجهزة الإلكترونية» وتحتها: سماعات، ساعات ذكية، موبايلات…', 'e.g. “Electronics” with headphones, smartwatches, phones…')}</p>
        <button className="btn btn-primary" type="button" onClick={() => { setError(''); setDialog({ mode: 'create', parent: null }) }}><Plus /> {tr('قسم رئيسي', 'Main category')}</button>
      </div>
      <div className="cats">
        {tree.map((top) => (
          <section key={top.id} className="cat panel">
            <header>
              <span className="emo">{top.icon}</span>
              <div><strong>{top.name}</strong><small>{counts[top.id] ?? 0} {tr('منتج', 'products')}</small></div>
              <div className="cat-actions">
                <button className="btn btn-outline btn-sm" type="button" onClick={() => { setError(''); setDialog({ mode: 'create', parent: top }) }}><Plus /> {tr('فرعي', 'Sub')}</button>
                <button className="icon-btn" type="button" onClick={() => { setError(''); setDialog({ mode: 'edit', category: top }) }} aria-label={tr('تعديل', 'Edit')}><Pencil /></button>
                <button className="icon-btn danger" type="button" onClick={() => void remove(top)} aria-label={tr('مسح', 'Delete')}><Trash2 /></button>
              </div>
            </header>
            <div className="subcats">
              {top.children.length === 0 && <small className="muted">{tr('مفيش أقسام فرعية.', 'No sub-categories.')}</small>}
              {top.children.map((child) => (
                <span key={child.id} className="subcat">
                  {child.name} <em>{counts[child.id] ?? 0}</em>
                  <button type="button" onClick={() => { setError(''); setDialog({ mode: 'edit', category: child }) }} aria-label={tr(`تعديل ${child.name}`, `Edit ${child.name}`)}><Pencil /></button>
                  <button type="button" className="danger" onClick={() => void remove(child)} aria-label={tr(`مسح ${child.name}`, `Delete ${child.name}`)}><X /></button>
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
      {dialog && (
        <Modal open onClose={() => setDialog(null)} title={title} size="sm">
          <form className="stack" onSubmit={submit}>
            <Field label={tr('اسم القسم', 'Category name')}><input name="name" required maxLength={80} defaultValue={editing?.name ?? ''} autoFocus /></Field>
            <Field label={tr('أيقونة (إيموجي)', 'Icon (emoji)')} hint={tr('مثال: 🎧 أو ⌚', 'e.g. 🎧 or ⌚')}><input name="icon" maxLength={8} defaultValue={editing?.icon ?? ''} /></Field>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={busy}><Save /> {tr('حفظ', 'Save')}</button>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ───────────────────────── التجار ─────────────────────────

export function VendorsPage({ dashboard, reload }: { dashboard: Dashboard; reload: () => Promise<void> }) {
  const { tr } = useLang()
  const { notify } = useShop()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = formValues(event)
    const permissions = new FormData(form).getAll('permissions').map(String)
    setBusy(true)
    setError('')
    try {
      await api('vendors', 'POST', { ...values, permissions })
      await reload()
      notify(tr('تم إنشاء حساب التاجر — ابعتله بيانات الدخول بشكل آمن.', 'Vendor account created. Send the login details securely.'))
      setOpen(false)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }
  async function savePermissions(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    const permissions = new FormData(event.currentTarget).getAll('permissions').map(String)
    try {
      await api(`vendors/${id}/permissions`, 'PATCH', { permissions })
      await reload()
      notify(tr('تم حفظ الصلاحيات', 'Permissions saved'))
    } catch (reason) {
      notify(errorText(reason))
    }
  }

  return (
    <div className="stack-lg">
      <div className="toolbar">
        <p className="muted grow">{tr('التجار بيضيفوا منتجاتهم، وإنت اللي بتحدد عمولتك على كل منتج من صفحة «المنتجات».', 'Vendors add their own products. You set your commission per product from “Products”.')}</p>
        <button className="btn btn-primary" type="button" onClick={() => { setError(''); setOpen(true) }}><Plus /> {tr('تاجر جديد', 'New vendor')}</button>
      </div>
      {dashboard.vendors.length === 0 ? <Empty text={tr('مفيش تجار لسه. المتجر شغال بمنتجاتك إنت.', 'No vendors yet. The store runs on your products.')} /> : (
        <div className="vendors">
          {dashboard.vendors.map((vendor) => (
            <article key={vendor.id} className="vendor panel">
              <header><span className="avatar">{vendor.storeName.slice(0, 1)}</span><div><strong>{vendor.storeName}</strong><small>{vendor.name} · <span dir="ltr">{vendor.phone}</span> · @{vendor.username}</small></div></header>
              <p className="muted tiny">{vendor.storeAddress}</p>
              <form onSubmit={(event) => void savePermissions(event, vendor.id)} key={vendor.permissions.join(',')}>
                <div className="perms">
                  {permissionOptions.map(({ key, ar, en }) => <label key={key} className="check"><input type="checkbox" name="permissions" value={key} defaultChecked={vendor.permissions.includes(key)} /> {tr(ar, en)}</label>)}
                </div>
                <button className="btn btn-outline btn-sm" type="submit"><Save /> {tr('حفظ الصلاحيات', 'Save permissions')}</button>
              </form>
            </article>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={tr('تاجر جديد', 'New vendor')} size="lg">
        <form className="form-grid" onSubmit={create}>
          <Field label={tr('اسم التاجر', 'Vendor name')}><input name="name" required maxLength={100} /></Field>
          <Field label={tr('اسم المتجر', 'Store name')}><input name="storeName" required maxLength={120} /></Field>
          <Field label={tr('اسم المستخدم للدخول', 'Login username')} hint={tr('إنجليزي بدون مسافات', 'English letters, no spaces')}><input name="username" required dir="ltr" pattern="[A-Za-z0-9._\-]{3,32}" /></Field>
          <Field label={tr('كلمة سر مؤقتة', 'Temporary password')} hint={tr('8 حروف أو أرقام على الأقل', 'At least 8 characters')}><input name="password" type="text" required minLength={8} dir="ltr" /></Field>
          <Field label={tr('موبايل التاجر', 'Vendor phone')}><input name="phone" required dir="ltr" inputMode="tel" placeholder="01012345678" /></Field>
          <Field label={tr('الإيميل (اختياري)', 'Email (optional)')}><input name="email" type="email" dir="ltr" /></Field>
          <Field label={tr('عنوان المتجر', 'Store address')} className="span2"><input name="storeAddress" required maxLength={240} /></Field>
          <fieldset className="span2 perms-set">
            <legend>{tr('الصلاحيات', 'Permissions')}</legend>
            {permissionOptions.map(({ key, ar, en }) => <label key={key} className="check"><input type="checkbox" name="permissions" value={key} defaultChecked /> {tr(ar, en)}</label>)}
          </fieldset>
          {error && <p className="form-error span2" role="alert">{error}</p>}
          <div className="form-actions span2"><button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? tr('ثانية…', 'One sec…') : tr('إنشاء الحساب', 'Create account')}</button></div>
        </form>
      </Modal>
    </div>
  )
}

// ───────────────────────── الشحن ─────────────────────────

function ZoneRow({ zone, onSaved }: { zone: Zone; onSaved: () => Promise<void> }) {
  const { tr } = useLang()
  const { notify } = useShop()
  const [value, setValue] = useState(String(zone.shippingFeeCents / 100))
  const [minDays, setMinDays] = useState(zone.deliveryDaysMin == null ? '' : String(zone.deliveryDaysMin))
  const [maxDays, setMaxDays] = useState(zone.deliveryDaysMax == null ? '' : String(zone.deliveryDaysMax))
  const changed = Number(value) !== zone.shippingFeeCents / 100 || minDays !== (zone.deliveryDaysMin == null ? '' : String(zone.deliveryDaysMin)) || maxDays !== (zone.deliveryDaysMax == null ? '' : String(zone.deliveryDaysMax))
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      await api(`zones/${zone.id}`, 'PATCH', { shippingFee: value, deliveryDaysMin: minDays, deliveryDaysMax: maxDays })
      await onSaved()
      notify(tr(`تم تحديث شحن ${zone.name}`, `${zone.name} shipping updated`))
    } catch (reason) {
      notify(errorText(reason))
    }
  }
  return (
    <form className="zone" onSubmit={save}>
      <strong>{zone.name}</strong>
      <label><input type="number" min="0" step="0.5" value={value} onChange={(event) => setValue(event.target.value)} aria-label={tr(`شحن ${zone.name}`, `${zone.name} shipping fee`)} /><i>{tr('ج.م', 'EGP')}</i></label>
      <label><input type="number" min="0" max="60" step="1" value={minDays} onChange={(event) => setMinDays(event.target.value)} placeholder={tr('من', 'From')} aria-label={tr(`أقل مدة توصيل لـ ${zone.name} بالأيام`, `Minimum delivery days for ${zone.name}`)} /><i>{tr('يوم', 'days')}</i></label>
      <label><input type="number" min="0" max="60" step="1" value={maxDays} onChange={(event) => setMaxDays(event.target.value)} placeholder={tr('إلى', 'To')} aria-label={tr(`أقصى مدة توصيل لـ ${zone.name} بالأيام`, `Maximum delivery days for ${zone.name}`)} /><i>{tr('يوم', 'days')}</i></label>
      <button className="btn btn-primary btn-sm" type="submit" disabled={!changed}><Save /></button>
    </form>
  )
}

export function ShippingPage({ zones, reload }: { zones: Zone[]; reload: () => Promise<void> }) {
  const { tr } = useLang()
  return (
    <div className="stack-lg">
      <p className="muted">{tr('سعر الشحن ومدة التوصيل لكل محافظة (الشحن بيتحسب على كل تاجر في الطلب). المدة بتظهر للعميل قبل التأكيد — اكتبها بس لو متأكد منها.', 'Shipping fee and delivery time per governorate (charged per vendor in an order). The time is shown to the customer before confirming — only fill it in if you’re sure.')}</p>
      <div className="zones">{zones.map((zone) => <ZoneRow key={`${zone.id}-${zone.shippingFeeCents}-${zone.deliveryDaysMin}-${zone.deliveryDaysMax}`} zone={zone} onSaved={reload} />)}</div>
    </div>
  )
}

// ───────────────────────── العمولات / الإشعارات / الحساب ─────────────────────────

export function WalletPage({ dashboard }: { dashboard: Dashboard }) {
  const { tr, m, d } = useLang()
  return (
    <div className="stack-lg">
      <div className="metrics"><Metric tone="green" icon={<Wallet />} label={tr('رصيد عمولاتك', 'Your commission balance')} value={m(dashboard.wallet?.balanceCents)} note={tr('بتتضاف أوتوماتيك لما الطلب يتسلّم', 'Added automatically when an order is delivered')} /></div>
      <section className="panel">
        <div className="panel-head"><h3>{tr('آخر العمولات', 'Latest commissions')}</h3></div>
        {dashboard.ledger.length === 0 ? <Empty text={tr('هتظهر هنا عمولاتك بعد أول طلب يتسلّم.', 'Your commissions will show up after the first delivered order.')} /> : (
          <ul className="mini-list">
            {dashboard.ledger.map((row) => (
              <li key={row.id}><strong>{row.description}</strong><span className="muted">{d(row.createdAt)}</span><b className="plus">+{m(row.amountCents)}</b></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function NotificationsPage({ dashboard, reload, go }: { dashboard: Dashboard; reload: () => Promise<void>; go: (id: string) => void }) {
  const { tr, d } = useLang()
  const { notify } = useShop()
  async function read(id: string) {
    try {
      await api(`notifications/${id}/read`, 'POST', {})
      await reload()
    } catch (reason) {
      notify(errorText(reason))
    }
  }
  async function readAll() {
    try {
      await api('notifications/read-all', 'POST', {})
      await reload()
    } catch (reason) {
      notify(errorText(reason))
    }
  }
  return (
    <div className="stack-lg">
      <div className="toolbar"><p className="muted grow">{dashboard.unreadCount} {tr('إشعار جديد', 'new notifications')}</p><button className="btn btn-outline" type="button" onClick={() => void readAll()} disabled={dashboard.unreadCount === 0}><CheckCheck /> {tr('علّم الكل مقروء', 'Mark all as read')}</button></div>
      {dashboard.notifications.length === 0 ? <Empty text={tr('مفيش إشعارات.', 'No notifications.')} icon={<Bell />} /> : (
        <ul className="notices">
          {dashboard.notifications.map((item) => (
            <li key={item.id} className={item.readAt ? '' : 'unread'}>
              <div><strong>{item.title}</strong><p>{item.body}</p><small>{d(item.createdAt)}</small></div>
              <div className="notice-actions">
                {item.orderId && <button className="btn btn-ghost btn-sm" type="button" onClick={() => go('orders')}>{tr('الطلبات', 'Orders')}</button>}
                {!item.readAt && <button className="btn btn-outline btn-sm" type="button" onClick={() => void read(item.id)}>{tr('تمام', 'Got it')}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AccountPage({ user }: { user: SessionUser }) {
  const { tr } = useLang()
  const { notify } = useShop()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = formValues(event)
    if (values.newPassword !== values.confirm) return setError(tr('كلمتين السر الجداد مش متطابقين', 'The new passwords don’t match'))
    setBusy(true)
    setError('')
    try {
      await api('account/password', 'POST', { currentPassword: values.currentPassword, newPassword: values.newPassword })
      form.reset()
      notify(tr('تم تغيير كلمة السر', 'Password changed'))
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="stack-lg narrow">
      <section className="panel">
        <div className="panel-head"><h3>{tr('بيانات الحساب', 'Account details')}</h3></div>
        <dl className="kv">
          <div><dt>{tr('الاسم', 'Name')}</dt><dd>{user.name}</dd></div>
          <div><dt>{tr('اسم المستخدم', 'Username')}</dt><dd dir="ltr">{user.username}</dd></div>
          {user.storeName && <div><dt>{tr('المتجر', 'Store')}</dt><dd>{user.storeName}</dd></div>}
        </dl>
      </section>
      <section className="panel">
        <div className="panel-head"><h3>{tr('تغيير كلمة السر', 'Change password')}</h3></div>
        <form className="stack" onSubmit={submit}>
          <Field label={tr('كلمة السر الحالية', 'Current password')}><input name="currentPassword" type="password" required dir="ltr" autoComplete="current-password" /></Field>
          <Field label={tr('كلمة السر الجديدة', 'New password')} hint={tr('8 حروف أو أرقام على الأقل', 'At least 8 characters')}><input name="newPassword" type="password" required minLength={8} dir="ltr" autoComplete="new-password" /></Field>
          <Field label={tr('أكّد كلمة السر الجديدة', 'Confirm new password')}><input name="confirm" type="password" required minLength={8} dir="ltr" autoComplete="new-password" /></Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}><KeyRound /> {tr('غيّر كلمة السر', 'Change password')}</button>
        </form>
      </section>
    </div>
  )
}
