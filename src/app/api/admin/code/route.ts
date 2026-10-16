import 'server-only'
import { NextResponse } from 'next/server'
import { requestLoginCode } from '@/lib/admin-auth'
import { guard } from '@/lib/admin-guard'

// "Получить код в Telegram": sends a one-time code to the owner's chat. Nothing secret comes back.
export async function POST(request: Request) {
  const denied = await guard(request, { session: false })
  if (denied) return denied
  const result = await requestLoginCode()
  const status = result.ok
    ? 200
    : result.error === 'too_soon' || result.error === 'too_many'
      ? 429
      : 503
  return NextResponse.json(result, { status, headers: { 'cache-control': 'no-store' } })
}
