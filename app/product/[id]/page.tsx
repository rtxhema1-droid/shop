import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ProductPage } from '@/components/shop/product-page'
import { CURRENCY, PROMISE, PROMISE_SUB, STORE_NAME } from '@/lib/config'
import { DbNotConfiguredError } from '@/lib/db'
import { money } from '@/lib/format'
import { getCategories, getProductById, getSimilarProducts } from '@/lib/marketplace'
import { getRatingSummary, getReviews } from '@/lib/reviews'
import { getPublicSettings } from '@/lib/settings'
import { absoluteUrl, getSiteUrl } from '@/lib/site'
import { getCurrentUser } from '@/lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// generateMetadata والصفحة بيطلبوا نفس المنتج، فبنخزّنه لنفس الطلب
const loadProduct = cache((id: string) => getProductById(id))

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

/** صورة المنتج بحجم مناسب للمشاركة (800) كرابط مطلق */
function shareImage(site: string, imageUrl: string | null) {
  if (!imageUrl) return null
  if (imageUrl.startsWith('/api/products/')) return absoluteUrl(site, `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}w=800`)
  return absoluteUrl(site, imageUrl.replace(/-(480|800|1200)\.webp$/, '-800.webp'))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  let product
  try {
    product = await loadProduct(id)
  } catch (error) {
    if (error instanceof DbNotConfiguredError) return { title: STORE_NAME }
    throw error
  }
  if (!product) return { title: `المنتج مش موجود | ${STORE_NAME}`, robots: { index: false, follow: false } }
  const site = await getSiteUrl()
  const url = `${site}/product/${product.id}`
  const title = `${product.name} | ${STORE_NAME}`
  const description = clip((product.description || '').replace(/\s+/g, ' ').trim() || `${product.name} بسعر ${money(product.priceCents)} — ${PROMISE}، ${PROMISE_SUB}.`, 160)
  const image = shareImage(site, product.imageUrl)
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: STORE_NAME, locale: 'ar_EG', type: 'website', ...(image ? { images: [{ url: image, alt: product.name }] } : {}) },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, ...(image ? { images: [image] } : {}) },
    other: {
      'product:price:amount': String(product.priceCents / 100),
      'product:price:currency': CURRENCY,
      'product:availability': product.stock > 0 ? 'in stock' : 'out of stock',
    },
  }
}

export default async function ProductRoute({ params }: Params) {
  const { id } = await params
  const product = await loadProduct(id)
  if (!product) notFound()

  const [user, site, categories, similar, summary, settings] = await Promise.all([
    getCurrentUser(),
    getSiteUrl(),
    getCategories(),
    getSimilarProducts({ id: product.id, categoryId: product.categoryId }, 8),
    getRatingSummary(product.id),
    getPublicSettings(),
  ])
  const reviews = await getReviews(product.id, user?.id ?? null)
  const url = `${site}/product/${product.id}`
  const image = shareImage(site, product.imageUrl)

  // بيانات منظمة (schema.org) عشان جوجل يعرض السعر والتقييم والتوفر
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    ...(image ? { image: [image] } : {}),
    url,
    brand: { '@type': 'Brand', name: product.storeName },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: CURRENCY,
      price: (product.priceCents / 100).toFixed(2),
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    ...(summary.count > 0 && summary.avg !== null ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: summary.avg, reviewCount: summary.count } } : {}),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }} />
      <ProductPage
        product={JSON.parse(JSON.stringify(product))}
        categories={JSON.parse(JSON.stringify(categories))}
        similar={JSON.parse(JSON.stringify(similar))}
        reviews={reviews}
        summary={summary}
        user={user}
        shareUrl={url}
        freeShippingThresholdCents={settings.freeShippingThresholdCents}
      />
    </>
  )
}
