import { pathWithoutLocale } from './sections'

// Page transition direction (docs/motion-storyboard.md section 4). Pure: the rank table of the storyboard and
// the rule "deeper = forward, shallower = back, equal rank = sibling (a forward slide at half distance)".
// Quiet, legal, cabinet, pay, demo, Fira Lab and unknown paths (the 404) never slide: they fade.
export type NavDirection = 'forward' | 'back' | 'sibling' | 'fade'

// Catalog pages (rank 1): the first path segment decides. `services/[slug]` is a catalog page too.
const CATALOG = new Set(['solutions', 'ai-team', 'blog', 'builder', 'compare', 'how-we-work', 'referral', 'security', 'status', 'audit', 'pay-how', 'services'])
// Pages that have a detail level below the catalog page (rank 2).
const DETAIL_PARENTS = new Set(['solutions', 'ai-team', 'blog', 'builder'])
const DETAIL_ONLY = new Set(['products'])

// Rank in the map of the storyboard, or null for a route that fades (quiet, legal, cabinet, pay, demo, 404).
export function routeRank(pathname: string): number | null {
  const rest = pathWithoutLocale(pathname)
  if (rest === '/') return 0
  const parts = rest.split('/').filter(Boolean)
  const first = parts[0] ?? ''
  if (DETAIL_ONLY.has(first)) return parts.length === 2 ? 2 : null
  if (!CATALOG.has(first)) return null
  if (parts.length === 1) return 1
  if (first === 'services') return parts.length === 2 ? 1 : null
  if (DETAIL_PARENTS.has(first)) return 2
  return null
}

export function localeOf(pathname: string): string | null {
  return /^\/(ru|en)(?=\/|$)/.exec(pathname)?.[1] ?? null
}

export function navDirection(from: string, to: string): NavDirection {
  const a = pathWithoutLocale(from)
  const b = pathWithoutLocale(to)
  // The language switch is a crossfade, the same page in the other language.
  if (localeOf(from) !== localeOf(to)) return 'fade'
  if (a === b) return 'fade'
  const ra = routeRank(from)
  const rb = routeRank(to)
  if (ra === null || rb === null) return 'fade'
  if (rb > ra) return 'forward'
  if (rb < ra) return 'back'
  return 'sibling'
}
