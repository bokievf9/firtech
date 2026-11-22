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

// HQ «Knowledge» and «Quality» (2026-11-23): view models, whitelist bodies, dev mock, texts.
const kn = await import('../src/lib/knowledge-hq.ts')
const ql = await import('../src/lib/quality-hq.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('knowledge: normalizer keeps public and internal documents, drops secret and junk', () => {
  const list = kn.normalizeKnowledge({
    ok: true,
    total: 4,
    builtAt: '2026-11-23T08:00:00.000Z',
    items: [
      { id: 'a', title: 'Цены', tier: 'public', source: 'site', updatedAt: '2026-11-23T07:00:00.000Z', chars: 120, extra: 'x' },
      { id: 'b', title: 'Ключи', tier: 'secret', source: 'company', updatedAt: '2026-11-23T07:00:00.000Z', chars: 5 },
      { id: 'c', title: 'Заметка', tier: 'internal', source: 'owner', updatedAt: 'not a date', chars: -3 },
      { id: 'bad id!', tier: 'public', source: 'site' },
      { id: 'd', tier: 'public', source: 'nowhere' },
    ],
  })
  assert.deepEqual(list.items.map((i) => i.id), ['a', 'c'])
  assert.equal(list.items[1].updatedAt, null)
  assert.equal(list.items[1].chars, 0)
  assert.equal('extra' in list.items[0], false)
  assert.equal(list.builtAt, '2026-11-23T08:00:00.000Z')
  assert.equal(kn.normalizeKnowledge({ ok: true }), null)
  assert.equal(kn.normalizeKnowledgeDoc({ item: { id: 'a', title: 'x', tier: 'secret', source: 'site', text: 't' } }), null)
  assert.equal(kn.normalizeKnowledgeDoc({ item: { id: 'a', title: 'x', tier: 'public', source: 'site', text: 't' } }).text, 't')
})

test('knowledge: query path, drafts, patch with changed fields only, editable only for the owner', () => {
  assert.equal(kn.knowledgePath(kn.emptyKnowledgeFilter), 'knowledge?limit=200')
  assert.equal(kn.knowledgePath({ q: '  цены ', tier: 'public', source: 'owner' }), 'knowledge?q=%D1%86%D0%B5%D0%BD%D1%8B&tier=public&source=owner&limit=200')
  assert.equal(kn.draftProblem({ title: ' ', text: 'x', tier: 'public' }), 'title')
  assert.equal(kn.draftProblem({ title: 'x', text: '', tier: 'public' }), 'text')
  assert.equal(kn.draftProblem({ title: 'x', text: 'y'.repeat(20001), tier: 'public' }), 'long')
  assert.equal(kn.draftProblem({ title: 'x', text: 'y', tier: 'internal' }), null)
  const before = { title: 'A', text: 'B', tier: 'internal' }
  assert.equal(kn.notePatch(before, { ...before }), null)
  assert.deepEqual(kn.notePatch(before, { ...before, tier: 'public' }), { tier: 'public' })
  assert.equal(kn.isEditable({ source: 'owner' }), true)
  assert.equal(kn.isEditable({ source: 'playbook' }), false)
  assert.deepEqual(kn.tierCounts([{ tier: 'public' }, { tier: 'internal' }, { tier: 'public' }]), { public: 2, internal: 1 })
})

