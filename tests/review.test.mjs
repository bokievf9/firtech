import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Ревью-центр (docs/shell.md): view models, keyboard map, proxy whitelist, error pass-through, mock.
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

const r = await import('../src/lib/review.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')

const T0 = Date.parse('2026-11-21T10:00:00Z')
const get = (mock, p, q = {}) => mock('GET', p, q, {}, T0)
const post = (mock, p, b) => mock('POST', p, {}, b, T0)
const view = (mock, q = { status: 'all' }) => r.normalizeReview(get(mock, 'review', q))

test('normalizeReview reads the mock: counts, media proxied, versions, bad ids dropped', () => {
  const v = view(createHqMock(T0))
  assert.ok(v)
  assert.equal(v.items.length, 11)
  assert.deepEqual(v.counts, { marketing: 4, sales: 3, support: 1, production: 0, backoffice: 1, director: 0 })
  assert.equal(r.pendingTotal(v.counts), 9)
  const reel = v.items.find((i) => i.id === 'ap_201')
  assert.equal(reel.media[0].src, '/api/admin/files/41/reel.mp4')
  assert.equal(reel.media[0].poster, '/api/admin/files/41/cover.png')
  assert.equal(reel.versions.length, 2)
  assert.equal(v.items.find((i) => i.id === 'ap_202').media.length, 3)
  assert.equal(v.items.find((i) => i.id === 'ap_203').media.length, 0)
  assert.equal(r.normalizeItem({ id: 'x1' }), null)
  assert.equal(r.normalizeReview({ ok: true }), null)
  assert.equal(r.mediaSrc('/admin/files/../etc/passwd.png'), null)
  assert.equal(r.mediaSrc('https://evil.example/a.png'), null)
})

test('groupByDept and railItems: all keeps history, departments and director are pending only', () => {
  const v = view(createHqMock(T0))
  const g = r.groupByDept(v.items)
  assert.equal(g.sales.length, 3)
  assert.equal(r.railItems(v.items, 'all').length, 11)
  assert.equal(r.railItems(v.items, 'director').length, 9)
  assert.equal(r.railItems(v.items, 'marketing').length, 4)
  assert.equal(r.railItems(v.items, 'production').length, 0)
  assert.equal(r.railCount(v.counts, 'support'), 1)
  assert.equal(r.railCount(v.counts, 'director'), 9)
})

test('actionButtons follow the allowed actions in the contract order', () => {
  const v = view(createHqMock(T0))
  const by = (id) => r.actionButtons(v.items.find((i) => i.id === id)).map((b) => b.action)
  assert.deepEqual(by('ap_201'), ['approve', 'edit', 'revise', 'reject', 'reschedule'])
  assert.deepEqual(by('ap_202'), ['approve', 'edit', 'revise', 'reject', 'publish_now', 'reschedule'])
  assert.deepEqual(by('ap_204'), ['approve', 'edit', 'reject', 'send', 'call'])
  assert.deepEqual(by('ap_208'), ['approve', 'revise', 'reject', 'publish_now'])
  assert.deepEqual(by('ap_199'), [])
  const keys = r.actionButtons({ actions: [...r.ACTIONS] })
  assert.deepEqual(keys.map((b) => b.key), ['A', 'E', 'R', 'X', 'P', 'T', 'S', 'C'])
  assert.equal(keys.find((b) => b.action === 'reject').confirm, true)
  assert.equal(keys.find((b) => b.action === 'publish_now').confirm, true)
  assert.equal(keys.find((b) => b.action === 'approve').confirm, false)
})

test('navigation: J/K stop at the ends, removal picks the neighbour', () => {
  const list = [{ id: 'ap_3' }, { id: 'ap_2' }, { id: 'ap_1' }]
  assert.equal(r.stepItem(list, null, 1), 'ap_3')
  assert.equal(r.stepItem(list, 'ap_3', 1), 'ap_2')
  assert.equal(r.stepItem(list, 'ap_1', 1), 'ap_1')
  assert.equal(r.stepItem(list, 'ap_3', -1), 'ap_3')
  assert.equal(r.stepItem([], 'ap_3', 1), null)
  assert.equal(r.pickAfterRemoval(list, 'ap_2'), 'ap_1')
  assert.equal(r.pickAfterRemoval(list, 'ap_1'), 'ap_2')
  assert.equal(r.pickAfterRemoval([{ id: 'ap_9' }], 'ap_9'), null)
})

