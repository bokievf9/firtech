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

const fin = await import('../src/lib/finance.ts')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const inv = (o) => ({ id: '1', number: 'FT-1', client: 'A', title: 'Сайт, этап 1', amountUsd: 100, payAmountUsd: null, status: 'paid', dueDate: null, issuedAt: null, paidAt: '2026-11-10T10:00:00.000Z', paidVia: 'usdt_ton', txId: '', payUrl: null, remindedAt: null, leadId: null, projectId: null, ...o })

test('stageOf reads the stage number from the title', () => {
  assert.equal(fin.stageOf('Сайт, этап 2'), 2)
  assert.equal(fin.stageOf('Bot, Stage 3 of 4'), 3)
  assert.equal(fin.stageOf('Подписка'), null)
})

test('paymentsView: month total, stages, awaiting, previous month', () => {
  const now = Date.parse('2026-11-20T00:00:00Z')
  const list = [
    inv({ id: '1', amountUsd: 300 }),
    inv({ id: '2', title: 'Сайт, этап 2', amountUsd: 150.5, paidAt: '2026-11-15T10:00:00.000Z' }),
    inv({ id: '3', title: 'Подписка', amountUsd: 29, paidAt: '2026-11-02T10:00:00.000Z' }),
    inv({ id: '4', amountUsd: 80, paidAt: '2026-10-20T10:00:00.000Z' }),
    inv({ id: '5', status: 'issued', amountUsd: 600, paidAt: null, dueDate: '2026-11-18T00:00:00Z' }),
    inv({ id: '6', status: 'void', amountUsd: 999, paidAt: null }),
  ]
  const v = fin.paymentsView(list, '2026-11', now)
  assert.equal(v.paidUsd, 479.5)
  assert.equal(v.paidCount, 3)
  assert.deepEqual(v.rows.map((r) => r.id), ['2', '1', '3'])
  assert.deepEqual(v.byStage.map((s) => [s.stage, s.usd]), [[1, 300], [2, 150.5], [null, 29]])
  assert.equal(v.awaitingUsd, 600)
  assert.equal(v.overdueCount, 1)
  assert.equal(v.previousUsd, 80)
  assert.deepEqual(v.months, ['2026-11', '2026-10'])
  assert.equal(fin.paymentsView([], '2026-11', now).paidUsd, 0)
})

test('month helpers', () => {
  assert.equal(fin.shiftMonth('2026-01', -1), '2025-12')
  assert.equal(fin.shiftMonth('2026-12', 1), '2027-01')
  assert.ok(fin.isMonthKey('2026-11'))
  assert.ok(!fin.isMonthKey('2026-13') && !fin.isMonthKey(null))
})

test('costState thresholds: 80% warns, 100% is over, no limit = none', () => {
  assert.equal(fin.costState(5, 0), 'none')
  assert.equal(fin.costState(7.9, 10), 'ok')
  assert.equal(fin.costState(8, 10), 'warn')
  assert.equal(fin.costState(10, 10), 'over')
})

test('costsView joins departments, agents and company days; hq and director are one row', () => {
  const list = {
    departments: [{ id: 'hq', budgetUsd: 5, monthUsd: 4.5 }, { id: 'marketing', budgetUsd: 25, monthUsd: 6.8 }],
    agents: [
      { id: 'director', title: 'Director', dept: 'hq', monthUsd: 4.5 },
      { id: 'a', title: 'Content Maker', dept: 'marketing', monthUsd: 5 },
      { id: 'b', title: 'Publisher', dept: 'marketing', monthUsd: 1.8 },
    ],
  }
  const company = { costs: { byDept: [{ dept: 'director', todayUsd: 0.5, monthUsd: 4.5, limitUsd: 5 }, { dept: 'marketing', todayUsd: 0.25, monthUsd: 6.8, limitUsd: 25 }], byDay: [{ date: '2026-11-19', usd: 1 }, { date: '2026-11-20', usd: 2 }] } }
  const v = fin.costsView(list, company)
  assert.deepEqual(v.depts.map((d) => d.id), ['marketing', 'hq'])
  assert.equal(v.depts[1].state, 'warn')
  assert.equal(v.depts[0].agents[0].title, 'Content Maker')
  assert.equal(v.totalUsd, 11.3)
  assert.equal(v.totalLimitUsd, 30)
  assert.equal(v.todayUsd, 0.75)
  assert.equal(v.maxDay, 2)
  const empty = fin.costsView({ departments: [], agents: [] }, null)
  assert.equal(empty.depts.length, 0)
  assert.equal(empty.totalState, 'none')
})

test('Finance is wired: tabs, page, mock data, no client text, no empty catch or long dash', () => {
  const shell = read('src/lib/hq-shell.ts')
  assert.match(shell, /finance: \['invoices', 'payments', 'costs'\]/)
  assert.match(read('src/components/admin/hq/sections.tsx'), /<InvoicesTab focus=\{focus\} \/>/)
  const hqAdmin = read('src/lib/hq-admin.ts')
  assert.match(hqAdmin, /\^agents\$/)
  assert.match(hqAdmin, /\^company\$/)
  assert.match(hqAdmin, /\^crm\\\/invoices\$/)
  for (const f of ['src/lib/finance.ts', 'src/components/admin/hq/finance-view.tsx']) {
    const t = read(f)
    assert.doesNotMatch(t, /catch\s*(\([^)]*\))?\s*\{\s*\}/, f)
    assert.doesNotMatch(t, /[–—]/, f)
  }
})
