import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, beforeEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Same mapping as admin.test.mjs: 'server-only', '@/...' and 'next/server' for plain Node.
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

const root = await mkdtemp(path.join(tmpdir(), 'firtech-hq-admin-test-'))
after(() => rm(root, { recursive: true, force: true }))

const auth = await import('../src/lib/admin-auth.ts')
const route = await import('../src/app/api/admin/hq/[...path]/route.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const v = await import('../src/lib/hq-admin-view.ts')

// A session written straight into admin.json, the way verifyCode stores it (hash only).
const TOKEN = 'test-session-token-hq'
let dirCount = 0
const realFetch = globalThis.fetch
beforeEach(async () => {
  process.env.DATA_DIR = path.join(root, `d${++dirCount}`)
  await mkdir(process.env.DATA_DIR, { recursive: true })
  const now = Date.now()
  const id = createHash('sha256').update(TOKEN).digest('hex')
  await writeFile(
    path.join(process.env.DATA_DIR, 'admin.json'),
    JSON.stringify({ codes: [], issued: [], sessions: [{ id, createdAt: now, expiresAt: now + 60_000 }] }),
  )
  delete process.env.HQ_ADMIN_URL
  delete process.env.HQ_ADMIN_TOKEN
  delete process.env.HQ_OFFICE_TOKEN
  globalThis.fetch = realFetch
})

const ORIGIN = 'http://localhost'
function request(url, { method = 'GET', body, cookie = TOKEN, origin = ORIGIN } = {}) {
  const headers = { host: 'localhost', 'content-type': 'application/json' }
  if (origin) headers.origin = origin
  if (cookie) headers.cookie = `${auth.SESSION_COOKIE}=${cookie}`
  return new Request(`${ORIGIN}${url}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
}
const ctx = (...segments) => ({ params: Promise.resolve({ path: segments }) })
const call = (method, url, segments, opts) => route[method](request(url, { method, ...opts }), ctx(...segments))

test('proxy: no session is 401, a foreign origin on POST is 403', async () => {
  let res = await call('GET', '/api/admin/hq/state', ['state'], { cookie: null })
  assert.equal(res.status, 401)
  res = await call('GET', '/api/admin/hq/state', ['state'], { cookie: 'wrong' })
  assert.equal(res.status, 401)
  res = await call('POST', '/api/admin/hq/say', ['say'], { body: { text: 'hi' }, origin: 'https://evil.example' })
  assert.equal(res.status, 403)
})

test('proxy: unknown endpoints are 404, bad bodies 400, before HQ is called', async () => {
  let called = 0
  process.env.HQ_ADMIN_URL = 'http://hq.test/admin'
  globalThis.fetch = async () => {
    called++
    return Response.json({ ok: true })
  }
  assert.equal((await call('GET', '/api/admin/hq/secrets', ['secrets'])).status, 404)
  assert.equal((await call('POST', '/api/admin/hq/state', ['state'], { body: {} })).status, 404)
  assert.equal((await call('GET', '/api/admin/hq/tasks/..', ['tasks', '..'])).status, 404)
  assert.equal((await call('POST', '/api/admin/hq/presence', ['presence'], { body: { mode: 'beach' } })).status, 400)
  assert.equal((await call('POST', '/api/admin/hq/say', ['say'], { body: { text: '   ' } })).status, 400)
  assert.equal((await call('POST', '/api/admin/hq/command', ['command'], { body: { name: 'rm -rf' } })).status, 400)
  assert.equal(
    (await call('POST', '/api/admin/hq/approvals/7', ['approvals', '7'], { body: { action: 'edit' } })).status,
    400,
  )
  assert.equal(called, 0)
})

test('proxy: forwards to HQ with the token, which never comes back; extra query keys are dropped', async () => {
  process.env.HQ_ADMIN_URL = 'http://hq.test/admin/'
  process.env.HQ_OFFICE_TOKEN = 'office-secret'
  const seen = []
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), init })
    return Response.json({ ok: true, items: [] })
  }
  const res = await call('GET', '/api/admin/hq/tasks?dept=sales&open=1&evil=1', ['tasks'])
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, items: [] })
  assert.equal(seen[0].url, 'http://hq.test/admin/tasks?dept=sales&open=1')
  assert.equal(seen[0].init.headers['x-admin-token'], 'office-secret')

  process.env.HQ_ADMIN_TOKEN = 'admin-secret'
  const post = await call('POST', '/api/admin/hq/approvals/12', ['approvals', '12'], { body: { action: 'approve', part: 'post' } })
  const text = await post.text()
  assert.ok(!text.includes('secret'))
  assert.equal(seen[1].url, 'http://hq.test/admin/approvals/12')
  assert.equal(seen[1].init.method, 'POST')
  assert.equal(seen[1].init.headers['x-admin-token'], 'admin-secret')
  assert.deepEqual(JSON.parse(seen[1].init.body), { action: 'approve', part: 'post' })
})

test('proxy: HQ errors pass through as { ok: false, error } with HTTP 200', async () => {
  process.env.HQ_ADMIN_URL = 'http://hq.test/admin'
  const replies = [
    () => Response.json({ ok: false, error: 'already_decided' }, { status: 409 }),
    () => new Response('nope', { status: 500 }),
    () => new Response('', { status: 401 }),
    () => Response.json({ items: [] }),
    () => {
      throw new TypeError('fetch failed')
    },
  ]
  const expected = ['already_decided', 'hq_error', 'hq_unauthorized', 'hq_bad_response', 'hq_unreachable']
  for (const [i, reply] of replies.entries()) {
    globalThis.fetch = async () => reply()
    const res = await call('GET', '/api/admin/hq/approvals', ['approvals'])
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: false, error: expected[i] })
  }
})

test('proxy: a slow HQ times out into { ok: false, error: hq_timeout }', async () => {
  const hang = (_url, init) =>
    new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))
  const started = Date.now()
  const res = await proxy.callHqAdmin('GET', 'state', {}, { env: { HQ_ADMIN_URL: 'http://hq.test/admin' }, fetcher: hang, timeoutMs: 50 })
  assert.deepEqual(res, { ok: false, error: 'hq_timeout' })
  assert.ok(Date.now() - started < 2000)
  assert.equal(proxy.HQ_ADMIN_TIMEOUT_MS, 5000)
})

test('proxy: without HQ_ADMIN_URL development uses the mock, production the loopback default', async () => {
  const res = await call('GET', '/api/admin/hq/state', ['state'])
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.equal(body.mock, true)
  const seen = []
  const out = await proxy.callHqAdmin('GET', 'state', {}, {
    env: { NODE_ENV: 'production' },
    fetcher: async (url) => {
      seen.push(String(url))
      throw new TypeError('down')
    },
  })
  assert.deepEqual(out, { ok: false, error: 'hq_unreachable' })
  assert.equal(seen[0], 'http://127.0.0.1:8787/admin/state')
})

// ---------------------------------------------------------------------------------------------
// Mock: shapes the page relies on, and the state it keeps.

const T0 = Date.parse('2026-11-19T07:00:00Z')

test('mock: every endpoint answers in the contract shape', () => {
  const hq = createHqMock(T0)
  const state = hq('GET', 'state', {}, {}, T0)
  assert.ok(v.looksLikeState(state))
  for (const k of ['inboxUnread', 'approvalsPending', 'approvalsQueued', 'tasksOpen', 'builderIssues']) {
    assert.equal(typeof state[k], 'number', k)
  }
  assert.equal(typeof state.tz, 'string')
  const inbox = hq('GET', 'inbox', { limit: '50' }, {}, T0)
  assert.ok(v.hasItems(inbox) && inbox.items.length > 0)
  for (const i of inbox.items) {
    assert.ok(v.INBOX_KINDS.includes(i.kind))
    assert.equal(typeof i.read, 'boolean')
    assert.ok(!Number.isNaN(Date.parse(i.at)))
  }
  const approvals = hq('GET', 'approvals', {}, {}, T0).items
  assert.ok(approvals.some((a) => a.locked))
  for (const a of approvals) {
    if (a.kind === 'content_item') {
      assert.equal(a.locked, true)
      assert.ok(a.parts.every((p) => p.id !== undefined && typeof p.label === 'string'))
    } else assert.ok(!a.parts)
  }
  const tasks = hq('GET', 'tasks', { limit: '500' }, {}, T0).items
  const sorted = [...tasks].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  assert.deepEqual(tasks.map((t) => t.id), sorted.map((t) => t.id))
  for (const t of tasks) for (const k of ['id', 'title', 'dept', 'status', 'createdAt', 'updatedAt']) assert.ok(k in t, k)
  const detail = hq('GET', 'tasks/15', {}, {}, T0)
  assert.equal(detail.ok, true)
  assert.ok(Array.isArray(detail.events) && Array.isArray(detail.approvals) && Array.isArray(detail.children))
  assert.ok('body' in detail.task && 'creator' in detail.task && 'costUsd' in detail.task)
  const depts = hq('GET', 'departments', {}, {}, T0).items
  assert.ok(depts.find((d) => d.id === 'production').status === 'paused')
  assert.equal(typeof hq('GET', 'drill', {}, {}, T0).text, 'string')
  assert.deepEqual(hq('GET', 'nothing', {}, {}, T0), { ok: false, error: 'not_found' })
})

test('mock: approve, already decided, edit, release the queue', () => {
  const hq = createHqMock(T0)
  const res = hq('POST', 'approvals/102', {}, { action: 'approve' }, T0)
  assert.equal(res.status, 'approved')
  assert.equal(typeof res.message, 'string')
  assert.ok(Array.isArray(res.notes))
  assert.deepEqual(hq('POST', 'approvals/102', {}, { action: 'approve' }, T0), { ok: false, error: 'already_decided' })
  assert.deepEqual(hq('POST', 'approvals/999', {}, { action: 'reject' }, T0), { ok: false, error: 'not_found' })
  assert.equal(hq('POST', 'approvals/101', {}, { action: 'edit', text: 'Новый текст', part: 'post' }, T0).status, 'pending')
  assert.equal(hq('GET', 'approvals', {}, {}, T0).items.find((a) => a.id === 101).text, 'Новый текст')
  const before = hq('GET', 'state', {}, {}, T0)
  assert.ok(before.approvalsQueued > 0)
  hq('POST', 'command', {}, { name: 'approve' }, T0)
  const afterState = hq('GET', 'state', {}, {}, T0)
  assert.equal(afterState.approvalsQueued, 0)
  assert.equal(afterState.approvalsPending, before.approvalsPending + before.approvalsQueued)
})

test('mock: presence follows pings, say creates a task, retry unblocks', () => {
  const hq = createHqMock(T0)
  assert.equal(hq('GET', 'state', {}, {}, T0).presence.effective, 'desk')
  const later = T0 + 11 * 60_000
  assert.equal(hq('GET', 'state', {}, {}, later).presence.effective, 'away')
  assert.equal(hq('POST', 'ping', {}, {}, later).presence.effective, 'desk')
  assert.equal(hq('POST', 'presence', {}, { mode: 'away' }, later).presence.effective, 'away')
  hq('POST', 'command', {}, { name: 'desk' }, later)
  assert.equal(hq('GET', 'state', {}, {}, later).presence.mode, 'desk')

  const said = hq('POST', 'say', {}, { text: 'Подготовь КП для салона' }, later)
  assert.ok(said.replies.length > 0)
  const created = hq('GET', `tasks/${said.taskId}`, {}, {}, later)
  assert.equal(created.task.dept, 'sales')

  const retried = hq('POST', 'tasks/15/retry', {}, {}, later)
  assert.equal(retried.task.status, 'assigned')
  assert.ok(retried.replies.length)
  assert.ok(hq('GET', 'tasks', { status: 'blocked,assigned' }, {}, later).items.some((t) => t.id === 15))
})

test('mock: time adds inbox rows; read marks them', () => {
  const hq = createHqMock(T0)
  const n = hq('GET', 'inbox', {}, {}, T0).items.length
  assert.ok(hq('GET', 'inbox', {}, {}, T0 + 4 * 90_000).items.length > n)
  hq('POST', 'inbox/read', {}, { all: true }, T0 + 4 * 90_000)
  assert.equal(hq('GET', 'state', {}, {}, T0 + 4 * 90_000).inboxUnread, 0)
})

// ---------------------------------------------------------------------------------------------
// View models

test('presence: derivation, auto-away and change toasts', () => {
  const now = T0
  const at = (min) => new Date(now - min * 60_000).toISOString()
  assert.equal(v.effectivePresence('desk', at(3), 10, now), 'desk')
  assert.equal(v.effectivePresence('desk', at(11), 10, now), 'away')
  assert.equal(v.effectivePresence('desk', null, 10, now), 'away')
  assert.equal(v.effectivePresence('away', at(0), 10, now), 'away')

  const view = (mode, effective, min = 1) =>
    v.presenceView({ presence: { mode, effective, lastPingAt: at(min), awayAfterMin: 10 } }, now)
  assert.deepEqual(view('desk', 'desk'), { mode: 'desk', effective: 'desk', autoAway: false, telegram: false, minutesSincePing: 1 })
  assert.equal(view('desk', 'away').autoAway, true)
  assert.equal(view('desk', 'away').telegram, true)
  assert.equal(view('away', 'away').autoAway, false)
  assert.equal(v.presenceView(null, now), null)

  assert.equal(v.presenceChange(null, view('desk', 'desk')), null)
  assert.equal(v.presenceChange(view('desk', 'desk'), view('desk', 'desk')), null)
  assert.equal(v.presenceChange(view('desk', 'desk'), view('away', 'away')), 'toAway')
  assert.equal(v.presenceChange(view('desk', 'desk'), view('desk', 'away')), 'autoAway')
  assert.equal(v.presenceChange(view('away', 'away'), view('desk', 'desk')), 'toDesk')
})

test('badges: nothing for zero, 99+ above 99', () => {
  assert.equal(v.badgeText(0), null)
  assert.equal(v.badgeText(undefined), null)
  assert.equal(v.badgeText(3), '3')
  assert.equal(v.badgeText(120), '99+')
})

test('inbox view: newest first, fresh rows, links, unread and mark read', () => {
  const items = [
    { id: 1, at: '2026-11-19T06:00:00Z', kind: 'summary', text: 'a', read: true, deliveredTg: true },
    { id: 2, at: '2026-11-19T07:00:00Z', kind: 'approval', text: 'b', read: false, deliveredTg: false, taskId: 5, approvalId: 9 },
    { id: 3, at: '2026-11-19T06:30:00Z', kind: 'weird', text: 'c', read: false, deliveredTg: false, taskId: 5 },
  ]
  const first = v.inboxView(items, null)
  assert.deepEqual(first.items.map((i) => i.id), [2, 3, 1])
  assert.equal(first.unread, 2)
  assert.ok(first.items.every((i) => !i.fresh))
  assert.deepEqual(first.items[0].target, { kind: 'approval', id: 9 })
  assert.deepEqual(first.items[1].target, { kind: 'task', id: 5 })
  assert.equal(first.items[1].kind, 'message')
  assert.equal(first.items[2].target, null)
  const next = v.inboxView([...items, { id: 4, at: '2026-11-19T08:00:00Z', kind: 'alert', text: 'd', read: false, deliveredTg: false }], first.seen)
  assert.deepEqual(next.items.filter((i) => i.fresh).map((i) => i.id), [4])
  assert.equal(v.markRead(items, [2]).filter((i) => !i.read).length, 1)
  assert.equal(v.markRead(items, 'all').filter((i) => !i.read).length, 0)
})

test('approvals view: oldest first, optimistic remove and edit, already decided counts as gone', () => {
  const a = (id, createdAt) => ({ id, kind: 'post', dept: 'marketing', summary: 's', text: 't', level: 1, taskId: null, createdAt, locked: false })
  const items = [a(1, '2026-11-19T07:00:00Z'), a('2', '2026-11-19T06:00:00Z')]
  assert.deepEqual(v.approvalsView(items).map((x) => x.id), ['2', 1])
  assert.deepEqual(v.withoutApproval(items, 2).map((x) => x.id), [1])
  assert.equal(v.editApproval(items, '1', 'new')[0].text, 'new')
  assert.equal(v.decisionGone({ ok: true }), true)
  assert.equal(v.decisionGone({ ok: false, error: 'already_decided' }), true)
  assert.equal(v.decisionGone({ ok: false, error: 'failed' }), false)
})

test('task board: columns, done only today, filters, blocked reason', () => {
  const now = Date.parse('2026-11-19T10:00:00Z') // 15:00 in Tashkent
  const task = (id, status, updatedAt, extra = {}) => ({
    id, title: `t${id}`, dept: 'marketing', status, assigneeId: 'publisher', assigneeTitle: 'Publisher',
    priority: null, dueAt: null, createdAt: updatedAt, updatedAt, tags: [], progressLine: null, lastEvent: null, ...extra,
  })
  const items = [
    task(1, 'running', '2026-11-19T09:00:00Z', { progressLine: 'Шаг 2' }),
    task(2, 'done', '2026-11-19T02:00:00Z'), // 07:00 Tashkent, today
    task(3, 'done', '2026-11-18T18:00:00Z'), // 23:00 yesterday in Tashkent
    task(4, 'blocked', '2026-11-19T05:00:00Z', { lastEvent: { at: '', kind: 'task.blocked', actor: 'x', body: 'Нет доступа' } }),
    task(5, 'blocked', '2026-11-19T04:00:00Z', { progressLine: 'ждёт токен' }),
    task(6, 'mystery', '2026-11-19T08:00:00Z', { dept: 'sales', assigneeId: 'presales' }),
    task(7, 'cancelled', '2026-11-19T08:00:00Z'),
  ]
  const board = v.taskBoard(items, {}, now, 'Asia/Tashkent')
  const col = (id) => board.columns.find((c) => c.id === id).tasks.map((t) => t.id)
  assert.deepEqual(board.columns.map((c) => c.id), ['inbox', 'assigned', 'running', 'review', 'approval', 'blocked', 'done'])
  assert.deepEqual(col('done'), [2])
  assert.deepEqual(col('blocked'), [5, 4])
  assert.deepEqual(col('inbox'), [6])
  assert.equal(board.total, 5)
  assert.equal(board.open, 4)
  assert.deepEqual(v.taskBoard(items, { dept: 'sales' }, now).columns.flatMap((c) => c.tasks.map((t) => t.id)), [6])
  assert.equal(v.taskBoard(items, { assigneeId: 'presales' }, now).total, 1)
  assert.equal(v.blockedReason(items[3]), 'Нет доступа')
  assert.equal(v.blockedReason(items[4]), 'ждёт токен')
})

test('director chat: commands, Telegram HTML, kept messages', () => {
  assert.deepEqual(v.parseCommand('/status'), { name: 'status', arg: '' })
  assert.deepEqual(v.parseCommand('/Approve@firtech_bot 12 '), { name: 'approve', arg: '12' })
  assert.equal(v.parseCommand('сделай пост'), null)
  assert.equal(v.parseCommand('/ nope'), null)
  assert.equal(v.plainBotText('<b>Статус</b>\n&lt;3 &amp; <code>ok</code><br>end'), 'Статус\n<3 & ok\nend')
  const many = Array.from({ length: 70 }, (_, i) => ({ id: String(i), role: 'me', text: `m${i}`, at: '' }))
  assert.equal(v.keepLast(many).length, 50)
  assert.equal(v.keepLast(many)[0].id, '20')
  assert.deepEqual(v.readChat(null), [])
  assert.deepEqual(v.readChat('{bad'), [])
  assert.deepEqual(
    v.readChat(JSON.stringify([{ id: 'a', role: 'me', text: 'hi', at: '' }, { id: 1, role: 'x' }])).map((m) => m.id),
    ['a'],
  )
})

test('proxy: CRM whitelist - GET lists and summary, two POSTs with numeric ids, nothing else', async () => {
  const seen = []
  process.env.HQ_ADMIN_URL = 'http://hq.test/admin'
  process.env.HQ_ADMIN_TOKEN = 'tok'
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), method: init.method, body: init.body })
    return Response.json({ ok: true, available: true, items: [] })
  }
  let res = await call('GET', '/api/admin/hq/crm/summary', ['crm', 'summary'])
  assert.equal(res.status, 200)
  for (const name of ['prospects', 'leads', 'clients', 'tickets', 'documents', 'projects', 'referrals', 'reviews']) {
    res = await call('GET', `/api/admin/hq/crm/${name}?limit=50`, ['crm', name])
    assert.equal(res.status, 200, name)
  }
  // Known query keys pass, others are dropped before HQ.
  res = await call('GET', '/api/admin/hq/crm/prospects?status=new&niche=barber&q=bro&cursor=7&limit=5&evil=1', ['crm', 'prospects'])
  assert.equal(res.status, 200)
  const last = new URL(seen.at(-1).url)
  assert.equal(last.pathname, '/admin/crm/prospects')
  assert.deepEqual([...last.searchParams.keys()].sort(), ['cursor', 'limit', 'niche', 'q', 'status'])
  res = await call('POST', '/api/admin/hq/crm/prospects/7', ['crm', 'prospects', '7'], { body: { status: 'proposed', note: 'ok' } })
  assert.equal(res.status, 200)
  assert.equal(seen.at(-1).method, 'POST')
  res = await call('POST', '/api/admin/hq/crm/tickets/3', ['crm', 'tickets', '3'], { body: { status: 'answered' } })
  assert.equal(res.status, 200)
  const count = seen.length
  const cases = [
    ['GET', ['crm']],
    ['GET', ['crm', 'secrets']],
    ['GET', ['crm', 'prospects', '7']],
    ['POST', ['crm', 'prospects'], { status: 'new' }],
    ['POST', ['crm', 'prospects', 'abc'], { status: 'new' }],
    ['POST', ['crm', 'documents', '1'], { note: 'x' }],
    ['POST', ['crm', 'summary'], {}],
  ]
  for (const [method, segs, body] of cases) {
    res = await call(method, `/api/admin/hq/${segs.join('/')}`, segs, body === undefined ? {} : { body })
    assert.equal(res.status, 404, `${method} ${segs.join('/')}`)
  }
  // Bad bodies are 400 and never reach HQ: unknown status, reply, extra field, empty body, long note.
  const bad = [{ status: 'bogus' }, { status: 'sent', reply: 'x' }, { reply: 'x' }, {}, { note: 'x'.repeat(2001) }, { status: 5 }]
  for (const body of bad) {
    res = await call('POST', '/api/admin/hq/crm/prospects/7', ['crm', 'prospects', '7'], { body })
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40))
  }
  res = await call('POST', '/api/admin/hq/crm/tickets/3', ['crm', 'tickets', '3'], { body: { status: 'replied' } })
  assert.equal(res.status, 400)
  assert.equal(seen.length, count)
  // No session, no CRM.
  res = await call('GET', '/api/admin/hq/crm/summary', ['crm', 'summary'], { cookie: null })
  assert.equal(res.status, 401)
  res = await call('POST', '/api/admin/hq/crm/prospects/7', ['crm', 'prospects', '7'], { body: { note: 'x' }, origin: 'https://evil.example' })
  assert.equal(res.status, 403)
})

test('proxy: CRM falls back to the mock without HQ_ADMIN_URL, and keeps its 5 s timeout setting', async () => {
  const res = await call('GET', '/api/admin/hq/crm/prospects', ['crm', 'prospects'])
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.available, true)
  assert.ok(body.items.length >= 5)
  assert.equal(proxy.HQ_ADMIN_TIMEOUT_MS, 5000)
})
