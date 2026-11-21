import { NextResponse } from 'next/server'
import { applyUnsubscribe } from '@/lib/cabinet-profile-server'

// One-click unsubscribe (RFC 8058): letters carry `List-Unsubscribe: <https://firtech.pro/api/cabinet/unsubscribe?token=...>`
// and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; the mail client POSTs here without a session or an
// Origin of ours, so the signed token is the only check. Same effect as the button on the unsubscribe page.
export const dynamic = 'force-dynamic'

const STATUS: Record<string, number> = { invalid_token: 400, not_configured: 503, not_found: 404, save_failed: 500 }

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  const result = await applyUnsubscribe(token)
  const headers = { 'cache-control': 'no-store' }
  if (result.ok) return NextResponse.json({ ok: true, field: result.field, already: result.already }, { headers })
  return NextResponse.json({ ok: false, error: result.error }, { status: STATUS[result.error] ?? 500, headers })
}
