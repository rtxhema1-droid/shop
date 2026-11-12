import type { MetadataRoute } from 'next'
import { getSitemapProducts } from '@/lib/marketplace'
import { getSiteUrl } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** sitemap.xml: الرئيسية + كل منتج ظاهر في المتجر */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSiteUrl()
  let products: Array<{ id: string; updatedAt: string }> = []
  try {
    products = await getSitemapProducts()
  } catch {
    /* الداتابيز مش متوصلة لسه: نرجّع الرئيسية بس */
  }
  return [
    { url: site, changeFrequency: 'daily', priority: 1 },
    ...products.map((product) => ({
      url: `${site}/product/${product.id}`,
      lastModified: new Date(product.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
