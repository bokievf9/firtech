import { Fragment, type ReactNode } from 'react'
import { DemoSection } from '@/components/demo-section'
import { FaqContact } from '@/components/faq-contact'
import { Hero } from '@/components/hero/hero'
import { JsonLd, faqJsonLd } from '@/components/json-ld'
import { RefCapture } from '@/components/ref-capture'
import { PricingSection } from '@/components/pricing-section'
import { ProductsBento } from '@/components/products/products-bento'
import { Proof } from '@/components/proof/proof'
import { WorkTimeline } from '@/components/work-timeline'
import { getDict } from '@/content'
import { homeSections, type HomeSection } from '@/lib/home'
import { isLocale } from '@/lib/i18n'
import { formatUsd } from '@/lib/pricing'
import { getPricing } from '@/lib/pricing-store'
import { productIds, productPrices } from '@/lib/products'
import { lowestPriceOf } from '@/lib/seo'
import { siteUrl } from '@/lib/site'
import { notFound } from 'next/navigation'

// Home page, stage B1: products lead. The order is `homeSections` (src/lib/home.ts, tested); the
// footer is the eighth section and comes from the locale layout.
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  const pricing = await getPricing()
  const productPrice = productPrices(pricing)

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Fir Tech',
    url: `${siteUrl}/${locale}`,
    description: dict.meta.description,
    areaServed: ['TJ', 'UZ', 'KZ', 'KG', 'RU', 'Worldwide'],
    priceRange: `${formatUsd(lowestPriceOf(pricing))}+`,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: dict.products.title,
      itemListElement: productIds.map((id) => {
        const price = productPrice[id]
        const min =
          price.kind === 'from'
            ? price.from
            : price.kind === 'plans'
              ? Math.min(...price.plans.map((p) => p.setup))
              : null
        return {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: dict.products.items[id].name,
            description: dict.products.items[id].benefit,
          },
          ...(min !== null && {
            priceSpecification: { '@type': 'PriceSpecification', minPrice: min, priceCurrency: 'USD' },
          }),
        }
      }),
    },
  }

  const sections: Record<HomeSection, ReactNode> = {
    hero: <Hero locale={locale} dict={dict} />,
    products: <ProductsBento locale={locale} dict={dict} />,
    demo: <DemoSection dict={dict} />,
    proof: <Proof dict={dict} />,
    process: <WorkTimeline dict={dict} />,
    pricing: <PricingSection dict={dict} locale={locale} teaser />,
    faqContact: <FaqContact dict={dict} locale={locale} />,
    footer: null,
  }

  return (
    <>
      <JsonLd data={organization} />
      <JsonLd data={faqJsonLd(dict.faq.items)} />
      <RefCapture />
      {homeSections.map((id) => (
        <Fragment key={id}>{sections[id]}</Fragment>
      ))}
    </>
  )
}
