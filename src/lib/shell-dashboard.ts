// Shell Dashboard (2026-11-23): view model of HQ's `GET /admin/dashboard?range=today|7d|30d` (agents repo,
// docs/admin-crm-api.md «Dashboard») and the pure numbers and chart geometry the page draws. No I/O, no React.
// Nothing from HQ is trusted: unknown fields are dropped, bad numbers become 0 (or null where "no data" is a
// fact), and a block that HQ marks `available: false` (or that is malformed) is `{ available: false }` for that
// tile only. Numbers that are not there are never invented.
import { tabOf, type ApprovalTab, APPROVAL_TABS } from '@/lib/approvals'

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
const nul = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
const str = (v: unknown, max = 60): string => (typeof v === 'string' ? v.slice(0, max) : '')

export const RANGES = ['today', '7d', '30d'] as const
export type DashRange = (typeof RANGES)[number]
export const DEFAULT_RANGE: DashRange = '7d'
export const parseRange = (v: unknown): DashRange => ((RANGES as readonly string[]).includes(v as string) ? (v as DashRange) : DEFAULT_RANGE)

export type Gone = { available: false }
export type Block<T> = Gone | ({ available: true } & T)

export type LeadsBlock = { new: number; inWork: number; won: number; lost: number; conversion: number | null; perDay: { day: string; n: number }[] }
export type ApprovalsBlock = { waiting: number; byKind: { kind: string; label: string; n: number }[]; byDept: { dept: string; n: number }[] }
export type MoneyBlock = {
  currency: string
  paid: number
  pending: number
  overdue: number
  invoices: { paid: number; pending: number; overdue: number }
  perWeek: { week: string; paid: number }[]
}
export type ProjectsBlock = { byStage: { stage: string; n: number }[]; active: number; closed: number }
export type TicketsBlock = { open: number; overdue: number; answeredToday: number; avgFirstResponseMin: number | null }
export type ContentBlock = { queue: { day: string; planned: number; approved: number; published: number }[]; waitingApproval: number }
export type AgentsBlock = {
  activeNow: number
  tasksToday: number
  tasksFailedToday: number
  spendToday: number
  spendMonth: number
  budgetMonth: number | null
  byDept: { dept: string; spendMonth: number; limit: number | null }[]
}
export const SERVICE_STATES = ['ok', 'degraded', 'down', 'unknown'] as const
export type ServiceState = (typeof SERVICE_STATES)[number]

export type DashboardData = {
  range: DashRange
  from: string
  to: string
  tz: string
  generatedAt: string
  leads: Block<LeadsBlock>
  approvals: Block<ApprovalsBlock>
  money: Block<MoneyBlock>
  projects: Block<ProjectsBlock>
  tickets: Block<TicketsBlock>
  content: Block<ContentBlock>
  agents: Block<AgentsBlock>
  services: Block<{ items: { id: string; title: string; state: ServiceState }[] }>
  funnel: Block<{ steps: { step: string; n: number }[] }>
}

const GONE: Gone = { available: false }
const DAY = /^\d{4}-\d{2}-\d{2}$/
const WEEK = /^\d{4}-W\d{2}$/
const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : '')

// One block: HQ's own `available: false`, a missing block, or a parser that throws or returns null all end as Gone.
function block<T>(raw: unknown, parse: (r: Rec) => T | null): Block<T> {
  const r = rec(raw)
  if (r.available === false || Object.keys(r).length === 0) return GONE
  try {
    const t = parse(r)
    return t === null ? GONE : { available: true, ...t }
  } catch {
    return GONE
  }
}

