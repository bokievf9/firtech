import type { ExtraSlug, ServiceSlug } from './site'

// Starting prices in USD. Owner decision 2026-11-19: everything below the freelance market of
// RU/CIS (Kwork, FL.ru, Workspace), extras cut by about half. Names and terms live in the
// dictionaries (src/content), keyed by the same ids, so prices are defined once for both languages.
//
// Owner decision 2026-11-21: every price is editable in the Пульт (Компания, «Цены»). The numbers
// below are only the DEFAULTS (`defaultPricing`); the live set is `getPricing()` (pricing-store.ts,
// server) = defaults + the overrides in $DATA_DIR/prices.json. Pure helpers take a `Pricing`
// argument (default = `defaultPricing`, for tests); client components read it from `usePricing()`.

type Catalog = { variants: Record<string, number>; addons: Record<string, number> }

export type Plan = { id: 'dono' | 'polly' | 'content'; setup: number; monthly: number }
export type PlanAmounts = { setup: number; monthly: number }

export const stageTemplateIds = ['site', 'bot', 'automation', 'app', 'small'] as const
export type StageTemplateId = (typeof stageTemplateIds)[number]

export type StageDef = { id: string; title: { ru: string; en: string }; share: number }

// Stage titles are fixed copy; only the shares are prices (`Pricing.stageShares`).
const stageTitles: Record<StageTemplateId, { id: string; title: { ru: string; en: string } }[]> = {
  site: [
    { id: 'structure', title: { ru: 'Структура и первый экран', en: 'Structure and first screen' } },
    { id: 'pages', title: { ru: 'Все страницы и наполнение', en: 'All pages and content' } },
    { id: 'launch', title: { ru: 'Запуск, SEO, передача', en: 'Launch, SEO, handover' } },
  ],
  bot: [
    { id: 'scenario', title: { ru: 'Сценарий и структура', en: 'Scenario and structure' } },
    { id: 'build', title: { ru: 'Рабочий бот на тесте', en: 'Working bot on a test' } },
    { id: 'launch', title: { ru: 'Запуск и обучение', en: 'Launch and training' } },
  ],
  automation: [
    { id: 'map', title: { ru: 'Карта процессов', en: 'Process map' } },
    { id: 'integrate', title: { ru: 'Интеграции', en: 'Integrations' } },
    { id: 'launch', title: { ru: 'Запуск и обучение', en: 'Launch and training' } },
  ],
  app: [
    { id: 'design', title: { ru: 'Дизайн и прототип', en: 'Design and prototype' } },
    { id: 'core', title: { ru: 'Основной функционал', en: 'Core features' } },
    { id: 'full', title: { ru: 'Все экраны и тесты', en: 'All screens and tests' } },
    { id: 'launch', title: { ru: 'Публикация и передача', en: 'Publishing and handover' } },
  ],
  small: [
    { id: 'start', title: { ru: 'Старт', en: 'Start' } },
    { id: 'launch', title: { ru: 'Запуск', en: 'Launch' } },
  ],
}

export const stageIds: Record<StageTemplateId, string[]> = Object.fromEntries(
  stageTemplateIds.map((id) => [id, stageTitles[id].map((s) => s.id)]),
) as Record<StageTemplateId, string[]>

// Every price of the site in one typed object. Extras that are a part of a main service (ai, payments,
// crm, internal) take that service's price (see `extraPrices`); the rest are `extras`.
export type Pricing = {
  startingPrice: Record<ServiceSlug, number>
  catalog: Record<ServiceSlug, Catalog>
  extras: { support: number; seo: number; design: number; rescue: number }
  agentPlans: Record<'dono' | 'polly', PlanAmounts>
  contentPlans: Record<'content', PlanAmounts>
  // Share, 0 to 50 percent, off the one-time total when a build has two or more parts.
  bundleDiscount: number
  referralPercent: number
  smallProjectMaxUsd: number
  // Percent of the one-time total per stage, by template and stage id. Shares of a template sum to 100.
  stageShares: Record<StageTemplateId, Record<string, number>>
}

