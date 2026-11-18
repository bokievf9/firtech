import { Compare } from '@/components/compare'
import { DemoSection } from '@/components/demo-section'
import { ContactSection } from '@/components/contact-section'
import { Directions } from '@/components/directions'
import { DonoCase } from '@/components/dono-case'
import { Faq } from '@/components/faq'
import { Hero } from '@/components/hero'
import { JsonLd, faqJsonLd } from '@/components/json-ld'
import { Pains } from '@/components/pains'
import { PricingSection } from '@/components/pricing-section'
import { Process } from '@/components/process'
import { Region } from '@/components/region'
import { Services } from '@/components/services'
import { Showcase } from '@/components/showcase'
import { StackMarquee } from '@/components/stack-marquee'
import { Trust } from '@/components/trust'
import { getDict } from '@/content'
import { isLocale } from '@/lib/i18n'
import { directionIds, directionPrices } from '@/lib/directions'
import { siteUrl } from '@/lib/site'
import { notFound } from 'next/navigation'

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Fir Tech',
    url: `${siteUrl}/${locale}`,
    description: dict.meta.description,
    areaServed: ['TJ', 'UZ', 'KZ', 'KG', 'RU', 'Worldwide'],
    priceRange: '$60-$5000',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: dict.directions.title,
      itemListElement: directionIds.map((id) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: dict.directions.items[id].title,
          description: dict.directions.items[id].lines.join(' '),
        },
        priceSpecification: {
          '@type': 'PriceSpecification',
          minPrice: directionPrices[id].from,
          priceCurrency: 'USD',
        },
      })),
    },
  }

  return (
    <>
      <JsonLd data={organization} />
      <JsonLd data={faqJsonLd(dict.faq.items)} />
      <Hero locale={locale} dict={dict} />
      <StackMarquee dict={dict} />
      <DemoSection dict={dict} />
      <Directions locale={locale} dict={dict} />
      <DonoCase dict={dict} />
      <Services locale={locale} dict={dict} />
      <Pains dict={dict} />
      <Showcase locale={locale} dict={dict} />
      <Compare dict={dict} />
      <Trust dict={dict} />
      <Region dict={dict} />
      <PricingSection dict={dict} locale={locale} />
      <Process dict={dict} />
      <Faq id="faq" title={dict.faq.title} items={dict.faq.items} />
      <ContactSection dict={dict} locale={locale} />
    </>
  )
}
