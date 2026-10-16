import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, beforeEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

// The server modules import 'server-only', '@/...' and 'next/server'; map them for plain Node.
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
const CLIENT = 555
const SECRET = 'test-webhook-secret'
process.env.TELEGRAM_BOT_TOKEN = 'test-token'
process.env.TELEGRAM_CHAT_ID = String(OWNER)
process.env.TELEGRAM_WEBHOOK_SECRET = SECRET

const root = await mkdtemp(path.join(tmpdir(), 'firtech-test-'))
let dirCount = 0
after(() => rm(root, { recursive: true, force: true }))

// Fake Bot API: records every call; `telegramDown` makes them all fail. Nothing leaves the process.
let calls = []
let telegramDown = false
let messageId = 100
globalThis.fetch = async (url, init) => {
  const method = String(url).split('/').pop()
  assert.match(String(url), /^https:\/\/api\.telegram\.org\/bottest-token\//)
  calls.push({ method, body: JSON.parse(init.body) })
  if (telegramDown) throw new TypeError('fetch failed')
  return Response.json({
    ok: true,
    result: method === 'sendMessage' ? { message_id: ++messageId } : true,
  })
}
const sent = (method) => calls.filter((c) => c.method === method)

beforeEach(async () => {
  // Lets a resend started by the previous test (not awaited by the route) finish in its own folder.
  await new Promise((resolve) => setTimeout(resolve, 30))
  process.env.DATA_DIR = path.join(root, `d${++dirCount}`)
  calls = []
  telegramDown = false
})

const store = await import('../src/lib/store.ts')
const booking = await import('../src/lib/booking.ts')
const telegram = await import('../src/lib/telegram.ts')
const { leadSchema } = await import('../src/lib/lead.ts')
const webhook = await import('../src/app/api/telegram/route.ts')
const leadRoute = await import('../src/app/api/lead/route.ts')

const lead = (extra = {}) => leadSchema.parse({ name: 'Мадина', contact: '@madina', ...extra })
// A Friday morning in Dushanbe: 2026-10-16 09:00 local (UTC+5).
const friday9 = new Date('2026-10-16T04:00:00Z')
const slotAt = (iso) => new Date(iso).toISOString()

let ip = 0
function postLead(body) {
  return leadRoute.POST(
    new Request('http://localhost/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': `10.0.0.${++ip}` },
      body: JSON.stringify(body),
    }),
  )
}
function postUpdate(update, secret = SECRET) {
  const headers = { 'content-type': 'application/json' }
  if (secret !== null) headers['x-telegram-bot-api-secret-token'] = secret
  return webhook.POST(
    new Request('http://localhost/api/telegram', {
      method: 'POST',
      headers,
      body: JSON.stringify(update),
    }),
  )
}
const callback = (data, chatId = OWNER, msg = 77) => ({
  callback_query: {
    id: 'cb1',
    from: { id: chatId },
    data,
    message: { message_id: msg, chat: { id: chatId } },
  },
})

test('store: incrementing ids, statuses, file on disk', async () => {
  const leads = await Promise.all([1, 2, 3, 4, 5].map(() => store.createLead(lead())))
  assert.deepEqual(leads.map((l) => l.id).sort(), [1, 2, 3, 4, 5])
  assert.ok(leads.every((l) => l.status === 'new' && l.notified === false && l.createdAt))
  const updated = await store.updateLead(3, (l) => {
    l.status = 'won'
  })
  assert.equal(updated.status, 'won')
  assert.equal(await store.updateLead(99, () => {}), null)
  const onDisk = JSON.parse(await readFile(path.join(process.env.DATA_DIR, 'leads.json'), 'utf8'))
  assert.equal(onDisk.nextId, 6)
  assert.equal(onDisk.leads.find((l) => l.id === 3).status, 'won')
  assert.equal(onDisk.leads[0].website, undefined)
  assert.deepEqual(
    (await store.listLeads(2)).map((l) => l.id),
    [5, 4],
  )
})

test('store: a slot can be booked once, until it is released', async () => {
  const slot = slotAt('2026-10-19T06:00:00Z')
  const results = await Promise.allSettled([
    store.createLead(lead(), slot),
    store.createLead(lead(), slot),
  ])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.ok(results.find((r) => r.status === 'rejected').reason instanceof store.SlotTakenError)
  assert.deepEqual(await store.bookedSlots(), [slot])

  const first = results.find((r) => r.status === 'fulfilled').value
  await store.updateLead(first.id, (l) => {
    l.booking.state = 'released'
  })
  assert.deepEqual(await store.bookedSlots(), [])
  assert.equal((await store.createLead(lead(), slot)).booking.slot, slot)
})

