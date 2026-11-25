import { entryByKey, onEntryPage, type SiteEntry } from './sitemap'

// «Отведи меня»: the pieces shared by the chat cards, the site map panel, the chips and the deep links.
// One window event carries a request to the guide (`firtech:guide-go`), which routes, scrolls and pulses.
export const GUIDE_GO_EVENT = 'firtech:guide-go' // detail { key } or { selectors }
export const GUIDE_TOUR_START_EVENT = 'firtech:guide-tour-start' // start the tour of this page
export const FIRA_PARAM = 'fira'

export type GoDetail = { key?: string; selectors?: readonly string[]; fallback?: string }

export function requestGo(detail: GoDetail) {
  window.dispatchEvent(new CustomEvent(GUIDE_GO_EVENT, { detail }))
}
export function requestTour() {
  window.dispatchEvent(new CustomEvent(GUIDE_TOUR_START_EVENT))
}

export type FiraParam = { type: 'tour' } | { type: 'go'; key: string }

/** `?fira=tour` and `?fira=go:<key>`; anything else (an unknown key too) is ignored. */
export function parseFiraParam(search: string): FiraParam | null {
  const raw = new URLSearchParams(search).get(FIRA_PARAM)
  if (!raw) return null
  if (raw === 'tour') return { type: 'tour' }
  const m = /^go:([a-z0-9-]{1,48})$/.exec(raw)
  return m && entryByKey(m[1]!) ? { type: 'go', key: m[1]! } : null
}

/** The URL without the `fira` parameter (the rest of the query and the hash stay). */
export function withoutFiraParam(path: string, search: string, hash: string): string {
  const p = new URLSearchParams(search)
  p.delete(FIRA_PARAM)
  const q = p.toString()
  return `${path}${q ? `?${q}` : ''}${hash}`
}

/** Where a click on the entry leads: the page itself when the visitor is already there. */
export function goPlan(entry: SiteEntry, pathname: string, locale: string): { navigate: boolean; to: string } {
  const here = onEntryPage(entry, pathname)
  return { navigate: !here, to: `/${locale}${entry.path}` }
}

/** The fallback target when the section is missing on the page (a signed-out cabinet has no tabs): the first heading. */
export const FALLBACK_SELECTOR = 'main h1, #main h1, h1'
