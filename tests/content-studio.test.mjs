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
const reviewMock = await import('../src/lib/review-mock.ts')
const reviewLib = await import('../src/lib/review.ts')
const shellLib = await import('../src/lib/shell.ts')
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
  assert.deepEqual(shell.HQ_TABS.content, ['feed', 'orders', 'campaigns', 'rules', 'marketing'])
  assert.equal(shell.sectionTab('content', 'orders'), 'orders')
  assert.equal(shell.sectionTab('content', 'x'), 'feed')
  assert.ok(existsSync(new URL('../src/app/admin/(hq)/content/page.tsx', import.meta.url)))
  for (const f of ['src/components/admin/hq/content-studio.tsx', 'src/components/admin/hq/studio-screen.tsx', 'src/lib/content-studio.ts']) {
    const t = read(f)
    assert.doesNotMatch(t, /catch\s*(\([^)]*\))?\s*\{\s*\}/, f)
    assert.doesNotMatch(t, /[–—]/, f)
  }
})

// ---- the one-screen view (2026-11-23, redo): the preview comes from media[] or the files, never a fake render ----
const row = (over = {}) => ({ id: '41', kind: 'clip', platform: 'instagram', status: 'pending', title: 'T', hook: '', caption: {}, files: [], sourceSlug: null, approvalId: null, publishedUrl: null, error: null, kit: null, reviewId: 'ap_9', ...over })
const card = (over = {}) => ({ id: 'ap_9', kind: 'content_item', status: 'pending', actions: [], media: [], meta: {}, ...over })
const PENDING = ['approve', 'edit', 'revise', 'reject', 'publish_now', 'reschedule']

test('studioPreview: HQ media[] wins, files of the feed row are the fallback, nothing is an honest pending state', () => {
  const video = { type: 'video', src: '/api/admin/files/41/reel.mp4', poster: null, w: 1080, h: 1920, durationS: 28 }
  const png = (n) => ({ type: 'image', src: `/api/admin/files/42/s${n}.png`, poster: null, w: 1080, h: 1350, durationS: null })
  const v = cs.studioPreview(row(), card({ media: [video], meta: { render: { state: 'ready' } } }))
  assert.equal(v.mode, 'video')
  assert.equal(v.ratio, 9 / 16)
  assert.equal(v.state, 'ready')
  const car = cs.studioPreview(row({ kind: 'carousel' }), card({ media: [png(1), png(2), png(3)] }))
  assert.equal(car.mode, 'carousel')
  assert.equal(car.media.length, 3)
  assert.equal(cs.studioPreview(row({ kind: 'post' }), card({ media: [png(1)] })).mode, 'image')
  assert.equal(cs.studioPreview(row(), card({ media: [{ type: 'pdf', src: '/api/admin/files/x.pdf', poster: null, w: null, h: null, durationS: null }] })).mode, 'pdf')
  const f = cs.studioPreview(row({ files: [{ path: 'c/clip.mp4', type: 'mp4', w: 1080, h: 1920 }, { path: 'c/cover.png', type: 'png', w: 1080, h: 1350 }] }), null)
  assert.equal(f.mode, 'video')
  assert.equal(f.media[0].poster, '/api/admin/files/c/cover.png')
  // no files at all: an honest «render pending» with the real state and a reason, even for an old material without a card
  const waiting = cs.studioPreview(row({ status: 'pending' }), card({ meta: { render: { state: 'none' } } }))
  assert.deepEqual([waiting.mode, waiting.state], ['pending', 'none'])
  assert.match(cs.pendingReason(row({ status: 'pending' }), waiting.state), /after approval/)
  const old = cs.studioPreview(row({ status: 'published', reviewId: null }), null)
  assert.deepEqual([old.mode, old.state], ['pending', 'none'])
  assert.match(cs.pendingReason(row({ status: 'published' }), 'none'), /No render is stored/)
  assert.equal(cs.studioPreview(row({ status: 'rendering' }), null).state, 'rendering')
  assert.equal(cs.studioPreview(row({ status: 'draft', error: 'no frames' }), null).state, 'failed')
  assert.equal(cs.studioPreview(row(), card({ meta: { render: { state: 'ready' } } })).state, 'none')
})

