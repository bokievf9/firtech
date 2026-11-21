import type { ProductId } from '../lib/product-ids'

// Product pages /[locale]/products/[id] (owner review 2026-11-22: «у каждого продукта свой подход, а не один шаблон»).
// Every page is assembled from the section blocks in `src/components/product-sections/` in the order below, so the
// owner changes a page by moving ids here. The texts of each block live in the dictionaries under
// `productPage.items.<id>` (`ru.ts` / `en.ts`, same shape); a block listed here must have its copy there (tested).
// The angle of each page follows how the product is bought (docs/sales-playbook-site.md, «Страницы продуктов»).
export const productSectionIds = [
  'hero', // the client's result as the headline, the product name above it, price card, two main CTAs
  'demo', // a working demo (`demo` below picks which one)
  'day', // a day in the client's business by the hour
  'flow', // what happens to a request step by step
  'capabilities', // what it does, a small CSS picture per line
  'week', // a week of content as a feed preview
  'roles', // the roles inside the product
  'beforeAfter', // the process before and after
  'routines', // routines that disappear
  'phones', // phone screens with the buyer's path
  'facts', // open data about the channel, with sources
  'scenarios', // step-by-step scenarios
  'knows', // what it knows and what it does not promise
  'org', // org chart of roles
  'grow', // how it grows: agent, autopilot, department
  'first', // the first day, week and month
  'scope', // what we need from you and what it does not do
  'included', // what the price includes and what it does not
  'price', // live price, payment stages, term of the main part
  'offer', // the offer from the terms: guarantee, stages, revisions, acceptance
  'objections', // the doubts of this audience, answered
  'readiness', // three CTAs by readiness: demo, builder, call or Telegram
] as const
export type ProductSectionId = (typeof productSectionIds)[number]

// Which working demo the `demo` block shows: the real lead-manager chat, the booking scenario or the assistant.
export type ProductDemo = 'chat' | 'booking' | 'assistant'

export type ProductPageLayout = { sections: readonly ProductSectionId[]; demo?: ProductDemo }

export const productPages: Record<ProductId, ProductPageLayout> = {
  // The salon owner wants to see booking happen without them: the demo comes first, then a day by the hour.
  admin: {
    demo: 'booking',
    sections: ['hero', 'demo', 'day', 'capabilities', 'scope', 'included', 'price', 'offer', 'objections', 'readiness'],
  },
  // The buyer wants to hear how the agent talks to a client: the live chat first, then the road of a request.
  receptionist: {
    demo: 'chat',
    sections: ['hero', 'demo', 'flow', 'included', 'price', 'objections', 'offer', 'scope', 'readiness'],
  },
  // The buyer counts their own time: a week of content, the roles inside, approval by one button.
  content: {
    sections: ['hero', 'week', 'roles', 'first', 'included', 'price', 'objections', 'offer', 'readiness'],
  },
  // The buyer counts hours of manual work: before and after, the routines that go away.
  automation: {
    sections: ['hero', 'beforeAfter', 'routines', 'first', 'scope', 'included', 'price', 'offer', 'objections', 'readiness'],
  },
  // The buyer doubts customers will order in Telegram: screens, the buyer's path, open data about the audience.
  miniapp: {
    sections: ['hero', 'phones', 'facts', 'capabilities', 'included', 'price', 'offer', 'objections', 'readiness'],
  },
  // The buyer is wary of handing over mail and calendar: scenarios step by step, what it knows, what it never promises.
  agent: {
    demo: 'assistant',
    sections: ['hero', 'scenarios', 'demo', 'knows', 'included', 'price', 'objections', 'offer', 'readiness'],
  },
  // The buyer thinks in structure: an org chart of roles, how it grows, then the first month.
  implementation: {
    sections: ['hero', 'org', 'grow', 'first', 'scope', 'included', 'price', 'offer', 'objections', 'readiness'],
  },
}

// ---- copy shapes of the blocks (the dictionaries carry them under productPage.items.<id>) -------------------

export type ProductBlocks = {
  demo?: { title: string; sub: string }
  day?: { title: string; sub: string; items: { time: string; who: string; text: string }[] }
  flow?: { title: string; sub: string; steps: { title: string; text: string }[] }
  week?: { title: string; sub: string; days: { day: string; format: string; title: string; status: string }[] }
  roles?: { title: string; sub: string; items: { name: string; does: string }[] }
  beforeAfter?: { title: string; sub: string; beforeLabel: string; afterLabel: string; rows: { before: string; after: string }[] }
  routines?: { title: string; sub: string; items: { task: string; now: string }[] }
  phones?: { title: string; sub: string; screens: { title: string; caption: string; rows: string[]; action: string }[] }
  facts?: { title: string; sub: string; items: { value: string; label: string; source: string }[]; note: string }
  scenarios?: { title: string; sub: string; items: { title: string; trigger: string; steps: string[]; result: string }[] }
  knows?: { title: string; knowsTitle: string; knows: string[]; notTitle: string; not: string[] }
  org?: {
    title: string
    sub: string
    owner: { name: string; does: string }
    director: { name: string; does: string }
    depts: { name: string; roles: string[] }[]
  }
  grow?: { title: string; sub: string; link: string; steps: { level: string; title: string; text: string }[] }
}

// Fields every product page has (on top of the older capabilities, first, needs and not).
export type ProductPageCopy = ProductBlocks & {
  metaTitle: string
  metaDescription: string
  result: string
  lead: string
  capabilities: { title: string; text: string; example: string; mock: string; chips: string[] }[]
  first: { day: string; week: string; month: string }
  needs: string[]
  not: string[]
  inPrice: string[]
  notInPrice: string[]
  objections: { q: string; a: string }[]
}

// Which block needs which copy field (sections without an entry use the shared fields above).
export const sectionCopyKey: Partial<Record<ProductSectionId, keyof ProductBlocks>> = {
  demo: 'demo',
  day: 'day',
  flow: 'flow',
  week: 'week',
  roles: 'roles',
  beforeAfter: 'beforeAfter',
  routines: 'routines',
  phones: 'phones',
  facts: 'facts',
  scenarios: 'scenarios',
  knows: 'knows',
  org: 'org',
  grow: 'grow',
}