test('quality: lessons, eval and rating helpers', () => {
  const lessons = ql.normalizeLessons({ ok: true, items: [{ id: 'l_1', question: 'q', bad: 'b', good: 'g', tag: 't', source: 'rating', at: '2026-11-23T08:00:00.000Z' }, { id: 'l_2', source: 'unknown' }, { source: 'review' }] })
  assert.deepEqual(lessons.map((l) => l.id), ['l_1'])
  assert.equal(ql.normalizeLessons({ ok: true }), null)
  assert.equal(ql.normalizeEval({ ok: true, last: null }).last, null)
  assert.equal(ql.normalizeEval({ ok: true }), null)
  const run = ql.normalizeEval({ ok: true, last: { at: '2026-11-23T08:00:00.000Z', runtime: 'fira', lead: { passed: 18, total: 20 }, red: { passed: 14, total: 15 }, handoffRate: 0.93, toolRate: 88 } }).last
  assert.equal(run.runtime, 'fira')
  assert.equal(ql.percent(run.lead), 90)
  assert.equal(ql.redStatus(run.red), 'red')
  assert.equal(ql.redStatus({ passed: 3, total: 3 }), 'green')
  assert.equal(ql.redStatus({ passed: 0, total: 0 }), 'empty')
  assert.equal(run.handoffRate, 93)
  assert.equal(run.toolRate, 88)
  assert.equal(ql.percent({ passed: 0, total: 0 }), null)
  assert.equal(ql.rateProblem(ql.emptyRate), 'message')
  assert.equal(ql.rateProblem({ messageId: 'm1', thread: 'lead', value: null, note: '' }), 'value')
  assert.deepEqual(ql.rateBody({ messageId: ' m1 ', thread: 'lead', value: -1, note: ' плохо ' }), { messageId: 'm1', thread: 'lead', value: -1, note: 'плохо' })
  assert.deepEqual(ql.rateBody({ messageId: 'm1', thread: 'lead', value: 1, note: ' ' }), { messageId: 'm1', thread: 'lead', value: 1 })
})

const resolve = (method, p, body, search = '') => proxy.resolveEndpoint(method, p.split('/'), new URLSearchParams(search), body)

test('whitelist: knowledge and quality paths, strict bodies, rebuild is never an id', () => {
  assert.equal(resolve('GET', 'knowledge', undefined, 'q=x&tier=public&evil=1').ok, true)
  assert.deepEqual(resolve('GET', 'knowledge', undefined, 'q=x&evil=1').query, { q: 'x' })
  assert.equal(resolve('GET', 'knowledge/ow_1').ok, true)
  assert.equal(resolve('POST', 'knowledge', { title: 'T', text: 'X', tier: 'internal' }).ok, true)
  assert.equal(resolve('POST', 'knowledge', { title: 'T', text: 'X', tier: 'secret' }).ok, false)
  assert.equal(resolve('POST', 'knowledge', { title: 'T', text: 'X', tier: 'public', source: 'site' }).ok, false)
  assert.equal(resolve('POST', 'knowledge', { title: '', text: 'X', tier: 'public' }).ok, false)
  assert.equal(resolve('PATCH', 'knowledge/ow_1', { tier: 'public' }).ok, true)
  assert.equal(resolve('PATCH', 'knowledge/ow_1', {}).ok, false)
  assert.equal(resolve('PATCH', 'knowledge/rebuild', { tier: 'public' }).ok, false)
  assert.equal(resolve('DELETE', 'knowledge/ow_1', {}).ok, true)
  assert.equal(resolve('DELETE', 'knowledge/rebuild', {}).ok, false)
  assert.equal(resolve('DELETE', 'knowledge/ow_1', { x: 1 }).ok, false)
  assert.equal(resolve('POST', 'knowledge/rebuild', {}).ok, true)
  assert.equal(resolve('GET', 'quality/lessons', undefined, 'limit=20').ok, true)
  assert.equal(resolve('DELETE', 'quality/lessons/l_1', {}).ok, true)
  assert.equal(resolve('GET', 'quality/eval').ok, true)
  assert.equal(resolve('POST', 'quality/rate', { messageId: 'm1', thread: 'lead', value: 1 }).ok, true)
  assert.equal(resolve('POST', 'quality/rate', { messageId: 'm1', thread: 'lead', value: 2 }).ok, false)
  assert.equal(resolve('POST', 'quality/rate', { messageId: 'm1', thread: 'lead', value: -1, note: 'n', extra: 1 }).ok, false)
  assert.equal(resolve('DELETE', 'quality/eval', {}).ok, false)
  assert.equal(resolve('DELETE', 'tasks/1', {}).ok, false)
})

