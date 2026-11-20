import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Browser,
  Check,
  DeviceMobile,
  Lightning,
  TelegramLogo,
} from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { BotChatDemo } from '@/components/bot-chat-demo'
import { ContactSection } from '@/components/contact-section'
import { Faq } from '@/components/faq'
import { HeroIntro } from '@/components/hero-intro'
import { HeroStage } from '@/components/hero-stage'
import { JsonLd, faqJsonLd } from '@/components/json-ld'
import { Magnetic } from '@/components/magnetic'
import { PricingSection } from '@/components/pricing-section'
import { Process } from '@/components/process'
import { Reveal } from '@/components/reveal'
import { RiseText } from '@/components/rise-text'
import { ServiceConcepts } from '@/components/service-concepts'
import { ServiceVariants } from '@/components/service-variants'
import { FlowChain, PhoneFan, SiteAssembly } from '@/components/service-visuals'
import { SpotlightCard } from '@/components/spotlight-card'
import { getDict, type Dict } from '@/content'
import { buttonStyles, cn, homeAnchor } from '@/lib/cn'
import { isLocale, locales } from '@/lib/i18n'
import { formatUsd, type Pricing } from '@/lib/pricing'
import { getPricing } from '@/lib/pricing-store'
import { isServiceSlug, serviceSlugs, siteUrl, type ServiceSlug } from '@/lib/site'
import { fillServicePrice } from '@/lib/seo'
import { shareBase } from '@/lib/share'

export const dynamicParams = false

export function generateStaticParams() {
  return locales.flatMap((locale) => serviceSlugs.map((slug) => ({ locale, slug })))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/services/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale) || !isServiceSlug(slug)) return {}
  const raw = getDict(locale).serviceDetails[slug]
  const pricing = await getPricing()
  const page = {
    metaTitle: fillServicePrice(raw.metaTitle, slug, pricing),
    metaDescription: fillServicePrice(raw.metaDescription, slug, pricing),
  }
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: {
      canonical: `/${locale}/services/${slug}`,
      languages: { ru: `/ru/services/${slug}`, en: `/en/services/${slug}` },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: page.metaTitle,
      description: page.metaDescription,
      url: `/${locale}/services/${slug}`,
    },
  }
}

const icons = { websites: Browser, bots: TelegramLogo, apps: DeviceMobile, automation: Lightning }

const sectionTitle = 'text-4xl font-semibold tracking-[-0.035em] md:text-6xl'

