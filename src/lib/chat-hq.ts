import 'server-only'
import { getDict } from '@/content'
import { createMockDemoCounter, demoFields } from './demo-gate'
import { identityFields, type LeadIdentity } from './lead-identity'
import { visitorIpHeader } from './public-post'
import { createMockReceptionist, sanitizeReply, START, type ChatRequest, type ChatResponse } from './chat'

// Server side of POST /api/chat: forwards one visitor message to HQ's receptionist and cleans the
// answer. Never throws and never returns the token or the URL.
//   POST ${HQ_CHAT_URL}   (default http://127.0.0.1:8787/chat)
//   x-chat-token: ${HQ_CHAT_TOKEN}  (falls back to LEAD_INTAKE_TOKEN)
//   x-visitor-ip: the visitor's address (HQ's per-IP limit), only when a proxy gave one
//   { sessionId, locale, text, message (one more release), page, persona?, ref?, clientEmail?, cabinetId?, clientName? }
// Without HQ_CHAT_URL in development the scripted mock answers, so the widget can be reviewed
// locally. Production always talks to HQ (loopback default): a mock there would collect contacts
// that nobody reads.

const DEFAULT_URL = 'http://127.0.0.1:8787/chat'
// HQ answers through an LLM gateway with free providers; give it time, but not forever.
export const CHAT_TIMEOUT_MS = 20_000

const mock = createMockReceptionist()
const mockCounter = createMockDemoCounter(Number(process.env.DEMO_DAILY_PER_CLIENT) > 0 ? Number(process.env.DEMO_DAILY_PER_CLIENT) : undefined)

export function chatMode(env: Record<string, string | undefined>): 'mock' | 'hq' {
  return !env.HQ_CHAT_URL?.trim() && env.NODE_ENV !== 'production' ? 'mock' : 'hq'
}

export async function askReceptionist(
  req: ChatRequest,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
  ip?: string,
  identity: LeadIdentity | null = null,
): Promise<ChatResponse> {
  if (chatMode(env) === 'mock') {
    const out = mock(req, getDict(req.locale).chat.mock)
    // A demo message of a signed-in client counts like HQ's `demo_usage` (the greeting request does not).
    if (req.persona && identity && req.message !== START) {
      const hit = mockCounter(identity.cabinetId)
      return hit.ok ? { ...out, usage: hit.usage } : { ok: false, error: 'demo_limit' }
    }
    return out
  }
  const url = env.HQ_CHAT_URL?.trim() || DEFAULT_URL
  const token = (env.HQ_CHAT_TOKEN || env.LEAD_INTAKE_TOKEN || '').trim()
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { 'x-chat-token': token } : {}),
        ...visitorIpHeader(ip),
      },
      body: JSON.stringify({
        sessionId: req.sessionId,
        locale: req.locale,
        // `text` is HQ's name for the visitor's words; `message` stays for one release.
        text: req.message,
        message: req.message,
        page: req.page,
        // Referral slug: becomes `source: ref:<slug>` of a lead.
        ...(req.ref ? { ref: req.ref } : {}),
        // The demo niche (salon, clinic, shop): HQ answers as that fictional business, `demo: true`.
        ...(req.persona ? { persona: req.persona } : {}),
        // The signed-in cabinet account (clientEmail, cabinetId, clientName, taken from the session
        // on the server, never from the browser): HQ routes the visitor to their own thread.
        // A demo message (persona) carries `clientId`, `clientEmail` and `demo: true` instead: HQ counts it
        // per client (`demo_usage`, daily limit) and answers with `usage: { calls, left }`.
        ...(req.persona ? demoFields(identity) : identityFields(identity)),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    })
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'hq_unauthorized' }
    const body: unknown = await res.json().catch(() => null)
    if (res.status === 429) {
      const code = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined
      return { ok: false, error: code === 'limit_reached' || code === 'demo_limit' ? 'demo_limit' : 'rate_limited' }
    }
    const clean = sanitizeReply(body)
    if (!clean) return { ok: false, error: res.ok ? 'hq_bad_response' : 'hq_error' }
    return clean
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timeout ? 'hq_timeout' : 'hq_unreachable' }
  }
}

// Per-IP limit for the public chat: 30 messages per hour, in memory (one PM2 process).
export const CHAT_LIMIT = 30
export const CHAT_WINDOW_MS = 60 * 60 * 1000

export function createLimiter(max = CHAT_LIMIT, windowMs = CHAT_WINDOW_MS) {
  const hits = new Map<string, number[]>()
  return function limited(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= max) {
      hits.set(key, recent)
      return true
    }
    recent.push(now)
    hits.set(key, recent)
    if (hits.size > 5000) hits.clear()
    return false
  }
}

export const chatLimited = createLimiter()
