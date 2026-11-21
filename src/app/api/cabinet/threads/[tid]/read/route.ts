import { cabinetCaller, hqFailure, reply, safeToken } from '@/lib/cabinet-api'
import { markThreadRead } from '@/lib/cabinet-hq'

// POST /api/cabinet/threads/<tid>/read: the client opened the thread, so HQ marks its messages read.
export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: RouteContext<'/api/cabinet/threads/[tid]/read'>) {
  const { tid } = await ctx.params
  if (!safeToken(tid)) return reply({ ok: false, error: 'invalid' }, 400)
  const who = await cabinetCaller(request, { post: true })
  if (!who.ok) return who.response
  const done = await markThreadRead(who.clientId, tid)
  return done.ok ? reply({ ok: true }) : hqFailure(done.error)
}
