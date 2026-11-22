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
  'channels', // «Где живёт»: the channels as equals (data in lib/channels.ts)
  // Flagship blocks (owner 2026-11-22, front v4): Personal AI
  'skills', // «Что умеет»: twelve skill tiles (the builder's `hand` ids), one visual section
  'myday', // «Кто вы»: eight personas, a compact day for the chosen one and the demo (live when signed in, locked when not)
  'plans', // the three levels as subscription cards with the own-key switch
  'start', // how to start: three steps and the builder button
  'questions', // four short questions as expandable chips (answers: `objections`)
  // Flagship blocks: AI company (front v4: the short visual list is brain, cday, cdemo, cplan, start, questions)
  'brain', // «Один мозг компании»: the diagram (sources, Fira, who she answers, roles as skill chips)
  'cday', // «День компании с ИИ»: a compact timeline
  'cdemo', // Ask Fira: locked plate when signed out, the real chat when signed in
  'cplan', // the subscription card with the own-key switch and the per-employee line
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
  // Flagship (front v4, owner 2026-11-22: less text, more visual). The result, where it lives (channels as equals),
  // one section of twelve skills, who you are with your day and the demo, the three levels, how to start, four questions.
  personal: {
    sections: ['hero', 'channels', 'skills', 'myday', 'plans', 'start', 'questions'],
  },
  // Flagship (front v4). Fira installed in the client's company: one brain as a diagram, where it lives, a company day,
  // the demo (locked when signed out), the subscription, how to start, four questions. A call is the first action.
  company: {
    face: 'fira',
    callFirst: true,
    sections: ['hero', 'brain', 'channels', 'cday', 'cdemo', 'cplan', 'start', 'questions'],
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
  skills?: {
    title: string
    sub: string
    groups: { id: string; name: string }[]
    // One line per skill id (`personalHand`); the tile's name and short hint come from the builder's strings.
    examples: Record<string, string>
  }
  myday?: {
    title: string
    sub: string
    pick: string
    dayTitle: string
    demoTitle: string
    hello: string
    // The ids are the builder's `personalWho` ids; names come from the builder's strings.
    personas: { id: string; steps: { time: string; hand: string; text: string }[]; asks: string[] }[]
  }
  brain?: {
    title: string
    sub: string
    sourcesLabel: string
    sources: { id: string; name: string }[]
    centerLine: string
    outputsLabel: string
    outputs: { id: string; name: string; line: string }[]
    rolesLabel: string
    roles: string[]
    more: string
    note: string
  }
  cday?: { title: string; sub: string; items: { time: string; icon: string; role: string; text: string }[] }
  cdemo?: { title: string; sub: string; ask: string; answer: string; source: string; signedIn: string; open: string }
  cplan?: { title: string; sub: string; points: { title: string; text: string }[] }
  plans?: { title: string; sub: string }
  start?: { title: string; steps: { title: string; text: string }[]; cta: string }
  questions?: { title: string }
  heroCta?: { cta: string; ask: string }
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
  skills: 'skills',
  plans: 'plans',
  brain: 'brain',
  cday: 'cday',
  cdemo: 'cdemo',
  cplan: 'cplan',
  start: 'start',
  questions: 'questions',
  structure: 'structure',
  pult: 'pult',
  knowledge: 'knowledge',
  trust: 'trust',
  teamgets: 'teamgets',
  rollout: 'rollout',
  pilot: 'pilot',
}
