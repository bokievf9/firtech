import { encodeBuild, type Build } from './builder'
import { agentPlans, catalog, estimate, extraPrice, startingPrice } from './pricing'

// The seven products from COMPANY.md («Что продаём»): the backbone of the home page (hero
// sequence, bento, footer). Texts live in the dictionaries under `products.items.<id>`; the ids
// match the direction ids (src/lib/directions.ts), so a card's «Обсудить» sends the same lead
// `source`. Order is the owner's: the booking admin bot is the flagship.
export const productIds = [
  'admin',
  'receptionist',
  'automation',
  'content',
  'miniapp',
  'agent',
  'implementation',
] as const
export type ProductId = (typeof productIds)[number]

export function isProductId(value: string): value is ProductId {
  return (productIds as readonly string[]).includes(value)
}

export { agentPlans }
export type AgentPlanId = (typeof agentPlans)[number]['id']

export type ProductPrice =
  // A starting price taken from pricing.ts (the calculator's own numbers).
  | { kind: 'from'; from: number }
  // Setup plus a subscription per plan.
  | { kind: 'plans'; plans: typeof agentPlans }
  // No price in pricing.ts yet: the card says «по смете». The owner sets these.
  | { kind: 'quote' }

const fromOrQuote = (value: number | null | undefined): ProductPrice =>
  typeof value === 'number' && value > 0 ? { kind: 'from', from: value } : { kind: 'quote' }

// Prices only from pricing.ts; never typed in here.
export const productPrice: Record<ProductId, ProductPrice> = {
  // Booking bot = the calculator's «Запись и заказы» bot.
  admin: fromOrQuote(estimate('bots', 'booking', []).min),
  // The receptionist = the «ИИ-ассистент для клиентов» extra (answers in Telegram, Instagram and
  // WhatsApp around the clock and hands the lead over), priced as the automation assistant.
  receptionist: fromOrQuote(extraPrice.ai.from),
  automation: fromOrQuote(startingPrice.automation),
  content: { kind: 'quote' },
  miniapp: fromOrQuote(catalog.bots.variants.miniapp),
  agent: { kind: 'plans', plans: agentPlans },
  implementation: { kind: 'quote' },
}

// The builder's starting set per product, where the product is a calculator item. Products
// without one open the empty builder.
export const productBuild: Partial<Record<ProductId, Build>> = {
  admin: { parts: { bots: { variant: 'booking', addons: [] } }, extras: [] },
  receptionist: { parts: { automation: { variant: 'assistant', addons: [] } }, extras: [] },
  automation: { parts: { automation: { variant: 'integration', addons: [] } }, extras: [] },
  miniapp: { parts: { bots: { variant: 'miniapp', addons: [] } }, extras: [] },
}

export function productBuilderHref(locale: string, id: ProductId) {
  const build = productBuild[id]
  return build ? `/${locale}/builder?b=${encodeBuild(build)}` : `/${locale}/builder`
}

// Anchor of a product card on the home page (footer and hero link here).
export const productAnchor = (id: ProductId) => `product-${id}`
