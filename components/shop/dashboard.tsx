'use client'

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Bell, CheckCheck, ChevronLeft, CircleDollarSign, Clock3, ImagePlus, KeyRound, LayoutDashboard, LayoutGrid, LogOut,
  Package, Pencil, Plus, Save, Search, ShoppingBag, Store, Trash2, Truck, Users, Wallet, X, Zap,
} from 'lucide-react'
import { Eye, EyeOff } from 'lucide-react'
import { dateLabel, money } from '@/lib/format'
import { buildTree, categoryPath, countByCategory } from './category-utils'
import { OrderCard, orderCode, useOrderActions } from './orders'
import { Empty, Field, Modal, StatusBadge, api, errorText, formValues, imageToDataUrl, useShop } from './shared'
import type { AdminSettings, Category, Dashboard, Order, Product, SessionUser, Zone } from './types'

type Props = { user: SessionUser; dashboard: Dashboard; categories: Category[]; zones: Zone[]; reload: () => Promise<void>; reloadCatalog: () => Promise<void>; onStore: () => void }

const permissionOptions = [
  { key: 'manage_products', label: 'إدارة المنتجات (إضافة وتعديل وحذف)' },
  { key: 'view_orders', label: 'عرض طلبات المتجر' },
  { key: 'manage_orders', label: 'تحديث حالة الطلبات (قبول / رفض / تسليم)' },
] as const

function Metric({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note?: string; tone: string }) {
  return (
    <article className="metric">
      <span className={`metric-icon tone-${tone}`}>{icon}</span>
      <div><small>{label}</small><strong>{value}</strong>{note && <em>{note}</em>}</div>
    </article>
  )
}

export function DashboardApp({ user, dashboard, categories, zones, reload, reloadCatalog, onStore }: Props) {
  const { signOut } = useShop()
  const isOwner = user.role === 'owner'
  const perms = new Set(dashboard.permissions)
  const canOrders = isOwner || perms.has('view_orders')
  const canManageOrders = isOwner || perms.has('manage_orders')
  const canProducts = isOwner || perms.has('manage_products')

  const nav = [
    { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard, show: true },
    { id: 'orders', label: 'الطلبات', icon: Package, show: canOrders, badge: dashboard.stats.pending },
    { id: 'products', label: 'المنتجات', icon: ShoppingBag, show: canProducts },
    { id: 'categories', label: 'الأقسام', icon: LayoutGrid, show: isOwner },
    { id: 'vendors', label: 'التجار', icon: Users, show: isOwner },
    { id: 'shipping', label: 'الشحن', icon: Truck, show: isOwner },
    { id: 'offers', label: 'العروض والشحن المجاني', icon: Zap, show: isOwner },
    { id: 'wallet', label: 'العمولات', icon: Wallet, show: isOwner },
    { id: 'notifications', label: 'الإشعارات', icon: Bell, show: isOwner, badge: dashboard.unreadCount },
    { id: 'account', label: 'حسابي', icon: KeyRound, show: true },
  ].filter((item) => item.show)
  const [page, setPage] = useState('overview')
  const current = nav.some((item) => item.id === page) ? page : 'overview'

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) void reload()
    }, 20_000)
    return () => clearInterval(timer)
  }, [reload])

  return (
    <div className="dash">
      <aside className="dash-side">
        <div className="dash-brand"><span className="logo-mark"><Store /></span><div><strong>RTX Shop</strong><small>{isOwner ? 'لوحة المالك' : 'لوحة التاجر'}</small></div></div>
        <nav className="dash-nav" aria-label="القائمة">
          {nav.map((item) => (
            <button key={item.id} type="button" className={current === item.id ? 'on' : ''} onClick={() => setPage(item.id)}>
              <item.icon /><span>{item.label}</span>
              {item.badge ? <b>{item.badge}</b> : null}
            </button>
          ))}
        </nav>
        <div className="dash-foot">
          <button type="button" onClick={onStore}><ChevronLeft /> رجوع للمتجر</button>
          <button type="button" className="danger" onClick={() => void signOut()}><LogOut /> خروج</button>
        </div>
      </aside>
      <main className="dash-main">
        <header className="dash-top">
          <div><small>أهلاً {user.name.split(' ')[0]}</small><h1>{nav.find((item) => item.id === current)?.label}</h1></div>
          <button className="btn btn-outline" type="button" onClick={onStore}>شوف المتجر</button>
        </header>
        {isOwner && dashboard.weakOwnerPassword && (
          <div className="notice notice-warn" role="alert">
            كلمة سر المالك لسه هي الافتراضية المعروفة. غيّرها دلوقتي من «حسابي» عشان محدش يقدر يدخل لوحة التحكم.
            <button type="button" className="link" onClick={() => setPage('account')}>غيّر كلمة السر</button>
          </div>
        )}
        <div className="dash-content" key={current}>
          {current === 'overview' && <Overview user={user} dashboard={dashboard} canOrders={canOrders} canProducts={canProducts} go={setPage} />}
          {current === 'orders' && <OrdersPage orders={dashboard.orders} canManage={canManageOrders} reload={reload} />}
          {current === 'products' && <ProductsPage dashboard={dashboard} categories={categories} isOwner={isOwner} reload={async () => { await reload(); await reloadCatalog() }} />}
          {current === 'categories' && <CategoriesPage categories={categories} products={dashboard.products} reload={async () => { await reload(); await reloadCatalog() }} />}
          {current === 'vendors' && <VendorsPage dashboard={dashboard} reload={reload} />}
          {current === 'shipping' && <ShippingPage zones={zones} reload={reloadCatalog} />}
          {current === 'offers' && <OffersPage reloadCatalog={reloadCatalog} />}
          {current === 'wallet' && <WalletPage dashboard={dashboard} />}
          {current === 'notifications' && <NotificationsPage dashboard={dashboard} reload={reload} go={setPage} />}
          {current === 'account' && <AccountPage user={user} />}
        </div>
      </main>
    </div>
  )
}

