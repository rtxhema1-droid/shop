'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Check, Heart, MessageCircle, ShoppingCart } from 'lucide-react'
import { STORE_NAME } from '@/lib/config'
import { money, whatsappLink } from '@/lib/format'
import { categoryPath } from './category-utils'
import { ProductImage } from './product-image'
import { RatingBadge } from './rating'
import { discountPercent } from './shared'
import type { Catalog, Product } from './types'
import { useReveal } from './use-reveal'

/** كارت المنتج المشترك (الشبكة، الصفوف الجديدة، المنتجات المشابهة). الصورة والعنوان بيفتحوا صفحة المنتج. */
export function ProductCard({
  product, categories, onAdd, wished, onWish,
}: {
  product: Product
  categories: Catalog['categories']
  onAdd: (product: Product) => void
  wished?: boolean
  onWish?: (id: string) => void
}) {
  const discount = discountPercent(product.priceCents, product.oldPriceCents)
  const out = product.stock <= 0
  const href = `/product/${product.id}`
  const [added, setAdded] = useState(false)
  const ref = useReveal<HTMLElement>()
  useEffect(() => {
    if (!added) return
    const timer = window.setTimeout(() => setAdded(false), 1400)
    return () => window.clearTimeout(timer)
  }, [added])
  return (
    <article ref={ref} className={`card ${out ? 'is-out' : ''}`}>
      <div className="card-media-wrap">
        <Link className="card-media" href={href} prefetch={false} aria-label={`تفاصيل ${product.name}`}>
          <ProductImage src={product.imageUrl} alt={product.name} sizes="(max-width: 720px) 50vw, (max-width: 1280px) 25vw, 232px" />
        </Link>
        {out ? <span className="tag tag-out">نفد المخزون</span> : discount > 0 && <span className="tag">خصم {discount}%</span>}
        {!out && product.stock <= 3 && <span className="tag tag-low">باقي {product.stock} فقط</span>}
        {onWish && (
          <button type="button" className={`wish-btn ${wished ? 'on' : ''}`} onClick={() => onWish(product.id)} aria-pressed={wished} aria-label={wished ? `إزالة ${product.name} من المفضلة` : `إضافة ${product.name} للمفضلة`}>
            <Heart />
          </button>
        )}
      </div>
      <div className="card-body">
        <span className="card-cat">{categoryPath(categories, product.categoryId)}</span>
        <h3 className="card-title" title={product.name}>
          <Link href={href} prefetch={false}>{product.name}</Link>
        </h3>
        <RatingBadge avg={product.ratingAvg} count={product.ratingCount} />
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
