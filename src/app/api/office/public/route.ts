import 'server-only'
import { publicOffice } from '@/lib/office-public-hq'

// Public live office for the home page hero: statuses and counts only, never task titles,
// activity or costs (shape: PublicOffice in src/lib/office-public.ts). No session needed; the HQ
// token stays on the server. Cached 15 s in memory (office-public-hq.ts); falls back to the demo
// company (demo: true) when HQ is unavailable, so the answer is always 200.
export const dynamic = 'force-dynamic'

export async function GET() {
  const body = await publicOffice.get()
  return Response.json(body, {
    headers: { 'cache-control': 'public, max-age=5, stale-while-revalidate=10' },
  })
}
