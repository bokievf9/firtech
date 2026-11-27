import { Fragment, type ReactNode } from 'react'
import { DemoSection } from '@/components/demo-section'
import { FaqContact } from '@/components/faq-contact'
import { FilmCue, FilmSceneBlock } from '@/components/film/film-cue'
import { FilmFinale } from '@/components/film/film-finale'
import { FilmStage } from '@/components/film/film-stage'
import { OfficeScene } from '@/components/film/office-scene'
import { PainsSection } from '@/components/film/pains-section'
import { HomeAgents } from '@/components/home-agents'
import { Hero } from '@/components/hero/hero'
import { JsonLd, faqJsonLd } from '@/components/json-ld'
import { RefCapture } from '@/components/ref-capture'
import { PricingSection } from '@/components/pricing-section'
import { ProductsBento } from '@/components/products/products-bento'
import { SolutionsHome } from '@/components/solutions-home'
import { WorkTimeline } from '@/components/work-timeline'
import { getDict } from '@/content'
import { filmScenes, type FilmScene } from '@/lib/film'
import { homeSections, type HomeSection } from '@/lib/home'
import { isLocale } from '@/lib/i18n'
import { formatUsd } from '@/lib/pricing'
import { getPricing } from '@/lib/pricing-store'
import { productIds, productPrices } from '@/lib/products'
import { lowestPriceOf } from '@/lib/seo'
import { siteUrl } from '@/lib/site'
import { notFound } from 'next/navigation'

// Home page as a film (owner 2026-11-22, docs/site-design-notes.md «Главная-фильм»): the sections in
// `homeSections` order (src/lib/home.ts, tested), grouped into the eight scenes of src/lib/film.ts, each
// with Fira on her mark and her line in the HTML. FilmStage adds the travelling WebGL Fira on wide
// screens once the page is loaded; the footer comes from the locale layout.
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

  const f = dict.film
  const cue = (scene: FilmScene, size: 'sm' | 'md' = 'md') => (
    <FilmCue scene={scene} name={f.name} line={f.scenes[scene.id]} size={size} />
  )

  const sections: Record<HomeSection, ReactNode> = {
    hero: <Hero locale={locale} dict={dict} />,
    pains: <PainsSection dict={dict} locale={locale} />,
    products: <ProductsBento locale={locale} dict={dict} />,
    agents: <HomeAgents locale={locale} dict={dict} />,
    office: <OfficeScene dict={dict} locale={locale} />,
    demo: <DemoSection dict={dict} locale={locale} />,
    solutions: <SolutionsHome dict={dict} locale={locale} />,
    process: <WorkTimeline dict={dict} locale={locale} />,
    pricing: <PricingSection dict={dict} locale={locale} />,
    faq: <FaqContact dict={dict} locale={locale} />,
    footer: null,
  }

  return (
    <>
      <JsonLd data={organization} />
      <JsonLd data={faqJsonLd(dict.faq.items)} />
      <RefCapture />
      {filmScenes.map((scene) => (
        <FilmSceneBlock
          key={scene.id}
          scene={scene}
          cue={scene.id === 'hello' ? null : scene.id === 'final' ? <FilmFinale scene={scene} dict={dict} locale={locale} /> : cue(scene)}
        >
          {homeSections.map((id) =>
            (scene.sections as readonly HomeSection[]).includes(id) ? <Fragment key={id}>{sections[id]}</Fragment> : null,
          )}
        </FilmSceneBlock>
      ))}
      <FilmStage copy={{ name: f.name, overlay: f.overlay, scenes: f.scenes }} />
    </>
  )
}
