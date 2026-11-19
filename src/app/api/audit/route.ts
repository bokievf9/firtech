import { NextResponse, type NextRequest } from 'next/server'
import { auditSchema, createAuditLimiter, forwardAudit } from '@/lib/audit'

// Free site audit: validates the form, limits each IP to 5 requests per 10 minutes and forwards to
// HQ (`POST ${LEAD_INTAKE_URL}/audit`, header x-lead-token). The visitor's URL and contact are never
// logged. Development without HQ env answers {ok:true, mock:true}.
export const dynamic = 'force-dynamic'

const limited = createAuditLimiter()

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0] ??
    'local'
  if (limited(ip.trim())) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }
  const parsed = auditSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  // Bots that filled the honeypot get a normal answer, and nothing is sent.
  if (parsed.data.website) return NextResponse.json({ ok: true })

  const { url, contact, name, locale, ref } = parsed.data
  const answer = await forwardAudit({ url, contact, name, locale, ref })
  const { status, ...body } = answer
  if (!answer.ok) console.error(`[audit] not forwarded: ${answer.error}`)
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