test('keyCommand: the whole keyboard map, by physical key so the Russian layout works', () => {
  const k = (code, key = '', extra = {}) => r.keyCommand({ code, key, ...extra })
  assert.deepEqual(k('KeyA', 'ф'), { type: 'action', action: 'approve' })
  assert.deepEqual(k('KeyE'), { type: 'action', action: 'edit' })
  assert.deepEqual(k('KeyR'), { type: 'action', action: 'revise' })
  assert.deepEqual(k('KeyX'), { type: 'action', action: 'reject' })
  assert.deepEqual(k('KeyP'), { type: 'action', action: 'publish_now' })
  assert.deepEqual(k('KeyJ'), { type: 'step', dir: 1 })
  assert.deepEqual(k('KeyK'), { type: 'step', dir: -1 })
  assert.deepEqual(k('Space', ' '), { type: 'play' })
  assert.deepEqual(k('Escape', 'Escape'), { type: 'back' })
  assert.deepEqual(k('Digit1'), { type: 'rail', rail: 'all' })
  assert.deepEqual(k('Digit2'), { type: 'rail', rail: 'marketing' })
  assert.deepEqual(k('Digit7'), { type: 'rail', rail: 'director' })
  assert.equal(k('Digit8'), null)
  assert.equal(k('KeyA', 'a', { metaKey: true }), null)
  assert.equal(k('KeyZ'), null)
})

test('fields and edit payload: only changed fields, hashtags parsed, captions grouped', () => {
  const v = view(createHqMock(T0))
  const reel = v.items.find((i) => i.id === 'ap_201')
  const f = r.fieldsOf(reel)
  assert.deepEqual(f.map((x) => x.key), ['caption', 'hashtags', 'body', 'tiktok', 'shorts'])
  assert.ok(f.every((x) => x.editable))
  assert.equal(r.editPayload(reel, {}), null)
  assert.equal(r.editPayload(reel, { caption: reel.text.caption }), null)
  assert.deepEqual(r.editPayload(reel, { caption: 'Новая', hashtags: 'fir, #бот', tiktok: 'tt' }), {
    text: { caption: 'Новая', hashtags: ['#fir', '#бот'], captions: { tiktok: 'tt' } },
  })
  const article = v.items.find((i) => i.id === 'ap_208')
  assert.ok(r.fieldsOf(article).every((x) => !x.editable), 'article has no edit action')
  const reply = v.items.find((i) => i.id === 'ap_204')
  assert.deepEqual(Object.keys(r.editPayload(reply, { draft: 'Привет' }).text), ['draft'])
  assert.deepEqual(r.parseHashtags(' a  #b,c '), ['#a', '#b', '#c'])
})

test('version diff summary and compare pair', () => {
  const v = view(createHqMock(T0))
  const reel = v.items.find((i) => i.id === 'ap_201')
  const [a, b] = r.comparePair(reel)
  assert.equal([a.v, b.v].join(), '1,2')
  const ch = r.versionChanges(a, b)
  assert.ok(ch.find((c) => c.key === 'caption' && c.delta > 0))
  assert.match(r.versionSummary(a, b), /^Changed: .*Caption \(\+\d+ chars\)/)
  assert.equal(r.versionSummary(a, a), 'No text changes')
  assert.equal(r.versionSummary(undefined, b), '')
  assert.equal(r.comparePair(v.items.find((i) => i.id === 'ap_204')), null)
})

test('meta cards link to the Shell sections; empty media explains itself', () => {
  const v = view(createHqMock(T0))
  const lead = r.metaCards(v.items.find((i) => i.id === 'ap_204')).find((c) => c.id === 'lead')
  assert.equal(lead.href, '/admin/clients?tab=pipeline&focus=7')
  const inv = r.metaCards(v.items.find((i) => i.id === 'ap_207')).find((c) => c.id === 'invoice')
  assert.equal(inv.href, '/admin/finance?tab=invoices&focus=7')
  const tk = r.metaCards(v.items.find((i) => i.id === 'ap_206')).find((c) => c.id === 'ticket')
  assert.equal(tk.href, '/admin/chats')
  const owner = v.items.find((i) => i.id === 'ap_203')
  assert.ok(r.metaCards(owner).some((c) => c.id === 'link'))
  assert.match(r.emptyMediaReason(owner), /after approval/)
  assert.equal(r.renderState(owner), 'none')
})

