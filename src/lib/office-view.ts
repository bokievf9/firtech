// Types of the HQ office JSON (contract: fir-tech/docs/office-api.md) and the pure helpers the
// "Живой офис" page uses. No server-only imports: this file is shared by the route, the mock and
// the client board, and is covered by tests/office-view.test.mjs.

export type AgentStatus =
  | 'working'
  | 'waiting'
  | 'blocked'
  | 'idle'
  | 'sleeping'
  | 'paused'
  | 'offline'

export type OfficeTask = { id: number; title: string; since: string }

export type OfficeAgent = {
  id: string
  title: string
  status: AgentStatus
  currentTask?: OfficeTask | null
  lastActiveAt?: string
  tasksToday?: number
  costTodayUsd?: number
}

export type OfficeDepartment = {
  id: string
  title: string
  head: OfficeAgent
  workers: OfficeAgent[]
  tasks: {
    inbox: number
    running: number
    review: number
    approval: number
    blocked: number
    doneToday: number
  }
}

export type OfficeData = {
  ok: true
  generatedAt: string
  tz: string
  quietHours: boolean
  director: {
    id: string
    title: string
    status: AgentStatus
    lastSummaryAt: string | null
    nextSummaryAt: string | null
    pendingApprovals: number
    openBuilderIssues: number
  }
  departments: OfficeDepartment[]
  tasks: {
    counts: Record<string, number>
    recent: { id: number; title: string; dept: string; status: string; updatedAt: string }[]
  }
  activity: { at: string; agent: string; action: string; object: string }[]
  costs: {
    todayUsd: number
    monthUsd: number
    byDept: Record<string, number>
    tokensToday: number
  }
  routines: {
    name: string
    dept: string
    cron: string
    nextRunAt: string | null
    lastRunAt: string | null
  }[]
  health: {
    firtech: { ok: boolean; pct24h: number }
    omniroute: { ok: boolean }
    incidentsToday: number
  }
  funnel: { leadsWeek: number; prospects: Record<string, number> }
  products: { id: string; title: string; status: AgentStatus }[]
}

export type OfficeResponse = OfficeData | { ok: false; error: string }

// Chip look for a status: `tone` picks the colours on the page, `breathing` turns the dot's slow
// pulse on (only working agents breathe; nothing ever blinks).
export type ChipTone = 'live' | 'wait' | 'bad' | 'calm' | 'dim' | 'ghost'

const chips: Record<AgentStatus, { tone: ChipTone; breathing: boolean }> = {
  working: { tone: 'live', breathing: true },
  waiting: { tone: 'wait', breathing: false },
  blocked: { tone: 'bad', breathing: false },
  idle: { tone: 'calm', breathing: false },
  sleeping: { tone: 'dim', breathing: false },
  paused: { tone: 'ghost', breathing: false },
  offline: { tone: 'ghost', breathing: false },
}

export function statusChip(status: string): { status: AgentStatus; tone: ChipTone; breathing: boolean } {
  // An unknown status from a newer HQ is shown as offline rather than crashing the page.
  const known = status in chips ? (status as AgentStatus) : 'offline'
  return { status: known, ...chips[known] }
}

// Whole minutes between an ISO time and now, never negative; null when the time is missing or bad.
export function minutesSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now - t) / 60_000))
}

// "только что", "5 мин", "2 ч 10 мин", "3 д". Used after "с" ("с 5 мин") by the callers' copy.
export function formatDuration(minutes: number): string {
  if (minutes < 1) return 'меньше минуты'
  if (minutes < 60) return `${minutes} мин`
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} ч ${m} мин` : `${h} ч`
  }
  return `${Math.floor(minutes / (60 * 24))} д`
}

// "данные N с назад": seconds under a minute, then minutes.
export function formatDataAge(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s} с`
  return formatDuration(Math.floor(s / 60))
}

// Wall clock "HH:mm" in the given time zone (Asia/Tashkent by default).
export function formatClock(now: number, tz = 'Asia/Tashkent'): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now)
  } catch {
    return '--:--'
  }
}

// Countdown to a future time: "через 3 ч 5 мин", "через 2 д"; past or missing gives "".
export function formatUntil(iso: string | null | undefined, now: number): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const minutes = Math.floor((t - now) / 60_000)
  return minutes < 1 ? 'сейчас' : `через ${formatDuration(minutes)}`
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(value >= 10 ? 0 : 2)}`
}

export const ACTIVITY_CAP = 40

export const activityKey = (a: { at: string; agent: string; action: string; object: string }) =>
  `${a.at}|${a.agent}|${a.action}|${a.object}`

// Newest first, capped at 40.
export function capActivity<T extends { at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, ACTIVITY_CAP)
}

// Light check that a JSON body from HQ has the parts the page reads.
export function looksLikeOffice(value: unknown): value is OfficeData {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.ok === true &&
    Array.isArray(v.departments) &&
    Array.isArray(v.activity) &&
    typeof v.director === 'object' &&
    v.director !== null &&
    typeof v.costs === 'object' &&
    v.costs !== null
  )
}
