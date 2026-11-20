import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { beforeEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Site events for the пульт's «Цифры» (pult v3, part C): the pure helpers, the browser helper, the
// HQ forward, the /api/events route, the call sites and the owner's replies in the site chat.
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

const ev = await import('../src/lib/site-events.ts')
const hq = await import('../src/lib/events-hq.ts')
const route = await import('../src/app/api/events/route.ts')
const chat = await import('../src/lib/chat.ts')

const realFetch = globalThis.fetch
beforeEach(() => {
  globalThis.fetch = realFetch
  for (const k of ['HQ_EVENTS_URL', 'HQ_CHAT_URL', 'SITE_EVENTS_TOKEN', 'HQ_CHAT_TOKEN']) delete process.env[k]
})

test('sanitize: only known names; path without query; slug and locale checked', () => {
  assert.equal(ev.sanitizeEvent({ name: 'hack' }), null)
  assert.equal(ev.sanitizeEvent(null), null)
  assert.equal(ev.sanitizeEvent(['chat_open']), null)
  assert.deepEqual(ev.sanitizeEvent({ name: 'pay_view', path: '/ru/pay/FT-1?k=secret#x', ref: 'c1a1', locale: 'ru', email: 'a@b.c' }), {
    name: 'pay_view',
    path: '/ru/pay/FT-1',
    ref: 'c1a1',
    locale: 'ru',
  })
  assert.deepEqual(ev.sanitizeEvent({ name: 'chat_open', path: '//evil.example/x', ref: 'Bad Slug!', locale: 'de' }), { name: 'chat_open' })
  assert.equal(ev.cleanPath('/a'.repeat(200)).length, 200)
  assert.equal(ev.cleanPath('/<script>'), undefined)
  assert.equal(ev.SITE_EVENTS.length, 10)
})

test('dedupe per page view, Do Not Track and GPC, the per-IP limiter', () => {
  const fresh = ev.createDedupe()
  assert.equal(fresh(ev.dedupeKey('chat_open', '/ru')), true)
  assert.equal(fresh(ev.dedupeKey('chat_open', '/ru')), false)
  assert.equal(fresh(ev.dedupeKey('chat_open', '/ru/blog')), true)
  assert.equal(fresh(ev.dedupeKey('lead_sent', '/ru')), true)
  assert.equal(ev.trackingRefused({ doNotTrack: '1' }), true)
  assert.equal(ev.trackingRefused({ doNotTrack: null }, { doNotTrack: 'yes' }), true)
  assert.equal(ev.trackingRefused({ globalPrivacyControl: true }), true)
  assert.equal(ev.trackingRefused({ doNotTrack: '0' }), false)
  const limited = ev.createEventLimiter(3, 1000)
  assert.deepEqual([1, 2, 3, 4].map(() => limited('1.1.1.1', 0)), [false, false, false, true])
  assert.equal(limited('2.2.2.2', 0), false)
  assert.equal(limited('1.1.1.1', 1500), false)
})

test('trackEvent: one POST per event per page, nothing under DNT, never throws', async () => {
  const sent = []
  const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const setNavigator = (value) => Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })
  globalThis.window = { location: { pathname: '/en/builder', search: '?b=x' } }
  setNavigator({ doNotTrack: null })
  globalThis.fetch = async (url, init) => {
    sent.push([url, JSON.parse(init.body), init.keepalive])
    return new Response('{}')
  }
  const { trackEvent } = await import('../src/lib/track-event.ts')
  trackEvent('builder_done')
  trackEvent('builder_done')
  trackEvent('ref_click', { ref: 'c1a1' })
  assert.deepEqual(sent, [
    ['/api/events', { name: 'builder_done', path: '/en/builder', locale: 'en' }, true],
    ['/api/events', { name: 'ref_click', path: '/en/builder', ref: 'c1a1', locale: 'en' }, true],
  ])
  setNavigator({ doNotTrack: '1' })
  globalThis.window.location = { pathname: '/ru', search: '' }
  trackEvent('chat_open')
  assert.equal(sent.length, 2)
  setNavigator({ doNotTrack: null })
  globalThis.fetch = () => {
    throw new Error('boom')
  }
  assert.doesNotThrow(() => trackEvent('lead_sent'))
  delete globalThis.window
  if (realNavigator) Object.defineProperty(globalThis, 'navigator', realNavigator)
})

