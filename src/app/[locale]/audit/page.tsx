import { Check } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AuditForm } from '@/components/audit-form'
import { HeroIntro } from '@/components/hero-intro'
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
    <section className="mx-auto grid site-container gap-12 pt-32 pb-28 md:pt-40 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">
        <HeroIntro>
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <h1 className="mt-5 text-[2.2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-5xl">
            {t.title}
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted">{t.sub}</p>
        </HeroIntro>
        <Reveal className="mt-10">
          <h2 className="font-display text-xl font-semibold">{t.pointsTitle}</h2>
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
      </div>
      <Reveal className="lg:col-span-7" delay={0.08}>
        <AuditForm dict={dict} locale={locale} botUrl={telegramUrl} />
      </Reveal>
    </section>
  )
}
