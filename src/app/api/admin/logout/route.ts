import 'server-only'
import { NextResponse } from 'next/server'
import { isValidSession, revokeAllSessions, revokeSession } from '@/lib/admin-auth'
import { clearedCookie, guard, readCookie } from '@/lib/admin-guard'

// «Sign out» ends this session on the server and clears the cookie, also for a cookie that no longer
// counts (expired, or made before the password changed). { all: true } ends every session on every
// device and needs a valid one.
export async function POST(request: Request) {
  const denied = await guard(request, { session: false })
  if (denied) return denied
  const token = readCookie(request) ?? ''
  const body = (await request.json().catch(() => null)) as { all?: unknown } | null
  if (body?.all === true) {
    if (!(await isValidSession(token)))
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: { 'cache-control': 'no-store' } })
    await revokeAllSessions()
  } else if (token) await revokeSession(token)
  const response = NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
  response.cookies.set(clearedCookie())
  return response
}
