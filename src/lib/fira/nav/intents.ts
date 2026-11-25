import { entryByKey, siteMap, synonymsOf, type Loc, type SiteEntry } from './sitemap'

// «Отведи меня» (Fira nav 2.0): a local intent matcher, no model. A short question or a bare word («цены», «сколько
// стоит салон», «как оплатить», «what happens after the request») becomes a target of the site map. Words are
// compared by stems (a common prefix), phrases as bags of words, so word order and endings do not matter.
// Long free-form messages are never taken: they go to the chat as before. Tested in tests/fira-nav.test.mjs.

const STOP = new Set([
  // function words and polite filler, both languages (phrases are stripped the same way)
  'как', 'что', 'где', 'у', 'а', 'и', 'в', 'во', 'на', 'для', 'по', 'с', 'со', 'к', 'о', 'об', 'от', 'это', 'эти', 'ли', 'же', 'бы', 'вы', 'вас', 'мы', 'я', 'ты', 'мне', 'нам', 'меня', 'нас', 'ещё',
  'пожалуйста', 'хочу', 'хотел', 'хотела', 'хотим', 'покажи', 'покажите', 'отведи', 'отведите', 'открой', 'откройте', 'перейди', 'найди', 'нужно', 'скажи', 'расскажи', 'можете',
  'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'is', 'it', 'do', 'does', 'i', 'me', 'how', 'what', 'where', 'you', 'your', 'are', 'we', 'please', 'show', 'take', 'open', 'go', 'find', 'tell', 'can', 'want', 'need',
])

/** Lower case, ё to е, letters and digits only, split into stems-ready words without the filler. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w))
}

/** Same word modulo an ending: a common prefix covering all but one letter of the shorter word. */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  const min = Math.min(a.length, b.length)
  if (min < 3 || Math.abs(a.length - b.length) > 3) return false
  let p = 0
  while (p < min && a[p] === b[p]) p++
  // A short word («сто», «бот», «app») only takes one more letter, so «сто» is not «стоит».
  if (min < 4) return p === min && Math.abs(a.length - b.length) <= 1
  return p >= 3 && p >= min - 1
}

type Phrase = { entry: SiteEntry; words: string[] }
let index: Phrase[] | null = null
function phrases(): Phrase[] {
  if (index) return index
  const out: Phrase[] = []
  for (const entry of siteMap) {
    const seen = new Set<string>()
    for (const loc of ['ru', 'en'] as const) {
      for (const syn of synonymsOf(entry, loc)) {
        const words = tokens(syn)
        const id = words.join(' ')
        if (words.length === 0 || seen.has(id)) continue
        seen.add(id)
        out.push({ entry, words })
      }
    }
  }
  index = out
  return out
}

/** `cover` is the share of the message's words that the matched phrase accounts for (1 = the whole message). */
export type IntentMatch = { entry: SiteEntry; score: number; cover: number }

/** Every entry that the words point at, best first. Scores: 2 per word of the matched phrase, +1 base, +2 when the phrase is the whole query. */
export function rank(text: string): IntentMatch[] {
  const q = tokens(text)
  if (q.length === 0) return []
  const best = new Map<string, { score: number; cover: number }>()
  for (const { entry, words } of phrases()) {
    if (!words.every((w) => q.some((x) => sameWord(w, x)))) continue
    let score = 2 * words.length + 1
    if (words.length >= q.length) score += 2
    const prev = best.get(entry.key)
    const cover = Math.min(1, words.length / q.length)
    if (!prev) best.set(entry.key, { score, cover })
    else best.set(entry.key, { score: Math.max(prev.score, score) + 0.1, cover: Math.max(prev.cover, cover) })
  }
  return [...best].map(([key, v]) => ({ entry: entryByKey(key)!, ...v })).sort((a, b) => b.score - a.score || siteMap.indexOf(a.entry) - siteMap.indexOf(b.entry))
}

const NAV_LEAD = /^(покажи|покажите|отведи|отведите|перейди|открой|найди|где|show|take|open|find|where|go)(?![\p{L}\p{N}])/iu
// A greeting opens a conversation, not a trip: «Привет, сколько стоит сайт?» is for the chat.
const GREETING = /^(привет|здравствуй|добрый|доброе|hello|hi|hey|good (morning|day|evening))(?![\p{L}\p{N}])/iu
const MIN_COVER = 0.6
export const MIN_SCORE = 5
const MAX_WORDS = 6
const MAX_WORDS_NAV = 9

export type IntentResult = { top: IntentMatch; alts: IntentMatch[] }

/**
 * The answer to a chat message: a target when the message is short and clearly about one place, else null (the chat
 * answers). A one-word hit inside a longer sentence is not enough, a phrase or the whole message must match.
 */
export function matchIntent(text: string): IntentResult | null {
  const raw = text.trim()
  if (!raw || raw.length > 120) return null
  const nav = NAV_LEAD.test(raw)
  if (GREETING.test(raw) && !nav) return null
  const words = tokens(raw).length
  if (words === 0 || words > (nav ? MAX_WORDS_NAV : MAX_WORDS)) return null
  // Four words or more: the phrase must be most of the message («у меня салон, нужна запись клиентов» is a story for the chat).
  const ok = (m: IntentMatch) => m.score >= MIN_SCORE && (words <= 3 || m.cover >= MIN_COVER)
  const ranked = rank(raw)
  const top = ranked[0]
  if (!top || !ok(top)) return null
  const alts = ranked.slice(1).filter((m) => ok(m) && m.score >= top.score - 1).slice(0, 1)
  return { top, alts }
}

/** The menu search: loose, every hit counts, partial words too («цен» finds the prices). */
export function searchMap(text: string, locale: Loc, limit = 6): SiteEntry[] {
  const q = tokens(text)
  if (q.length === 0) return []
  const score = new Map<string, number>()
  for (const m of rank(text)) score.set(m.entry.key, m.score)
  const prefix = q[q.length - 1]!
  if (prefix.length >= 2) {
    for (const entry of siteMap) {
      const hit = [entry.name[locale], ...synonymsOf(entry, locale)].some((s) => tokens(s).some((w) => w.startsWith(prefix)))
      if (hit) score.set(entry.key, Math.max(score.get(entry.key) ?? 0, 2))
    }
  }
  return [...score]
    .sort((a, b) => b[1] - a[1] || siteMap.findIndex((s) => s.key === a[0]) - siteMap.findIndex((s) => s.key === b[0]))
    .slice(0, limit)
    .map(([key]) => entryByKey(key)!)
}
