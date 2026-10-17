import 'server-only'
import { NextResponse } from 'next/server'
import { LOGIN_COOKIE, verifyCode } from '@/lib/admin-auth'
import { guard, readCookie, sessionCookie } from '@/lib/admin-guard'

// Code check, only from the browser that asked for the code (its login cookie). On success the
// session cookie is set (httpOnly, strict, secure in production) and the login cookie is cleared.
export async function POST(request: Request) {
  const denied = await guard(request, { session: false })
  if (denied) return denied
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null
  const code = typeof body?.code === 'string' ? body.code.slice(0, 20) : ''
  const result = await verifyCode(code, Date.now(), readCookie(request, LOGIN_COOKIE) ?? '')
  const headers = { 'cache-control': 'no-store' }
  if (!result.ok) return NextResponse.json(result, { status: 400, headers })
  const response = NextResponse.json({ ok: true }, { headers })
  response.cookies.set(sessionCookie(result.token, result.expiresAt))
  response.cookies.set({ name: LOGIN_COOKIE, value: '', path: '/api/admin', maxAge: 0 })
  return response
}
