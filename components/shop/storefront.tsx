'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Banknote, Check, ChevronDown, Heart, LayoutDashboard, LayoutGrid, LogIn, LogOut, MapPin, Menu, MessageCircle, Minus,
  PackageSearch, Plus, Search, ShoppingBag, ShoppingCart, Store, UserRound, X,
  Cpu, Gamepad2, Headphones, Sparkles,
} from 'lucide-react'
import { CrystalButton, FxToggle, GlassDock, HoloCard, HoloPodium, flyThrough, fx } from '../rtx3d'
import { MAX_QTY_PER_PRODUCT, PLACEHOLDERS, STORE_NAME, WHATSAPP_DISPLAY } from '@/lib/config'
import { whatsappLink } from '@/lib/format'
import { categoryCover, categoryPath, type CategoryNode } from './category-utils'
import { Hue, LangSwitch, useLang, type HueName } from './i18n'
import { ProductImage } from './product-image'
import { Empty, Modal, discountPercent, useShop } from './shared'
import type { Catalog, Product } from './types'

const style = (vars: Record<string, string | number>) => vars as CSSProperties

function Wordmark({ small }: { small?: boolean }) {
  return (
    <span className={`wordmark ${small ? 'wordmark-sm' : ''}`} aria-hidden="true">
      <span>RTX</span><i /><em>SHOP</em>
    </span>
  )
}

// ───────────────────────── الأقسام (قايمة منسدلة) ─────────────────────────