test('slots: Dushanbe time, weekdays only, 2 hours ahead, 10 working days', () => {
  const days = booking.generateSlots(friday9)
  assert.equal(days.length, 10)
  assert.equal(days[0].date, '2026-10-16')
  // 09:00 now + 2 h: the first slot is 11:00 local = 06:00 UTC; the day ends with 17:30.
  assert.equal(days[0].slots[0], '2026-10-16T06:00:00.000Z')
  assert.equal(days[0].slots.at(-1), '2026-10-16T12:30:00.000Z')
  assert.equal(days[1].date, '2026-10-19')
  assert.equal(days[1].slots.length, 16)
  assert.equal(days[1].slots[0], '2026-10-19T05:00:00.000Z')
  for (const day of days) {
    const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay()
    assert.ok(weekday >= 1 && weekday <= 5, `${day.date} is a weekend`)
  }
  assert.equal(days.at(-1).date, '2026-10-29')

  // Friday 16:30 local: nothing left today, so the 10 days start on Monday.
  const late = booking.generateSlots(new Date('2026-10-16T11:30:00Z'))
  assert.equal(late[0].date, '2026-10-19')
  assert.equal(late.length, 10)
  // Saturday: starts on Monday too.
  assert.equal(booking.generateSlots(new Date('2026-10-17T05:00:00Z'))[0].date, '2026-10-19')

  // Booked slots are left out; a day with every slot booked disappears.
  const taken = booking.generateSlots(friday9, ['2026-10-16T06:00:00.000Z'])
  assert.equal(taken[0].slots[0], '2026-10-16T06:30:00.000Z')
  assert.equal(booking.generateSlots(friday9, days[0].slots)[0].date, '2026-10-19')

  assert.ok(booking.isFreeSlot('2026-10-19T05:00:00.000Z', friday9))
  assert.ok(!booking.isFreeSlot('2026-10-16T05:00:00.000Z', friday9)) // too soon
  assert.ok(!booking.isFreeSlot('2026-10-19T05:10:00.000Z', friday9)) // not on the grid
  assert.ok(!booking.isFreeSlot('2026-10-17T05:00:00.000Z', friday9)) // Saturday

  assert.equal(booking.formatSlot('2026-10-16T09:30:00.000Z'), 'пт 16.10, 14:30 (Душанбе)')
  assert.equal(booking.formatSlot('2026-10-16T09:30:00.000Z', 'en'), 'Fri 16.10, 14:30 (Dushanbe)')
  assert.equal(booking.formatSlotDate('2026-10-19', 'ru'), 'пн 19.10')
})

test('start token: HMAC of the id, tied to the secret', () => {
  const token = telegram.leadToken(7)
  assert.match(token, /^[0-9a-f]{12}$/)
  assert.ok(telegram.verifyLeadToken(7, token))
  assert.ok(!telegram.verifyLeadToken(8, token))
  assert.ok(!telegram.verifyLeadToken(7, telegram.leadToken(7, 'other-secret')))
  assert.ok(!telegram.verifyLeadToken(7, 'ж'.repeat(6)))
  assert.equal(telegram.leadToken(7, ''), '')
  assert.ok(!telegram.verifyLeadToken(7, '', ''))
})

test('webhook: rejects a missing or wrong secret', async () => {
  assert.equal((await postUpdate({ message: { text: '/leads' } }, null)).status, 401)
  assert.equal((await postUpdate({ message: { text: '/leads' } }, 'wrong')).status, 401)
  assert.equal(calls.length, 0)
})

test('webhook: buttons and /leads only work in the owner chat', async () => {
  const stored = await store.createLead(lead())
  const response = await postUpdate(callback(`st:${stored.id}:won`, 42))
  assert.equal(response.status, 200)
  assert.equal((await store.getLead(stored.id)).status, 'new')
  assert.equal(sent('answerCallbackQuery')[0].body.text, 'Нет доступа')
  assert.equal(sent('editMessageText').length, 0)

  await postUpdate({ message: { message_id: 1, chat: { id: 42 }, text: '/leads' } })
  assert.equal(sent('sendMessage').length, 0)
})

test('webhook: owner changes the status, the message is edited with buttons kept', async () => {
  const stored = await store.createLead(lead())
  await postUpdate(callback(`st:${stored.id}:taken`))
  assert.equal((await store.getLead(stored.id)).status, 'taken')
  const [edit] = sent('editMessageText')
  assert.equal(edit.body.message_id, 77)
  assert.match(edit.body.text, /Статус:<\/b> Взял в работу/)
  const buttons = edit.body.reply_markup.inline_keyboard.flat().map((b) => b.text)
  assert.deepEqual(buttons, ['[Взял]', 'Созвонились', 'Сделка', 'Отказ'])
  assert.match(sent('answerCallbackQuery')[0].body.text, /Взял в работу/)

  calls = []
  await postUpdate({ message: { message_id: 2, chat: { id: OWNER }, text: '/leads' } })
  assert.match(
    sent('sendMessage')[0].body.text,
    /№1 · Мадина · Не знает, нужна консультация · Взял в работу/,
  )
})