export function normalizeDashboard(body: unknown): DashboardData | null {
  const b = rec(body)
  const range = (RANGES as readonly string[]).includes(b.range as string) ? (b.range as DashRange) : null
  if (!range) return null
  // `services` is a plain list in the contract; accept `{ available, items }` too.
  const servicesRaw = Array.isArray(b.services) ? { items: b.services } : rec(b.services)
  const funnelRaw = Array.isArray(b.funnel) ? { items: b.funnel } : rec(b.funnel)
  return {
    range,
    from: iso(b.from),
    to: iso(b.to),
    tz: str(b.tz) || 'UTC',
    generatedAt: iso(b.generatedAt),
    leads: block(b.leads, (r) => ({
      new: num(r.new),
      inWork: num(r.inWork),
      won: num(r.won),
      lost: num(r.lost),
      conversion: nul(r.conversion),
      perDay: arr(r.perDay, 40)
        .map((x) => rec(x))
        .filter((x) => DAY.test(str(x.day, 10)))
        .map((x) => ({ day: str(x.day, 10), n: num(x.n) })),
    })),
    approvals: block(b.approvals, (r) => ({
      waiting: num(r.waiting),
      byKind: arr(r.byKind, 40)
        .map((x) => rec(x))
        .filter((x) => str(x.kind, 40))
        .map((x) => ({ kind: str(x.kind, 40), label: str(x.label, 60), n: num(x.n) })),
      byDept: arr(r.byDept, 20).map((x) => rec(x)).filter((x) => str(x.dept, 30)).map((x) => ({ dept: str(x.dept, 30), n: num(x.n) })),
    })),
    money: block(b.money, (r) => {
      const inv = rec(r.invoices)
      return {
        currency: str(r.currency, 6) || 'USD',
        paid: num(r.paid),
        pending: num(r.pending),
        overdue: num(r.overdue),
        invoices: { paid: num(inv.paid), pending: num(inv.pending), overdue: num(inv.overdue) },
        perWeek: arr(r.perWeek, 12)
          .map((x) => rec(x))
          .filter((x) => WEEK.test(str(x.week, 8)))
          .map((x) => ({ week: str(x.week, 8), paid: num(x.paid) })),
      }
    }),
    projects: block(b.projects, (r) => ({
      byStage: arr(r.byStage, 12).map((x) => rec(x)).filter((x) => str(x.stage, 30)).map((x) => ({ stage: str(x.stage, 30), n: num(x.n) })),
      active: num(r.active),
      closed: num(r.closed),
    })),
    tickets: block(b.tickets, (r) => ({ open: num(r.open), overdue: num(r.overdue), answeredToday: num(r.answeredToday), avgFirstResponseMin: nul(r.avgFirstResponseMin) })),
    content: block(b.content, (r) => ({
      queue: arr(r.queue, 14)
        .map((x) => rec(x))
        .filter((x) => DAY.test(str(x.day, 10)))
        .map((x) => ({ day: str(x.day, 10), planned: num(x.planned), approved: num(x.approved), published: num(x.published) })),
      waitingApproval: num(r.waitingApproval),
    })),
    agents: block(b.agents, (r) => ({
      activeNow: num(r.activeNow),
      tasksToday: num(r.tasksToday),
      tasksFailedToday: num(r.tasksFailedToday),
      spendToday: num(r.spendToday),
      spendMonth: num(r.spendMonth),
      budgetMonth: nul(r.budgetMonth),
      byDept: arr(r.byDept, 12).map((x) => rec(x)).filter((x) => str(x.dept, 30)).map((x) => ({ dept: str(x.dept, 30), spendMonth: num(x.spendMonth), limit: nul(x.limit) })),
    })),
    services: block(servicesRaw, (r) => ({
      items: arr(r.items, 20)
        .map((x) => rec(x))
        .filter((x) => str(x.id, 40))
        .map((x) => ({ id: str(x.id, 40), title: str(x.title, 60) || str(x.id, 40), state: (SERVICE_STATES as readonly string[]).includes(x.state as string) ? (x.state as ServiceState) : 'unknown' })),
    })),
    funnel: block(funnelRaw, (r) => ({
      steps: arr(r.items, 10).map((x) => rec(x)).filter((x) => str(x.step, 30)).map((x) => ({ step: str(x.step, 30), n: num(x.n) })),
    })),
  }
}

// ---- numbers ----------------------------------------------------------------------------------------

