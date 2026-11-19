import { z } from 'zod'
import { visitorIpHeader } from './public-post'

// Free audit: request shape of POST /api/audit and of HQ's POST /audit (agents/docs/public-api.md).
export const AUDIT_URL_MAX = 200

// http(s) with a dotted host. IPs and local names are refused here too, so the visitor gets the
// answer at once instead of an HQ 400.
export function isAuditUrl(value: string): boolean {
  if (value.length > AUDIT_URL_MAX) return false
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  if (!host.includes('.') || host.endsWith('.') || host.startsWith('.')) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return false
  if (host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal')) return false
  return true
}

// Telegram @username (3..32 after the @) or a phone (7..15 digits, with + - ( ) and spaces).
export function isAuditContact(value: string): boolean {
  if (value.length < 3 || value.length > 64) return false
  if (/^@[A-Za-z0-9_]{3,32}$/.test(value)) return true
  if (!/^\+?[\d\s()-]+$/.test(value)) return false
  const digits = value.replace(/\D/g, '').length
  return digits >= 7 && digits <= 15
}

export const auditSchema = z.object({
  url: z.string().trim().max(AUDIT_URL_MAX).refine(isAuditUrl),
  contact: z.string().trim().min(3).max(64).refine(isAuditContact),
  name: z.string().trim().max(80).optional().default(''),
  locale: z.enum(['ru', 'en']),
  // Referral slug source (`ref:<slug>`), same value the lead form sends as `source`.
  ref: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_:.-]{1,40}$/)
    .optional(),
  // Honeypot: hidden from people, bots fill it in.
  website: z.string().max(200).optional().default(''),
})
export type AuditInput = z.infer<typeof auditSchema>

export type AuditAnswer =
  | { ok: true; duplicate?: boolean; mock?: boolean }
  | { ok: false; error: string }

export type AuditEnv = Record<string, string | undefined>
export const AUDIT_TIMEOUT_MS = 8000

// Client side helper: a site written without a scheme gets https://, a bare nick gets an @.
export function normalizeAuditUrl(raw: string): string {
  const v = raw.trim()
  return v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? `https://${v}` : v
}
export function normalizeAuditContact(raw: string): string {
  const v = raw.trim()
  return /^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(v) ? `@${v}` : v
}

// Forwards to HQ. Never throws, never returns the token or the URL. Without HQ configured:
// development gets a mock success, production an honest error.
export async function forwardAudit(
  input: Omit<AuditInput, 'website'>,
  env: AuditEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  ip?: string,
): Promise<AuditAnswer & { status: number }> {
  const base = env.LEAD_INTAKE_URL?.trim().replace(/\/+$/, '')
  const token = env.LEAD_INTAKE_TOKEN?.trim()
  if (!base || !token) {
    if (env.NODE_ENV !== 'production') return { ok: true, mock: true, status: 200 }
    return { ok: false, error: 'not_configured', status: 503 }
  }
  try {
    const res = await fetchImpl(`${base}/audit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lead-token': token, ...visitorIpHeader(ip) },
      body: JSON.stringify({
        url: input.url,
        contact: input.contact,
        locale: input.locale,
        ...(input.name ? { name: input.name } : {}),
        ...(input.ref ? { ref: input.ref } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(AUDIT_TIMEOUT_MS),
    })
    if (res.status === 400) return { ok: false, error: 'invalid', status: 400 }
    if (res.status === 429) return { ok: false, error: 'rate_limited', status: 429 }
    if (!res.ok) return { ok: false, error: 'unavailable', status: 502 }
    const body = (await res.json().catch(() => null)) as { ok?: unknown; duplicate?: unknown } | null
    if (!body || body.ok !== true) return { ok: false, error: 'unavailable', status: 502 }
    return body.duplicate === true ? { ok: true, duplicate: true, status: 200 } : { ok: true, status: 200 }
  } catch {
    return { ok: false, error: 'unavailable', status: 502 }
  }
}

// Per-IP limit: 5 per 10 minutes, in memory (one PM2 process).
export function createAuditLimiter(max = 5, windowMs = 10 * 60 * 1000) {
  const hits = new Map<string, number[]>()
  return function limited(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    recent.push(now)
    hits.set(key, recent)
    if (hits.size > 5000) hits.clear()
    return recent.length > max
  }
}