test('webhook: client links via /start, gets updates on the booking', async () => {
  const slot = '2026-10-19T09:30:00.000Z'
  const stored = await store.createLead(lead({ locale: 'en' }), slot)
  await store.updateLead(stored.id, (l) => {
    l.ownerMessageId = 300
  })

  // A guessed token does nothing.
  await postUpdate({
    message: { message_id: 1, chat: { id: CLIENT }, text: `/start lead_${stored.id}_000000000000` },
  })
  assert.equal((await store.getLead(stored.id)).clientChatId, undefined)
  // Unknown visitor without a language code: Russian.
  assert.match(sent('sendMessage')[0].body.text, /Ссылка не подошла/)

  calls = []
  const start = `/start lead_${stored.id}_${telegram.leadToken(stored.id)}`
  await postUpdate({ message: { message_id: 2, chat: { id: CLIENT }, text: start } })
  assert.equal((await store.getLead(stored.id)).clientChatId, CLIENT)
  const [toClient, toOwner] = sent('sendMessage')
  assert.equal(toClient.body.chat_id, CLIENT)
  assert.match(toClient.body.text, /Request #1 received/)
  assert.match(toClient.body.text, /Mon 19\.10, 14:30 \(Dushanbe\), waiting for confirmation/)
  assert.equal(toOwner.body.chat_id, String(OWNER))
  assert.equal(toOwner.body.text, 'Клиент по заявке №1 подключился к боту')
  assert.equal(sent('editMessageText')[0].body.message_id, 300)

  calls = []
  await postUpdate(callback(`bk:${stored.id}:ok`))
  assert.equal((await store.getLead(stored.id)).booking.state, 'confirmed')
  assert.match(sent('sendMessage')[0].body.text, /confirmed: Mon 19\.10, 14:30/)
  const kb = sent('editMessageText')[0]
    .body.reply_markup.inline_keyboard.flat()
    .map((b) => b.text)
  assert.ok(kb.includes('Перенести') && !kb.includes('Подтвердить'))

  calls = []
  await postUpdate(callback(`bk:${stored.id}:move`))
  assert.equal((await store.getLead(stored.id)).booking.state, 'released')
  assert.deepEqual(await store.bookedSlots(), [])
  assert.match(sent('sendMessage')[0].body.text, /suggest another time/)
  assert.match(sent('editMessageText')[0].body.text, /перенос, время освобождено/)
})

test('lead route: the lead is stored and sent with buttons', async () => {
  const response = await postLead({ name: 'Ali', contact: '@ali', service: 'bots' })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.id, 1)
  assert.equal(body.token, telegram.leadToken(1))
  const [message] = sent('sendMessage')
  assert.match(message.body.text, /Заявка №1 с сайта Fir Tech/)
  assert.equal(message.body.reply_markup.inline_keyboard[0][0].callback_data, 'st:1:taken')
  const saved = await store.getLead(1)
  assert.equal(saved.notified, true)
  assert.equal(saved.ownerMessageId, messageId)
})

test('lead route: still succeeds when Telegram is down, and resends later', async () => {
  telegramDown = true
  const errors = []
  const original = console.error
  console.error = (...args) => errors.push(args)
  try {
    const response = await postLead({ name: 'Ali', contact: '@ali' })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).id, 1)
  } finally {
    console.error = original
  }
  assert.ok(errors.length > 0)
  assert.equal((await store.getLead(1)).notified, false)

  telegramDown = false
  calls = []
  await postLead({ name: 'Bek', contact: '@bek' })
  // The resend runs after the response; give it a moment.
  for (let i = 0; i < 50 && !(await store.getLead(1)).notified; i++)
    await new Promise((r) => setTimeout(r, 10))
  assert.equal((await store.getLead(1)).notified, true)
  assert.ok(sent('sendMessage').some((c) => /Отправлено с задержкой/.test(c.body.text)))
})

test('lead route: error only when both storage and Telegram fail', async () => {
  // DATA_DIR pointing at a file: every read and write fails.
  const file = path.join(root, `broken-${dirCount}`)
  await writeFile(file, 'x')
  process.env.DATA_DIR = file
  const original = console.error
  console.error = () => {}
  try {
    const stored = await postLead({ name: 'Ali', contact: '@ali' })
    assert.equal(stored.status, 200)
    assert.deepEqual(await stored.json(), { ok: true })
    assert.match(sent('sendMessage')[0].body.text, /не сохранилась на сайте/)

    telegramDown = true
    const failed = await postLead({ name: 'Ali', contact: '@ali' })
    assert.equal(failed.status, 502)
  } finally {
    console.error = original
  }
})

test('lead route: a call slot must be free right now', async () => {
  const response = await postLead({
    name: 'Ali',
    contact: '@ali',
    slot: '2020-01-06T05:00:00.000Z',
  })
  assert.equal(response.status, 409)
  assert.equal((await store.listLeads()).length, 0)

  const [day] = booking.generateSlots(new Date())
  const slot = day.slots[0]
  const ok = await postLead({ name: 'Ali', contact: '@ali', slot })
  assert.equal((await ok.json()).slot, slot)
  assert.match(sent('sendMessage')[0].body.text, /Созвон:<\/b> .+ \(Душанбе\) - ждёт подтверждения/)
  assert.equal(sent('sendMessage')[0].body.reply_markup.inline_keyboard[2][0].text, 'Подтвердить')

  assert.equal((await postLead({ name: 'Bek', contact: '@bek', slot })).status, 409)
})
