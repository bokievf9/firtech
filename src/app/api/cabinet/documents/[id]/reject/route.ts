import { cabinetCaller, hqFailure, reply, safeToken } from '@/lib/cabinet-api'
import { buildRejectPayload } from '@/lib/cabinet-docs'
import { rejectClientDocument } from '@/lib/cabinet-hq'

// POST /api/cabinet/documents/<id>/reject: «Отклонить / обсудить» a quote. Body `{ reason, mode? }`; the client is
// the session's, never the browser's. HQ answers 409 `not_awaiting` when the quote is not waiting any more.
export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: RouteContext<'/api/cabinet/documents/[id]/reject'>) {
  const { id } = await ctx.params
  if (!safeToken(id)) return reply({ ok: false, error: 'invalid' }, 400)
  const who = await cabinetCaller(request, { post: true })
  if (!who.ok) return who.response
  const built = buildRejectPayload(await request.json().catch(() => ({})) as { reason: unknown; mode: unknown })
  if (!built.ok) return reply({ ok: false, error: 'invalid', field: built.error }, 400)
  const done = await rejectClientDocument(who.clientId, id, built.payload)
  return done.ok ? reply({ ok: true, state: done.data.state }) : hqFailure(done.error)
}
