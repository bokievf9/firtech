import { defaultPricing, extraPrices, formatUsd, type Pricing } from '../../lib/pricing'
import type { Article, ArticleContent, Block, ListItem } from './types'

// Prices quoted in articles. The article files write tokens (`{price:landing}`, through `price`);
// the real numbers come from the live pricing (pricing.ts defaults + the owner's overrides in the
// Пульт) when the server renders the article, so the copy always matches the site.
const usd = (value: number | null | undefined) => formatUsd(value ?? 0)
const sum = (...values: (number | null | undefined)[]) =>
  formatUsd(values.reduce<number>((total, value) => total + (value ?? 0), 0))

export function articlePrices(pricing: Pricing = defaultPricing) {
  const w = pricing.catalog.websites
  const b = pricing.catalog.bots
  const a = pricing.catalog.automation
  return {
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
    support: usd(extraPrices(pricing).support.from),
    bundle: `${Math.round(pricing.bundleDiscount)}%`,
  }
}

type PriceKey = keyof ReturnType<typeof articlePrices>

// The tokens the articles write: `price.landing` is `{price:landing}`.
export const price = new Proxy({} as Record<PriceKey, string>, {
  get: (_, key) => `{price:${String(key)}}`,
})

function fillText(text: string, values: Record<string, string>) {
  return text.replace(/\{price:(\w+)\}/g, (whole, key: string) => values[key] ?? whole)
}

function fillItem(item: ListItem, values: Record<string, string>): ListItem {
  return typeof item === 'string'
    ? fillText(item, values)
    : { title: fillText(item.title, values), text: fillText(item.text, values) }
}

function fillBlock(block: Block, values: Record<string, string>): Block {
  switch (block.type) {
    case 'list':
      return { ...block, items: block.items.map((i) => fillItem(i, values)) }
    case 'callout':
      return {
        ...block,
        title: block.title === undefined ? undefined : fillText(block.title, values),
        text: fillText(block.text, values),
      }
    case 'cta':
      return {
        ...block,
        title: block.title === undefined ? undefined : fillText(block.title, values),
        text: block.text === undefined ? undefined : fillText(block.text, values),
      }
    default:
      return { ...block, text: fillText(block.text, values) }
  }
}

function fillContent(content: ArticleContent, values: Record<string, string>): ArticleContent {
  return {
    ...content,
    title: fillText(content.title, values),
    description: fillText(content.description, values),
    blocks: content.blocks.map((b) => fillBlock(b, values)),
  }
}

// An article with every price token replaced by the number of the given pricing.
export function fillArticlePrices(article: Article, pricing: Pricing = defaultPricing): Article {
  const values = articlePrices(pricing)
  return { ...article, ru: fillContent(article.ru, values), en: fillContent(article.en, values) }
}
