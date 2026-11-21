// Review of a finished project (agents P-16): the form opens from `?review=<projectId>` (the link of HQ's
// «Как вам работа с Fir Tech?» letter), a rating 1..5 and a text go to HQ `POST /admin/clients/:id/reviews`.
// Pure helpers, so tests cover the rules without a browser.
export const REVIEW_TEXT_MAX = 2000

// `?review=` is a project number; anything else is ignored.
export function reviewProjectId(value: unknown): number | null {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' && /^\d{1,9}$/.test(v) && Number(v) > 0 ? Number(v) : null
}

export type ReviewBody = { projectId: number; rating: number; text: string }

export function buildReviewBody(input: { projectId: unknown; rating: unknown; text: unknown }): { ok: true; body: ReviewBody } | { ok: false; error: 'project' | 'rating' | 'text' } {
  const projectId = typeof input.projectId === 'number' ? input.projectId : Number(input.projectId)
  if (!Number.isInteger(projectId) || projectId < 1) return { ok: false, error: 'project' }
  const rating = typeof input.rating === 'number' ? input.rating : Number(input.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: 'rating' }
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  if (text.length < 1 || text.length > REVIEW_TEXT_MAX) return { ok: false, error: 'text' }
  return { ok: true, body: { projectId, rating, text } }
}