test('studioAccess: buttons come from the approval card (status and actions[]), never from the feed row', () => {
  // waiting card: edit, approve, revise, reject
  const open = cs.studioAccess(row(), card({ actions: PENDING }))
  assert.deepEqual([open.edit, open.approve, open.revise, open.reject], [true, true, true, true])
  assert.equal(open.readOnly, null)
  // the same feed row says «pending», but the card was decided: HQ would answer 409 not_pending to edit, so nothing is offered
  for (const status of ['approved', 'rejected', 'published', 'failed']) {
    const a = cs.studioAccess(row({ status: 'pending' }), card({ status, actions: [] }))
    assert.deepEqual([a.edit, a.approve, a.revise, a.reject], [false, false, false, false], status)
    assert.match(a.readOnly, /Decided/, status)
  }
  // an approved card that still lists edit (a document HQ lets the owner re-version) keeps its edit
  assert.equal(cs.studioAccess(row(), card({ status: 'approved', actions: ['edit'] })).edit, true)
  // an older material without a card (reviewId null, or the card was not found): view only, with the reason
  const old = cs.studioAccess(row({ reviewId: null, status: 'published' }), null)
  assert.deepEqual([old.edit, old.approve, old.revise, old.reject, old.rerender, old.markPublished], [false, false, false, false, false, false])
  assert.match(old.readOnly, /older material/)
  assert.match(cs.studioAccess(row({ reviewId: null, status: 'pending' }), null).readOnly, /Decide it in Approvals/)
  assert.match(cs.studioAccess(row(), null).readOnly, /could not be found/)
  // while the card loads nothing is promised and nothing is said yet
  const loading = cs.studioAccess(row(), null, true)
  assert.deepEqual([loading.edit, loading.approve, loading.readOnly], [false, false, null])
  // orders create new materials: allowed for a decided one; articles and the start kit have none
  assert.equal(cs.studioAccess(row({ status: 'published' }), card({ status: 'published' })).reorder, true)
  assert.equal(cs.studioAccess(row({ id: 'a3', kind: 'article' }), null).reorder, false)
  assert.equal(cs.studioAccess(row({ kind: 'profile' }), null).reorder, false)
  // re-render and «mark published» follow the item's own status and need a card
  assert.equal(cs.studioAccess(row({ status: 'ready' }), card({ status: 'approved' })).rerender, true)
  assert.equal(cs.studioAccess(row({ status: 'approved' }), card({ status: 'approved' })).markPublished, true)
  assert.equal(cs.studioAccess(row({ status: 'pending' }), card()).rerender, false)
  assert.equal(cs.studioAccess(row({ status: 'rejected' }), card({ status: 'rejected' })).rerender, false)
  assert.equal(cs.studioAccess(row({ status: 'ready', reviewId: null }), null).rerender, false)
})

test('errors name the request and carry HQ code: «Save text failed (409 not_pending, item approved)»', () => {
  assert.equal(cs.requestError('Save text', { error: 'not_pending', http: 409, status: 'approved' }), 'Save text failed (409 not_pending, item approved)')
  assert.equal(cs.requestError('Re-render', { error: 'cannot_rerender', http: 409, reason: 'Материал ещё не одобрен' }), 'Re-render failed (409 cannot_rerender: Материал ещё не одобрен)')
  assert.equal(cs.requestError('Load feed', { error: 'hq_unreachable' }), 'Load feed failed (hq_unreachable)')
  assert.doesNotMatch(cs.requestError('Order', { error: 'not_pending', http: 409 }), /Something went wrong|E-NOTPENDI/)
})