test('document text: articles show the markdown body, replies the draft', () => {
  const v = view(createHqMock(T0))
  assert.match(r.documentText(v.items.find((i) => i.id === 'ap_208')), /^## Зачем салону бот/)
  assert.match(r.documentText(v.items.find((i) => i.id === 'ap_204')), /^Здравствуйте, Нигина/)
})

test('optimistic helpers', () => {
  const v = view(createHqMock(T0))
  const next = r.withStatus(v.items, 'ap_204', 'approve')
  assert.equal(next.find((i) => i.id === 'ap_204').status, 'approved')
  assert.deepEqual(next.find((i) => i.id === 'ap_204').actions, ['call'])
  assert.equal(r.withoutItem(v.items, 'ap_204').length, 10)
  assert.equal(r.dropCount(v.counts, 'sales').sales, 2)
  assert.equal(r.dropCount(v.counts, 'production').production, 0)
  const edited = r.withText(v.items.find((i) => i.id === 'ap_204'), { draft: 'Новый' })
  assert.equal(edited.text.draft, 'Новый')
  assert.equal(edited.text.body, 'Новый')
})

test('trend link checks mirror HQ and the list normalizes', () => {
  assert.equal(r.trendUrlProblem('https://www.youtube.com/shorts/xyz'), null)
  assert.equal(r.trendUrlProblem('https://youtu.be/abc'), null)
  assert.ok(r.trendUrlProblem('http://www.youtube.com/x'))
  assert.ok(r.trendUrlProblem('https://evil.example/x'))
  assert.ok(r.trendUrlProblem('https://user:pw@www.tiktok.com/x'))
  assert.ok(r.trendUrlProblem('не ссылка'))
  assert.ok(r.trendUrlProblem(''))
  const t = r.normalizeTrends(get(createHqMock(T0), 'trends'))
  assert.deepEqual(t.items.map((i) => i.status), ['proposed', 'analysing'])
  assert.equal(t.items[0].reviewId, 'ap_203')
  assert.deepEqual(r.TREND_STATUSES, ['analysing', 'proposed', 'done', 'failed'])
})

test('proxy whitelist: review, chats, trends', () => {
  const q = new URLSearchParams('dept=sales&status=all&limit=50&cursor=9&evil=1')
  const ok = proxy.resolveEndpoint('GET', ['review'], q, undefined)
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.query, { dept: 'sales', status: 'all', limit: '50', cursor: '9' })
  const act = (id, body) => proxy.resolveEndpoint('POST', ['review', id], new URLSearchParams(), body).ok
  assert.equal(act('ap_12', { action: 'approve' }), true)
  assert.equal(act('ap_12', { action: 'edit', text: { caption: 'x', hashtags: ['#a'], captions: { tiktok: 'y' } } }), true)
  assert.equal(act('ap_12', { action: 'edit' }), false)
  assert.equal(act('ap_12', { action: 'edit', text: { evil: 'x' } }), false)
  assert.equal(act('ap_12', { action: 'revise' }), false)
  assert.equal(act('ap_12', { action: 'revise', note: 'короче' }), true)
  assert.equal(act('ap_12', { action: 'reschedule' }), false)
  assert.equal(act('ap_12', { action: 'reschedule', slot: '2026-11-25' }), true)
  assert.equal(act('ap_12', { action: 'call', slot: '2026-11-24T10:00:00Z' }), true)
  assert.equal(act('ap_12', { action: 'publish_now', platform: 'youtube' }), true)
  assert.equal(act('ap_12', { action: 'publish_now', platform: 'x' }), false)
  assert.equal(act('ap_12', { action: 'send', text: { draft: 'ok' } }), true)
  assert.equal(act('ap_12', { action: 'approve', extra: 1 }), false)
  assert.equal(act('12', { action: 'approve' }), false)
  assert.equal(act('ap_x', { action: 'approve' }), false)
  assert.equal(proxy.resolveEndpoint('GET', ['chats'], new URLSearchParams('status=open'), undefined).ok, true)
  assert.equal(proxy.resolveEndpoint('GET', ['chats', 'c3'], q, undefined).ok, true)
  assert.equal(proxy.resolveEndpoint('GET', ['chats', 'g-100123'], q, undefined).ok, true)
  assert.equal(proxy.resolveEndpoint('POST', ['chats', 'c3', 'reply'], q, { text: 'Привет' }).ok, true)
  assert.equal(proxy.resolveEndpoint('POST', ['chats', 'c3', 'reply'], q, { text: '' }).ok, false)
  assert.equal(proxy.resolveEndpoint('POST', ['chats', 'c3', 'reply'], q, { text: 'a'.repeat(2001) }).ok, false)
  assert.equal(proxy.resolveEndpoint('POST', ['chats', 'c3', 'reply'], q, { text: 'a', x: 1 }).ok, false)
  assert.equal(proxy.resolveEndpoint('GET', ['trends'], q, undefined).ok, true)
  assert.equal(proxy.resolveEndpoint('POST', ['trends'], q, { url: 'https://youtu.be/a', note: 'x' }).ok, true)
  assert.equal(proxy.resolveEndpoint('POST', ['trends'], q, { url: '' }).ok, false)
  assert.equal(proxy.resolveEndpoint('POST', ['trends'], q, { url: 'https://youtu.be/a', extra: 1 }).ok, false)
  assert.equal(proxy.resolveEndpoint('POST', ['chats'], q, {}).ok, false)
  assert.equal(proxy.resolveEndpoint('POST', ['review'], q, { action: 'approve' }).ok, false)
})