export const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`
export const usdCents = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const percent = (ratio: number | null): string => (ratio === null ? '-' : `${Math.round(ratio * 100)}%`)

export function minutesLabel(m: number | null): string {
  if (m === null) return '-'
  if (m < 60) return `${Math.round(m)} min`
  return `${(Math.round((m / 60) * 10) / 10).toString()} h`
}

// Spend against a budget: ok under 80%, warn from 80%, over from 100%, none without a limit (the Finance Costs thresholds).
export type SpendState = 'none' | 'ok' | 'warn' | 'over'
export function spendState(spent: number, limit: number | null): SpendState {
  if (limit === null || !(limit > 0)) return 'none'
  const r = spent / limit
  return r >= 1 ? 'over' : r >= 0.8 ? 'warn' : 'ok'
}
export const spendRatio = (spent: number, limit: number | null): number => (limit && limit > 0 ? Math.min(1, spent / limit) : 0)

// ---- approvals by tab (the Approvals page tabs; a click on a tile opens the tab) -----------------------

export type ApprovalTile = { tab: ApprovalTab; n: number }
export function approvalTiles(b: ApprovalsBlock): ApprovalTile[] {
  const out: Record<ApprovalTab, number> = { documents: 0, replies: 0, content: 0, money: 0 }
  for (const k of b.byKind) out[tabOf({ kind: k.kind })] += k.n
  return APPROVAL_TABS.map((tab) => ({ tab, n: out[tab] }))
}

// ---- funnel ------------------------------------------------------------------------------------------

export type FunnelRow = { step: string; n: number; width: number; rate: number | null }
// Bar width against the largest step, and the share of the step above (null for the first one or after an empty step).
export function funnelRows(steps: { step: string; n: number }[]): FunnelRow[] {
  const max = Math.max(0, ...steps.map((s) => s.n))
  return steps.map((s, i) => {
    const prev = i === 0 ? null : steps[i - 1]!.n
    return { step: s.step, n: s.n, width: max > 0 ? s.n / max : 0, rate: prev && prev > 0 ? Math.min(1, s.n / prev) : null }
  })
}

// ---- column charts -------------------------------------------------------------------------------------

// "Nice" top of the value axis: 1, 2, 5 times a power of ten, never below 1 (an all-zero chart keeps a 0..1 axis).
export function niceMax(max: number): number {
  if (!(max > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(max))
  const f = max / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}

export type Column = { label: string; value: number; x: number; y: number; w: number; h: number }
export type ColumnChart = { width: number; height: number; top: number; baseline: number; max: number; ticks: number[]; columns: Column[]; total: number; empty: boolean }

// Geometry of one column series in a `width` x `height` viewBox: the plot is inset left for the axis labels and
// bottom for the day labels; the columns sit on the baseline with a 2px gap (a quarter of the pitch at most).
export function columnChart(points: { label: string; value: number }[], width = 320, height = 120, inset = { left: 34, bottom: 18, top: 6, right: 4 }): ColumnChart {
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)))
  const plotW = width - inset.left - inset.right
  const plotH = height - inset.top - inset.bottom
  const pitch = points.length > 0 ? plotW / points.length : plotW
  const gap = Math.min(2, pitch / 4)
  const w = Math.max(1, pitch - gap)
  const baseline = inset.top + plotH
  const columns = points.map((p, i) => {
    const h = p.value > 0 ? Math.max(1, (p.value / max) * plotH) : 0
    return { label: p.label, value: p.value, x: inset.left + i * pitch + gap / 2, y: baseline - h, w, h }
  })
  const total = points.reduce((n, p) => n + p.value, 0)
  return { width, height, top: inset.top, baseline, max, ticks: [0, max / 2, max], columns, total, empty: total === 0 }
}

// Short day label ("23") and week label ("W47") for the x axis; the full label goes to the tooltip and the table.
export const dayShort = (day: string): string => day.slice(8, 10)
export const dayLong = (day: string): string => {
  const d = new Date(`${day}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
export const weekShort = (week: string): string => week.slice(5)

// Which x labels to print so they never collide: every column up to 8, else about 6 evenly, always the last one.
export function labelIndexes(count: number): Set<number> {
  if (count <= 8) return new Set(Array.from({ length: count }, (_, i) => i))
  const step = Math.ceil(count / 6)
  const out = new Set<number>()
  for (let i = count - 1; i >= 0; i -= step) out.add(i)
  return out
}

// ---- whole-view helpers ----------------------------------------------------------------------------------

export const unavailableCount = (d: DashboardData): number =>
  [d.leads, d.approvals, d.money, d.projects, d.tickets, d.content, d.agents, d.services, d.funnel].filter((b) => !b.available).length

export const contentWeekTotals = (b: ContentBlock) => ({
  planned: b.queue.reduce((n, d) => n + d.planned, 0),
  approved: b.queue.reduce((n, d) => n + d.approved, 0),
  published: b.queue.reduce((n, d) => n + d.published, 0),
})
