import 'server-only'
import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { CODE_TTL_MS, LOGIN_COOKIE, requestLoginCode } from '@/lib/admin-auth'
import { guard, readCookie } from '@/lib/admin-guard'

// "Получить код в Telegram": sends a one-time code to the owner's chat. Nothing secret comes back.
// The browser gets a random login cookie, and the code only works together with it.
export async function POST(request: Request) {
  const denied = await guard(request, { session: false })
  if (denied) return denied
  const browser = readCookie(request, LOGIN_COOKIE) ?? randomBytes(24).toString('base64url')
  const ip =
    request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? ''
  const result = await requestLoginCode(Date.now(), { browser, ip: ip.trim() })
  const status = result.ok
    ? 200
    : result.error === 'too_soon' || result.error === 'too_many'
      ? 429
      : 503
  const response = NextResponse.json(result, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
  response.cookies.set({
    name: LOGIN_COOKIE,
    value: browser,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: CODE_TTL_MS / 1000,
  })
  return response
}