test('proxy keeps the item, results and message of a failed decision', async () => {
  const body = { ok: false, error: 'publish_failed', state: 'failed', message: 'нет квоты', results: [{ platform: 'shorts', state: 'failed' }], item: { id: 'ap_1' }, token: 'secret' }
  const res = await proxy.callHqAdmin('POST', 'review/ap_1', { body: { action: 'publish_now' } }, {
    env: { HQ_ADMIN_URL: 'http://hq.test/admin', HQ_ADMIN_TOKEN: 't' },
    fetcher: async (url, init) => {
      assert.equal(url, 'http://hq.test/admin/review/ap_1')
      assert.equal(init.method, 'POST')
      return new Response(JSON.stringify(body), { status: 200 })
    },
  })
  assert.equal(res.ok, false)
  assert.equal(res.error, 'publish_failed')
  assert.equal(res.results[0].platform, 'shorts')
  assert.equal(res.message, 'нет квоты')
  assert.equal('token' in res, false)
  assert.equal(r.resultText(r.normalizeResults(res.results)[0]), 'shorts: failed')
})

test('chat ids are encoded toward HQ', async () => {
  let seen = ''
  await proxy.callHqAdmin('GET', 'chats/g-100%2F1', {}, {
    env: { HQ_ADMIN_URL: 'http://hq.test/admin' },
    fetcher: async (url) => {
      seen = url
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    },
  })
  assert.equal(seen, 'http://hq.test/admin/chats/g-100%252F1')
})

