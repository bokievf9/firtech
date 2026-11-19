import { createDedupe, dedupeKey, sanitizeEvent, trackingRefused, type SiteEventName } from './site-events'

// Browser side of the site events (site-events.ts): fire and forget, once per event per page view,
// nothing at all under Do Not Track or Global Privacy Control. Never throws, never blocks the page.
const fresh = createDedupe()

export function trackEvent(name: SiteEventName, extra: { ref?: string } = {}) {
  if (typeof window === 'undefined') return
  try {
    if (trackingRefused(navigator as Navigator & { globalPrivacyControl?: boolean }, window as unknown as { doNotTrack?: string })) return
    const { pathname, search } = window.location
    if (!fresh(dedupeKey(name, pathname + search))) return
    const first = pathname.split('/')[1]
    const body = sanitizeEvent({ name, path: pathname, ref: extra.ref, locale: first === 'en' ? 'en' : first === 'ru' ? 'ru' : undefined })
    if (!body) return
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {})
  } catch {
    // Analytics must never break the page.
  }
}
