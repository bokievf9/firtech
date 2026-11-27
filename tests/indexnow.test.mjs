// IndexNow key route, script batching/payload and verification metadata (SEO 2026-11-27).
import assert from 'node:assert/strict'
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

const KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
const { GET } = await import('../src/app/api/indexnow-key/route.ts')
const { keyFromPath, verificationFromEnv } = await import('../src/lib/indexnow.ts')
const { proxy } = await import('../src/proxy.ts')
const { NextRequest } = await import('next/server.js')
const script = await import('../scripts/ops/indexnow.mjs')

const ask = (k) => GET(new Request(`https://firtech.pro/api/indexnow-key?k=${k}`))

test('key route answers the key only for the env key', async () => {
  const old = process.env.INDEXNOW_KEY
  try {
    process.env.INDEXNOW_KEY = KEY
    const ok = await ask(KEY)
    assert.equal(ok.status, 200)
    assert.match(ok.headers.get('content-type'), /^text\/plain/)
    assert.equal(await ok.text(), KEY)
    assert.equal((await ask('0'.repeat(32))).status, 404)
    assert.equal((await ask('')).status, 404)
    process.env.INDEXNOW_KEY = 'short'
    assert.equal((await ask('short')).status, 404)
    delete process.env.INDEXNOW_KEY
    assert.equal((await ask(KEY)).status, 404)
  } finally {
    if (old === undefined) delete process.env.INDEXNOW_KEY
    else process.env.INDEXNOW_KEY = old
  }
})

test('proxy rewrites /<key>.txt to the key route', async () => {
  assert.equal(keyFromPath(`/${KEY}.txt`), KEY)
  assert.equal(keyFromPath('/robots.txt'), null)
  assert.equal(keyFromPath(`/x/${KEY}.txt`), null)
  const res = await proxy(new NextRequest(`https://firtech.pro/${KEY}.txt`))
  assert.match(res.headers.get('x-middleware-rewrite') ?? '', /\/api\/indexnow-key\?k=a1b2/)
})

const sitemap = (n) =>
  '<urlset>' +
  Array.from({ length: n }, (_, i) => `<url><loc>https://firtech.pro/ru/p${i}</loc><lastmod>2026-11-${i % 2 ? '20' : '26'}T00:00:00.000Z</lastmod></url>`).join('') +
  '</urlset>'

test('parse, filter and batch', () => {
  const entries = script.parseSitemap(sitemap(4))
  assert.equal(entries.length, 4)
  assert.equal(script.filterChanged(entries, '2026-11-25T00:00:00Z').length, 2)
  assert.equal(script.filterChanged(entries).length, 4)
  assert.deepEqual(script.batches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assert.equal(script.batches(Array(25000)).map((b) => b.length).join(), '10000,10000,5000')
})

function mockFetch(n, status = 200) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    if (url === script.SITEMAP) return new Response(sitemap(n), { status: 200 })
    return new Response('', { status })
  }
  return { fn, calls }
}

test('run posts the IndexNow payload in batches', async () => {
  const { fn, calls } = mockFetch(10001)
  const code = await script.run({ key: KEY, fetchImpl: fn, log: () => {} })
  assert.equal(code, 0)
  const posts = calls.filter((c) => c.url === script.ENDPOINT)
  assert.equal(posts.length, 2)
  const body = JSON.parse(posts[0].init.body)
  assert.deepEqual(Object.keys(body).sort(), ['host', 'key', 'keyLocation', 'urlList'])
  assert.equal(body.host, 'firtech.pro')
  assert.equal(body.keyLocation, `https://firtech.pro/${KEY}.txt`)
  assert.equal(body.urlList.length, 10000)
  assert.equal(JSON.parse(posts[1].init.body).urlList.length, 1)
})

test('run: 202 ok, 403 fails, missing key is a no-op', async () => {
  assert.equal(await script.run({ key: KEY, fetchImpl: mockFetch(2, 202).fn, log: () => {} }), 0)
  assert.equal(await script.run({ key: KEY, fetchImpl: mockFetch(2, 403).fn, log: () => {} }), 1)
  const m = mockFetch(2)
  assert.equal(await script.run({ key: undefined, fetchImpl: m.fn, log: () => {} }), 0)
  assert.equal(m.calls.length, 0)
  const only = mockFetch(4)
  await script.run({ key: KEY, changedSince: '2026-11-25T00:00:00Z', fetchImpl: only.fn, log: () => {} })
  assert.equal(JSON.parse(only.calls[1].init.body).urlList.length, 2)
})

test('verification metadata renders only when set', () => {
  assert.equal(verificationFromEnv({}), undefined)
  assert.equal(verificationFromEnv({ NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: '  ' }), undefined)
  assert.deepEqual(verificationFromEnv({ NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: 'g1' }), { google: 'g1' })
  assert.deepEqual(
    verificationFromEnv({ NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: 'g1', NEXT_PUBLIC_YANDEX_VERIFICATION: 'y2' }),
    { google: 'g1', yandex: 'y2' },
  )
})