test('dev mock: filters, owner notes CRUD, read-only documents, rebuild, lessons, rate, eval', () => {
  const mock = createHqMock(Date.parse('2026-11-23T00:00:00Z'))
  const now = Date.parse('2026-11-23T01:00:00Z')
  const call = (m, p, query = {}, body = {}, at = now) => mock(m, p, query, body, at)
  const all = call('GET', 'knowledge')
  assert.equal(all.ok, true)
  assert.ok(all.items.length >= 8)
  assert.ok(all.items.every((i) => ['public', 'internal'].includes(i.tier)))
  assert.ok(call('GET', 'knowledge', { tier: 'public' }).items.every((i) => i.tier === 'public'))
  assert.ok(call('GET', 'knowledge', { source: 'owner' }).items.every((i) => i.source === 'owner'))
  assert.equal(call('GET', 'knowledge', { q: 'гарантия' }).items.length, 1)
  assert.equal(call('GET', 'knowledge', { tier: 'secret' }).ok, false)
  const created = call('POST', 'knowledge', {}, { title: 'Новая', text: 'Текст', tier: 'public' })
  assert.equal(created.ok, true)
  const id = created.item.id
  assert.equal(call('GET', `knowledge/${id}`).item.text, 'Текст')
  assert.equal(call('PATCH', `knowledge/${id}`, {}, { tier: 'internal', text: 'Иначе' }).ok, true)
  assert.equal(call('GET', `knowledge/${id}`).item.tier, 'internal')
  assert.equal(call('PATCH', 'knowledge/site-pricing', {}, { tier: 'internal' }).error, 'readonly_source')
  assert.equal(call('DELETE', 'knowledge/site-pricing').error, 'readonly_source')
  assert.equal(call('DELETE', `knowledge/${id}`).ok, true)
  assert.equal(call('GET', `knowledge/${id}`).error, 'not_found')
  const before = call('GET', 'knowledge').builtAt
  assert.equal(call('POST', 'knowledge/rebuild').queued, true)
  assert.equal(call('GET', 'knowledge', {}, {}, now + 5000).builtAt, new Date(now + 3000).toISOString())
  assert.notEqual(call('GET', 'knowledge', {}, {}, now + 5000).builtAt, before)

  const lessons = call('GET', 'quality/lessons').items
  assert.ok(lessons.length >= 3)
  assert.equal(call('DELETE', `quality/lessons/${lessons[0].id}`).ok, true)
  assert.equal(call('GET', 'quality/lessons').items.length, lessons.length - 1)
  assert.equal(call('DELETE', 'quality/lessons/nope').error, 'not_found')
  assert.equal(call('POST', 'quality/rate', {}, { messageId: 'm1', thread: 'lead', value: 1 }).lessonId, undefined)
  const rated = call('POST', 'quality/rate', {}, { messageId: 'm2', thread: 'lead', value: -1, note: 'Надо иначе' })
  assert.ok(rated.lessonId)
  assert.equal(call('GET', 'quality/lessons').items[0].source, 'rating')
  const ev = call('GET', 'quality/eval')
  assert.equal(ev.last.runtime, 'fira')
  assert.ok(ev.last.red.passed < ev.last.red.total)
})

test('texts: both sections have copy, no long dashes, no emoji', () => {
  const text = read('src/content/admin.ts')
  assert.match(text, /knowledge: \{/)
  assert.match(text, /quality: \{/)
  const own = ['src/components/admin/hq/knowledge-section.tsx', 'src/components/admin/hq/quality-section.tsx', 'src/lib/knowledge-hq.ts', 'src/lib/quality-hq.ts', 'src/lib/knowledge-mock.ts']
  for (const f of own) assert.doesNotMatch(read(f), /[–—]/, f)
})
