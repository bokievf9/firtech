import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier === 'next/server' || specifier === 'next/navigation' || specifier === 'next/headers') return next(`${specifier}.js`, context)
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

delete process.env.HQ_CHAT_URL
const chat = await import('../src/lib/chat.ts')
const hq = await import('../src/lib/chat-hq.ts')
const { getDict } = await import('../src/content/index.ts')
const route = await import('../src/app/api/chat/route.ts')

const SID = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b'
let ipSeq = 0
const freshIp = () => `10.0.0.${++ipSeq}`

function post(body, ip = freshIp()) {
  return route.POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': ip },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

const req = (message, extra = {}) => ({ sessionId: SID, locale: 'ru', message, page: '/ru', ...extra })

test('validation: uuid session, locale, 1..1000 chars after stripping, page path only', () => {
  const ok = chat.chatRequestSchema.safeParse(req('Нужен бот', { page: '/ru/builder?b=x#y' }))
  assert.ok(ok.success)
  assert.equal(ok.data.page, '/ru/builder')
  assert.equal(chat.chatRequestSchema.safeParse(req('x', { sessionId: 'nope' })).success, false)
  assert.equal(chat.chatRequestSchema.safeParse(req('x', { locale: 'de' })).success, false)
  assert.equal(chat.chatRequestSchema.safeParse(req('   ')).success, false)
  assert.equal(chat.chatRequestSchema.safeParse(req('<b></b>')).success, false)
  assert.equal(chat.chatRequestSchema.safeParse(req('a'.repeat(1001))).success, false)
  assert.ok(chat.chatRequestSchema.safeParse(req('a'.repeat(1000))).success)
  assert.equal(chat.chatRequestSchema.safeParse(req('x', { page: 'https://evil.test/' })).data.page, '/')
})

test('stripHtml drops tags, brackets and control characters', () => {
  assert.equal(chat.stripHtml('<script>alert(1)</script>Привет <b>мир</b>'), 'alert(1)Привет мир')
  assert.equal(chat.stripHtml('a < b > c'), 'a  c')
  assert.equal(chat.stripHtml('5 > 3'), '5  3')
  assert.equal(chat.stripHtml('line\u0007one\n\n\n\ntwo'), 'lineone\n\ntwo')
})

test('HQ replies are sanitised: html stripped, bad buttons dropped, unknown state is chat', () => {
  const clean = chat.sanitizeReply({
    ok: true,
    reply: '<a href="x">Здравствуйте</a>',
    buttons: [
      { id: 'site', label: '<i>Сайт</i>' },
      { id: 'bad id!', label: 'x' },
      { id: 'empty', label: '<b></b>' },
      'junk',
    ],
    state: 'weird',
    leadCreated: 'yes',
  })
  assert.deepEqual(clean, { ok: true, reply: 'Здравствуйте', buttons: [{ id: 'site', label: 'Сайт' }], state: 'chat' })
  assert.equal(chat.sanitizeReply({ ok: true, reply: '' }), null)
  assert.equal(chat.sanitizeReply('nope'), null)
  assert.deepEqual(chat.sanitizeReply({ ok: false, error: 'busy' }), { ok: false, error: 'busy' })
  assert.equal(chat.sanitizeReply({ ok: true, reply: 'x', state: 'done', leadCreated: true }).leadCreated, true)
})

test('mock flow: greeting, what, deadline, budget, contact, thanks', () => {
  const copy = getDict('ru').chat.mock
  const mock = chat.createMockReceptionist(() => 1000)
  const say = (message) => mock({ sessionId: SID, message }, copy)

  const hello = say(chat.START)
  assert.equal(hello.reply, copy.greeting)
  assert.equal(hello.state, 'chat')
  assert.deepEqual(hello.buttons.map((b) => b.id), ['site', 'bot', 'agent', 'other'])

  const deadline = say(chat.btnMessage('bot'))
  assert.equal(deadline.reply, copy.askDeadline)
  assert.equal(deadline.state, 'intake')
  const budget = say('через месяц')
  assert.equal(budget.reply, copy.askBudget)
  const contact = say(chat.btnMessage('m'))
  assert.equal(contact.state, 'contact')
  assert.equal(contact.reply, copy.askContact)

  assert.equal(say('не скажу').reply, copy.badContact)
  const done = say('@madina_cafe')
  assert.equal(done.reply, 'Спасибо. Первый ответ за 5 минут, круглосуточно; цены и сроки подтверждает основатель.')
  assert.equal(done.state, 'done')
  assert.notEqual(done.leadCreated, true, 'the mock never claims a lead')
  assert.equal(say('ещё вопрос').reply, copy.after)
  assert.equal(say(chat.btnMessage('restart')).reply, copy.greeting)
})

test('contact detection', () => {
  for (const ok of ['@madina_cafe', 'мой телеграм @rustam92', '+992 93 123 45 67', 'a@b.tj', 't.me/firtech_bot']) {
    assert.ok(chat.looksLikeContact(ok), ok)
  }
  for (const no of ['завтра', '@ab', '123']) assert.equal(chat.looksLikeContact(no), false, no)
})

test('route: mock mode answers the greeting in both locales and marks the mode', async () => {
  const res = await post(req(chat.START, { sessionId: '11111111-2222-4333-8444-555555555555' }))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('x-chat-mode'), 'mock')
  const body = await res.json()
  assert.equal(body.reply, getDict('ru').chat.mock.greeting)
  const en = await (await post(req(chat.START, { locale: 'en', sessionId: '11111111-2222-4333-8444-666666666666' }))).json()
  assert.equal(en.reply, getDict('en').chat.mock.greeting)
})