test('mock decisions: approve, reject, edit versions, revise, reschedule, send, call, publish_now', () => {
  const m = createHqMock(T0)
  assert.equal(post(m, 'review/ap_204', { action: 'approve' }).item.status, 'approved')
  assert.equal(post(m, 'review/ap_204', { action: 'approve' }).ok, true, 'repeat is safe')
  assert.equal(post(m, 'review/ap_204', { action: 'reject' }).error, 'already_decided')
  assert.equal(post(m, 'review/ap_204', { action: 'edit', text: { draft: 'x' } }).error, 'not_pending')
  assert.equal(get(m, 'review', { status: 'pending' }).counts.sales, 2)
  const e = post(m, 'review/ap_201', { action: 'edit', text: { caption: 'Новая подпись' } })
  assert.equal(e.item.currentVersion, 3)
  assert.equal(e.item.versions.at(-1).author, 'owner')
  assert.equal(post(m, 'review/ap_201', { action: 'edit', text: { caption: 'Новая подпись' } }).error, 'not_applied')
  assert.equal(post(m, 'review/ap_201', { action: 'revise' }).error, 'invalid')
  assert.equal(post(m, 'review/ap_201', { action: 'revise', note: 'короче' }).state, 'revising')
  assert.equal(post(m, 'review/ap_201', { action: 'reschedule', slot: '2026-12-01' }).item.meta.slot, '2026-12-01')
  assert.equal(post(m, 'review/ap_205', { action: 'send' }).error, 'placeholder')
  // approve is refused like in HQ: 409 `placeholder` with the list, the card stays pending
  const refused = post(m, 'review/ap_205', { action: 'approve' })
  assert.equal(refused.error, 'placeholder')
  assert.deepEqual(refused.placeholders, ['[сумма этапа]'])
  assert.match(r.reviewError(refused, (c) => c), /unfilled placeholders.*\[сумма этапа\]/)
  assert.equal(post(m, 'review/ap_205', { action: 'send', text: { draft: 'Цена $650, предоплата 50%.' } }).state, 'handed_off')
  assert.equal(post(m, 'review/ap_206', { action: 'call', slot: '2026-11-24' }).error, 'not_applicable')
  assert.equal(post(m, 'review/ap_207', { action: 'call', slot: '2026-11-24' }).error, 'invalid')
  assert.equal(post(m, 'review/ap_207', { action: 'call', slot: '2026-11-24T10:00:00Z' }).callAt, '2026-11-24T10:00:00Z')
  const p = post(m, 'review/ap_202', { action: 'publish_now' })
  assert.equal(p.state, 'queued')
  assert.equal(p.item.status, 'approved')
  assert.equal(post(m, 'review/ap_208', { action: 'publish_now' }).state, 'published')
  assert.equal(post(m, 'review/ap_999', { action: 'approve' }).error, 'not_found')
  assert.equal(get(m, 'review', { dept: 'zzz' }).error, 'invalid')
  assert.equal(post(m, 'review/ap_203', { action: 'send' }).error, 'not_applicable')
})

// ---- the full-screen document editor (2026-11-22) --------------------------------------------------

const d = await import('../src/lib/doc-editor.ts')

test('documentField: text documents open the editor, content items and decided ones do not', () => {
  const v = view(createHqMock(T0))
  const byId = (id) => v.items.find((i) => i.id === id)
  assert.equal(d.documentField(byId('ap_204')).value.startsWith('Здравствуйте, Нигина'), true)
  assert.ok(d.documentField(byId('ap_205')), 'lead_price')
  assert.ok(d.documentField(byId('ap_206')), 'support_answer')
  assert.ok(d.documentField(byId('ap_207')), 'billing_invoice')
  assert.equal(d.documentField(byId('ap_201')), null, 'reel keeps the side editor')
  assert.equal(d.documentField(byId('ap_208')), null, 'article has no edit action')
  assert.equal(d.documentField(byId('ap_199')), null)
})

test('editorCommand: the keymap follows the physical key and needs the modifier', () => {
  const k = (code, extra = {}) => d.editorCommand({ key: '', code, ...extra })
  assert.equal(k('KeyS', { metaKey: true }), 'save')
  assert.equal(k('KeyS', { ctrlKey: true }), 'save')
  assert.equal(k('KeyS'), null, 'plain letters type')
  assert.equal(k('Enter', { metaKey: true }), 'saveClose')
  assert.equal(k('Enter'), null)
  assert.equal(k('KeyF', { metaKey: true }), 'find')
  assert.equal(k('KeyG', { metaKey: true }), 'findNext')
  assert.equal(k('KeyG', { metaKey: true, shiftKey: true }), 'findPrev')
  assert.equal(k('F3'), 'findNext')
  assert.equal(k('KeyB', { metaKey: true }), 'bold')
  assert.equal(k('KeyI', { metaKey: true }), 'italic')
  assert.equal(k('KeyK', { metaKey: true }), 'link')
  assert.equal(k('KeyS', { metaKey: true, altKey: true }), null)
  assert.equal(d.editorCommand({ key: 'Escape', code: 'Escape' }), 'close')
})

test('versionSavePayload: the edit call carries only the draft, nothing when unchanged', () => {
  const v = view(createHqMock(T0))
  const it = v.items.find((i) => i.id === 'ap_204')
  assert.deepEqual(d.versionSavePayload(it, 'Новый текст'), { action: 'edit', text: { draft: 'Новый текст' } })
  assert.equal(d.versionSavePayload(it, it.text.draft), null)
  // The payload passes the proxy whitelist as it is.
  const body = d.versionSavePayload(it, 'Новый текст')
  assert.equal(proxy.resolveEndpoint('POST', ['review', 'ap_204'], new URLSearchParams(), body).ok, true)
})

