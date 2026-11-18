import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  XCircle,
} from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BuilderPreview } from '@/components/builder-preview'
import { ContactSection } from '@/components/contact-section'
import { Faq } from '@/components/faq'
import { HeroIntro } from '@/components/hero-intro'
import { JsonLd, faqJsonLd } from '@/components/json-ld'
import { Reveal } from '@/components/reveal'
import { RiseText } from '@/components/rise-text'
import { SolutionSet, usdRange } from '@/components/solution-parts'
import { SpotlightCard } from '@/components/spotlight-card'
import { getDict } from '@/content'
import { kindCatalog, kindName } from '@/content/builder-catalog'
import { presets, quote } from '@/lib/builder'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale, locales } from '@/lib/i18n'
import { formatUsd } from '@/lib/pricing'
import { siteUrl } from '@/lib/site'
import {
  allSolutionKinds,
  isSolutionKind,
  solutionBuilderHref,
  solutionCopy,
} from '@/lib/solutions'
import { shareBase } from '@/lib/share'

export const dynamicParams = false

export function generateStaticParams() {
  return locales.flatMap((locale) => allSolutionKinds.map((kind) => ({ locale, kind })))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/solutions/[kind]'>): Promise<Metadata> {
  const { locale, kind } = await params
  if (!isLocale(locale) || !isSolutionKind(kind)) return {}
  const dict = getDict(locale)
  const page = solutionCopy(kind, locale, dict)
  const path = `/solutions/${kind}`
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { ru: `/ru${path}`, en: `/en${path}` },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: page.metaTitle,
      description: page.metaDescription,
      url: `/${locale}${path}`,
    },
  }
}

export default async function SolutionPage({ params }: PageProps<'/[locale]/solutions/[kind]'>) {
  const { locale, kind } = await params
  if (!isLocale(locale) || !isSolutionKind(kind)) notFound()
  const dict = getDict(locale)
  const t = dict.solutions
  const page = solutionCopy(kind, locale, dict)
  const entry = kindCatalog[kind]
  const build = presets[kind]
  const q = quote(build)
  const builderHref = solutionBuilderHref(locale, kind)

  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.title,
    description: page.metaDescription,
    url: `${siteUrl}/${locale}/solutions/${kind}`,
    provider: { '@type': 'ProfessionalService', name: 'Fir Tech', url: `${siteUrl}/${locale}` },
    offers: {
      '@type': 'Offer',
      name: `${t.startSet}: ${kindName(kind, locale)}`,
      price: q.total.min,
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'PriceSpecification',
        minPrice: q.total.min,
        maxPrice: q.total.max,
        priceCurrency: 'USD',
      },
    },
  }

  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={faqJsonLd(page.faq)} />

      <section className="mx-auto grid max-w-7xl items-end gap-12 px-4 pt-32 pb-20 md:px-8 md:pt-40 lg:grid-cols-12">
        <HeroIntro className="lg:col-span-8">
          <Link
            href={`/${locale}/solutions`}
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={14} />
            {t.all}
          </Link>
          <h1 className="mt-6 max-w-[18ch] text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {page.title}
          </h1>
          <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-muted md:text-xl">
            {page.sub}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={builderHref} className={cn(buttonStyles.primary, 'group')}>
              {t.cta}
              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
            <Link href="#contact" className={buttonStyles.secondary}>
              {t.discuss}
            </Link>
          </div>
        </HeroIntro>
        <Reveal className="lg:col-span-4" delay={0.3}>
          <div className="rounded-card border border-line bg-surface p-7">
            <div className="flex items-center gap-3 text-sm text-muted">
              <span aria-hidden="true" className="text-2xl leading-none">
                {entry.emoji}
              </span>
              {kindName(kind, locale)}
            </div>
            <p className="mt-6 text-sm text-muted">
              {t.startSet} {t.from}
            </p>
            <p className="mt-1 font-mono text-5xl tracking-tight text-accent">
              {formatUsd(q.total.min)}
            </p>
            <p className="mt-2 font-mono text-sm text-muted">{usdRange(q.total)}</p>
            {q.discount && <p className="mt-3 text-sm text-accent">{dict.builder.discount}</p>}
            {q.monthly !== null && (
              <p className="mt-1 font-mono text-sm text-muted">
                + {formatUsd(q.monthly)}
                {dict.builder.perMonth}
              </p>
            )}
          </div>
        </Reveal>
      </section>

      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <RiseText
            text={t.problemsTitle}
            className="max-w-[22ch] text-3xl font-semibold tracking-[-0.03em] md:text-5xl"
          />
          <ul className="mt-12 grid gap-4 md:grid-cols-2">
            {page.problems.map((item, i) => (
              <li key={item.pain}>
                <Reveal delay={(i % 2) * 0.06} className="h-full">
                  <SpotlightCard className="grid h-full gap-6 rounded-card border border-line bg-surface p-6 md:p-8">
                    <div>
                      <p className="flex items-center gap-2 text-xs tracking-[0.12em] text-faint uppercase">
                        <XCircle size={16} className="text-danger" />
                        {t.problemLabel}
                      </p>
                      <h3 className="mt-3 text-xl leading-snug font-medium tracking-tight">
                        {item.pain}
                      </h3>
                    </div>
                    <div className="border-t border-line pt-6">
                      <p className="flex items-center gap-2 text-xs tracking-[0.12em] text-accent uppercase">
                        <CheckCircle size={16} />
                        {t.fixLabel}
                      </p>
                      <p className="mt-3 leading-relaxed text-muted">{item.fix}</p>
                    </div>
                  </SpotlightCard>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <RiseText
          text={t.setTitle}
          className="text-3xl font-semibold tracking-[-0.03em] md:text-5xl"
        />
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted">{t.setSub}</p>
        <div className="mt-12 grid gap-6 lg:grid-cols-12">
          <Reveal className="min-w-0 lg:col-span-7">
            <SolutionSet kind={kind} dict={dict} locale={locale} />
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href={builderHref} className={cn(buttonStyles.primary, 'group sm:flex-1')}>
                {t.cta}
                <ArrowRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
              <Link href="#contact" className={buttonStyles.secondary}>
                {t.discuss}
              </Link>
            </div>
          </Reveal>
          <Reveal className="min-w-0 lg:col-span-5" delay={0.1}>
            <div className="grid gap-4 lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted">{t.previewLabel}</p>
                <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-xs text-faint">
                  {t.concept}
                </span>
              </div>
              <BuilderPreview build={build} dict={dict} locale={locale} />
              <p className="text-[13px] leading-relaxed text-faint">{t.previewNote}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <Faq title={t.faqTitle} items={page.faq} />
      <ContactSection dict={dict} locale={locale} />

      <nav className="mx-auto max-w-7xl px-4 pb-24 md:px-8" aria-label={t.othersTitle}>
        <h2 className="text-xl font-semibold tracking-tight">{t.othersTitle}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {allSolutionKinds
            .filter((other) => other !== kind)
            .map((other) => (
              <Link
                key={other}
                href={`/${locale}/solutions/${other}`}
                className="group flex items-center justify-between gap-4 rounded-card border border-line px-6 py-5 transition-colors hover:border-line-strong"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{kindName(other, locale)}</span>
                  <span className="font-mono text-sm text-muted">
                    {t.from} {formatUsd(quote(presets[other]).total.min)}
                  </span>
                </span>
                <ArrowUpRight
                  size={18}
                  className="shrink-0 text-accent transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            ))}
        </div>
      </nav>
    </>
  )
}
