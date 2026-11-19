import 'server-only'
import { visitorIpHeader } from './public-post'
import type { SiteEvent } from './site-events'

// Forwards one site event to HQ `POST /events` (header x-site-token = SITE_EVENTS_TOKEN, else
// HQ_CHAT_TOKEN; HQ answers 404 when it has no token configured). URL: HQ_EVENTS_URL, else the origin
// of HQ_CHAT_URL + /events, else loopback. Development without HQ_EVENTS_URL and HQ_CHAT_URL sends
// nothing. 3 s timeout; never throws, failures are short codes and are not retried.

type Env = Record<string, string | undefined>
export const DEFAULT_EVENTS_URL = 'http://127.0.0.1:8787/events'
export const EVENTS_TIMEOUT_MS = 3000

export function eventsUrl(env: Env): string | null {
  const explicit = env.HQ_EVENTS_URL?.trim()
  if (explicit) return explicit
  const chat = env.HQ_CHAT_URL?.trim()
  if (chat) {
    try {
      return `${new URL(chat).origin}/events`
    } catch {
      return null
    }
  }
  return env.NODE_ENV === 'production' ? DEFAULT_EVENTS_URL : null
}

export async function forwardSiteEvent(
  event: SiteEvent,
  ip?: string,
  { env = process.env, fetcher = fetch, timeoutMs = EVENTS_TIMEOUT_MS }: { env?: Env; fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ ok: true; mock?: true } | { ok: false; error: string }> {
  const url = eventsUrl(env)
  if (!url) return { ok: true, mock: true }
  const token = (env.SITE_EVENTS_TOKEN || env.HQ_CHAT_TOKEN || '').trim()
  if (!token) return { ok: false, error: 'not_configured' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-site-token': token, ...visitorIpHeader(ip) },
      body: JSON.stringify(event),
      cache: 'no-store',
      signal: controller.signal,
    })
    return res.ok ? { ok: true } : { ok: false, error: res.status === 429 ? 'rate_limited' : `hq_${res.status}` }
  } catch {
    return { ok: false, error: 'hq_unreachable' }
  } finally {
    clearTimeout(timer)
  }
}
