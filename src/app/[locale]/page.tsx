import { ContactSection } from '@/components/contact-section'
import { Faq } from '@/components/faq'
import { Hero } from '@/components/hero'
import { JsonLd, faqJsonLd } from '@/components/json-ld'
import { Pains } from '@/components/pains'
import { PricingSection } from '@/components/pricing-section'
import { Process } from '@/components/process'
import { Services } from '@/components/services'
import { Trust } from '@/components/trust'
import { getDict } from '@/content'
import { isLocale } from '@/lib/i18n'
import { startingPrice } from '@/lib/pricing'
import { serviceSlugs, siteUrl } from '@/lib/site'
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
    priceRange: '$100-$5000',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: dict.services.title,
      itemListElement: serviceSlugs.map((slug) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: dict.services.items[slug].name },
        priceSpecification: {
          '@type': 'PriceSpecification',
          minPrice: startingPrice[slug],
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
      <Services locale={locale} dict={dict} />
      <Pains dict={dict} />
      <PricingSection dict={dict} />
      <Process dict={dict} />
      <Trust dict={dict} />
      <Faq id="faq" title={dict.faq.title} items={dict.faq.items} />
      <ContactSection dict={dict} locale={locale} />
    </>
  )
}
