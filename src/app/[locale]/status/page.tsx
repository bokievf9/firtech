import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { HeroIntro } from '@/components/hero-intro'
import { StatusView } from '@/components/status-view'
import { getDict } from '@/content'
import { isLocale } from '@/lib/i18n'
import { shareBase } from '@/lib/share'
import { statusSource } from '@/lib/status-hq'

// Public status page. The first render reads the same cached source as GET /api/status on the
// server; a small client island refreshes it every minute. Indexed on purpose.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/[locale]/status'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).statusPage
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/status`,
      languages: { ru: '/ru/status', en: '/en/status', 'x-default': '/ru/status' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: t.metaTitle,
      description: t.metaDescription,
      url: `/${locale}/status`,
    },
  }
}

export default async function StatusPage({ params }: PageProps<'/[locale]/status'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  const t = dict.statusPage
  const initial = await statusSource.get()

  return (
    <section className="mx-auto max-w-3xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <HeroIntro>
        <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
        <h1 className="mt-5 text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
          {t.title}
        </h1>
        <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-muted">{t.sub}</p>
      </HeroIntro>
      <div className="mt-10">
        <StatusView initial={initial} dict={dict} locale={locale} />
      </div>
    </section>
  )
}