test('regression: opening ANY material of the mock replays no write, and the decided ones would be refused by HQ if the screen tried', () => {
  const { createReviewMock } = reviewMock
  const handle = createReviewMock(NOW)
  const mockHq = createHqMock(NOW)
  const feed = cs.normalizeFeed(mockHq('GET', 'content/feed', { limit: '200' }, {}, NOW)).items
  assert.ok(feed.length > 10)
  let decided = 0
  let withoutCard = 0
  for (const item of feed) {
    // what the screen reads on open: ONE GET of the card (cursor = n + 1, limit 1). A POST is never sent by opening.
    const m = item.reviewId ? /^ap_(\d+)$/.exec(item.reviewId) : null
    const body = m ? handle('GET', ['review'], { status: 'all', limit: '1', cursor: String(Number(m[1]) + 1) }, {}, NOW) : null
    const review = body ? (reviewLib.normalizeReview(body)?.items.find((i) => i.id === item.reviewId) ?? null) : null
    const access = cs.studioAccess(item, review)
    if (!review) withoutCard++
    else if (review.status !== 'pending') decided++
    if (!review || review.status !== 'pending') {
      // the screen offers no write that the contract refuses: no edit, no decision
      assert.deepEqual([access.edit, access.approve, access.revise, access.reject], [false, false, false, false], `${item.id} ${item.status}`)
    }
    if (review && review.status !== 'pending') {
      // and the mock (like HQ) really answers 409 not_pending to an edit, i.e. the guard is what prevents the old failure
      const res = handle('POST', ['review', review.id], {}, { action: 'edit', text: { caption: 'x' } }, NOW)
      assert.equal(res.ok, false, review.id)
      assert.ok(['not_pending', 'not_applicable'].includes(res.error), `${review.id}: ${res.error}`)
    }
  }
  assert.ok(decided >= 2, `decided materials with a card in the mock: ${decided}`)
  assert.ok(withoutCard >= 2, `older materials without a card in the mock: ${withoutCard}`)
})

test('the review mock pages like HQ: limit 1 + cursor n + 1 reads card n alone', () => {
  const handle = reviewMock.createReviewMock(NOW)
  const one = handle('GET', ['review'], { status: 'all', limit: '1', cursor: '200' }, {}, NOW)
  assert.deepEqual(one.items.map((i) => i.id), ['ap_199'])
})

test('PDF previews: the render path and the proxy know .pdf, and the screen has an inline viewer', async () => {
  assert.equal(shellLib.renderType('docs/brief.pdf'), 'application/pdf')
  assert.equal(shellLib.safeRenderPath('docs/brief.pdf'), 'docs/brief.pdf')
  const media = reviewLib.normalizeMedia([{ type: 'pdf', url: '/admin/files/docs/brief.pdf' }])
  assert.deepEqual(media.map((m) => [m.type, m.src]), [['pdf', '/api/admin/files/docs/brief.pdf']])
  const f = await import('../src/lib/hq-files.ts')
  const res = await f.proxyRenderFile(['docs', 'brief.pdf'], null, { env: { NODE_ENV: 'development' } })
  assert.equal(res.headers.get('content-type'), 'application/pdf')
  assert.match(await res.text(), /^%PDF-/)
  assert.match(read('src/components/admin/hq/studio-screen.tsx'), /<iframe src=\{m!\.src\}/)
  assert.match(read('next.config.ts'), /api\/admin\/files\/:path\*[\s\S]{0,120}SAMEORIGIN/)
})

test('the dev file proxy has no «demo render» left: a labelled sample slide and a playable sample clip', async () => {
  const f = await import('../src/lib/hq-files.ts')
  assert.doesNotMatch(f.placeholderSvg('a/b.png'), /demo render/)
  const res = await f.proxyRenderFile(['c', 'clip.mp4'], null, { env: { NODE_ENV: 'development' } })
  assert.equal(res.headers.get('content-type'), 'video/mp4')
  assert.ok((await res.arrayBuffer()).byteLength > 1000)
})

test('the proxy carries HQ HTTP status next to the code, so a failure can be named exactly', async () => {
  const { callHqAdmin } = await import('../src/lib/hq-admin.ts')
  const fetcher = async () => new Response(JSON.stringify({ ok: false, error: 'not_pending', status: 'approved' }), { status: 409, headers: { 'content-type': 'application/json' } })
  const res = await callHqAdmin('POST', 'review/ap_3', { body: { action: 'edit' } }, { env: { HQ_ADMIN_URL: 'http://hq.test/admin', HQ_ADMIN_TOKEN: 't' }, fetcher })
  assert.deepEqual(res, { status: 'approved', ok: false, http: 409, error: 'not_pending' })
})

