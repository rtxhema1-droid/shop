import type { Metadata, Viewport } from 'next'
import { Cairo } from 'next/font/google'
import { envSiteUrl } from '@/lib/site'
import './globals.css'
import './fx.css'

const cairo = Cairo({ subsets: ['arabic', 'latin'], display: 'swap', variable: '--font-cairo' })

const siteUrl = envSiteUrl()

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: 'RTX SHOP | الدفع كاش عند الاستلام',
  description: 'RTX SHOP — متجر إلكتروني مصري. الدفع كاش عند الاستلام وشحن لكل محافظات مصر.',
  applicationName: 'RTX SHOP',
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: 'RTX SHOP',
    description: 'الدفع كاش عند الاستلام وشحن لكل محافظات مصر',
    locale: 'ar_EG',
    type: 'website',
    siteName: 'RTX SHOP',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F4F5F7',
}

const themeScript = `try{var t=localStorage.getItem('rtx-theme')||'light';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
