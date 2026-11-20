import { defaultPricing, formatUsd, type Pricing } from './pricing'
import type { ServiceSlug } from './site'

// Service-page meta texts carry a `{price}` token; the number comes from pricing.ts, never typed.
export function fillServicePrice(text: string, slug: ServiceSlug, pricing: Pricing = defaultPricing) {
  return text.replaceAll('{price}', formatUsd(pricing.startingPrice[slug]))
}

// The lowest starting price across the services: for the share card and structured data.
export const lowestPriceOf = (pricing: Pricing = defaultPricing) =>
  Math.min(...Object.values(pricing.startingPrice))
export const highestStartingPriceOf = (pricing: Pricing = defaultPricing) =>
  Math.max(...Object.values(pricing.startingPrice))
// Defaults, for tests only.
export const lowestPrice = lowestPriceOf()
export const highestStartingPrice = highestStartingPriceOf()
