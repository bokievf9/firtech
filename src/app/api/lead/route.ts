import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api-error'
import { isFreeSlot } from '@/lib/booking'
import { checkPublicPost, visitorIp } from '@/lib/public-post'
import { formatLead, leadSchema } from '@/lib/lead'
import { cabinetLeadPath, leadGate } from '@/lib/lead-identity'
import { forwardLeadDetailed, hqNotified, withinMs } from '@/lib/lead-forward'
import { currentLeadUser } from '@/lib/lead-session'
import { flushPending, notifyOwner } from '@/lib/lead-bot'
import { recordForward } from '@/lib/lead-retry'
import { bookedSlots, createLead, SlotTakenError, updateLead, type StoredLead } from '@/lib/store'
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

async function handle(request: NextRequest) {
  const rejected = checkPublicPost(request)
  if (rejected) return apiError(rejected.error, rejected.status)
  const ip = visitorIp(request.headers)
  if (limited(ip)) {
    return apiError('rate_limited', 429)
  }

  const parsed = leadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError('invalid', 400)
  }
  // Bots that filled the honeypot get a normal answer, and nothing is sent.
  if (parsed.data.website) return NextResponse.json({ ok: true })

  // Leads come only from signed-in cabinet accounts (owner 2026-11-20); the account rides along.
  const gate = await leadGate(() => currentLeadUser(parsed.data.locale, ip))
  if (!gate.ok) return apiError(gate.error, gate.status)
  const identity = gate.identity
  const lead = { ...parsed.data, ...(identity ? { account: identity.clientEmail } : {}) }

  const { token, ownerChatId } = telegramEnv()
  const telegramReady = Boolean(token && ownerChatId)
  if (!telegramReady && process.env.NODE_ENV === 'production') {
    console.error('[lead] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing')
    return apiError('not_configured', 503)
  }

  // A chosen call time must still be one of the free slots; stale or forged values are refused so
  // the form can ask for another time.
  const slot = lead.slot || undefined
  if (slot) {
    const taken = await bookedSlots().catch(() => null)
    if (taken && !isFreeSlot(slot, new Date(), taken)) {
      return apiError('slot_taken', 409)
    }
  }

  // Saved first, so the lead survives a Telegram outage.
  let stored: StoredLead | null = null
  try {
    stored = await createLead(lead, slot, identity)
  } catch (error) {
    if (error instanceof SlotTakenError) {
      return apiError('slot_taken', 409)
    }
    console.error('[lead] could not save the lead', error, '\n' + formatLead(lead))
  }

  // Copy for the Lead Intake agent, fail-open. Its answer (HQ's lead id, for the cabinet link) is
  // awaited at most 3 s further down; the forward itself never blocks the lead.
  const forwarded = forwardLeadDetailed({ ...lead, siteLeadId: stored?.siteLeadId ?? crypto.randomUUID() }, stored?.booking?.slot ?? slot, process.env, fetch, ip, identity)
  // P-01: the outcome is written down whenever HQ answers (even after the visitor got the reply); a
  // lead HQ did not confirm stays `hqForwarded:false` and the background retry delivers it.
  if (stored) {
    const id = stored.id
    void forwarded.then((r) => recordForward(id, r)).catch((error) => console.error('[lead] could not record the forward', error instanceof Error ? error.message : 'unknown'))
  }

  // HQ's answer decides the owner channel (P-02): `notified: true` means HQ tells the owner itself, so
  // the site's own bot stays quiet; no answer within 3 s, `queued` or an error: the bot is the fallback.
  const hq = await withinMs(forwarded, 3000, { ok: false, id: null })
  if (hqNotified(hq)) {
    if (stored) {
      // Marked as notified so the resend of "unsent" leads does not pick it up later.
      await updateLead(stored.id, (l) => {
        l.notified = true
      }).catch((error) => console.error('[lead] could not mark the lead', error instanceof Error ? error.message : 'unknown'))
    }
  } else if (!telegramReady) {
    console.info('[lead] Telegram is not configured, lead not sent:\n' + formatLead(lead))
  } else {
    try {
      if (stored) {
        await notifyOwner(stored)
        // Not awaited: older leads stuck during an outage shouldn't slow down this visitor.
        void flushPending(stored.id).catch((error) => console.error('[lead] flushPending failed', error instanceof Error ? error.message : 'unknown'))
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
        return apiError('delivery_failed', 502)
      }
    }
  }

  const followToken = stored ? leadToken(stored.id) : ''
  const cabinet = identity
    ? cabinetLeadPath(lead.locale, hq.id, stored ? { id: stored.id, token: followToken } : undefined)
    : null
  if (!stored) return NextResponse.json({ ok: true, hqLeadId: hq.id, cabinet })
  return NextResponse.json({
    ok: true,
    id: stored.id,
    token: followToken,
    slot: stored.booking?.slot ?? null,
    hqLeadId: hq.id,
    // True while HQ has not confirmed: the lead is saved and goes to work on its own (retried).
    queued: !hq.ok,
    cabinet,
  })
}

// Anything unexpected becomes a JSON error with a status, never an empty 500 page.
export async function POST(request: NextRequest) {
  try {
    return await handle(request)
  } catch (error) {
    console.error('[lead] unexpected failure', error instanceof Error ? error.message : 'unknown')
    return apiError('server_error', 500)
  }
}
