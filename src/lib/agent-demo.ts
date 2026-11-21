import 'server-only'
import { z } from 'zod'
import { demoNiches } from '../content/builder-v2'
import { stripHtml } from './chat'
import { visitorIpHeader } from './public-post'

// Server side of POST /api/agent-demo: the final screen of the project builder lets the visitor talk
// to a demo persona of their niche. HQ serves it without a token (agents/docs/admin-crm-api.md,
// `POST /agent/demo-<niche>/chat`): body `{ sessionId, text }` -> `{ ok, reply }`, memory only inside
// the browser session, nothing stored. The browser calls this same-origin route, which limits each
// IP (20 questions per 10 minutes, in memory) and cleans the reply. Without HQ in development the
// route answers `mock` and the screen falls back to its scripted lines. The text is never logged.

export const agentDemoSchema = z.object({
  niche: z.enum(demoNiches as unknown as [string, ...string[]]),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  text: z.string().transform(stripHtml).pipe(z.string().min(1).max(500)),
})
export type AgentDemoRequest = z.infer<typeof agentDemoSchema>

// A per-IP sliding window in memory (one PM2 process), like the chat's limiter.
export function createDemoLimiter(max: number, windowMs: number) {
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
export const agentDemoLimited = createDemoLimiter(20, 10 * 60 * 1000)
export const AGENT_DEMO_TIMEOUT_MS = 20_000

export type AgentDemoAnswer = { ok: true; reply: string } | { ok: false; error: string }

// The HQ origin: `HQ_AGENT_URL`, else the origin of `HQ_CHAT_URL`, else the loopback default. null in
// development when neither is set (the scripted fallback answers on the screen).
export function agentDemoUrl(env: Record<string, string | undefined>, niche: string): string | null {
  const configured = env.HQ_AGENT_URL?.trim() || env.HQ_CHAT_URL?.trim()
  if (!configured && env.NODE_ENV !== 'production') return null
  let origin = 'http://127.0.0.1:8787'
  try {
    origin = new URL(configured || origin).origin
  } catch {
    // keep the loopback default
  }
  return `${origin}/agent/demo-${niche}/chat`
}

export async function askDemoAgent(
  req: AgentDemoRequest,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
  ip?: string,
): Promise<AgentDemoAnswer> {
  const url = agentDemoUrl(env, req.niche)
  if (!url) return { ok: false, error: 'mock' }
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...visitorIpHeader(ip) },
      body: JSON.stringify({ sessionId: req.sessionId, text: req.text }),
      cache: 'no-store',
      signal: AbortSignal.timeout(AGENT_DEMO_TIMEOUT_MS),
    })
    if (res.status === 429) return { ok: false, error: 'rate_limited' }
    const body = (await res.json().catch(() => null)) as { ok?: unknown; reply?: unknown } | null
    if (!res.ok || !body || body.ok !== true || typeof body.reply !== 'string')
      return { ok: false, error: 'hq_error' }
    const reply = stripHtml(body.reply).slice(0, 1200)
    return reply ? { ok: true, reply } : { ok: false, error: 'hq_error' }
  } catch {
    return { ok: false, error: 'hq_unreachable' }
  }
}
