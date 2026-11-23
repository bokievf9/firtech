import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HeroIntro } from '@/components/hero-intro'
import { JsonLd } from '@/components/json-ld'
import { Reveal } from '@/components/reveal'
import { SpotlightCard } from '@/components/spotlight-card'
import { getDict } from '@/content'
import { categoryNames, kindCatalog, kindName, kindsByCategory, pick } from '@/content/builder-catalog'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { fromLine } from '@/lib/price-format'
import { nichePrice } from '@/lib/builder-presets'
import { getPricing } from '@/lib/pricing-store'
import { siteUrl } from '@/lib/site'
import { solutionCopy, type SolutionKind } from '@/lib/solutions'
import { shareBase } from '@/lib/share'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/solutions'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).solutions
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/solutions`,
      languages: { ru: '/ru/solutions', en: '/en/solutions', 'x-default': '/ru/solutions' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: t.metaTitle,
      description: t.metaDescription,
      url: `/${locale}/solutions`,
    },
  }
}

export default async function SolutionsPage({ params }: PageProps<'/[locale]/solutions'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  const t = dict.solutions
  const pricing = await getPricing()

  const allKinds = kindsByCategory.flatMap((g) => g.kinds).filter((k): k is SolutionKind => k !== 'other')
  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.title,
    itemListElement: allKinds.map((kind, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: solutionCopy(kind, locale, dict, pricing).title,
      url: `${siteUrl}/${locale}/solutions/${kind}`,
    })),
  }

  return (
    <>
      <JsonLd data={list} />
      <section className="mx-auto max-w-7xl px-4 pt-32 pb-12 md:px-8 md:pt-40 md:pb-16">
        <HeroIntro>
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <h1 className="mt-5 max-w-[16ch] text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {t.title}
          </h1>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-muted md:text-xl">{t.sub}</p>
        </HeroIntro>
      </section>

      <section className="mx-auto grid max-w-7xl gap-14 px-4 pb-24 md:px-8">
        {kindsByCategory.map((group) => {
          const kinds = group.kinds.filter((k): k is SolutionKind => k !== 'other')
          if (!kinds.length) return null
          return (
            <div key={group.category}>
              <h2 className="mb-5 text-sm tracking-[0.12em] text-faint uppercase">
                {pick(categoryNames[group.category], locale)}
              </h2>
              <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {kinds.map((kind, i) => {
                  const copy = solutionCopy(kind, locale, dict, pricing)
                  return (
                    <li key={kind}>
                      <Reveal delay={(i % 3) * 0.06} className="h-full">
                        <SpotlightCard className="relative flex h-full flex-col rounded-card border border-line bg-surface p-6 transition-colors hover:border-line-strong md:p-8">
                          <div className="flex items-center gap-3 text-sm text-muted">
                            <span aria-hidden="true" className="text-2xl leading-none">
                              {kindCatalog[kind].emoji}
                            </span>
                            {kindName(kind, locale)}
                          </div>
                          <h3 className="mt-6 text-2xl leading-tight font-semibold tracking-[-0.02em]">
                            <Link
                              href={`/${locale}/solutions/${kind}`}
                              className="after:absolute after:inset-0 after:rounded-card"
                            >
                              {copy.title}
                            </Link>
                          </h3>
                          <p className="mt-3 leading-relaxed text-muted">{copy.card}</p>
                          <div className="mt-8 flex items-end justify-between gap-4 pt-2 lg:mt-auto">
                            <p className="font-mono text-lg leading-snug text-accent-text" data-niche-price={kind}>
                              {(() => {
                                const price = nichePrice(kind, pricing)
                                return fromLine(price.oneTime, price.monthly, locale)
                              })()}
                            </p>
                            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                              {t.more}
                              <ArrowUpRight size={16} className="text-accent-text" />
                            </span>
                          </div>
                        </SpotlightCard>
                      </Reveal>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
        <Reveal delay={0.12}>
          <div className="flex flex-col gap-5 rounded-card border border-dashed border-line-strong p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
            <div>
              <h2 className="text-2xl leading-tight font-semibold tracking-[-0.02em]">
                {t.otherTitle}
              </h2>
              <p className="mt-3 max-w-[60ch] leading-relaxed text-muted">{t.otherText}</p>
            </div>
            <Link href={`/${locale}/builder`} className={cn(buttonStyles.secondary, 'group shrink-0')}>
              {t.otherCta}
              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
