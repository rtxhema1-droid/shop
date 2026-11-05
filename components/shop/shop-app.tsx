'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MAX_QTY_PER_PRODUCT } from '@/lib/config'
import { AuthModal, WelcomeAuthScreen } from './auth'
import { WelcomeToast } from './welcome-toast'
import { CartDrawer, OrderSuccess, type CartLine, type PlacedOrder } from './cart'
import { buildTree, categoryMatcher, countByCategory } from './category-utils'
import { DashboardApp } from './dashboard'
import { CustomerOrders } from './orders'
import { ShopCtx, api, type ShopCtxValue } from './shared'
import { Footer, Header, Home, WhatsAppFab } from './storefront'
import type { CartMap, Catalog, Dashboard, Product, SessionUser } from './types'

type View = 'store' | 'orders' | 'dash'
type Props = { user: SessionUser | null; catalog: Catalog; initialDashboard: Dashboard | null }

const CART_KEY = 'rtx-cart'

export function ShopApp({ user, catalog: initialCatalog, initialDashboard }: Props) {
  const [catalog, setCatalog] = useState(initialCatalog)
  const [dashboard, setDashboard] = useState(initialDashboard)
  const [view, setView] = useState<View>('store')
  const [cart, setCart] = useState<CartMap>({})
  const [cartReady, setCartReady] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [bump, setBump] = useState(0)
  const [auth, setAuth] = useState<'in' | 'up' | null>(null)
  const [placed, setPlaced] = useState<PlacedOrder | null>(null)
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [welcome, setWelcome] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const staff = user?.role === 'owner' || user?.role === 'vendor'

  // أول تحميل: الوضع + السلة + الصفحة من الـ hash
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) || '{}')
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const clean: CartMap = {}
        for (const [id, qty] of Object.entries(saved as Record<string, unknown>)) {
          if (typeof qty === 'number' && Number.isInteger(qty) && qty > 0) clean[id] = Math.min(qty, MAX_QTY_PER_PRODUCT)
        }
        setCart(clean)
      }
    } catch {
      /* تجاهل */
    }
    setCartReady(true)
    const hash = window.location.hash.replace('#', '')
    if (hash === 'orders' && user?.role === 'user') setView('orders')
    if (hash === 'dashboard' && staff) setView('dash')
  }, [user?.role, staff])

  useEffect(() => {
    if (!cartReady) return
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch {
      /* تجاهل */
    }
  }, [cart, cartReady])

  const notify = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3200)
  }, [])

  const reloadCatalog = useCallback(async () => {
    try {
      setCatalog(await api<Catalog>('catalog'))
    } catch {
      /* تجاهل */
    }
  }, [])
  const reloadDashboard = useCallback(async () => {
    if (!user) return
    try {
      const result = await api<{ dashboard: Dashboard }>('dashboard')
      setDashboard(result.dashboard)
    } catch {
      /* تجاهل */
    }
  }, [user])

  const go = useCallback((next: View) => {
    setView(next)
    window.history.replaceState(null, '', next === 'store' ? window.location.pathname : `#${next === 'dash' ? 'dashboard' : 'orders'}`)
    window.scrollTo({ top: 0 })
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api('sign-out', 'POST', {})
    } finally {
      try { localStorage.removeItem(CART_KEY) } catch { /* تجاهل */ }
      window.location.href = window.location.pathname
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem('rtx-theme', next)
      } catch {
        /* تجاهل */
      }
      return next
    })
  }, [])

  const ctx: ShopCtxValue = useMemo(
    () => ({ user, notify, openAuth: setAuth, go, reloadCatalog, reloadDashboard, signOut, theme, toggleTheme }),
    [user, notify, go, reloadCatalog, reloadDashboard, signOut, theme, toggleTheme],
  )

  const tree = useMemo(() => buildTree(catalog.categories), [catalog.categories])
  const counts = useMemo(() => countByCategory(catalog.categories, catalog.products), [catalog.categories, catalog.products])
  const products = useMemo(() => {
    const match = categoryMatcher(catalog.categories, selected)
    const needle = query.trim().toLowerCase()
    return catalog.products.filter((product) => match(product) && (!needle || `${product.name} ${product.description} ${product.storeName}`.toLowerCase().includes(needle)))
  }, [catalog, selected, query])

  const lines: CartLine[] = useMemo(
    () =>
      catalog.products
        .filter((product) => cart[product.id] && product.stock > 0)
        .map((product) => ({ product, quantity: Math.min(cart[product.id], product.stock, MAX_QTY_PER_PRODUCT) })),
    [catalog.products, cart],
  )
  const cartCount = lines.reduce((sum, line) => sum + line.quantity, 0)

  function addToCart(product: Product, quantity = 1) {
    if (product.stock <= 0) {
      notify('المنتج ده نفد المخزون — كلّمنا على واتساب')
      return
    }
    setCart((current) => ({ ...current, [product.id]: Math.min((current[product.id] ?? 0) + quantity, product.stock, MAX_QTY_PER_PRODUCT) }))
    setBump((value) => value + 1)
    notify(`«${product.name}» اتضاف للسلة`)
  }
  function setQty(id: string, quantity: number) {
    setCart((current) => {
      const next = { ...current }
      if (quantity <= 0) delete next[id]
      else next[id] = quantity
      return next
    })
  }
  function selectCategory(id: string | null) {
    setSelected(id)
    setQuery('')
    if (view !== 'store') go('store')
    setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  async function ordered(result: PlacedOrder) {
    setCart({})
    setCartOpen(false)
    setPlaced(result)
    await Promise.all([reloadDashboard(), reloadCatalog()])
  }

  // بعد الدخول الصفحة بتتحمّل تاني، فالعلامة دي بتقول إن الترحيب يظهر مرة واحدة
  useEffect(() => {
    try {
      if (user && window.sessionStorage.getItem('rtx-welcome')) {
        window.sessionStorage.removeItem('rtx-welcome')
        setWelcome(true)
      }
    } catch {}
  }, [user])

  // الزائر بيشوف بوابة الدخول الأول، والمتجر بيتفتح بعد تسجيل الدخول
  if (!user) {
    return (
      <ShopCtx.Provider value={ctx}>
        <WelcomeAuthScreen />
        <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
      </ShopCtx.Provider>
    )
  }

  const body =
    view === 'dash' && user && staff && dashboard ? (
      <DashboardApp user={user} dashboard={dashboard} categories={catalog.categories} zones={catalog.zones} reload={reloadDashboard} reloadCatalog={reloadCatalog} onStore={() => go('store')} />
    ) : (
      <>
        <Header
          tree={tree}
          counts={counts}
          selected={selected}
          onSelect={selectCategory}
          query={query}
          onQuery={(value) => {
            setQuery(value)
            if (view !== 'store') go('store')
          }}
          cartCount={cartCount}
          bump={bump}
          onCart={() => setCartOpen(true)}
          onHome={() => {
            setSelected(null)
            setQuery('')
            go('store')
          }}
          onOrders={() => go('orders')}
          onDash={() => go('dash')}
        />
        <main>
          {view === 'orders' && user?.role === 'user' ? (
            <CustomerOrders orders={dashboard?.orders ?? []} onChanged={reloadDashboard} onShop={() => go('store')} />
          ) : (
            <Home catalog={catalog} tree={tree} counts={counts} selected={selected} onSelect={selectCategory} products={products} query={query} onAdd={addToCart} onBuyNow={(product, quantity = 1) => { if (product.stock <= 0) return; addToCart(product, quantity); setCartOpen(true) }} />
          )}
        </main>
        <Footer tree={tree} onSelect={selectCategory} />
        <WhatsAppFab />
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} lines={lines} zones={catalog.zones} onQty={setQty} onRemove={(id) => setQty(id, 0)} onOrdered={(result) => void ordered(result)} />
        <OrderSuccess placed={placed} onClose={() => setPlaced(null)} onOrders={() => { setPlaced(null); go('orders') }} />
      </>
    )

  return (
    <ShopCtx.Provider value={ctx}>
      {body}
      {welcome && <WelcomeToast onDone={() => setWelcome(false)} />}
      <AuthModal mode={auth} onMode={setAuth} onClose={() => setAuth(null)} />
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </ShopCtx.Provider>
  )
}
