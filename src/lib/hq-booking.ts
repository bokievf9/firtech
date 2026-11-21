import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

// `POST /api/slots` from HQ (agents P-02): HQ books a call window for its own lead. The window is
// held in the same store as the site's bookings, so `GET /api/slots` stops offering it. No email goes
// to the client from here, HQ writes to them itself.
export const hqBookingSchema = z.object({
  slot: z.iso.datetime(),
  leadId: z.number().int().positive(),
  name: z.string().trim().max(200).default(''),
  contact: z.string().trim().max(300).default(''),
  locale: z.string().trim().max(8).default('ru'),
  source: z.string().trim().max(100).default(''),
})
export type HqBookingInput = z.infer<typeof hqBookingSchema>

export function tokenMatches(given: string | null, expected: string | undefined) {
  const want = expected?.trim()
  if (!want || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}

export type HqBookingDeps = {
  token?: string
  book: (b: HqBookingInput) => Promise<boolean>
}

// The four answers: 401 (no or wrong token), 400 (bad body),
// 409 (window taken), 200 (booked).
export async function handleHqBooking(
  givenToken: string | null,
  body: unknown,
  deps: HqBookingDeps,
): Promise<{ status: 200 | 400 | 401 | 409; body: Record<string, unknown> }> {
  if (!tokenMatches(givenToken, deps.token)) return { status: 401, body: { error: 'unauthorized' } }
  const parsed = hqBookingSchema.safeParse(body)
  if (!parsed.success) return { status: 400, body: { error: 'invalid' } }
  const slot = new Date(parsed.data.slot).toISOString()
  // Any instant is accepted (the Pult may agree a time outside the site's grid); a window that is
  // already held is the 409 below.
  const ok = await deps.book({ ...parsed.data, slot })
  if (!ok) return { status: 409, body: { error: 'slot_taken' } }
  return { status: 200, body: { ok: true, slot } }
}
