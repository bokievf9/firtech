// Content Studio (HQ section «Content», 2026-11-23): the proxy whitelist, the view models, the dev mock and the section wiring.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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

const cs = await import('../src/lib/content-studio.ts')
const shell = await import('../src/lib/hq-shell.ts')
const { resolveEndpoint } = await import('../src/lib/hq-admin.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const q = (o = {}) => new URLSearchParams(o)
const NOW = Date.parse('2026-11-23T10:00:00Z')

test('the proxy lets the feed, the orders list and the three order bodies through, and nothing else', () => {
  assert.equal(resolveEndpoint('GET', ['content', 'feed'], q({ status: 'pending', kind: 'clip', limit: '30', cursor: '30', x: '1' }), undefined).ok, true)
  const feed = resolveEndpoint('GET', ['content', 'feed'], q({ status: 'pending', x: '1' }), undefined)
  assert.deepEqual(feed.query, { status: 'pending' })
  assert.equal(resolveEndpoint('GET', ['content', 'orders'], q({ limit: '30' }), undefined).ok, true)
  for (const body of [
    { mode: 'prompt', prompt: 'Про ночные заявки', type: 'post' },
    { mode: 'variant', fromItemId: 5 },
    { mode: 'niche', fromItemId: 5, niche: 'барбершоп', note: 'без цен' },
  ]) assert.equal(resolveEndpoint('POST', ['content', 'orders'], q(), body).ok, true, JSON.stringify(body))
  for (const body of [{ mode: 'prompt', prompt: 'a' }, { mode: 'variant' }, { mode: 'variant', fromItemId: 'a12' }, { mode: 'niche', fromItemId: 5 }, { mode: 'prompt', prompt: 'ok ok', extra: 1 }, { mode: 'x' }]) {
    assert.equal(resolveEndpoint('POST', ['content', 'orders'], q(), body).ok, false, JSON.stringify(body))
  }
  assert.equal(resolveEndpoint('DELETE', ['content', 'orders'], q(), undefined).ok, false)
  assert.equal(resolveEndpoint('GET', ['content', 'feed', 'x'], q(), undefined).ok, false)
})

test('orderBody trims, caps and refuses input HQ would refuse', () => {
  assert.deepEqual(cs.orderBody({ mode: 'prompt', prompt: '  Про ночные заявки ', type: 'post' }), { mode: 'prompt', prompt: 'Про ночные заявки', type: 'post' })
  assert.equal(cs.orderBody({ mode: 'prompt', prompt: ' a ', type: 'clip' }), null)
  assert.equal(cs.orderBody({ mode: 'variant', fromItemId: 0 }), null)
  assert.deepEqual(cs.orderBody({ mode: 'variant', fromItemId: 4, note: ' ' }), { mode: 'variant', fromItemId: 4 })
  assert.deepEqual(cs.orderBody({ mode: 'niche', fromItemId: 4, niche: ' кафе ', note: 'коротко' }), { mode: 'niche', fromItemId: 4, niche: 'кафе', note: 'коротко' })
  assert.equal(cs.orderBody({ mode: 'niche', fromItemId: 4, niche: ' ' }), null)
})

test('normalizers keep known fields only and drop broken rows', () => {
  const row = { id: 41, kind: 'clip', status: 'pending', title: 'T', files: [{ path: '41/reel.mp4', type: 'mp4', w: 1080, h: 1920 }, { path: '../x.png', type: 'png' }], reviewId: 'ap_9', origin: { orderId: 7, mode: 'niche', fromItemId: 3 } }
  const feed = cs.normalizeFeed({ ok: true, items: [row, { kind: 'post' }, { ...row, id: 42, reviewId: 'x', origin: { mode: 'bad' } }], nextCursor: '30', total: 80 })
  assert.equal(feed.items.length, 2)
  assert.equal(feed.items[0].files.length, 1)
  assert.deepEqual(feed.items[0].origin, { orderId: 7, mode: 'niche', fromItemId: 3 })
  assert.equal(feed.items[0].reviewId, 'ap_9')
  assert.equal(feed.items[1].reviewId, null)
  assert.equal(feed.items[1].origin, null)
  assert.equal(feed.nextCursor, '30')
  assert.equal(cs.normalizeFeed({ ok: true }), null)
  assert.equal(cs.normalizeFeed({ ok: true, items: [], nextCursor: 'x' }).nextCursor, null)
  const orders = cs.normalizeOrders({ items: [{ id: 1, mode: 'prompt', state: 'working', prompt: 'p' }, { id: 2, mode: 'zzz', state: 'working' }, { id: 3, mode: 'variant', state: 'delivered', itemId: 5, reviewId: 'ap_2', itemStatus: 'pending', fromItemId: 4 }] })
  assert.deepEqual(orders.map((o) => o.id), [1, 3])
  assert.equal(orders[1].itemStatus, 'pending')
  assert.equal(cs.normalizeOrders({}), null)
})

test('only reels, posts, carousels and stories can be reordered', () => {
  assert.equal(cs.canReorder({ kind: 'clip', id: 5 }), true)
  assert.equal(cs.canReorder({ kind: 'article', id: 'a5' }), false)
  assert.equal(cs.canReorder({ kind: 'profile', id: 5 }), false)
  assert.equal(cs.canReorder({ kind: 'post', id: 'a5' }), false)
  assert.equal(cs.feedHref('pending', 'clip', '30'), 'content/feed?limit=30&status=pending&kind=clip&cursor=30')
})

test('the dev mock: feed with filters and cursor, a prompt order is delivered on the next read and linked back', () => {
  const mock = createHqMock(NOW)
  const all = mock('GET', 'content/feed', { limit: '5' }, {}, NOW)
  assert.equal(all.ok, true)
  assert.equal(all.items.length, 5)
  assert.ok(all.items.every((i) => /^ap_\d+$/.test(i.reviewId)))
  assert.ok(all.total > 5)
  assert.equal(all.nextCursor, '5')
  const clips = mock('GET', 'content/feed', { kind: 'clip', limit: '200' }, {}, NOW)
  assert.ok(clips.items.length > 0 && clips.items.every((i) => i.kind === 'clip'))
  assert.ok(cs.normalizeFeed(all))
  assert.equal(mock('POST', 'content/orders', {}, { mode: 'prompt', prompt: 'a' }, NOW).error, 'invalid')
  const made = mock('POST', 'content/orders', {}, { mode: 'prompt', prompt: 'Про ночные заявки', type: 'post' }, NOW)
  assert.equal(made.ok, true)
  assert.equal(made.order.state, 'working')
  const variant = mock('POST', 'content/orders', {}, { mode: 'variant', fromItemId: clips.items[0].id }, NOW)
  assert.equal(variant.ok, true)
  const list = cs.normalizeOrders(mock('GET', 'content/orders', {}, {}, NOW))
  assert.deepEqual(list.map((o) => [o.mode, o.state]), [['variant', 'delivered'], ['prompt', 'delivered']])
  assert.equal(list[1].type, 'post')
  assert.equal(list[0].fromItemId, clips.items[0].id)
  const feed = cs.normalizeFeed(mock('GET', 'content/feed', { limit: '200' }, {}, NOW))
  const born = feed.items.find((i) => i.id === String(list[1].itemId))
  assert.equal(born.status, 'pending')
  assert.equal(born.origin.mode, 'prompt')
  assert.equal(born.reviewId, list[1].reviewId)
})

test('Content is a built HQ section with the three tabs and a page; no empty catch, no long dashes', () => {
  assert.equal(shell.sectionById('content').state, 'ready')
  assert.deepEqual(shell.HQ_TABS.content, ['feed', 'calendar', 'orders'])
  assert.equal(shell.sectionTab('content', 'orders'), 'orders')
  assert.equal(shell.sectionTab('content', 'x'), 'feed')
  assert.equal(shell.isSoonSection('content'), false)
  assert.ok(existsSync(new URL('../src/app/admin/(hq)/content/page.tsx', import.meta.url)))
  for (const f of ['src/components/admin/hq/content-studio.tsx', 'src/lib/content-studio.ts']) {
    const t = read(f)
    assert.doesNotMatch(t, /catch\s*(\([^)]*\))?\s*\{\s*\}/, f)
    assert.doesNotMatch(t, /[–—]/, f)
  }
})