test('the Content screen has no drawer: player, text, Prompt, Another variant and For a niche live in one component, writes only from buttons', () => {
  const screen = read('src/components/admin/hq/studio-screen.tsx')
  const section = read('src/components/admin/hq/content-studio.tsx')
  assert.doesNotMatch(section, /CrmDrawer|PromptDrawer/)
  assert.doesNotMatch(screen, /CrmDrawer/)
  for (const t of ['data-studio="player"', 'data-studio="text"', 'data-studio="prompt"', 'data-studio="variants"', 'render-pending', 'studioAccess']) assert.ok(screen.includes(t), t)
  // opening reads one card by cursor, never the whole list, and every hq() write sits behind a click handler or a key handler
  assert.match(screen, /review\?status=all&limit=1&cursor=/)
  assert.doesNotMatch(screen, /useEffect\(\(\) => \{[^}]*hq\(`?review\/[^}]*\}/)
  for (const f of ['src/components/admin/hq/studio-screen.tsx']) {
    const t = read(f)
    assert.doesNotMatch(t, /catch\s*(\([^)]*\))?\s*\{\s*\}/, f)
    assert.doesNotMatch(t, /[–—]/, f)
    assert.doesNotMatch(t, /errText\(/, `${f}: errors name the request instead of the generic text`)
  }
})

test('purge: strict proxy body (never pending, no extra keys) and view helpers', () => {
  const ok = (b) => resolveEndpoint('POST', ['content', 'purge'], q(), b).ok
  assert.equal(ok({ dryRun: true, statuses: ['draft', 'approved', 'rendering', 'ready', 'rejected'] }), true)
  assert.equal(ok({ dryRun: false, statuses: ['draft', 'published'] }), true)
  assert.equal(resolveEndpoint('POST', ['content', 'purge'], q(), { dryRun: true, statuses: ['draft'] }).path, 'content/purge')
  for (const b of [
    { dryRun: true, statuses: ['pending'] },
    { dryRun: true, statuses: ['draft', 'pending'] },
    { dryRun: true },
    { statuses: ['draft'] },
    { dryRun: 'true', statuses: ['draft'] },
    { dryRun: true, statuses: [] },
    { dryRun: true, statuses: ['nope'] },
    { dryRun: true, statuses: ['draft'], before: '2026-01-01' },
    { dryRun: true, statuses: ['draft'], action: 'approve' },
    null,
  ]) assert.equal(ok(b), false, JSON.stringify(b))
  assert.equal(resolveEndpoint('GET', ['content', 'purge'], q(), undefined).ok, false)
  assert.deepEqual(cs.purgeStatuses(false), ['draft', 'approved', 'rendering', 'ready', 'rejected'])
  assert.deepEqual(cs.purgeStatuses(true).slice(-1), ['published'])
  assert.ok(!cs.purgeStatuses(true).includes('pending'))
  assert.deepEqual(cs.purgeBody(true, false).dryRun, true)
  assert.deepEqual(cs.normalizePurge({ ok: true, counts: { materials: 3, approvals: 1, reviews: 0, files: 4, orders: 2, bytes: 9 } }), { materials: 3, approvals: 1, reviews: 0, files: 4, orders: 2, bytes: 9 })
  assert.equal(cs.normalizePurge({ ok: true, counts: { materials: 'x' } }), null)
  assert.equal(cs.normalizePurge({ ok: true }), null)
})

test('purge: the dev mock counts on a dry run, keeps pending and removes for real', () => {
  const mock = createHqMock(NOW)
  const before = mock('GET', 'content/feed', { limit: '200' }, {}, NOW)
  const statuses = ['draft', 'approved', 'rendering', 'ready', 'rejected']
  const dry = mock('POST', 'content/purge', {}, { dryRun: true, statuses }, NOW)
  assert.equal(dry.ok, true)
  assert.equal(dry.counts.materials, before.items.filter((i) => statuses.includes(i.status)).length)
  assert.equal(mock('GET', 'content/feed', { limit: '200' }, {}, NOW).total, before.total, 'a dry run removes nothing')
  assert.equal(mock('POST', 'content/purge', {}, { dryRun: true, statuses: ['pending'] }, NOW).error, 'invalid')
  const real = mock('POST', 'content/purge', {}, { dryRun: false, statuses }, NOW)
  assert.equal(real.counts.materials, dry.counts.materials)
  const after = mock('GET', 'content/feed', { limit: '200' }, {}, NOW)
  assert.ok(after.items.every((i) => !statuses.includes(i.status)))
  assert.ok(after.items.some((i) => i.status === 'pending'))
  assert.ok(after.items.some((i) => i.status === 'published'))
  assert.equal(mock('POST', 'content/purge', {}, { dryRun: true, statuses }, NOW).counts.materials, 0)
})
