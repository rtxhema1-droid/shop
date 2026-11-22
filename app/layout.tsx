import type { Metadata, Viewport } from 'next'
import { Cairo, El_Messiri, Instrument_Serif } from 'next/font/google'
import './globals.css'
import './rtx-hema.css'
import './rtx-nova.css'
import './rtx-zenin.css'
import { IconDefs } from '@/components/rtx3d/icon-defs'
import { LangProvider } from '@/components/shop/i18n'

const cairo = Cairo({ subsets: ['arabic', 'latin'], display: 'swap', variable: '--font-cairo' })
// خط العناوين: Instrument Serif للإنجليزي + El Messiri للعربي (بيتبدّلوا لوحدهم حسب الحرف)
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], display: 'swap', variable: '--font-serif' })
const messiri = El_Messiri({ subsets: ['arabic', 'latin'], weight: ['500', '700'], display: 'swap', variable: '--font-messiri' })

export const metadata: Metadata = {
  title: 'RTX SHOP | كاش عند الاستلام',
  description: 'RTX SHOP — متجر إلكتروني مصري. كاش عند الاستلام وشحن لكل محافظات مصر. / Egyptian online store: cash on delivery, shipping to every governorate.',
  applicationName: 'RTX SHOP',
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: 'RTX SHOP',
    description: 'كاش عند الاستلام وشحن لكل محافظات مصر · Cash on delivery across Egypt',
    locale: 'ar_EG',
    alternateLocale: ['en_US'],
    type: 'website',
    siteName: 'RTX SHOP',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#06141B',
}

// بيتنفّذ قبل أول رسم: اللغة المحفوظة (اتجاه الصفحة) + علامة «مدخل المتجر» عشان المتجر ميظهرش لحظة قبل الشتر
const bootScript = `try{var d=document.documentElement;d.dataset.theme='dark';d.dataset.intro='1';d.dataset.zi='1';if(localStorage.getItem('rtx-lang')==='en'){d.lang='en';d.dir='ltr'}}catch(e){document.documentElement.dataset.theme='dark';document.documentElement.dataset.intro='1';document.documentElement.dataset.zi='1'}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${serif.variable} ${messiri.variable}`} data-theme="dark" data-fx="off" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <IconDefs />
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  )
}
