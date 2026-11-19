import { productCatalog, type ProductId as CatalogProductId } from '../content/builder-catalog'
import { emptyBuild, encodeBuild, productParts, quote, toggleProduct, type Build } from './builder'
import { agentPlans, contentPlans, type Plan } from './pricing'

export { isProductId, productAnchor, productIds, type ProductId } from './product-ids'
import { productIds, type ProductId } from './product-ids'

export { agentPlans, contentPlans }
export type AgentPlanId = (typeof agentPlans)[number]['id']

export type ProductPrice =
  // A starting price taken from pricing.ts (the calculator's own numbers).
  | { kind: 'from'; from: number }
  // Setup plus a subscription per plan.
  | { kind: 'plans'; plans: readonly Plan[] }
  // No price in pricing.ts yet: the card says «по смете». The owner sets these.
  | { kind: 'quote' }

// Each home product is a product of the builder catalogue (src/content/builder-catalog.ts).
export const builderProduct: Record<ProductId, CatalogProductId> = {
  admin: 'adminbot',
  receptionist: 'intake',
  automation: 'automation',
  content: 'content',
  miniapp: 'miniapp',
  agent: 'agent',
  implementation: 'aiteam',
}

// The build the builder opens with: the product picked (`p.<id>` in the link) and its parts.
export function productBuild(id: ProductId): Build {
  return toggleProduct(emptyBuild, builderProduct[id])
}

// Prices only from pricing.ts, the same way the builder counts them: a priced catalogue product
// costs what its parts cost in the calculator (quote()), so the card and the opened builder show
// the same number. Unpriced ones say «по смете»; the personal agent and the content subscription
// show the approved plans (setup + monthly) and stay «по смете» inside the builder.
export const productPrice: Record<ProductId, ProductPrice> = Object.fromEntries(
  productIds.map((id): [ProductId, ProductPrice] => {
    if (id === 'agent') return [id, { kind: 'plans', plans: agentPlans }]
    if (id === 'content') return [id, { kind: 'plans', plans: contentPlans }]
    const entry = productCatalog[builderProduct[id]]
    if (!entry.priced) return [id, { kind: 'quote' }]
    const min = quote({ parts: productParts(builderProduct[id]), extras: [] }).total
    return [id, min > 0 ? { kind: 'from', from: min } : { kind: 'quote' }]
  }),
) as Record<ProductId, ProductPrice>

export function productBuilderHref(locale: string, id: ProductId) {
  return `/${locale}/builder?b=${encodeBuild(productBuild(id))}`
}
