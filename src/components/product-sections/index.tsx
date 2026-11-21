import type { ProductSectionId } from '@/content/product-pages'
import {
  CapabilitiesBlock,
  DemoBlock,
  FirstBlock,
  IncludedBlock,
  ObjectionsBlock,
  OfferBlock,
  PriceBlock,
  ProductHero,
  ReadinessBlock,
  ScopeBlock,
} from './common-blocks'
import type { ProductSectionContext } from './shell'
import {
  BeforeAfterBlock,
  DayBlock,
  FactsBlock,
  FlowBlock,
  GrowBlock,
  KnowsBlock,
  OrgBlock,
  PhonesBlock,
  RolesBlock,
  RoutinesBlock,
  ScenariosBlock,
  WeekBlock,
} from './story-blocks'

export type { ProductSectionContext } from './shell'

// One block of a product page by its id from `src/content/product-pages.ts`. `band` alternates the tinted
// background so neighbouring sections read apart whatever the order.
export function ProductSection({ section, ctx, band }: { section: ProductSectionId; ctx: ProductSectionContext; band: boolean }) {
  const { page, dict, locale } = ctx
  const t = dict.productPage
  switch (section) {
    case 'hero':
      return <ProductHero ctx={ctx} />
    case 'demo':
      return <DemoBlock ctx={ctx} band={band} />
    case 'capabilities':
      return <CapabilitiesBlock ctx={ctx} band={band} />
    case 'first':
      return <FirstBlock ctx={ctx} band={band} />
    case 'scope':
      return <ScopeBlock ctx={ctx} band={band} />
    case 'included':
      return <IncludedBlock ctx={ctx} band={band} />
    case 'price':
      return <PriceBlock ctx={ctx} band={band} />
    case 'offer':
      return <OfferBlock ctx={ctx} band={band} />
    case 'objections':
      return <ObjectionsBlock ctx={ctx} band={band} />
    case 'readiness':
      return <ReadinessBlock ctx={ctx} band={band} />
    case 'day':
      return page.day ? <DayBlock copy={page.day} band={band} note={t.mockNote} /> : null
    case 'flow':
      return page.flow ? <FlowBlock copy={page.flow} band={band} /> : null
    case 'week':
      return page.week ? <WeekBlock copy={page.week} band={band} note={t.mockNote} /> : null
    case 'roles':
      return page.roles ? <RolesBlock copy={page.roles} band={band} /> : null
    case 'beforeAfter':
      return page.beforeAfter ? <BeforeAfterBlock copy={page.beforeAfter} band={band} /> : null
    case 'routines':
      return page.routines ? <RoutinesBlock copy={page.routines} band={band} /> : null
    case 'phones':
      return page.phones ? <PhonesBlock copy={page.phones} band={band} note={t.mockNote} /> : null
    case 'facts':
      return page.facts ? <FactsBlock copy={page.facts} band={band} sourceLabel={t.sourceLabel} /> : null
    case 'scenarios':
      return page.scenarios ? <ScenariosBlock copy={page.scenarios} band={band} /> : null
    case 'knows':
      return page.knows ? <KnowsBlock copy={page.knows} band={band} /> : null
    case 'org':
      return page.org ? <OrgBlock copy={page.org} band={band} /> : null
    case 'grow':
      return page.grow ? <GrowBlock copy={page.grow} band={band} href={`/${locale}/ai-team#levels`} /> : null
  }
}

