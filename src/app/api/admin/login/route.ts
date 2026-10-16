import 'server-only'
import { NextResponse } from 'next/server'
import { verifyCode } from '@/lib/admin-auth'
import { guard, sessionCookie } from '@/lib/admin-guard'

// Code check; on success the session cookie is set (httpOnly, strict, secure in production).
export async function POST(request: Request) {
  const denied = await guard(request, { session: false })
  if (denied) return denied
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null
  const code = typeof body?.code === 'string' ? body.code.slice(0, 20) : ''
  const result = await verifyCode(code)
  const headers = { 'cache-control': 'no-store' }
  if (!result.ok) return NextResponse.json(result, { status: 400, headers })
  const response = NextResponse.json({ ok: true }, { headers })
  response.cookies.set(sessionCookie(result.token, result.expiresAt))
  return response
}
