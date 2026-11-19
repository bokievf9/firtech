import { pricesJson } from '@/lib/prices-json'

// Public prices for the agents (presales, prospector, content): numbers from pricing.ts and
// products.ts, no dynamic input, so the answer is static for each build.
export const dynamic = 'force-static'

export function GET() {
  return Response.json(pricesJson(), { headers: { 'cache-control': 'public, max-age=600' } })
}
