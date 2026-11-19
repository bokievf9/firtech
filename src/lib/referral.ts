import { referralPercent } from './pricing'

// Referral links (`/ru?ref=<slug>`). No backend: the slug travels in localStorage for 30 days (`fir-ref`) and
// then in the lead as `source: 'ref:<slug>'`, which HQ already reads as the referrer.
export const REF_STORAGE_KEY = 'fir-ref'
export const REF_PARAM = 'ref'
export const REF_MAX = 32

// Copy carries `{percent}`; the number comes from pricing.ts.
export function fillReferralPercent(text: string) {
  return text.replaceAll('{percent}', `${referralPercent}%`)
}

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

// Letters, digits, `_`, `-`, max 32, lower case, no leading `@`. Cyrillic names are transliterated
// and spaces become `_`. A dot becomes `_` too: HQ accepts `ref:[a-z0-9_-]` only. Empty when
// nothing usable is left.
export function sanitizeRefSlug(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => CYRILLIC[c] ?? '')
    .replace(/[\s.]+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, REF_MAX)
}

export function refLink(origin: string, locale: string, slug: string): string {
  return `${origin.replace(/\/$/, '')}/${locale}?${REF_PARAM}=${slug}`
}

// The lead's `source` for a stored slug; empty when there is none.
export function refSource(slug: unknown): string {
  const clean = sanitizeRefSlug(slug)
  return clean ? `ref:${clean}` : ''
}

// Reads `?ref=` from a query string.
export function refFromSearch(search: string): string {
  return sanitizeRefSlug(new URLSearchParams(search).get(REF_PARAM))
}

// The slug lives 30 days in localStorage as {"slug","exp"} (exp = ms timestamp); when localStorage
// throws (private mode, blocked), sessionStorage holds it for the tab. An old plain string in
// sessionStorage (before 2026-11-19) is still read.
export const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function encodeStoredRef(slug: string, now = Date.now()): string {
  return JSON.stringify({ slug, exp: now + REF_TTL_MS })
}

// The slug of a stored value, '' when it is empty, broken or expired.
export function decodeStoredRef(raw: string | null, now = Date.now()): string {
  if (!raw) return ''
  try {
    const v: unknown = JSON.parse(raw)
    if (v && typeof v === 'object') {
      const { slug, exp } = v as { slug?: unknown; exp?: unknown }
      return typeof exp === 'number' && exp > now ? sanitizeRefSlug(slug) : ''
    }
  } catch {
    // not JSON: a plain slug from the old sessionStorage format
  }
  return sanitizeRefSlug(raw)
}

export function storeRef(slug: string) {
  if (!slug) return
  try {
    localStorage.setItem(REF_STORAGE_KEY, encodeStoredRef(slug))
    return
  } catch {
    // localStorage may be blocked; fall back to the tab.
  }
  try {
    sessionStorage.setItem(REF_STORAGE_KEY, slug)
  } catch {
    // The referral is then simply not carried.
  }
}

export function storedRef(): string {
  try {
    const slug = decodeStoredRef(localStorage.getItem(REF_STORAGE_KEY))
    if (slug) return slug
    localStorage.removeItem(REF_STORAGE_KEY)
  } catch {
    // fall through to sessionStorage
  }
  try {
    return sanitizeRefSlug(sessionStorage.getItem(REF_STORAGE_KEY))
  } catch {
    return ''
  }
}

// `t.me/firtech_bot` gets `?start=ref_<slug>`, so the bot can credit the referrer. A link that
// already has `start` (the demo salon link) is left as it is: `demo_salon` wins.
export function withRefStart(href: string, slug: string): string {
  if (!slug) return href
  try {
    const u = new URL(href)
    if (u.hostname !== 't.me' || u.pathname.toLowerCase() !== '/firtech_bot') return href
    if (u.searchParams.has('start')) return href
    u.searchParams.set('start', `ref_${slug}`)
    return u.toString()
  } catch {
    return href
  }
}
