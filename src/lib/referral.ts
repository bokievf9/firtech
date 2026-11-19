import { referralPercent } from './pricing'

// Referral links (`/ru?ref=<slug>`). No backend: the slug travels in sessionStorage (`fir-ref`) and
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

export function storeRef(slug: string) {
  try {
    if (slug) sessionStorage.setItem(REF_STORAGE_KEY, slug)
  } catch {
    // Storage may be blocked; the referral is then simply not carried.
  }
}

export function storedRef(): string {
  try {
    return sanitizeRefSlug(sessionStorage.getItem(REF_STORAGE_KEY))
  } catch {
    return ''
  }
}
