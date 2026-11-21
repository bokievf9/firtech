import { ArrowLeft, ArrowRight, Check, X } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChatOpenButton } from '@/components/chat/chat-open-button'
import { Faq } from '@/components/faq'
import { HeroIntro } from '@/components/hero-intro'
import { JsonLd, faqJsonLd } from '@/components/json-ld'
import { CapabilityMock, type MockKind } from '@/components/products/capability-mock'
import { productIcons } from '@/components/products/product-icons'
import { ProductPriceTag } from '@/components/products/product-price'
import { Reveal } from '@/components/reveal'
import { StageTable } from '@/components/stage-table'
import { SpotlightCard } from '@/components/spotlight-card'
import { getDict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale, locales } from '@/lib/i18n'
import { getPricing } from '@/lib/pricing-store'
import { ladderOfProduct, productPayment } from '@/lib/product-page'
import { isProductId, productBuilderHref, productIds, productPath, productPrices } from '@/lib/products'
import { shareBase } from '@/lib/share'
import { siteUrl } from '@/lib/site'

export const dynamicParams = false

export function generateStaticParams() {
  return locales.flatMap((locale) => productIds.map((id) => ({ locale, id })))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/products/[id]'>): Promise<Metadata> {
  const { locale, id } = await params
  if (!isLocale(locale) || !isProductId(id)) return {}
  const page = getDict(locale).productPage.items[id]
  const path = productPath(id)
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

// One page per product (owner 2026-11-22, «Подробнее»): the hero, what it does with a one-line
// example and a small CSS picture each, the first day, week and month, what we need and what it
// does not do, the live price with the payment stages of its template, the FAQ and the two actions.
export default async function ProductPage({ params }: PageProps<'/[locale]/products/[id]'>) {
  const { locale, id } = await params
  if (!isLocale(locale) || !isProductId(id)) notFound()
  const dict = getDict(locale)
  const t = dict.productPage
  const p = dict.products
  const page = t.items[id]
  const item = p.items[id]
  const pricing = await getPricing()
  const price = productPrices(pricing)[id]
  const payment = productPayment(id, pricing)
  const rung = ladderOfProduct(id)
  const Glyph = productIcons[id]
  const buildHref = productBuilderHref(locale, id)
  const minPrice =
    price.kind === 'from' ? price.from : price.kind === 'plans' ? Math.min(...price.plans.map((x) => x.setup)) : null

  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: item.name,
    description: page.metaDescription,
    url: `${siteUrl}/${locale}${productPath(id)}`,
    provider: { '@type': 'ProfessionalService', name: 'Fir Tech', url: `${siteUrl}/${locale}` },
    ...(minPrice !== null && { offers: { '@type': 'Offer', price: minPrice, priceCurrency: 'USD' } }),
  }

  return (
    <>
      <JsonLd data={service} />
      <JsonLd data={faqJsonLd(page.faq)} />

      <section className="mx-auto grid max-w-7xl items-end gap-12 px-4 pt-32 pb-20 md:px-8 md:pt-40 lg:grid-cols-12">
        <HeroIntro className="lg:col-span-8">
          <Link
            href={`/${locale}#products`}
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {t.back}
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line-strong text-accent-text">
              <Glyph size={22} aria-hidden="true" />
            </span>
            {rung && (
              <Link
                href={`/${locale}#levels`}
                className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent-text"
              >
                {t.ladderLabel}: {dict.ladder.levels[rung.level]}
              </Link>
            )}
          </div>
          <h1 className="mt-5 max-w-[18ch] font-display text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {item.name}
          </h1>
          <p className="mt-6 max-w-[56ch] text-lead text-muted">{page.lead}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={buildHref} data-cta={`product_page_${id}_build`} className={cn(buttonStyles.primary, 'group')}>
              {t.cta}
              <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <ChatOpenButton source={`product_${id}`} fallbackHref="#faq" className={buttonStyles.secondary}>
              {t.ask}
            </ChatOpenButton>
          </div>
        </HeroIntro>
        <Reveal className="lg:col-span-4" delay={0.3}>
          <div className="rounded-card border border-line bg-surface p-7">
            <ProductPriceTag id={id} copy={p} className="[&_span]:text-3xl [&_p]:text-base" />
            <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-muted">{item.forWhom}</p>
          </div>
        </Reveal>
      </section>

      <section className="border-y border-line bg-surface/40" aria-labelledby="capabilities">
        <div className="mx-auto max-w-7xl px-4 py-section md:px-8">
          <Reveal>
            <h2 id="capabilities" className="font-display text-title font-semibold">
              {t.capabilitiesTitle}
            </h2>
          </Reveal>
          <ul className="mt-12 grid gap-gutter md:grid-cols-6">
            {page.capabilities.map((cap, i) => (
              <li key={cap.title} className={cn(i < 2 ? 'md:col-span-3' : 'md:col-span-2')}>
                <Reveal delay={(i % 3) * 0.06} className="h-full">
                  <SpotlightCard className="flex h-full flex-col gap-4 rounded-card border border-line bg-surface p-5 md:p-6">
                    <CapabilityMock kind={cap.mock as MockKind} example={cap.example} chips={cap.chips} />
                    <h3 className="text-xl font-semibold tracking-tight">{cap.title}</h3>
                    <p className="leading-relaxed text-muted">{cap.text}</p>
                    <p className="mt-auto border-t border-line pt-3 text-sm text-muted">
                      <span className="text-faint">{t.exampleLabel}: </span>
                      {cap.example}
                    </p>
                  </SpotlightCard>
                </Reveal>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-faint">{t.mockNote}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-section md:px-8" aria-labelledby="first">
        <Reveal>
          <h2 id="first" className="font-display text-title font-semibold">
            {t.firstTitle}
          </h2>
        </Reveal>
        <ol className="mt-12 grid gap-gutter md:grid-cols-3">
          {(['day', 'week', 'month'] as const).map((key, i) => (
            <li key={key}>
              <Reveal delay={i * 0.07} className="h-full">
                <div className="h-full rounded-card border border-line p-6 md:p-7">
                  <p className="font-mono text-xs tracking-[0.14em] text-accent-text uppercase">{t.first[key]}</p>
                  <p className="mt-4 leading-relaxed">{page.first[key]}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto grid max-w-7xl gap-gutter px-4 py-section md:grid-cols-2 md:px-8">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t.needsTitle}</h2>
            <ul className="mt-6 grid gap-3">
              {page.needs.map((line) => (
                <li key={line} className="flex gap-3 text-muted">
                  <Check size={16} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t.notTitle}</h2>
            <ul className="mt-6 grid gap-3">
              {page.not.map((line) => (
                <li key={line} className="flex gap-3 text-muted">
                  <X size={16} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-faint" />
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-section md:px-8" aria-labelledby="price">
        <Reveal>
          <h2 id="price" className="font-display text-title font-semibold">
            {t.priceTitle}
          </h2>
          <p className="mt-5 max-w-[56ch] text-lead text-muted">{t.priceSub}</p>
        </Reveal>
        <Reveal delay={0.08} className="mt-10">
          <div className="rounded-card border border-line bg-surface p-6 md:p-8">
            <ProductPriceTag id={id} copy={p} className="[&_span]:text-3xl [&_p]:text-base" />
            {payment.kind === 'stages' && (
              <div className="mt-8">
                <StageTable stages={payment.stages} dict={dict} locale={locale} title={t.stageTitle} note={t.stageNote} />
              </div>
            )}
            {payment.kind === 'subscription' && (
              <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-muted">{t.subscription}</p>
            )}
            {payment.kind === 'quote' && (
              <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-muted">{t.quoteNote}</p>
            )}
          </div>
        </Reveal>
      </section>

      <Faq id="faq" title={t.faqTitle} items={page.faq} />

      <section className="mx-auto max-w-7xl px-4 pb-section md:px-8">
        <Reveal>
          <div className="rounded-card border border-accent-text/30 bg-[linear-gradient(150deg,var(--color-pine),var(--color-surface)_70%)] p-6 md:p-10">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t.finalTitle}</h2>
            <p className="mt-4 max-w-[56ch] text-muted">{t.finalText}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={buildHref} data-cta={`product_page_${id}_final`} className={cn(buttonStyles.primary, 'group')}>
                {t.cta}
                <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <ChatOpenButton source={`product_${id}_final`} fallbackHref="#faq" className={buttonStyles.secondary}>
                {t.ask}
              </ChatOpenButton>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
