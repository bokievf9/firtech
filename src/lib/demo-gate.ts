// The demo is for signed-in clients only (owner review 2026-11-23, item 15: «чтобы мы знали, кто сколько
// потратил»). Pure module, covered by tests/demo-gate.test.mjs. Every demo call to HQ (`POST /chat` with a
// persona, `POST /agent/:id/chat`) carries `clientId`, `clientEmail` (taken from the Supabase session on the
// server, never from the browser) and `demo: true`; HQ counts the usage per client and may answer with
// `usage: { calls, left }`. Contract for HQ: docs/cabinet.md, «Демо только для вошедших».
import type { LeadIdentity } from './lead-identity'

export type DemoUsage = { calls: number; left: number | null }

// The fields HQ gets with a demo message. Without an account (cabinet not configured on this server)
// only the flag goes.
export function demoFields(identity: LeadIdentity | null): { demo: true; clientId?: string; clientEmail?: string } {
  return identity ? { demo: true, clientId: identity.cabinetId, clientEmail: identity.clientEmail } : { demo: true }
}

// HQ takes the demo identity on `POST /agent/:id/chat` only with `x-chat-token` (the same `HQ_CHAT_TOKEN` as
// `POST /chat`). Server side only; empty when no token is configured (development).
export function chatTokenHeader(env: Record<string, string | undefined>): Record<string, string> {
  const token = (env.HQ_CHAT_TOKEN || env.LEAD_INTAKE_TOKEN || '').trim()
  return token ? { 'x-chat-token': token } : {}
}

const count = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null)

// HQ's usage in any of its three forms: flat `limit` / `remaining`, `usage: { limit, used, remaining }` (the
// contract, public-api.md) or the older `usage: { calls, left }`. `remaining ?? usage.remaining ?? usage.left`;
// null when HQ says nothing usable.
export function parseUsage(body: unknown): DemoUsage | null {
  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const u = o.usage && typeof o.usage === 'object' ? (o.usage as Record<string, unknown>) : {}
  const limit = count(o.limit) ?? count(u.limit)
  const used = count(u.used) ?? count(u.calls)
  const left = count(o.remaining) ?? count(u.remaining) ?? count(u.left) ?? (limit !== null && used !== null ? Math.max(0, limit - used) : null)
  if (used === null && left === null) return null
  return { calls: used ?? (limit !== null && left !== null ? Math.max(0, limit - left) : 0), left }
}

// Where «Войти» leads: the login page with the page to come back to. `next` must stay inside the locale
// (`safeNextPath` in cabinet-auth.ts), so the demo tab goes as `?demo=<tab>#demo`.
export function demoLoginHref(locale: string, next: string): string {
  const l = locale === 'en' ? 'en' : 'ru'
  return `/${l}/cabinet/login?next=${encodeURIComponent(next)}`
}

export function demoTabNext(locale: string, tab: string): string {
  const l = locale === 'en' ? 'en' : 'ru'
  return `/${l}?demo=${encodeURIComponent(tab)}#demo`
}

// Development stand-in of HQ's counter, per client and day (the real one is HQ's `demo_usage`).
export const DEMO_DAILY_DEFAULT = 30
export function createMockDemoCounter(limit: number = DEMO_DAILY_DEFAULT, now: () => number = Date.now) {
  const days = new Map<string, number>()
  return function hit(clientId: string): { ok: true; usage: DemoUsage } | { ok: false } {
    const day = new Date(now()).toISOString().slice(0, 10)
    const key = `${day}:${clientId}`
    const used = days.get(key) ?? 0
    if (used >= limit) return { ok: false }
    days.set(key, used + 1)
    if (days.size > 5000) days.clear()
    return { ok: true, usage: { calls: used + 1, left: limit - used - 1 } }
  }
}
