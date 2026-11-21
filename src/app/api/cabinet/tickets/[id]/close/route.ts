import { cabinetCaller, hqFailure, reply } from '@/lib/cabinet-api'
import { closeClientTicket } from '@/lib/cabinet-hq'

// POST /api/cabinet/tickets/<id>/close: «Вопрос решён». The client is the session's, never the browser's; HQ answers
// 404 for a foreign or missing ticket and is idempotent.
export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: RouteContext<'/api/cabinet/tickets/[id]/close'>) {
  const { id } = await ctx.params
  const ticketId = /^[0-9]{1,9}$/.test(id) ? Number(id) : 0
  if (!ticketId) return reply({ ok: false, error: 'invalid' }, 400)
  const who = await cabinetCaller(request, { post: true })
  if (!who.ok) return who.response
  const done = await closeClientTicket(who.clientId, ticketId)
  return done.ok ? reply({ ok: true, status: 'closed' }) : hqFailure(done.error)
}
