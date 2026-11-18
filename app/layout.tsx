import type { Metadata, Viewport } from 'next'
import { Cairo } from 'next/font/google'
import './globals.css'
import './rtx-hema.css'

const cairo = Cairo({ subsets: ['arabic', 'latin'], display: 'swap', variable: '--font-cairo' })

export const metadata: Metadata = {
  title: 'RTX HEMA | الدفع كاش عند الاستلام',
  description: 'RTX HEMA — متجر إلكتروني مصري. الدفع كاش عند الاستلام وشحن لكل محافظات مصر.',
  applicationName: 'RTX HEMA',
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: 'RTX HEMA',
    description: 'الدفع كاش عند الاستلام وشحن لكل محافظات مصر',
    locale: 'ar_EG',
    type: 'website',
    siteName: 'RTX HEMA',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#05050A',
}

const themeScript = `try{var t=localStorage.getItem('rtx-theme')||'dark';document.documentElement.dataset.theme='dark'}catch(e){document.documentElement.dataset.theme='dark'}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} data-theme="dark" data-fx="off" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
