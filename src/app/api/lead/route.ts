import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { isFreeSlot } from '@/lib/booking'
import { formatLead, leadSchema } from '@/lib/lead'
import { flushPending, notifyOwner } from '@/lib/lead-bot'
import { bookedSlots, createLead, SlotTakenError, type StoredLead } from '@/lib/store'
import { leadToken, sendMessage, telegramEnv } from '@/lib/telegram'

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
  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0] ??
    'local'
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

  const { token, ownerChatId } = telegramEnv()
  const telegramReady = Boolean(token && ownerChatId)
  if (!telegramReady && process.env.NODE_ENV === 'production') {
    console.error('[lead] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing')
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 })
  }

  // A chosen call time must still be one of the free slots; stale or forged values are refused so
  // the form can ask for another time.
  const slot = lead.slot || undefined
  if (slot) {
    const taken = await bookedSlots().catch(() => null)
    if (taken && !isFreeSlot(slot, new Date(), taken)) {
      return NextResponse.json({ ok: false, error: 'slot_taken' }, { status: 409 })
    }
  }

  // Saved first, so the lead survives a Telegram outage.
  let stored: StoredLead | null = null
  try {
    stored = await createLead(lead, slot)
  } catch (error) {
    if (error instanceof SlotTakenError) {
      return NextResponse.json({ ok: false, error: 'slot_taken' }, { status: 409 })
    }
    console.error('[lead] could not save the lead', error, '\n' + formatLead(lead))
  }

  if (!telegramReady) {
    console.info('[lead] Telegram is not configured, lead not sent:\n' + formatLead(lead))
  } else {
    try {
      if (stored) {
        await notifyOwner(stored)
        // Not awaited: older leads stuck during an outage shouldn't slow down this visitor.
        void flushPending(stored.id).catch(() => {})
      } else {
        // No buttons: there is nothing on the site to update.
        await sendMessage(
          ownerChatId,
          formatLead(lead) +
            '\n\n<i>Заявка не сохранилась на сайте (ошибка хранилища), статусы для неё недоступны.</i>',
        )
      }
    } catch (error) {
      // Kept in the server log (PM2) too; a stored lead is resent when Telegram answers again.
      console.error('[lead] Telegram sendMessage failed', error, '\n' + formatLead(lead))
      if (!stored) {
        return NextResponse.json({ ok: false, error: 'delivery_failed' }, { status: 502 })
      }
    }
  }

  if (!stored) return NextResponse.json({ ok: true })
  return NextResponse.json({
    ok: true,
    id: stored.id,
    token: leadToken(stored.id),
    slot: stored.booking?.slot ?? null,
  })
}
