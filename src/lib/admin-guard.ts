import 'server-only'
import { NextResponse } from 'next/server'
import { isValidSession, SESSION_COOKIE } from './admin-auth'

// Request checks shared by every /api/admin route. Pages use requireAdmin() from admin-page.ts.

export function readCookie(request: Request, name = SESSION_COOKIE) {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

// A POST must come from a page on this same site: the browser sets Origin and a page elsewhere can't
// fake it. nginx passes the original Host, so the two must match.
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

const deny = (status: number, error: string) =>
  NextResponse.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } })

// Null when the request may go on, otherwise the response to send back.
export async function guard(request: Request, { session = true } = {}) {
  if (request.method !== 'GET' && request.method !== 'HEAD' && !sameOrigin(request)) {
    return deny(403, 'bad_origin')
  }
  if (session && !(await isValidSession(readCookie(request)))) return deny(401, 'unauthorized')
  return null
}

export function sessionCookie(token: string, expiresAt: number) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    expires: new Date(expiresAt),
  }
}

export function clearedCookie() {
  return { ...sessionCookie('', 0), expires: new Date(0), maxAge: 0 }
}