test('route: invalid bodies are 400', async () => {
  assert.equal((await post('not json')).status, 400)
  assert.equal((await post(req(''))).status, 400)
  assert.equal((await post({ ...req('hi'), sessionId: '1' })).status, 400)
})

test('route: 30 messages per IP per hour, then 429', async () => {
  const ip = freshIp()
  for (let i = 0; i < hq.CHAT_LIMIT; i++) {
    const res = await post(req(chat.START), ip)
    assert.equal(res.status, 200, `message ${i + 1}`)
  }
  const blocked = await post(req(chat.START), ip)
  assert.equal(blocked.status, 429)
  assert.equal((await blocked.json()).error, 'rate_limited')
  // Another visitor is not affected.
  assert.equal((await post(req(chat.START))).status, 200)
})

test('limiter window slides', () => {
  const limited = hq.createLimiter(2, 1000)
  assert.equal(limited('a', 0), false)
  assert.equal(limited('a', 10), false)
  assert.equal(limited('a', 20), true)
  assert.equal(limited('a', 1011), false)
})

test('HQ mode: contract request with the chat token, LEAD_INTAKE_TOKEN as fallback, errors mapped', async () => {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) })
    return Response.json({ ok: true, reply: 'Здравствуйте!', buttons: [{ id: 'site', label: 'Сайт' }], state: 'chat' })
  }
  const r = chat.chatRequestSchema.parse(req('Привет'))
  const answer = await hq.askReceptionist(r, { HQ_CHAT_URL: 'http://hq.test/chat', HQ_CHAT_TOKEN: 'chat-tok' }, fetcher)
  assert.deepEqual(answer, { ok: true, reply: 'Здравствуйте!', buttons: [{ id: 'site', label: 'Сайт' }], state: 'chat' })
  assert.equal(calls[0].url, 'http://hq.test/chat')
  assert.equal(calls[0].headers['x-chat-token'], 'chat-tok')
  assert.deepEqual(calls[0].body, { sessionId: SID, locale: 'ru', message: 'Привет', page: '/ru' })

  await hq.askReceptionist(r, { HQ_CHAT_URL: 'http://hq.test/chat', LEAD_INTAKE_TOKEN: 'lead-tok' }, fetcher)
  assert.equal(calls[1].headers['x-chat-token'], 'lead-tok')

  // Production without HQ_CHAT_URL talks to the loopback default, never to the mock.
  await hq.askReceptionist(r, { NODE_ENV: 'production' }, fetcher)
  assert.equal(calls[2].url, 'http://127.0.0.1:8787/chat')

  const env = { HQ_CHAT_URL: 'http://hq.test/chat' }
  assert.deepEqual(await hq.askReceptionist(r, env, async () => new Response('', { status: 401 })), { ok: false, error: 'hq_unauthorized' })
  assert.deepEqual(await hq.askReceptionist(r, env, async () => new Response('<html>', { status: 500 })), { ok: false, error: 'hq_error' })
  assert.deepEqual(await hq.askReceptionist(r, env, async () => { throw new TypeError('down') }), { ok: false, error: 'hq_unreachable' })
  const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' })
  assert.deepEqual(await hq.askReceptionist(r, env, async () => { throw timeout }), { ok: false, error: 'hq_timeout' })
})

test('route: with the cabinet on, a contact from a signed-out visitor is not forwarded', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  try {
    const res = await post({ sessionId: SID, locale: 'ru', message: '@alice_b', page: '/ru' })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.authRequired, true)
    assert.equal(body.state, 'contact')
    assert.equal(body.reply, getDict('ru').chat.signInFirst)
    // Plain questions still reach the receptionist.
    const q = await (await post({ sessionId: SID, locale: 'ru', message: 'Сколько стоит сайт?', page: '/ru' })).json()
    assert.notEqual(q.authRequired, true)
  } finally {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }
})

test('first-reply promise is one sentence everywhere: 5 minutes, no «рабочего дня» (the free audit keeps its own deliverable)', () => {
  const promise = {
    ru: 'Первый ответ за 5 минут, круглосуточно; цены и сроки подтверждает основатель.',
    en: 'First reply within 5 minutes, around the clock; prices and timelines are confirmed by the founder.',
  }
  for (const locale of ['ru', 'en']) {
    const d = getDict(locale)
    assert.ok(d.chat.mock.thanks.includes(promise[locale]), `${locale} chat.thanks`)
    assert.ok(d.booking.bot.received.includes(promise[locale]), `${locale} booking.bot.received`)
    assert.equal(d.cabinet.leads.defaultNext.new, promise[locale])
    for (const text of [d.chat.mock.thanks, d.booking.bot.received, d.cabinet.leads.defaultNext.new, d.cabinet.leads.pending]) {
      assert.doesNotMatch(text, /рабочего дня|working day|скоро ответит|answer soon/i, `${locale}: ${text}`)
    }
  }
  assert.match(getDict('ru').cabinet.leads.pending, /5 минут/)
  assert.match(getDict('en').cabinet.leads.pending, /5 minutes/)
  assert.match(getDict('ru').auditPage.successText, /рабочего дня/)
})
