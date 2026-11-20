import type { ExtraSlug, ServiceSlug } from './site'

// Starting prices in USD. Owner decision 2026-11-19: everything below the freelance market of
// RU/CIS (Kwork, FL.ru, Workspace), extras cut by about half. Names and terms live in the
// dictionaries (src/content), keyed by the same ids, so prices are defined once for both languages.
export const startingPrice: Record<ServiceSlug, number> = {
  websites: 150,
  bots: 100,
  apps: 800,
  automation: 200,
}

type Catalog = { variants: Record<string, number>; addons: Record<string, number> }

export const catalog: Record<ServiceSlug, Catalog> = {
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
}

// Extras that are a part of a main service take its existing price and link to its page. The rest
// are the owner's prices (2026-11-19). `null` would show "priced after a call"; `monthly` adds
// "per month".
export const extraPrice: Record<
  ExtraSlug,
  { from: number | null; page?: ServiceSlug; monthly?: boolean }
> = {
  ai: { from: catalog.automation.variants.assistant ?? null, page: 'automation' },
  support: { from: 20, monthly: true },
  payments: { from: catalog.bots.addons.payments ?? null, page: 'bots' },
  seo: { from: 50 },
  crm: { from: catalog.automation.variants.crm ?? null, page: 'automation' },
  design: { from: 90 },
  rescue: { from: 60 },
  internal: { from: catalog.apps.variants.internal ?? null, page: 'apps' },
}

// Subscriptions: one-time setup plus a monthly fee, USD. Personal agents (owner decision,
// 2026-11-19): Dono, a study assistant, and Polly, a language teacher. Content on autopilot
// (owner decision 2026-11-19): setup of the channels and the plan, then posts every month.
export const agentPlans = [
  { id: 'dono', setup: 150, monthly: 15 },
  { id: 'polly', setup: 100, monthly: 10 },
] as const

export const contentPlans = [{ id: 'content', setup: 90, monthly: 60 }] as const

export type Plan = (typeof agentPlans)[number] | (typeof contentPlans)[number]

// Owner decision (2026-10-16): 10% off the one-time total when a build has two or more parts.
export const bundleDiscount = 0.1

// The price is exact (owner decision 2026-11-19): the variant plus its add-ons, no range.
// Domain, hosting and paid third-party services are never included (see `builder.scope`).
export function estimate(service: ServiceSlug, variant: string, addons: string[]) {
  const prices = catalog[service]
  return (
    (prices.variants[variant] ?? 0) + addons.reduce((sum, id) => sum + (prices.addons[id] ?? 0), 0)
  )
}

export function formatUsd(value: number) {
  return `$${value.toLocaleString('en-US')}`
}

// Referral reward (owner decision 2026-11-19): this share of the referred client's estimate, paid
// once after the client's first payment. Copy carries the `{percent}` token, never the number.
export const referralPercent = 10

// Payment by stages (owner decision 2026-11-21, replaces 50/50): the one-time price is split into
// stages by the share below; the client pays each stage BEFORE it starts and the last one before
// handover (accesses, launch). Subscriptions stay "setup + monthly in advance". A project whose
// one-time total is under `smallProjectMaxUsd` has two stages 50/50 (`small`); from that amount up
// the product's template applies (mixed bundles: the template of the most expensive part, the
// shares apply to the whole total). Shares of every template sum to 100. Copy never types these
// numbers: tables are computed by `stagesFor` (src/lib/payment-stages.ts).
export const smallProjectMaxUsd = 300

export const stageTemplateIds = ['site', 'bot', 'automation', 'app', 'small'] as const
export type StageTemplateId = (typeof stageTemplateIds)[number]

export type StageDef = { id: string; title: { ru: string; en: string }; share: number }

export const paymentStages: Record<StageTemplateId, readonly StageDef[]> = {
  site: [
    { id: 'structure', title: { ru: 'Структура и первый экран', en: 'Structure and first screen' }, share: 30 },
    { id: 'pages', title: { ru: 'Все страницы и наполнение', en: 'All pages and content' }, share: 40 },
    { id: 'launch', title: { ru: 'Запуск, SEO, передача', en: 'Launch, SEO, handover' }, share: 30 },
  ],
  bot: [
    { id: 'scenario', title: { ru: 'Сценарий и структура', en: 'Scenario and structure' }, share: 30 },
    { id: 'build', title: { ru: 'Рабочий бот на тесте', en: 'Working bot on a test' }, share: 40 },
    { id: 'launch', title: { ru: 'Запуск и обучение', en: 'Launch and training' }, share: 30 },
  ],
  automation: [
    { id: 'map', title: { ru: 'Карта процессов', en: 'Process map' }, share: 20 },
    { id: 'integrate', title: { ru: 'Интеграции', en: 'Integrations' }, share: 50 },
    { id: 'launch', title: { ru: 'Запуск и обучение', en: 'Launch and training' }, share: 30 },
  ],
  app: [
    { id: 'design', title: { ru: 'Дизайн и прототип', en: 'Design and prototype' }, share: 25 },
    { id: 'core', title: { ru: 'Основной функционал', en: 'Core features' }, share: 25 },
    { id: 'full', title: { ru: 'Все экраны и тесты', en: 'All screens and tests' }, share: 25 },
    { id: 'launch', title: { ru: 'Публикация и передача', en: 'Publishing and handover' }, share: 25 },
  ],
  small: [
    { id: 'start', title: { ru: 'Старт', en: 'Start' }, share: 50 },
    { id: 'launch', title: { ru: 'Запуск', en: 'Launch' }, share: 50 },
  ],
}
