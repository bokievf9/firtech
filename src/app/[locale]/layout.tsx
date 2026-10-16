import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { MobileCta } from '@/components/mobile-cta'
import { MotionProvider } from '@/components/motion-provider'
import { YandexMetrika } from '@/components/yandex-metrika'
import { getDict } from '@/content'
import { isLocale, locales } from '@/lib/i18n'
import { siteUrl } from '@/lib/site'
import { jetbrains, onest } from '../fonts'
import '../globals.css'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export const dynamicParams = false

export const viewport: Viewport = { themeColor: '#0a0d0b', colorScheme: 'dark' }

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const dict = getDict(locale)
  return {
    metadataBase: new URL(siteUrl),
    title: { default: dict.meta.title, template: '%s' },
    description: dict.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { ru: '/ru', en: '/en', 'x-default': '/ru' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Fir Tech',
      locale: locale === 'ru' ? 'ru_RU' : 'en_US',
      title: dict.meta.title,
      description: dict.meta.description,
      url: `/${locale}`,
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)

  return (
    <html lang={locale} className={`${onest.variable} ${jetbrains.variable}`}>
      <body className="grain min-h-[100dvh]">
        <MotionProvider>
          <Header locale={locale} dict={dict} />
          <main>{children}</main>
          <Footer locale={locale} dict={dict} />
          <MobileCta
            locale={locale}
            label={dict.nav.cta}
            telegramLabel={dict.contact.telegramCta}
          />
        </MotionProvider>
        <YandexMetrika />
      </body>
    </html>
  )
}
