import { pricesJson } from '@/lib/prices-json'
import { getPricesUpdatedAt, getPricing } from '@/lib/pricing-store'

// Public prices for the agents (presales, prospector, content): the live prices (pricing.ts defaults
// plus the owner's overrides from the Пульт), so the answer can change without a deploy. HQ reads
// it on its own interval; the cache header keeps it from being fetched more than once a minute.
export const dynamic = 'force-dynamic'

export async function GET() {
  const [pricing, updatedAt] = await Promise.all([getPricing(), getPricesUpdatedAt()])
  return Response.json(pricesJson(pricing, updatedAt), {
    headers: { 'cache-control': 'public, max-age=60' },
  })
}
