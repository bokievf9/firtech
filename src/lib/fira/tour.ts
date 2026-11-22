import { filmScenes } from '../film'
import type { CompanionKind } from '../film'
import type { Emotion } from './pose'

// The guided tour «Покажи сайт» (owner 2026-11-23). It never starts by itself and never blocks reading:
// the visitor starts it from Fira's menu, «Дальше» (or the right arrow) moves on, «Хватит» (or Esc) ends it.
// The state lives in the component only (no URL hash, no storage).
export const TOUR_AUTOSTART = false as const
export const TOUR_MIN = 3
export const TOUR_MAX = 6

export type TourStop = { key: string; /** CSS selector of the anchor; none = she only talks */ selector?: string; emotion: Emotion }

/** The home page: the eight scenes of the film, in order (the lines are `film.scenes`). */
export const homeStops: readonly TourStop[] = filmScenes.map((s) => ({ key: s.id, selector: `[data-film-scene="${s.id}"]`, emotion: 'point' as const }))

// Inner pages: the anchors are `[data-tour="<key>"]` in the page, picked by priority; keys the page lacks are
// skipped. Product pages carry their section ids; /ai-team, the builder and the cabinet have their own.
const productKeys = ['demo', 'capabilities', 'brain', 'day', 'flow', 'week', 'roles', 'skills', 'myday', 'scope', 'included', 'price', 'plans', 'offer', 'next', 'start'] as const
export const tourPriority: Partial<Record<CompanionKind, readonly string[]>> = {
  product: productKeys,
  personal: productKeys,
  service: productKeys,
  solution: productKeys,
  aiTeam: ['top', 'levels', 'teams', 'agents', 'proof'],
  builder: ['builder'],
  cabinet: ['login'],
}

// Stops without an anchor on the page: she only says the line (the builder's steps are one screen each).
export const tourExtras: Partial<Record<CompanionKind, readonly string[]>> = {
  builder: ['builderPrice', 'builderAsk'],
  cabinet: ['loginAsk'],
}

/**
 * The stops of an inner page. `present` are the `data-tour` keys found in the page, in page order.
 * Known keys win by priority (at most TOUR_MAX), the rest of the page fills up to TOUR_MIN, and the
 * result keeps the page order; the page's text-only extras come last.
 */
export function pickStops(present: readonly string[], kind: CompanionKind | null): string[] {
  const unique = [...new Set(present)]
  const priority = (kind && tourPriority[kind]) || []
  const known = unique.filter((k) => priority.includes(k)).sort((a, b) => priority.indexOf(a) - priority.indexOf(b))
  const chosen = new Set(known.slice(0, TOUR_MAX))
  if (chosen.size === 0 && unique.length > 0) {
    // A page without known anchors: spread the stops over the whole page.
    const n = Math.min(TOUR_MAX, unique.length)
    for (let i = 0; i < n; i++) chosen.add(unique[n === 1 ? 0 : Math.round((i * (unique.length - 1)) / (n - 1))]!)
  }
  for (const k of unique) if (chosen.size < TOUR_MIN && !chosen.has(k)) chosen.add(k)
  const extras = (kind && tourExtras[kind]) || []
  const anchored = unique.filter((k) => chosen.has(k)).slice(0, Math.max(0, TOUR_MAX - extras.length))
  return [...anchored, ...extras]
}

export const isExtra = (kind: CompanionKind | null, key: string) => Boolean(kind && tourExtras[kind]?.includes(key))
