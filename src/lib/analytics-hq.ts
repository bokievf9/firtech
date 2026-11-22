// HQ «Analytics» (2026-11-23): view model of `GET /admin/analytics` (agents `docs/admin-crm-api.md`, «Audit log и Analytics»)
// and the pure numbers the page shows (conversion between funnel steps, change against the previous week). No I/O, no React.

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
const nul = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
const str = (v: unknown, max = 60): string => (typeof v === 'string' ? v.slice(0, max) : '')

export const FUNNEL_STEPS = ['leads', 'qualified', 'proposals', 'contracts', 'paid'] as const
export type FunnelStep = (typeof FUNNEL_STEPS)[number]
export type Funnel = Record<FunnelStep, number>

export type FirstResponse = { leads: number; answered: number; avgMinutes: number | null; medianMinutes: number | null; within1hShare: number | null }
export type SourceRow = { source: string; leads: number; qualified: number; paid: number }
export type AnalyticsData = {
  week: string
  prevWeek: string
  from: string
  to: string
  tz: string
  funnel: Funnel
  prevFunnel: Funnel
  site: Record<string, number>
  prevSite: Record<string, number>
  firstResponse: FirstResponse
  prevFirstResponse: FirstResponse
  sources: SourceRow[]
}

const WEEK = /^\d{4}-W\d{2}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const funnelOf = (v: unknown): Funnel => {
  const r = rec(v)
  return Object.fromEntries(FUNNEL_STEPS.map((k) => [k, num(r[k])])) as Funnel
}
const siteOf = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const [k, n] of Object.entries(rec(v)).slice(0, 40)) if (/^[a-z_]{1,40}$/.test(k)) out[k] = num(n)
  return out
}
const responseOf = (v: unknown): FirstResponse => {
  const r = rec(v)
  return { leads: num(r.leads), answered: num(r.answered), avgMinutes: nul(r.avgMinutes), medianMinutes: nul(r.medianMinutes), within1hShare: nul(r.within1hShare) }
}

export function normalizeAnalytics(body: unknown): AnalyticsData | null {
  const b = rec(body)
  if (typeof b.week !== 'string' || !WEEK.test(b.week) || !b.funnel) return null
  const sources: SourceRow[] = []
  for (const raw of Array.isArray(b.sources) ? b.sources.slice(0, 20) : []) {
    const s = rec(raw)
    const source = str(s.source, 24)
    if (source) sources.push({ source, leads: num(s.leads), qualified: num(s.qualified), paid: num(s.paid) })
  }
  return {
    week: b.week,
    prevWeek: typeof b.prevWeek === 'string' && WEEK.test(b.prevWeek) ? b.prevWeek : '',
    from: typeof b.from === 'string' && DAY.test(b.from) ? b.from : '',
    to: typeof b.to === 'string' && DAY.test(b.to) ? b.to : '',
    tz: str(b.tz) || 'Asia/Tashkent',
    funnel: funnelOf(b.funnel),
    prevFunnel: funnelOf(b.prevFunnel),
    site: siteOf(b.site),
    prevSite: siteOf(b.prevSite),
    firstResponse: responseOf(b.firstResponse),
    prevFirstResponse: responseOf(b.prevFirstResponse),
    sources,
  }
}

// Share of the previous step that reached this one, percent (whole), null when the previous step is empty.
export const stepRate = (prev: number, cur: number): number | null => (prev > 0 ? Math.min(100, Math.round((cur / prev) * 100)) : null)

// The change against the previous week: absolute and percent (null percent when the previous number is zero).
export function change(cur: number, prev: number): { delta: number; percent: number | null } {
  return { delta: cur - prev, percent: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null }
}

// A time to the first answer in words: minutes under an hour, hours with one decimal after, null as a dash.
export function minutesLabel(m: number | null): string {
  if (m === null) return '-'
  if (m < 1) return '<1 мин'
  if (m < 60) return `${Math.round(m)} мин`
  const h = m / 60
  return h < 48 ? `${Math.round(h * 10) / 10} ч` : `${Math.round(h / 24)} дн`
}

// Site events sorted by the count of this week, with the previous week next to them; zero rows on both sides are dropped.
export function siteRows(site: Record<string, number>, prev: Record<string, number>): { name: string; cur: number; prev: number }[] {
  const names = new Set([...Object.keys(site), ...Object.keys(prev)])
  return [...names].map((name) => ({ name, cur: site[name] ?? 0, prev: prev[name] ?? 0 })).filter((r) => r.cur > 0 || r.prev > 0).sort((a, b) => b.cur - a.cur || a.name.localeCompare(b.name))
}

// ISO week label shifted by whole weeks (the week switcher); Monday first like HQ.
export function shiftIsoWeek(week: string, by: number): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(week)
  if (!m) return week
  const jan4 = Date.UTC(Number(m[1]), 0, 4)
  const monday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * 86_400_000 + (Number(m[2]) - 1 + by) * 7 * 86_400_000
  const thursday = monday + 3 * 86_400_000
  const year = new Date(thursday).getUTCFullYear()
  const w = Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * 86_400_000)) + 1
  return `${year}-W${String(w).padStart(2, '0')}`
}