export default async function ServicePage({ params }: PageProps<'/[locale]/services/[slug]'>) {
  const { locale, slug } = await params
  if (!isLocale(locale) || !isServiceSlug(slug)) notFound()
  const dict = getDict(locale)
  const page = dict.serviceDetails[slug]
  const t = dict.servicePage
  const variants = dict.estimator.catalog[slug].variants as Record<
    string,
    { name: string; term: string }
  >
  const pricing = await getPricing()
  const prices = pricing.catalog[slug].variants

  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: dict.services.items[slug].name,
    description: fillServicePrice(page.metaDescription, slug, pricing),
    url: `${siteUrl}/${locale}/services/${slug}`,
    provider: { '@type': 'ProfessionalService', name: 'Fir Tech', url: `${siteUrl}/${locale}` },
    offers: Object.entries(variants).map(([id, v]) => ({
      '@type': 'Offer',
      name: v.name,
      price: prices[id],
      priceCurrency: 'USD',
    })),
  }

  // The shared process strip, filled with this service's own steps.
  const steps: Dict = { ...dict, process: { ...dict.process, title: t.steps, steps: page.steps } }

  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={faqJsonLd(page.faq)} />

      <section className="relative overflow-hidden">
        <HeroStage
          copy={
            <>
              <HeroIntro>
                <Link
                  href={homeAnchor(locale, 'products')}
                  className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  <ArrowLeft size={14} />
                  {dict.services.items[slug].name}
                </Link>
              </HeroIntro>
              <RiseText
                as="h1"
                text={page.title}
                delay={0.1}
                className="mt-7 max-w-[16ch] text-balance text-[clamp(2.5rem,5.2vw,4.6rem)] leading-[1.02] font-semibold tracking-[-0.045em]"
              />
              <HeroIntro delay={0.4}>
                <p className="mt-7 max-w-[46ch] text-lg leading-relaxed text-muted md:text-xl">
                  {page.sub}
                </p>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Magnetic>
                    <Link
                      href="#contact"
                      className={cn(buttonStyles.primary, 'group w-full sm:w-auto')}
                    >
                      {dict.nav.cta}
                      <ArrowRight
                        size={16}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </Link>
                  </Magnetic>
                  <Link href="#pricing" className={buttonStyles.secondary}>
                    {t.estimate}
                  </Link>
                </div>
              </HeroIntro>
            </>
          }
          demo={<HeroCard slug={slug} dict={dict} pricing={pricing} />}
        />
      </section>

      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <RiseText text={t.included} className={cn(sectionTitle, 'lg:col-span-6')} />
            <Reveal delay={0.1} className="lg:col-span-6">
              <p className="text-sm text-muted">{t.fits}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {page.fits.map((fit) => (
                  <li
                    key={fit}
                    className="rounded-full border border-line-strong px-4 py-2 text-sm"
                  >
                    {fit}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.included.map((item, i) => (
              <li key={item}>
                <Reveal delay={(i % 3) * 0.07} className="h-full">
                  <SpotlightCard className="group flex h-full items-center gap-4 rounded-card border border-line bg-surface p-5 transition-[border-color,transform] duration-500 ease-out-expo hover:-translate-y-1 hover:border-line-strong sm:flex-col sm:items-stretch sm:gap-10 sm:p-6 md:p-7">
                    <div className="flex shrink-0 items-center justify-between">
                      <span className="flex size-10 items-center justify-center rounded-full bg-accent/10 text-accent-text transition-colors duration-300 group-hover:bg-accent group-hover:text-accent-ink">
                        <Check size={18} weight="bold" />
                      </span>
                      <span className="hidden font-mono text-sm text-faint sm:block">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <p className="leading-snug sm:text-lg">{item}</p>
                  </SpotlightCard>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <RiseText text={t.variants} className={sectionTitle} />
        <ServiceVariants
          service={slug}
          items={Object.entries(variants).map(([id, v]) => ({
            id,
            name: v.name,
            term: v.term,
            price: prices[id] ?? 0,
          }))}
          labels={{ term: t.term, from: dict.services.from, calc: t.calc, calcLabel: t.calcLabel }}
        />
      </section>

      <div className="border-t border-line">
        <Process dict={steps} />
      </div>

      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
          <RiseText text={t.concepts} className={sectionTitle} />
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted">{t.conceptsSub}</p>
          </Reveal>
          <ServiceConcepts slug={slug} s={dict.showcase} cta={t.conceptCta} />
        </div>
      </section>

      <PricingSection dict={dict} locale={locale} initialService={slug} />
      <Faq title={t.faq} items={page.faq} />
      <ContactSection dict={dict} locale={locale} defaultService={slug} />

      <nav className="mx-auto max-w-7xl px-4 pb-24 md:px-8 md:pb-32" aria-label={t.others}>
        <RiseText
          text={t.others}
          className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl"
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {serviceSlugs
            .filter((other) => other !== slug)
            .map((other, i) => {
              const Icon = icons[other]
              return (
                <Reveal key={other} delay={i * 0.07} className="h-full">
                  <SpotlightCard className="group relative flex h-full flex-col gap-8 rounded-card border border-line bg-surface p-6 transition-[border-color,transform] duration-500 ease-out-expo hover:-translate-y-1 hover:border-line-strong">
                    <div className="flex items-center justify-between">
                      <Icon size={26} weight="light" className="text-accent-text" />
                      <ArrowUpRight
                        size={18}
                        className="text-muted transition-[color,transform] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-text"
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight">
                        <Link
                          href={`/${locale}/services/${other}`}
                          className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none"
                        >
                          {dict.services.items[other].name}
                        </Link>
                      </h3>
                      <p className="mt-2 leading-relaxed text-muted">
                        {dict.services.items[other].short}
                      </p>
                    </div>
                    <p className="mt-auto font-mono text-sm text-muted">
                      {dict.services.from}{' '}
                      <span className="text-lg text-accent-text">{formatUsd(pricing.startingPrice[other])}</span>
                    </p>
                  </SpotlightCard>
                </Reveal>
              )
            })}
        </div>
      </nav>
    </>
  )
}

// Right side of the hero: the starting price and formats, above the service's live miniature
// (the same ones as on the home page cards).
function HeroCard({ slug, dict, pricing }: { slug: ServiceSlug; dict: Dict; pricing: Pricing }) {
  const item = dict.services.items[slug]
  const Icon = icons[slug]
  const landing = dict.estimator.catalog.websites.variants.landing
  const minis: Record<ServiceSlug, ReactNode> = {
    websites: (
      // The term is set smaller here than on the home card: the price above is the headline.
      <div className="[&_p.font-mono]:text-4xl [&_p.font-mono]:whitespace-nowrap max-xl:[&>div]:grid-cols-1!">
        <SiteAssembly term={landing.term} label={landing.name} />
      </div>
    ),
    bots: <BotChatDemo t={dict.services.chat} />,
    apps: (
      <div className="flex h-56 items-center justify-center">
        <div className="w-fit origin-center scale-[1.15] xl:scale-[1.35]">
          <PhoneFan />
        </div>
      </div>
    ),
    automation: (
      <div className="py-2">
        <FlowChain site={dict.hero.demo.site} />
      </div>
    ),
  }

  return (
    <div className="rounded-card border border-line-strong bg-surface/85 p-5 shadow-float backdrop-blur md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{dict.services.from}</p>
          <p className="mt-1 font-mono text-5xl tracking-tight text-accent-text md:text-6xl">
            {formatUsd(pricing.startingPrice[slug])}
          </p>
        </div>
        <span className="flex size-12 items-center justify-center rounded-full border border-line-strong text-accent-text">
          <Icon size={22} />
        </span>
      </div>
      <ul className="mt-5 flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <li
            key={tag}
            className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm text-muted"
          >
            <Check size={13} weight="bold" className="text-accent-text" />
            {tag}
          </li>
        ))}
      </ul>
      <div className="dot-grid mt-6 rounded-2xl border border-line bg-bg/60 p-5">{minis[slug]}</div>
    </div>
  )
}
