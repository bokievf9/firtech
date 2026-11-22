import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// '@/...' for plain Node (same mapping as processes.test.mjs).
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

// HQ «Audit log» and «Analytics» (2026-11-23): view models, filters, paging, numbers, whitelist, dev mock, texts.
const au = await import('../src/lib/audit-hq.ts')
const an = await import('../src/lib/analytics-hq.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const shell = await import('../src/lib/hq-shell.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const none = new URLSearchParams()
const T0 = Date.parse('2026-11-23T06:00:00Z')

test('sections: Audit log and Analytics follow Settings, ready, with pages', () => {
  const ids = shell.HQ_SECTIONS.map((s) => s.id)
  assert.deepEqual(ids.slice(ids.indexOf('settings')), ['settings', 'audit', 'analytics', 'knowledge', 'quality'])
  for (const id of ['audit', 'analytics']) {
    const s = shell.sectionById(id)
    assert.equal(s.state, 'ready')
    assert.equal(s.href, `/admin/${id}`)
    assert.ok(read(`src/app/admin/(hq)/${id}/page.tsx`).length > 0)
    assert.ok(read('src/content/admin.ts').includes(`${id}: '`), `hint for ${id}`)
  }
  assert.equal(shell.sectionById('audit').label, 'Audit log')
  assert.equal(shell.sectionById('analytics').label, 'Analytics')
})

test('audit: the query carries only valid filters, cursor and limit', () => {
  assert.equal(au.auditPath(au.emptyFilter), 'audit?limit=50')
  const p = au.auditPath({ kind: 'trust', actor: 'owner', from: '2026-11-01', to: '2026-11-23' }, '1700000000000_3_12', 20)
  assert.equal(new URLSearchParams(p.split('?')[1]).get('kind'), 'trust')
  assert.equal(new URLSearchParams(p.split('?')[1]).get('cursor'), '1700000000000_3_12')
  assert.equal(new URLSearchParams(p.split('?')[1]).get('limit'), '20')
  // junk is dropped, never sent
  const junk = au.auditPath({ kind: '', actor: 'a b/c', from: 'yesterday', to: '' }, 'x;drop')
  assert.equal(junk, 'audit?limit=50')
  assert.equal(au.isFilterActive(au.emptyFilter), false)
  assert.equal(au.isFilterActive({ ...au.emptyFilter, actor: 'owner' }), true)
})

test('audit: normalizer drops unknown kinds and bad rows, appendEntries never repeats', () => {
  const body = {
    ok: true, tz: 'Asia/Dushanbe', counts: { decision: 2, setting: 1, bogus: 9 }, actors: ['owner', '', 5, 'system'], nextCursor: '1700000000000_2_5',
    entries: [
      { id: 'dec:2', kind: 'decision', at: '2026-11-23T05:00:00.000Z', actor: 'owner', action: 'decision', objectType: 'approval', objectId: '7', detail: 'lead_reply approve', text: 'leak' },
      { id: 'x:1', kind: 'alien', at: '2026-11-23T05:00:00.000Z' },
      { id: 'set:1', kind: 'setting', at: 'not a date' },
      { kind: 'owner', at: '2026-11-23T05:00:00.000Z' },
    ],
  }
  const page = au.normalizeAudit(body)
  assert.equal(page.entries.length, 1)
  assert.deepEqual(Object.keys(page.entries[0]).sort(), ['action', 'actor', 'at', 'detail', 'id', 'kind', 'objectId', 'objectType'])
  assert.deepEqual(page.actors, ['owner', 'system'])
  assert.equal(page.counts.owner, 0)
  assert.equal(page.total, 3)
  assert.equal(page.nextCursor, '1700000000000_2_5')
  assert.equal(au.normalizeAudit({ ok: true }), null)
  assert.equal(au.normalizeAudit({ nextCursor: 'evil', entries: [] }).nextCursor, null)
  const more = au.appendEntries(page.entries, [page.entries[0], { ...page.entries[0], id: 'dec:1' }])
  assert.deepEqual(more.map((e) => e.id), ['dec:2', 'dec:1'])
})

test('audit: links go to the agent card, settings and approvals only', () => {
  const e = (over) => ({ id: 'a:1', kind: 'owner', at: '2026-11-23T05:00:00.000Z', actor: 'owner', action: '', objectType: '', objectId: '', detail: '', ...over })
  assert.equal(au.auditHref(e({ kind: 'instruction', objectId: 'marketing-head' })), '/admin/agents?agent=marketing-head')
  assert.equal(au.auditHref(e({ kind: 'instruction', objectId: '../evil' })), null)
  assert.equal(au.auditHref(e({ kind: 'setting', objectId: 'quiet_hours' })), '/admin/settings')
  assert.equal(au.auditHref(e({ kind: 'decision' })), '/admin/approvals')
  assert.equal(au.auditHref(e({ kind: 'owner' })), null)
})

test('analytics: normalizer keeps only known numbers, rates and changes are plain arithmetic', () => {
  const d = an.normalizeAnalytics({
    ok: true, week: '2026-W47', prevWeek: '2026-W46', from: '2026-11-16', to: '2026-11-22', tz: 'Asia/Dushanbe',
    funnel: { leads: 10, qualified: 5, proposals: 2, contracts: 1, paid: 1, projects: 1, extra: 4 }, prevFunnel: { leads: 8 },
    site: { chat_open: 12, 'bad key!': 3 }, prevSite: { chat_open: 6 },
    firstResponse: { leads: 10, answered: 8, avgMinutes: 30, medianMinutes: 12.5, within1hShare: 0.75 }, prevFirstResponse: {},
    sources: [{ source: 'site', leads: 6, qualified: 3, paid: 1 }, { source: '', leads: 1 }],
  })
  assert.ok(d)
  assert.deepEqual(Object.keys(d.funnel), an.FUNNEL_STEPS)
  assert.deepEqual(d.site, { chat_open: 12 })
  assert.equal(d.prevFunnel.qualified, 0)
  assert.equal(d.prevFirstResponse.avgMinutes, null)
  assert.equal(d.sources.length, 1)
  assert.equal(an.normalizeAnalytics({ week: 'x' }), null)
  assert.equal(an.stepRate(10, 5), 50)
  assert.equal(an.stepRate(0, 5), null)
  assert.equal(an.stepRate(2, 5), 100)
  assert.deepEqual(an.change(12, 6), { delta: 6, percent: 100 })
  assert.deepEqual(an.change(3, 0), { delta: 3, percent: null })
  assert.deepEqual(an.change(2, 4), { delta: -2, percent: -50 })
  assert.equal(an.minutesLabel(null), '-')
  assert.equal(an.minutesLabel(0.4), '<1 мин')
  assert.equal(an.minutesLabel(18.5), '19 мин')
  assert.equal(an.minutesLabel(90), '1.5 ч')
  assert.equal(an.minutesLabel(60 * 72), '3 дн')
  assert.deepEqual(an.siteRows({ a: 1, b: 5, z: 0 }, { a: 3, z: 0 }).map((r) => r.name), ['b', 'a'])
  assert.equal(an.shiftIsoWeek('2026-W47', -1), '2026-W46')
  assert.equal(an.shiftIsoWeek('2026-W01', -1), '2025-W52')
  assert.equal(an.shiftIsoWeek('2025-W52', 1), '2026-W01')
})

test('whitelist: audit and analytics are GET only with their query keys', () => {
  const r = (m, seg, q, b) => proxy.resolveEndpoint(m, seg, q, b)
  assert.equal(r('GET', ['audit'], new URLSearchParams('kind=trust&actor=owner&from=2026-11-01&to=2026-11-02&cursor=1_2_3&limit=20'), undefined).ok, true)
  assert.deepEqual(r('GET', ['audit'], new URLSearchParams('evil=1&kind=owner'), undefined).query, { kind: 'owner' })
  assert.equal(r('POST', ['audit'], none, {}).ok, false)
  assert.equal(r('GET', ['audit', 'x'], none, undefined).ok, false)
  assert.equal(r('GET', ['analytics'], new URLSearchParams('week=2026-W47'), undefined).ok, true)
  assert.deepEqual(r('GET', ['analytics'], new URLSearchParams('from=2026-11-01'), undefined).query, {})
  assert.equal(r('POST', ['analytics'], none, {}).ok, false)
})

test('dev mock: audit pages by cursor and filters, analytics answers a week and the one before', () => {
  const mock = createHqMock(T0)
  const first = au.normalizeAudit(mock('GET', 'audit', { limit: '20' }, {}, T0))
  assert.ok(first)
  assert.equal(first.entries.length, 20)
  assert.ok(first.nextCursor)
  const second = au.normalizeAudit(mock('GET', 'audit', { limit: '20', cursor: first.nextCursor }, {}, T0))
  assert.equal(au.appendEntries(first.entries, second.entries).length, 40)
  const trust = au.normalizeAudit(mock('GET', 'audit', { kind: 'trust' }, {}, T0))
  assert.ok(trust.entries.length > 0 && trust.entries.every((e) => e.kind === 'trust'))
  const sys = au.normalizeAudit(mock('GET', 'audit', { actor: 'system' }, {}, T0))
  assert.ok(sys.entries.every((e) => e.actor === 'system'))
  assert.equal(mock('GET', 'audit', { kind: 'nope' }, {}, T0).ok, false)
  const week = an.normalizeAnalytics(mock('GET', 'analytics', {}, {}, T0))
  assert.ok(week && week.funnel.leads > 0 && week.sources.length > 0 && week.firstResponse.avgMinutes !== null)
  assert.equal(an.normalizeAnalytics(mock('GET', 'analytics', { week: '2026-W40' }, {}, T0)).week, '2026-W40')
  assert.equal(mock('GET', 'analytics', { week: 'bad' }, {}, T0).ok, false)
})

test('copy: no long dashes, no client text in the new sections, no empty catch', () => {
  for (const f of ['src/lib/audit-hq.ts', 'src/lib/analytics-hq.ts', 'src/components/admin/hq/audit-section.tsx', 'src/components/admin/hq/analytics-section.tsx']) {
    const text = read(f)
    assert.ok(!/[–—]/.test(text), `${f}: long dash`)
    assert.ok(!/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(text), `${f}: empty catch`)
  }
  const copy = read('src/content/admin.ts')
  const start = copy.indexOf('    audit: {\n      filters')
  const block = copy.slice(start, copy.indexOf('    sectionHints: {'))
  assert.ok(block.length > 500 && !/[–—]/.test(block))
})
