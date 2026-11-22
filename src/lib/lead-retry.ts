import { forwardLeadDetailed, type ForwardEnv } from './lead-forward'
import { unforwardedLeads, updateLead, type StoredLead } from './store'

// P-01: a lead is forwarded to HQ once on arrival (5 s). When HQ is restarting that one try is lost, so
// a lead stays `hqForwarded:false` until HQ answers ok, and this retries it: on server start and every
// minute in the background, with growing gaps (1, 2, 4... minutes up to an hour), at most MAX_ATTEMPTS
// tries and only for leads younger than a week. A confirmed lead is marked and never sent again.
// Every try carries the lead's stable `siteLeadId`; HQ answers a repeat with `duplicate: true`, which
// closes the lead like ok. Retries happen only on an error, a timeout or `queued`.
export const MAX_ATTEMPTS = 8
export const MAX_AGE_MS = 7 * 24 * 3600_000
const BASE_GAP_MS = 60_000
const MAX_GAP_MS = 3600_000

export function retryDue(lead: StoredLead, now: number): boolean {
  if (lead.hqForwarded !== false) return false
  const attempts = lead.hqAttempts ?? 0
  if (attempts >= MAX_ATTEMPTS) return false
  if (now - Date.parse(lead.createdAt) > MAX_AGE_MS) return false
  if (!lead.hqLastAttemptAt) return true
  const gap = Math.min(BASE_GAP_MS * 2 ** Math.max(0, attempts - 1), MAX_GAP_MS)
  return now - Date.parse(lead.hqLastAttemptAt) >= gap
}

// Records one try (also for the first, in-request one).
export async function recordForward(id: number, result: { ok: boolean; id: number | null; notified?: boolean; duplicate?: boolean }, now = Date.now()) {
  return updateLead(id, (l) => {
    if (l.hqForwarded === true) return
    l.hqAttempts = (l.hqAttempts ?? 0) + 1
    l.hqLastAttemptAt = new Date(now).toISOString()
    if (result.ok) {
      l.hqForwarded = true
      if (result.id) l.hqLeadId = result.id
      // HQ tells the owner itself: the bot's resend of an unsent lead is not needed any more.
      if (result.notified) l.notified = true
    }
  })
}

let running = false

// One pass over the undelivered leads (oldest first, at most 10). Never throws.
export async function retryPendingForwards(
  env: ForwardEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<number> {
  if (running || !env.LEAD_INTAKE_URL?.trim() || !env.LEAD_INTAKE_TOKEN?.trim()) return 0
  running = true
  let sent = 0
  try {
    for (const lead of (await unforwardedLeads()).filter((l) => retryDue(l, now)).slice(0, 10)) {
      const result = await forwardLeadDetailed(lead as never, lead.booking?.slot, env, fetchImpl, undefined, lead.hqIdentity ?? null)
      await recordForward(lead.id, result, now)
      if (result.ok) sent += 1
      // HQ is still down: the rest would fail the same way, wait for the next pass.
      else break
    }
  } catch (error) {
    console.error('[lead] retry pass failed:', error instanceof Error ? error.message : 'unknown')
  } finally {
    running = false
  }
  return sent
}

let timer: ReturnType<typeof setInterval> | null = null

// Starts the background loop once per server process.
export function startForwardRetry(env: ForwardEnv = process.env) {
  if (timer) return
  void retryPendingForwards(env)
  timer = setInterval(() => void retryPendingForwards(env), 60_000)
  timer.unref?.()
}
