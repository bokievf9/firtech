// «Демо на ваших данных» (agents, решение владельца 2026-11-22): the link `/<locale>/demo/<publicId>?k=<key>` of the
// first reply to a lead opens a chat with the lead's draft agent. The browser posts to HQ's public
// `POST /agent/:publicId/chat` (nginx proxies `/agent/` to HQ on the same host) with `{ demoKey, text, conversationId }`
// and no token. Pure helpers, so tests cover the parsing without a browser.
export const DEMO_TEXT_MAX = 1000

export const isPublicId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v)

// `?k=` (first value): the HMAC key HQ made from the publicId. Only a plain token of a sane length.
export function demoKeyOf(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' && /^[A-Za-z0-9_.~-]{8,200}$/.test(v) ? v : null
}

// A conversation id HQ accepts (`[A-Za-z0-9_-]`, 8..64): one per open page.
export function newConversationId(random: () => number = Math.random): string {
  let out = 'w-'
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 16; i++) out += alphabet[Math.floor(random() * alphabet.length)]
  return out
}

export type DemoLimit = { limit: number | null; remaining: number | null }

// The limit of the demo as HQ reports it (the contract names no fields yet, so the likely ones are read:
// `limit` / `remaining`, `usage: { limit, used }` or `usage: { calls, left }`); null when HQ says nothing.
export function parseDemoLimit(body: unknown): DemoLimit {
  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const usage = o.usage && typeof o.usage === 'object' ? (o.usage as Record<string, unknown>) : {}
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null)
  const limit = n(o.limit) ?? n(usage.limit)
  const remaining = n(o.remaining) ?? n(usage.left) ?? (limit !== null && n(usage.used) !== null ? Math.max(0, limit - (n(usage.used) as number)) : null)
  return { limit, remaining }
}

export type DemoAnswer =
  | { ok: true; reply: string; conversationId: string | null; limit: DemoLimit }
  | { ok: false; error: 'unauthorized' | 'limit_reached' | 'rate_limited' | 'invalid' | 'unavailable' | 'network' }

// HQ's answer by status and body: 200 `{ ok, reply, conversationId, mode: "demo" }`, 401 `unauthorized` (a wrong or
// missing key), 429 `limit_reached` (the demo's daily limit) or `rate_limited`, 400 `invalid`, anything else unavailable.
export function parseDemoAnswer(status: number, body: unknown): DemoAnswer {
  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  if (status === 200 && o.ok === true && typeof o.reply === 'string' && o.reply.trim()) {
    return {
      ok: true,
      reply: o.reply.slice(0, 2000),
      conversationId: typeof o.conversationId === 'string' ? o.conversationId : null,
      limit: parseDemoLimit(o),
    }
  }
  if (status === 401 || status === 403) return { ok: false, error: 'unauthorized' }
  if (status === 429) return { ok: false, error: o.error === 'rate_limited' ? 'rate_limited' : 'limit_reached' }
  if (status === 400) return { ok: false, error: 'invalid' }
  return { ok: false, error: 'unavailable' }
}
