import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { agentChatUrl } from '@/lib/agent-demo'
import { apiError } from '@/lib/api-error'
import { stripHtml } from '@/lib/chat'
import { DEMO_TEXT_MAX, demoKeyOf, isPublicId } from '@/lib/demo-chat'
import { chatTokenHeader, demoFields } from '@/lib/demo-gate'
import { leadGate } from '@/lib/lead-identity'
import { peekLeadUser } from '@/lib/lead-session'
import { checkPublicPost, visitorIp, visitorIpHeader } from '@/lib/public-post'
import { cabinetEnabled } from '@/lib/supabase/config'

// The demo page's chat (`/<locale>/demo/<publicId>?k=`) talks to this same-origin route, not to HQ directly:
// the demo is for signed-in clients only (owner 2026-11-23, item 15), and `clientId` / `clientEmail` must come
// from the session on the server. It forwards `{ demoKey, text, conversationId, clientId, clientEmail, demo: true }` to
// HQ's `POST /agent/<publicId>/chat` and hands HQ's status and body (cleaned) back. The text is never logged.
export const dynamic = 'force-dynamic'

const schema = z.object({
  demoKey: z.string().transform((v) => demoKeyOf(v) ?? '').pipe(z.string().min(1)),
  text: z.string().transform(stripHtml).pipe(z.string().min(1).max(DEMO_TEXT_MAX)),
  conversationId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
})

export async function POST(request: NextRequest, ctx: RouteContext<'/api/demo-agent/[publicId]'>) {
  const rejected = checkPublicPost(request)
  if (rejected) return apiError(rejected.error, rejected.status)
  const { publicId } = await ctx.params
  if (!isPublicId(publicId)) return apiError('invalid', 400)
  const user = cabinetEnabled() ? await peekLeadUser().catch(() => null) : null
  const gate = await leadGate(async () => user)
  if (!gate.ok) return apiError('auth_required', 401)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return apiError('invalid', 400)
  // Development without an HQ address: the site's own stand-in route answers.
  const url = agentChatUrl(process.env, publicId) ?? `${request.nextUrl.origin}/agent/${encodeURIComponent(publicId)}/chat`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...chatTokenHeader(process.env), ...visitorIpHeader(visitorIp(request.headers)) },
      body: JSON.stringify({ ...parsed.data, ...demoFields(gate.identity) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
    const headers = { 'cache-control': 'no-store' }
    if (res.ok && body?.ok === true && typeof body.reply === 'string' && body.reply.trim()) {
      const usage = body.usage && typeof body.usage === 'object' ? (body.usage as Record<string, unknown>) : undefined
      return NextResponse.json(
        {
          ok: true,
          reply: stripHtml(body.reply).slice(0, 2000),
          ...(typeof body.conversationId === 'string' ? { conversationId: body.conversationId.slice(0, 64) } : {}),
          ...(typeof body.limit === 'number' ? { limit: body.limit } : {}),
          ...(typeof body.remaining === 'number' ? { remaining: body.remaining } : {}),
          ...(usage ? { usage: { calls: usage.calls, left: usage.left, limit: usage.limit, used: usage.used, remaining: usage.remaining } } : {}),
        },
        { headers },
      )
    }
    // 401 here is HQ rejecting the demo key (the session gate answered `auth_required` above).
    // Strict mode of HQ (`DEMO_REQUIRE_CLIENT`): no known client; the page takes the visitor to the sign-in.
    if (res.status === 401 && body?.error === 'login_required') return apiError('auth_required', 401)
    if (res.status === 401 || res.status === 403) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers })
    if (res.status === 429) {
      return NextResponse.json({ ok: false, error: body?.error === 'rate_limited' ? 'rate_limited' : 'limit_reached' }, { status: 429, headers })
    }
    if (res.status === 400) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400, headers })
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 502, headers })
  } catch {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
