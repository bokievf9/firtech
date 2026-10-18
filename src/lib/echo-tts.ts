import 'server-only'
import { readCookie } from '@/lib/admin-guard'

// Optional neural voice for Echo: a Piper HTTP service on the same machine, behind
// ECHO_TTS_URL (for example http://127.0.0.1:5000/synthesize, Piper's own HTTP server). Not configured: the endpoint answers 404 and
// the page speaks with the browser's own voice. Only a loopback address is accepted, so this
// route can never be turned into a proxy to somewhere else.

export function ttsUrl(env = process.env.ECHO_TTS_URL) {
  if (!env) return null
  try {
    const url = new URL(env)
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    return local && url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

const windowMs = 10 * 60_000
const LIMIT = 60
const hits = new Map<string, number[]>()
export const ttsLimits = {
  reset: () => hits.clear(),
}

const fail = (status: number, error: string) =>
  Response.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } })

export async function handleTts(request: Request) {
  const url = ttsUrl()
  if (!url) return fail(404, 'not_configured')
  const key = readCookie(request) ?? 'none'
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= LIMIT) return fail(429, 'rate_limited')
  recent.push(now)
  hits.set(key, recent)

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > 600) return fail(400, 'bad_request')

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
    if (!upstream.ok || !upstream.body) return fail(502, 'tts_failed')
    return new Response(upstream.body, {
      // Piper's own server labels the WAV as text/html, so the type is set here.
      headers: { 'content-type': 'audio/wav', 'cache-control': 'no-store' },
    })
  } catch {
    return fail(502, 'tts_failed')
  }
}
