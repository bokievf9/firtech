// Fira live 1.1: the shared state of Fira (what she feels and says now), the contract between the chat (F1)
// and her presence/animation (F2). Pure module, no React and no DOM: the store works on injectable timers so it is
// tested in node (tests/fira-live.test.mjs). The React side is components/fira/fira-live-store.ts. F2 may add
// fields here, nothing else changes the shape.
import { WORD_MS, splitWords } from './guide'

export type FiraState = 'idle' | 'listening' | 'thinking' | 'talking' | 'happy' | 'sorry' | 'surprised' | 'sleep' | 'wave' | 'point'
export type FiraBubble = { text: string; dots: boolean; wordsShown: number }
export type FiraLive = { state: FiraState; since: number; bubble: FiraBubble | null; pointTo?: string }

/** thinking shows the dots at least this long before the first word. */
export const DOTS_MIN_MS = 600
export const HAPPY_MS = 1200
export const SORRY_MS = 2000
export const POINT_MS = 2800
export const SLEEP_MS = 120_000
export const HINT_AFTER_MS = 10_000

// ---- the events on window ('fira'): open-chat, hint, reaction
export type FiraEvent = { type: 'open-chat' | 'hint' | 'reaction'; source?: string; key?: string; text?: string }
export const FIRA_EVENT = 'fira'
export function dispatchFira(detail: FiraEvent) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(FIRA_EVENT, { detail }))
}

// ---- the store
export type Timers = {
  now: () => number
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (id: unknown) => void
}
export type SayOptions = { stream?: AsyncIterable<string> }

export type FiraStore = ReturnType<typeof createFiraStore>

export function createFiraStore(opts: { timers?: Timers; reduced?: () => boolean } = {}) {
  const t: Timers = opts.timers ?? {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  }
  const reduced = opts.reduced ?? (() => false)
  let snap: FiraLive = { state: 'idle', since: t.now(), bubble: null }
  const subs = new Set<() => void>()
  let settleTimer: unknown = null
  let sleepTimer: unknown = null
  let sleepMs = 0
  let run = 0 // the current say(): a newer one cancels the older

  const emit = () => {
    for (const f of [...subs]) f()
  }
  const put = (patch: Partial<FiraLive>) => {
    snap = { ...snap, ...patch }
    emit()
  }
  const clearSettle = () => {
    if (settleTimer !== null) t.clearTimeout(settleTimer)
    settleTimer = null
  }
  const armSleep = () => {
    if (sleepTimer !== null) t.clearTimeout(sleepTimer)
    sleepTimer = null
    if (!sleepMs || reduced()) return
    sleepTimer = t.setTimeout(() => {
      sleepTimer = null
      if (snap.state === 'idle') set('sleep')
    }, sleepMs)
  }

  function set(state: FiraState) {
    // Reduced motion: she never sleeps and never waves.
    if (reduced() && (state === 'sleep' || state === 'wave')) return
    clearSettle()
    const back = state === 'happy' ? HAPPY_MS : state === 'sorry' ? SORRY_MS : state === 'point' ? POINT_MS : 0
    snap = { ...snap, state, since: t.now(), ...(state === 'point' ? {} : { pointTo: undefined }) }
    if (back) {
      settleTimer = t.setTimeout(() => {
        settleTimer = null
        snap = { ...snap, state: 'idle', since: t.now(), pointTo: undefined, bubble: state === 'happy' || state === 'sorry' ? null : snap.bubble }
        emit()
        armSleep()
      }, back)
    }
    emit()
    if (state === 'idle') armSleep()
  }

  /** Back to idle, but only from `from` (a blur must not end a talking state). */
  function release(from: FiraState) {
    if (snap.state === from) set('idle')
  }

  function dots(on: boolean) {
    if (on) {
      run++
      if (reduced()) {
        set('thinking')
        return
      }
      set('thinking')
      put({ bubble: { text: '', dots: true, wordsShown: 0 }, since: t.now() })
    } else if (snap.bubble) {
      put({ bubble: { ...snap.bubble, dots: false } })
    }
  }

  const sleepFor = (ms: number) => new Promise<void>((r) => void t.setTimeout(r, ms))

  /** Say a line: word by word (≈180 ms a word) or, with a stream, as the words arrive. Resolves when she has said it. */
  async function say(text: string, o: SayOptions = {}): Promise<void> {
    const me = ++run
    const startedThinking = snap.state === 'thinking' ? snap.since : t.now()
    const full = (s: string) => splitWords(s)
    const quick = reduced()

    let acc = text
    let done = !o.stream
    // The stream is read in the background; the reveal loop below paces it.
    if (o.stream) {
      void (async () => {
        try {
          for await (const chunk of o.stream!) {
            if (me !== run) return
            acc += chunk
          }
        } catch {
          // A broken stream ends the line where it is; the caller reports the error.
        }
        done = true
      })()
    }

    // Complete words only while the stream is open (a chunk may end in the middle of a word).
    const available = () => {
      const all = full(acc)
      if (done || /\s$/.test(acc)) return all.length
      return Math.max(0, all.length - 1)
    }

    if (quick) {
      // No dots, the whole text at once.
      while (!done) await sleepFor(20)
      if (me !== run) return
      const total = full(acc).length
      set('talking')
      put({ bubble: { text: acc, dots: false, wordsShown: total } })
      set('happy')
      return
    }

    // Dots for at least DOTS_MIN_MS, then the first word.
    if (snap.state !== 'thinking' || !snap.bubble) {
      set('thinking')
      put({ bubble: { text: '', dots: true, wordsShown: 0 } })
    }
    let shown = 0
    for (;;) {
      if (me !== run) return
      const wait = startedThinking + DOTS_MIN_MS - t.now()
      if (wait > 0) {
        await sleepFor(wait)
        continue
      }
      const avail = available()
      if (avail > shown) {
        shown++
        if (snap.state !== 'talking') set('talking')
        put({ bubble: { text: acc, dots: false, wordsShown: shown } })
        if (done && shown >= full(acc).length) break
        await sleepFor(WORD_MS)
        continue
      }
      if (done) break
      await sleepFor(40)
    }
    if (me !== run) return
    put({ bubble: { text: acc, dots: false, wordsShown: full(acc).length } })
    set('happy')
  }

  function point(id: string) {
    set('point')
    put({ pointTo: id })
  }
  function wake() {
    if (snap.state === 'sleep') set('idle')
    else armSleep()
  }
  function sleepAfter(ms: number) {
    sleepMs = ms
    armSleep()
  }
  /** A failed answer: the apology, then idle. */
  function fail() {
    run++
    set('sorry')
    put({ bubble: null })
  }
  function clearBubble() {
    if (snap.bubble) put({ bubble: null })
  }
  function destroy() {
    run++
    clearSettle()
    if (sleepTimer !== null) t.clearTimeout(sleepTimer)
    sleepTimer = null
    subs.clear()
  }

  return {
    getSnapshot: () => snap,
    subscribe(f: () => void) {
      subs.add(f)
      return () => void subs.delete(f)
    },
    set,
    release,
    say,
    dots,
    point,
    wake,
    sleepAfter,
    fail,
    clearBubble,
    destroy,
  }
}

