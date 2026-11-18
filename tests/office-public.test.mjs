import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// 'server-only' and '@/...' for plain Node, as in admin.test.mjs.
const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
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

const { officeMock } = await import('../src/lib/office-mock.ts')
const pub = await import('../src/lib/office-public.ts')
const { createPublicOfficeSource, PUBLIC_CACHE_MS } = await import('../src/lib/office-public-hq.ts')
const { buildLayout } = await import('../src/components/pixel-office/layout.ts')
const { officePeople } = await import('../src/components/pixel-office/model.ts')

const NOW = Date.parse('2026-11-19T12:00:00Z')
const ALLOWED = ['ok', 'demo', 'generatedAt', 'tz', 'quietHours', 'director', 'departments', 'counts']

// Every string in a value, deeply.
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out))
  return out
}

test('the public office carries no task titles, activity, costs or routines', () => {
  const full = officeMock(NOW)
  const out = pub.toPublicOffice(full)
  assert.deepEqual(Object.keys(out).sort(), [...ALLOWED].sort())
  const text = JSON.stringify(out)
  const secrets = [
    ...full.departments.flatMap((d) => [d.head, ...d.workers]).flatMap((a) => (a.currentTask ? [a.currentTask.title] : [])),
    ...full.tasks.recent.map((t) => t.title),
    ...full.activity.flatMap((a) => [a.action, a.object]),
    ...full.routines.map((r) => r.name),
  ]
  for (const s of secrets) assert.ok(!text.includes(s), `leaked: ${s}`)
  for (const key of ['currentTask', 'costTodayUsd', 'tasksToday', 'lastActiveAt', 'pendingApprovals', 'openBuilderIssues', 'costs', 'activity', 'funnel']) {
    assert.ok(!text.includes(`"${key}"`), `field ${key} leaked`)
  }
  for (const d of out.departments) {
    assert.deepEqual(Object.keys(d).sort(), ['head', 'id', 'title', 'workers'])
    for (const a of [d.head, ...d.workers]) assert.deepEqual(Object.keys(a).sort(), ['id', 'status', 'title'])
  }
  assert.deepEqual(Object.keys(out.director).sort(), ['id', 'status', 'title'])
})

test('counts come from statuses and department task numbers', () => {
  const out = pub.toPublicOffice(officeMock(NOW))
  const people = [out.director, ...out.departments.flatMap((d) => [d.head, ...d.workers])]
  assert.equal(out.counts.agents, people.length)
  assert.equal(out.counts.working, people.filter((p) => p.status === 'working').length)
  assert.equal(out.counts.waiting, people.filter((p) => p.status === 'waiting').length)
  assert.equal(out.counts.tasksRunning, 4)
  assert.equal(out.counts.doneToday, 4 + 5 + 6 + 0 + 1)
  assert.equal(out.demo, false)
})

test('markup in titles is stripped, unknown statuses become offline, ids are cleaned', () => {
  const full = officeMock(NOW)
  full.departments[0].title = '<img src=x onerror=alert(1)>Marketing'
  full.departments[0].head.status = 'on-fire'
  full.departments[0].head.id = 'Head"<script>'
  const out = pub.toPublicOffice(full)
  assert.equal(out.departments[0].title, 'Marketing')
  assert.equal(out.departments[0].head.status, 'offline')
  assert.equal(out.departments[0].head.id, 'headscript')
  assert.ok(!strings(out).some((s) => /[<>]/.test(s)))
})

test('demo dataset: flagged, deterministic within a cycle, same shape, all known statuses', () => {
  const a = pub.publicDemo(NOW)
  const b = pub.publicDemo(NOW + 500)
  assert.equal(a.demo, true)
  assert.deepEqual(a.departments, b.departments)
  assert.deepEqual(Object.keys(a).sort(), [...ALLOWED].sort())
  assert.ok(pub.looksLikePublicOffice(a))
  const statuses = new Set([a.director, ...a.departments.flatMap((d) => [d.head, ...d.workers])].map((p) => p.status))
  for (const s of statuses) assert.ok(['working', 'waiting', 'blocked', 'idle', 'sleeping', 'paused', 'offline'].includes(s))
  assert.equal(a.counts.agents, 19)
  assert.ok(a.counts.working > 0)
  // The next cycle moves somebody.
  const later = pub.publicDemo(NOW + pub.DEMO_CYCLE_MS)
  assert.notDeepEqual(later.departments, a.departments)
})

