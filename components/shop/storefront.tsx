'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Check, ChevronDown, Heart, LayoutDashboard, LayoutGrid, LogIn, LogOut, Menu, MessageCircle, Minus, Moon,
  PackageSearch, Plus, Search, ShoppingBag, ShoppingCart, Store, Sun, UserRound, X,
} from 'lucide-react'
import { MAX_QTY_PER_PRODUCT, PLACEHOLDERS, PROMISE, PROMISE_SUB, STORE_NAME, WHATSAPP_DISPLAY } from '@/lib/config'
import { money, whatsappLink } from '@/lib/format'
import { categoryCover, categoryPath, type CategoryNode } from './category-utils'
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
        <Menu /> <span>الأقسام</span> <ChevronDown className="chev" />
      </button>
      <div className={`mega-panel ${open ? 'open' : ''}`}>
        <div className="mega-tops">
          <button type="button" className={`mega-top ${selected === null ? 'on' : ''}`} onClick={() => pick(null)}>كل المنتجات</button>
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
              <button type="button" className="link" onClick={() => pick(active.id)}>عرض كل {active.name} ←</button>
            </div>
            <div className="mega-grid">
              {active.children.length === 0 && <p className="muted">مفيش أقسام فرعية هنا لسه — اختار «عرض كل {active.name}».</p>}
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
        <button className="btn btn-ghost hide-sm" type="button" onClick={() => openAuth('in')}><LogIn /> دخول</button>
        <button className="btn btn-primary hide-sm" type="button" onClick={() => openAuth('up')}>حساب جديد</button>
        <button className="icon-btn show-sm" type="button" onClick={() => openAuth('in')} aria-label="دخول"><UserRound /></button>
      </>
    )
  }
  const staff = user.role !== 'user'
  return (
    <div className="umenu" ref={ref}>
      <button className="avatar-btn" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="حسابي">
        <span>{user.name.slice(0, 1)}</span>
      </button>
      <div className={`dropdown ${open ? 'open' : ''}`}>
        <div className="dropdown-head">
          <strong>{user.name}</strong>
          <small>{user.role === 'owner' ? 'صاحب المتجر' : user.role === 'vendor' ? 'تاجر' : user.phone ?? 'عميل'}</small>
        </div>
        {staff ? (
          <button type="button" onClick={() => { setOpen(false); onDash() }}><LayoutDashboard /> لوحة التحكم</button>
        ) : (
          <button type="button" onClick={() => { setOpen(false); onOrders() }}><ShoppingBag /> طلباتي</button>
        )}
        <button type="button" className="danger" onClick={() => void signOut()}><LogOut /> تسجيل خروج</button>
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
  const { user, openAuth, theme, toggleTheme } = useShop()
  const [dockTab, setDockTab] = useState<'home' | 'cats' | 'cart' | 'profile'>('home')

  return (
    <>
      <div className="topbar">
        <strong>{PROMISE}</strong>
        <i aria-hidden="true" />
        <span>{PROMISE_SUB}</span>
        <i aria-hidden="true" className="hide-sm" />
        <span className="hide-sm">واتساب {WHATSAPP_DISPLAY}</span>
      </div>
      <header className="header">
        <div className="header-in">
          <button className="logo" type="button" onClick={() => { setDockTab('home'); props.onHome() }} aria-label={`${STORE_NAME} - الرئيسية`}>
            <Wordmark />
          </button>
          <MegaMenu tree={props.tree} counts={props.counts} selected={props.selected} onSelect={props.onSelect} />
          <label className="search">
            <Search />
            <input value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="ابحث عن منتج…" aria-label="بحث" maxLength={80} />
            {props.query && <button type="button" className="icon-btn" onClick={() => props.onQuery('')} aria-label="مسح البحث"><X /></button>}
          </label>
          <div className="header-actions">
            <button className="icon-btn" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}>{theme === 'dark' ? <Sun /> : <Moon />}</button>
            <UserMenu onOrders={props.onOrders} onDash={props.onDash} />
            <button className="cart-btn" type="button" onClick={props.onCart} aria-label={`السلة (${props.cartCount})`}>
              <ShoppingCart />
              {props.cartCount > 0 && <b key={props.bump} className="cart-count">{props.cartCount}</b>}
            </button>
          </div>
        </div>
        <nav className="subnav" aria-label="أقسام سريعة">
          <div className="subnav-in">
            <button type="button" className={props.selected === null ? 'on' : ''} onClick={() => props.onSelect(null)}>الكل</button>
            {props.tree.slice(0, 7).map((node) => (
              <button key={node.id} type="button" className={props.selected === node.id ? 'on' : ''} onClick={() => props.onSelect(node.id)}>
                {node.name}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <nav className="dock" aria-label="التنقل السريع">
        <button type="button" className={`dock-item ${dockTab === 'home' && props.selected === null ? 'on' : ''}`} aria-current={dockTab === 'home' && props.selected === null ? 'page' : undefined} onClick={() => { setDockTab('home'); props.onHome() }}>
          <Store />
          <span>الرئيسية</span>
        </button>
        <button
          type="button"
          className={`dock-item ${dockTab === 'cats' || props.selected !== null ? 'on' : ''}`}
          onClick={() => { setDockTab('cats'); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) }}
        >
          <LayoutGrid />
          <span>الأقسام</span>
        </button>
        <button type="button" className={`dock-item ${dockTab === 'cart' ? 'on' : ''}`} aria-label={`السلة (${props.cartCount})`} onClick={() => { setDockTab('cart'); props.onCart() }}>
          <span className="dock-icon">
            <ShoppingBag />
            {props.cartCount > 0 && <em className="dock-badge">{props.cartCount}</em>}
          </span>
          <span>السلة</span>
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
          <span>{user ? (user.role === 'user' ? 'طلباتي' : 'اللوحة') : 'حسابي'}</span>
        </button>
      </nav>
    </>
  )
}

// ───────────────────────── الواجهة الرئيسية ─────────────────────────

function Hero({ onShop, feature, productCount, categoryCount, categories }: { onShop: () => void; feature: Product | undefined; productCount: number; categoryCount: number; categories: Catalog['categories'] }) {
  return (
    <section className="hero">
      <div className="hero-in">
        <div className="hero-copy">
          <h1>{PROMISE}<br />{PROMISE_SUB}</h1>
          <p>{productCount > 0 ? `${productCount} منتج في ${categoryCount} قسم — اختار منتجك واكتب عنوانك واحنا نوصّله.` : 'اختار منتجك واكتب عنوانك واحنا نوصّله.'}</p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" type="button" onClick={onShop}>تصفّح المنتجات</button>
            <a className="btn btn-outline btn-lg" href={whatsappLink(`أهلاً ${STORE_NAME}، عايز أسأل عن منتج`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> اسأل على واتساب</a>
          </div>
          <ol className="hero-steps" aria-label="خطوات الطلب">
            <li>اختار منتجك</li>
            <li>اكتب عنوانك والمحافظة</li>
            <li>ادفع كاش للمندوب</li>
          </ol>
        </div>
        {feature ? (
          <div className="hero-art">
            <ProductImage src={feature.imageUrl} alt={feature.name} sizes="(max-width: 1000px) 100vw, 56vw" priority />
            <div className="hero-caption">
              <small>{categoryPath(categories, feature.categoryId)}</small>
              <strong>{feature.name}</strong>
              <span>{money(feature.priceCents)}</span>
            </div>
          </div>
        ) : (
          <div className="hero-mono" aria-hidden="true"><Wordmark /></div>
        )}
      </div>
    </section>
  )
}

function CategoryTiles({ tree, categories, products, counts, selected, total, onSelect }: { tree: CategoryNode[]; categories: Catalog['categories']; products: Product[]; counts: Record<string, number>; selected: string | null; total: number; onSelect: (id: string | null) => void }) {
  if (tree.length === 0) return null
  const topOfSelected = categories.find((category) => category.id === selected)
  const activeTop = topOfSelected?.parentId ?? selected
  return (
    <section className="section cats-row" aria-label="الأقسام">
      <div className="cat-strip">
        <button type="button" className={`cat-tile ${selected === null ? 'on' : ''}`} aria-pressed={selected === null} onClick={() => onSelect(null)}>
          <span className="cat-thumb"><span className="cat-mono" aria-hidden="true">الكل</span></span>
          <strong>كل المنتجات</strong>
          <small>{total} منتج</small>
        </button>
        {tree.map((node) => {
          const cover = categoryCover(categories, products, node.id)
          return (
            <button key={node.id} type="button" className={`cat-tile ${activeTop === node.id ? 'on' : ''}`} aria-pressed={activeTop === node.id} onClick={() => onSelect(node.id)}>
              <span className="cat-thumb">
                {cover ? <ProductImage src={cover} alt="" sizes="160px" /> : <span className="cat-mono" aria-hidden="true">{node.name.slice(0, 1)}</span>}
              </span>
              <strong>{node.name}</strong>
              <small>{counts[node.id] ?? 0} منتج</small>
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
  const discount = discountPercent(product.priceCents, product.oldPriceCents)
  const out = product.stock <= 0
  const [added, setAdded] = useState(false)
  useEffect(() => {
    if (!added) return
    const timer = window.setTimeout(() => setAdded(false), 1400)
    return () => window.clearTimeout(timer)
  }, [added])
  return (
    <article className={`card ${out ? 'is-out' : ''}`}>
      <div className="card-media-wrap">
        <button className="card-media" type="button" onClick={() => onOpen(product)} aria-label={`تفاصيل ${product.name}`}>
          <ProductImage src={product.imageUrl} alt={product.name} sizes="(max-width: 720px) 50vw, (max-width: 1280px) 25vw, 232px" />
        </button>
        {out ? <span className="tag tag-out">نفد المخزون</span> : discount > 0 && <span className="tag">خصم {discount}%</span>}
        {!out && product.stock <= 3 && <span className="tag tag-low">باقي {product.stock} فقط</span>}
        <button type="button" className={`wish-btn ${wished ? 'on' : ''}`} onClick={() => onWish(product.id)} aria-pressed={wished} aria-label={wished ? `إزالة ${product.name} من المفضلة` : `إضافة ${product.name} للمفضلة`}>
          <Heart />
        </button>
      </div>
      <div className="card-body">
        <span className="card-cat">{categoryPath(categories, product.categoryId)}</span>
        <h3 className="card-title" title={product.name}>
          <button type="button" onClick={() => onOpen(product)}>{product.name}</button>
        </h3>
        <div className="price">
          <strong>{money(product.priceCents)}</strong>
          {product.oldPriceCents ? <s>{money(product.oldPriceCents)}</s> : null}
        </div>
        <div className="card-actions">
          {out ? (
            <a className="btn btn-outline" href={whatsappLink(`أهلاً ${STORE_NAME}، المنتج ده نفد: ${product.name} — ممكن أعرف هيتوفر إمتى؟`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> اسأل عن توفره</a>
          ) : (
            <button className={`btn btn-primary ${added ? 'is-done' : ''}`} type="button" onClick={() => { onAdd(product); setAdded(true) }}>
              {added ? <><Check /> اتضافت للسلة</> : <><ShoppingCart /> أضف للسلة</>}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function Specs({ product }: { product: Product }) {
  const rows: Array<[string, string | null | undefined, string]> = [
    ['البطارية', product.battery, PLACEHOLDERS.battery],
    ['الضمان', product.warranty, PLACEHOLDERS.warranty],
    ['محتويات العلبة', product.boxContents, PLACEHOLDERS.box],
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
          <ProductImage src={product.imageUrl} alt={product.name} sizes="(max-width: 720px) 90vw, 420px" priority />
          {out ? <span className="tag tag-out">نفد المخزون</span> : discount > 0 && <span className="tag">خصم {discount}%</span>}
        </div>
        <div className="pview-info">
          <span className="crumb">{categoryPath(categories, product.categoryId)}</span>
          <div className="price big">
            <strong>{money(product.priceCents)}</strong>
            {product.oldPriceCents ? <s>{money(product.oldPriceCents)}</s> : null}
          </div>
          <p className={`stock-note ${out ? 'out' : ''}`}>
            {out ? 'نفد المخزون حالياً — كلّمنا على واتساب نعرّفك هيتوفر إمتى' : product.stock <= 3 ? `باقي ${product.stock} قطع فقط` : 'متوفر'} · البائع: {product.storeName}
          </p>
          <Specs product={product} />
          {product.description && <p className="pdesc">{product.description}</p>}
          <p className="stock-note">{PROMISE} · مدة التوصيل حسب المحافظة وبتظهر في السلة قبل تأكيد الطلب.</p>
          {out ? (
            <a className="btn btn-wa btn-lg" href={whatsappLink(`أهلاً ${STORE_NAME}، المنتج ده نفد: ${product.name} — ممكن أعرف هيتوفر إمتى؟\n${link}`)} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> اسأل عن توفره على واتساب
            </a>
          ) : (
            <>
              <div className="pview-buy">
                <div className="qty">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="قلل الكمية"><Minus /></button>
                  <span aria-live="polite">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(Math.min(max, quantity + 1))} aria-label="زوّد الكمية"><Plus /></button>
                </div>
                <button className="btn btn-primary btn-lg grow" type="button" onClick={() => { onAdd(product, quantity); onClose() }}>
                  <ShoppingCart /> أضف للسلة
                </button>
              </div>
              <button className="btn btn-outline btn-lg full-w" type="button" onClick={() => { onClose(); onBuyNow(product, quantity) }}>
                اشترِ الآن
              </button>
              <a className="btn btn-wa btn-lg" href={whatsappLink(`أهلاً ${STORE_NAME}، عايز أسأل عن: ${product.name} (${money(product.priceCents)})\n${link}`)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> اسأل عن المنتج على واتساب
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
    notify(exists ? 'اتشالت من المفضلة' : 'اتضافت للمفضلة')
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
  const title = props.query ? `نتايج البحث عن «${props.query}»` : selectedNode ? selectedNode.name : 'كل المنتجات'
  const scrollToProducts = () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const showHero = !props.query && props.selected === null
  const gridKey = `${props.selected}|${props.query}|${sort}|${minPrice}|${maxPrice}`

  return (
    <>
      {showHero && <Hero onShop={scrollToProducts} feature={feature} productCount={props.catalog.products.length} categoryCount={props.tree.length} categories={props.catalog.categories} />}
      <CategoryTiles tree={props.tree} categories={props.catalog.categories} products={props.catalog.products} counts={props.counts} selected={props.selected} total={props.catalog.products.length} onSelect={props.onSelect} />
      {siblings.length > 0 && (
        <section className="section chips-row" aria-label="الأقسام الفرعية">
          <div className="chips">
            <button type="button" className={`chip ${props.selected === topId ? 'on' : ''}`} aria-pressed={props.selected === topId} onClick={() => props.onSelect(topId)}>الكل</button>
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
            <p className="muted" aria-live="polite">{sorted.length} منتج</p>
          </div>
        </div>
        <div className="filters" role="group" aria-label="فلتر وترتيب">
          <div className="filter">
            <span>السعر (ج.م)</span>
            <div className="price-range">
              <input type="number" inputMode="numeric" min={0} value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="من" aria-label="أقل سعر" />
              <i aria-hidden="true">—</i>
              <input type="number" inputMode="numeric" min={0} value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="إلى" aria-label="أعلى سعر" />
            </div>
          </div>
          <label className="filter">
            <span>الترتيب</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="new">الأحدث</option>
              <option value="cheap">الأقل سعراً</option>
              <option value="expensive">الأعلى سعراً</option>
            </select>
          </label>
          {filtersActive && (
            <div className="filter-end"><button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}><X /> مسح الفلتر</button></div>
          )}
        </div>
        {sorted.length === 0 ? (
          <Empty
            icon={<PackageSearch />}
            text={filtersActive ? 'مفيش منتجات في نطاق السعر ده.' : props.query || props.selected ? 'مفيش منتجات مطابقة دلوقتي.' : 'لسه مفيش منتجات في المتجر.'}
            action={
              <>
                {filtersActive && <button type="button" className="btn btn-primary" onClick={resetFilters}>امسح فلتر السعر</button>}
                {!filtersActive && (props.query || props.selected) && <button type="button" className="btn btn-primary" onClick={() => props.onSelect(null)}>اعرض كل المنتجات</button>}
                <a className="btn btn-outline" href={whatsappLink(`أهلاً ${STORE_NAME}، بدوّر على منتج مش لاقيه`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> اسألنا على واتساب</a>
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
                  onOpen={setOpen}
                  onAdd={(item) => props.onAdd(item, 1)}
                />
              ))}
            </div>
            {visible < sorted.length && (
              <div className="more"><button className="btn btn-outline btn-lg" type="button" onClick={() => setVisible(visible + PAGE)}>عرض المزيد ({sorted.length - visible})</button></div>
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
  return (
    <footer className="footer">
      <div className="footer-in">
        <div>
          <div className="logo static"><Wordmark /></div>
          <p className="footer-promise">{PROMISE}</p>
          <p className="muted">{PROMISE_SUB}</p>
        </div>
        <div>
          <h4>الأقسام</h4>
          <ul>{tree.slice(0, 6).map((node) => <li key={node.id}><button type="button" className="link" onClick={() => onSelect(node.id)}>{node.name}</button></li>)}</ul>
        </div>
        <div>
          <h4>تواصل معانا</h4>
          <ul>
            <li><a className="link" href={whatsappLink(`أهلاً ${STORE_NAME}`)} target="_blank" rel="noopener noreferrer">واتساب: <span dir="ltr">{WHATSAPP_DISPLAY}</span></a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} {STORE_NAME}</div>
    </footer>
  )
}

export function WhatsAppFab() {
  return (
    <a className="wa-fab" href={whatsappLink(`أهلاً ${STORE_NAME}، عايز أستفسر عن حاجة`)} target="_blank" rel="noopener noreferrer" aria-label="كلّمنا على واتساب">
      <MessageCircle />
      <span>واتساب</span>
    </a>
  )
}
