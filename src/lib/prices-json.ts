import { agentPlans, catalog, contentPlans, extraPrice, referralPercent, startingPrice } from './pricing'
import { productIds, productPrice, type ProductPrice } from './products'

// Public machine-readable prices (GET /api/prices): the one source the agents read instead of
// their own copies. Built only from pricing.ts and products.ts; change the date when prices change.
export const PRICES_UPDATED_AT = '2026-11-19'

export function pricesJson() {
  const products = Object.fromEntries(
    productIds.map((id): [string, ProductPrice] => [id, productPrice[id]]),
  )
  return {
    currency: 'USD' as const,
    updatedAt: PRICES_UPDATED_AT,
    startingPrice,
    catalog,
    extraPrice,
    agentPlans,
    contentPlans,
    referralPercent,
    products,
  }
}
