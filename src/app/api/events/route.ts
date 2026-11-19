import { NextResponse, type NextRequest } from 'next/server'
import { forwardSiteEvent } from '@/lib/events-hq'
import { checkPublicPost, visitorIp } from '@/lib/public-post'
import { createEventLimiter, sanitizeEvent } from '@/lib/site-events'

// Site events for the пульт's weekly numbers: same-origin JSON only, 120 per IP per minute, only
// known event names; forwarded to HQ POST /events. The answer is always tiny: the page never waits.
export const dynamic = 'force-dynamic'

const limited = createEventLimiter()

export async function POST(request: NextRequest) {
  const rejected = checkPublicPost(request)
  if (rejected) return NextResponse.json({ ok: false, error: rejected.error }, { status: rejected.status })
  const ip = visitorIp(request.headers)
  if (limited(ip)) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  const event = sanitizeEvent(await request.json().catch(() => null))
  if (!event) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  const sent = await forwardSiteEvent(event, ip)
  if (!sent.ok && sent.error !== 'not_configured') console.warn(`[events] not forwarded: ${sent.error}`)
  return NextResponse.json({ ok: true }, { status: 202, headers: { 'cache-control': 'no-store' } })
}
