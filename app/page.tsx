import { ShopApp } from '@/components/shop/shop-app'
import { DbNotConfiguredError } from '@/lib/db'
import { getCatalog, getDashboard } from '@/lib/marketplace'
import { getCurrentUser } from '@/lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  try {
    const user = await getCurrentUser()
    // الزائر بيشوف بوابة الدخول بس، فمفيش داعي نبعتله بيانات المتجر
    const emptyCatalog = { categories: [], products: [], zones: [] }
    const [catalog, dashboard] = await Promise.all([user ? getCatalog() : Promise.resolve(emptyCatalog), user ? getDashboard(user) : Promise.resolve(null)])
    return <ShopApp user={user} catalog={JSON.parse(JSON.stringify(catalog))} initialDashboard={dashboard ? JSON.parse(JSON.stringify(dashboard)) : null} />
  } catch (error) {
    if (error instanceof DbNotConfiguredError) {
      return (
        <main className="setup-notice">
          <h1>RTX SHOP — فاضل خطوة واحدة</h1>
          <p>قاعدة البيانات لسه متوصلتش بالموقع.</p>
          <ol>
            <li>افتح مشروعك في Vercel ← <b>Storage</b> ← اعمل <b>Postgres (Neon)</b> وارفطه بالمشروع.</li>
            <li>اتأكد إن متغير <code>DATABASE_URL</code> اتضاف تلقائي في Environment Variables.</li>
            <li>اعمل <b>Redeploy</b> وخلاص — الجداول والأقسام وحساب المالك بيتعملوا لوحدهم.</li>
          </ol>
        </main>
      )
    }
    throw error
  }
}
