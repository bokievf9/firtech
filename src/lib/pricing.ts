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

// Plan ids: the personal AI levels, the AI company, the content subscription and the retired agent plans
// (Dono and Polly are the founder's live cases since 2026-11-22, no longer sold; HQ still reads them).
export const personalLevels = ['basic', 'plus', 'max'] as const
export type PersonalLevel = (typeof personalLevels)[number]
export type PlanId = PersonalLevel | 'company' | 'content' | 'dono' | 'polly'
// `byokMonthly` (owner 2026-11-22): every AI product is a subscription, one-time setup plus a monthly fee that
// includes the model usage (we connect our own Anthropic account). With «свой API-ключ» (BYOK) the client brings
// the key and the monthly fee is lower. Only the AI products carry it.
export type Plan = { id: PlanId; setup: number; monthly: number; byokMonthly?: number }
export type PlanAmounts = { setup: number; monthly: number }
export type Subscription = { setup: number; monthly: number; byokMonthly: number }

// `company` (2026-11-22): the AI company, four stages like an app. Templates are only ever appended.
export const stageTemplateIds = ['site', 'bot', 'automation', 'app', 'small', 'company'] as const
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
    { id: 'build', title: { ru: 'Рабочий агент на тесте', en: 'Working agent on a test' } },
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
  company: [
    { id: 'map', title: { ru: 'Знакомство: бизнес, данные и правила', en: 'Getting to know the business, data and rules' } },
    { id: 'depts', title: { ru: 'Первые навыки на ваших задачах', en: 'First skills on your tasks' } },
    { id: 'pult', title: { ru: 'База знаний, Пульт и каналы', en: 'Knowledge base, control room and channels' } },
    { id: 'launch', title: { ru: 'Обучение команды и запуск', en: 'Team training and launch' } },
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
  // Flagships (owner 2026-11-22): «Персональный ИИ» in three levels (connected services and memory) and
  // «ИИ-компания» (a starting setup and monthly, the exact sum by the quote).
  personalPlans: Record<PersonalLevel, Subscription>
  companyPlan: Record<'company', Subscription>
  // One AI agent (any role) as a subscription, and the rest of the subscription model (2026-11-22): a team is the sum
  // of its agents minus `teamDiscount` percent; the AI company adds `companyPerEmployee` a month for every employee
  // above `companyIncludedStaff` (a fact of the offer, not a price).
  agentSubscription: Subscription
  // The two optional one-time add-ons of the «one agent» builder path (owner 2026-11-24: cheaper than the
  // automation add-ons): importing the client's knowledge, and training the team.
  agentAddons: { knowledge: number; training: number }
  teamDiscount: number
  companyPerEmployee: number
  // DEPRECATED 2026-11-22: Dono and Polly are not sold any more (no link from the site). Kept because HQ's
  // price schema still requires `agentPlans.dono|polly` in GET /api/prices; drop it after HQ stops reading it.
  agentPlans: Record<'dono' | 'polly', PlanAmounts>
  contentPlans: Record<'content', PlanAmounts>
  // Share, 0 to 50 percent, off the one-time total when a build has two or more parts.
  bundleDiscount: number
  referralPercent: number
  // Coupon for opening a cabinet (owner 2026-11-24): percent off the ONE-TIME part of the first order, 0 to 50.
  cabinetCouponPercent: number
  // The guarantee of the first stage in numbers (owner 2026-11-25): launch within `launchDays` working days after
  // the first-stage payment; in the first `pilotDays` days the agent answers `replyShare` percent of requests
  // within `replyMinutes` minutes, otherwise the first stage is refunded. Copy: `guaranteeLine` (lib/guarantee.ts).
  guarantee: { launchDays: number; pilotDays: number; replyShare: number; replyMinutes: number }
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
  // Flagships (owner decision 2026-11-22): Personal AI from $290 setup + $29 a month; the two upper
  // levels are the builder's proposal pending the owner's word (editable in the Пульт). The AI company
  // starts at $1,490 setup + $149 a month, the exact sum is set by the quote.
  personalPlans: {
    basic: { setup: 290, monthly: 29, byokMonthly: 14 },
    plus: { setup: 490, monthly: 59, byokMonthly: 34 },
    max: { setup: 790, monthly: 99, byokMonthly: 59 },
  },
  // Subscription defaults (owner 2026-11-22, editable in the Пульт): one agent from $220 + $39 a month ($19 with the
  // client's own key); a team is its agents' sum minus 15%; the AI company $1,490 + $149 a month and $9 for every
  // employee above five, the own-key monthly is about 30% lower.
  companyPlan: { company: { setup: 1490, monthly: 149, byokMonthly: 104 } },
  agentSubscription: { setup: 220, monthly: 39, byokMonthly: 19 },
  agentAddons: { knowledge: 20, training: 20 },
  teamDiscount: 15,
  companyPerEmployee: 9,
  // Personal agents (owner decision 2026-11-19, retired from sale 2026-11-22): Dono, a study assistant, and Polly, a language
  // teacher. Content on autopilot: setup of the channels and the plan, then posts every month.
  agentPlans: { dono: { setup: 150, monthly: 15 }, polly: { setup: 100, monthly: 10 } },
  contentPlans: { content: { setup: 90, monthly: 60 } },
  // Owner decision (2026-10-16): 10% off the one-time total when a build has two or more parts.
  bundleDiscount: 10,
  // Referral reward (owner decision 2026-11-19): this percent of the referred client's estimate, paid
  // once after the client's first payment. Copy carries the `{percent}` token, never the number.
  referralPercent: 10,
  cabinetCouponPercent: 10,
  guarantee: { launchDays: 3, pilotDays: 14, replyShare: 95, replyMinutes: 1 },
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
    // The AI company is paid like an app, four equal stages (owner 2026-11-22).
    company: { map: 25, depts: 25, pult: 25, launch: 25 },
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

export function personalPlanList(pricing: Pricing = defaultPricing): Plan[] {
  return personalLevels.map((id) => ({ id, ...pricing.personalPlans[id] }))
}

export function companyPlanOf(pricing: Pricing = defaultPricing): Plan {
  return { id: 'company', ...pricing.companyPlan.company }
}

// Employees the AI company's monthly fee covers; every one above costs `companyPerEmployee` a month more.
export const companyStaffIncluded = 5

// The AI company's monthly fee for a staff size, with Fira on our key or on the client's own key (BYOK). The extra
// per employee shrinks in the same proportion as the plan's own-key monthly.
export function companyMonthly(staff: number, byok: boolean, pricing: Pricing = defaultPricing): number {
  const plan = pricing.companyPlan.company
  const extra = Math.max(0, Math.floor(staff) - companyStaffIncluded) * pricing.companyPerEmployee
  if (!byok) return plan.monthly + extra
  return plan.byokMonthly + Math.round(plan.monthly > 0 ? (extra * plan.byokMonthly) / plan.monthly : extra)
}

// One agent: setup, monthly and own-key monthly.
export function agentSubscriptionOf(pricing: Pricing = defaultPricing): Subscription {
  return { ...pricing.agentSubscription }
}

// A team of `count` agents: the sum of its agents minus the team discount (rounded to whole dollars). `full` is the
// sum before the discount, to show what the discount saves.
export type TeamSubscription = Subscription & { count: number; discountPercent: number; full: Subscription }
export function teamSubscription(count: number, pricing: Pricing = defaultPricing): TeamSubscription {
  const a = pricing.agentSubscription
  const full: Subscription = { setup: a.setup * count, monthly: a.monthly * count, byokMonthly: a.byokMonthly * count }
  const k = 1 - pricing.teamDiscount / 100
  return {
    setup: Math.round(full.setup * k),
    monthly: Math.round(full.monthly * k),
    byokMonthly: Math.round(full.byokMonthly * k),
    count,
    discountPercent: pricing.teamDiscount,
    full,
  }
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
export const personalPlans = personalPlanList(defaultPricing)
export const companyPlan = companyPlanOf(defaultPricing)
export const agentSubscription = agentSubscriptionOf(defaultPricing)
export const bundleDiscount = defaultPricing.bundleDiscount / 100
export const referralPercent = defaultPricing.referralPercent
export const smallProjectMaxUsd = defaultPricing.smallProjectMaxUsd
export const paymentStages: Record<StageTemplateId, readonly StageDef[]> = Object.fromEntries(
  stageTemplateIds.map((id) => [id, stageDefs(id, defaultPricing)]),
) as unknown as Record<StageTemplateId, readonly StageDef[]>

// Honest start (builder v6 wave 2): working days between the first stage being paid and the start of
// work. A constant for now; an HQ-driven value is a later wave. Rendered as «старт через N рабочих дня».
export const START_IN_DAYS = 3
