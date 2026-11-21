// Audit fixes 2026-11-19: payment and audit copy, visitor IP, referral storage, prices, public POST guard.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// The live prices read $DATA_DIR/prices.json: point it at an empty folder so the defaults apply.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'prices-'))

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

const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const { articles } = await import('../src/content/blog/index.ts')
const { forwardLead } = await import('../src/lib/lead-forward.ts')
const { forwardAudit } = await import('../src/lib/audit.ts')
const { askReceptionist } = await import('../src/lib/chat-hq.ts')
const { checkPublicPost, visitorIp, visitorIpHeader } = await import('../src/lib/public-post.ts')
const referral = await import('../src/lib/referral.ts')
const { pricesJson } = await import('../src/lib/prices-json.ts')
const { productPrice } = await import('../src/lib/products.ts')
const pricing = await import('../src/lib/pricing.ts')
const { toPublicOffice } = await import('../src/lib/office-public.ts')
const { officeMock } = await import('../src/lib/office-mock.ts')
const llms = await import('../src/app/llms.txt/route.ts')

function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k)
}

test('payment copy: only USDT and the wallet from the estimate, no Kaspi, Payme, Click', async () => {
  for (const [name, dict] of [['ru', ru], ['en', en]])
    for (const [at, text] of strings(dict)) assert.doesNotMatch(text, /Kaspi|\bPayme\b|\bClick\b/, `${name} ${at}`)
  assert.match(ru.region.pay.join(' '), /USDT/)
  assert.match(en.region.pay.join(' '), /USDT/)
  const body = await (await llms.GET()).text()
  assert.doesNotMatch(body, /Kaspi|\bPayme\b|\bClick\b|Bank cards/)
  assert.match(body, /USDT/)
  assert.doesNotMatch(body, /Working with companies/)
})

test('staged payment copy matches the terms: stages, each before it starts (owner 2026-11-21)', () => {
  // «Оплата по этапам» is the rule since 2026-11-21; the old «за каждый этап отдельно» phrasing stays out.
  const ruBad = /за каждый[^.]{0,30}этап|каждый этап отдельно|за каждый отдельно/i
  const enBad = /for each (stage|one) separately/i
  for (const [at, text] of strings(ru)) assert.doesNotMatch(text, ruBad, `ru ${at}`)
  for (const [at, text] of strings(en)) assert.doesNotMatch(text, enBad, `en ${at}`)
  for (const [at, text] of strings(articles.map((a) => ({ ru: a.ru, en: a.en })))) {
    assert.doesNotMatch(text, ruBad, `blog ${at}`)
    assert.doesNotMatch(text, enBad, `blog ${at}`)
  }
  const ruFaq = ru.faq.items.find((i) => i.q === 'Как проходит оплата?').a
  assert.match(ruFaq, /по этапам/)
  assert.match(ruFaq, /до его начала/)
  assert.match(ruFaq, /последний до передачи/)
  assert.doesNotMatch(ruFaq, /50|половин/i)
})

test('audit promise: a working day, no hard 24 hours, no automation promise', () => {
  for (const [dict, day, hours] of [[ru, /рабочего дня/, /24 час/], [en, /working day/, /24 hours?/]]) {
    for (const [at, text] of strings([dict.auditPage, dict.faq]))
      assert.doesNotMatch(text, hours, at)
    assert.match(dict.auditPage.successText, day)
    assert.match(dict.auditPage.successText, /@firtech_bot/)
    assert.doesNotMatch(dict.auditPage.successTextOther, /@firtech_bot/)
  }
})

