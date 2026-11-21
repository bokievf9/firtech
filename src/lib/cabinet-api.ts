import 'server-only'
import { NextResponse } from 'next/server'
import { fetchClientByEmail, type HqV3Error } from './cabinet-hq'
import { checkPublicPost } from './public-post'
import { createClient } from './supabase/server'

// Shared guards of the cabinet v3 route handlers (`/api/cabinet/*`): the Supabase session decides who
// the client is (the HQ client id is looked up by the session's email, never taken from the browser),
// POSTs check Origin, and every answer is `no-store` JSON with a short error code.
export const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'private, no-store' } })

// Origin check for non-JSON posts (multipart uploads): the same rule as checkPublicPost, which also
// demands a JSON content type, so it is asked as if the type were right.
export function checkSameOrigin(request: Request): { status: number; error: string } | null {
  const headers = { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : request.headers.get(name)) }
  return checkPublicPost({ headers } as Pick<Request, 'headers'>)
}

export type CabinetCaller = { ok: true; clientId: number; email: string; userId: string } | { ok: false; response: NextResponse }

// HQ client ids by email, kept for a few minutes: the messenger polls every 15 s and the by-email
// answer is the heaviest call. Only the id is cached, never data.
const ids = new Map<string, { id: number; exp: number }>()
const ID_TTL_MS = 5 * 60_000

export async function cabinetCaller(request: Request, opts: { post?: boolean; json?: boolean } = {}): Promise<CabinetCaller> {
  if (opts.post) {
    const bad = opts.json === false ? checkSameOrigin(request) : checkPublicPost(request)
    if (bad) return { ok: false, response: reply({ ok: false, error: bad.error }, bad.status) }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, response: reply({ ok: false, error: 'unavailable' }, 503) }
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email?.toLowerCase()
  if (!data.user || !email) return { ok: false, response: reply({ ok: false, error: 'unauthorized' }, 401) }
  const hit = ids.get(email)
  if (hit && hit.exp > Date.now()) return { ok: true, clientId: hit.id, email, userId: data.user.id }
  const client = await fetchClientByEmail(email)
  if (!client.ok) return { ok: false, response: reply({ ok: false, error: client.error }, client.error === 'not_found' ? 404 : 502) }
  ids.set(email, { id: client.data.client.id, exp: Date.now() + ID_TTL_MS })
  if (ids.size > 500) for (const [k, v] of ids) if (v.exp < Date.now()) ids.delete(k)
  return { ok: true, clientId: client.data.client.id, email, userId: data.user.id }
}

const statusOf: Record<HqV3Error, number> = {
  hq_unreachable: 502,
  hq_timeout: 504,
  hq_error: 502,
  not_found: 404,
  not_awaiting: 409,
  bad_signature: 422,
  invalid: 400,
  rate_limited: 429,
  too_large: 413,
}
export const hqFailure = (error: HqV3Error) => reply({ ok: false, error }, statusOf[error] ?? 502)

// Thread and document ids from the URL: plain tokens only.
export const safeToken = (v: string) => /^[A-Za-z0-9_:.-]{1,80}$/.test(v)
