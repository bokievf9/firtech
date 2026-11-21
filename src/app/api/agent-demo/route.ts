import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { agentDemoLimited, agentDemoSchema, askDemoAgent } from '@/lib/agent-demo'
import { checkPublicPost, visitorIp } from '@/lib/public-post'

// The demo persona of a niche for the project builder's preview. Same-origin proxy to HQ's public
// `POST /agent/demo-<niche>/chat`; never creates a lead, never stores text.
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rejected = checkPublicPost(request)
  if (rejected) return NextResponse.json({ ok: false, error: rejected.error }, { status: rejected.status })
  const ip = visitorIp(request.headers)
  if (agentDemoLimited(ip)) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  const parsed = agentDemoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  const answer = await askDemoAgent(parsed.data, process.env, fetch, ip)
  return NextResponse.json(answer, {
    status: answer.ok ? 200 : answer.error === 'rate_limited' ? 429 : 502,
    headers: { 'cache-control': 'no-store' },
  })
}
