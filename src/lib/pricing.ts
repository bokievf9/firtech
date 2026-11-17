import type { ExtraSlug, ServiceSlug } from './site'

// Starting prices in USD (owner decision, 2026-10-16: low entry). Names and terms live in the
// dictionaries (src/content), keyed by the same ids, so prices are defined once for both languages.
export const startingPrice: Record<ServiceSlug, number> = {
  websites: 200, // 150 before 2026-11-18; $200 is proposed in the showcase brief, owner to approve
  bots: 100,
  apps: 1000,
  automation: 300,
}

type Catalog = { variants: Record<string, number>; addons: Record<string, number> }

export const catalog: Record<ServiceSlug, Catalog> = {
  websites: {
    variants: { landing: 200, company: 400, shop: 900 },
    addons: { language: 80, telegram: 40, payments: 150, cms: 200 },
  },
  bots: {
    variants: { faq: 100, booking: 300, miniapp: 800 },
    addons: { payments: 120, broadcasts: 80, admin: 200, ai: 250 },
  },
  apps: {
    variants: { pwa: 1000, mobile: 2500, internal: 1500 },
    addons: { accounts: 300, payments: 200, push: 150, admin: 400 },
  },
  automation: {
    variants: { integration: 300, crm: 600, assistant: 800 },
    addons: { sheets: 100, alerts: 60, training: 100, support: 200 },
  },
}

// Extras that are a part of a main service take its existing price and link to its page. The rest
// are the owner's prices (2026-10-16). `null` would show "priced after a call"; `monthly` adds
// "per month".
export const extraPrice: Record<
  ExtraSlug,
  { from: number | null; page?: ServiceSlug; monthly?: boolean }
> = {
  ai: { from: catalog.automation.variants.assistant ?? null, page: 'automation' },
  support: { from: 30, monthly: true },
  payments: { from: catalog.bots.addons.payments ?? null, page: 'bots' },
  seo: { from: 80 },
  crm: { from: catalog.automation.variants.crm ?? null, page: 'automation' },
  design: { from: 150 },
  rescue: { from: 100 },
  internal: { from: catalog.apps.variants.internal ?? null, page: 'apps' },
}

// Owner decision (2026-10-16): 10% off the one-time total when a build has two or more parts.
export const bundleDiscount = 0.1

// The estimate is a range: the base sum is the floor, complex details add up to 40% on top.
export function estimate(service: ServiceSlug, variant: string, addons: string[]) {
  const prices = catalog[service]
  const base =
    (prices.variants[variant] ?? 0) + addons.reduce((sum, id) => sum + (prices.addons[id] ?? 0), 0)
  return { min: base, max: Math.round((base * 1.4) / 10) * 10 }
}

export function formatUsd(value: number) {
  return `$${value.toLocaleString('en-US')}`
}
