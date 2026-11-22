// Client-safe part of the product list (no builder or pricing imports), for the hero and the 404.
// The seven products from COMPANY.md («Что продаём»): the backbone of the home page (hero
// sequence, bento, footer). Texts live in the dictionaries under `products.items.<id>`; the ids
// match the direction ids (src/lib/directions.ts), so a card's «Обсудить» sends the same lead
// `source`. Order is the owner's (2026-11-22): the two flagships first, «Персональный ИИ» and
// «ИИ-компания», then the products by one job each. The old `agent` page redirects to `personal`
// (`legacyProductRedirects`, next.config.ts).
export const productIds = [
  'personal',
  'company',
  'admin',
  'receptionist',
  'automation',
  'content',
  'miniapp',
] as const
export type ProductId = (typeof productIds)[number]

// The two flagships: the most capable and the most expensive products, with the best pages.
export const flagshipIds = ['personal', 'company'] as const satisfies readonly ProductId[]
export const isFlagship = (id: ProductId) => (flagshipIds as readonly string[]).includes(id)

// Old product ids that moved, to the path (without the locale) they redirect to. Owner 2026-11-22: «Персональный
// ИИ-ассистент» became «Персональный ИИ» (`personal`), and «ИИ-отдел под ключ» (`implementation`) was removed: its
// page sends visitors to the AI teams section.
export const legacyProductRedirects: Record<string, string> = { agent: '/products/personal', implementation: '/ai-team' }

export function isProductId(value: string): value is ProductId {
  return (productIds as readonly string[]).includes(value)
}

// The product's own page, `/<locale>` + this.
export const productPath = (id: ProductId) => `/products/${id}`

// Anchor of a product card on the home page (footer and hero link here).
export const productAnchor = (id: ProductId) => `product-${id}`