export const defaultPricing: Pricing = {
  startingPrice: { websites: 150, bots: 100, apps: 800, automation: 200 },
  catalog: {
    websites: {
      variants: { landing: 150, company: 350, shop: 700 },
      addons: { language: 40, telegram: 20, payments: 60, cms: 100 },
    },
    bots: {
      variants: { faq: 100, booking: 250, miniapp: 600 },
      addons: { payments: 60, broadcasts: 40, admin: 100, ai: 120 },
    },
    apps: {
      variants: { pwa: 800, mobile: 2000, internal: 1200 },
      addons: { accounts: 150, payments: 100, push: 60, admin: 200 },
    },
    automation: {
      variants: { integration: 200, crm: 450, assistant: 500 },
      addons: { sheets: 50, alerts: 30, training: 50, support: 90 },
    },
  },
  extras: { support: 20, seo: 50, design: 90, rescue: 60 },
  // Personal agents (owner decision 2026-11-19): Dono, a study assistant, and Polly, a language
  // teacher. Content on autopilot: setup of the channels and the plan, then posts every month.
  agentPlans: { dono: { setup: 150, monthly: 15 }, polly: { setup: 100, monthly: 10 } },
  contentPlans: { content: { setup: 90, monthly: 60 } },
  // Owner decision (2026-10-16): 10% off the one-time total when a build has two or more parts.
  bundleDiscount: 10,
  // Referral reward (owner decision 2026-11-19): this percent of the referred client's estimate, paid
  // once after the client's first payment. Copy carries the `{percent}` token, never the number.
  referralPercent: 10,
  // Payment by stages (owner decision 2026-11-21, replaces 50/50): the one-time price is split into
  // stages by the share below; the client pays each stage BEFORE it starts and the last one before
  // handover. A project whose one-time total is under `smallProjectMaxUsd` has two stages 50/50
  // (`small`); from that amount up the product's template applies. Copy never types these numbers:
  // tables are computed by `stagesFor` (src/lib/payment-stages.ts).
  smallProjectMaxUsd: 300,
  stageShares: {
    site: { structure: 30, pages: 40, launch: 30 },
    bot: { scenario: 30, build: 40, launch: 30 },
    automation: { map: 20, integrate: 50, launch: 30 },
    app: { design: 25, core: 25, full: 25, launch: 25 },
    small: { start: 50, launch: 50 },
  },
}

// Stage definitions (titles + shares) of a template under a pricing.
export function stageDefs(template: StageTemplateId, pricing: Pricing = defaultPricing): StageDef[] {
  return stageTitles[template].map((s) => ({
    id: s.id,
    title: s.title,
    share: pricing.stageShares[template][s.id] ?? 0,
  }))
}

// Extras with a price: the linked ones take their main service's price and link to its page.
// `null` would show "priced after a call"; `monthly` adds "per month".
export type ExtraPrice = { from: number | null; page?: ServiceSlug; monthly?: boolean }

export function extraPrices(pricing: Pricing = defaultPricing): Record<ExtraSlug, ExtraPrice> {
  return {
    ai: { from: pricing.catalog.automation.variants.assistant ?? null, page: 'automation' },
    support: { from: pricing.extras.support, monthly: true },
    payments: { from: pricing.catalog.bots.addons.payments ?? null, page: 'bots' },
    seo: { from: pricing.extras.seo },
    crm: { from: pricing.catalog.automation.variants.crm ?? null, page: 'automation' },
    design: { from: pricing.extras.design },
    rescue: { from: pricing.extras.rescue },
    internal: { from: pricing.catalog.apps.variants.internal ?? null, page: 'apps' },
  }
}

export function agentPlanList(pricing: Pricing = defaultPricing): Plan[] {
  return (['dono', 'polly'] as const).map((id) => ({ id, ...pricing.agentPlans[id] }))
}

export function contentPlanList(pricing: Pricing = defaultPricing): Plan[] {
  return [{ id: 'content', ...pricing.contentPlans.content }]
}

// The bundle discount as a fraction (stored as a percent).
export const bundleFraction = (pricing: Pricing = defaultPricing) => pricing.bundleDiscount / 100

// The price is exact (owner decision 2026-11-19): the variant plus its add-ons, no range.
// Domain, hosting and paid third-party services are never included (see `builder.scope`).
export function estimate(
  service: ServiceSlug,
  variant: string,
  addons: string[],
  pricing: Pricing = defaultPricing,
) {
  const prices = pricing.catalog[service]
  return (
    (prices.variants[variant] ?? 0) + addons.reduce((sum, id) => sum + (prices.addons[id] ?? 0), 0)
  )
}

export function formatUsd(value: number) {
  return `$${value.toLocaleString('en-US')}`
}

// Defaults as named constants: for the tests, the docs and the price file's defaults only. Never
// compute with them in a component or a page (tests/pricing-store.test.mjs greps for it); read the
// live `Pricing` instead.
export const startingPrice = defaultPricing.startingPrice
export const catalog = defaultPricing.catalog
export const extraPrice = extraPrices(defaultPricing)
export const agentPlans = agentPlanList(defaultPricing)
export const contentPlans = contentPlanList(defaultPricing)
export const bundleDiscount = defaultPricing.bundleDiscount / 100
export const referralPercent = defaultPricing.referralPercent
export const smallProjectMaxUsd = defaultPricing.smallProjectMaxUsd
export const paymentStages: Record<StageTemplateId, readonly StageDef[]> = Object.fromEntries(
  stageTemplateIds.map((id) => [id, stageDefs(id, defaultPricing)]),
) as unknown as Record<StageTemplateId, readonly StageDef[]>
