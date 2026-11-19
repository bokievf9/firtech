import { formatUsd, startingPrice } from './pricing'
import type { ServiceSlug } from './site'

// Service-page meta texts carry a `{price}` token; the number comes from pricing.ts, never typed.
export function fillServicePrice(text: string, slug: ServiceSlug) {
  return text.replaceAll('{price}', formatUsd(startingPrice[slug]))
}

// The lowest starting price across the services: for the share card and structured data.
export const lowestPrice = Math.min(...Object.values(startingPrice))
export const highestStartingPrice = Math.max(...Object.values(startingPrice))
