import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPublicPost, visitorIp } from '@/lib/public-post'
import { createLimiter } from '@/lib/chat-hq'

// POST /api/cabinet/auth-log { where, code, status? }: browser-side auth failures (Google start,
// the callback retry) land in the server log as short codes. Same-origin JSON, 20 per IP a minute.
export const dynamic = 'force-dynamic'

const schema = z.object({
  where: z.string().regex(/^[a-z_-]{1,40}$/i),
  code: z.string().regex(/^[A-Za-z0-9_]{1,60}$/),
  status: z.number().int().min(0).max(999).optional(),
})
const limited = createLimiter(20, 60_000)

export async function POST(request: Request) {
  const bad = checkPublicPost(request)
  if (bad) return NextResponse.json({ ok: false, error: bad.error }, { status: bad.status })
  if (limited(visitorIp(request.headers))) return NextResponse.json({ ok: false }, { status: 429 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  console.warn('[cabinet] browser auth error', parsed.data)
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
}
