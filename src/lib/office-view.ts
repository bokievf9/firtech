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
  // The agent is in the middle of a model call right now (optional; absent counts as false).
  thinking?: boolean
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
  // True when no task waits in the queue (optional; the director's room shows a sign).
  queueEmpty?: boolean
  director: {
    id: string
    title: string
    status: AgentStatus
    thinking?: boolean
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
  // Active client chats right now (optional, not capped; absent = 0).
  visitorsActive?: number
  // What the pixel office animates beyond statuses (optional; every field may be missing).
  scene?: OfficeScene
}

// ---- Scene block (Office v2) ----------------------------------------------------------------------

export type VisitorChannel = 'web' | 'telegram'
export type VisitorState = 'chat' | 'intake' | 'contact' | 'done' | 'human'

// One active client chat: id 'v-' + 6 hex, `since` ISO (when the chat started).
export type OfficeVisitor = { id: string; channel: VisitorChannel; state: VisitorState; since: string }

export type ReactionKind = 'approved' | 'rejected' | 'published' | 'blocked' | 'issue_closed' | 'lead' | 'done'

export type OfficeReaction = { agent: string; kind: ReactionKind; at: string }

export type OfficeScene = {
  // Max 20, newest first.
  visitors?: OfficeVisitor[]
  leadsToday?: number
  publishedToday?: number
  // Owner decisions only.
  approvedToday?: number
  rejectedToday?: number
  builderIssuesByDept?: Record<string, number>
  approvalsByAgent?: Record<string, number>
  // Oldest first, newest last, max 30, the last 10 minutes.
  reactions?: OfficeReaction[]
  // Usually «Утренняя сводка, DD.MM», at most 80 chars, may be ''.
  notice?: string
  // One decimal.
  uptimeDays?: number | null
  visitorsTotalToday?: number
}

// A clean scene block with every field present, whatever HQ sent: bad entries are dropped,
// numbers are clamped to whole non-negative values (uptimeDays keeps one decimal).
export type NormalScene = {
  visitors: OfficeVisitor[]
  leadsToday: number
  publishedToday: number
  approvedToday: number
  rejectedToday: number
  builderIssuesByDept: Record<string, number>
  approvalsByAgent: Record<string, number>
  reactions: OfficeReaction[]
  notice: string
  uptimeDays: number | null
  visitorsTotalToday: number
}

const VISITOR_STATES: readonly string[] = ['chat', 'intake', 'contact', 'done', 'human']
const REACTION_KINDS: readonly string[] = ['approved', 'rejected', 'published', 'blocked', 'issue_closed', 'lead', 'done']

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

function countMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    const c = count(n)
    if (c > 0 && k.length <= 64) out[k] = c
  }
  return out
}

const isoOk = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))

export function normalizeScene(raw: unknown): NormalScene {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const visitors: OfficeVisitor[] = []
  const seen = new Set<string>()
  for (const v of Array.isArray(s.visitors) ? s.visitors : []) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    if (typeof o.id !== 'string' || !o.id || o.id.length > 64 || seen.has(o.id)) continue
    if (!VISITOR_STATES.includes(o.state as string) || !isoOk(o.since)) continue
    seen.add(o.id)
    visitors.push({ id: o.id, channel: o.channel === 'telegram' ? 'telegram' : 'web', state: o.state as VisitorState, since: o.since })
    if (visitors.length >= 20) break
  }
  const reactions: OfficeReaction[] = []
  for (const r of Array.isArray(s.reactions) ? s.reactions : []) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    if (typeof o.agent !== 'string' || !o.agent || !REACTION_KINDS.includes(o.kind as string) || !isoOk(o.at)) continue
    reactions.push({ agent: o.agent, kind: o.kind as ReactionKind, at: o.at })
  }
  const up = typeof s.uptimeDays === 'number' && Number.isFinite(s.uptimeDays) && s.uptimeDays >= 0 ? Math.round(s.uptimeDays * 10) / 10 : null
  return {
    visitors,
    leadsToday: count(s.leadsToday),
    publishedToday: count(s.publishedToday),
    approvedToday: count(s.approvedToday),
    rejectedToday: count(s.rejectedToday),
    builderIssuesByDept: countMap(s.builderIssuesByDept),
    approvalsByAgent: countMap(s.approvalsByAgent),
    reactions: reactions.slice(-30),
    notice: typeof s.notice === 'string' ? s.notice.replace(/\s+/g, ' ').trim().slice(0, 80) : '',
    uptimeDays: up,
    visitorsTotalToday: count(s.visitorsTotalToday),
  }
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
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes} min`
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  return `${Math.floor(minutes / (60 * 24))} d`
}

// "данные N с назад": seconds under a minute, then minutes.
export function formatDataAge(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s} s`
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
  return minutes < 1 ? 'now' : `in ${formatDuration(minutes)}`
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