test('saving through the mock adds version v+1 and the diff against v1 sees the change', async () => {
  const m = createHqMock(T0)
  const it = view(m).items.find((i) => i.id === 'ap_204')
  const text = it.text.draft.replace('5-7 дней', '7-10 дней')
  const res = post(m, 'review/ap_204', d.versionSavePayload(it, text))
  const next = r.normalizeItem(res.item)
  assert.equal(next.currentVersion, 2)
  assert.equal(next.versions.at(-1).author, 'owner')
  assert.equal(d.firstVersionText(next), it.text.draft, 'v1 is the text before the edit')
  const { wordDiff, diffStats } = await import('../src/lib/diff.ts')
  const stats = diffStats(wordDiff(d.firstVersionText(next), next.text.draft))
  assert.deepEqual([stats.added, stats.removed], [1, 1])
})

test('applyFormat: bold and italic wrap and unwrap, heading and list toggle per line', () => {
  let e = d.applyFormat('цена 300', 5, 8, 'bold')
  assert.equal(e.text, 'цена **300**')
  assert.equal(e.text.slice(e.start, e.end), '300')
  e = d.applyFormat(e.text, e.start, e.end, 'bold')
  assert.equal(e.text, 'цена 300')
  e = d.applyFormat('слово', 0, 5, 'italic')
  assert.equal(e.text, '*слово*')
  e = d.applyFormat('', 0, 0, 'bold')
  assert.equal(e.text, '**текст**')
  assert.equal(e.text.slice(e.start, e.end), 'текст')
  assert.equal(d.applyFormat('Заголовок\nтекст', 3, 3, 'heading').text, '## Заголовок\nтекст')
  assert.equal(d.applyFormat('## Заголовок', 4, 4, 'heading').text, 'Заголовок')
  assert.equal(d.applyFormat('a\nb\nc', 0, 5, 'list').text, '- a\n- b\n- c')
  assert.equal(d.applyFormat('- a\n- b', 0, 7, 'list').text, 'a\nb')
  const l = d.applyFormat('смотрите сайт', 9, 13, 'link')
  assert.equal(l.text, 'смотрите [сайт](https://)')
  assert.equal(l.text.slice(l.start, l.end), 'https://')
})

test('applyFormat table: a new row copies the column count, a fresh table has the estimate head', () => {
  const t = '| Этап | Сумма |\n|---|---|\n| 1 | $300 |\nконец'
  const e = d.applyFormat(t, t.indexOf('| 1'), t.indexOf('| 1'), 'table')
  assert.equal(e.text, '| Этап | Сумма |\n|---|---|\n| 1 | $300 |\n|  |  |\nконец')
  const f = d.applyFormat('Смета', 2, 2, 'table')
  assert.ok(f.text.includes('| Этап | Что входит | Сумма |\n|---|---|---|\n|  |  |  |'))
  assert.ok(f.text.startsWith('Смета\n\n|'))
})

test('find and replace: case, counting, one and all, stepping with wrap-around', () => {
  const text = 'Цена: 300. Цена этапа 2 - цена 150.'
  assert.deepEqual(d.findMatches(text, 'цена'), [0, 11, 26])
  assert.deepEqual(d.findMatches(text, 'цена', true), [26])
  assert.deepEqual(d.findMatches(text, ''), [])
  assert.equal(d.replaceAt(text, 11, 4, 'Сумма'), 'Цена: 300. Сумма этапа 2 - цена 150.')
  assert.deepEqual(d.replaceAll(text, 'цена', 'сумма'), { text: 'сумма: 300. сумма этапа 2 - сумма 150.', count: 3 })
  assert.deepEqual(d.replaceAll('aaa', 'a', 'aa'), { text: 'aaaaaa', count: 3 })
  const m = [0, 11, 26]
  assert.equal(d.stepMatch(m, 0, 1), 0)
  assert.equal(d.stepMatch(m, 1, 1), 11)
  assert.equal(d.stepMatch(m, 27, 1), 0, 'wraps to the first')
  assert.equal(d.stepMatch(m, 11, -1), 0)
  assert.equal(d.stepMatch(m, 0, -1), 26, 'wraps to the last')
  assert.equal(d.stepMatch([], 0, 1), null)
})

