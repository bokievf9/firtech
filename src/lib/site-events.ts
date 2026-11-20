// Site events for the weekly numbers of the пульт (contract pult-v3, «Цифры»): the browser calls
// trackEvent() (track-event.ts), which POSTs to the site's own /api/events; the route forwards to HQ
// `POST /events` (events-hq.ts). Only the event name, the path, a referral slug and the locale travel:
// never names, contacts or typed text. Pure module, shared by the browser and the server.

export const SITE_EVENTS = [
  'chat_open',
  'builder_done',
  'estimate_pdf',
  'lead_sent',
  'audit_sent',
  'ref_click',
  'cabinet_signup',
  'pay_view',
  'blog_view',
  'cabinet_offer_click',
] as const
export type SiteEventName = (typeof SITE_EVENTS)[number]
export type SiteEvent = { name: SiteEventName; path?: string; ref?: string; locale?: 'ru' | 'en' }

export const isSiteEvent = (v: unknown): v is SiteEventName => typeof v === 'string' && (SITE_EVENTS as readonly string[]).includes(v)

// The path without query or hash (they may carry keys, like the pay link's ?k=), max 200 chars.
export function cleanPath(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.startsWith('/') || v.startsWith('//')) return undefined
  const path = v.split(/[?#]/)[0]!.slice(0, 200)
  return /^\/[\w\-./~%]*$/.test(path) ? path : undefined
}

// Anything that is not a known event gives null; unknown or bad fields are dropped.
export function sanitizeEvent(input: unknown): SiteEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const b = input as Record<string, unknown>
  if (!isSiteEvent(b.name)) return null
  const out: SiteEvent = { name: b.name }
  const path = cleanPath(b.path)
  if (path) out.path = path
  if (typeof b.ref === 'string' && /^[a-z0-9_-]{1,32}$/.test(b.ref)) out.ref = b.ref
  if (b.locale === 'ru' || b.locale === 'en') out.locale = b.locale
  return out
}

// One event per name per page view (path + query): a second chat open on the same page is not news.
export const dedupeKey = (name: SiteEventName, page: string) => `${page}|${name}`

export function createDedupe() {
  const seen = new Set<string>()
  return (key: string) => {
    if (seen.has(key)) return false
    seen.add(key)
    if (seen.size > 500) seen.delete(seen.values().next().value!)
    return true
  }
}

// Do Not Track and Global Privacy Control both switch the events off.
export function trackingRefused(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean } | undefined, win?: { doNotTrack?: string | null }): boolean {
  const dnt = nav?.doNotTrack ?? win?.doNotTrack ?? null
  return dnt === '1' || dnt === 'yes' || nav?.globalPrivacyControl === true
}

// 120 events per IP per minute, like HQ's own limit.
export function createEventLimiter(max = 120, windowMs = 60_000) {
  const hits = new Map<string, number[]>()
  return (ip: string, now = Date.now()) => {
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs)
    if (hits.size > 5000) hits.clear()
    if (recent.length >= max) {
      hits.set(ip, recent)
      return true
    }
    recent.push(now)
    hits.set(ip, recent)
    return false
  }
}
