import type { ProductSectionId } from '@/content/product-pages'
import { ChannelsBlock } from './channels-block'
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
import {
  CasesBlock,
  KnowledgeBlock,
  LivesBlock,
  MemoryBlock,
  MyDayBlock,
  PilotBlock,
  PultBlock,
  RolloutBlock,
  SetupBlock,
  StructureBlock,
  TeamGetsBlock,
  TrustBlock,
} from './flagship-blocks'
import type { ProductSectionContext } from './shell'
import {
  BeforeAfterBlock,
  DayBlock,
  FactsBlock,
  FlowBlock,
  KnowsBlock,
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
  const { page, dict } = ctx
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
    case 'channels':
      return <ChannelsBlock ctx={ctx} band={band} />
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
    case 'myday':
      return page.myday ? <MyDayBlock copy={page.myday} band={band} note={t.mockNote} /> : null
    case 'memory':
      return page.memory ? <MemoryBlock copy={page.memory} band={band} /> : null
    case 'lives':
      return page.lives ? <LivesBlock copy={page.lives} band={band} /> : null
    case 'setup':
      return page.setup ? <SetupBlock copy={page.setup} band={band} /> : null
    case 'cases':
      return page.cases ? <CasesBlock copy={page.cases} band={band} /> : null
    case 'structure':
      return page.structure ? <StructureBlock copy={page.structure} band={band} /> : null
    case 'pult':
      return page.pult ? <PultBlock copy={page.pult} band={band} /> : null
    case 'knowledge':
      return page.knowledge ? <KnowledgeBlock copy={page.knowledge} band={band} /> : null
    case 'trust':
      return page.trust ? <TrustBlock copy={page.trust} band={band} /> : null
    case 'teamgets':
      return page.teamgets ? <TeamGetsBlock copy={page.teamgets} band={band} /> : null
    case 'rollout':
      return page.rollout ? <RolloutBlock copy={page.rollout} band={band} /> : null
    case 'pilot':
      return page.pilot ? <PilotBlock copy={page.pilot} band={band} id={ctx.id} /> : null
  }
}

