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

// The hosts a POST may come from: the configured site (NEXT_PUBLIC_SITE_URL, default firtech.pro) and
// its www twin. Outside production also the request's own Host (localhost dev servers and tests).
// Security 2026-11-23 (P2-12): X-Forwarded-Host is never read: nginx passed the client's value through,
// so a forged header could match a forged Origin.
export function allowedAdminHosts(request: Pick<Request, 'headers'>, env: Record<string, string | undefined> = process.env): string[] {
  const hosts: string[] = []
  try {
    const site = new URL(env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://firtech.pro')
    hosts.push(site.host)
    if (!site.hostname.startsWith('www.')) hosts.push(`www.${site.host}`)
  } catch {
    hosts.push('firtech.pro', 'www.firtech.pro')
  }
  if (env.NODE_ENV !== 'production') {
    const own = request.headers.get('host')
    if (own) hosts.push(own)
  }
  return hosts
}

// A POST must come from a page on this same site: the browser sets Origin and a page elsewhere can't
// fake it.
export function sameOrigin(request: Request, env: Record<string, string | undefined> = process.env) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return allowedAdminHosts(request, env).includes(new URL(origin).host)
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
