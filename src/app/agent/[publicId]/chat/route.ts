import { NextResponse } from 'next/server'

// DEVELOPMENT STAND-IN of HQ's public `POST /agent/:publicId/chat` (demo mode): in production nginx proxies `/agent/` to
// HQ, so this route is never reached there (it answers 404). It lets the demo page and the e2e suite run without HQ:
// the demo key is `demo-key-0001`, the demo answers five messages per page load of the server, then `limit_reached`.
export const dynamic = 'force-dynamic'
const LIMIT = 5
const used = new Map<string, number>()

export async function POST(request: Request, ctx: RouteContext<'/agent/[publicId]/chat'>) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const { publicId } = await ctx.params
  const body = (await request.json().catch(() => null)) as { demoKey?: unknown; text?: unknown; conversationId?: unknown } | null
  if (!body || typeof body.text !== 'string' || !body.text.trim()) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  if (body.demoKey !== 'demo-key-0001') return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const n = used.get(publicId) ?? 0
  if (n >= LIMIT) return NextResponse.json({ ok: false, error: 'limit_reached' }, { status: 429 })
  used.set(publicId, n + 1)
  return NextResponse.json({
    ok: true,
    reply: `Демо-ответ агента: «${body.text.slice(0, 80)}». Здесь будет ответ по вашим данным.`,
    conversationId: typeof body.conversationId === 'string' ? body.conversationId : 'w-demo0000',
    mode: 'demo',
    usedTools: [],
    limit: LIMIT,
    remaining: LIMIT - n - 1,
  })
}
