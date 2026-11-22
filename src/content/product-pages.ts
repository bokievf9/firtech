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
  // Flagship blocks (owner 2026-11-22): Personal AI
  'myday', // an interactive day with your AI by the hour, for three kinds of people
  'memory', // what it remembers about you: people, habits, promises
  'channels', // «Где живёт»: the channels as equals (data in lib/channels.ts)
  'lives', // where it lives: channels, voice, its own container, your data stays yours
  'setup', // how we set it up: interview, services, a week of tuning, grows with you
  'cases', // live examples from the founder (Dono, Polly), no prices
  // Flagship blocks: AI company
  'structure', // one brain, many skills: Fira knows the business, skills (sales, support, content) plug in
  'pult', // a tour of the control room we work in ourselves
  'knowledge', // knowledge from your documents, site and chats
  'trust', // trust levels: the agent acts alone after a run of approvals
  'teamgets', // what your team gets: training, rules, roles of people
  'rollout', // four stages of the rollout, what you see at each
  'pilot', // the first one or two pilots free for a case study and a review (flagships only)
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

// `face`: the hero shows Fira as the face of the product (AI company). `callFirst`: the call is the main action
// and the builder the second one (owner 2026-11-22 for the AI company).
export type ProductPageLayout = { sections: readonly ProductSectionId[]; demo?: ProductDemo; face?: 'fira'; callFirst?: boolean }

export const productPages: Record<ProductId, ProductPageLayout> = {
  // Flagship. Anyone can have an AI set up for them: show the whole day first, then what it remembers, where it
  // lives and how we set it up, then the founder's own AIs as live examples, levels and the terms.
  personal: {
    sections: ['hero', 'myday', 'memory', 'channels', 'lives', 'setup', 'cases', 'included', 'price', 'offer', 'pilot', 'objections', 'readiness'],
  },
  // Flagship. Fira installed in the client's company: the map of the company, the control room we use ourselves,
  // knowledge, trust levels, the team, four stages and the price «от» by the quote. A call is the first action.
  company: {
    face: 'fira',
    callFirst: true,
    sections: ['hero', 'structure', 'channels', 'pult', 'knowledge', 'trust', 'teamgets', 'rollout', 'included', 'price', 'offer', 'pilot', 'objections', 'readiness'],
  },
  // The salon owner wants to see booking happen without them: the demo comes first, then a day by the hour.
  admin: {
    demo: 'booking',
    sections: ['hero', 'demo', 'day', 'capabilities', 'channels', 'scope', 'included', 'price', 'offer', 'objections', 'readiness'],
  },
  // The buyer wants to hear how the agent talks to a client: the live chat first, then the road of a request.
  receptionist: {
    demo: 'chat',
    sections: ['hero', 'demo', 'flow', 'channels', 'included', 'price', 'objections', 'offer', 'scope', 'readiness'],
  },
  // The buyer counts their own time: a week of content, the roles inside, approval by one button.
  content: {
    sections: ['hero', 'week', 'roles', 'channels', 'first', 'included', 'price', 'objections', 'offer', 'readiness'],
  },
  // The buyer counts hours of manual work: before and after, the routines that go away.
  automation: {
    sections: ['hero', 'beforeAfter', 'routines', 'channels', 'first', 'scope', 'included', 'price', 'offer', 'objections', 'readiness'],
  },
  // The buyer doubts customers will order in Telegram: screens, the buyer's path, open data about the audience.
  miniapp: {
    sections: ['hero', 'phones', 'facts', 'capabilities', 'included', 'price', 'offer', 'objections', 'readiness'],
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
  myday?: {
    title: string
    sub: string
    pick: string
    prev: string
    next: string
    personas: { id: string; name: string; who: string; moments: { time: string; label: string; ai: string; you: string; done: string }[] }[]
  }
  memory?: { title: string; sub: string; groups: { name: string; items: { fact: string; use: string }[] }[]; control: string }
  lives?: { title: string; sub: string; items: { title: string; text: string }[] }
  setup?: { title: string; sub: string; steps: { when: string; title: string; text: string }[] }
  cases?: { title: string; sub: string; label: string; items: { name: string; role: string; does: string[]; runs: string }[]; note: string }
  structure?: {
    title: string
    sub: string
    owner: { name: string; does: string }
    director: { name: string; does: string }
    depts: { name: string; roles: string[]; example: string }[]
    note: string
  }
  pult?: { title: string; sub: string; label: string; tabs: { id: string; name: string; caption: string; rows: { who: string; what: string; state: string }[] }[]; note: string }
  knowledge?: { title: string; sub: string; sources: { name: string; text: string }[]; ask: string; answer: string; source: string }
  trust?: { title: string; sub: string; levels: { name: string; text: string; example: string }[]; note: string }
  teamgets?: { title: string; sub: string; items: { title: string; text: string }[] }
  rollout?: { title: string; sub: string; stages: { title: string; text: string; see: string }[] }
  pilot?: { title: string; text: string; terms: string[]; cta: string }
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
  myday: 'myday',
  memory: 'memory',
  lives: 'lives',
  setup: 'setup',
  cases: 'cases',
  structure: 'structure',
  pult: 'pult',
  knowledge: 'knowledge',
  trust: 'trust',
  teamgets: 'teamgets',
  rollout: 'rollout',
  pilot: 'pilot',
}
