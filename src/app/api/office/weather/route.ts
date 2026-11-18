import 'server-only'
import { weatherSource } from '@/lib/office-weather'

// Weather outside the pixel office (Dushanbe, Open-Meteo, no key). Public and harmless: no
// session, nothing from HQ. One upstream call per 10 minutes; failures answer «clear» with 200.
export const dynamic = 'force-dynamic'

const source = weatherSource()

export async function GET() {
  const body = await source.get()
  return Response.json(body, {
    headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=300' },
  })
}
