import { isoWeek, shiftWeek } from '@/lib/shell'
import { tabOf } from '@/lib/approvals'
import { REVIEW_DEPT_IDS } from '@/lib/review'

// Dev stand-in for HQ's `GET /admin/dashboard` (contract: agents docs/admin-crm-api.md «Dashboard»). The numbers are
// COMPUTED from the other mocks' rows (review queue, invoices, leads, tickets, projects) that the caller passes in,
// so the Dashboard, the Approvals page and Finance agree in development exactly as they do against HQ.

type Row = Record<string, unknown>
export type DashboardSources = {
  reviewItems: Row[] // pending review items (kind, dept)
  invoices: Row[]
  leads: Row[]
  projects: Row[]
  tickets: Row[]
}

const DAY_MS = 86_400_000
const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10)
const time = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : NaN)

const KIND_LABEL: Record<string, string> = {
  presales_pack: 'Pre-sales pack',
  bo_document: 'Document',
  pm_spec: 'Project spec',
  seo_proposal: 'SEO proposal',
  lead_reply: 'Lead reply',
  support_answer: 'Support answer',
  content_item: 'Content item',
  article: 'Article',
  content_pack: 'Content pack',
  client_campaign: 'Client mailing',
  lead_price: 'Lead price',
  support_money: 'Support money',
  billing_invoice: 'Invoice',
  billing_reminder: 'Payment reminder',
}