// ---- the stream: POST /api/chat?stream=1 answers text/event-stream
// data: {"t":"<chunk>"} ... data: {"done":true,"cards":[...],"meta":{...}}
export type FiraCardKind = 'page' | 'builder' | 'agent' | 'article'
export type FiraCard = { kind: FiraCardKind; title: string; href: string }
export type SseEvent = { t: string } | { done: true; cards: FiraCard[]; meta?: Record<string, unknown> }

export function sseLine(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

/** Splits what has arrived so far into events; `rest` is an unfinished tail to prepend to the next read. */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const parts = buffer.replace(/\r\n/g, '\n').split('\n\n')
  const rest = parts.pop() ?? ''
  const events: SseEvent[] = []
  for (const block of parts) {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue
      try {
        const v: unknown = JSON.parse(line.slice(5).trim())
        if (!v || typeof v !== 'object') continue
        const o = v as Record<string, unknown>
        if (typeof o.t === 'string') events.push({ t: o.t })
        else if (o.done === true) {
          events.push({ done: true, cards: cleanCards(o.cards), ...(o.meta && typeof o.meta === 'object' ? { meta: o.meta as Record<string, unknown> } : {}) })
        }
      } catch {
        // A garbled line is skipped.
      }
    }
  }
  return { events, rest }
}

