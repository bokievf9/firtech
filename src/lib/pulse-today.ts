import type { IgItem, IgKind, Task } from './pulse-types'
import { dueState } from './pulse-view'

// Pure logic behind "what is waiting for the owner today": decisions, the attention counters, the
// hour-by-hour day and the Instagram week. No I/O. Every time is Dushanbe (UTC+5, no daylight
// saving), the same zone as the rest of the panel; day keys are YYYY-MM-DD.

const OFFSET = 5 * 60 * 60_000

// Day key of an instant in Dushanbe.
export function dushanbeKey(ms: number): string {
  return new Date(ms + OFFSET).toISOString().slice(0, 10)
}

// Minutes since midnight of an instant in Dushanbe.
export function dushanbeMinutes(ms: number): number {
  const d = new Date(ms + OFFSET)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

// "HH:MM" of an instant in Dushanbe.
export function dushanbeClock(ms: number): string {
  const m = dushanbeMinutes(ms)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function addDays(key: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export const tomorrowOf = (today: string) => addDays(today, 1)

// The seven day keys of the calendar week (Monday first) that contains `today`.
export function weekDays(today: string): string[] {
  const [y = 1970, m = 1, d = 1] = today.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  const monday = addDays(today, -((weekday + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

const byTime = (a: IgItem, b: IgItem) =>
  a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id)

// Publications of the current week in calendar order, published ones included (they get a tick).
export function weekItems(items: readonly IgItem[], today: string): IgItem[] {
  const days = new Set(weekDays(today))
  return items.filter((i) => days.has(i.date)).sort(byTime)
}

export function itemsOfDay(items: readonly IgItem[], day: string): IgItem[] {
  return items.filter((i) => i.date === day).sort(byTime)
}

// ---- Decide today -------------------------------------------------------------------------------

export type DecisionReason = 'overdue' | 'today' | 'waiting'
export type Decision = { task: Task; reason: DecisionReason }

const reasonRank: Record<DecisionReason, number> = { overdue: 0, today: 1, waiting: 2 }
const priorityRank = { high: 0, normal: 1, low: 2 } as const

// What to decide today: open tasks whose date has passed or is today, and tasks waiting for the
// owner that have no date at all. A task waiting for the owner with a later date (for example
// after "tomorrow") is not for today. Overdue first, then today, then undated; inside a group by
// priority, then the earliest date, then creation time so the order is stable.
export function decisionsToday(tasks: readonly Task[], today: string): Decision[] {
  const out: Decision[] = []
  for (const task of tasks) {
    if (task.status === 'done') continue
    const state = dueState(task.due, today)
    if (state === 'overdue') out.push({ task, reason: 'overdue' })
    else if (state === 'today') out.push({ task, reason: 'today' })
    else if (task.status === 'blocked' && state === 'none') out.push({ task, reason: 'waiting' })
  }
  return out.sort(
    (a, b) =>
      reasonRank[a.reason] - reasonRank[b.reason] ||
      Number(b.task.status === 'blocked') - Number(a.task.status === 'blocked') ||
      priorityRank[a.task.priority] - priorityRank[b.task.priority] ||
      (a.task.due ?? '9999-99-99').localeCompare(b.task.due ?? '9999-99-99') ||
      a.task.createdAt.localeCompare(b.task.createdAt) ||
      a.task.id.localeCompare(b.task.id),
  )
}

export type Attention = {
  // Tasks waiting for the owner, with the projects they belong to (most first).
  decisions: number
  decisionProjects: { project: Task['project']; count: number }[]
  overdue: number
  firstOverdue: Task | null
  stale: number
  // Publications of today that are not marked as published yet.
  publishToday: number
  // Length of the "decide today" list.
  today: number
}

export function attention(
  tasks: readonly Task[],
  items: readonly IgItem[],
  stale: number,
  today: string,
): Attention {
  const open = tasks.filter((t) => t.status !== 'done')
  const blocked = open.filter((t) => t.status === 'blocked')
  const projects = new Map<Task['project'], number>()
  for (const t of blocked) projects.set(t.project, (projects.get(t.project) ?? 0) + 1)
  const overdue = open
    .filter((t) => dueState(t.due, today) === 'overdue')
    .sort(
      (a, b) => (a.due ?? '').localeCompare(b.due ?? '') || a.createdAt.localeCompare(b.createdAt),
    )
  return {
    decisions: blocked.length,
    decisionProjects: [...projects]
      .map(([project, count]) => ({ project, count }))
      .sort((a, b) => b.count - a.count || a.project.localeCompare(b.project)),
    overdue: overdue.length,
    firstOverdue: overdue[0] ?? null,
    stale,
    publishToday: items.filter((i) => i.date === today && !i.published).length,
    today: decisionsToday(tasks, today).length,
  }
}

// ---- The day by the hour --------------------------------------------------------------------------

export type Call = { id: number; name: string; slot: string; state: 'pending' | 'confirmed' }

export type TimelineEntry =
  | { key: string; kind: 'ig'; time: string; item: IgItem; igKind: IgKind; done: boolean }
  | { key: string; kind: 'call'; time: string; call: Call; done: false }
  | { key: string; kind: 'task'; time: null; task: Task; done: false }

export type Timeline = {
  entries: TimelineEntry[]
  // Index in `entries` before which the "now" marker goes (entries.length when everything timed is
  // behind, the first all day task when only those are left).
  nowIndex: number
}

// Publications and calls of today with their time, then the tasks due today without a time ("all
// day"). `now` is the instant of the page render; the marker sits between the entries that already
// started and the ones ahead.
export function dayTimeline(input: {
  items: readonly IgItem[]
  calls: readonly Call[]
  tasks: readonly Task[]
  now: number
}): Timeline {
  const today = dushanbeKey(input.now)
  const minutesNow = dushanbeMinutes(input.now)
  const timed: (TimelineEntry & { time: string })[] = []
  for (const item of itemsOfDay(input.items, today)) {
    timed.push({
      key: `ig-${item.id}`,
      kind: 'ig',
      time: item.time,
      item,
      igKind: item.kind,
      done: item.published,
    })
  }
  for (const call of input.calls) {
    const at = Date.parse(call.slot)
    if (!Number.isFinite(at) || dushanbeKey(at) !== today) continue
    timed.push({ key: `call-${call.id}`, kind: 'call', time: dushanbeClock(at), call, done: false })
  }
  timed.sort((a, b) => a.time.localeCompare(b.time) || a.key.localeCompare(b.key))

  const allDay: TimelineEntry[] = input.tasks
    .filter((t) => t.status !== 'done' && t.due === today)
    .sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        a.createdAt.localeCompare(b.createdAt),
    )
    .map((task) => ({
      key: `task-${task.id}`,
      kind: 'task' as const,
      time: null,
      task,
      done: false,
    }))

  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
  const ahead = timed.findIndex((e) => minutes(e.time) > minutesNow)
  return {
    entries: [...timed, ...allDay],
    nowIndex: ahead === -1 ? timed.length : ahead,
  }
}

// "19.10 в 08:40" for a stored ISO moment, in Dushanbe.
export function stamp(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  const [, month = '', day = ''] = dushanbeKey(ms).split('-')
  return `${day}.${month} ${dushanbeClock(ms)}`
}

// Part of the day for the greeting, by the Dushanbe hour.
export function dayPart(now: number): 'night' | 'morning' | 'day' | 'evening' {
  const hour = Math.floor(dushanbeMinutes(now) / 60)
  if (hour < 5) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'day'
  return 'evening'
}