function MegaMenu({ tree, counts, selected, onSelect }: { tree: CategoryNode[]; counts: Record<string, number>; selected: string | null; onSelect: (id: string | null) => void }) {
  const { tr } = useLang()
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState<string>('')
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = tree.find((node) => node.id === hover) ?? tree[0]

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      btnRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (min-width: 900px)').matches
  const enter = () => {
    if (!canHover()) return
    if (timer.current) clearTimeout(timer.current)
    setOpen(true)
  }
  const leave = () => {
    if (!canHover()) return
    timer.current = setTimeout(() => setOpen(false), 160)
  }
  const pick = (id: string | null) => {
    onSelect(id)
    setOpen(false)
  }

  return (
    <div className="mega" ref={ref} onMouseEnter={enter} onMouseLeave={leave}>
      <button ref={btnRef} className={`mega-btn ${open ? 'open' : ''}`} type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
        <Menu /> <span>{tr('الأقسام', 'Categories')}</span> <ChevronDown className="chev" />
      </button>
      <div className={`mega-panel ${open ? 'open' : ''}`}>
        <div className="mega-tops">
          <button type="button" className={`mega-top ${selected === null ? 'on' : ''}`} onClick={() => pick(null)}>{tr('كل المنتجات', 'All products')}</button>
          {tree.map((node, index) => (
            <button
              key={node.id}
              type="button"
              aria-pressed={active?.id === node.id}
              className={`mega-top ${active?.id === node.id ? 'on' : ''}`}
              style={style({ '--i': index })}
              onMouseEnter={() => canHover() && setHover(node.id)}
              onFocus={() => setHover(node.id)}
              onClick={() => (canHover() ? pick(node.id) : setHover(node.id))}
            >
              <span className="mega-name">{node.name}</span>
              {counts[node.id] ? <em>{counts[node.id]}</em> : null}
            </button>
          ))}
        </div>
        {active && (
          <div className="mega-sub" key={active.id}>
            <div className="mega-sub-head">
              <strong>{active.name}</strong>
              <button type="button" className="link" onClick={() => pick(active.id)}>{tr(`عرض كل ${active.name} ←`, `View all ${active.name} →`)}</button>
            </div>
            <div className="mega-grid">
              {active.children.length === 0 && <p className="muted">{tr('مفيش أقسام فرعية.', 'No sub-categories.')}</p>}
              {active.children.map((child, index) => (
                <button key={child.id} type="button" className={`mega-item ${selected === child.id ? 'on' : ''}`} style={style({ '--i': index })} onClick={() => pick(child.id)}>
                  <span>{child.name}</span>
                  {counts[child.id] ? <em>{counts[child.id]}</em> : null}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function UserMenu({ onOrders, onDash }: { onOrders: () => void; onDash: () => void }) {
  const { tr } = useLang()
  const { user, openAuth, signOut } = useShop()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent | TouchEvent) => !ref.current?.contains(event.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  if (!user) {
    return (
      <>
        <button className="btn btn-ghost hide-sm" type="button" onClick={() => openAuth('in')}><LogIn /> {tr('دخول', 'Sign in')}</button>
        <button className="btn btn-primary hide-sm" type="button" onClick={() => openAuth('up')}>{tr('حساب جديد', 'Sign up')}</button>
        <button className="icon-btn show-sm" type="button" onClick={() => openAuth('in')} aria-label={tr('دخول', 'Sign in')}><UserRound /></button>
      </>
    )
  }
  const staff = user.role !== 'user'
  return (
    <div className="umenu" ref={ref}>
      <button className="avatar-btn" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={tr('حسابي', 'My account')} data-tip={tr('حسابي', 'My account')}>
        <span>{user.name.slice(0, 1)}</span>
      </button>
      <div className={`dropdown ${open ? 'open' : ''}`}>
        <div className="dropdown-head">
          <strong>{user.name}</strong>
          <small>{user.role === 'owner' ? tr('صاحب المتجر', 'Owner') : user.role === 'vendor' ? tr('تاجر', 'Vendor') : user.phone ?? tr('عميل', 'Customer')}</small>
        </div>
        {staff ? (
          <button type="button" onClick={() => { setOpen(false); onDash() }}><LayoutDashboard /> {tr('لوحة التحكم', 'Dashboard')}</button>
        ) : (
          <button type="button" onClick={() => { setOpen(false); onOrders() }}><ShoppingBag /> {tr('طلباتي', 'My orders')}</button>
        )}
        <button type="button" className="danger" onClick={() => void signOut()}><LogOut /> {tr('تسجيل خروج', 'Sign out')}</button>
      </div>
    </div>
  )
}

// ───────────────────────── الهيدر ─────────────────────────

export function Header(props: {
  tree: CategoryNode[]
  counts: Record<string, number>
  selected: string | null
  onSelect: (id: string | null) => void
  query: string
  onQuery: (value: string) => void
  cartCount: number
  bump: number
  onCart: () => void
  onHome: () => void
  onOrders: () => void
  onDash: () => void
}) {
  const { tr } = useLang()
  const { user, openAuth } = useShop()
  const [dockTab, setDockTab] = useState<'home' | 'cats' | 'cart' | 'profile'>('home')
  const searchRef = useRef<HTMLInputElement>(null)
  // اختصار «/» بيفتح البحث من أي مكان (على الكمبيوتر)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  const activeTop = props.tree.find((node) => node.id === props.selected || node.children.some((child) => child.id === props.selected))?.id ?? null
  const dockItems = [{ id: null, label: tr('الكل', 'All') }, ...props.tree.slice(0, 7).map((node) => ({ id: node.id as string | null, label: node.name }))]

  return (
    <>
      <div className="topbar">
        <Hue c="teal">{tr('كاش عند الاستلام', 'Cash on delivery')}</Hue>
        <i aria-hidden="true" />
        <Hue c="amber">{tr('شحن لكل مصر', 'Shipping across Egypt')}</Hue>
        <i aria-hidden="true" className="hide-sm" />
        <span className="hide-sm"><Hue c="sky">{tr('واتساب', 'WhatsApp')}</Hue> <span dir="ltr">{WHATSAPP_DISPLAY}</span></span>
      </div>
      <header className="header">
        <div className="header-in">
          <button className="logo" type="button" onClick={() => { setDockTab('home'); props.onHome() }} aria-label={`${STORE_NAME} — ${tr('الرئيسية', 'Home')}`}>
            <Wordmark />
          </button>
          <MegaMenu tree={props.tree} counts={props.counts} selected={props.selected} onSelect={props.onSelect} />
          <label className="search">
            <Search />
            <input ref={searchRef} value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder={tr('ابحث عن منتج…', 'Search products…')} aria-label={tr('بحث', 'Search')} maxLength={80} />
            {!props.query && <kbd className="search-kbd" aria-hidden="true">/</kbd>}
            {props.query && <button type="button" className="icon-btn" onClick={() => props.onQuery('')} aria-label={tr('مسح البحث', 'Clear search')}><X /></button>}
          </label>
          <div className="header-actions">
            <LangSwitch />
            <FxToggle />
            <UserMenu onOrders={props.onOrders} onDash={props.onDash} />
            <button className="cart-btn" type="button" onClick={props.onCart} aria-label={`${tr('السلة', 'Cart')} (${props.cartCount})`} data-tip={tr('السلة', 'Cart')}>
              <ShoppingCart />
              {props.cartCount > 0 && <b key={props.bump} className="cart-count">{props.cartCount}</b>}
            </button>
          </div>
        </div>
        <nav className="subnav" aria-label={tr('أقسام سريعة', 'Quick categories')}>
          <GlassDock label={tr('أقسام سريعة', 'Quick categories')} items={dockItems} active={activeTop} onSelect={props.onSelect} />
        </nav>
      </header>

      <nav className="dock" aria-label={tr('التنقل السريع', 'Quick navigation')}>
        <button type="button" className={`dock-item ${dockTab === 'home' && props.selected === null ? 'on' : ''}`} aria-current={dockTab === 'home' && props.selected === null ? 'page' : undefined} onClick={() => { setDockTab('home'); props.onHome() }}>
          <Store />
          <span>{tr('الرئيسية', 'Home')}</span>
        </button>
        <button
          type="button"
          className={`dock-item ${dockTab === 'cats' || props.selected !== null ? 'on' : ''}`}
          onClick={() => { setDockTab('cats'); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) }}
        >
          <LayoutGrid />
          <span>{tr('الأقسام', 'Browse')}</span>
        </button>
        <button type="button" className={`dock-item ${dockTab === 'cart' ? 'on' : ''}`} aria-label={`${tr('السلة', 'Cart')} (${props.cartCount})`} onClick={() => { setDockTab('cart'); props.onCart() }}>
          <span className="dock-icon">
            <ShoppingBag />
            {props.cartCount > 0 && <em className="dock-badge">{props.cartCount}</em>}
          </span>
          <span>{tr('السلة', 'Cart')}</span>
        </button>
        <button
          type="button"
          className={`dock-item ${dockTab === 'profile' ? 'on' : ''}`}
          onClick={() => {
            setDockTab('profile')
            if (!user) openAuth('in')
            else if (user.role === 'user') props.onOrders()
            else props.onDash()
          }}
        >
          <UserRound />
          <span>{user ? (user.role === 'user' ? tr('طلباتي', 'Orders') : tr('اللوحة', 'Panel')) : tr('حسابي', 'Account')}</span>
        </button>
      </nav>
    </>
  )
}

// ───────────────────────── الواجهة الرئيسية ─────────────────────────

/** عدّاد بيبدأ بعد ما شتر الدخول يترفع */
function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(to)
      return
    }
    let raf = 0
    let wait = 0
    const run = () => {
      const t0 = performance.now()
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1000)
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    const start = () => {
      if (document.documentElement.dataset.intro) wait = window.setTimeout(start, 120)
      else run()
    }
    start()
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(wait)
    }
  }, [to])
  return <>{n}</>
}

function Hero({ onShop, feature, categories }: { onShop: () => void; feature: Product | undefined; categories: Catalog['categories'] }) {
  const { tr, m } = useLang()
  // الهيرو بيعرّف المشهد ثلاثي الأبعاد إنه ظاهر (العنوان الكبير والكريستال بيتعرضوا في الخلفية)
  useEffect(() => {
    fx.heroVisible = true
    return () => { fx.heroVisible = false }
  }, [])
  return (
    <section className="hero3d">
      {/* لو الـ 3D مش شغال بيظهر العنوان كنص، ولو شغال بيفضل للقارئات الصوتية ومحركات البحث */}
      <h1 className="hero3d-title">{STORE_NAME}<span className="sr-only"> — {tr('كاش عند الاستلام وشحن لكل محافظات مصر', 'cash on delivery, shipping to every governorate in Egypt')}</span></h1>
      <div className="hero3d-in">
        <div className="hero-copy glass-panel">
          <p className="hero3d-lead">
            <strong><Hue c="teal">{tr('كاش', 'Cash')}</Hue> {tr('عند الباب.', 'at the door.')}</strong>
            <span><Hue c="amber">{tr('شحن', 'Shipping')}</Hue> {tr('لكل محافظات مصر.', 'to every governorate.')}</span>
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" type="button" onClick={onShop}>{tr('تصفّح المنتجات', 'Browse products')}</button>
            <a className="btn btn-outline btn-lg" href={whatsappLink(`أهلاً ${STORE_NAME}، عايز أسأل عن منتج`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> {tr('واتساب', 'WhatsApp')}</a>
          </div>
        </div>
        {feature && (
          <HoloCard className="hero-feature" strength={7}>
            <div className="hero-feature-media">
              <HoloPodium />
              <ProductImage src={feature.imageUrl} alt={feature.name} sizes="(max-width: 1000px) 80vw, 420px" priority />
            </div>
            <div className="hero-caption">
              <small>{categoryPath(categories, feature.categoryId)}</small>
              <strong>{feature.name}</strong>
              <span>{m(feature.priceCents)}</span>
            </div>
          </HoloCard>
        )}
      </div>
    </section>
  )
}

/** أرقام حقيقية من المتجر (منتجات / أقسام / محافظات) */
function StatsRibbon({ products, categories, zones }: { products: number; categories: number; zones: number }) {
  const { tr } = useLang()
  const items: Array<[number, string, HueName]> = [
    [products, tr('منتج', 'Products'), 'teal'],
    [categories, tr('قسم', 'Categories'), 'amber'],
    [zones, tr('محافظة', 'Governorates'), 'lilac'],
  ]
  const shown = items.filter(([value]) => value > 0)
  if (shown.length === 0) return null
  return (
    <section className="section stats" aria-label={tr('المتجر بالأرقام', 'The store in numbers')}>
      {shown.map(([value, label, hue], index) => (
        <div className="stat" key={label} style={style({ '--i': index })}>
          <strong className={`hue hue-${hue}`}><CountUp to={value} /></strong>
          <span>{label}</span>
        </div>
      ))}
    </section>
  )
}

function Steps() {
  const { tr } = useLang()
  const steps: Array<[string, string, string, ReactNode, HueName]> = [
    ['01', tr('اختار منتجك', 'Pick a product'), tr('من الأقسام أو البحث.', 'Browse or search.'), <PackageSearch key="a" />, 'amber'],
    ['02', tr('اكتب عنوانك', 'Add your address'), tr('المحافظة والشارع بس.', 'Governorate and street.'), <MapPin key="b" />, 'sky'],
    ['03', tr('ادفع كاش', 'Pay cash'), tr('للمندوب وقت الاستلام.', 'To the courier, on arrival.'), <Banknote key="c" />, 'teal'],
  ]
  return (
    <section className="section steps3" aria-label={tr('خطوات الطلب', 'How it works')}>
      <div className="section-head"><div><h2>{tr('ازاي ', 'How it ')}<Hue c="lilac">{tr('بتطلب؟', 'works')}</Hue></h2></div></div>
      <ol className="steps3-grid">
        {steps.map(([n, title, sub, icon, hue], index) => (
          <li key={n} className={`step3 step3-${hue}`} style={style({ '--i': index })}>
            <span className="step3-n">{n}</span>
            <span className="step3-ico">{icon}</span>
            <strong>{title}</strong>
            <small>{sub}</small>
          </li>
        ))}
      </ol>
    </section>
  )
}

function CategoryTiles({ tree, categories, products, counts, selected, total, onSelect }: { tree: CategoryNode[]; categories: Catalog['categories']; products: Product[]; counts: Record<string, number>; selected: string | null; total: number; onSelect: (id: string | null) => void }) {
  const { tr } = useLang()
  if (tree.length === 0) return null
  const topOfSelected = categories.find((category) => category.id === selected)
  const activeTop = topOfSelected?.parentId ?? selected
  const hues: HueName[] = ['teal', 'amber', 'sky', 'lilac', 'coral']
  return (
    <section className="section cats-row" aria-label={tr('الأقسام', 'Categories')}>
      <div className="cat-strip">
        <button type="button" className={`cat-tile ${selected === null ? 'on' : ''}`} aria-pressed={selected === null} onClick={() => onSelect(null)}>
          <span className="cat-thumb"><span className="cat-mono" aria-hidden="true">{tr('الكل', 'All')}</span></span>
          <strong>{tr('كل المنتجات', 'All products')}</strong>
          <small>{total} {tr('منتج', 'items')}</small>
        </button>
        {tree.map((node, index) => {
          const cover = categoryCover(categories, products, node.id)
          return (
            <button key={node.id} type="button" className={`cat-tile hue-tile-${hues[index % hues.length]} ${activeTop === node.id ? 'on' : ''}`} aria-pressed={activeTop === node.id} onClick={() => onSelect(node.id)}>
              <span className="cat-thumb">
                {cover ? <ProductImage src={cover} alt="" sizes="160px" /> : <span className="cat-mono" aria-hidden="true">{node.name.slice(0, 1)}</span>}
              </span>
              <strong>{node.name}</strong>
              <small>{counts[node.id] ?? 0} {tr('منتج', 'items')}</small>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ProductCard({
  product, wished, onWish, categories, onOpen, onAdd,
}: {
  product: Product
  wished: boolean
  onWish: (id: string) => void
  categories: Catalog['categories']
  onOpen: (product: Product) => void
  onAdd: (product: Product) => void
}) {
  const { tr, m } = useLang()
  const discount = discountPercent(product.priceCents, product.oldPriceCents)
  const out = product.stock <= 0
  const [added, setAdded] = useState(false)
  useEffect(() => {
    if (!added) return
    const timer = window.setTimeout(() => setAdded(false), 1400)
    return () => window.clearTimeout(timer)
  }, [added])
  return (
    <HoloCard className={`card ${out ? 'is-out' : ''}`}>
      <div className="card-media-wrap">
        <button className="card-media" type="button" onClick={() => onOpen(product)} aria-label={tr(`تفاصيل ${product.name}`, `Details: ${product.name}`)}>
          <HoloPodium />
          <ProductImage src={product.imageUrl} alt={product.name} sizes="(max-width: 720px) 50vw, (max-width: 1280px) 25vw, 232px" />
        </button>
        {out ? <span className="tag tag-out">{tr('نفد', 'Sold out')}</span> : discount > 0 && <span className="tag">{tr(`خصم ${discount}%`, `${discount}% off`)}</span>}
        {!out && product.stock <= 3 && <span className="tag tag-low">{tr(`باقي ${product.stock}`, `${product.stock} left`)}</span>}
        <button type="button" className={`wish-btn ${wished ? 'on' : ''}`} onClick={() => onWish(product.id)} aria-pressed={wished} aria-label={wished ? tr(`إزالة ${product.name} من المفضلة`, `Remove ${product.name} from wishlist`) : tr(`إضافة ${product.name} للمفضلة`, `Add ${product.name} to wishlist`)}>
          <Heart />
        </button>
      </div>
      <div className="card-body">
        <span className="card-cat">{categoryPath(categories, product.categoryId)}</span>
        <h3 className="card-title" title={product.name}>
          <button type="button" onClick={() => onOpen(product)}>{product.name}</button>
        </h3>
        <div className="price">
          <strong>{m(product.priceCents)}</strong>
          {product.oldPriceCents ? <s>{m(product.oldPriceCents)}</s> : null}
        </div>
        <div className="card-actions">
          {out ? (
            <a className="btn btn-outline" href={whatsappLink(`أهلاً ${STORE_NAME}، المنتج ده نفد: ${product.name} — ممكن أعرف هيتوفر إمتى؟`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> {tr('اسأل عن توفره', 'Ask about stock')}</a>
          ) : (
            <CrystalButton done={added} onClick={() => { onAdd(product); setAdded(true) }}>
              {added ? <><Check /> {tr('اتضافت', 'Added')}</> : <><ShoppingCart /> {tr('أضف للسلة', 'Add to cart')}</>}
            </CrystalButton>
          )}
        </div>
      </div>
    </HoloCard>
  )
}

function Specs({ product }: { product: Product }) {
  const { tr } = useLang()
  const rows: Array<[string, string | null | undefined, string]> = [
    [tr('البطارية', 'Battery'), product.battery, tr(PLACEHOLDERS.battery, '[Battery — owner fills in]')],
    [tr('الضمان', 'Warranty'), product.warranty, tr(PLACEHOLDERS.warranty, '[Warranty — owner fills in]')],
    [tr('محتويات العلبة', 'In the box'), product.boxContents, tr(PLACEHOLDERS.box, '[Box contents — owner fills in]')],
  ]
  return (
    <dl className="specs">
      {rows.map(([label, value, placeholder]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={value ? '' : 'todo'}>{value || placeholder}</dd>
        </div>
      ))}
    </dl>
  )
}

function ProductModal({
  product, categories, onClose, onAdd, onBuyNow,
}: {
  product: Product | null
  categories: Catalog['categories']
  onClose: () => void
  onAdd: (product: Product, quantity: number) => void
  onBuyNow: (product: Product, quantity: number) => void
}) {
  const { tr, m } = useLang()
  const [quantity, setQuantity] = useState(1)
  useEffect(() => setQuantity(1), [product?.id])
  if (!product) return <Modal open={false} onClose={onClose}><span /></Modal>
  const out = product.stock <= 0
  const max = Math.max(1, Math.min(product.stock, MAX_QTY_PER_PRODUCT))
  const discount = discountPercent(product.priceCents, product.oldPriceCents)
  const link = typeof window !== 'undefined' ? window.location.origin : ''
  return (
    <Modal open onClose={onClose} size="lg" title={product.name}>
      <div className="pview">
        <div className="pview-media">
          <HoloPodium />
          <ProductImage src={product.imageUrl} alt={product.name} sizes="(max-width: 720px) 90vw, 420px" priority />
          {out ? <span className="tag tag-out">{tr('نفد', 'Sold out')}</span> : discount > 0 && <span className="tag">{tr(`خصم ${discount}%`, `${discount}% off`)}</span>}
        </div>
        <div className="pview-info">
          <span className="crumb">{categoryPath(categories, product.categoryId)}</span>
          <div className="price big">
            <strong>{m(product.priceCents)}</strong>
            {product.oldPriceCents ? <s>{m(product.oldPriceCents)}</s> : null}
          </div>
          <p className={`stock-note ${out ? 'out' : ''}`}>
            {out ? tr('نفد حالياً — كلّمنا على واتساب', 'Sold out for now. Ask us on WhatsApp.') : product.stock <= 3 ? tr(`باقي ${product.stock} قطع فقط`, `Only ${product.stock} left`) : tr('متوفر', 'In stock')} · {tr('البائع:', 'Seller:')} {product.storeName}
          </p>
          <Specs product={product} />
          {product.description && <p className="pdesc">{product.description}</p>}
          <p className="stock-note">{tr('كاش عند الاستلام · مدة التوصيل بتظهر في السلة.', 'Cash on delivery · delivery time shown in your cart.')}</p>
          {out ? (
            <a className="btn btn-wa btn-lg" href={whatsappLink(`أهلاً ${STORE_NAME}، المنتج ده نفد: ${product.name} — ممكن أعرف هيتوفر إمتى؟\n${link}`)} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> {tr('اسأل عن توفره على واتساب', 'Ask about stock on WhatsApp')}
            </a>
          ) : (
            <>
              <div className="pview-buy">
                <div className="qty">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label={tr('قلل الكمية', 'Decrease quantity')}><Minus /></button>
                  <span aria-live="polite">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(Math.min(max, quantity + 1))} aria-label={tr('زوّد الكمية', 'Increase quantity')}><Plus /></button>
                </div>
                <button className="btn btn-primary btn-lg grow" type="button" onClick={() => { onAdd(product, quantity); onClose() }}>
                  <ShoppingCart /> {tr('أضف للسلة', 'Add to cart')}
                </button>
              </div>
              <button className="btn btn-outline btn-lg full-w" type="button" onClick={() => { onClose(); onBuyNow(product, quantity) }}>
                {tr('اشترِ الآن', 'Buy now')}
              </button>
              <a className="btn btn-wa btn-lg" href={whatsappLink(`أهلاً ${STORE_NAME}، عايز أسأل عن: ${product.name} (${m(product.priceCents)})\n${link}`)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> {tr('اسأل على واتساب', 'Ask on WhatsApp')}
              </a>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

type Sort = 'new' | 'cheap' | 'expensive'
const PAGE = 24

// ───────────────────────── لوحات العرض (Showcase) ─────────────────────────

const SHOWCASE: { key: string; title: [string, string]; match: RegExp; cls: string; icon: typeof Sparkles }[] = [
  { key: 'main', title: ['عرض 3D', '3D view'], match: /(جوردن|jordan|حذاء|كوتش|بلايستيشن|ps5|playstation)/i, cls: 'sc-main', icon: Sparkles },
  { key: 'gpu', title: ['تك', 'Tech'], match: /(rtx|gpu|كرت|geforce|معالج|لاب|كمبيوتر)/i, cls: 'sc-gpu', icon: Cpu },
  { key: 'toys', title: ['ألعاب', 'Toys'], match: /(ألعاب|العاب|toy|figure|تمثال|مجسم|gundam|أكشن)/i, cls: 'sc-toys', icon: Gamepad2 },
  { key: 'gear', title: ['جير', 'Gear'], match: /(سماع|headset|headphone|نظارات|vr|ar |جيمنج|ماوس|كيبورد)/i, cls: 'sc-gear', icon: Headphones },
]

function Showcase({ products, categories, onOpen, onAdd, onSelect, onShop }: { products: Product[]; categories: Catalog['categories']; onOpen: (product: Product) => void; onAdd: (product: Product, quantity?: number) => void; onSelect: (id: string | null) => void; onShop: () => void }) {
  const { tr, m } = useLang()
  const picks = useMemo(() => {
    const used = new Set<string>()
    const pool = products.filter((product) => product.imageUrl)
    const take = (match: RegExp, count: number) => {
      const found = pool.filter((product) => !used.has(product.id) && match.test(`${product.name} ${categoryPath(categories, product.categoryId)}`)).slice(0, count)
      for (const product of pool) {
        if (found.length >= count) break
        if (!used.has(product.id) && !found.includes(product)) found.push(product)
      }
      found.forEach((product) => used.add(product.id))
      return found
    }
    return SHOWCASE.map((panel) => ({ ...panel, items: take(panel.match, panel.key === 'main' ? 2 : panel.key === 'gear' ? 2 : 1) }))
  }, [products, categories])
  if (products.length === 0) return null
  const cartPicks = picks.flatMap((panel) => panel.items).slice(0, 3)
  return (
    <section className="section showcase" aria-label={tr('مختارات', 'Featured')}>
      <div className="showcase-grid">
        {picks.map((panel) => {
          if (panel.items.length === 0) return null
          const Icon = panel.icon
          const lead = panel.items[0]
          return (
            <HoloCard key={panel.key} className={`sc-panel ${panel.cls}`} strength={5}>
              <header className="sc-tab"><Icon aria-hidden="true" /><span>{tr(panel.title[0], panel.title[1])}</span></header>
              <div className="sc-media">
                <HoloPodium />
                {panel.items.map((product) => (
                  <button key={product.id} type="button" className="sc-item" onClick={() => onOpen(product)} aria-label={`${product.name} — ${m(product.priceCents)}`}>
                    <ProductImage src={product.imageUrl} alt={product.name} sizes="(max-width: 1000px) 45vw, 260px" />
                  </button>
                ))}
              </div>
              <footer className="sc-foot">
                <strong>{lead.name}</strong>
                <span className={lead.stock > 0 ? 'sc-stock' : 'sc-out'}>{lead.stock > 0 && <Check aria-hidden="true" />}{lead.stock > 0 ? tr('متوفر', 'In stock') : tr('نفد', 'Sold out')} · {m(lead.priceCents)}</span>
                <button type="button" className="sc-cta" onClick={() => onOpen(lead)}><PackageSearch aria-hidden="true" />{panel.key === 'main' ? tr('افحصه', 'Inspect') : panel.key === 'gear' ? tr('جرّبه', 'Try it') : tr('التفاصيل', 'Details')}</button>
              </footer>
            </HoloCard>
          )
        })}
        {cartPicks.length > 0 && (
          <HoloCard className="sc-panel sc-cart" strength={5}>
            <header className="sc-tab"><ShoppingBag aria-hidden="true" /><span>{tr('سريع', 'Quick add')}</span></header>
            <ul className="sc-list">
              {cartPicks.map((product) => (
                <li key={product.id}>
                  <div className="sc-thumb"><ProductImage src={product.imageUrl} alt="" sizes="56px" /></div>
                  <div><strong>{product.name}</strong><span>{m(product.priceCents)}</span></div>
                  <button type="button" className="sc-cta" disabled={product.stock <= 0} onClick={() => onAdd(product)}><ShoppingCart aria-hidden="true" />{tr('أضف', 'Add')}</button>
                </li>
              ))}
            </ul>
            <button type="button" className="sc-more" onClick={() => { onSelect(null); onShop() }}>{tr('كل المنتجات', 'See everything')}</button>
          </HoloCard>
        )}
      </div>
    </section>
  )
}

export function Home(props: {
  catalog: Catalog
  tree: CategoryNode[]
  counts: Record<string, number>
  selected: string | null
  onSelect: (id: string | null) => void
  products: Product[]
  query: string
  onAdd: (product: Product, quantity?: number) => void
  onBuyNow: (product: Product, quantity?: number) => void
}) {
  const { tr } = useLang()
  const { notify } = useShop()
  const [sort, setSort] = useState<Sort>('new')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [visible, setVisible] = useState(PAGE)
  const [open, setOpen] = useState<Product | null>(null)
  const [wishlist, setWishlist] = useState<string[]>([])

  useEffect(() => setVisible(PAGE), [props.selected, props.query, sort, minPrice, maxPrice])
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('rtx-wish') || '[]')
      if (Array.isArray(saved)) setWishlist(saved.filter((item): item is string => typeof item === 'string').slice(0, 200))
    } catch { /* تجاهل */ }
  }, [])

  function toggleWish(id: string) {
    const exists = wishlist.includes(id)
    const next = exists ? wishlist.filter((item) => item !== id) : [...wishlist, id]
    setWishlist(next)
    try { localStorage.setItem('rtx-wish', JSON.stringify(next)) } catch { /* تجاهل */ }
    notify(exists ? tr('اتشالت من المفضلة', 'Removed from wishlist') : tr('اتضافت للمفضلة', 'Added to wishlist'))
  }

  const filtersActive = minPrice !== '' || maxPrice !== ''
  const resetFilters = () => { setMinPrice(''); setMaxPrice('') }

  const sorted = useMemo(() => {
    const low = minPrice === '' ? null : Number(minPrice) * 100
    const high = maxPrice === '' ? null : Number(maxPrice) * 100
    const list = props.products.filter((product) => (low === null || Number.isNaN(low) || product.priceCents >= low) && (high === null || Number.isNaN(high) || product.priceCents <= high))
    if (sort === 'cheap') list.sort((a, b) => a.priceCents - b.priceCents)
    else if (sort === 'expensive') list.sort((a, b) => b.priceCents - a.priceCents)
    // اللي نفد مخزونه بيفضل ظاهر لكن بعد المتاح
    return list.sort((a, b) => Number(a.stock <= 0) - Number(b.stock <= 0))
  }, [props.products, sort, minPrice, maxPrice])

  const feature = useMemo(
    () => props.catalog.products.find((product) => product.imageUrl && product.stock > 0) ?? props.catalog.products.find((product) => product.imageUrl) ?? props.catalog.products[0],
    [props.catalog.products],
  )
  const selectedNode = props.catalog.categories.find((category) => category.id === props.selected)
  const topId = selectedNode?.parentId ?? selectedNode?.id ?? null
  const siblings = topId ? props.tree.find((node) => node.id === topId)?.children ?? [] : []
  const title: ReactNode = props.query
    ? <>{tr('نتايج ', 'Results for ')}<Hue c="amber">«{props.query}»</Hue></>
    : selectedNode
      ? <Hue c="teal">{selectedNode.name}</Hue>
      : <>{tr('كل ', 'All ')}<Hue c="teal">{tr('المنتجات', 'products')}</Hue></>
  const scrollToProducts = () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const showHero = !props.query && props.selected === null
  const gridKey = `${props.selected}|${props.query}|${sort}|${minPrice}|${maxPrice}`

  return (
    <>
      {showHero && <Hero onShop={scrollToProducts} feature={feature} categories={props.catalog.categories} />}
      {showHero && <StatsRibbon products={props.catalog.products.length} categories={props.tree.length} zones={props.catalog.zones.length} />}
      {showHero && <Showcase products={props.catalog.products} categories={props.catalog.categories} onOpen={setOpen} onAdd={props.onAdd} onSelect={props.onSelect} onShop={scrollToProducts} />}
      {showHero && <Steps />}
      <CategoryTiles tree={props.tree} categories={props.catalog.categories} products={props.catalog.products} counts={props.counts} selected={props.selected} total={props.catalog.products.length} onSelect={props.onSelect} />
      {siblings.length > 0 && (
        <section className="section chips-row" aria-label={tr('الأقسام الفرعية', 'Sub-categories')}>
          <div className="chips">
            <button type="button" className={`chip ${props.selected === topId ? 'on' : ''}`} aria-pressed={props.selected === topId} onClick={() => props.onSelect(topId)}>{tr('الكل', 'All')}</button>
            {siblings.map((child) => (
              <button key={child.id} type="button" className={`chip ${props.selected === child.id ? 'on' : ''}`} aria-pressed={props.selected === child.id} onClick={() => props.onSelect(child.id)}>
                {child.name}
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="section" id="products">
        <div className="section-head">
          <div>
            <h2>{title}</h2>
            <p className="muted" aria-live="polite">{sorted.length} {tr('منتج', 'items')}</p>
          </div>
        </div>
        <div className="filters" role="group" aria-label={tr('فلتر وترتيب', 'Filter and sort')}>
          <div className="filter">
            <span>{tr('السعر (ج.م)', 'Price (EGP)')}</span>
            <div className="price-range">
              <input type="number" inputMode="numeric" min={0} value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder={tr('من', 'From')} aria-label={tr('أقل سعر', 'Minimum price')} />
              <i aria-hidden="true">—</i>
              <input type="number" inputMode="numeric" min={0} value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder={tr('إلى', 'To')} aria-label={tr('أعلى سعر', 'Maximum price')} />
            </div>
          </div>
          <label className="filter">
            <span>{tr('الترتيب', 'Sort')}</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="new">{tr('الأحدث', 'Newest')}</option>
              <option value="cheap">{tr('الأقل سعراً', 'Price: low to high')}</option>
              <option value="expensive">{tr('الأعلى سعراً', 'Price: high to low')}</option>
            </select>
          </label>
          {filtersActive && (
            <div className="filter-end"><button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}><X /> {tr('مسح', 'Clear')}</button></div>
          )}
        </div>
        {sorted.length === 0 ? (
          <Empty
            icon={<PackageSearch />}
            text={filtersActive ? tr('مفيش منتجات في نطاق السعر ده.', 'Nothing in that price range.') : props.query || props.selected ? tr('مفيش منتجات مطابقة.', 'No matching products.') : tr('لسه مفيش منتجات.', 'No products yet.')}
            action={
              <>
                {filtersActive && <button type="button" className="btn btn-primary" onClick={resetFilters}>{tr('امسح فلتر السعر', 'Clear price filter')}</button>}
                {!filtersActive && (props.query || props.selected) && <button type="button" className="btn btn-primary" onClick={() => props.onSelect(null)}>{tr('اعرض كل المنتجات', 'Show all products')}</button>}
                <a className="btn btn-outline" href={whatsappLink(`أهلاً ${STORE_NAME}، بدوّر على منتج مش لاقيه`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> {tr('اسألنا', 'Ask us')}</a>
              </>
            }
          />
        ) : (
          <>
            <div className="grid" key={gridKey}>
              {sorted.slice(0, visible).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  wished={wishlist.includes(product.id)}
                  onWish={toggleWish}
                  categories={props.catalog.categories}
                  onOpen={(item) => { flyThrough('product'); setOpen(item) }}
                  onAdd={(item) => props.onAdd(item, 1)}
                />
              ))}
            </div>
            {visible < sorted.length && (
              <div className="more"><button className="btn btn-outline btn-lg" type="button" onClick={() => setVisible(visible + PAGE)}>{tr('المزيد', 'Show more')} ({sorted.length - visible})</button></div>
            )}
          </>
        )}
      </section>
      <ProductModal
        product={open}
        categories={props.catalog.categories}
        onClose={() => setOpen(null)}
        onAdd={(item, quantity) => props.onAdd(item, quantity)}
        onBuyNow={(item, quantity) => props.onBuyNow(item, quantity)}
      />
    </>
  )
}

export function Footer({ tree, onSelect }: { tree: CategoryNode[]; onSelect: (id: string | null) => void }): ReactNode {
  const { tr } = useLang()
  return (
    <footer className="footer">
      <div className="footer-in">
        <div>
          <div className="logo static"><Wordmark /></div>
          <p className="footer-promise"><Hue c="teal">{tr('كاش', 'Cash')}</Hue> {tr('عند الاستلام', 'on delivery')} · <Hue c="amber">{tr('شحن لكل مصر', 'shipping across Egypt')}</Hue></p>
        </div>
        <div>
          <h4>{tr('الأقسام', 'Categories')}</h4>
          <ul>{tree.slice(0, 6).map((node) => <li key={node.id}><button type="button" className="link" onClick={() => onSelect(node.id)}>{node.name}</button></li>)}</ul>
        </div>
        <div>
          <h4>{tr('تواصل', 'Contact')}</h4>
          <ul>
            <li><a className="link" href={whatsappLink(`أهلاً ${STORE_NAME}`)} target="_blank" rel="noopener noreferrer">{tr('واتساب', 'WhatsApp')}: <span dir="ltr">{WHATSAPP_DISPLAY}</span></a></li>
          </ul>
        </div>
      </div>
      <div className="footer-mark" aria-hidden="true">{STORE_NAME}</div>
      <div className="footer-bottom">© {new Date().getFullYear()} {STORE_NAME}</div>
    </footer>
  )
}

export function WhatsAppFab() {
  const { tr } = useLang()
  return (
    <a className="wa-fab" href={whatsappLink(`أهلاً ${STORE_NAME}، عايز أستفسر عن حاجة`)} target="_blank" rel="noopener noreferrer" aria-label={tr('كلّمنا على واتساب', 'Chat on WhatsApp')}>
      <MessageCircle />
      <span>{tr('واتساب', 'WhatsApp')}</span>
    </a>
  )
}
