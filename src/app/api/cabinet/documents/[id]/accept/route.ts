import { cabinetCaller, hqFailure, reply, safeToken } from '@/lib/cabinet-api'
import { acceptClientDocument } from '@/lib/cabinet-hq'

// POST /api/cabinet/documents/<id>/accept: «Принять КП». HQ answers 409 `not_awaiting` when the quote is
// not waiting for the client (already accepted); the client is the session's, never the browser's.
export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: RouteContext<'/api/cabinet/documents/[id]/accept'>) {
  const { id } = await ctx.params
  if (!safeToken(id)) return reply({ ok: false, error: 'invalid' }, 400)
  const who = await cabinetCaller(request, { post: true })
  if (!who.ok) return who.response
  const done = await acceptClientDocument(who.clientId, id)
  return done.ok ? reply({ ok: true, next: done.data.next }) : hqFailure(done.error)
}
