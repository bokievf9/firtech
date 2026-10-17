import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Builder } from '@/components/builder'
import { ContactSection } from '@/components/contact-section'
import { getDict } from '@/content'
import { isLocale } from '@/lib/i18n'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/builder'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).builder
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/builder`,
      languages: { ru: '/ru/builder', en: '/en/builder' },
    },
    openGraph: { title: t.metaTitle, description: t.metaDescription, url: `/${locale}/builder` },
  }
}

export default async function BuilderPage({ params }: PageProps<'/[locale]/builder'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)

  // The builder is the page: its own step bar carries the h1, each step is a full screen.
  return (
    <>
      <section className="pt-16 md:pt-[72px]">
        <Builder dict={dict} locale={locale} />
      </section>
      <ContactSection dict={dict} locale={locale} />
    </>
  )
}
