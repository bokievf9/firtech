import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Builder } from '@/components/builder'
import { ContactSection } from '@/components/contact-section'
import { HeroIntro } from '@/components/hero-intro'
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
  const t = dict.builder

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-32 pb-12 md:px-8 md:pt-40 md:pb-16">
        <HeroIntro>
          <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">{t.eyebrow}</p>
          <h1 className="mt-5 max-w-[16ch] text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {t.title}
          </h1>
          <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-muted md:text-xl">{t.sub}</p>
        </HeroIntro>
      </section>
      <section className="mx-auto max-w-7xl px-4 md:px-8">
        <Builder dict={dict} locale={locale} />
      </section>
      <ContactSection dict={dict} locale={locale} />
    </>
  )
}
