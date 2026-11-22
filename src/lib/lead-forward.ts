import type { Lead } from './lead'
import { identityFields, type LeadIdentity } from './lead-identity'
import { visitorIpHeader } from './public-post'

// Forwards a lead to the Lead Intake agent (agents repo, apps/lead-intake, POST /lead).
// Fail-open: never throws, a missing config or a failed request only reaches the log, so the lead is
// still saved and sent to Telegram. The body matches the agent's webLeadSchema; `source` carries
// `ref:<slug>` for referral leads (HQ reads it as the referrer). Since 2026-11-20 a lead comes from
// a signed-in cabinet account: `clientEmail`, `cabinetId` (Supabase user id) and `clientName` ride
// along (HQ reads them since agents b313a11). HQ answers `{ ok, id, leadId }`; `leadId` sends the
// browser to that lead in the cabinet.
export type ForwardEnv = Record<string, string | undefined>
// `notified`: HQ answered `notified: true` and tells the owner itself (agents P-02), so the site's own
// Telegram bot stays quiet; only an unanswered or `queued` lead goes to the bot as the fallback channel.
export type ForwardResult = { ok: boolean; id: number | null; notified?: boolean; duplicate?: boolean }

// HQ's dedupe key (agents `siteLeadId`): 8..64 chars of [A-Za-z0-9_.:-]. A malformed id is never sent.
export const SITE_LEAD_ID_RE = /^[A-Za-z0-9_.:-]{8,64}$/
export const validSiteLeadId = (v: unknown): v is string => typeof v === 'string' && SITE_LEAD_ID_RE.test(v)

// True when HQ confirmed the lead AND will notify the owner itself.
export const hqNotified = (r: ForwardResult) => r.ok && r.notified === true

const TIMEOUT_MS = 5000

export function leadBody(lead: Lead & { siteLeadId?: string }, slot: string | undefined, identity: LeadIdentity | null = null) {
  return {
    name: lead.name,
    contact: lead.contact,
    service: lead.service,
    budget: lead.budget,
    message: lead.message,
    estimate: lead.estimate,
    locale: lead.locale,
    page: lead.page,
    slot: slot ?? '',
    // HQ's schema rejects an empty source, so the field is sent only when there is one.
    ...(lead.source ? { source: lead.source } : {}),
    ...(validSiteLeadId(lead.siteLeadId) ? { siteLeadId: lead.siteLeadId } : {}),
    ...identityFields(identity),
  }
}

export async function forwardLeadDetailed(
  lead: Lead & { siteLeadId?: string },
  slot: string | undefined,
  env: ForwardEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  ip?: string,
  identity: LeadIdentity | null = null,
): Promise<ForwardResult> {
  const base = env.LEAD_INTAKE_URL?.trim().replace(/\/+$/, '')
  const token = env.LEAD_INTAKE_TOKEN?.trim()
  if (!base || !token) return { ok: false, id: null }
  try {
    const res = await fetchImpl(`${base}/lead`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lead-token': token, ...visitorIpHeader(ip) },
      body: JSON.stringify(leadBody(lead, slot, identity)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error(`[lead] Lead Intake answered ${res.status}`)
      return { ok: false, id: null }
    }
    // HQ answers `{ ok, id, leadId }`: `id` is its Sales task, `leadId` the lead the cabinet lists
    // (by-email `leads[].id`). Only `leadId` can open the right card.
    const body = typeof res.json === 'function' ? ((await res.json().catch(() => null)) as { leadId?: unknown; notified?: unknown; duplicate?: unknown; queued?: unknown } | null) : null
    const id = typeof body?.leadId === 'number' && Number.isInteger(body.leadId) && body.leadId > 0 ? body.leadId : null
    const duplicate = body?.duplicate === true
    // `duplicate: true` = HQ already has this lead: closed. `queued` (not yet processed) is retried;
    // the siteLeadId makes that retry safe.
    if (body?.queued === true && !duplicate) return { ok: false, id }
    return { ok: true, id, notified: body?.notified === true, ...(duplicate ? { duplicate: true } : {}) }
  } catch (error) {
    // Only the error, never the lead text, goes to the log.
    console.error('[lead] could not forward the lead to Lead Intake', error instanceof Error ? error.message : error)
    return { ok: false, id: null }
  }
}

export async function forwardLead(
  lead: Lead,
  slot: string | undefined,
  env: ForwardEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  ip?: string,
  identity: LeadIdentity | null = null,
): Promise<boolean> {
  return (await forwardLeadDetailed(lead, slot, env, fetchImpl, ip, identity)).ok
}

// Waits for HQ's answer at most `ms`, so the visitor is never held up by a slow HQ: the forward
// itself goes on in the background either way.
export function withinMs<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))])
}
