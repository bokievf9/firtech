import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/json-ld'
import { ProductSection, type ProductSectionContext } from '@/components/product-sections'
import { getDict } from '@/content'
import { productPages, type ProductPageCopy } from '@/content/product-pages'
import { guaranteeCtx } from '@/lib/guarantee'
import { isLocale, locales } from '@/lib/i18n'
import { getPricing } from '@/lib/pricing-store'
import { productPayment, productTerm } from '@/lib/product-page'
import { isProductId, productBuilderHref, productIds, productPath, productPrices } from '@/lib/products'
import { shareBase } from '@/lib/share'
import { siteUrl, telegramUrl } from '@/lib/site'

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
      languages: { ru: `/ru${path}`, en: `/en${path}`, 'x-default': `/ru${path}` },
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

// One page per product, each with its own structure (owner review 2026-11-22): the order of the section blocks
// comes from `src/content/product-pages.ts`, the blocks from `src/components/product-sections/`, the texts from
// `productPage.items.<id>`. Every page carries the live price with the payment stages, the offer from the terms,
// the objections of its buyers and the three next steps by readiness; no FAQ (it lives on the home page).
export default async function ProductPage({ params }: PageProps<'/[locale]/products/[id]'>) {
  const { locale, id } = await params
  if (!isLocale(locale) || !isProductId(id)) notFound()
  const dict = getDict(locale)
  const page = dict.productPage.items[id] as ProductPageCopy
  const item = dict.products.items[id]
  const pricing = await getPricing()
  const price = productPrices(pricing)[id]
  const layout = productPages[id]
  const minPrice =
    price.kind === 'from' ? price.from : price.kind === 'plans' ? Math.min(...price.plans.map((x) => x.setup)) : null

  const ctx: ProductSectionContext = {
    id,
    locale,
    dict,
    page,
    layout,
    payment: productPayment(id, pricing),
    term: productTerm(id, dict, pricing),
    buildHref: productBuilderHref(locale, id),
    telegramUrl,
    guarantee: guaranteeCtx(dict, locale, pricing),
  }

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
    <div data-product-page={id}>
      <JsonLd data={service} />
      {layout.sections.map((section, i) => (
        <ProductSection key={section} section={section} ctx={ctx} band={i % 2 === 1} />
      ))}
    </div>
  )
}