test('the reduced shape still drives the pixel scene', () => {
  const scene = pub.publicToScene(pub.publicDemo(NOW))
  assert.equal(officePeople(scene).length, 19)
  assert.ok(officePeople(scene).every((p) => !p.agent.currentTask))
  const layout = buildLayout(scene, 600)
  assert.equal(layout.desks.length, 19)
  assert.ok(layout.width >= 600)
  assert.ok(layout.floors <= buildLayout(scene).floors)
})

function fakeHq(body, { status = 200, fail = false } = {}) {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers ?? {} })
    if (fail) throw new TypeError('fetch failed')
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }
  return { calls, fetcher }
}

test('source: reads HQ with the office token, reduces, caches 15 s', async () => {
  const hq = fakeHq(officeMock(NOW))
  const source = createPublicOfficeSource({ HQ_OFFICE_URL: 'http://hq.test/office', HQ_OFFICE_TOKEN: 'tok' }, hq.fetcher)
  const first = await source.get(NOW)
  assert.equal(first.demo, false)
  assert.equal(hq.calls.length, 1)
  assert.equal(hq.calls[0].url, 'http://hq.test/office')
  assert.equal(hq.calls[0].headers['x-office-token'], 'tok')
  assert.ok(!JSON.stringify(first).includes('tok'))
  await source.get(NOW + PUBLIC_CACHE_MS - 1)
  assert.equal(hq.calls.length, 1, 'served from cache')
  await source.get(NOW + PUBLIC_CACHE_MS)
  assert.equal(hq.calls.length, 2, 'refreshed after 15 s')
})

test('source: concurrent misses share one HQ request', async () => {
  const hq = fakeHq(officeMock(NOW))
  const source = createPublicOfficeSource({ HQ_OFFICE_URL: 'http://hq.test/office' }, hq.fetcher)
  await Promise.all([source.get(NOW), source.get(NOW), source.get(NOW)])
  assert.equal(hq.calls.length, 1)
})

test('source: HQ down or broken gives the demo, and that is cached too', async () => {
  const down = fakeHq(null, { fail: true })
  const source = createPublicOfficeSource({ HQ_OFFICE_URL: 'http://hq.test/office' }, down.fetcher)
  const out = await source.get(NOW)
  assert.equal(out.demo, true)
  await source.get(NOW + 1000)
  assert.equal(down.calls.length, 1)

  const bad = fakeHq({ ok: true, nope: 1 })
  assert.equal((await createPublicOfficeSource({ HQ_OFFICE_URL: 'http://hq.test/office' }, bad.fetcher).get(NOW)).demo, true)
  const denied = fakeHq({}, { status: 401 })
  assert.equal((await createPublicOfficeSource({ HQ_OFFICE_URL: 'http://hq.test/office' }, denied.fetcher).get(NOW)).demo, true)
})

test('source: no HQ_OFFICE_URL in development means demo without any request', async () => {
  const hq = fakeHq(officeMock(NOW))
  const out = await createPublicOfficeSource({ NODE_ENV: 'development' }, hq.fetcher).get(NOW)
  assert.equal(out.demo, true)
  assert.equal(hq.calls.length, 0)
  // Production tries the loopback default, like the admin proxy.
  const prod = fakeHq(officeMock(NOW))
  await createPublicOfficeSource({ NODE_ENV: 'production' }, prod.fetcher).get(NOW)
  assert.equal(prod.calls[0].url, 'http://127.0.0.1:8787/office')
})

test('the public route answers the reduced shape', async () => {
  const route = await import('../src/app/api/office/public/route.ts')
  const res = await route.GET()
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(pub.looksLikePublicOffice(body))
  assert.deepEqual(Object.keys(body).sort(), [...ALLOWED].sort())
})
