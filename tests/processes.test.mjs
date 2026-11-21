import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// '@/...' for plain Node (same mapping as hq-admin.test.mjs).
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

// HQ «Processes» (2026-11-23): view model, whitelist, dev mock, texts.
const p = await import('../src/lib/processes.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

const body = {
  ok: true,
  generatedAt: '2026-11-23T10:00:00.000Z',
  windowDays: 7,
  chains: [
    {
      id: 'client',
      title: 'Заявка',
      steps: [
        { id: 'lead', title: 'Заявка принята', hint: 'h', health: 'ok', lastOkAt: '2026-11-23T09:00:00.000Z', failures7d: 0, stuck: 0, lastFailure: null },
        { id: 'sign', title: 'Подпись', hint: '', health: 'fail', lastOkAt: null, failures7d: 2, stuck: 1, lastFailure: { at: '2026-11-23T08:00:00.000Z', text: 'PDF не собран' } },
        { id: 'x', title: 'Мусор', health: 'exploded', lastOkAt: 'not a date', failures7d: -5, stuck: 'many', evil: '<script>' },
        { title: 'без id' },
      ],
    },
    { id: 'idle', title: 'Пусто', steps: [{ id: 'a', title: 'A', health: 'idle' }] },
    { title: 'без id', steps: [] },
  ],
  drill: { state: 'running', startedAt: '2026-11-23T09:59:00.000Z', elapsedMs: 60000, openApprovals: 2, counts: { ok: 1, wait: 0, fail: 1, run: 2 }, rows: [{ worker: 'w', title: 'T', state: 'weird', ms: 5, text: 'x' }] },
}

test('normalizeProcesses: shape, defaults, unknown values dropped, chain health = the worst step', () => {
  const v = p.normalizeProcesses(body)
  assert.deepEqual(v.chains.map((c) => c.id), ['client', 'idle'])
  const client = v.chains[0]
  assert.deepEqual(client.steps.map((s) => s.id), ['lead', 'sign', 'x'])
  assert.equal(client.health, 'fail')
  assert.equal(v.chains[1].health, 'idle')
  const x = client.steps[2]
  assert.equal(x.health, 'idle')
  assert.equal(x.lastOkAt, null)
  assert.equal(x.failures7d, 0)
  assert.equal(x.stuck, 0)
  assert.equal('evil' in x, false)
  assert.deepEqual(client.steps[1].lastFailure, { at: '2026-11-23T08:00:00.000Z', text: 'PDF не собран' })
  assert.deepEqual(v.counts, { ok: 1, warn: 0, fail: 1, idle: 2 })
  assert.equal(v.drill.rows[0].state, 'run')
  assert.equal(p.drillBusy(v.drill), true)
  assert.equal(p.normalizeProcesses(null), null)
  assert.equal(p.normalizeProcesses({ ok: true }), null)
  assert.equal(p.normalizeProcesses({ chains: [] }).drill, null)
})

test('sinceText', () => {
  const now = Date.parse('2026-11-23T12:00:00Z')
  assert.equal(p.sinceText(null, now), 'ещё не было')
  assert.equal(p.sinceText('2026-11-23T11:59:30Z', now), 'только что')
  assert.equal(p.sinceText('2026-11-23T11:30:00Z', now), '30 мин назад')
  assert.equal(p.sinceText('2026-11-23T09:00:00Z', now), '3 ч назад')
  assert.equal(p.sinceText('2026-11-22T09:00:00Z', now), 'вчера')
  assert.equal(p.sinceText('2026-11-18T09:00:00Z', now), '5 дн. назад')
})

test('whitelist: GET processes and POST processes/drill with start|clear only', () => {
  const r = (m, seg, b) => proxy.resolveEndpoint(m, seg, new URLSearchParams(), b)
  assert.equal(r('GET', ['processes']).ok, true)
  assert.equal(r('POST', ['processes', 'drill'], { action: 'start' }).ok, true)
  assert.equal(r('POST', ['processes', 'drill'], { action: 'clear' }).ok, true)
  assert.equal(r('POST', ['processes', 'drill'], { action: 'report' }).ok, false)
  assert.equal(r('POST', ['processes', 'drill'], { action: 'start', x: 1 }).ok, false)
  assert.equal(r('POST', ['processes', 'drill'], {}).ok, false)
  assert.equal(r('POST', ['processes'], {}).ok, false)
  assert.equal(r('GET', ['processes', 'drill']).ok, false)
})

test('dev mock: the map, start, a second start does nothing, the drill ends by itself, clear', () => {
  const T0 = Date.parse('2026-11-23T10:00:00Z')
  const mock = createHqMock(T0)
  const get = (now) => p.normalizeProcesses(mock('GET', 'processes', {}, {}, now))
  const first = get(T0)
  assert.ok(first, 'the mock answers in the contract shape')
  assert.deepEqual(first.chains.map((c) => c.id), ['client', 'support', 'content', 'letters', 'infra'])
  assert.equal(first.drill.state, 'none')
  assert.equal(mock('POST', 'processes/drill', {}, { action: 'start' }, T0).ok, true)
  assert.equal(get(T0 + 1000).drill.state, 'running')
  const rows = get(T0 + 1000).drill.rows.length
  mock('POST', 'processes/drill', {}, { action: 'start' }, T0 + 2000)
  assert.equal(get(T0 + 3000).drill.rows.length, rows)
  assert.equal(get(T0 + 30_000).drill.state, 'done')
  assert.equal(mock('POST', 'processes/drill', {}, { action: 'clear' }, T0 + 31_000).ok, true)
  assert.equal(get(T0 + 32_000).drill.state, 'none')
  assert.equal(mock('POST', 'processes/drill', {}, { action: 'x' }, T0).ok, false)
})

test('texts: no «Пульт», no long dashes, no empty catch in the new files', () => {
  for (const f of ['src/components/admin/hq/processes-view.tsx', 'src/lib/processes.ts', 'src/app/admin/(hq)/processes/page.tsx']) {
    const t = read(f)
    assert.doesNotMatch(t, /catch\s*(\([^)]*\))?\s*\{\s*\}/, f)
    assert.doesNotMatch(t, /[–—]/, f)
  }
  const texts = JSON.stringify(Object.values(read('src/content/admin.ts').match(/processes: \{[\s\S]*?\n    \},/)[0]))
  assert.doesNotMatch(texts, /[Пп]ульт|[–—]/)
})
