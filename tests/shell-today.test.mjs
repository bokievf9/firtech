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
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return next(candidate, context)
        } catch (e) {
          if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e
        }
      }
    }
    return next(specifier, context)
  },
})

// Shell Dashboard «today» (2026-11-27): the view model of HQ's GET /admin/today, its dev mock and the proxy entry.
const t = await import('../src/lib/shell-today.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const { approvalsSummary } = await import('../src/lib/approvals.ts')
const { normalizeReview } = await import('../src/lib/review.ts')
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const NOW = Date.parse('2026-11-27T04:05:00Z')

const full = () => ({
  generatedAt: '2026-11-27T04:05:00Z', tz: 'Asia/Kuala_Lumpur', date: '2026-11-27',
  night: { available: true, text: 'x', items: [{ kind: 'lead', text: 'Новый лид', href: '/admin/clients?focus=l_12' }] },
  decide: { available: true, total: 9, items: [{ id: 'ap_12', kind: 'document', title: 'КП: Боб', meta: 'Документ · Sales · 1 д', ageMinutes: 1500, href: '/admin/approvals?id=ap_12', actions: [{ id: 'open', label: 'Открыть', kind: 'link', href: '/admin/approvals?id=ap_12' }, { id: 'approve', label: 'Одобрить', kind: 'post', url: '/admin/review/ap_12', body: { action: 'approve' }, primary: true }] }], byKind: { document: 1, reply: 2, content: 4, money: 2 } },
  hotLeads: { available: true, items: [{ id: 'l_12', name: 'Нигина', what: 'бот', amount: 350, stage: 'new', stageLabel: 'Новый', ageMinutes: 25, channel: 'telegram', next: { label: 'Ответить', href: '/admin/chats?lead=l_12' } }] },
  money: { available: true, paid7d: 300, pending: 600, overdue: 450, overdueCount: 1, perDay: Array.from({ length: 7 }, (_, i) => ({ day: `2026-11-2${i}`, paid: i === 6 ? 300 : 0 })) },
  funnel: { available: true, days: 30, steps: [{ step: 'leads', label: 'Лиды', n: 6 }, { step: 'quotes', label: 'КП', n: 4 }, { step: 'contracts', label: 'Договор', n: 3 }, { step: 'paid', label: 'Оплата', n: 2 }] },
  team: { available: true, busy: 6, total: 19, items: [{ id: 'lead_manager', title: 'Lead Manager', state: 'working', doing: 'отвечает', href: '/admin/team/lead_manager' }], spendToday: 3.8, limitToday: 10 },
  alerts: { available: true, items: [{ id: 'a1', level: 'bad', text: 'Тикет без ответа', href: '/admin/chats?thread=t_9' }] },
})

test('normalizer: a full contract payload keeps every block', () => {
  const x = t.normalizeToday(full())
  assert.equal(x.tz, 'Asia/Kuala_Lumpur')
  assert.equal(x.date, '2026-11-27')
  for (const id of t.BLOCK_IDS) assert.equal(x[id].available, true, id)
  assert.equal(x.decide.total, 9)
  assert.equal(x.decide.items[0].actions[1].url, 'review/ap_12')
  assert.equal(x.decide.items[0].actions[1].primary, true)
  assert.equal(x.decide.byKind.content, 4)
  assert.equal(x.money.perDay.length, 7)
  assert.equal(x.funnel.steps.length, 4)
  assert.equal(x.team.limitToday, 10)
})

test('normalizer: unknown kinds become other, bad numbers 0, bad dates null, bad links dropped', () => {
  const raw = full()
  raw.decide.items[0].kind = 'weird'
  raw.decide.items[0].ageMinutes = 'soon'
  raw.decide.items[0].href = 'https://evil.example/x'
  raw.generatedAt = 'not a date'
  raw.date = '27.11.2026'
  raw.money.paid7d = -5
  raw.money.pending = NaN
  raw.night.items[0].kind = 'nope'
  raw.team.items[0].state = 'sleeping'
  raw.team.limitToday = 0
  raw.alerts.items[0].level = 'catastrophe'
  const x = t.normalizeToday(raw)
  assert.equal(x.decide.items[0].kind, 'other')
  assert.equal(x.decide.items[0].ageMinutes, 0)
  assert.equal(x.decide.items[0].href, null)
  assert.equal(x.generatedAt, null)
  assert.equal(x.date, null)
  assert.equal(x.money.paid7d, 0)
  assert.equal(x.money.pending, 0)
  assert.equal(x.night.items[0].kind, 'task')
  assert.equal(x.team.items[0].state, 'idle')
  assert.equal(x.team.limitToday, null)
  assert.equal(x.alerts.items[0].level, 'warn')
})

test('normalizer: a post action may only target a review decision; a bad one is dropped', () => {
  const raw = full()
  raw.decide.items[0].actions.push({ id: 'x', label: 'X', kind: 'post', url: '/admin/settings', body: {} }, { id: 'y', label: 'Y', kind: 'post', url: '/admin/review/ap_1/../../x', body: {} })
  const x = t.normalizeToday(raw)
  assert.deepEqual(x.decide.items[0].actions.map((a) => a.id), ['open', 'approve'])
  assert.equal(t.safeHref('/admin/approvals?id=ap_1'), '/admin/approvals?id=ap_1')
  assert.equal(t.safeHref('//evil.example'), null)
  assert.equal(t.safeHref('javascript:alert(1)'), null)
})

test('normalizer: an unavailable or malformed block is gone, the others stay; garbage is null', () => {
  const raw = full()
  raw.night = { available: false }
  raw.money = 'oops'
  raw.alerts = { available: 'yes' }
  const x = t.normalizeToday(raw)
  assert.equal(x.night.available, false)
  assert.equal(x.money.available, false)
  assert.equal(x.alerts.available, false)
  assert.equal(x.decide.available, true)
  assert.equal(t.normalizeToday(null), null)
  assert.equal(t.normalizeToday({ ok: false, error: 'x' }), null)
  assert.equal(t.normalizeToday([]), null)
})

test('a decision removes the row and lowers the total and the kind count, never below zero', () => {
  const x = t.normalizeToday(full())
  const y = t.withoutDecision(x, 'ap_12')
  assert.equal(y.decide.total, 8)
  assert.equal(y.decide.byKind.document, 0)
  assert.equal(y.decide.items.length, 0)
  assert.equal(t.withoutDecision(y, 'ap_12'), y)
  assert.equal(t.waitingTotal(y), 8)
  assert.equal(t.waitingTotal(null), null)
  const gone = t.normalizeToday({ ...full(), decide: { available: false } })
  assert.equal(t.waitingTotal(gone), null)
})

test('helpers: age words, sparkline, funnel and spend ratios', () => {
  assert.equal(t.ageLabel(0), 'now')
  assert.equal(t.ageLabel(25), '25 min')
  assert.equal(t.ageLabel(180), '3 h')
  assert.equal(t.ageLabel(60 * 72), '3 d')
  const bars = t.sparkBars([{ paid: 0 }, { paid: 100 }, { paid: 50 }])
  assert.equal(bars[1].ratio, 1)
  assert.equal(bars[2].ratio, 0.5)
  assert.ok(bars[0].ratio > 0)
  assert.equal(bars.at(-1).last, true)
  assert.ok(t.sparkBars([{ paid: 0 }])[0].ratio > 0)
  assert.deepEqual(t.funnelRows([{ step: 'a', label: 'A', n: 4 }, { step: 'b', label: 'B', n: 2 }]).map((r) => r.width), [1, 0.5])
  assert.equal(t.funnelRows([{ step: 'a', label: 'A', n: 0 }])[0].width, 0)
  assert.equal(t.spendRatio(5, 10), 0.5)
  assert.equal(t.spendRatio(20, 10), 1)
  assert.equal(t.spendRatio(5, null), 0)
  assert.equal(t.dateInWords('2026-11-27'), 'Friday 27 November')
  assert.equal(t.dateInWords(null), '')
  assert.equal(t.usd(1234.5), '$1,235')
})

test('proxy: `today` is whitelisted with only `tz`; the old dashboard route is gone', () => {
  const r = (m, seg, q, b) => proxy.resolveEndpoint(m, seg, q, b)
  assert.equal(r('GET', ['today'], new URLSearchParams(), undefined).ok, true)
  assert.equal(r('GET', ['today'], new URLSearchParams('tz=Asia/Dushanbe'), undefined).ok, true)
  assert.deepEqual(r('GET', ['today'], new URLSearchParams('range=7d&tz=UTC'), undefined).query, { tz: 'UTC' })
  assert.equal(r('POST', ['today'], new URLSearchParams(), {}).ok, false)
  assert.equal(r('GET', ['dashboard'], new URLSearchParams(), undefined).ok, false)
})

test('mock: one count everywhere (decide equals the pending review queue), every block there, the partial variant', () => {
  const hq = createHqMock(NOW)
  const today = hq('GET', 'today', {}, {}, NOW)
  const review = normalizeReview(hq('GET', 'review', { status: 'pending', limit: '200' }, {}, NOW))
  const x = t.normalizeToday(today)
  assert.ok(x)
  for (const id of t.BLOCK_IDS) assert.equal(x[id].available, true, id)
  assert.equal(x.decide.total, approvalsSummary(review).total)
  assert.equal(x.decide.items.length, review.items.filter((i) => i.status === 'pending').length)
  assert.equal(Object.values(x.decide.byKind).reduce((n, v) => n + v, 0), x.decide.total)
  assert.ok(x.decide.items.some((i) => i.actions.some((a) => a.id === 'approve' && a.primary)))
  assert.ok(x.hotLeads.items.length <= 5 && x.hotLeads.items.length > 0)
  assert.equal(x.hotLeads.items[0].stage, 'new')
  assert.equal(x.money.perDay.length, 7)
  assert.equal(x.funnel.steps.length, 4)
  const partial = t.normalizeToday(hq('GET', 'today', { tz: 'Etc/Partial' }, {}, NOW))
  assert.equal(partial.night.available, false)
  assert.equal(partial.alerts.available, false)
  assert.equal(partial.decide.available, true)
})

test('mock: approving through the same endpoint lowers the today count by one', () => {
  const hq = createHqMock(NOW)
  const before = t.normalizeToday(hq('GET', 'today', {}, {}, NOW))
  const item = before.decide.items.find((i) => i.actions.some((a) => a.id === 'approve'))
  const a = item.actions.find((x) => x.id === 'approve')
  assert.equal(hq('POST', a.url, {}, a.body, NOW).ok, true)
  const after = t.normalizeToday(hq('GET', 'today', {}, {}, NOW))
  assert.equal(after.decide.total, before.decide.total - 1)
})

test('wiring: the old dashboard files are gone, the page uses the today view', () => {
  for (const f of ['src/lib/shell-dashboard.ts', 'src/lib/shell-dashboard-mock.ts', 'src/components/admin/dashboard/charts.tsx']) assert.throws(() => read(f), f)
  assert.match(read('src/components/admin/dashboard/dashboard-section.tsx'), /useHqView\('today', normalizeToday/)
  assert.match(read('src/components/admin/dashboard/dashboard-section.tsx'), /visible: 15_000, hidden: 60_000/)
})
