import { productCatalog, type ProductId as CatalogProductId } from '../content/builder-catalog'
import { emptyBuild, encodeBuild, productParts, quote, toggleProduct, type Build } from './builder'
import { companyPlanOf, contentPlanList, defaultPricing, personalPlanList, type Plan, type Pricing } from './pricing'

export { flagshipIds, isFlagship, isProductId, productAnchor, productIds, productPath, type ProductId } from './product-ids'
import { productIds, type ProductId } from './product-ids'

export type ProductPrice =
  // A starting price taken from pricing.ts (the builder's own numbers).
  | { kind: 'from'; from: number }
  // Setup plus a subscription per plan. `byQuote`: the plan is a starting price («от»), the exact sum
  // comes from the quote (the AI company).
  | { kind: 'plans'; plans: readonly Plan[]; byQuote?: boolean }
  // No price in pricing.ts yet: the card says «по смете». The owner sets these.
  | { kind: 'quote' }

// Each home product is a product of the builder catalogue (src/content/builder-catalog.ts).
export const builderProduct: Record<ProductId, CatalogProductId> = {
  personal: 'personal',
  company: 'company',
  admin: 'adminbot',
  receptionist: 'intake',
  automation: 'automation',
  content: 'content',
  miniapp: 'miniapp',
  implementation: 'aiteam',
}

// The build the builder opens with: the product picked (`p.<id>` in the link) and its parts.
export function productBuild(id: ProductId): Build {
  return toggleProduct(emptyBuild, builderProduct[id])
}

// Prices only from the live pricing (pricing.ts defaults + the owner's overrides), the same way the
// builder counts them: a priced catalogue product costs what its parts cost in the builder
// (quote()), so the card and the opened builder show the same number. Unpriced ones say «по смете»;
// the flagships and the content subscription show their plans (setup + monthly): Personal AI its three
// levels, the AI company its starting plan with «по смете».
export function productPrices(pricing: Pricing = defaultPricing): Record<ProductId, ProductPrice> {
  return Object.fromEntries(
    productIds.map((id): [ProductId, ProductPrice] => {
      if (id === 'personal') return [id, { kind: 'plans', plans: personalPlanList(pricing) }]
      if (id === 'company') return [id, { kind: 'plans', plans: [companyPlanOf(pricing)], byQuote: true }]
      if (id === 'content') return [id, { kind: 'plans', plans: contentPlanList(pricing) }]
      const entry = productCatalog[builderProduct[id]]
      if (!entry.priced) return [id, { kind: 'quote' }]
      const min = quote({ parts: productParts(builderProduct[id]), extras: [] }, pricing).total
      return [id, min > 0 ? { kind: 'from', from: min } : { kind: 'quote' }]
    }),
  ) as Record<ProductId, ProductPrice>
}

// The default prices, for tests; pages and components use `productPrices(pricing)`.
export const productPrice: Record<ProductId, ProductPrice> = productPrices(defaultPricing)

export function productBuilderHref(locale: string, id: ProductId) {
  return `/${locale}/builder?b=${encodeBuild(productBuild(id))}`
}
