// HQ «Calendar» (2026-11-23): view model of `GET /admin/calendar` (agents `docs/admin-crm-api.md`, «Calendar»)
// plus the pure date grid (week and month, Monday first) and the links into the HQ sections. No I/O, no React.
// Nothing from HQ is trusted: unknown fields are dropped, missing ones get defaults.

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const str = (v: unknown, max = 160): string => (typeof v === 'string' ? v.slice(0, max) : '')

export const CALENDAR_KINDS = ['call', 'milestone', 'routine', 'content'] as const
export type CalendarKind = (typeof CALENDAR_KINDS)[number]
export const CALENDAR_VIEWS = ['week', 'month'] as const
export type CalendarMode = (typeof CALENDAR_VIEWS)[number]

export type CalendarEvent = {
  id: string
  kind: CalendarKind
  at: string
  allDay: boolean
  title: string
  detail: string
  dept: string
  status: string
  link: string
  // The company's day of the event, `YYYY-MM-DD` (filled by `normalizeCalendar`).
  day: string
}
export type CalendarData = {
  from: string
  to: string
  tz: string
  today: string
  counts: Record<CalendarKind, number>
  events: CalendarEvent[]
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
export const isDay = (v: unknown): v is string => typeof v === 'string' && DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))

const DAY_MS = 86_400_000
const utc = (day: string) => Date.parse(`${day}T00:00:00Z`)
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const addDays = (day: string, n: number) => fromUtc(utc(day) + n * DAY_MS)
// Monday of the week the day is in.
export const weekStart = (day: string) => addDays(day, -((new Date(utc(day)).getUTCDay() + 6) % 7))

// The day an instant falls on in a time zone (the company's clock, not the browser's).
export function dayInZone(iso: string, tz: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t)
  } catch {
    return fromUtc(t)
  }
}

export function normalizeCalendar(body: unknown): CalendarData | null {
  const b = rec(body)
  if (!isDay(b.from) || !isDay(b.to) || !Array.isArray(b.events)) return null
  const tz = str(b.tz, 60) || 'Asia/Tashkent'
  const events: CalendarEvent[] = []
  for (const raw of b.events.slice(0, 1500)) {
    const e = rec(raw)
    const kind = (CALENDAR_KINDS as readonly string[]).includes(String(e.kind)) ? (e.kind as CalendarKind) : null
    const at = typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)) ? e.at : null
    const id = str(e.id, 80)
    if (!kind || !at || !id) continue
    events.push({
      id, kind, at, allDay: e.allDay === true, title: str(e.title), detail: str(e.detail), dept: str(e.dept, 30), status: str(e.status, 30), link: str(e.link, 120),
      day: dayInZone(at, tz),
    })
  }
  const counts = { call: 0, milestone: 0, routine: 0, content: 0 } as Record<CalendarKind, number>
  for (const e of events) counts[e.kind]++
  return { from: b.from, to: b.to, tz, today: isDay(b.today) ? b.today : b.from, counts, events }
}

// ---- the grid --------------------------------------------------------------------------------------

// The days a grid shows: seven for a week, whole weeks (5 or 6) covering the month for a month.
export function gridDays(mode: CalendarMode, anchor: string): string[] {
  if (mode === 'week') {
    const s = weekStart(anchor)
    return Array.from({ length: 7 }, (_, i) => addDays(s, i))
  }
  const first = `${anchor.slice(0, 7)}-01`
  const s = weekStart(first)
  const last = addDays(`${addMonths(anchor, 1).slice(0, 7)}-01`, -1)
  const weeks = Math.ceil((utc(last) - utc(s) + DAY_MS) / (7 * DAY_MS))
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(s, i))
}
export function addMonths(day: string, n: number): string {
  const d = new Date(utc(`${day.slice(0, 7)}-01`))
  d.setUTCMonth(d.getUTCMonth() + n)
  return fromUtc(d.getTime())
}
export const shiftAnchor = (mode: CalendarMode, anchor: string, n: number) => (mode === 'week' ? addDays(anchor, 7 * n) : addMonths(anchor, n))
export const rangeOf = (days: string[]) => ({ from: days[0]!, to: days[days.length - 1]! })

export function eventsByDay(events: CalendarEvent[], kinds: ReadonlySet<CalendarKind>): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    if (!kinds.has(e.kind)) continue
    const list = map.get(e.day)
    if (list) list.push(e)
    else map.set(e.day, [e])
  }
  // all-day items first, then by time
  for (const list of map.values()) list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.at.localeCompare(b.at))
  return map
}

// ---- links into HQ ---------------------------------------------------------------------------------

const SAFE = /^[\w.:-]{1,80}$/
// `calls:7` -> Clients, tab Calls; `projects:2` -> Projects; `content:item:5` -> Content; `routines:<name>` -> the company panel of the office.
export function calendarHref(link: string): string | null {
  const m = /^(calls|projects|content|routines):(?:item:)?(.+)$/.exec(link)
  if (!m || !SAFE.test(m[2]!)) return null
  const id = encodeURIComponent(m[2]!)
  switch (m[1]) {
    case 'calls':
      return `/admin/clients?tab=calls&focus=${id}`
    case 'projects':
      return `/admin/projects?tab=projects&focus=${id}`
    case 'content':
      return `/admin/content?tab=feed&focus=${id}`
    default:
      return '/admin/agents'
  }
}
