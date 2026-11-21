import { cabinetCaller, hqFailure, reply } from '@/lib/cabinet-api'
import { sortThreads, unreadTotal } from '@/lib/cabinet-chat'
import { fetchThreads } from '@/lib/cabinet-hq'

// GET /api/cabinet/threads: the client's message threads (request, project, support, own agent) with
// unread counts, for the thread list and the tab badge (refreshed every 30 s while visible).
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const who = await cabinetCaller(request)
  if (!who.ok) return who.response
  const threads = await fetchThreads(who.clientId)
  if (!threads.ok) return hqFailure(threads.error)
  const list = sortThreads(threads.data)
  return reply({ ok: true, threads: list, unread: unreadTotal(list) })
}
