import { bundleDiscount, catalog, extraPrice, formatUsd } from '../../lib/pricing'

// Prices quoted in articles, read from pricing.ts so the copy always matches the site.
const usd = (value: number | null | undefined) => formatUsd(value ?? 0)
const sum = (...values: (number | null | undefined)[]) =>
  formatUsd(values.reduce<number>((total, value) => total + (value ?? 0), 0))

const w = catalog.websites
const b = catalog.bots
const a = catalog.automation

export const price = {
  landing: usd(w.variants.landing),
  company: usd(w.variants.company),
  shop: usd(w.variants.shop),
  language: usd(w.addons.language),
  siteTelegram: usd(w.addons.telegram),
  sitePayments: usd(w.addons.payments),
  cms: usd(w.addons.cms),
  // Example from the cost article: a landing page in two languages with leads sent to Telegram.
  landingTwoLangTelegram: sum(w.variants.landing, w.addons.language, w.addons.telegram),
  botFaq: usd(b.variants.faq),
  botBooking: usd(b.variants.booking),
  miniApp: usd(b.variants.miniapp),
  broadcasts: usd(b.addons.broadcasts),
  botFaqAi: sum(b.variants.faq, b.addons.ai),
  integration: usd(a.variants.integration),
  crm: usd(a.variants.crm),
  alerts: usd(a.addons.alerts),
  support: usd(extraPrice.support.from),
  bundle: `${Math.round(bundleDiscount * 100)}%`,
}
