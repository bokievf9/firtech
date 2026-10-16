import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EstimateSheet } from '@/components/estimate-sheet'
import { getDict } from '@/content'
import { isLocale } from '@/lib/i18n'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/builder/estimate'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return {
    title: getDict(locale).builder.estimate.metaTitle,
    robots: { index: false, follow: true },
    alternates: {
      canonical: `/${locale}/builder/estimate`,
      languages: { ru: '/ru/builder/estimate', en: '/en/builder/estimate' },
    },
  }
}

// Static shell; the build itself is read from ?b= in the browser (see EstimateSheet).
export default async function EstimatePage({ params }: PageProps<'/[locale]/builder/estimate'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return <EstimateSheet dict={getDict(locale)} locale={locale} />
}
