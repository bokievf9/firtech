import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHero } from '@/components/page-hero'
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
    <>
      <PageHero light={t.titleLight} strong={t.titleStrong} lead={t.sub} narrow />
      <section className="mx-auto max-w-3xl px-4 pb-28 md:px-8">
        <StatusView initial={initial} dict={dict} locale={locale} />
      </section>
    </>
  )
}
