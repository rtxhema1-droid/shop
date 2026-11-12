'use client'

import type { ReactNode } from 'react'
import { Banknote, ShieldCheck, Sparkles, Truck, TrendingUp, Zap } from 'lucide-react'
import { TRUST_ITEMS } from '@/lib/config'
import { Countdown } from './countdown'
import { ProductCard } from './product-card'
import { discountPercent } from './shared'
import type { Catalog, Product, PublicSettings } from './types'

const TRUST_ICONS = { shield: ShieldCheck, cash: Banknote, truck: Truck } as const

/** شريط الثقة تحت الهيرو */
export function TrustStrip() {
  return (
    <section className="trust" aria-label="مميزات المتجر">
      <ul className="trust-in">
        {TRUST_ITEMS.map((item) => {
          const Icon = TRUST_ICONS[item.icon]
          return (
            <li key={item.title} className="trust-item">
              <Icon aria-hidden="true" />
              <div><strong>{item.title}</strong><span>{item.text}</span></div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

type RailProps = {
  title: string
  icon: ReactNode
  products: Product[]
  categories: Catalog['categories']
  onAdd: (product: Product) => void
  wishlist: string[]
  onWish: (id: string) => void
  aside?: ReactNode
  className?: string
}

/** صف منتجات أفقي قابل للتمرير */
function Rail({ title, icon, products, categories, onAdd, wishlist, onWish, aside, className = '' }: RailProps) {
  if (products.length === 0) return null
  return (
    <section className={`section rail-sec ${className}`} aria-label={title}>
      <div className="section-head">
        <h2 className="head-icon">{icon}{title}</h2>
        {aside}
      </div>
      <div className="rail">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} categories={categories} onAdd={onAdd} wished={wishlist.includes(product.id)} onWish={onWish} />
        ))}
      </div>
    </section>
  )
}

type SectionsProps = {
  products: Product[]
  categories: Catalog['categories']
  settings: PublicSettings
  onAdd: (product: Product) => void
  wishlist: string[]
  onWish: (id: string) => void
  onFlashExpire: () => void
}

const LIMIT = 10

/** «عروض النهارده» + «الأكثر مبيعاً» + «وصل حديثاً» */
export function HomeRails({ products, categories, settings, onAdd, wishlist, onWish, onFlashExpire }: SectionsProps) {
  const available = products.filter((product) => product.stock > 0)
  const deals = available
    .filter((product) => discountPercent(product.priceCents, product.oldPriceCents) > 0)
    .sort((a, b) => discountPercent(b.priceCents, b.oldPriceCents) - discountPercent(a.priceCents, a.oldPriceCents))
    .slice(0, LIMIT)
  const best = available
    .filter((product) => (product.ordersCount ?? 0) > 0)
    .sort((a, b) => (b.ordersCount ?? 0) - (a.ordersCount ?? 0) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, LIMIT)
  const fresh = [...available].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, LIMIT)
  const shared = { categories, onAdd, wishlist, onWish }
  return (
    <>
      {settings.flashEndsAt && (
        <Rail
          {...shared}
          className="flash"
          title="عروض النهارده"
          icon={<Zap aria-hidden="true" />}
          products={deals}
          aside={<div className="flash-timer"><span>ينتهي بعد</span><Countdown endsAt={settings.flashEndsAt} serverNow={settings.serverNow} onExpire={onFlashExpire} /></div>}
        />
      )}
      <Rail {...shared} title="الأكثر مبيعاً" icon={<TrendingUp aria-hidden="true" />} products={best} />
      <Rail {...shared} title="وصل حديثاً" icon={<Sparkles aria-hidden="true" />} products={fresh} />
    </>
  )
}
