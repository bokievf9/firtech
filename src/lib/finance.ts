// HQ «Finance» (2026-11-23): pure view models for the Payments and Costs tabs. Invoices come from `GET crm/invoices`
// (the Invoices tab is the existing back-office panel), costs from `GET agents` (month spend and limits per department and
// agent) and `GET company` (today and the last 30 days). No client text is read here. No I/O, no React.
import type { AgentList } from './agents-hq'
import type { Company, Invoice } from './pult'

export const monthKey = (iso: string): string => iso.slice(0, 7)
export const isMonthKey = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const round2 = (n: number) => Math.round(n * 100) / 100

// «Этап 2: ...» / «stage 2» in the invoice title is the payment stage; none = a one-off or a subscription.
export function stageOf(title: string): number | null {
  const m = /(?:этап|stage)\s*(\d{1,2})/i.exec(title)
  return m ? Number(m[1]) : null
}

export type PaymentRow = Invoice & { stage: number | null }
export type PaymentsView = {
  month: string
  paidUsd: number
  paidCount: number
  rows: PaymentRow[]
  byStage: { stage: number | null; usd: number; count: number }[]
  awaitingUsd: number
  awaitingCount: number
  overdueCount: number
  previousUsd: number
  months: string[]
}

export function paymentsView(invoices: readonly Invoice[], month: string, now: number): PaymentsView {
  const paid = invoices.filter((i) => i.status === 'paid' && i.paidAt)
  const rows = paid
    .filter((i) => monthKey(i.paidAt!) === month)
    .sort((a, b) => Date.parse(b.paidAt!) - Date.parse(a.paidAt!))
    .map((i) => ({ ...i, stage: stageOf(i.title) }))
  const stages = new Map<number | null, { usd: number; count: number }>()
  for (const r of rows) {
    const s = stages.get(r.stage) ?? { usd: 0, count: 0 }
    s.usd += r.amountUsd
    s.count += 1
    stages.set(r.stage, s)
  }
  const open = invoices.filter((i) => i.status === 'issued')
  const prev = shiftMonth(month, -1)
  return {
    month,
    paidUsd: round2(rows.reduce((n, r) => n + r.amountUsd, 0)),
    paidCount: rows.length,
    rows,
    byStage: [...stages.entries()]
      .map(([stage, v]) => ({ stage, usd: round2(v.usd), count: v.count }))
      .sort((a, b) => (a.stage ?? 99) - (b.stage ?? 99)),
    awaitingUsd: round2(open.reduce((n, i) => n + i.amountUsd, 0)),
    awaitingCount: open.length,
    overdueCount: open.filter((i) => i.dueDate && Date.parse(i.dueDate) < now).length,
    previousUsd: round2(paid.filter((i) => monthKey(i.paidAt!) === prev).reduce((n, i) => n + i.amountUsd, 0)),
    months: [...new Set(paid.map((i) => monthKey(i.paidAt!)))].sort().reverse(),
  }
}

export type CostState = 'none' | 'ok' | 'warn' | 'over'
// 0 = no limit; 80% warns, 100% is over (the same thresholds as the alerts in HQ).
export function costState(spent: number, limit: number): CostState {
  if (!(limit > 0)) return 'none'
  const r = spent / limit
  return r >= 1 ? 'over' : r >= 0.8 ? 'warn' : 'ok'
}

export type CostDept = {
  id: string
  monthUsd: number
  limitUsd: number
  todayUsd: number
  state: CostState
  share: number
  agents: { id: string; title: string; monthUsd: number }[]
}
export type CostsView = {
  totalUsd: number
  totalLimitUsd: number
  totalState: CostState
  todayUsd: number
  depts: CostDept[]
  byDay: { date: string; usd: number }[]
  maxDay: number
}

// HQ names the Director's department `hq` in agents and `director` in the budget keys; both resolve to one row.
const canon = (d: string) => (d === 'director' ? 'hq' : d)

export function costsView(list: AgentList, company: Company | null): CostsView {
  const today = new Map<string, number>()
  for (const d of company?.costs.byDept ?? []) today.set(canon(d.dept), (today.get(canon(d.dept)) ?? 0) + d.todayUsd)
  const total = list.agents.reduce((n, a) => n + a.monthUsd, 0)
  const ids = [...new Set([...list.departments.map((d) => canon(d.id)), ...list.agents.map((a) => canon(a.dept))])]
  const depts: CostDept[] = ids.map((id) => {
    const info = list.departments.find((d) => canon(d.id) === id)
    const agents = list.agents
      .filter((a) => canon(a.dept) === id)
      .map((a) => ({ id: a.id, title: a.title, monthUsd: round2(a.monthUsd) }))
      .sort((a, b) => b.monthUsd - a.monthUsd || a.title.localeCompare(b.title))
    const monthUsd = info?.monthUsd ?? agents.reduce((n, a) => n + a.monthUsd, 0)
    const limitUsd = info?.budgetUsd ?? 0
    return { id, monthUsd: round2(monthUsd), limitUsd, todayUsd: round2(today.get(id) ?? 0), state: costState(monthUsd, limitUsd), share: total > 0 ? monthUsd / total : 0, agents }
  })
  depts.sort((a, b) => b.monthUsd - a.monthUsd || a.id.localeCompare(b.id))
  const deptTotal = depts.reduce((n, d) => n + d.monthUsd, 0)
  const totalLimit = depts.reduce((n, d) => n + d.limitUsd, 0)
  const byDay = (company?.costs.byDay ?? []).slice(-30)
  return {
    totalUsd: round2(deptTotal),
    totalLimitUsd: totalLimit,
    totalState: costState(deptTotal, totalLimit),
    todayUsd: round2([...today.values()].reduce((n, v) => n + v, 0)),
    depts,
    byDay,
    maxDay: byDay.reduce((m, d) => Math.max(m, d.usd), 0),
  }
}
