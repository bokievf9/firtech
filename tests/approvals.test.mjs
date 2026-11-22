import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Approvals (docs/shell.md «Approvals»): tabs over the review queue, batch plans, version restore.
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

const a = await import('../src/lib/approvals.ts')
const r = await import('../src/lib/review.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')

const T0 = Date.parse('2026-11-21T10:00:00Z')
const items = r.normalizeReview(createHqMock(T0)('GET', 'review', { status: 'all' }, {}, T0)).items
const ids = (list) => list.map((i) => i.id).sort()

test('every kind lands in a tab, unknown kinds go to Documents', () => {
  assert.equal(a.tabOf({ kind: 'lead_price' }), 'money')
  assert.equal(a.tabOf({ kind: 'support_answer' }), 'replies')
  assert.equal(a.tabOf({ kind: 'article' }), 'content')
  assert.equal(a.tabOf({ kind: 'something_new' }), 'documents')
  const c = a.tabCounts(items)
  assert.equal(c.documents + c.replies + c.content + c.money, items.filter(r.isPending).length)
  assert.deepEqual(c, { documents: 1, replies: 2, content: 4, money: 2 })
})

test('tabItems: pending only by default, decided after them on request', () => {
  assert.deepEqual(ids(a.tabItems(items, 'money', false)), ['ap_205', 'ap_207'])
  const docs = a.tabItems(items, 'documents', true)
  assert.equal(docs.at(-1).status, 'approved')
  assert.equal(a.tabItems(items, 'documents', false).every(r.isPending), true)
})

test('planBatch keeps only what HQ allows and reports the rest as skipped', () => {
  const sel = new Set(['ap_204', 'ap_206', 'ap_210', 'nope'])
  const list = a.tabItems(items, 'replies', true).concat(a.tabItems(items, 'documents', true))
  const plan = a.planBatch(list, sel, 'approve')
  assert.deepEqual(plan.ids.sort(), ['ap_204', 'ap_206'])
  assert.deepEqual(plan.skipped, ['ap_210'])
  assert.deepEqual([...a.pruneSelection(sel, list)].sort(), ['ap_204', 'ap_206', 'ap_210'])
})

test('batch texts: money warns, results count', () => {
  assert.match(a.batchQuestion('money', 'approve', 2), /Invoices and prices go to clients/)
  assert.doesNotMatch(a.batchQuestion('replies', 'approve', 2), /Invoices/)
  assert.equal(a.batchResultText('approve', 3, 0, 0), 'Approved: 3')
  assert.match(a.batchResultText('reject', 1, 2, 1), /failed: 2.*skipped.*: 1/)
})

test('restorePayload: an old version becomes an ordinary edit, nothing when equal', () => {
  const reel = items.find((i) => i.id === 'ap_201')
  const v1 = reel.versions.find((v) => v.v === 1)
  const p = a.restorePayload(reel, v1)
  assert.ok(p && Object.keys(p.text).length > 0)
  assert.equal(a.restorePayload(reel, a.currentVersion(reel)), null)
  assert.deepEqual(a.restorableVersions(reel).map((v) => v.v), [1])
  const reply = items.find((i) => i.id === 'ap_204')
  const old = reply.versions[0]
  const q = a.restorePayload(reply, old)
  assert.equal(typeof q.text.draft, 'string')
})

test('URL parsing: tab and item id fall back, the href is built back', () => {
  assert.equal(a.parseTab('money'), 'money')
  assert.equal(a.parseTab('x'), 'documents')
  assert.equal(a.parseTab(undefined), 'documents')
  assert.equal(a.parseItemId('ap_209'), 'ap_209')
  assert.equal(a.parseItemId('ap_1; drop'), null)
  assert.equal(a.parseItemId(['ap_1']), null)
  assert.equal(a.approvalsHrefFor(), '/admin/approvals')
  assert.equal(a.approvalsHrefFor({ tab: 'money', id: 'ap_5' }), '/admin/approvals?tab=money&id=ap_5')
  assert.equal(a.approvalsHrefFor({ id: 'bad' }), '/admin/approvals')
})

test('one count: the badge, Inbox and the Approvals tabs agree with the review counts', () => {
  const view = r.normalizeReview(createHqMock(T0)('GET', 'review', { status: 'all' }, {}, T0))
  const s = a.approvalsSummary(view)
  assert.equal(s.total, r.pendingTotal(view.counts))
  assert.equal(s.tabsSum, items.filter(r.isPending).length)
  assert.equal(s.consistent, true)
  assert.equal(s.total, s.tabs.documents + s.tabs.replies + s.tabs.content + s.tabs.money)
  // after one decision the optimistic update moves both numbers by one
  const it = view.items.find((i) => r.isPending(i))
  const after = { ...view, items: r.withStatus(view.items, it.id, 'approve'), counts: r.dropCount(view.counts, it.dept) }
  const s2 = a.approvalsSummary(after)
  assert.equal(s2.total, s.total - 1)
  assert.equal(s2.consistent, true)
  assert.equal(a.approvalsSummary(null).total, 0)
})