export function dashboardMock(range: string, now: number, s: DashboardSources) {
  const r = range === 'today' || range === '30d' ? range : '7d'
  const startOfToday = Date.parse(`${dayOf(now)}T00:00:00Z`)
  const from = r === 'today' ? startOfToday : now - (r === '7d' ? 7 : 30) * DAY_MS
  const inWindow = (v: unknown) => time(v) >= from && time(v) <= now

  // leads
  const mine = s.leads.filter((l) => inWindow(l.createdAt))
  const days: { day: string; n: number }[] = []
  for (let t = Date.parse(`${dayOf(from)}T00:00:00Z`); t <= now; t += DAY_MS) {
    const day = dayOf(t)
    days.push({ day, n: mine.filter((l) => dayOf(time(l.createdAt)) === day).length })
  }
  const won = mine.filter((l) => l.stage === 'paid' || l.stage === 'project').length
  const leads = {
    available: true,
    new: mine.length,
    inWork: mine.filter((l) => ['qualified', 'proposal', 'contract'].includes(String(l.stage))).length,
    won,
    lost: mine.filter((l) => l.stage === 'lost').length,
    conversion: mine.length ? won / mine.length : null,
    perDay: days,
  }

  // approvals: the same rows the Approvals page lists
  const kinds = new Map<string, number>()
  const depts = new Map<string, number>()
  for (const it of s.reviewItems) {
    kinds.set(String(it.kind), (kinds.get(String(it.kind)) ?? 0) + 1)
    depts.set(String(it.dept), (depts.get(String(it.dept)) ?? 0) + 1)
  }
  const approvals = {
    available: true,
    waiting: s.reviewItems.length,
    byKind: [...kinds.entries()].map(([kind, n]) => ({ kind, label: KIND_LABEL[kind] ?? kind, n })),
    byDept: REVIEW_DEPT_IDS.filter((d) => depts.has(d)).map((dept) => ({ dept, n: depts.get(dept)! })),
  }

  // money: invoices like Finance reads them
  const amount = (i: Row) => Number(i.amountUsd) || 0
  const paidRows = s.invoices.filter((i) => i.status === 'paid' && inWindow(i.paidAt))
  const issued = s.invoices.filter((i) => i.status === 'issued')
  const late = (i: Row) => Boolean(i.dueDate) && time(i.dueDate) < now
  const thisWeek = isoWeek(now, 'UTC')
  const weeks = Array.from({ length: 8 }, (_, i) => shiftWeek(thisWeek, i - 7))
  const money = {
    available: true,
    currency: 'USD',
    paid: paidRows.reduce((n, i) => n + amount(i), 0),
    pending: issued.filter((i) => !late(i)).reduce((n, i) => n + amount(i), 0),
    overdue: issued.filter(late).reduce((n, i) => n + amount(i), 0),
    invoices: { paid: paidRows.length, pending: issued.filter((i) => !late(i)).length, overdue: issued.filter(late).length },
    perWeek: weeks.map((week) => ({
      week,
      paid: s.invoices.filter((i) => i.status === 'paid' && i.paidAt && isoWeek(time(i.paidAt), 'UTC') === week).reduce((n, i) => n + amount(i), 0),
    })),
  }

  // projects
  const stages = ['draft', 'active', 'paused', 'done']
  const projects = {
    available: true,
    byStage: stages.map((stage) => ({ stage, n: s.projects.filter((p) => p.status === stage).length })),
    active: s.projects.filter((p) => p.status === 'active').length,
    closed: s.projects.filter((p) => p.status === 'done').length,
  }

  // tickets: open older than 4 h breach the SLA
  const open = s.tickets.filter((t) => t.status === 'open')
  const answered = s.tickets.filter((t) => t.status === 'answered' && inWindow(t.answeredAt))
  const waits = answered.map((t) => (time(t.answeredAt) - time(t.createdAt)) / 60_000).filter((m) => m >= 0)
  const tickets = {
    available: true,
    open: open.length,
    overdue: open.filter((t) => now - time(t.createdAt) > 4 * 3_600_000).length,
    answeredToday: s.tickets.filter((t) => t.status === 'answered' && time(t.answeredAt) >= startOfToday).length,
    avgFirstResponseMin: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null,
  }

  // content: a seven-day plan; today's waiting count is the pending content items of the review queue
  const waitingContent = s.reviewItems.filter((it) => tabOf({ kind: String(it.kind) }) === 'content').length
  const plan = [
    [1, 0, 1],
    [2, 1, 1],
    [1, 1, 0],
    [2, 1, 0],
    [1, 0, 0],
    [0, 0, 0],
    [1, 0, 0],
  ]
  const content = {
    available: true,
    queue: plan.map(([planned, approvedN, published], i) => ({ day: dayOf(startOfToday + i * DAY_MS), planned, approved: approvedN, published })),
    waitingApproval: waitingContent,
  }

  const agents = {
    available: true,
    activeNow: 3,
    tasksToday: 14,
    tasksFailedToday: 1,
    spendToday: 3.42,
    spendMonth: 69.6,
    budgetMonth: 175,
    byDept: [
      { dept: 'marketing', spendMonth: 14.2, limit: 40 },
      { dept: 'sales', spendMonth: 24.6, limit: 30 },
      { dept: 'support', spendMonth: 3.4, limit: 20 },
      { dept: 'production', spendMonth: 16.4, limit: 60 },
      { dept: 'backoffice', spendMonth: 1.2, limit: 10 },
      { dept: 'director', spendMonth: 9.8, limit: 15 },
    ],
  }

  const services = [
    { id: 'site', title: 'Website', state: 'ok' },
    { id: 'hq', title: 'Agents HQ', state: 'ok' },
    { id: 'bot', title: 'Telegram bot', state: 'ok' },
    { id: 'payments', title: 'Payment watcher', state: 'degraded' },
  ]

  const proposals = mine.filter((l) => ['proposal', 'contract', 'paid', 'project'].includes(String(l.stage))).length
  const contracts = mine.filter((l) => ['contract', 'paid', 'project'].includes(String(l.stage))).length
  const funnel = [
    { step: 'leads', n: mine.length },
    { step: 'qualified', n: mine.filter((l) => !['new', 'lost'].includes(String(l.stage))).length },
    { step: 'proposals', n: proposals },
    { step: 'contracts', n: contracts },
    { step: 'paid', n: won },
    { step: 'projects', n: mine.filter((l) => l.stage === 'project').length },
  ]

  return { ok: true, range: r, from: new Date(from).toISOString(), to: new Date(now).toISOString(), tz: 'Asia/Dushanbe', generatedAt: new Date(now).toISOString(), leads, approvals, money, projects, tickets, content, agents, services, funnel }
}
