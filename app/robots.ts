import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteUrl()
  return {
    rules: [{ userAgent: '*', allow: ['/', '/product/'], disallow: ['/api/'] }],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
