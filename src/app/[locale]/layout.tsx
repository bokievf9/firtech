import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { ChatWidget } from '@/components/chat/chat-widget'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { MobileCta } from '@/components/mobile-cta'
import { MotionProvider } from '@/components/motion-provider'
import { YandexMetrika } from '@/components/yandex-metrika'
import { getDict } from '@/content'
import { isLocale, locales } from '@/lib/i18n'
import { siteUrl } from '@/lib/site'
import { geologica, jetbrains, onest, unbounded } from '../fonts'
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
    <html lang={locale} className={`site ${onest.variable} ${jetbrains.variable} ${unbounded.variable} ${geologica.variable}`}>
      <body className="grain min-h-[100dvh]">
        {/* Without JavaScript Motion never reveals the blocks it renders hidden. */}
        <noscript>
          <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
        </noscript>
        <MotionProvider>
          <a
            href="#main"
            className="print-hidden sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-ink"
          >
            {dict.nav.skip}
          </a>
          <Header locale={locale} dict={dict} />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <Footer locale={locale} dict={dict} />
          <MobileCta
            locale={locale}
            label={dict.nav.cta}
            telegramLabel={dict.contact.telegramCta}
          />
          <ChatWidget locale={locale} copy={dict.chat} contactHref={`/${locale}#contact`} />
        </MotionProvider>
        <YandexMetrika />
      </body>
    </html>
  )
}
