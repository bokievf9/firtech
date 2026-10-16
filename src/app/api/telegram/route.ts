import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { handleUpdate, type Update } from '@/lib/lead-bot'
import { verifyWebhookSecret } from '@/lib/telegram'

// Telegram webhook (set with scripts/telegram-webhook.mjs). Telegram sends the secret we gave it in
// this header, so a request without it did not come from Telegram.
export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const update = (await request.json().catch(() => null)) as Update | null
  if (!update) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    await handleUpdate(update)
  } catch (error) {
    // Still 200: Telegram would otherwise retry the same update again and again.
    console.error('[bot] update failed', error)
  }
  return NextResponse.json({ ok: true })
}
