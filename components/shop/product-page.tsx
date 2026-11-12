'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link2, MessageCircle, Minus, Plus, Share2, ShoppingCart, Trash2, Truck } from 'lucide-react'
import { MAX_QTY_PER_PRODUCT, PROMISE, STORE_NAME, WHATSAPP_DISPLAY } from '@/lib/config'
import { addToStoredCart, storedCartCount } from '@/lib/cart-storage'
import { dateLabel, money, whatsappLink } from '@/lib/format'
import { categoryPath } from './category-utils'
import { ProductCard } from './product-card'
import { ProductImage } from './product-image'
import { RatingBadge, StarsInput, StarsRow } from './rating'
import { Field, api, discountPercent, errorText } from './shared'
import { Specs } from './specs'
import { Wordmark } from './storefront'
import type { Category, Product, RatingSummary, Review, SessionUser } from './types'

type Props = {
  product: Product
  categories: Category[]
  similar: Product[]
  reviews: Review[]
  summary: RatingSummary
  user: SessionUser | null
  /** رابط الصفحة الكامل (مطلق) للمشاركة */
  shareUrl: string
  freeShippingThresholdCents: number | null
}

function ShareButtons({ product, url, onCopied }: { product: Product; url: string; onCopied: (message: string) => void }) {
  const text = `${product.name} — ${money(product.priceCents)}`
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      onCopied('اتنسخ رابط المنتج')
    } catch {
      onCopied('مقدرتش أنسخ الرابط — انسخه من شريط العنوان')
    }
  }
  return (
    <div className="share" role="group" aria-label="مشاركة المنتج">
      <span className="share-label"><Share2 aria-hidden="true" /> شارك المنتج</span>
      <a className="btn btn-outline btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle /> واتساب</a>
      <a className="btn btn-outline btn-sm" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer"><Share2 /> فيسبوك</a>
      <button className="btn btn-outline btn-sm" type="button" onClick={() => void copy()}><Link2 /> نسخ الرابط</button>
    </div>
  )
}

