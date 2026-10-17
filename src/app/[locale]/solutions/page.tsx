import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ContactSection } from '@/components/contact-section'
import { HeroIntro } from '@/components/hero-intro'
import { JsonLd } from '@/components/json-ld'
import { Reveal } from '@/components/reveal'
import { solutionIcons } from '@/components/solution-parts'
import { SpotlightCard } from '@/components/spotlight-card'
import { getDict } from '@/content'
import { presets, quote } from '@/lib/builder'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { formatUsd } from '@/lib/pricing'
import { siteUrl } from '@/lib/site'
import { solutionKinds } from '@/lib/solutions'
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
      languages: { ru: '/ru/solutions', en: '/en/solutions' },
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

  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.title,
    itemListElement: solutionKinds.map((kind, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.items[kind].title,
      url: `${siteUrl}/${locale}/solutions/${kind}`,
    })),
  }

  return (
    <>
      <JsonLd data={list} />
      <section className="mx-auto max-w-7xl px-4 pt-32 pb-12 md:px-8 md:pt-40 md:pb-16">
        <HeroIntro>
          <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">{t.eyebrow}</p>
          <h1 className="mt-5 max-w-[16ch] text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {t.title}
          </h1>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-muted md:text-xl">{t.sub}</p>
        </HeroIntro>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {solutionKinds.map((kind, i) => {
            const Glyph = solutionIcons[kind]
            const q = quote(presets[kind])
            return (
              <li key={kind}>
                <Reveal delay={(i % 3) * 0.06} className="h-full">
                  <SpotlightCard className="relative flex h-full flex-col rounded-card border border-line bg-surface p-6 transition-colors hover:border-line-strong md:p-8">
                    <div className="flex items-center gap-3 text-sm text-muted">
                      <Glyph size={22} className="text-accent" />
                      {dict.builder.kinds[kind]}
                    </div>
                    <h2 className="mt-6 text-2xl leading-tight font-semibold tracking-[-0.02em]">
                      <Link
                        href={`/${locale}/solutions/${kind}`}
                        className="after:absolute after:inset-0 after:rounded-card"
                      >
                        {t.items[kind].title}
                      </Link>
                    </h2>
                    <p className="mt-3 leading-relaxed text-muted">{t.items[kind].card}</p>
                    <div className="mt-8 flex items-end justify-between gap-4 pt-2 lg:mt-auto">
                      <p className="font-mono text-2xl text-accent">
                        <span className="text-sm text-muted">{t.from} </span>
                        {formatUsd(q.total.min)}
                      </p>
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                        {t.more}
                        <ArrowUpRight size={16} className="text-accent" />
                      </span>
                    </div>
                  </SpotlightCard>
                </Reveal>
              </li>
            )
          })}
          <li>
            <Reveal delay={0.12} className="h-full">
              <div className="flex h-full flex-col rounded-card border border-dashed border-line-strong p-6 md:p-8">
                <h2 className="text-2xl leading-tight font-semibold tracking-[-0.02em]">
                  {t.otherTitle}
                </h2>
                <p className="mt-3 leading-relaxed text-muted">{t.otherText}</p>
                <div className="mt-8 lg:mt-auto">
                  <Link href={`/${locale}/builder`} className={cn(buttonStyles.secondary, 'group')}>
                    {t.otherCta}
                    <ArrowRight
                      size={16}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </Link>
                </div>
              </div>
            </Reveal>
          </li>
        </ul>
      </section>

      <ContactSection dict={dict} locale={locale} />
    </>
  )
}
