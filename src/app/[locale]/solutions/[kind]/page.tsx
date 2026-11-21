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
import { ChatOpenButton } from '@/components/chat/chat-open-button'
import { HeroIntro } from '@/components/hero-intro'
import { JsonLd } from '@/components/json-ld'
import { Reveal } from '@/components/reveal'
import { RiseText } from '@/components/rise-text'
import { SolutionSet } from '@/components/solution-parts'
import { SpotlightCard } from '@/components/spotlight-card'
import { getDict } from '@/content'
import { kindCatalog, kindName } from '@/content/builder-catalog'
import { presets, quote } from '@/lib/builder'
import { stagesFor } from '@/lib/payment-stages'
import { StageTable } from '@/components/stage-table'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale, locales } from '@/lib/i18n'
import { formatUsd } from '@/lib/pricing'
import { getPricing } from '@/lib/pricing-store'
import { siteUrl } from '@/lib/site'
import { mainPartTerm } from '@/lib/solutions'
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
  const page = solutionCopy(kind, locale, dict, await getPricing())
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
  const pricing = await getPricing()
  const page = solutionCopy(kind, locale, dict, pricing)
  const entry = kindCatalog[kind]
  const build = presets[kind]
  const q = quote(build, pricing)
  const builderHref = solutionBuilderHref(locale, kind)
  const stages = stagesFor(build, q.total, pricing)
  const mainTerm = mainPartTerm(build, q.lines, dict)

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
      price: q.total,
      priceCurrency: 'USD',
    },
  }

  return (
    <>
      <JsonLd data={service} />

      <section className="mx-auto grid max-w-7xl items-end gap-12 px-4 pt-32 pb-20 md:px-8 md:pt-40 lg:grid-cols-12">
        <HeroIntro className="lg:col-span-8">
          <Link
            href={`/${locale}/solutions`}
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={14} />
            {t.all}
          </Link>
          <p className="mt-6 text-sm font-medium text-accent-text">{page.title}</p>
          <h1 className="mt-3 max-w-[20ch] text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {page.promise}
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
            <ChatOpenButton source={`solution_${kind}`} fallbackHref={`/${locale}#demo`} className={buttonStyles.secondary}>
              {t.discuss}
            </ChatOpenButton>
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
            <p className="mt-1 font-mono text-5xl tracking-tight text-accent-text">
              {formatUsd(q.total)}
            </p>
            {q.discount && <p className="mt-3 text-sm text-accent-text">{dict.builder.discount}</p>}
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
                      <p className="flex items-center gap-2 text-xs tracking-[0.12em] text-accent-text uppercase">
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
              <ChatOpenButton source={`solution_${kind}_set`} fallbackHref={`/${locale}#demo`} className={buttonStyles.secondary}>
                {t.discuss}
              </ChatOpenButton>
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

      <section className="border-y border-line bg-surface/40" aria-labelledby="solution-stages">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <RiseText
            text={t.stagesTitle}
            className="text-3xl font-semibold tracking-[-0.03em] md:text-5xl"
          />
          <p id="solution-stages" className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted">
            {t.stagesSub}
          </p>
          <Reveal className="mt-10">
            <div className="grid gap-8 rounded-card border border-line bg-surface p-5 md:p-8 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-8">
                <StageTable
                  stages={stages}
                  dict={dict}
                  locale={locale}
                  title={dict.builder.stagesTitle}
                  note={dict.builder.stageRule}
                />
              </div>
              <dl className="grid content-start gap-5 lg:col-span-4">
                <div>
                  <dt className="text-sm text-faint">{t.firstStageLabel}</dt>
                  <dd className="mt-1 font-mono text-3xl text-accent-text" data-first-stage>
                    {stages[0] ? formatUsd(stages[0].amountUsd) : ''}
                  </dd>
                  <dd className="mt-1 text-[13px] leading-relaxed text-faint">{t.firstStageNote}</dd>
                </div>
                {mainTerm && (
                  <div>
                    <dt className="text-sm text-faint">{t.timelineLabel}</dt>
                    <dd className="mt-1 text-xl font-medium" data-timeline>
                      {mainTerm}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </Reveal>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={builderHref} className={cn(buttonStyles.primary, 'group')}>
              {t.cta}
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <ChatOpenButton source={`solution_${kind}_stages`} fallbackHref={`/${locale}#demo`} className={buttonStyles.secondary}>
              {t.discuss}
            </ChatOpenButton>
          </div>
        </div>
      </section>

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
                    {t.from} {formatUsd(quote(presets[other], pricing).total)}
                  </span>
                </span>
                <ArrowUpRight
                  size={18}
                  className="shrink-0 text-accent-text transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            ))}
        </div>
      </nav>
    </>
  )
}
