import { goliveBlocks, goliveItems, type GoliveItem } from '../content/golive'

// Pure go-live logic: the countdown arithmetic, progress, grouping and the state transitions the
// store persists. No I/O here so it is tested directly (tests/golive.test.mjs).

export const GOLIVE_HOURS = 72
export const GOLIVE_TZ = 'Asia/Kuala_Lumpur'
export const NOTE_MAX = 300

export type GoliveState = {
  deadline: string | null
  startedAt: string | null
  durationHours: number
  done: Record<string, string>
  notes: Record<string, string>
}

export const emptyGolive = (): GoliveState => ({ deadline: null, startedAt: null, durationHours: GOLIVE_HOURS, done: {}, notes: {} })

// Hours are the whole hours left (days * 24 + hours): the clock has no days.
export type Remaining = { hours: number; minutes: number; seconds: number; totalMs: number; over: boolean }

// Time left until the deadline; once it passed, the same fields count how long ago (totalMs < 0).
export function remaining(deadline: string | null | undefined, now: number): Remaining {
  const at = deadline ? Date.parse(deadline) : NaN
  if (!Number.isFinite(at)) return { hours: 0, minutes: 0, seconds: 0, totalMs: 0, over: false }
  const totalMs = at - now
  const abs = Math.floor(Math.abs(totalMs) / 1000)
  return {
    hours: Math.floor(abs / 3600),
    minutes: Math.floor((abs % 3600) / 60),
    seconds: abs % 60,
    totalMs,
    over: totalMs <= 0,
  }
}

const two = (n: number) => String(n).padStart(2, '0')

// «61:42:07» for the top bar chip.
export function chipText(r: Remaining) {
  return `${two(r.hours)}:${two(r.minutes)}:${two(r.seconds)}`
}

// Words for «how long ago»: «3 ч 05 мин», «2 д 4 ч», «41 мин».
export function agoText(r: Remaining) {
  if (r.hours >= 24) return `${Math.floor(r.hours / 24)} д ${r.hours % 24} ч`
  if (r.hours) return `${r.hours} ч ${two(r.minutes)} мин`
  if (r.minutes) return `${r.minutes} мин`
  return `${r.seconds} с`
}

export type Progress = { done: number; total: number; percent: number }

export function progress(items: Pick<GoliveItem, 'id'>[], done: Record<string, string>): Progress {
  const total = items.length
  const n = items.filter((i) => Object.hasOwn(done, i.id)).length
  return { done: n, total, percent: total ? Math.round((n / total) * 100) : 0 }
}

export type Group = { id: string; title: string; items: GoliveItem[]; progress: Progress }

export function groupItems(
  items: GoliveItem[] = goliveItems,
  done: Record<string, string> = {},
  blocks: readonly { id: string; title: string }[] = goliveBlocks,
): Group[] {
  return blocks
    .map((b) => {
      const list = items.filter((i) => i.block === b.id)
      return { id: b.id, title: b.title, items: list, progress: progress(list, done) }
    })
    .filter((g) => g.items.length > 0)
}

export type GoliveAction =
  | { action: 'start'; hours?: number }
  | { action: 'reset' }
  | { action: 'toggle'; id: string; done: boolean }
  | { action: 'note'; id: string; text: string }

const itemIds = new Set(goliveItems.map((i) => i.id))
export const isItemId = (id: unknown): id is string => typeof id === 'string' && itemIds.has(id)

// Reads an untrusted POST body. Null = not a valid action.
export function parseAction(body: unknown): GoliveAction | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  switch (b.action) {
    case 'start': {
      if (b.hours === undefined) return { action: 'start' }
      if (typeof b.hours !== 'number' || !Number.isFinite(b.hours) || b.hours < 1 || b.hours > 24 * 30) return null
      return { action: 'start', hours: b.hours }
    }
    case 'reset':
      return { action: 'reset' }
    case 'toggle':
      return isItemId(b.id) && typeof b.done === 'boolean' ? { action: 'toggle', id: b.id, done: b.done } : null
    case 'note':
      return isItemId(b.id) && typeof b.text === 'string' && b.text.length <= NOTE_MAX ? { action: 'note', id: b.id, text: b.text } : null
    default:
      return null
  }
}

// Applies one action to a state and returns the new one (the input is not changed).
export function applyAction(state: GoliveState, a: GoliveAction, now: number): GoliveState {
  const next: GoliveState = { ...state, done: { ...state.done }, notes: { ...state.notes } }
  if (a.action === 'start') {
    const hours = a.hours ?? GOLIVE_HOURS
    next.startedAt = new Date(now).toISOString()
    next.deadline = new Date(now + hours * 3_600_000).toISOString()
    next.durationHours = hours
  } else if (a.action === 'reset') {
    next.startedAt = null
    next.deadline = null
  } else if (a.action === 'toggle') {
    if (a.done) next.done[a.id] = new Date(now).toISOString()
    else delete next.done[a.id]
  } else {
    const text = a.text.trim()
    if (text) next.notes[a.id] = text
    else delete next.notes[a.id]
  }
  return next
}

// Keeps only what the store may hold: known ids, ISO strings, short notes.
export function sanitize(raw: unknown): GoliveState {
  const out = emptyGolive()
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  const iso = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null)
  out.deadline = iso(r.deadline)
  out.startedAt = iso(r.startedAt)
  if (typeof r.durationHours === 'number' && r.durationHours >= 1 && r.durationHours <= 720) out.durationHours = r.durationHours
  if (r.done && typeof r.done === 'object')
    for (const [id, at] of Object.entries(r.done)) if (isItemId(id) && iso(at)) out.done[id] = at as string
  if (r.notes && typeof r.notes === 'object')
    for (const [id, t] of Object.entries(r.notes)) if (isItemId(id) && typeof t === 'string' && t.trim()) out.notes[id] = t.slice(0, NOTE_MAX)
  return out
}

export function formatDeadline(iso: string, tz = GOLIVE_TZ) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

export function formatTick(iso: string, tz = GOLIVE_TZ) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}
