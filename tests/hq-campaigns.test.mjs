import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// '@/...' for plain Node (same mapping as hq-audit-analytics.test.mjs).
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

// HQ «Campaigns» (2026-11-23): strict body, view models, whitelist, dev mock, texts.
const cp = await import('../src/lib/campaigns-hq.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const shell = await import('../src/lib/hq-shell.ts')
const ap = await import('../src/lib/approvals.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const none = new URLSearchParams()
const T0 = Date.parse('2026-11-23T06:00:00Z')
const r = (m, seg, b) => proxy.resolveEndpoint(m, seg, none, b)
const good = { kind: 'news', subject: { ru: 'Тема' }, text: { ru: 'Текст' } }

test('section: Campaigns follows Finance, ready, with a page and a hint', () => {
  const ids = shell.HQ_SECTIONS.map((s) => s.id)
  assert.equal(ids[ids.indexOf('finance') + 1], 'campaigns')
  const s = shell.sectionById('campaigns')
  assert.equal(s.state, 'ready')
  assert.equal(s.label, 'Campaigns')
  assert.equal(s.href, '/admin/campaigns')
  assert.ok(read('src/app/admin/(hq)/campaigns/page.tsx').length > 0)
  assert.ok(read('src/content/admin.ts').includes("campaigns: 'News and"))
})

test('whitelist: POST campaigns has a strict body, GET list and one card only', () => {
  assert.equal(r('POST', ['campaigns'], good).ok, true)
  assert.equal(r('POST', ['campaigns'], { ...good, segment: { locale: 'ru', niche: 'salon', city: 'Dushanbe' } }).ok, true)
  assert.equal(r('POST', ['campaigns'], { ...good, extra: 1 }).ok, false)
  assert.equal(r('POST', ['campaigns'], { ...good, kind: 'ads' }).ok, false)
  assert.equal(r('POST', ['campaigns'], { ...good, segment: { locale: 'de' } }).ok, false)
  assert.equal(r('POST', ['campaigns'], { ...good, segment: { zip: '1' } }).ok, false)
  assert.equal(r('POST', ['campaigns'], { ...good, subject: { ru: 'a'.repeat(151) } }).ok, false)
  assert.equal(r('POST', ['campaigns'], { ...good, subject: { ru: 'a\nb' } }).ok, false)
  assert.equal(r('POST', ['campaigns'], { ...good, text: { ru: ' ' } }).ok, false)
  assert.equal(r('POST', ['campaigns'], { ...good, text: { ru: 'a'.repeat(8001) } }).ok, false)
  assert.equal(r('POST', ['campaigns'], {}).ok, false)
  assert.equal(r('GET', ['campaigns'], undefined).ok, true)
  assert.equal(r('GET', ['campaigns', '12'], undefined).ok, true)
  assert.equal(r('GET', ['campaigns', 'abc'], undefined).ok, false)
  assert.equal(r('POST', ['campaigns', '12'], {}).ok, false)
  assert.equal(r('GET', ['campaigns', '12', 'log'], undefined).ok, false)
})

test('form: blanks are left out, bad input gives null', () => {
  const f = { ...cp.emptyForm, subjectRu: ' Тема ', textRu: 'Текст', niche: ' ', locale: 'en' }
  assert.deepEqual(cp.formBody(f), { kind: 'news', subject: { ru: 'Тема' }, text: { ru: 'Текст' }, segment: { locale: 'en' } })
  assert.deepEqual(cp.formBody({ ...f, subjectEn: 'Topic', textEn: 'Text', locale: '' }), { kind: 'news', subject: { ru: 'Тема', en: 'Topic' }, text: { ru: 'Текст', en: 'Text' } })
  assert.equal(cp.formBody(cp.emptyForm), null)
  assert.equal(cp.formBody({ ...f, subjectRu: 'a'.repeat(200) }), null)
})

test('normalizers drop junk, keep ids and counts only', () => {
  const row = { id: 3, kind: 'news', subject: { ru: 'Т', en: 'T' }, segment: { locale: 'ru', zip: 'x' }, status: 'sent', taskId: 1, approvalId: 9, counts: { email: 4, failed: 1, 'bad key!': 5 }, createdAt: '2026-11-23T05:00:00.000Z', sentAt: null, email: 'leak@x.y' }
  const list = cp.normalizeCampaigns({ ok: true, items: [row, { id: 4, kind: 'alien', status: 'sent', createdAt: '2026-11-23T05:00:00.000Z' }, { ...row, id: 5, status: 'nope' }, { ...row, id: 6, createdAt: 'x' }] })
  assert.deepEqual(list.items.map((x) => x.id), [3])
  assert.deepEqual(list.items[0].segment, { locale: 'ru' })
  assert.deepEqual(list.items[0].counts, { email: 4, failed: 1 })
  assert.equal(list.items[0].approvalId, '9')
  assert.equal('email' in list.items[0], false)
  assert.equal(cp.normalizeCampaigns({ ok: true }), null)
  const d = cp.normalizeCampaignDetail({ ok: true, campaign: row, log: [{ clientId: 2, outcome: 'email', at: '2026-11-23T05:01:00.000Z', address: 'a@b.c' }, { clientId: 'x', outcome: 'email', at: '2026-11-23T05:01:00.000Z' }, { clientId: 3, outcome: 'No!', at: '2026-11-23T05:01:00.000Z' }] })
  assert.deepEqual(d.log, [{ clientId: 2, outcome: 'email', at: '2026-11-23T05:01:00.000Z' }, { clientId: 3, outcome: 'unknown', at: '2026-11-23T05:01:00.000Z' }])
  assert.equal(cp.normalizeCampaignDetail({ ok: true, campaign: row }), null)
  assert.deepEqual(cp.countRows({ failed: 1, email: 4, off: 0, weird: 2 }), [['email', 4], ['failed', 1], ['weird', 2]])
  assert.equal(cp.countsTotal({ email: 4, failed: 1 }), 5)
})

test('approval of a campaign sits in the Content tab, the link points there', () => {
  assert.equal(ap.tabOf({ kind: 'client_campaign' }), 'content')
  assert.equal(cp.APPROVAL_HREF, '/admin/approvals?tab=content')
})

test('dev mock: list, card with a journal, a draft stays pending and sends nothing', () => {
  const mock = createHqMock(T0)
  const list = cp.normalizeCampaigns(mock('GET', 'campaigns', {}, {}, T0))
  assert.deepEqual([...new Set(list.items.map((x) => x.status))].sort(), ['failed', 'pending', 'rejected', 'sent'])
  const sent = cp.normalizeCampaignDetail(mock('GET', 'campaigns/3', {}, {}, T0))
  assert.ok(sent.log.length > 0)
  assert.equal(mock('GET', 'campaigns/99', {}, {}, T0).ok, false)
  const made = cp.normalizeCreated(mock('POST', 'campaigns', {}, { ...good, kind: 'recommendation', segment: { locale: 'ru' } }, T0))
  assert.equal(made.campaign.status, 'pending')
  assert.ok(made.audience > 0)
  assert.equal(cp.normalizeCampaignDetail(mock('GET', `campaigns/${made.campaign.id}`, {}, {}, T0)).log.length, 0)
  assert.equal(cp.normalizeCampaigns(mock('GET', 'campaigns', {}, {}, T0)).items[0].id, made.campaign.id)
  const none = mock('POST', 'campaigns', {}, { ...good, segment: { city: 'Nowhere' } }, T0)
  assert.equal(none.ok, false)
  assert.equal(none.error, 'no_recipients')
  assert.equal(mock('POST', 'campaigns', {}, { ...good, extra: 1 }, T0).error, 'invalid')
})

test('texts: warning names approval and consent, no long dashes, no addresses in the journal view', () => {
  const ui = read('src/components/admin/hq/campaigns-section.tsx')
  const txt = read('src/content/admin.ts')
  assert.ok(/Ничего не уйдёт без вашего одобрения/.test(txt) && /согласие/.test(txt))
  assert.ok(!/[–—]/.test(ui))
  assert.ok(!/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(ui))
  assert.ok(!/\bemail\b.*\.address|\.contact/.test(ui))
})
