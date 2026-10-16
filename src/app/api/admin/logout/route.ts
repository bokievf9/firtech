import 'server-only'
import { NextResponse } from 'next/server'
import { revokeAllSessions, revokeSession } from '@/lib/admin-auth'
import { clearedCookie, guard, readCookie } from '@/lib/admin-guard'

// "Выйти" ends this session; with { all: true } every session on every device.
export async function POST(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  const body = (await request.json().catch(() => null)) as { all?: unknown } | null
  if (body?.all === true) await revokeAllSessions()
  else await revokeSession(readCookie(request) ?? '')
  const response = NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
  response.cookies.set(clearedCookie())
  return response
}
