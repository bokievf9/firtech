// Client-safe part of the product list (no builder or pricing imports), for the hero and the 404.
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

// The product's own page, `/<locale>` + this.
export const productPath = (id: ProductId) => `/products/${id}`

// Anchor of a product card on the home page (footer and hero link here).
export const productAnchor = (id: ProductId) => `product-${id}`