function Reviews({ product, reviews, summary, user, onMessage }: { product: Product; reviews: Review[]; summary: RatingSummary; user: SessionUser | null; onMessage: (message: string) => void }) {
  const router = useRouter()
  const mine = reviews.find((review) => review.mine)
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isCustomer = user?.role === 'user'

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (rating < 1) {
      setError('اختار عدد النجوم الأول')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api(`products/${product.id}/reviews`, 'POST', { rating, comment })
      onMessage(mine ? 'اتحدّث تقييمك، شكراً ليك' : 'شكراً على تقييمك')
      router.refresh()
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    try {
      await api(`reviews/${id}`, 'DELETE')
      if (id === mine?.id) {
        setRating(0)
        setComment('')
      }
      onMessage('اتمسح التقييم')
      router.refresh()
    } catch (reason) {
      onMessage(errorText(reason))
    }
  }

  const max = Math.max(1, ...summary.distribution)
  return (
    <section className="pp-section reviews" id="reviews" aria-labelledby="reviews-title">
      <h2 id="reviews-title">تقييمات العملاء</h2>
      <div className="reviews-grid">
        <div className="reviews-summary">
          {summary.count > 0 && summary.avg !== null ? (
            <>
              <div className="reviews-avg"><strong>{summary.avg}</strong><span>من 5</span></div>
              <StarsRow value={summary.avg} size="lg" />
              <p className="muted">{summary.count} تقييم</p>
              <ul className="dist">
                {[5, 4, 3, 2, 1].map((stars) => (
                  <li key={stars}>
                    <span>{stars} ★</span>
                    <div className="dist-track"><i style={{ width: `${(summary.distribution[stars - 1] / max) * 100}%` }} /></div>
                    <span className="muted">{summary.distribution[stars - 1]}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">مفيش تقييمات لسه. كن أول واحد يقيّم المنتج ده.</p>
          )}
        </div>
        <div className="stack">
          {isCustomer ? (
            <form className="review-form stack-sm" onSubmit={submit}>
              <strong>{mine ? 'عدّل تقييمك' : 'قيّم المنتج'}</strong>
              <StarsInput value={rating} onChange={(value) => { setRating(value); setError('') }} />
              <Field label="تعليقك (اختياري)">
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={500} placeholder="حكايتك مع المنتج: الجودة، التوصيل، أي ملاحظة…" />
              </Field>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'ثانية…' : mine ? 'حدّث التقييم' : 'ابعت التقييم'}</button></div>
            </form>
          ) : user ? (
            <p className="notice">التقييم متاح لحسابات العملاء بس.</p>
          ) : (
            <p className="notice">سجّل دخولك بحساب عميل عشان تقدر تقيّم المنتج. <Link className="link" href="/">تسجيل الدخول</Link></p>
          )}
          {reviews.length > 0 && (
            <ul className="review-list">
              {reviews.map((review) => (
                <li key={review.id} className="review">
                  <header>
                    <strong>{review.userName}</strong>
                    <StarsRow value={review.rating} />
                    <small className="muted">{dateLabel(review.createdAt)}</small>
                    {(review.mine || user?.role === 'owner') && (
                      <button type="button" className="icon-btn danger" onClick={() => void remove(review.id)} aria-label="امسح التقييم"><Trash2 /></button>
                    )}
                  </header>
                  {review.comment && <p>{review.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

export function ProductPage({ product, categories, similar, reviews, summary, user, shareUrl, freeShippingThresholdCents }: Props) {
  const router = useRouter()
  const [quantity, setQuantity] = useState(1)
  const [cartCount, setCartCount] = useState(0)
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const out = product.stock <= 0
  const max = Math.max(1, Math.min(product.stock, MAX_QTY_PER_PRODUCT))
  const discount = discountPercent(product.priceCents, product.oldPriceCents)

  useEffect(() => setCartCount(storedCartCount()), [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function notify(message: string) {
    setToast(message)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(''), 3200)
  }
  function add(item: Product, qty: number) {
    if (item.stock <= 0) return false
    setCartCount(addToStoredCart(item, qty))
    notify(`«${item.name}» اتضاف للسلة`)
    return true
  }

  return (
    <>
      <header className="header">
        <div className="header-in">
          <Link className="logo" href="/" aria-label={`${STORE_NAME} - الرئيسية`}><Wordmark /></Link>
          <div className="header-actions">
            <Link className="btn btn-ghost hide-sm" href="/">كل المنتجات</Link>
            <Link className="cart-btn" href="/#cart" aria-label={`السلة (${cartCount})`}>
              <ShoppingCart />
              {cartCount > 0 && <b className="cart-count">{cartCount}</b>}
            </Link>
          </div>
        </div>
      </header>

      <main className="pp">
        <nav className="pp-crumbs" aria-label="مسار الصفحة">
          <Link href="/">الرئيسية</Link><span aria-hidden="true">›</span><span>{categoryPath(categories, product.categoryId)}</span>
        </nav>

        <div className="pview">
          <div className="pview-media">
            <ProductImage src={product.imageUrl} alt={product.name} sizes="(max-width: 720px) 100vw, 560px" priority />
            {out ? <span className="tag tag-out">نفد المخزون</span> : discount > 0 && <span className="tag">خصم {discount}%</span>}
          </div>
          <div className="pview-info">
            <h1 className="pp-title">{product.name}</h1>
            {summary.count > 0 && <a className="pp-rating" href="#reviews"><RatingBadge avg={summary.avg} count={summary.count} /></a>}
            <div className="price big">
              <strong>{money(product.priceCents)}</strong>
              {product.oldPriceCents ? <s>{money(product.oldPriceCents)}</s> : null}
            </div>
            <p className={`stock-note ${out ? 'out' : ''}`}>
              {out ? 'نفد المخزون حالياً — كلّمنا على واتساب نعرّفك هيتوفر إمتى' : product.stock <= 3 ? `باقي ${product.stock} قطع فقط` : 'متوفر'} · البائع: {product.storeName}
            </p>
            <Specs product={product} />
            {product.description && <p className="pdesc">{product.description}</p>}
            <p className="stock-note"><Truck aria-hidden="true" /> {PROMISE}{freeShippingThresholdCents !== null ? ` · شحن مجاني على الطلبات فوق ${money(freeShippingThresholdCents)}` : ''} · مدة التوصيل حسب المحافظة وبتظهر في السلة قبل تأكيد الطلب.</p>
            {out ? (
              <a className="btn btn-wa btn-lg" href={whatsappLink(`أهلاً ${STORE_NAME}، المنتج ده نفد: ${product.name} — ممكن أعرف هيتوفر إمتى؟\n${shareUrl}`)} target="_blank" rel="noopener noreferrer">
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
                  <button className="btn btn-primary btn-lg grow" type="button" onClick={() => add(product, quantity)}><ShoppingCart /> أضف للسلة</button>
                </div>
                <button className="btn btn-outline btn-lg full-w" type="button" onClick={() => { if (add(product, quantity)) router.push('/#cart') }}>اشترِ الآن</button>
                <a className="btn btn-wa btn-lg" href={whatsappLink(`أهلاً ${STORE_NAME}، عايز أسأل عن: ${product.name} (${money(product.priceCents)})\n${shareUrl}`)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> اسأل عن المنتج على واتساب
                </a>
              </>
            )}
            <ShareButtons product={product} url={shareUrl} onCopied={notify} />
          </div>
        </div>

        <Reviews product={product} reviews={reviews} summary={summary} user={user} onMessage={notify} />

        {similar.length > 0 && (
          <section className="pp-section similar" aria-labelledby="similar-title">
            <div className="section-head"><h2 id="similar-title">منتجات مشابهة</h2></div>
            <div className="grid">
              {similar.map((item) => (
                <ProductCard key={item.id} product={item} categories={categories} onAdd={(chosen) => add(chosen, 1)} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="footer-in pp-footer">
          <div>
            <div className="logo static"><Wordmark /></div>
            <p className="footer-promise">{PROMISE}</p>
          </div>
          <div>
            <h4>تواصل معانا</h4>
            <a className="link" href={whatsappLink(`أهلاً ${STORE_NAME}`)} target="_blank" rel="noopener noreferrer">واتساب: <span dir="ltr">{WHATSAPP_DISPLAY}</span></a>
          </div>
        </div>
        <div className="footer-bottom">© {new Date().getFullYear()} {STORE_NAME}</div>
      </footer>
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </>
  )
}
