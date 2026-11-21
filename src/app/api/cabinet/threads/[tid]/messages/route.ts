import { cabinetCaller, hqFailure, reply, safeToken } from '@/lib/cabinet-api'
import { cleanMessage } from '@/lib/cabinet-chat'
import { fetchThreadMessages, postThreadMessage } from '@/lib/cabinet-hq'

// GET /api/cabinet/threads/<tid>/messages?after=<id>: messages of one thread (newer than `after`).
// POST { text }: the client writes. The thread belongs to the session's client: HQ answers 404 for a
// foreign one. Attachments of a message come as site proxy links (`/api/cabinet/media`).
export const dynamic = 'force-dynamic'

export async function GET(request: Request, ctx: RouteContext<'/api/cabinet/threads/[tid]/messages'>) {
  const { tid } = await ctx.params
  if (!safeToken(tid)) return reply({ ok: false, error: 'invalid' }, 400)
  const who = await cabinetCaller(request)
  if (!who.ok) return who.response
  const after = new URL(request.url).searchParams.get('after')
  // HQ's `after` is a whole number (a message id inside the thread); anything else is dropped.
  const rows = await fetchThreadMessages(who.clientId, tid, after && /^\d{1,12}$/.test(after) ? after : null)
  if (!rows.ok) return hqFailure(rows.error)
  return reply({ ok: true, messages: rows.data })
}

export async function POST(request: Request, ctx: RouteContext<'/api/cabinet/threads/[tid]/messages'>) {
  const { tid } = await ctx.params
  if (!safeToken(tid)) return reply({ ok: false, error: 'invalid' }, 400)
  const who = await cabinetCaller(request, { post: true })
  if (!who.ok) return who.response
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const text = typeof body?.text === 'string' ? cleanMessage(body.text) : ''
  if (!text) return reply({ ok: false, error: 'invalid' }, 400)
  const sent = await postThreadMessage(who.clientId, tid, text)
  if (!sent.ok) return hqFailure(sent.error)
  return reply({ ok: true, item: sent.data.item, reply: sent.data.reply })
}
