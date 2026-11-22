import 'server-only'
import { NextResponse } from 'next/server'
import { loginWithPassword, PASSWORD_BODY_LIMIT } from '@/lib/admin-auth'
import { guard, sessionCookie } from '@/lib/admin-guard'
import { visitorIp } from '@/lib/public-post'

const headers = { 'cache-control': 'no-store' }
const answer = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers })

// Password login: JSON `{ password }` from a page of this site. On success the session cookie is set
// (httpOnly, strict, secure in production). Answers: 200, 401 wrong, 429 too many (retryAfter in
// seconds), 503 not_configured (no valid ADMIN_PASSWORD_HASH), 403 bad_origin, 415, 400.
export async function POST(request: Request) {
  const denied = await guard(request, { session: false })
  if (denied) return denied
  const type = request.headers.get('content-type') ?? ''
  if (!/^application\/json\s*(;|$)/i.test(type)) return answer(415, { ok: false, error: 'unsupported_media_type' })
  const text = await request.text().catch(() => '')
  if (text.length > PASSWORD_BODY_LIMIT) return answer(400, { ok: false, error: 'bad_request' })
  let password: unknown
  try {
    password = (JSON.parse(text) as { password?: unknown } | null)?.password
  } catch {
    return answer(400, { ok: false, error: 'bad_request' })
  }
  const result = await loginWithPassword(password, { ip: visitorIp(request.headers) })
  if (result.ok) {
    const response = answer(200, { ok: true })
    response.cookies.set(sessionCookie(result.token, result.expiresAt))
    return response
  }
  if (result.error === 'not_configured') return answer(503, result)
  if (result.error === 'too_many') {
    const response = answer(429, result)
    response.headers.set('retry-after', String(result.retryAfter))
    return response
  }
  return answer(401, result)
}
