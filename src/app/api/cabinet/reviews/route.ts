import { cabinetCaller, hqFailure, reply } from '@/lib/cabinet-api'
import { postClientReview } from '@/lib/cabinet-hq'
import { buildReviewBody } from '@/lib/cabinet-review'

// POST /api/cabinet/reviews `{ projectId, rating, text }`: the review of a finished project. The client is the
// session's; HQ checks that the project is theirs (404) and that there is no review yet (409 `exists`).
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const who = await cabinetCaller(request, { post: true })
  if (!who.ok) return who.response
  const built = buildReviewBody((await request.json().catch(() => ({}))) as { projectId: unknown; rating: unknown; text: unknown })
  if (!built.ok) return reply({ ok: false, error: 'invalid', field: built.error }, 400)
  const done = await postClientReview(who.clientId, built.body)
  return done.ok ? reply({ ok: true }) : hqFailure(done.error)
}
