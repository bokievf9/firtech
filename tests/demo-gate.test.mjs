// Demo only for signed-in clients and per-client usage (owner review 2026-11-23, item 15): the identity fields HQ gets,
// HQ's `usage`, the way back from the sign-in page, the dev counter, the demo page proxy and the copy.
import assert from 'node:assert/strict'
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
        } catch {}
      }
    }
    return next(specifier, context)
  },
})

const gate = await import('../src/lib/demo-gate.ts')
const chat = await import('../src/lib/chat.ts')
const demo = await import('../src/lib/demo-chat.ts')
const { agentChatUrl } = await import('../src/lib/agent-demo.ts')
const { safeNextPath } = await import('../src/lib/cabinet-auth.ts')
const { getDict } = await import('../src/content/index.ts')
import { readFileSync } from 'node:fs'

test('demo fields: the client from the session plus the flag, only the flag without an account', () => {
  assert.deepEqual(gate.demoFields({ clientEmail: 'a@b.co', cabinetId: 'sb-1', clientName: 'А' }), { demo: true, clientId: 'sb-1', clientEmail: 'a@b.co' })
  assert.deepEqual(gate.demoFields(null), { demo: true })
})

test('usage: HQ\'s { calls, left } is read, junk is not', () => {
  assert.deepEqual(gate.parseUsage({ usage: { calls: 4, left: 26 } }), { calls: 4, left: 26 })
  // The contract of HQ (public-api.md): flat limit/remaining and usage { limit, used, remaining }.
  assert.deepEqual(gate.parseUsage({ limit: 30, remaining: 25, usage: { limit: 30, used: 5, remaining: 25 } }), { calls: 5, left: 25 })
  assert.deepEqual(gate.parseUsage({ remaining: 0, limit: 30 }), { calls: 30, left: 0 })
  assert.deepEqual(gate.parseUsage({ usage: { limit: 30, used: 12 } }), { calls: 12, left: 18 })
  assert.deepEqual(demo.parseDemoLimit({ usage: { limit: 30, used: 5, remaining: 25 } }), { limit: 30, remaining: 25 })
  assert.deepEqual(demo.parseDemoLimit({ limit: 30, remaining: 7 }), { limit: 30, remaining: 7 })
  assert.deepEqual(demo.parseDemoAnswer(401, { ok: false, error: 'login_required' }), { ok: false, error: 'login_required' })
  assert.deepEqual(demo.parseDemoAnswer(401, { ok: false, error: 'unauthorized' }), { ok: false, error: 'unauthorized' })
  assert.deepEqual(gate.parseUsage({ usage: { left: 3 } }), { calls: 0, left: 3 })
  assert.deepEqual(gate.parseUsage({ usage: { calls: 7 } }), { calls: 7, left: null })
  for (const bad of [null, {}, { usage: 'x' }, { usage: { calls: -1, left: 'a' } }]) assert.equal(gate.parseUsage(bad), null)
  assert.deepEqual(chat.sanitizeReply({ ok: true, reply: 'Привет', usage: { calls: 1, left: 29 } }).usage, { calls: 1, left: 29 })
  assert.equal('usage' in chat.sanitizeReply({ ok: true, reply: 'Привет' }), false)
  assert.deepEqual(demo.parseDemoLimit({ usage: { calls: 1, left: 29 } }), { limit: null, remaining: 29 })
})

test('personal is a persona HQ accepts', () => {
  assert.ok(chat.personas.includes('personal'))
  const base = { sessionId: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', locale: 'ru', message: 'hi', page: '/' }
  assert.equal(chat.chatRequestSchema.safeParse({ ...base, persona: 'personal' }).success, true)
})

test('way back from sign-in: the login link keeps the demo tab, and safeNextPath lets it through', () => {
  const next = gate.demoTabNext('ru', 'personal')
  assert.equal(next, '/ru?demo=personal#demo')
  assert.equal(safeNextPath(next, 'ru'), next)
  const href = gate.demoLoginHref('ru', next)
  assert.equal(href, `/ru/cabinet/login?next=${encodeURIComponent(next)}`)
  assert.equal(new URL(href, 'https://x.test').searchParams.get('next'), next)
  const page = '/en/demo/ag_1?k=abcdefgh1234'
  assert.equal(safeNextPath(page, 'en'), page)
})

test('dev counter: counts per client and day, refuses at the limit, a new day starts over', () => {
  let t = Date.parse('2026-11-23T10:00:00Z')
  const hit = gate.createMockDemoCounter(2, () => t)
  assert.deepEqual(hit('a'), { ok: true, usage: { calls: 1, left: 1 } })
  assert.deepEqual(hit('a'), { ok: true, usage: { calls: 2, left: 0 } })
  assert.deepEqual(hit('a'), { ok: false })
  assert.equal(hit('b').ok, true)
  t += 86400_000
  assert.equal(hit('a').ok, true)
})

test('the demo page proxy goes to HQ\'s /agent/<id>/chat, or to the dev stand-in without HQ', () => {
  assert.equal(agentChatUrl({ NODE_ENV: 'production' }, 'ag_1'), 'http://127.0.0.1:8787/agent/ag_1/chat')
  assert.equal(agentChatUrl({ HQ_CHAT_URL: 'http://hq:8787/chat', NODE_ENV: 'production' }, 'ag_1'), 'http://hq:8787/agent/ag_1/chat')
  assert.equal(agentChatUrl({ NODE_ENV: 'development' }, 'ag_1'), null)
  const page = readFileSync('src/components/demo-chat.tsx', 'utf8')
  assert.match(page, /\/api\/demo-agent\//)
  assert.doesNotMatch(page, /fetch\(`\/agent\//, 'the browser never calls HQ directly: the client id comes from the session on the server')
})

test('copy: the gate texts exist in both languages and say sign in, never bot', () => {
  for (const locale of ['ru', 'en']) {
    const g = getDict(locale).demoGate
    for (const key of ['hint', 'login', 'scripted', 'left', 'limitTitle', 'limitText', 'build', 'checking', 'write', 'send']) assert.ok(g[key], `${locale}.${key}`)
    assert.ok(g.left.includes('{n}'))
    assert.doesNotMatch(JSON.stringify(g), /бот|\bbots?\b|—|–/i)
  }
  assert.equal(getDict('ru').demoGate.hint, 'Войдите, чтобы написать агенту')
})

test('the demo agent call carries x-chat-token from the server env', async () => {
  assert.deepEqual(gate.chatTokenHeader({ HQ_CHAT_TOKEN: ' tok ' }), { 'x-chat-token': 'tok' })
  assert.deepEqual(gate.chatTokenHeader({}), {})
  const { askDemoAgent } = await import('../src/lib/agent-demo.ts')
  let seen
  const fetcher = async (_u, init) => {
    seen = init
    return new Response(JSON.stringify({ ok: true, reply: 'hi' }), { status: 200 })
  }
  const out = await askDemoAgent({ niche: 'salon', sessionId: 's1234567', text: 'hi' }, { HQ_AGENT_URL: 'http://hq.test', HQ_CHAT_TOKEN: 'tok' }, fetcher, undefined, { cabinetId: 'u1', clientEmail: 'a@b.c', clientName: '' })
  assert.equal(out.ok, true)
  assert.equal(seen.headers['x-chat-token'], 'tok')
  assert.equal(JSON.parse(seen.body).clientEmail, 'a@b.c')
})
