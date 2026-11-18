import { headers } from 'next/headers'

/** رابط الموقع الأساسي (بدون / في الآخر). الأفضل تضبط SITE_URL في المتغيّرات، وإلا بيتاخد من الهيدرز. */
export function envSiteUrl(): string | null {
  const raw = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  if (!raw) return null
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin
  } catch {
    return null
  }
}

export async function getSiteUrl() {
  const fromEnv = envSiteUrl()
  if (fromEnv) return fromEnv
  try {
    const list = await headers()
    const host = list.get('x-forwarded-host')?.split(',')[0]?.trim() || list.get('host')
    if (host) {
      const protocol = list.get('x-forwarded-proto')?.split(',')[0]?.trim() || (/^(localhost|127\.)/.test(host) ? 'http' : 'https')
      return new URL(`${protocol}://${host}`).origin
    }
  } catch {
    /* برا نطاق الطلب */
  }
  return 'http://localhost:3000'
}

/** رابط مطلق لمسار أو صورة (الصور النسبية بتتقدّم من نفس الموقع) */
export function absoluteUrl(site: string, pathOrUrl: string) {
  return /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${site}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}
