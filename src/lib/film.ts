import type { Emotion } from './fira/pose'
import type { HomeSection } from './home'

// The home page as a film (owner 2026-11-22, docs/site-design-notes.md «Главная-фильм»): eight scenes,
// each one or two home sections, with Fira on her mark and one line of hers. The page renders the
// sections in `homeSections` order and wraps them in these scenes; the lines are `film.scenes` in the
// dictionaries. Tested in tests/film.test.mjs.
export const filmScenes = [
  { id: 'hello', sections: ['hero'], emotion: 'wave' },
  { id: 'pains', sections: ['pains'], emotion: 'listening' },
  { id: 'demo', sections: ['demo'], emotion: 'point' },
  { id: 'team', sections: ['products'], emotion: 'happy' },
  { id: 'office', sections: ['office'], emotion: 'talking' },
  { id: 'solutions', sections: ['solutions'], emotion: 'thinking' },
  { id: 'process', sections: ['process', 'pricing'], emotion: 'talking' },
  { id: 'final', sections: ['faq'], emotion: 'wave' },
] as const satisfies readonly { id: string; sections: readonly HomeSection[]; emotion: Emotion }[]

export type FilmSceneId = (typeof filmScenes)[number]['id']
export type FilmScene = (typeof filmScenes)[number]

// The scene a section opens (its first section), else null: the page puts the scene wrapper there.
export function sceneStartingAt(section: HomeSection): FilmScene | null {
  return filmScenes.find((s) => s.sections[0] === section) ?? null
}

export function sceneOf(section: HomeSection): FilmScene | null {
  return filmScenes.find((s) => (s.sections as readonly HomeSection[]).includes(section)) ?? null
}

// Film mode (one WebGL Fira travelling between the marks) needs a wide screen, motion allowed and
// WebGL; everything else gets the plain sections with the flat Fira on each mark.
export const FILM_MIN_WIDTH = 1024

// Where Fira stands, from the viewport: the active scene is the one under this line (a share of the
// viewport height from the top), so she reaches the next mark a little before it is centred.
export const ACTIVE_LINE = 0.62

export function activeScene(tops: readonly { id: string; top: number; bottom: number }[], viewport: number): string | null {
  const line = viewport * ACTIVE_LINE
  let current: string | null = null
  for (const s of tops) if (s.top <= line && s.bottom > line) current = s.id
  if (current) return current
  // Above the first scene or in a gap: the last one whose top passed the line.
  for (const s of tops) if (s.top <= line) current = s.id
  return current ?? tops[0]?.id ?? null
}

// A mark counts as «in shot» when it is fully below the header and above the bottom edge.
export function markInShot(rect: { top: number; bottom: number }, viewport: number, header = 76): boolean {
  return rect.top >= header && rect.bottom <= viewport - 8
}

// The page companion (inner pages): one line per kind of page, picked from the path without the
// locale. Home has its own narration, so it gets none.
export const companionKinds = ['product', 'personal', 'service', 'solution', 'solutions', 'builder', 'cabinet', 'aiTeam', 'blog', 'howWeWork', 'other'] as const
export type CompanionKind = (typeof companionKinds)[number]

export function companionKind(pathname: string): CompanionKind | null {
  const rest = pathname.replace(/^\/(ru|en)(?=\/|$)/, '').replace(/\/+$/, '')
  if (rest === '' || rest === '/') return null
  if (/^\/(admin|fira-lab)(\/|$)/.test(rest)) return null
  if (/^\/products\/personal(\/|$)/.test(rest)) return 'personal'
  if (/^\/products\/[^/]+/.test(rest)) return 'product'
  if (/^\/services\/[^/]+/.test(rest)) return 'service'
  if (/^\/solutions\/[^/]+/.test(rest)) return 'solution'
  if (rest === '/solutions') return 'solutions'
  if (/^\/builder(\/|$)/.test(rest)) return 'builder'
  if (/^\/cabinet(\/|$)/.test(rest)) return 'cabinet'
  if (/^\/ai-team(\/|$)/.test(rest)) return 'aiTeam'
  if (/^\/blog(\/|$)/.test(rest)) return 'blog'
  if (rest === '/how-we-work') return 'howWeWork'
  return 'other'
}

// One line per page and session: the key is the path, so a second visit to the same page stays quiet
// while a new page may speak once.
export const COMPANION_SEEN_KEY = 'fir-companion-seen'

export function seenList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-50) : []
  } catch {
    return []
  }
}

export function markSeen(list: readonly string[], key: string): string[] {
  return [...list.filter((k) => k !== key), key].slice(-50)
}
