import { ArrowLeft, ArrowUpRight, Check } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ContactSection } from '@/components/contact-section'
import { Faq } from '@/components/faq'
import { HeroIntro } from '@/components/hero-intro'
import { JsonLd, faqJsonLd } from '@/components/json-ld'
import { PricingSection } from '@/components/pricing-section'
import { Reveal } from '@/components/reveal'
import { getDict } from '@/content'
import { buttonStyles, homeAnchor } from '@/lib/cn'
import { isLocale, locales } from '@/lib/i18n'
import { catalog, formatUsd, startingPrice } from '@/lib/pricing'
import { isServiceSlug, serviceSlugs, siteUrl } from '@/lib/site'

export const dynamicParams = false

export function generateStaticParams() {
  return locales.flatMap((locale) => serviceSlugs.map((slug) => ({ locale, slug })))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/services/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale) || !isServiceSlug(slug)) return {}
  const page = getDict(locale).serviceDetails[slug]
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: {
      canonical: `/${locale}/services/${slug}`,
      languages: { ru: `/ru/services/${slug}`, en: `/en/services/${slug}` },
    },
    openGraph: { title: page.metaTitle, description: page.metaDescription, url: `/${locale}/services/${slug}` },
  }
}

export default async function ServicePage({ params }: PageProps<'/[locale]/services/[slug]'>) {
  const { locale, slug } = await params
  if (!isLocale(locale) || !isServiceSlug(slug)) notFound()
  const dict = getDict(locale)
  const page = dict.serviceDetails[slug]
  const t = dict.servicePage
  const variants = dict.estimator.catalog[slug].variants as Record<string, { name: string; term: string }>
  const prices = catalog[slug].variants

  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: dict.services.items[slug].name,
    description: page.metaDescription,
    url: `${siteUrl}/${locale}/services/${slug}`,
    provider: { '@type': 'ProfessionalService', name: 'Fir Tech', url: `${siteUrl}/${locale}` },
    offers: Object.entries(variants).map(([id, v]) => ({
      '@type': 'Offer',
      name: v.name,
      price: prices[id],
      priceCurrency: 'USD',
    })),
  }

  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={faqJsonLd(page.faq)} />

      <section className="mx-auto grid max-w-7xl items-end gap-12 px-4 pt-32 pb-20 md:px-8 md:pt-40 lg:grid-cols-12">
        <HeroIntro className="lg:col-span-8">
          <Link
            href={homeAnchor(locale, 'services')}
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={14} />
            {dict.services.items[slug].name}
          </Link>
          <h1 className="mt-6 max-w-[18ch] text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {page.title}
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted md:text-xl">{page.sub}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="#contact" className={buttonStyles.primary}>
              {dict.nav.cta}
            </Link>
            <Link href="#pricing" className={buttonStyles.secondary}>
              {t.estimate}
            </Link>
          </div>
        </HeroIntro>
        <Reveal className="lg:col-span-4" delay={0.3}>
          <div className="rounded-card border border-line bg-surface p-7">
            <p className="text-sm text-muted">{dict.services.from}</p>
            <p className="mt-1 font-mono text-5xl tracking-tight text-accent">{formatUsd(startingPrice[slug])}</p>
            <ul className="mt-6 grid gap-2">
              {dict.services.items[slug].tags.map((tag) => (
                <li key={tag} className="flex items-center gap-2 text-sm text-muted">
                  <Check size={14} className="text-accent" />
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:px-8 md:py-28 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">{t.included}</h2>
          </Reveal>
          <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:col-span-8">
            {page.included.map((item, i) => (
              <li key={item}>
                <Reveal delay={(i % 2) * 0.05} className="flex gap-3 text-lg leading-snug">
                  <Check size={20} weight="bold" className="mt-0.5 shrink-0 text-accent" />
                  {item}
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">{t.variants}</h2>
        </Reveal>
        <div className="mt-10 grid gap-3">
          {Object.entries(variants).map(([id, v], i) => (
            <Reveal key={id} delay={i * 0.05}>
              <div className="grid items-center gap-2 rounded-card border border-line bg-surface px-6 py-6 sm:grid-cols-[1fr_auto_auto] sm:gap-10 md:px-8">
                <p className="text-xl font-medium tracking-tight">{v.name}</p>
                <p className="text-sm text-muted">
                  {t.term}: <span className="text-fg">{v.term}</span>
                </p>
                <p className="font-mono text-2xl text-accent">
                  <span className="text-sm text-muted">{dict.services.from} </span>
                  {formatUsd(prices[id] ?? 0)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-14">
          <h3 className="text-xl font-semibold tracking-tight">{t.fits}</h3>
          <div className="mt-5 flex flex-wrap gap-2">
            {page.fits.map((fit) => (
              <span key={fit} className="rounded-full border border-line-strong px-4 py-2 text-sm">
                {fit}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      <PricingSection dict={dict} initialService={slug} />
      <Faq title={t.faq} items={page.faq} />
      <ContactSection dict={dict} locale={locale} defaultService={slug} />

      <nav className="mx-auto max-w-7xl px-4 pb-24 md:px-8" aria-label={t.others}>
        <h2 className="text-xl font-semibold tracking-tight">{t.others}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {serviceSlugs
            .filter((other) => other !== slug)
            .map((other) => (
              <Link
                key={other}
                href={`/${locale}/services/${other}`}
                className="group flex items-center justify-between rounded-card border border-line px-6 py-5 transition-colors hover:border-line-strong"
              >
                <span>
                  <span className="block font-medium">{dict.services.items[other].name}</span>
                  <span className="font-mono text-sm text-muted">
                    {dict.services.from} {formatUsd(startingPrice[other])}
                  </span>
                </span>
                <ArrowUpRight size={18} className="text-accent transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
        </div>
      </nav>
    </>
  )
}
