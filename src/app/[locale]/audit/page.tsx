import { Check } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AuditForm } from '@/components/audit-form'
import { PageHero } from '@/components/page-hero'
import { Reveal } from '@/components/reveal'
import { getDict } from '@/content'
import { isLocale } from '@/lib/i18n'
import { shareBase } from '@/lib/share'
import { telegramUrl } from '@/lib/site'

// Free audit: a short form that orders a 5-point review of the visitor's site (POST /api/audit,
// then HQ's POST /audit). Texts live in `auditPage` in src/content.

export async function generateMetadata({ params }: PageProps<'/[locale]/audit'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).auditPage
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/audit`,
      languages: { ru: '/ru/audit', en: '/en/audit', 'x-default': '/ru/audit' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: t.metaTitle,
      description: t.metaDescription,
      url: `/${locale}/audit`,
    },
  }
}

export default async function AuditPage({ params }: PageProps<'/[locale]/audit'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  const t = dict.auditPage

  return (
    <>
      <PageHero light={t.titleLight} strong={t.titleStrong} lead={t.sub} compact />
      <section className="mx-auto grid max-w-7xl gap-12 px-4 pb-28 md:px-8 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-5">
          <h2 className="font-display text-title-3 font-bold">{t.pointsTitle}</h2>
          <ul className="mt-4 grid gap-3 text-[15px] text-muted">
            {t.points.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-accent-text">
                  <Check size={13} weight="bold" aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal className="lg:col-span-7" delay={0.08}>
          <AuditForm dict={dict} locale={locale} botUrl={telegramUrl} />
        </Reveal>
      </section>
    </>
  )
}
