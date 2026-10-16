import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, beforeEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Same mapping as telegram.test.mjs: 'server-only', '@/...' and 'next/server' for plain Node.
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

const OWNER = 1000
process.env.TELEGRAM_BOT_TOKEN = 'test-token'
process.env.TELEGRAM_CHAT_ID = String(OWNER)
process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook-secret'

const root = await mkdtemp(path.join(tmpdir(), 'firtech-admin-test-'))
let dirCount = 0
after(() => rm(root, { recursive: true, force: true }))

// Fake Bot API: records calls, never leaves the process.
let calls = []
let telegramDown = false
let messageId = 100
globalThis.fetch = async (url, init) => {
  assert.match(String(url), /^https:\/\/api\.telegram\.org\/bottest-token\//)
  const method = String(url).split('/').pop()
  calls.push({ method, body: JSON.parse(init.body) })
  if (telegramDown) throw new TypeError('fetch failed')
  return Response.json({
    ok: true,
    result: method === 'sendMessage' ? { message_id: ++messageId } : true,
  })
}
const sent = (method) => calls.filter((c) => c.method === method)

beforeEach(() => {
  process.env.DATA_DIR = path.join(root, `d${++dirCount}`)
  calls = []
  telegramDown = false
})

const auth = await import('../src/lib/admin-auth.ts')
const data = await import('../src/lib/admin-data.ts')
const store = await import('../src/lib/store.ts')
const { leadSchema } = await import('../src/lib/lead.ts')
const codeRoute = await import('../src/app/api/admin/code/route.ts')
const loginRoute = await import('../src/app/api/admin/login/route.ts')
const logoutRoute = await import('../src/app/api/admin/logout/route.ts')
const leadRoute = await import('../src/app/api/admin/leads/[id]/route.ts')
const exportRoute = await import('../src/app/api/admin/export/route.ts')
const webhook = await import('../src/app/api/telegram/route.ts')

const ORIGIN = 'http://localhost'
function request(url, { method = 'POST', body, cookie, origin = ORIGIN } = {}) {
  const headers = { host: 'localhost', 'content-type': 'application/json' }
  if (origin) headers.origin = origin
  if (cookie) headers.cookie = `${auth.SESSION_COOKIE}=${cookie}`
  return new Request(`${ORIGIN}${url}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}
const sentCode = () =>
  sent('sendMessage')
    .at(-1)
    .body.text.match(/(\d{6})/)[1]

async function login() {
  await codeRoute.POST(request('/api/admin/code'))
  const response = await loginRoute.POST(
    request('/api/admin/login', { body: { code: sentCode() } }),
  )
  assert.equal(response.status, 200)
  const cookie = response.headers.get('set-cookie')
  return cookie.match(new RegExp(`${auth.SESSION_COOKIE}=([^;]+)`))[1]
}
const leadParams = (id) => ({ params: Promise.resolve({ id: String(id) }) })
const lead = (extra = {}) =>
  leadSchema.parse({ name: 'Демо Клиент', contact: '@demo_client', ...extra })

test('code: sent to the owner chat only, works once, opens a session', async () => {
  const response = await codeRoute.POST(request('/api/admin/code'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
  const [message] = sent('sendMessage')
  assert.equal(message.body.chat_id, String(OWNER))
  assert.match(
    message.body.text,
    /^Код для входа в панель Fir Tech: <code>\d{6}<\/code>\. Если это не вы, ничего не делайте\.$/,
  )

  // Only hashes on disk: the code itself is not in the file.
  const file = await readFile(path.join(process.env.DATA_DIR, 'admin.json'), 'utf8')
  assert.equal(file.includes(sentCode()), false)

  const wrong = sentCode() === '000000' ? '111111' : '000000'
  assert.deepEqual(await auth.verifyCode(wrong), { ok: false, error: 'wrong', attemptsLeft: 4 })
  const ok = await auth.verifyCode(sentCode())
  assert.equal(ok.ok, true)
  assert.equal(await auth.isValidSession(ok.token), true)
  assert.deepEqual(await auth.verifyCode(sentCode()), { ok: false, error: 'no_code' })
})

test('code: five wrong attempts burn it, the right code no longer works', async () => {
  const issued = await auth.issueCode()
  const wrong = issued.code === '000000' ? '111111' : '000000'
  for (let left = 4; left >= 1; left--) {
    assert.deepEqual(await auth.verifyCode(wrong), {
      ok: false,
      error: 'wrong',
      attemptsLeft: left,
    })
  }
  assert.deepEqual(await auth.verifyCode(wrong), { ok: false, error: 'locked' })
  assert.deepEqual(await auth.verifyCode(issued.code), { ok: false, error: 'no_code' })
})

test('code: expires after 5 minutes', async () => {
  const t0 = Date.now()
  const issued = await auth.issueCode(t0)
  assert.deepEqual(await auth.verifyCode(issued.code, t0 + auth.CODE_TTL_MS + 1), {
    ok: false,
    error: 'expired',
  })
  const fresh = await auth.issueCode(t0 + 61_000)
  assert.equal((await auth.verifyCode(fresh.code, t0 + 61_000 + auth.CODE_TTL_MS - 1)).ok, true)
})

test('code: one per minute, ten per hour', async () => {
  const t0 = Date.now() - 3 * 60 * 60_000
  assert.equal((await auth.issueCode(t0)).ok, true)
  assert.deepEqual(await auth.issueCode(t0 + 30_000), {
    ok: false,
    error: 'too_soon',
    retryAfter: 30,
  })
  for (let i = 1; i < 10; i++) assert.equal((await auth.issueCode(t0 + i * 61_000)).ok, true)
  const blocked = await auth.issueCode(t0 + 10 * 61_000)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.error, 'too_many')
  assert.equal(blocked.retryAfter, 3600 - 610)
  assert.equal((await auth.issueCode(t0 + 60 * 60_000 + 1)).ok, true)

  // The route answers 429 and the Telegram message is not sent again.
  calls = []
  const response = await codeRoute.POST(request('/api/admin/code'))
  assert.equal(response.status, 200)
  const again = await codeRoute.POST(request('/api/admin/code'))
  assert.equal(again.status, 429)
  assert.equal(sent('sendMessage').length, 1)
})

test('code: Telegram down means no usable code', async () => {
  telegramDown = true
  const response = await codeRoute.POST(request('/api/admin/code'))
  assert.equal(response.status, 503)
  assert.equal((await response.json()).error, 'send_failed')
  assert.deepEqual(await auth.verifyCode('123456'), { ok: false, error: 'no_code' })
})

test('login: cookie is httpOnly, strict, 30 days', async () => {
  await codeRoute.POST(request('/api/admin/code'))
  const response = await loginRoute.POST(
    request('/api/admin/login', { body: { code: sentCode() } }),
  )
  const cookie = response.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=strict/i)
  assert.match(cookie, /Path=\//)
  const expires = Date.parse(cookie.match(/Expires=([^;]+)/i)[1])
  assert.ok(Math.abs(expires - (Date.now() + auth.SESSION_TTL_MS)) < 60_000)
})

test('session: missing, unknown, expired and revoked cookies are rejected', async () => {
  const exportReq = (cookie) =>
    exportRoute.GET(request('/api/admin/export', { method: 'GET', cookie }))
  assert.equal((await exportReq()).status, 401)
  assert.equal((await exportReq('not-a-session')).status, 401)

  const token = await login()
  assert.equal((await exportReq(token)).status, 200)
  assert.equal(await auth.isValidSession(token, Date.now() + auth.SESSION_TTL_MS + 1), false)

  const other = await (async () => {
    await new Promise((r) => setTimeout(r, 0))
    const issued = await auth.issueCode(Date.now() + 61_000)
    return (await auth.verifyCode(issued.code, Date.now() + 61_000)).token
  })()

  // "Выйти" ends only this session.
  const out = await logoutRoute.POST(request('/api/admin/logout', { body: {}, cookie: token }))
  assert.equal(out.status, 200)
  assert.match(out.headers.get('set-cookie'), /Max-Age=0|Expires=Thu, 01 Jan 1970/i)
  assert.equal((await exportReq(token)).status, 401)
  assert.equal((await exportReq(other)).status, 200)

  // "Выйти на всех устройствах" ends all of them.
  await logoutRoute.POST(request('/api/admin/logout', { body: { all: true }, cookie: other }))
  assert.equal((await exportReq(other)).status, 401)
})

test('POST needs the same origin, even with a valid session', async () => {
  const token = await login()
  const stored = await store.createLead(lead())
  const body = { action: 'status', status: 'won' }
  for (const origin of [null, 'https://evil.example']) {
    const response = await leadRoute.POST(
      request(`/api/admin/leads/${stored.id}`, { body, cookie: token, origin }),
      leadParams(stored.id),
    )
    assert.equal(response.status, 403)
  }
  assert.equal((await codeRoute.POST(request('/api/admin/code', { origin: null }))).status, 403)
  assert.equal((await store.getLead(stored.id)).status, 'new')
})

test('lead route: status updates the store and edits the owner Telegram message', async () => {
  const token = await login()
  const stored = await store.createLead(lead())
  await store.updateLead(stored.id, (l) => {
    l.ownerMessageId = 77
    l.notified = true
  })
  calls = []
  const response = await leadRoute.POST(
    request(`/api/admin/leads/${stored.id}`, {
      body: { action: 'status', status: 'won' },
      cookie: token,
    }),
    leadParams(stored.id),
  )
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.lead.status, 'won')
  assert.equal(result.lead.ownerMessageId, undefined)
  assert.equal((await store.getLead(stored.id)).status, 'won')
  const [edit] = sent('editMessageText')
  assert.equal(edit.body.chat_id, String(OWNER))
  assert.equal(edit.body.message_id, 77)
  assert.match(edit.body.text, /Статус:<\/b> Сделка/)
  assert.ok(edit.body.reply_markup.inline_keyboard.flat().some((b) => b.text === '[Сделка]'))

  // Telegram down: the store still changes, the panel gets a warning.
  telegramDown = true
  const down = await leadRoute.POST(
    request(`/api/admin/leads/${stored.id}`, {
      body: { action: 'status', status: 'lost' },
      cookie: token,
    }),
    leadParams(stored.id),
  )
  const downBody = await down.json()
  assert.equal(downBody.warning, 'telegram_failed')
  assert.equal((await store.getLead(stored.id)).status, 'lost')
})

test('lead route: notes stay private, booking confirm works like the bot button', async () => {
  const token = await login()
  const slot = '2026-10-19T09:30:00.000Z'
  const stored = await store.createLead(lead(), slot)
  await store.updateLead(stored.id, (l) => {
    l.ownerMessageId = 80
  })
  calls = []
  const post = (body) =>
    leadRoute.POST(
      request(`/api/admin/leads/${stored.id}`, { body, cookie: token }),
      leadParams(stored.id),
    )

  await post({ action: 'notes', notes: '  Перезвонить в понедельник  ' })
  assert.equal((await store.getLead(stored.id)).notes, 'Перезвонить в понедельник')
  assert.equal(calls.length, 0)

  const ok = await (await post({ action: 'booking', op: 'ok' })).json()
  assert.equal(ok.lead.booking.state, 'confirmed')
  assert.match(sent('editMessageText')[0].body.text, /подтверждён/)

  const move = await (await post({ action: 'booking', op: 'move' })).json()
  assert.equal(move.lead.booking.state, 'released')
  assert.deepEqual(await store.bookedSlots(), [])

  assert.equal((await post({ action: 'status', status: 'nope' })).status, 400)
  const missing = await leadRoute.POST(
    request('/api/admin/leads/999', { body: { action: 'status', status: 'won' }, cookie: token }),
    leadParams(999),
  )
  assert.equal(missing.status, 404)
})

test('bot: /admin replies with the panel link, only to the owner', async () => {
  const post = (chatId) =>
    webhook.POST(
      new Request('http://localhost/api/telegram', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-bot-api-secret-token': 'test-webhook-secret',
        },
        body: JSON.stringify({ message: { message_id: 1, chat: { id: chatId }, text: '/admin' } }),
      }),
    )
  await post(42)
  assert.equal(sent('sendMessage').length, 0)
  await post(OWNER)
  assert.match(sent('sendMessage')[0].body.text, /https:\/\/firtech\.pro\/admin$/)
})

test('csv: quotes, commas, line breaks and formula cells are escaped', () => {
  assert.equal(data.csvCell('plain'), 'plain')
  assert.equal(data.csvCell('a,b'), '"a,b"')
  assert.equal(data.csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(data.csvCell('line1\nline2'), '"line1\nline2"')
  assert.equal(data.csvCell('=SUM(A1)'), "'=SUM(A1)")
  assert.equal(data.csvCell('+992 900'), "'+992 900")
  assert.equal(data.csvCell('-5'), "'-5")
  assert.equal(data.csvCell('@user'), "'@user")
  assert.equal(data.csvCell('=HYPERLINK("x","y")'), `"'=HYPERLINK(""x"",""y"")"`)
  assert.equal(data.csvCell(null), '')
  assert.equal(data.csvCell(7), '7')
  const csv = data.toCsv([
    ['№', 'Имя'],
    [1, 'Демо, Клиент'],
  ])
  assert.equal(csv, '﻿№,Имя\r\n1,"Демо, Клиент"\r\n')
})

test('export route: BOM, header and one row per lead', async () => {
  const token = await login()
  await store.createLead(lead({ message: 'Нужен сайт, "срочно"\nи бот' }))
  await store.createLead(lead({ name: 'Демо Клиент 2', contact: '+992 900 00 00 00' }))
  const response = await exportRoute.GET(
    request('/api/admin/export', { method: 'GET', cookie: token }),
  )
  assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8')
  assert.match(response.headers.get('content-disposition'), /attachment; filename="firtech-leads-/)
  const bytes = new Uint8Array(await response.arrayBuffer())
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf])
  const text = new TextDecoder().decode(bytes.slice(3))
  assert.ok(text.startsWith('№,Создана (Душанбе),Статус,Имя,Контакт'))
  assert.match(text, /\r\n2,[^\r]*Демо Клиент 2,'\+992 900 00 00 00,/)
  assert.match(text, /"Нужен сайт, ""срочно""\nи бот"/)
})

test('stats: counts by day, funnel, conversion, services, calls and overdue leads', () => {
  // 2026-10-16 15:00 in Dushanbe (UTC+5).
  const now = Date.parse('2026-10-16T10:00:00Z')
  const h = 3_600_000
  const at = (hoursAgo) => new Date(now - hoursAgo * h).toISOString()
  const leads = [
    {
      id: 1,
      name: 'Демо Клиент 1',
      contact: '@a',
      createdAt: at(1),
      status: 'new',
      service: 'websites',
    },
    {
      id: 2,
      name: 'Демо Клиент 2',
      contact: '@b',
      createdAt: at(14),
      status: 'taken',
      service: 'bots',
    },
    // 16 hours ago is 23:00 the day before in Dushanbe: not today.
    {
      id: 3,
      name: 'Демо Клиент 3',
      contact: '@c',
      createdAt: at(16),
      status: 'new',
      service: 'bots',
    },
    {
      id: 4,
      name: 'Демо Клиент 4',
      contact: '@d',
      createdAt: at(30),
      status: 'won',
      service: 'websites',
    },
    {
      id: 5,
      name: 'Демо Клиент 5',
      contact: '@e',
      createdAt: at(24 * 6),
      status: 'lost',
      service: 'bundle',
    },
    {
      id: 6,
      name: 'Демо Клиент 6',
      contact: '@f',
      createdAt: at(24 * 6 + 12),
      status: 'won',
      service: 'websites',
    },
    {
      id: 7,
      name: 'Демо Клиент 7',
      contact: '@g',
      createdAt: at(24 * 20),
      status: 'new',
      service: 'apps',
    },
    {
      id: 8,
      name: 'Демо Клиент 8',
      contact: '@h',
      createdAt: at(24 * 40),
      status: 'called',
      service: 'websites',
    },
  ].map((l) => ({ ...l, booking: undefined }))
  leads[1].booking = { slot: new Date(now + 20 * h).toISOString(), state: 'pending' }
  leads[3].booking = { slot: new Date(now + 2 * h).toISOString(), state: 'confirmed' }
  leads[4].booking = { slot: new Date(now + 3 * h).toISOString(), state: 'released' }
  leads[5].booking = { slot: new Date(now + 24 * 8 * h).toISOString(), state: 'pending' }

  const stats = data.computeStats(leads, now)
  assert.equal(stats.today, 2)
  assert.equal(stats.week, 6)
  assert.equal(stats.month, 7)
  assert.equal(stats.series.length, 30)
  assert.equal(stats.series.at(-1), 2)
  assert.equal(
    stats.series.reduce((a, b) => a + b, 0),
    7,
  )
  assert.deepEqual(
    stats.funnel.map((f) => [f.status, f.count]),
    [
      ['new', 3],
      ['taken', 1],
      ['called', 1],
      ['won', 2],
      ['lost', 1],
    ],
  )
  assert.equal(stats.total, 8)
  assert.equal(stats.conversion, 2 / 8)
  assert.deepEqual(stats.byService[0], { service: 'websites', count: 4 })
  assert.deepEqual(stats.byService[1], { service: 'bots', count: 2 })
  assert.deepEqual(
    stats.upcoming.map((c) => [c.id, c.state]),
    [
      [4, 'confirmed'],
      [2, 'pending'],
    ],
  )
  // New and older than 24 hours, oldest first; lead 3 is only 16 hours old.
  assert.deepEqual(
    stats.stale.map((l) => l.id),
    [7],
  )
  assert.deepEqual(data.computeStats([], now).conversion, 0)
})

test('filters, contact links and calendar', () => {
  const now = Date.parse('2026-10-16T04:00:00Z') // Friday 09:00 in Dushanbe
  const base = {
    budget: '',
    estimate: '',
    locale: 'ru',
    page: '',
    inBot: false,
    status: 'new',
    service: 'websites',
  }
  const leads = [
    {
      ...base,
      id: 1,
      name: 'Демо Клиент 1',
      contact: '@one',
      message: 'лендинг',
      createdAt: '2026-10-16T03:00:00Z',
    },
    {
      ...base,
      id: 2,
      name: 'Демо Клиент 2',
      contact: '+992 900',
      message: 'бот',
      createdAt: '2026-10-10T03:00:00Z',
      status: 'won',
      service: 'bots',
    },
    {
      ...base,
      id: 3,
      name: 'Демо Клиент 3',
      contact: 'mail@x.tj',
      message: '',
      createdAt: '2026-09-01T03:00:00Z',
      notes: 'VIP',
    },
  ]
  const ids = (filter) => data.filterLeads(leads, filter, now).map((l) => l.id)
  assert.deepEqual(ids({}), [1, 2, 3])
  assert.deepEqual(ids({ sort: 'old' }), [3, 2, 1])
  assert.deepEqual(ids({ q: 'БОТ' }), [2])
  assert.deepEqual(ids({ q: 'vip' }), [3])
  assert.deepEqual(ids({ q: '+992' }), [2])
  assert.deepEqual(ids({ status: 'won' }), [2])
  assert.deepEqual(ids({ service: 'websites' }), [1, 3])
  assert.deepEqual(ids({ period: 'today' }), [1])
  assert.deepEqual(ids({ period: '7' }), [1, 2])

  assert.deepEqual(data.contactLinks('@demo_user'), { telegram: 'https://t.me/demo_user' })
  assert.deepEqual(data.contactLinks('t.me/demo_user'), { telegram: 'https://t.me/demo_user' })
  assert.deepEqual(data.contactLinks('+992 (90) 123-45-67'), { phone: 'tel:+992901234567' })
  assert.deepEqual(data.contactLinks('mail@x.tj'), {})
  assert.equal(data.leadPageLink('/ru/builder?b=abc').builder, true)
  assert.equal(data.leadPageLink('/ru/services/bots').builder, false)
  assert.equal(data.leadPageLink(''), null)

  const booked = [
    {
      id: 9,
      name: 'Демо Клиент 9',
      booking: { slot: '2026-10-16T05:00:00.000Z', state: 'pending' },
    },
    {
      id: 10,
      name: 'Демо Клиент 10',
      booking: { slot: '2026-10-19T09:30:00.000Z', state: 'confirmed' },
    },
    {
      id: 11,
      name: 'Демо Клиент 11',
      booking: { slot: '2026-10-19T10:00:00.000Z', state: 'released' },
    },
  ]
  const days = data.calendarDays(booked, now)
  assert.equal(days.length, 10)
  assert.equal(days[0].date, '2026-10-16')
  // Today starts at 10:00, inside the form's 2-hour notice but still shown to the owner.
  assert.equal(days[0].slots.length, 16)
  assert.deepEqual(days[0].slots[0], {
    slot: '2026-10-16T05:00:00.000Z',
    state: 'pending',
    leadId: 9,
    name: 'Демо Клиент 9',
  })
  assert.equal(days[1].date, '2026-10-19')
  const monday = Object.fromEntries(days[1].slots.map((s) => [s.slot, s]))
  assert.equal(monday['2026-10-19T09:30:00.000Z'].state, 'confirmed')
  assert.equal(monday['2026-10-19T10:00:00.000Z'].state, 'free')
})