// ───────────────────────── نظرة عامة ─────────────────────────

export function Overview({ user, dashboard, canOrders, canProducts, go }: { user: SessionUser; dashboard: Dashboard; canOrders: boolean; canProducts: boolean; go: (id: string) => void }) {
  const isOwner = user.role === 'owner'
  const { stats } = dashboard
  return (
    <div className="stack-lg">
      {canOrders ? (
        <>
          <div className="metrics">
            {isOwner && <Metric tone="green" icon={<CircleDollarSign />} label="رصيد العمولات" value={money(dashboard.wallet?.balanceCents)} note="من الطلبات اللي اتسلّمت" />}
            <Metric tone="blue" icon={<Package />} label="كل الطلبات" value={String(stats.total)} />
            <Metric tone="amber" icon={<Clock3 />} label="طلبات جديدة" value={String(stats.pending)} note="مستنية قرارك" />
            <Metric tone="purple" icon={<Truck />} label="اتسلّمت" value={String(stats.delivered)} note={`مبيعات ${money(stats.salesCents)}`} />
            {!isOwner && <Metric tone="green" icon={<CircleDollarSign />} label="صافي أرباحك" value={money(stats.salesCents - dashboard.commissionTotalCents)} note={`بعد عمولة المنصة ${money(dashboard.commissionTotalCents)}`} />}
          </div>
          <section className="panel">
            <div className="panel-head"><h3>آخر الطلبات</h3><button className="link" type="button" onClick={() => go('orders')}>كل الطلبات ←</button></div>
            {dashboard.orders.length === 0 ? <Empty text="مفيش طلبات لسه." /> : (
              <ul className="mini-list">
                {dashboard.orders.slice(0, 6).map((order) => (
                  <li key={order.id}>
                    <strong dir="ltr">#{orderCode(order.id)}</strong>
                    <span>{order.customerName}</span>
                    <span className="muted">{dateLabel(order.createdAt)}</span>
                    <b>{money(order.subtotalCents + order.shippingFeeCents)}</b>
                    <StatusBadge status={order.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="notice">عرض الطلبات مش مفعّل لحسابك. اطلب من صاحب المتجر يفعّله لو محتاجه.</p>
      )}
      <div className="quick">
        {canProducts && <button type="button" onClick={() => go('products')}><span><Plus /></span><div><strong>ضيف منتج</strong><small>ارفع صورة وحدد السعر والمخزون</small></div></button>}
        {isOwner && <button type="button" onClick={() => go('vendors')}><span><Users /></span><div><strong>ضيف تاجر</strong><small>اعمل حساب لتاجر جديد</small></div></button>}
        {isOwner && <button type="button" onClick={() => go('categories')}><span><LayoutGrid /></span><div><strong>نظّم الأقسام</strong><small>أجهزة، ساعات، سماعات…</small></div></button>}
      </div>
    </div>
  )
}

// ───────────────────────── الطلبات ─────────────────────────

export function OrdersPage({ orders, canManage, reload }: { orders: Order[]; canManage: boolean; reload: () => Promise<void> }) {
  const { busyId, act } = useOrderActions(reload)
  const [filter, setFilter] = useState<'all' | Order['status']>('all')
  const [query, setQuery] = useState('')
  const shown = orders.filter((order) => {
    if (filter !== 'all' && order.status !== filter) return false
    const hay = `${orderCode(order.id)} ${order.customerName} ${order.customerPhone} ${order.items.map((item) => item.name).join(' ')}`.toLowerCase()
    return hay.includes(query.trim().toLowerCase())
  })
  const filters: Array<['all' | Order['status'], string]> = [['all', 'الكل'], ['new', 'جديد'], ['accepted', 'اتقبل'], ['delivered', 'اتسلّم'], ['rejected', 'اترفض']]
  return (
    <div className="stack-lg">
      <div className="toolbar">
        <div className="chips">{filters.map(([key, label]) => <button key={key} type="button" className={`chip ${filter === key ? 'on' : ''}`} onClick={() => setFilter(key)}>{label}</button>)}</div>
        <label className="search small"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="دوّر باسم العميل أو رقمه أو كود الطلب" /></label>
      </div>
      {shown.length === 0 ? <Empty text="مفيش طلبات مطابقة." /> : (
        <div className="orders">{shown.map((order) => <OrderCard key={order.id} order={order} mode="staff" canManage={canManage} busy={busyId === order.id} onAction={(id, action) => void act(id, action)} />)}</div>
      )}
    </div>
  )
}

// ───────────────────────── المنتجات ─────────────────────────

export function ProductForm({ product, categories, sellers, isOwner, onClose, onSaved }: { product: Product | null; categories: Category[]; sellers: Dashboard['sellers']; isOwner: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
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
      notify(product ? 'تم حفظ التعديلات' : 'تم إضافة المنتج')
      onClose()
    } catch (reason) {
      setError(errorText(reason))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={product ? 'تعديل المنتج' : 'منتج جديد'} size="lg">
      <form className="form-grid" onSubmit={submit}>
        <Field label="اسم المنتج" className="span2"><input name="name" required maxLength={120} defaultValue={product?.name ?? ''} placeholder="مثال: سماعة بلوتوث RTX Pro" /></Field>
        <Field label="القسم">
          <select name="categoryId" required defaultValue={product?.categoryId ?? ''}>
            <option value="" disabled>اختار القسم…</option>
            {tree.map((top) => (
              <optgroup key={top.id} label={`${top.icon} ${top.name}`}>
                <option value={top.id}>{top.name} (عام)</option>
                {top.children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        {isOwner && (
          <Field label="البائع">
            <select name="vendorId" defaultValue={product?.vendorId ?? sellers[0]?.id}>
              {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.storeName}</option>)}
            </select>
          </Field>
        )}
        <Field label="السعر (ج.م)"><input name="price" type="number" min="0" step="0.01" required defaultValue={product ? product.priceCents / 100 : ''} inputMode="decimal" /></Field>
        <Field label="السعر قبل الخصم (اختياري)" hint="لو كتبته هيظهر خصم على المنتج"><input name="oldPrice" type="number" min="0" step="0.01" defaultValue={product?.oldPriceCents ? product.oldPriceCents / 100 : ''} inputMode="decimal" /></Field>
        <Field label="الكمية في المخزون"><input name="stock" type="number" min="0" step="1" required defaultValue={product?.stock ?? 1} inputMode="numeric" /></Field>
        {isOwner && (
          <Field label="عمولتك على المنتج (%)" hint="النسبة اللي بتاخدها من كل بيعة — إنت بس اللي بتحددها">
            <input name="commissionPercent" type="number" min="0" max="100" step="0.5" required defaultValue={product?.commissionPercent ?? 10} inputMode="decimal" />
          </Field>
        )}
        <div className="field span2">
          <span className="field-label">صورة المنتج</span>
          <div className="imgpick">
            <div className="imgpick-prev">{preview ? <img src={preview} alt="" /> : <ImagePlus />}</div>
            <div className="stack-sm">
              <label className="btn btn-outline"><ImagePlus /> اختار صورة<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void pick(event.target.files?.[0])} /></label>
              {preview && <button type="button" className="btn btn-ghost" onClick={() => { setImageData(null); setClearImage(true) }}><Trash2 /> شيل الصورة</button>}
              <small className="muted">بتتصغّر تلقائي عشان الموقع يفضل سريع</small>
            </div>
          </div>
          {!imageData && <input name="imageUrl" type="url" dir="ltr" placeholder="أو الصق رابط صورة (https://…)" defaultValue={product?.imageUrl && !product.imageUrl.startsWith('/api/') ? product.imageUrl : ''} />}
        </div>
        <Field label="البطارية (اختياري)"><input name="battery" maxLength={200} defaultValue={product?.battery ?? ''} placeholder="مثال: تشغيل حتى 30 ساعة" /></Field>
        <Field label="مدة الضمان (اختياري)"><input name="warranty" maxLength={200} defaultValue={product?.warranty ?? ''} placeholder="اكتبها فقط لو متأكد منها" /></Field>
        <Field label="محتويات العلبة (اختياري)" className="span2"><input name="boxContents" maxLength={400} defaultValue={product?.boxContents ?? ''} placeholder="مثال: السماعة، كابل شحن، دليل الاستخدام" /></Field>
        <Field label="وصف المنتج" className="span2"><textarea name="description" rows={4} maxLength={3000} defaultValue={product?.description ?? ''} placeholder="تفاصيل إضافية عن المنتج" /></Field>
        {isOwner && product && <label className="check span2"><input type="checkbox" name="active" defaultChecked={product.active !== false} /> ظاهر في المتجر</label>}
        {error && <p className="form-error span2" role="alert">{error}</p>}
        <div className="form-actions span2">
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}><Save /> {busy ? 'بنحفظ…' : 'حفظ'}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </Modal>
  )
}

function CommissionEditor({ product, onSaved }: { product: Product; onSaved: () => Promise<void> }) {
  const { notify } = useShop()
  const [value, setValue] = useState(String(product.commissionPercent ?? 0))
  const changed = Number(value) !== Number(product.commissionPercent ?? 0)
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      await api(`products/${product.id}/commission`, 'PATCH', { percent: value })
      await onSaved()
      notify('تم تحديث العمولة')
    } catch (reason) {
      notify(errorText(reason))
    }
  }
  return (
    <form className="commission-edit" onSubmit={save}>
      <label><span>عمولتك</span><input type="number" min="0" max="100" step="0.5" value={value} onChange={(event) => setValue(event.target.value)} aria-label="نسبة العمولة" /><i>%</i></label>
      {changed && <button type="submit" className="btn btn-primary btn-sm"><Save /> حفظ</button>}
    </form>
  )
}

export function ProductsPage({ dashboard, categories, isOwner, reload }: { dashboard: Dashboard; categories: Category[]; isOwner: boolean; reload: () => Promise<void> }) {
  const { notify } = useShop()
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [query, setQuery] = useState('')
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
      notify(visible ? 'المنتج ظهر في المتجر تاني.' : 'المنتج اتخفى من المتجر.')
    } catch (reason) {
      notify(errorText(reason))
    }
  }

  async function removeForever(product: Product) {
    if (!window.confirm(`تحذف «${product.name}» نهائياً؟ مش هينفع ترجع فيه.`)) return
    try {
      await api(`products/${product.id}/permanent`, 'DELETE')
      await reload()
      notify('المنتج اتحذف نهائياً.')
    } catch (reason) {
      notify(errorText(reason))
    }
  }

  async function hide(product: Product) {
    if (!window.confirm(`تخفي «${product.name}» من المتجر؟ الطلبات القديمة هتفضل محفوظة.`)) return
    try {
      await api(`products/${product.id}`, 'DELETE')
      await reload()
      notify('المنتج اتخفى من المتجر.')
    } catch (reason) {
      notify(errorText(reason))
    }
  }

  return (
    <div className="stack-lg">
      <div className="toolbar">
        <label className="search small"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="دوّر في المنتجات" /></label>
        <select value={cat} onChange={(event) => setCat(event.target.value)} aria-label="فلتر القسم">
          <option value="">كل الأقسام</option>
          {tree.map((top) => (
            <optgroup key={top.id} label={`${top.icon} ${top.name}`}>
              <option value={top.id}>{top.name} (الكل)</option>
              {top.children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
            </optgroup>
          ))}
        </select>
        <button className="btn btn-primary" type="button" onClick={() => setEditing('new')}><Plus /> منتج جديد</button>
      </div>
      {shown.length === 0 ? <Empty text={dashboard.products.length ? 'مفيش منتجات مطابقة.' : 'ضيف أول منتج وابدأ البيع 🚀'} /> : (
        <div className="plist">
          {shown.map((product) => (
            <article key={product.id} className={`prow ${product.active === false ? 'off' : ''}`}>
              <div className="prow-img">{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <ShoppingBag />}</div>
              <div className="prow-info">
                <strong>{product.name}</strong>
                <small>{categoryPath(categories, product.categoryId)}{isOwner ? ` · ${product.storeName}` : ''}</small>
                <div className="prow-tags">
                  <span className="price-mini">{money(product.priceCents)}</span>
                  <span className={`stock ${product.stock === 0 ? 'zero' : product.stock <= 3 ? 'low' : ''}`}>المخزون: {product.stock}</span>
                  {product.active === false && <span className="badge badge-rejected">مخفي</span>}
                </div>
              </div>
              <div className="prow-side">
                {isOwner ? <CommissionEditor key={`${product.id}-${product.commissionPercent}`} product={product} onSaved={reload} /> : <span className="chip static">عمولة المنصة {product.commissionPercent}%</span>}
                <div className="prow-actions">
                  <button className="btn btn-outline btn-sm" type="button" onClick={() => setEditing(product)}><Pencil /> تعديل</button>
                  {product.active !== false
                    ? <button className="btn btn-ghost btn-sm" type="button" onClick={() => void hide(product)}><EyeOff /> إخفاء</button>
                    : <button className="btn btn-ghost btn-sm" type="button" onClick={() => void setVisible(product, true)}><Eye /> إظهار</button>}
                  {isOwner && <button className="btn btn-ghost btn-sm danger" type="button" onClick={() => void removeForever(product)}><Trash2 /> حذف نهائي</button>}
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
      notify('تم حفظ القسم')
      setDialog(null)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }
  async function remove(category: Category) {
    if (!window.confirm(`تمسح قسم «${category.name}»؟`)) return
    try {
      await api(`categories/${category.id}`, 'DELETE')
      await reload()
      notify('القسم اتمسح.')
    } catch (reason) {
      notify(errorText(reason))
    }
  }
  const editing = dialog?.mode === 'edit' ? dialog.category : null
  const title = dialog?.mode === 'edit' ? 'تعديل القسم' : dialog?.parent ? `قسم فرعي جديد داخل «${dialog.parent.name}»` : 'قسم رئيسي جديد'

  return (
    <div className="stack-lg">
      <div className="toolbar">
        <p className="muted grow">زي: «الأجهزة الإلكترونية» وتحتها: سماعات، ساعات ذكية، موبايلات…</p>
        <button className="btn btn-primary" type="button" onClick={() => { setError(''); setDialog({ mode: 'create', parent: null }) }}><Plus /> قسم رئيسي</button>
      </div>
      <div className="cats">
        {tree.map((top) => (
          <section key={top.id} className="cat panel">
            <header>
              <span className="emo">{top.icon}</span>
              <div><strong>{top.name}</strong><small>{counts[top.id] ?? 0} منتج</small></div>
              <div className="cat-actions">
                <button className="btn btn-outline btn-sm" type="button" onClick={() => { setError(''); setDialog({ mode: 'create', parent: top }) }}><Plus /> فرعي</button>
                <button className="icon-btn" type="button" onClick={() => { setError(''); setDialog({ mode: 'edit', category: top }) }} aria-label="تعديل"><Pencil /></button>
                <button className="icon-btn danger" type="button" onClick={() => void remove(top)} aria-label="مسح"><Trash2 /></button>
              </div>
            </header>
            <div className="subcats">
              {top.children.length === 0 && <small className="muted">مفيش أقسام فرعية.</small>}
              {top.children.map((child) => (
                <span key={child.id} className="subcat">
                  {child.name} <em>{counts[child.id] ?? 0}</em>
                  <button type="button" onClick={() => { setError(''); setDialog({ mode: 'edit', category: child }) }} aria-label={`تعديل ${child.name}`}><Pencil /></button>
                  <button type="button" className="danger" onClick={() => void remove(child)} aria-label={`مسح ${child.name}`}><X /></button>
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
      {dialog && (
        <Modal open onClose={() => setDialog(null)} title={title} size="sm">
          <form className="stack" onSubmit={submit}>
            <Field label="اسم القسم"><input name="name" required maxLength={80} defaultValue={editing?.name ?? ''} autoFocus /></Field>
            <Field label="أيقونة (إيموجي)" hint="مثال: 🎧 أو ⌚"><input name="icon" maxLength={8} defaultValue={editing?.icon ?? ''} /></Field>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={busy}><Save /> حفظ</button>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ───────────────────────── التجار ─────────────────────────

export function VendorsPage({ dashboard, reload }: { dashboard: Dashboard; reload: () => Promise<void> }) {
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
      notify('تم إنشاء حساب التاجر — ابعتله بيانات الدخول بشكل آمن.')
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
      notify('تم حفظ الصلاحيات')
    } catch (reason) {
      notify(errorText(reason))
    }
  }

  return (
    <div className="stack-lg">
      <div className="toolbar">
        <p className="muted grow">التجار بيضيفوا منتجاتهم، وإنت اللي بتحدد عمولتك على كل منتج من صفحة «المنتجات».</p>
        <button className="btn btn-primary" type="button" onClick={() => { setError(''); setOpen(true) }}><Plus /> تاجر جديد</button>
      </div>
      {dashboard.vendors.length === 0 ? <Empty text="مفيش تجار لسه. المتجر شغال بمنتجاتك إنت." /> : (
        <div className="vendors">
          {dashboard.vendors.map((vendor) => (
            <article key={vendor.id} className="vendor panel">
              <header><span className="avatar">{vendor.storeName.slice(0, 1)}</span><div><strong>{vendor.storeName}</strong><small>{vendor.name} · <span dir="ltr">{vendor.phone}</span> · @{vendor.username}</small></div></header>
              <p className="muted tiny">{vendor.storeAddress}</p>
              <form onSubmit={(event) => void savePermissions(event, vendor.id)} key={vendor.permissions.join(',')}>
                <div className="perms">
                  {permissionOptions.map(({ key, label }) => <label key={key} className="check"><input type="checkbox" name="permissions" value={key} defaultChecked={vendor.permissions.includes(key)} /> {label}</label>)}
                </div>
                <button className="btn btn-outline btn-sm" type="submit"><Save /> حفظ الصلاحيات</button>
              </form>
            </article>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="تاجر جديد" size="lg">
        <form className="form-grid" onSubmit={create}>
          <Field label="اسم التاجر"><input name="name" required maxLength={100} /></Field>
          <Field label="اسم المتجر"><input name="storeName" required maxLength={120} /></Field>
          <Field label="اسم المستخدم للدخول" hint="إنجليزي بدون مسافات"><input name="username" required dir="ltr" pattern="[A-Za-z0-9._\-]{3,32}" /></Field>
          <Field label="كلمة سر مؤقتة" hint="8 حروف أو أرقام على الأقل"><input name="password" type="text" required minLength={8} dir="ltr" /></Field>
          <Field label="موبايل التاجر"><input name="phone" required dir="ltr" inputMode="tel" placeholder="01012345678" /></Field>
          <Field label="الإيميل (اختياري)"><input name="email" type="email" dir="ltr" /></Field>
          <Field label="عنوان المتجر" className="span2"><input name="storeAddress" required maxLength={240} /></Field>
          <fieldset className="span2 perms-set">
            <legend>الصلاحيات</legend>
            {permissionOptions.map(({ key, label }) => <label key={key} className="check"><input type="checkbox" name="permissions" value={key} defaultChecked /> {label}</label>)}
          </fieldset>
          {error && <p className="form-error span2" role="alert">{error}</p>}
          <div className="form-actions span2"><button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? 'ثانية…' : 'إنشاء الحساب'}</button></div>
        </form>
      </Modal>
    </div>
  )
}

// ───────────────────────── الشحن ─────────────────────────

function ZoneRow({ zone, onSaved }: { zone: Zone; onSaved: () => Promise<void> }) {
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
      notify(`تم تحديث شحن ${zone.name}`)
    } catch (reason) {
      notify(errorText(reason))
    }
  }
  return (
    <form className="zone" onSubmit={save}>
      <strong>{zone.name}</strong>
      <label><input type="number" min="0" step="0.5" value={value} onChange={(event) => setValue(event.target.value)} aria-label={`شحن ${zone.name}`} /><i>ج.م</i></label>
      <label><input type="number" min="0" max="60" step="1" value={minDays} onChange={(event) => setMinDays(event.target.value)} placeholder="من" aria-label={`أقل مدة توصيل لـ ${zone.name} بالأيام`} /><i>يوم</i></label>
      <label><input type="number" min="0" max="60" step="1" value={maxDays} onChange={(event) => setMaxDays(event.target.value)} placeholder="إلى" aria-label={`أقصى مدة توصيل لـ ${zone.name} بالأيام`} /><i>يوم</i></label>
      <button className="btn btn-primary btn-sm" type="submit" disabled={!changed}><Save /></button>
    </form>
  )
}

export function ShippingPage({ zones, reload }: { zones: Zone[]; reload: () => Promise<void> }) {
  return (
    <div className="stack-lg">
      <p className="muted">سعر الشحن ومدة التوصيل المتوقعة لكل محافظة (الشحن بيتحسب على كل تاجر في الطلب). مدة التوصيل بتظهر للعميل قبل التأكيد — اكتبها بس لو متأكد منها، وإلا هتظهر كعنصر نائب.</p>
      <div className="zones">{zones.map((zone) => <ZoneRow key={`${zone.id}-${zone.shippingFeeCents}-${zone.deliveryDaysMin}-${zone.deliveryDaysMax}`} zone={zone} onSaved={reload} />)}</div>
    </div>
  )
}

// ───────────────────────── العروض والشحن المجاني ─────────────────────────

export function OffersPage({ reloadCatalog }: { reloadCatalog: () => Promise<void> }) {
  const { notify } = useShop()
  const [saved, setSaved] = useState<AdminSettings | null>(null)
  const [threshold, setThreshold] = useState('')
  const [flashEnd, setFlashEnd] = useState('')
  const [busy, setBusy] = useState('')

  function apply(settings: AdminSettings) {
    setSaved(settings)
    setThreshold(settings.freeShippingThresholdCents === null ? '' : String(settings.freeShippingThresholdCents / 100))
    setFlashEnd(settings.flashSaleEndsAtLocal)
  }
  useEffect(() => {
    api<AdminSettings>('settings').then(apply).catch((reason) => notify(errorText(reason)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(event: FormEvent, key: 'freeShippingThreshold' | 'flashEndsAt', value: string, message: string) {
    event.preventDefault()
    setBusy(key)
    try {
      apply(await api<AdminSettings>('settings', 'PATCH', { [key]: value }))
      await reloadCatalog()
      notify(message)
    } catch (reason) {
      notify(errorText(reason))
    } finally {
      setBusy('')
    }
  }

  if (!saved) return <p className="muted">جاري التحميل…</p>
  return (
    <div className="stack-lg narrow">
      <form className="panel stack" onSubmit={(event) => void save(event, 'freeShippingThreshold', threshold, threshold ? 'اتحفظ حد الشحن المجاني' : 'اتلغى الشحن المجاني')}>
        <div>
          <h2>الشحن المجاني</h2>
          <p className="muted">لو إجمالي سلة العميل (المنتجات من غير الشحن) وصل للمبلغ ده، الشحن بيبقى مجاني. العميل بيشوف شريط «باقي ليك X جنيه وتوصيلك يبقى مجاني» في السلة. سيب الخانة فاضية لإلغاء الشحن المجاني.</p>
        </div>
        <Field label="حد الشحن المجاني (ج.م)">
          <input type="number" min="0" step="1" inputMode="numeric" value={threshold} onChange={(event) => setThreshold(event.target.value)} placeholder="مثال: 1000" />
        </Field>
        <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={busy === 'freeShippingThreshold'}><Save /> حفظ</button></div>
      </form>

      <form className="panel stack" onSubmit={(event) => void save(event, 'flashEndsAt', flashEnd, flashEnd ? 'اتحفظ موعد انتهاء العرض' : 'العرض رجع يتجدد يومياً')}>
        <div>
          <h2>عروض النهارده</h2>
          <p className="muted">القسم بيعرض المنتجات اللي عليها خصم (سعر قبل الخصم أكبر من سعر البيع) مع عداد تنازلي. لو حددت موعد انتهاء (بتوقيت القاهرة) العداد بيعدّ لحد الموعد ده وبعده القسم بيختفي. لو سيبت الخانة فاضية العرض بيتجدد يومياً وبينتهي منتصف الليل.</p>
        </div>
        <Field label="ينتهي العرض في (بتوقيت القاهرة)">
          <input type="datetime-local" value={flashEnd} onChange={(event) => setFlashEnd(event.target.value)} dir="ltr" />
        </Field>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy === 'flashEndsAt'}><Save /> حفظ</button>
          {flashEnd && <button className="btn btn-outline" type="button" onClick={() => setFlashEnd('')}>مسح الموعد (عرض يومي)</button>}
        </div>
      </form>
    </div>
  )
}

// ───────────────────────── العمولات / الإشعارات / الحساب ─────────────────────────

export function WalletPage({ dashboard }: { dashboard: Dashboard }) {
  return (
    <div className="stack-lg">
      <div className="metrics"><Metric tone="green" icon={<Wallet />} label="رصيد عمولاتك" value={money(dashboard.wallet?.balanceCents)} note="بتتضاف أوتوماتيك لما الطلب يتسلّم" /></div>
      <section className="panel">
        <div className="panel-head"><h3>آخر العمولات</h3></div>
        {dashboard.ledger.length === 0 ? <Empty text="هتظهر هنا عمولاتك بعد أول طلب يتسلّم." /> : (
          <ul className="mini-list">
            {dashboard.ledger.map((row) => (
              <li key={row.id}><strong>{row.description}</strong><span className="muted">{dateLabel(row.createdAt)}</span><b className="plus">+{money(row.amountCents)}</b></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function NotificationsPage({ dashboard, reload, go }: { dashboard: Dashboard; reload: () => Promise<void>; go: (id: string) => void }) {
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
      <div className="toolbar"><p className="muted grow">{dashboard.unreadCount} إشعار جديد</p><button className="btn btn-outline" type="button" onClick={() => void readAll()} disabled={dashboard.unreadCount === 0}><CheckCheck /> علّم الكل مقروء</button></div>
      {dashboard.notifications.length === 0 ? <Empty text="مفيش إشعارات." icon={<Bell />} /> : (
        <ul className="notices">
          {dashboard.notifications.map((item) => (
            <li key={item.id} className={item.readAt ? '' : 'unread'}>
              <div><strong>{item.title}</strong><p>{item.body}</p><small>{dateLabel(item.createdAt)}</small></div>
              <div className="notice-actions">
                {item.orderId && <button className="btn btn-ghost btn-sm" type="button" onClick={() => go('orders')}>الطلبات</button>}
                {!item.readAt && <button className="btn btn-outline btn-sm" type="button" onClick={() => void read(item.id)}>تمام</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AccountPage({ user }: { user: SessionUser }) {
  const { notify } = useShop()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = formValues(event)
    if (values.newPassword !== values.confirm) return setError('كلمتين السر الجداد مش متطابقين')
    setBusy(true)
    setError('')
    try {
      await api('account/password', 'POST', { currentPassword: values.currentPassword, newPassword: values.newPassword })
      form.reset()
      notify('تم تغيير كلمة السر')
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="stack-lg narrow">
      <section className="panel">
        <div className="panel-head"><h3>بيانات الحساب</h3></div>
        <dl className="kv">
          <div><dt>الاسم</dt><dd>{user.name}</dd></div>
          <div><dt>اسم المستخدم</dt><dd dir="ltr">{user.username}</dd></div>
          {user.storeName && <div><dt>المتجر</dt><dd>{user.storeName}</dd></div>}
        </dl>
      </section>
      <section className="panel">
        <div className="panel-head"><h3>تغيير كلمة السر</h3></div>
        <form className="stack" onSubmit={submit}>
          <Field label="كلمة السر الحالية"><input name="currentPassword" type="password" required dir="ltr" autoComplete="current-password" /></Field>
          <Field label="كلمة السر الجديدة" hint="8 حروف أو أرقام على الأقل"><input name="newPassword" type="password" required minLength={8} dir="ltr" autoComplete="new-password" /></Field>
          <Field label="أكّد كلمة السر الجديدة"><input name="confirm" type="password" required minLength={8} dir="ltr" autoComplete="new-password" /></Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}><KeyRound /> غيّر كلمة السر</button>
        </form>
      </section>
    </div>
  )
}
