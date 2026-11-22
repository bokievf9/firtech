import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier === 'next/server') return next('next/server.js', context)
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return next(candidate, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
})

// Shell Dashboard (2026-11-23): view model of HQ's GET /admin/dashboard, chart geometry, the dev mock, the proxy whitelist.
const v = await import('../src/lib/shell-dashboard.ts')
const { dashboardMock } = await import('../src/lib/shell-dashboard-mock.ts')
const { resolveEndpoint } = await import('../src/lib/hq-admin.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const ap = await import('../src/lib/approvals.ts')
const rv = await import('../src/lib/review.ts')
const fin = await import('../src/lib/finance.ts')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const NOW = Date.parse('2026-11-23T10:00:00Z')
const ago = (min) => new Date(NOW - min * 60_000).toISOString()
const sources = {
  reviewItems: [
    { kind: 'content_item', dept: 'marketing' },
    { kind: 'article', dept: 'marketing' },
    { kind: 'lead_reply', dept: 'sales' },
    { kind: 'billing_invoice', dept: 'backoffice' },
    { kind: 'mystery_kind', dept: 'director' },
  ],
  invoices: [
    { status: 'paid', amountUsd: 300, paidAt: ago(20) },
    { status: 'paid', amountUsd: 450, paidAt: ago(60 * 24 * 12) },
    { status: 'issued', amountUsd: 600, dueDate: new Date(NOW + 2 * 86_400_000).toISOString() },
    { status: 'issued', amountUsd: 450, dueDate: new Date(NOW - 2 * 86_400_000).toISOString() },
    { status: 'void', amountUsd: 50 },
  ],
  leads: [
    { stage: 'new', createdAt: ago(25) },
    { stage: 'qualified', createdAt: ago(60 * 9) },
    { stage: 'paid', createdAt: ago(60 * 70) },
    { stage: 'lost', createdAt: ago(60 * 24 * 9) },
  ],
  projects: [{ status: 'active' }, { status: 'draft' }, { status: 'done' }],
  tickets: [{ status: 'open', createdAt: ago(250) }, { status: 'open', createdAt: ago(30) }],
}

test('normalize: needs a known range, every block is checked on its own', () => {
  assert.equal(v.normalizeDashboard(null), null)
  assert.equal(v.normalizeDashboard({ range: 'year' }), null)
  const d = v.normalizeDashboard({ ok: true, range: '7d', tz: 'Asia/Dushanbe', leads: { available: false }, money: 'garbage', approvals: { available: true, waiting: 2, byKind: [{ kind: 'lead_reply', label: 'x', n: 2 }, { n: 5 }], byDept: [] }, services: [{ id: 'site', title: 'Website', state: 'ok' }, { id: 'x', state: 'weird' }] })
  assert.equal(d.range, '7d')
  assert.equal(d.leads.available, false)
  assert.equal(d.money.available, false)
  assert.equal(d.projects.available, false)
  assert.equal(d.approvals.available, true)
  assert.equal(d.approvals.byKind.length, 1)
  assert.deepEqual(d.services.items.map((s) => s.state), ['ok', 'unknown'])
  assert.equal(v.unavailableCount(d), 7)
})

test('normalize: bad numbers become zero, a missing conversion stays null', () => {
  const d = v.normalizeDashboard({ range: 'today', leads: { available: true, new: -3, inWork: 'x', won: 1, lost: 0, conversion: null, perDay: [{ day: '2026-11-23', n: 2 }, { day: 'bad', n: 1 }] }, tickets: { available: true, open: 1, overdue: 0, answeredToday: 0, avgFirstResponseMin: null } })
  assert.equal(d.leads.new, 0)
  assert.equal(d.leads.inWork, 0)
  assert.equal(d.leads.conversion, null)
  assert.equal(d.leads.perDay.length, 1)
  assert.equal(d.tickets.avgFirstResponseMin, null)
})

test('numbers: money, percent, minutes, spend state', () => {
  assert.equal(v.usd(1234.6), '$1,235')
  assert.equal(v.usdCents(3.4), '$3.40')
  assert.equal(v.percent(null), '-')
  assert.equal(v.percent(0.333), '33%')
  assert.equal(v.minutesLabel(null), '-')
  assert.equal(v.minutesLabel(45), '45 min')
  assert.equal(v.minutesLabel(90), '1.5 h')
  assert.equal(v.spendState(5, null), 'none')
  assert.equal(v.spendState(5, 0), 'none')
  assert.equal(v.spendState(7.9, 10), 'ok')
  assert.equal(v.spendState(8, 10), 'warn')
  assert.equal(v.spendState(10, 10), 'over')
  assert.equal(v.spendRatio(30, 10), 1)
})

test('approval tiles regroup the kinds into the four Approvals tabs and keep the total', () => {
  const d = v.normalizeDashboard(dashboardMock('7d', NOW, sources))
  const tiles = v.approvalTiles(d.approvals)
  assert.deepEqual(tiles.map((t) => t.tab), ['documents', 'replies', 'content', 'money'])
  assert.deepEqual(tiles.map((t) => t.n), [1, 1, 2, 1]) // the unknown kind waits in Documents, like on the page
  assert.equal(tiles.reduce((n, t) => n + t.n, 0), d.approvals.waiting)
})

test('mock: money and leads are computed from the rows, windows differ by range', () => {
  const w7 = v.normalizeDashboard(dashboardMock('7d', NOW, sources))
  assert.equal(w7.money.paid, 300)
  assert.equal(w7.money.pending, 600)
  assert.equal(w7.money.overdue, 450)
  assert.deepEqual(w7.money.invoices, { paid: 1, pending: 1, overdue: 1 })
  assert.equal(w7.money.perWeek.length, 8)
  assert.equal(w7.leads.new, 3)
  assert.equal(w7.leads.won, 1)
  assert.equal(w7.leads.conversion, 1 / 3)
  const w30 = v.normalizeDashboard(dashboardMock('30d', NOW, sources))
  assert.equal(w30.money.paid, 750)
  assert.equal(w30.leads.new, 4)
  assert.equal(w30.leads.perDay.length, 31)
  const today = v.normalizeDashboard(dashboardMock('today', NOW, sources))
  assert.equal(today.leads.perDay.length, 1)
  assert.equal(today.tickets.overdue, 1)
})

test('funnel rows: width against the largest step, rate against the step above', () => {
  const rows = v.funnelRows([{ step: 'leads', n: 10 }, { step: 'qualified', n: 5 }, { step: 'paid', n: 0 }, { step: 'projects', n: 0 }])
  assert.deepEqual(rows.map((r) => r.width), [1, 0.5, 0, 0])
  assert.deepEqual(rows.map((r) => r.rate), [null, 0.5, 0, null])
  assert.deepEqual(v.funnelRows([]), [])
})

test('column chart: nice axis, baseline anchored, an empty series is flagged', () => {
  assert.equal(v.niceMax(0), 1)
  assert.equal(v.niceMax(7), 10)
  assert.equal(v.niceMax(130), 200)
  const c = v.columnChart([{ label: 'a', value: 5 }, { label: 'b', value: 0 }, { label: 'c', value: 10 }], 320, 120)
  assert.equal(c.max, 10)
  assert.equal(c.empty, false)
  assert.equal(c.columns[1].h, 0)
  for (const col of c.columns) assert.equal(col.y + col.h, c.baseline)
  assert.ok(c.columns[2].h > c.columns[0].h)
  assert.equal(v.columnChart([{ label: 'a', value: 0 }]).empty, true)
  assert.equal(v.columnChart([]).columns.length, 0)
})

test('x labels never collide: all up to 8 columns, about six after, the last one always', () => {
  assert.equal(v.labelIndexes(7).size, 7)
  const many = v.labelIndexes(31)
  assert.ok(many.size <= 7 && many.has(30))
  assert.equal(v.dayShort('2026-11-05'), '05')
  assert.equal(v.dayLong('2026-11-05'), 'Nov 5')
  assert.equal(v.weekShort('2026-W47'), 'W47')
})

test('convergence in the dev mock: Dashboard approvals equal the Approvals page, money equals Finance', () => {
  const T0 = Date.parse('2026-11-23T10:00:00Z')
  const mock = createHqMock(T0)
  const dash = v.normalizeDashboard(mock('GET', 'dashboard', { range: '30d' }, {}, T0))
  const review = rv.normalizeReview(mock('GET', 'review', { status: 'pending', limit: '200' }, {}, T0))
  const sum = ap.approvalsSummary(review)
  assert.equal(dash.approvals.waiting, sum.total)
  assert.deepEqual(Object.fromEntries(v.approvalTiles(dash.approvals).map((t) => [t.tab, t.n])), sum.tabs)
  const inv = mock('GET', 'crm/invoices', { limit: '200' }, {}, T0).items
  const pay = fin.paymentsView(inv, T0 ? new Date(T0).toISOString().slice(0, 7) : '', T0)
  assert.equal(dash.money.pending + dash.money.overdue, pay.awaitingUsd)
  assert.equal(dash.money.invoices.overdue, pay.overdueCount)
})

test('range parsing falls back to 7 days', () => {
  assert.equal(v.parseRange('30d'), '30d')
  assert.equal(v.parseRange('nope'), '7d')
})

test('the proxy lets only GET dashboard?range through', async () => {
  assert.deepEqual(resolveEndpoint('GET', ['dashboard'], new URLSearchParams('range=30d&x=1'), undefined), { ok: true, path: 'dashboard', query: { range: '30d' } })
  assert.equal(resolveEndpoint('POST', ['dashboard'], new URLSearchParams(), {}).ok, false)
  assert.equal(resolveEndpoint('GET', ['dashboard', 'x'], new URLSearchParams(), undefined).ok, false)
})

test('dashboard source: no empty catch, no long dashes, no Cyrillic, section registered', () => {
  for (const f of ['src/lib/shell-dashboard.ts', 'src/lib/shell-dashboard-mock.ts', 'src/components/admin/dashboard/dashboard-section.tsx', 'src/components/admin/dashboard/charts.tsx']) {
    const t = read(f)
    assert.doesNotMatch(t, /catch\s*(\([^)]*\))?\s*\{\s*\}/, f)
    assert.doesNotMatch(t, /[–—]/, f)
    assert.doesNotMatch(t.replace(/\/\/.*$/gm, ''), /[А-Яа-яЁё]/, f)
  }
  assert.match(read('src/lib/hq-admin.ts'), /\^dashboard\$/)
})
