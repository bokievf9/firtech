import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { agentDemoLimited, agentDemoSchema, askDemoAgent } from '@/lib/agent-demo'
import { apiError } from '@/lib/api-error'
import { checkPublicPost, visitorIp } from '@/lib/public-post'

// The demo persona of a niche for the project builder's preview. Same-origin proxy to HQ's public
// `POST /agent/demo-<niche>/chat`; never creates a lead, never stores text.
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rejected = checkPublicPost(request)
  if (rejected) return apiError(rejected.error, rejected.status)
  const ip = visitorIp(request.headers)
  if (agentDemoLimited(ip)) return apiError('rate_limited', 429)
  const parsed = agentDemoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return apiError('invalid', 400)
  const answer = await askDemoAgent(parsed.data, process.env, fetch, ip)
  if (!answer.ok) {
    console.error(`[agent-demo] not answered: ${answer.error}`)
    return apiError(answer.error, answer.error === 'rate_limited' ? 429 : answer.error === 'hq_timeout' ? 504 : 502)
  }
  return NextResponse.json(answer, { headers: { 'cache-control': 'no-store' } })
}