const KINDS: readonly FiraCardKind[] = ['page', 'builder', 'agent', 'article']
const HREF = /^\/(ru|en)(\/[a-z0-9\-/?=&#_.~]*)?$/i

/** Cards from the wire: only the four kinds and only paths of this site. */
export function cleanCards(raw: unknown): FiraCard[] {
  if (!Array.isArray(raw)) return []
  const out: FiraCard[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const c = x as Record<string, unknown>
    if (!KINDS.includes(c.kind as FiraCardKind) || typeof c.title !== 'string' || typeof c.href !== 'string') continue
    if (!HREF.test(c.href) || c.href.includes('//')) continue
    out.push({ kind: c.kind as FiraCardKind, title: c.title.replace(/[<>]/g, '').slice(0, 80), href: c.href })
  }
  return out.slice(0, 3)
}

/** The reply as short chunks of whole words (the last one keeps no trailing space). */
export function chunkText(text: string, words = 2): string[] {
  const w = text.split(/(\s+)/).filter((x) => x !== '')
  const out: string[] = []
  let cur = ''
  let n = 0
  for (const part of w) {
    cur += part
    if (!/^\s+$/.test(part) && ++n >= words) {
      out.push(cur)
      cur = ''
      n = 0
    }
  }
  if (cur) out.push(cur)
  return out
}

// ---- link cards: which pages the reply is about (words in the reply, never a model decision)
type Target = { kind: FiraCardKind; path: string; re: RegExp; ru: string; en: string }
const TARGETS: readonly Target[] = [
  { kind: 'agent', path: '/products/receptionist', re: /менеджер\w* заяв|приём\w* заяв|lead manager|receptionist/i, ru: 'ИИ-менеджер заявок', en: 'AI lead manager' },
  { kind: 'agent', path: '/products/admin', re: /ии-администратор|запис\w* клиент|AI administrator|bookings?/i, ru: 'ИИ-администратор', en: 'AI administrator' },
  { kind: 'agent', path: '/products/content', re: /контент\w* на автопилот|content on autopilot/i, ru: 'Контент на автопилоте', en: 'Content on autopilot' },
  { kind: 'agent', path: '/products/personal', re: /персональн\w* ии|personal ai/i, ru: 'Персональный ИИ', en: 'Personal AI' },
  { kind: 'agent', path: '/products/company', re: /ии вашей компании|ai for your company/i, ru: 'ИИ вашей компании', en: 'AI for your company' },
  { kind: 'page', path: '/ai-team', re: /ии-отдел|отдел продаж|department/i, ru: 'ИИ-отделы', en: 'AI departments' },
  { kind: 'page', path: '/how-we-work', re: /этап\w* работ|как мы работаем|how we work|stages/i, ru: 'Как мы работаем', en: 'How we work' },
  { kind: 'page', path: '/pay-how', re: /оплат|предоплат|payment|prepay/i, ru: 'Как оплатить', en: 'How to pay' },
  { kind: 'article', path: '/blog/website-cost-2026', re: /сколько стоит сайт|стоимост\w* сайта|website cost|how much (does )?a website/i, ru: 'Сколько стоит сайт в 2026', en: 'What a website costs in 2026' },
]

export function cardsFor(
  reply: { reply: string; builderLink?: string; cta?: readonly string[] },
  locale: 'ru' | 'en',
  currentPath = '/',
): FiraCard[] {
  const cards: FiraCard[] = []
  const here = currentPath.replace(/^\/(ru|en)(?=\/|$)/, '') || '/'
  if (reply.builderLink || reply.cta?.includes('builder')) {
    cards.push({ kind: 'builder', title: locale === 'en' ? 'Build a project' : 'Собрать проект', href: `/${locale}/builder` })
  }
  for (const x of TARGETS) {
    if (cards.length >= 3) break
    if (x.path === here || !x.re.test(reply.reply)) continue
    cards.push({ kind: x.kind, title: x[locale], href: `/${locale}${x.path}` })
  }
  return cards
}

// ---- the page context: `data-fira-page` on <main> (slug) and one hint per page and session
/** `''` -> `home`, `/products/admin` -> `products/admin`. */
export function pageSlug(pathname: string): string {
  const rest = pathname.split(/[?#]/)[0]!.replace(/^\/(ru|en)(?=\/|$)/, '').replace(/^\/+|\/+$/g, '')
  return rest === '' ? 'home' : rest
}

export type SuggestGroup = 'home' | 'builder' | 'product' | 'pricing' | 'article' | 'other'
export function suggestGroupFor(slug: string): SuggestGroup {
  if (slug === 'home') return 'home'
  if (/^builder(\/|$)/.test(slug)) return 'builder'
  if (/^(products|services|solutions|ai-team)(\/|$)/.test(slug)) return 'product'
  if (/^(pay|pay-how|compare|referral|how-we-work)(\/|$)/.test(slug)) return 'pricing'
  if (/^blog(\/|$)/.test(slug)) return 'article'
  return 'other'
}

/** The hint key of a page; pages that already carry the guide's own line or have nothing to add give none. */
export function hintKeyFor(slug: string): 'builder' | 'product' | 'pricing' | 'article' | null {
  const g = suggestGroupFor(slug)
  return g === 'builder' || g === 'product' || g === 'pricing' || g === 'article' ? g : null
}

export const HINT_SEEN_KEY = 'fira-hint-seen'
export function hintSeenList(raw: string | null): string[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-60) : []
  } catch {
    return []
  }
}
/** True once per page and session. */
export function hintDue(seen: readonly string[], slug: string): boolean {
  return !seen.includes(slug)
}
export function markHint(seen: readonly string[], slug: string): string[] {
  return seen.includes(slug) ? [...seen] : [...seen, slug].slice(-60)
}
