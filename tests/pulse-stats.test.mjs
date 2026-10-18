import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export{}', shortCircuit: true }
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

const { parseMetrika, metrikaConfigured } = await import('../src/lib/metrika.ts')
const { parseVibely, vibelyStats, vibelyConfigured } = await import('../src/lib/vibely-metrics.ts')

const env = { ...process.env }
afterEach(() => {
  process.env = { ...env }
})

test('Metrika answer becomes totals, sorted days and top sources', () => {
  const daily = {
    totals: [30, 20, 90],
    data: [
      { dimensions: [{ name: '2026-10-19' }], metrics: [10, 8, 30] },
      { dimensions: [{ name: '2026-10-18' }], metrics: [20, 12, 60] },
      { dimensions: [{ name: 'junk' }], metrics: [5] },
    ],
  }
  const sources = {
    data: [
      { dimensions: [{ name: 'Прямые заходы' }], metrics: [14] },
      { dimensions: [{ name: 'Нет\nвизитов' }], metrics: [0] },
      { dimensions: [{ name: 'Поисковые системы\nYandex' }], metrics: [9] },
    ],
  }
  const out = parseMetrika(daily, sources)
  assert.deepEqual([out.visits7d, out.users7d, out.pageviews7d], [30, 20, 90])
  assert.deepEqual(out.days, [
    { date: '2026-10-18', visits: 20 },
    { date: '2026-10-19', visits: 10 },
  ])
  assert.deepEqual(out.sources, [
    { name: 'Прямые заходы', visits: 14 },
    { name: 'Поисковые системы Yandex', visits: 9 },
  ])
})

test('Metrika parser survives garbage', () => {
  const out = parseMetrika(null, 'x')
  assert.equal(out.visits7d, 0)
  assert.deepEqual(out.days, [])
  assert.deepEqual(out.sources, [])
})

test('Metrika needs a token', () => {
  delete process.env.METRIKA_TOKEN
  assert.equal(metrikaConfigured(), false)
  process.env.METRIKA_TOKEN = 'x'
  assert.equal(metrikaConfigured(), true)
  process.env.METRIKA_COUNTER_ID = 'abc'
  assert.equal(metrikaConfigured(), false)
})

test('Vibely parser keeps only the contract and drops personal fields', () => {
  const out = parseVibely({
    generatedAt: '2026-10-19T05:00:00Z',
    users: { total: 12, signups30d: 5, dau: 3, wau: 7, email: 'a@b.c', ids: [1, 2] },
    activity: {
      matches7d: 4,
      messagesByDay: [
        { date: '2026-10-19', count: 9, userId: 'u1' },
        { date: 'bad', count: 1 },
        { date: '2026-10-18', count: -3 },
      ],
      callsByDay: 'nope',
    },
    moderation: { selfiePending: 2, selfieLongestWaitHours: 30, openReports: 1 },
    money: { payments30d: 2, activeSubscriptions: 1, card: '4111' },
    pushOptInShare: 4,
    phone: '+992',
  })
  assert.equal(out.users.total, 12)
  assert.deepEqual(out.activity.messagesByDay, [
    { date: '2026-10-18', count: 0 },
    { date: '2026-10-19', count: 9 },
  ])
  assert.deepEqual(out.activity.callsByDay, [])
  assert.equal(out.pushOptInShare, 1)
  const text = JSON.stringify(out)
  for (const leak of ['a@b.c', 'u1', '4111', '+992']) assert.ok(!text.includes(leak))
  assert.equal(parseVibely(null), null)
  assert.equal(parseVibely('x'), null)
})

test('Vibely secret never goes to a remote host', async () => {
  process.env.VIBELY_METRICS_SECRET = 's'
  assert.equal(vibelyConfigured(), true)
  for (const url of [
    'http://evil.example/api',
    'https://127.0.0.1/x',
    'http://127.0.0.1.evil.example/x',
  ]) {
    process.env.VIBELY_METRICS_URL = url
    await assert.rejects(vibelyStats(), /localhost/)
  }
})
