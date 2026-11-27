import type { Dict } from '@/content'
import { filmScenes } from './film'

// Section discovery for the rail, the palette and the header label (docs/motion-storyboard.md §3.1).
// One pure module: the home page is the eight film scenes (so the rail and the WebGL Fira never
// disagree); other pages are collected from the DOM after hydration (`main h2[id]`, `main [data-rail]`).
// Anchor of each home scene's first section. Kept here (not imported from home.ts, which pulls the product and
// solution catalogues into the client bundle); tests/sections.test.mjs checks it against `sectionAnchor`.
export const HOME_ANCHORS = { hello: 'top', pains: 'pains', demo: 'demo', team: 'products', office: 'office', solutions: 'solutions', process: 'process', final: 'faq' } as const

export type RailItem = { id: string; label: string }

// A rail needs at least this many sections; the header label shows from two.
export const RAIL_MIN = 3
export const LABEL_MIN = 2
export const LABEL_MAX = 24

// Where the active section line sits, as a share of the viewport from the top. Home reuses the film's
// ACTIVE_LINE (0.62); other pages use the storyboard's -38% line.
export const PAGE_LINE = 0.38

export function pathWithoutLocale(pathname: string): string {
  const rest = pathname.replace(/^\/(ru|en)(?=\/|$)/, '').replace(/\/+$/, '')
  return rest === '' ? '/' : rest
}

export function isHomePath(pathname: string): boolean {
  return pathWithoutLocale(pathname) === '/'
}

// Routes that are tools, reading or money screens: no rail (the palette still works everywhere).
const QUIET = /^\/(admin|cabinet|pay|demo|fira-lab|builder|terms|privacy|status|audit)(\/|$)/

export function railAllowed(pathname: string): boolean {
  return !QUIET.test(pathWithoutLocale(pathname))
}

// The static list a route knows without the DOM: the home page only. Everything else returns [] and is
// filled by `collectSections` on the client.
export function sectionsFor(pathname: string, dict: Pick<Dict, 'rail'>): RailItem[] {
  if (!isHomePath(pathname)) return []
  return filmScenes.map((s) => ({ id: HOME_ANCHORS[s.id], label: dict.rail.home[s.id] }))
}

export function trimLabel(text: string, max = LABEL_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

// `data-rail="Label RU|Label EN"` (or a single label for both).
export function parseRailAttr(value: string, locale: string): string {
  const [ru, en] = value.split('|').map((x) => x.trim())
  return (locale === 'en' ? en || ru : ru || en) ?? ''
}

export type RailSource = { id: string; text: string; rail?: string | null; railLabel?: string | null }

// Pure core of the DOM collection: sources in document order -> items. Duplicate ids and empty labels drop out.
export function itemsFromSources(sources: readonly RailSource[], locale: string): RailItem[] {
  const seen = new Set<string>()
  const out: RailItem[] = []
  for (const s of sources) {
    if (!s.id || seen.has(s.id)) continue
    const label = s.railLabel?.trim() || (s.rail ? parseRailAttr(s.rail, locale) : trimLabel(s.text))
    if (!label) continue
    seen.add(s.id)
    out.push({ id: s.id, label })
  }
  return out
}

// DOM side (client only): `main h2[id]` and `main [data-rail]` in document order.
export function collectSections(locale: string, root: ParentNode = document): RailItem[] {
  const nodes = [...root.querySelectorAll<HTMLElement>('main h2[id], main [data-rail]')]
  return itemsFromSources(
    nodes.map((el) => ({
      id: el.id,
      text: el.textContent ?? '',
      rail: el.getAttribute('data-rail'),
      railLabel: el.getAttribute('data-rail-label'),
    })),
    locale,
  )
}

// The active index from section tops (px from the viewport top), line = share of the viewport height.
// The last section whose top is at or above the line; the first before any; the last at the page bottom.
export function activeIndex(tops: readonly number[], viewport: number, line: number, atBottom = false): number {
  if (!tops.length) return -1
  if (atBottom) return tops.length - 1
  const y = viewport * line
  let cur = 0
  for (let i = 0; i < tops.length; i++) if (tops[i]! <= y) cur = i
  return cur
}

// How far the line has travelled from section `i` toward the next one, 0..1 (the Fira marker rides it).
export function sectionProgress(tops: readonly number[], i: number, viewport: number, line: number): number {
  const next = tops[i + 1]
  const top = tops[i]
  if (top === undefined || next === undefined) return 0
  const y = viewport * line
  const span = next - top
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, (y - top) / span))
}

// Page-wide wrap for keyboard `[` and `]`: the neighbour of the active section, no wrap-around.
export function neighbour(count: number, active: number, dir: 1 | -1): number {
  if (count === 0) return -1
  return Math.min(count - 1, Math.max(0, (active < 0 ? 0 : active) + dir))
}

// Palette filtering (docs/motion-storyboard.md §3.4): every whitespace-separated word of the query must be
// a substring of the lowercased label plus its aliases. No library.
export const PALETTE_MAX_ROWS = 40

export function matchesQuery(query: string, label: string, aliases = ''): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = `${label} ${aliases}`.toLowerCase()
  return words.every((w) => hay.includes(w))
}

// Is this key press a palette opener? ⌘K / Ctrl+K anywhere, "/" only outside text fields.
export function paletteKey(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean }, typing: boolean): boolean {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') return true
  return e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing
}

// Search words in both languages for the palette entries (a Russian query finds the English label and back).
export const PALETTE_ALIASES = {
  products: 'products продукты каталог catalog',
  solutions: 'solutions решения ниши niches',
  aiTeam: 'ai team teams departments отделы команды',
  how: 'how we work process stages как работаем этапы',
  builder: 'builder build project сборка проект собрать',
  blog: 'blog articles блог статьи',
  compare: 'compare comparison сравнение',
  referral: 'referral partners партнёрам рефералы',
  security: 'security protection безопасность защита',
  build: 'build project собрать сборка проект',
  ask: 'ask agent chat спросить агента чат',
  language: 'language ru en english русский язык',
  theme: 'theme dark light тема тёмная светлая',
  sound: 'sound звук',
} as const