test('HQ forward: token header with fallback, URL from HQ_CHAT_URL, dev sends nothing', async () => {
  assert.deepEqual(await hq.forwardSiteEvent({ name: 'chat_open' }, '1.2.3.4', { env: { NODE_ENV: 'development' } }), { ok: true, mock: true })
  assert.deepEqual(await hq.forwardSiteEvent({ name: 'chat_open' }, undefined, { env: { NODE_ENV: 'production' } }), { ok: false, error: 'not_configured' })
  let seen
  const fetcher = async (url, init) => {
    seen = [url, init.headers, JSON.parse(init.body)]
    return new Response('{"ok":true}')
  }
  let res = await hq.forwardSiteEvent({ name: 'lead_sent', locale: 'ru' }, '1.2.3.4', {
    env: { NODE_ENV: 'production', HQ_CHAT_URL: 'http://127.0.0.1:8787/chat', HQ_CHAT_TOKEN: 'chat-token' },
    fetcher,
  })
  assert.deepEqual(res, { ok: true })
  assert.equal(seen[0], 'http://127.0.0.1:8787/events')
  assert.equal(seen[1]['x-site-token'], 'chat-token')
  assert.equal(seen[1]['x-visitor-ip'], '1.2.3.4')
  assert.deepEqual(seen[2], { name: 'lead_sent', locale: 'ru' })
  res = await hq.forwardSiteEvent({ name: 'lead_sent' }, 'local', {
    env: { NODE_ENV: 'production', HQ_EVENTS_URL: 'http://hq.test/events', SITE_EVENTS_TOKEN: 'site-token', HQ_CHAT_TOKEN: 'chat-token' },
    fetcher,
  })
  assert.equal(seen[0], 'http://hq.test/events')
  assert.equal(seen[1]['x-site-token'], 'site-token')
  assert.equal(seen[1]['x-visitor-ip'], undefined)
  res = await hq.forwardSiteEvent({ name: 'lead_sent' }, undefined, {
    env: { NODE_ENV: 'production', SITE_EVENTS_TOKEN: 't' },
    fetcher: async () => {
      throw new Error('down')
    },
  })
  assert.deepEqual(res, { ok: false, error: 'hq_unreachable' })
})

test('route: JSON only, same origin, known events, 202 without waiting on HQ errors', async () => {
  const post = (body, headers = {}) =>
    route.POST(
      new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3001', 'x-real-ip': '9.9.9.9', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    )
  assert.equal((await post({ name: 'chat_open' }, { 'content-type': 'text/plain' })).status, 415)
  assert.equal((await post({ name: 'chat_open' }, { origin: 'https://evil.example' })).status, 403)
  assert.equal((await post({ name: 'nope' })).status, 400)
  assert.equal((await post('not json')).status, 400)
  const res = await post({ name: 'chat_open', path: '/ru' })
  assert.equal(res.status, 202)
  assert.deepEqual(await res.json(), { ok: true })
})

test('call sites: every contract event is fired somewhere, the server one in the auth callback', () => {
  const read = (f) => readFileSync(path.resolve(f), 'utf8')
  const where = {
    chat_open: 'src/components/chat/chat-widget.tsx',
    builder_done: 'src/components/builder.tsx',
    estimate_pdf: 'src/components/estimate-gate.tsx',
    lead_sent: 'src/components/contact-form.tsx',
    audit_sent: 'src/components/audit-form.tsx',
    ref_click: 'src/components/ref-capture.tsx',
    pay_view: 'src/app/[locale]/pay/[number]/page.tsx',
    blog_view: 'src/app/[locale]/blog/[slug]/page.tsx',
    cabinet_offer_click: 'src/components/cabinet/offer-link.tsx',
  }
  for (const [name, file] of Object.entries(where)) {
    assert.match(read(file), new RegExp(`trackEvent\\('${name}'|TrackView name="${name}"`), `${name} in ${file}`)
  }
  // Metrika goals stay next to ours.
  assert.match(read('src/components/contact-form.tsx'), /track\('lead_sent'/)
  // The server event fires in syncAfterSignIn (first HQ sync), which the auth callback calls.
  assert.match(read('src/lib/cabinet-session.ts'), /forwardSiteEvent\(\{ name: 'cabinet_signup'/)
  assert.match(read('src/app/[locale]/cabinet/auth/callback/route.ts'), /syncAfterSignIn\(/)
  assert.match(read('.env.example'), /^SITE_EVENTS_TOKEN=$/m)
})

test('chat: owner replies from the пульт are plain text, at most 5, only when present', () => {
  const r = chat.sanitizeReply({ ok: true, reply: 'Привет', state: 'chat', ownerReplies: ['<b>Здравствуйте</b>, это Фирдавс', 5, '', 'a', 'b', 'c', 'd', 'e'] })
  assert.deepEqual(r.ownerReplies, ['Здравствуйте, это Фирдавс', 'a', 'b', 'c', 'd'])
  assert.equal('ownerReplies' in chat.sanitizeReply({ ok: true, reply: 'x', state: 'chat' }), false)
  assert.equal('ownerReplies' in chat.sanitizeReply({ ok: true, reply: 'x', state: 'chat', ownerReplies: 'nope' }), false)
})
