import { NextResponse, type NextRequest } from 'next/server'
import { checkPublicPost, visitorIp } from '@/lib/public-post'
import { auditSchema, createAuditLimiter, forwardAudit } from '@/lib/audit'
import { cabinetLeadPath, leadGate } from '@/lib/lead-identity'
import { currentLeadUser } from '@/lib/lead-session'

// Free site audit: validates the form, limits each IP to 5 requests per 10 minutes and forwards to
// HQ (`POST ${LEAD_INTAKE_URL}/audit`, header x-lead-token). The visitor's URL and contact are never
// logged. Development without HQ env answers {ok:true, mock:true}.
export const dynamic = 'force-dynamic'

const limited = createAuditLimiter()

export async function POST(request: NextRequest) {
  const rejected = checkPublicPost(request)
  if (rejected) return NextResponse.json({ ok: false, error: rejected.error }, { status: rejected.status })
  const ip = visitorIp(request.headers)
  if (limited(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }
  const parsed = auditSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  // Bots that filled the honeypot get a normal answer, and nothing is sent.
  if (parsed.data.website) return NextResponse.json({ ok: true })

  // Audit requests come only from signed-in cabinet accounts (owner 2026-11-20).
  const gate = await leadGate(() => currentLeadUser(parsed.data.locale, ip))
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status })

  const { url, contact, name, locale, ref } = parsed.data
  const answer = await forwardAudit({ url, contact, name: name || gate.identity?.clientName || '', locale, ref }, process.env, fetch, ip, gate.identity)
  const { status, ...body } = answer
  if (!answer.ok) console.error(`[audit] not forwarded: ${answer.error}`)
  const cabinet = answer.ok && gate.identity ? cabinetLeadPath(locale, null) : null
  return NextResponse.json({ ...body, cabinet }, { status, headers: { 'cache-control': 'no-store' } })
}
