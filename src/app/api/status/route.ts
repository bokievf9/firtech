import { NextResponse } from 'next/server'
import { statusSource } from '@/lib/status-hq'

// Public status for the /status page's refresh: HQ's GET /status reduced to known fields, cached
// for 60 s on the server. Never returns HQ's URL, port or any text of its own.
export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await statusSource.get()
  return NextResponse.json(data, { headers: { 'cache-control': 'public, max-age=30' } })
}