test('x-visitor-ip: lead, audit and chat forwards carry it, and omit it without one', async () => {
  const env = { LEAD_INTAKE_URL: 'http://hq.local:8787', LEAD_INTAKE_TOKEN: 't', HQ_CHAT_URL: 'http://hq.local:8787/chat', NODE_ENV: 'production' }
  const seen = []
  const fetcher = async (_u, init) => (seen.push(init.headers), { ok: true, status: 200, json: async () => ({ ok: true, reply: 'hi', state: 'chat' }) })
  const lead = { name: 'a', contact: '@abc', service: 'websites', budget: '', message: '', estimate: '', locale: 'ru', page: '/', source: '' }
  await forwardLead(lead, undefined, env, fetcher, '203.0.113.7')
  await forwardAudit({ url: 'https://example.com', contact: '@abc', name: '', locale: 'ru' }, env, fetcher, '203.0.113.7')
  await askReceptionist({ sessionId: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', locale: 'ru', message: 'hi', page: '/' }, env, fetcher, '203.0.113.7')
  assert.equal(seen.length, 3)
  for (const h of seen) assert.equal(h['x-visitor-ip'], '203.0.113.7')
  await forwardLead(lead, undefined, env, fetcher)
  assert.equal('x-visitor-ip' in seen[3], false)
  assert.deepEqual(visitorIpHeader('local'), {})
  // The chat sends the referral slug.
  let body
  await askReceptionist({ sessionId: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b', locale: 'ru', message: 'hi', page: '/', ref: 'bob' }, env, async (_u, init) => (body = JSON.parse(init.body), { ok: true, json: async () => ({}) }))
  assert.equal(body.ref, 'bob')
})

test('visitorIp follows the limiter: x-real-ip, then the first x-forwarded-for hop', () => {
  const h = (o) => new Headers(o)
  assert.equal(visitorIp(h({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' })), '1.2.3.4')
  assert.equal(visitorIp(h({ 'x-forwarded-for': ' 5.6.7.8 , 10.0.0.1' })), '5.6.7.8')
  assert.equal(visitorIp(h({})), 'local')
})

test('public POST: json content type and same origin', () => {
  const req = (headers) => ({ headers: new Headers(headers) })
  const prod = { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://firtech.pro' }
  const dev = { NODE_ENV: 'development' }
  assert.equal(checkPublicPost(req({ 'content-type': 'text/plain' }), prod).status, 415)
  assert.equal(checkPublicPost(req({}), prod).status, 415)
  assert.equal(checkPublicPost(req({ 'content-type': 'application/json; charset=utf-8' }), prod), null)
  assert.equal(checkPublicPost(req({ 'content-type': 'application/json', origin: 'https://firtech.pro' }), prod), null)
  assert.equal(checkPublicPost(req({ 'content-type': 'application/json', origin: 'https://evil.example' }), prod).status, 403)
  assert.equal(checkPublicPost(req({ 'content-type': 'application/json', origin: 'http://localhost:3000' }), prod).status, 403)
  assert.equal(checkPublicPost(req({ 'content-type': 'application/json', origin: 'http://localhost:3000' }), dev), null)
  for (const f of ['lead', 'chat', 'audit']) {
    const s = readFileSync(`src/app/api/${f}/route.ts`, 'utf8')
    assert.match(s, /checkPublicPost\(request\)/, f)
    assert.match(s, /visitorIp\(request\.headers\)/, f)
  }
})

test('referral: 30-day storage, expiry, old format, bot links', () => {
  const now = 1_000_000
  const raw = referral.encodeStoredRef('bob', now)
  assert.equal(referral.decodeStoredRef(raw, now + 29 * 86_400_000), 'bob')
  assert.equal(referral.decodeStoredRef(raw, now + 31 * 86_400_000), '')
  assert.equal(referral.decodeStoredRef('Bob_1'), 'bob_1')
  assert.equal(referral.decodeStoredRef(null), '')
  assert.equal(referral.withRefStart('https://t.me/firtech_bot', 'bob'), 'https://t.me/firtech_bot?start=ref_bob')
  assert.equal(
    referral.withRefStart('https://t.me/firtech_bot?start=demo_salon', 'bob'),
    'https://t.me/firtech_bot?start=demo_salon',
  )
  assert.equal(referral.withRefStart('https://t.me/other', 'bob'), 'https://t.me/other')
  assert.equal(referral.withRefStart('https://t.me/firtech_bot', ''), 'https://t.me/firtech_bot')
  const s = readFileSync('src/lib/referral.ts', 'utf8')
  assert.match(s, /localStorage\.setItem/)
  assert.match(readFileSync('src/components/audit-form.tsx', 'utf8'), /storedRef\(\)/)
  assert.match(readFileSync('src/components/chat/chat-panel.tsx', 'utf8'), /storedRef\(\)/)
  assert.match(readFileSync('src/app/[locale]/layout.tsx', 'utf8'), /<RefLinks \/>/)
})

test('/api/prices returns the numbers of pricing.ts and productPrice', async () => {
  const route = await import('../src/app/api/prices/route.ts')
  const res = await route.GET()
  assert.equal(res.headers.get('cache-control'), 'public, max-age=60')
  const body = await res.json()
  assert.equal(body.currency, 'USD')
  assert.match(body.updatedAt, /^\d{4}-\d{2}-\d{2}$/)
  assert.deepEqual(body.startingPrice, pricing.startingPrice)
  assert.deepEqual(body.catalog, pricing.catalog)
  assert.deepEqual(body.extraPrice, pricing.extraPrice)
  assert.deepEqual(body.agentPlans, pricing.agentPlans)
  assert.deepEqual(body.contentPlans, pricing.contentPlans)
  assert.equal(body.referralPercent, pricing.referralPercent)
  assert.deepEqual(body.products, JSON.parse(JSON.stringify(productPrice)))
  assert.deepEqual(Object.keys(body.products), Object.keys(productPrice))
  assert.equal(JSON.stringify(pricesJson(pricing.defaultPricing)), JSON.stringify(body))
  // The prices are live (owner edits in the Пульт): the route is dynamic, never force-static.
  assert.match(readFileSync('src/app/api/prices/route.ts', 'utf8'), /force-dynamic/)
  assert.doesNotMatch(readFileSync('src/app/api/prices/route.ts', 'utf8'), /force-static/)
})

test('public office never shows blocked', () => {
  const data = structuredClone(officeMock(Date.now()))
  data.director.status = 'blocked'
  data.departments[0].head.status = 'blocked'
  const pub = toPublicOffice(data)
  const all = [pub.director, ...pub.departments.flatMap((d) => [d.head, ...d.workers])]
  assert.ok(all.every((a) => a.status !== 'blocked'))
  assert.equal(pub.director.status, 'waiting')
})

test('terms: apply on confirmation, guarantee per product, 30 days of fixes, plain review line', () => {
  for (const dict of [ru, en]) {
    assert.doesNotMatch(dict.terms.intro, /обязательств|no obligations|becomes an offer/)
    const g = dict.terms.sections.find((s) => s.id === 'guarantee')
    assert.equal(g.list.length, 6)
    const d = dict.terms.sections.find((s) => s.id === 'delivery')
    assert.match(d.text.join(' '), /30/)
  }
  assert.equal(ru.terms.draftNote, 'Документ проверяется юристом, редакция может уточняться.')
  assert.match(ru.terms.sections.find((s) => s.id === 'guarantee').list.join(' '), /первый сценарий в тестовом боте/)
})

test('privacy: AI model providers named, no names or contacts sent', () => {
  const ruAi = ru.privacy.sections.find((s) => s.id === 'ai').text.join(' ')
  const enAi = en.privacy.sections.find((s) => s.id === 'ai').text.join(' ')
  assert.match(ruAi, /провайдеры моделей ИИ/)
  assert.match(ruAi, /Имя и контакты мы им не передаём/)
  assert.match(enAi, /AI model providers/)
  assert.match(enAi, /do not send them your name or contacts/)
  // Bumped on 2026-11-20 for the site event counter (pult v3).
  assert.match(ru.privacy.updated, /(19|20) ноября 2026/)
})

test('region copy claims no existing clients', () => {
  assert.doesNotMatch(ru.region.title, /Работаем с бизнесом/)
  assert.match(ru.region.title, /Принимаем заказы/)
  assert.match(en.region.title, /take orders/)
})

test('en dictionary has Cyrillic only in intentionally Russian fields', () => {
  const found = []
  for (const [at, text] of strings(en)) if (/[А-Яа-яЁё]/.test(text)) found.push(at)
  const unexpected = found.filter((at) => !/(lesson\.task|leadNote|langs\.(ru|tj)|\.language)$/.test(at))
  assert.deepEqual(unexpected, [], 'unexpected Cyrillic in en.ts')
})

test('security headers are set for every path', async () => {
  const cfg = (await import('../next.config.ts')).default
  const rules = await cfg.headers()
  const all = rules.find((r) => r.source === '/:path*').headers.map((h) => [h.key, h.value])
  const map = Object.fromEntries(all)
  assert.equal(map['X-Content-Type-Options'], 'nosniff')
  assert.equal(map['Referrer-Policy'], 'strict-origin-when-cross-origin')
  assert.equal(map['X-Frame-Options'], 'DENY')
  assert.equal(map['Permissions-Policy'], 'camera=(), geolocation=(), microphone=()')
})

test('/api/prices carries the payment stages and the small-project limit (2026-11-21)', async () => {
  const body = await (await (await import('../src/app/api/prices/route.ts')).GET()).json()
  assert.equal(body.smallProjectMaxUsd, 300)
  assert.equal(body.updatedAt, '2026-11-21')
  assert.deepEqual(Object.keys(body.stages), ['site', 'bot', 'automation', 'app', 'small'])
  for (const stages of Object.values(body.stages)) {
    assert.equal(stages.reduce((s, x) => s + x.share, 0), 100)
    for (const st of stages) assert.ok(st.id && st.title.ru && st.title.en && st.share > 0)
  }
  assert.deepEqual(body.stages, JSON.parse(JSON.stringify(pricing.paymentStages)))
})
