// The tour of a page is offered once per page and browser (owner 2026-11-25: «предлагается один раз, всегда в меню»).
// localStorage, always inside try/catch by the caller; the tour itself never starts by itself (TOUR_AUTOSTART=false).
export const TOUR_OFFER_KEY = 'fir-tour-offered'
export const SCENE_SEEN_KEY = 'fir-scene-seen' // sessionStorage: the film scenes whose line was shown
export const SCENE_OFF_KEY = 'fir-scene-off' // sessionStorage: the visitor dismissed a scene line, no more of them
export const SCENE_MIN_WIDTH = 400

export function offeredList(raw: string | null): string[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-80) : []
  } catch {
    return []
  }
}
export const offerDue = (list: readonly string[], slug: string) => !list.includes(slug)
export const markOffered = (list: readonly string[], slug: string) => (list.includes(slug) ? [...list] : [...list, slug].slice(-80))

/** Scene lines on the home page: off under reduced motion and on phones narrower than 400 px. */
export function sceneLinesOn(reducedMotion: boolean, width: number): boolean {
  return !reducedMotion && width >= SCENE_MIN_WIDTH
}
