import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { formatLead, leadSchema } from '@/lib/lead'

// Simple per-IP limit: enough against a script hammering the form, without a database.
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()

function limited(ip: string) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > MAX_PER_WINDOW
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local'
  if (limited(ip.trim())) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  const parsed = leadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  const lead = parsed.data
  // Bots that filled the honeypot get a normal answer, and nothing is sent.
  if (lead.website) return NextResponse.json({ ok: true })

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[lead] Telegram is not configured, lead not sent:\n' + formatLead(lead))
      return NextResponse.json({ ok: true })
    }
    console.error('[lead] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing')
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 })
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatLead(lead),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null)

  if (!response?.ok) {
    // Kept in the server log (PM2) so a lead is not lost while Telegram is unreachable.
    console.error('[lead] Telegram sendMessage failed', response?.status, '\n' + formatLead(lead))
    return NextResponse.json({ ok: false, error: 'delivery_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