test('counts and the local draft: only a draft started from the saved text is offered back', () => {
  assert.equal(d.wordCount('  один два\nтри  '), 3)
  assert.equal(d.wordCount(''), 0)
  assert.equal(d.readMinutes('слово '.repeat(400)), 2)
  const raw = d.serializeDraft({ base: 'старый', value: 'новый', at: 5 })
  assert.deepEqual(d.parseDraft(raw), { base: 'старый', value: 'новый', at: 5 })
  assert.equal(d.parseDraft('{"base":1}'), null)
  assert.equal(d.parseDraft('not json'), null)
  assert.equal(d.parseDraft(null), null)
  assert.equal(d.draftRestorable({ base: 'a', value: 'b', at: 1 }, 'a'), true)
  assert.equal(d.draftRestorable({ base: 'a', value: 'a', at: 1 }, 'a'), false, 'nothing to restore')
  assert.equal(d.draftRestorable({ base: 'a', value: 'b', at: 1 }, 'c'), false, 'the saved text moved on')
  assert.equal(d.draftKey('ap_204'), 'firtech-doc-draft:ap_204:draft')
  assert.equal(d.DOC_MAX, 40000)
})

test('targetForRow: every row of the Documents tab finds its review item, pending or approved', () => {
  const v = view(createHqMock(T0))
  const row = (id, kind, client) => ({ id, kind, client })
  assert.equal(d.targetForRow(row('bl:7', 'invoice', 'Sadaf Clinic'), v.items).item.id, 'ap_207', 'invoice draft')
  assert.equal(d.targetForRow(row('bl:5', 'invoice', 'Алиса'), v.items), null, 'no review item for that invoice')
  const bo = d.targetForRow(row('bo:2', 'contract', 'Алиса'), v.items)
  assert.equal(bo.item.id, 'ap_210', 'approved back-office document the client has not signed')
  assert.equal(bo.doc, null)
  const kp = d.targetForRow(row('ps:31', 'kp', 'Боб'), v.items)
  assert.equal(kp.item.id, 'ap_209')
  assert.equal(kp.doc, 'kp')
  assert.equal(kp.storageId, 'ap_209:kp')
  assert.equal(d.targetForRow(row('ps:32', 'estimate', 'Другое имя'), v.items).doc, 'estimate', 'by id, the name does not matter')
  assert.equal(d.targetForRow(row('ps:4', 'kp', 'Боб'), v.items), null, 'the pack carries ids: no kind+client guess')
  const bare = v.items.map((i) => (i.id === 'ap_209' ? { ...i, meta: { ...i.meta, pack: { id: 4 } }, text: { ...i.text, documents: i.text.documents.map((x) => ({ ...x, id: undefined })) } } : i))
  assert.equal(d.targetForRow(row('ps:4', 'kp', 'Боб'), bare).doc, 'kp', 'no ids: the old fallback')
  assert.equal(d.targetForRow(row('ps:4', 'kp', 'Кто-то другой'), bare), null, 'another client')
  const onlyPack = v.items.map((i) => (i.id === 'ap_209' ? { ...i, text: { ...i.text, documents: i.text.documents.map((x) => ({ ...x, id: undefined })) } } : i))
  assert.equal(d.targetForRow(row('ps:33', 'contract', 'X'), onlyPack).doc, 'contract', 'meta.pack.documentIds alone is enough')
  assert.equal(d.targetForRow(row('ps:9', 'invoice', 'Боб'), v.items), null)
  assert.equal(d.targetForRow(row('bo:x', 'contract', ''), v.items), null)
  const docs = get(createHqMock(T0), 'crm/documents', {})
  assert.ok(docs.items.some((x) => x.id === 'bl:7'), 'the mock has the row')
})

test('editableTargets: a presales pack opens kp, estimate and contract; an approved pack leaves the contract out', () => {
  const v = view(createHqMock(T0))
  const pack = v.items.find((i) => i.id === 'ap_209')
  assert.deepEqual(d.editableTargets(pack).map((t) => t.doc), ['kp', 'estimate', 'contract'])
  assert.equal(d.documentField(pack), null, 'the pack goes through its documents, not the draft')
  assert.deepEqual(d.editableTargets({ ...pack, status: 'approved' }).map((t) => t.doc), ['kp', 'estimate'])
  assert.deepEqual(d.editableTargets({ ...pack, actions: ['call'] }), [], 'no edit action, no editor')
  assert.equal(d.documentField(v.items.find((i) => i.id === 'ap_210')).value.startsWith('## Договор'), true, 'approved but unsigned: HQ lists edit')
  assert.equal(d.documentField(v.items.find((i) => i.id === 'ap_199')), null)
  assert.equal(d.targetOf(pack, 'ap_209:estimate').doc, 'estimate')
  assert.equal(d.targetOf(pack, 'ap_209').doc, 'kp', 'a bare item id opens the first document')
  assert.equal(d.targetOf(pack, 'ap_209:nope'), null)
})

test('a presales document edit: payload with `doc`, optimistic text, mock version, 40000 characters allowed', async () => {
  const m = createHqMock(T0)
  const pack = view(m).items.find((i) => i.id === 'ap_209')
  const estimate = d.editableTargets(pack).find((t) => t.doc === 'estimate')
  const payload = d.versionSavePayload(pack, estimate.value + '\n\nПримечание.', 'estimate')
  assert.deepEqual(payload, { action: 'edit', doc: 'estimate', text: { draft: estimate.value + '\n\nПримечание.' } })
  assert.equal(d.versionSavePayload(pack, estimate.value, 'estimate'), null, 'unchanged')
  assert.equal(d.withDocText(pack, 'Новая', 'kp').text.body, 'Новая')
  assert.equal(d.withDocText(pack, 'Новая', 'kp').text.documents.find((x) => x.key === 'kp').body, 'Новая')
  const res = post(m, 'review/ap_209', payload)
  assert.equal(res.ok, true)
  const next = r.normalizeItem(res.item)
  assert.equal(next.currentVersion, 2)
  assert.ok(next.text.documents.find((x) => x.key === 'estimate').body.endsWith('Примечание.'))
  assert.equal(d.firstVersionText(next, 'estimate'), estimate.value, 'v1 of that document')
  assert.equal(post(m, 'review/ap_209', { action: 'edit', text: { draft: 'x' } }).error, 'invalid', 'a pack needs doc')
  // the proxy accepts `doc` only with an edit carrying text.draft, and long contracts
  const { resolveEndpoint } = await import('../src/lib/hq-admin.ts')
  const ok = (body) => resolveEndpoint('POST', ['review', 'ap_209'], new URLSearchParams(), body).ok
  assert.equal(ok(payload), true)
  assert.equal(ok({ action: 'edit', doc: 'contract', text: { draft: 'я'.repeat(40000) } }), true)
  assert.equal(ok({ action: 'edit', doc: 'contract', text: { draft: 'я'.repeat(40001) } }), false)
  assert.equal(ok({ action: 'edit', doc: 'invoice', text: { draft: 'x' } }), false)
  assert.equal(ok({ action: 'approve', doc: 'kp' }), false)
  assert.equal(ok({ action: 'edit', doc: 'kp' }), false)
  assert.equal(resolveEndpoint('POST', ['approvals', '7'], new URLSearchParams(), { action: 'edit', text: 'я'.repeat(40000) }).ok, true)
  // an approved, unsigned document still takes an edit; a decided one without editApproved does not
  assert.equal(post(m, 'review/ap_210', { action: 'edit', text: { draft: 'Новый договор' } }).item.currentVersion, 2)
  assert.equal(post(m, 'review/ap_199', { action: 'edit', text: { caption: 'x' } }).error, 'not_pending')
})

test('doc-editor: findPlaceholders marks templates, not markdown links; the reason names them all', async () => {
  const d = await import('../src/lib/doc-editor.ts')
  const text = 'Срок [срок], цена [цена], см. [условия](https://x.y), снова [срок].'
  const found = d.findPlaceholders(text)
  assert.deepEqual(found.map((f) => f.text), ['[срок]', '[цена]', '[срок]'])
  assert.equal(text.slice(found[1].start, found[1].end), '[цена]')
  assert.deepEqual(d.placeholderList(text), ['[срок]', '[цена]'])
  assert.match(d.placeholderReason(['[срок]', '[цена]']), /2 placeholders are still unfilled \(\[срок\], \[цена\]\)/)
  assert.match(d.placeholderReason(['[срок]']), /one placeholder is still unfilled/)
  assert.deepEqual(d.findPlaceholders('Всё заполнено, ссылка [текст](u).'), [])
})
