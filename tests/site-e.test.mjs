// Demo stand, free audit and status page (2026-11-19): routes, meta, copy rules, API behaviour.
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
        } catch {}
      }
    }
    return next(specifier, context)
  },
})

const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const { footerColumns, localePages } = await import('../src/lib/home.ts')
const sitemap = (await import('../src/app/sitemap.ts')).default
const audit = await import('../src/lib/audit.ts')
const status = await import('../src/lib/status.ts')
const { createStatusSource, statusUrl } = await import('../src/lib/status-hq.ts')

function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k)
}
const dicts = [['ru', ru], ['en', en]]
const pages = ['audit', 'status']

test('pages: in localePages, sitemap with alternates, footer, labels, files', async () => {
  const urls = (await sitemap()).map((e) => e.url)
  for (const page of pages) {
    assert.ok(localePages.includes(page), page)
    assert.ok(existsSync(`src/app/[locale]/${page}/page.tsx`), page)
    for (const [locale, dict] of dicts) {
      assert.ok(urls.some((u) => u.endsWith(`/${locale}/${page}`)), `${locale} ${page}`)
      const company = footerColumns(locale).find((c) => c.id === 'company')
      assert.ok(company.links.some((l) => l.href === `/${locale}/${page}`), `footer ${locale} ${page}`)
      assert.ok(dict.footer.pages[page], `label ${locale} ${page}`)
    }
    const entry = (await sitemap()).find((e) => e.url.endsWith(`/ru/${page}`))
    assert.deepEqual(Object.keys(entry.alternates.languages), ['ru', 'en'])
  }
  assert.ok(existsSync('src/app/api/audit/route.ts') && existsSync('src/app/api/status/route.ts'))
})

test('meta: titles up to 70, descriptions 120-160', () => {
  for (const [locale, dict] of dicts)
    for (const [label, t] of [['audit', dict.auditPage], ['status', dict.statusPage]]) {
      assert.ok(t.metaTitle.length > 10 && t.metaTitle.length <= 70, `${locale} ${label} title ${t.metaTitle.length}`)
      assert.ok(
        t.metaDescription.length >= 120 && t.metaDescription.length <= 160,
        `${locale} ${label} description ${t.metaDescription.length}`,
      )
    }
})

test('copy: new dictionaries have no long dashes, AI tells or dollar amounts', () => {
  const tells = [
    /\bэто не [^.!?]{1,60}, а\b/i,
    /\bне просто [^.!?]{1,60}, а\b/i,
    /\bit'?s not [^.!?]{1,60}, it'?s\b/i,
    /\bnot (just|only|merely) [^.!?]{1,60}, (but|it)\b/i,
    /\bбез [^,.!?]{1,30}, без [^,.!?]{1,30}, (и )?без\b/i,
    /, (позволяя|делая|помогая|обеспечивая|allowing|making|helping|ensuring)\b/i,
  ]
  for (const [name, dict] of dicts)
    for (const [at, text] of strings([dict.auditPage, dict.statusPage, dict.faqLinks])) {
      assert.doesNotMatch(text, /[–—]/, `${name} ${at}`)
      assert.doesNotMatch(text, /\$\s?\d/, `${name} ${at}`)
      for (const re of tells) assert.doesNotMatch(text, re, `${name} ${at}`)
    }
})

test('demo (2026-11-22): no demo salon deep link on the page, the #demo block is the tabs', () => {
  for (const file of [
    'src/components/demo-section.tsx',
    'src/components/products/products-bento.tsx',
    'src/components/chat/chat-panel.tsx',
    'src/components/hero/hero.tsx',
  ])
    assert.doesNotMatch(readFileSync(file, 'utf8'), /demo_salon|demoSalon|t\.me\/firtech_bot/, file)
  assert.equal(existsSync('src/lib/demo.ts'), false)
  for (const [, dict] of dicts) assert.equal('demoStand' in dict, false)
})

test('audit: url validation', () => {
  const ok = ['https://example.com', 'http://shop.example.co.uk/path?x=1', 'https://instagram.com/firtech.pro']
  const bad = [
    'example.com',
    'ftp://example.com',
    'javascript:alert(1)',
    'https://localhost',
    'https://intranet',
    'https://127.0.0.1',
    'https://192.168.0.1/x',
    'https://printer.local',
    'https://[::1]/',
    'https://' + 'a'.repeat(190) + '.com',
    '',
  ]
  for (const u of ok) assert.equal(audit.isAuditUrl(u), true, u)
  for (const u of bad) assert.equal(audit.isAuditUrl(u), false, u)
  assert.equal(audit.normalizeAuditUrl('example.com'), 'https://example.com')
  assert.equal(audit.normalizeAuditUrl('http://a.io'), 'http://a.io')
})

test('audit: contact validation and schema', () => {
  for (const c of ['@dilnoza', '@a_b_c', '+998901234567', '+992 93 123-45-67']) assert.equal(audit.isAuditContact(c), true, c)
  for (const c of ['', 'ab', '@ab', 'dilnoza', '12345', '@' + 'a'.repeat(33), '+1234567890123456', 'hello world']) assert.equal(audit.isAuditContact(c), false, c)
  assert.equal(audit.normalizeAuditContact('dilnoza'), '@dilnoza')
  assert.equal(audit.normalizeAuditContact('+99890'), '+99890')
  const base = { url: 'https://example.com', contact: '@dilnoza', locale: 'ru' }
  assert.equal(audit.auditSchema.safeParse(base).success, true)
  assert.equal(audit.auditSchema.safeParse({ ...base, url: 'nope' }).success, false)
  assert.equal(audit.auditSchema.safeParse({ ...base, contact: 'x' }).success, false)
  assert.equal(audit.auditSchema.safeParse({ ...base, name: 'x'.repeat(81) }).success, false)
  assert.equal(audit.auditSchema.safeParse({ ...base, locale: 'de' }).success, false)
  assert.equal(audit.auditSchema.safeParse({ ...base, ref: 'ref:bob_1' }).success, true)
  assert.equal(audit.auditSchema.safeParse({ ...base, ref: 'bad ref' }).success, false)
  assert.equal(audit.auditSchema.parse({ ...base, website: 'spam' }).website, 'spam')
})

test('audit: honeypot, limit and HQ call are wired in the route', () => {
  const route = readFileSync('src/app/api/audit/route.ts', 'utf8')
  assert.match(route, /if \(parsed\.data\.website\) return NextResponse\.json\(\{ ok: true \}\)/)
  assert.match(route, /createAuditLimiter\(\)/)
  assert.match(route, /forwardAudit\(/)
})

test('audit: limiter allows 5 per 10 minutes per IP', () => {
  const limited = audit.createAuditLimiter()
  const t = 1_000_000
  for (let i = 0; i < 5; i++) assert.equal(limited('1.1.1.1', t + i), false)
  assert.equal(limited('1.1.1.1', t + 6), true)
  assert.equal(limited('2.2.2.2', t + 6), false)
  assert.equal(limited('1.1.1.1', t + 10 * 60 * 1000 + 100), false)
})

test('audit: mock mode without HQ in development, honest error in production', async () => {
  const input = { url: 'https://example.com', contact: '@dilnoza', locale: 'ru' }
  assert.deepEqual(await audit.forwardAudit(input, { NODE_ENV: 'development' }), { ok: true, mock: true, status: 200 })
  const prod = await audit.forwardAudit(input, { NODE_ENV: 'production' })
  assert.equal(prod.ok, false)
  assert.equal(prod.status, 503)
})

test('audit: forwards to HQ with the token and maps its answers', async () => {
  const env = { LEAD_INTAKE_URL: 'http://hq.local:8787/', LEAD_INTAKE_TOKEN: 'tok', NODE_ENV: 'production' }
  const calls = []
  const reply = (status, body) => async (url, init) => {
    calls.push({ url, init })
    return { ok: status < 400, status, json: async () => body }
  }
  const input = { url: 'https://example.com', contact: '@dilnoza', name: '', locale: 'en', ref: 'ref:bob' }
  assert.deepEqual(await audit.forwardAudit(input, env, reply(200, { ok: true })), { ok: true, status: 200 })
  assert.equal(calls[0].url, 'http://hq.local:8787/audit')
  assert.equal(calls[0].init.headers['x-lead-token'], 'tok')
  const sent = JSON.parse(calls[0].init.body)
  assert.deepEqual(sent, { url: 'https://example.com', contact: '@dilnoza', locale: 'en', ref: 'ref:bob' })
  assert.deepEqual(await audit.forwardAudit(input, env, reply(200, { ok: true, duplicate: true })), { ok: true, duplicate: true, status: 200 })
  assert.equal((await audit.forwardAudit(input, env, reply(400, { ok: false, error: 'invalid' }))).status, 400)
  assert.equal((await audit.forwardAudit(input, env, reply(429, {}))).error, 'rate_limited')
  assert.equal((await audit.forwardAudit(input, env, reply(401, {}))).error, 'unavailable')
  const boom = async () => {
    throw new Error('http://hq.local:8787 down')
  }
  const failed = await audit.forwardAudit(input, env, boom)
  assert.deepEqual(failed, { ok: false, error: 'unavailable', status: 502 })
})

const hqBody = {
  ok: true,
  generatedAt: '2026-11-19T12:00:00.000Z',
  secret: 'x',
  services: [
    { id: 'site', title: 'Website', state: 'up', url: 'http://127.0.0.1:3001/api/health', extra: 1 },
    { id: 'hq', title: 'HQ', state: 'degraded', since: '2026-11-19T11:00:00.000Z', note: 'Disk at http://x:9000 is full' },
    { id: 'omniroute', title: 'AI gateway', state: 'down', since: 'not a date', note: 'err' },
    { id: 'bot', state: 'weird' },
    { id: 'evil', state: 'up' },
  ],
  incidents: [
    { startedAt: '2026-11-19T11:00:00.000Z', service: 'hq', title: 'HQ: http://10.0.0.1:8787 failed', port: 8787 },
    { startedAt: '2026-11-18T11:00:00.000Z', endedAt: '2026-11-18T11:30:00.000Z', service: 'site', title: 'x' },
    { startedAt: 'bad', service: 'site' },
    { startedAt: '2026-11-18T11:00:00.000Z', service: 'unknown_service' },
  ],
  uptime30d: { site: 99.94, hq: 120, bot: 'x', omniroute: -5 },
}

test('status: normalizer keeps five services in order, ignores unknown fields, leaks nothing', () => {
  const data = status.normalizeStatus(hqBody)
  assert.deepEqual(data.services.map((s) => s.id), status.statusServiceIds.slice())
  assert.deepEqual(data.services.map((s) => s.state), ['up', 'degraded', 'unknown', 'down', 'unknown'])
  const byId = Object.fromEntries(data.services.map((s) => [s.id, s]))
  assert.equal(byId.site.state, 'up')
  assert.equal(byId.hq.state, 'degraded')
  assert.equal(byId.hq.since, '2026-11-19T11:00:00.000Z')
  assert.equal(byId.bot.state, 'unknown')
  assert.equal(byId.omniroute.state, 'down')
  assert.equal('since' in byId.omniroute, false)
  assert.equal(byId.site.uptime30d, 99.9)
  assert.equal(byId.hq.uptime30d, 100)
  assert.equal(byId.omniroute.uptime30d, 0)
  assert.equal('uptime30d' in byId.bot, false)
  assert.equal(data.incidents.length, 2)
  assert.equal(data.incidents[1].endedAt, '2026-11-18T11:30:00.000Z')
  const text = JSON.stringify(data)
  assert.doesNotMatch(text, /http|127\.0|10\.0|8787|9000|secret|evil|Disk|failed|extra|title|note/i)
})

test('status: not a status answer gives null; headline rules', () => {
  assert.equal(status.normalizeStatus(null), null)
  assert.equal(status.normalizeStatus({ ok: false }), null)
  assert.equal(status.normalizeStatus({ ok: true }), null)
  const data = status.normalizeStatus({ ok: true, services: [{ id: 'site', state: 'up' }, { id: 'hq', state: 'up' }] })
  assert.equal(status.headline(data), 'ok')
  assert.equal(status.headline(status.normalizeStatus(hqBody)), 'issue')
  assert.equal(status.headline(status.emptyStatus()), 'unavailable')
  const allUnknown = status.normalizeStatus({ ok: true, services: [] })
  assert.equal(status.headline(allUnknown), 'unavailable')
  const many = status.normalizeStatus({
    ok: true,
    services: [],
    incidents: Array.from({ length: 30 }, (_, i) => ({ startedAt: `2026-11-${String(i + 1).padStart(2, '0')}T10:00:00Z`, service: 'site' })),
  })
  assert.equal(many.incidents.length, 20)
})

test('status: mock has two incidents; dates are shown in Dushanbe time', () => {
  const m = status.statusMock(Date.UTC(2026, 10, 19, 12, 0, 0))
  assert.equal(m.incidents.length, 2)
  assert.equal(m.services.length, 5)
  assert.equal(m.mock, true)
  assert.deepEqual(status.statusMock(5), status.statusMock(5))
  // 12:00 UTC is 17:00 in Dushanbe (UTC+5).
  assert.match(status.formatStatusClock('2026-11-19T12:00:00.000Z', 'en'), /^17:00:00$/)
  assert.match(status.formatStatusTime('2026-11-19T12:00:00.000Z', 'ru'), /17:00/)
})

test('status source: url rules, 60 s cache, no URL in the answer, site filled from /api/health', async () => {
  assert.equal(statusUrl({ HQ_STATUS_URL: 'http://a:1/status' }), 'http://a:1/status')
  assert.equal(statusUrl({ LEAD_INTAKE_URL: 'http://hq.local:8787/lead-base/' }), 'http://hq.local:8787/status')
  assert.equal(statusUrl({ NODE_ENV: 'production' }), 'http://127.0.0.1:8787/status')
  assert.equal(statusUrl({ NODE_ENV: 'development' }), null)

  let calls = 0
  let lastInit
  const fetcher = async (_url, init) => {
    calls++
    lastInit = init
    return { ok: true, json: async () => ({ ok: true, services: [{ id: 'site', state: 'unknown' }, { id: 'hq', state: 'up' }] }) }
  }
  const source = createStatusSource({ HQ_STATUS_URL: 'http://hq.local:8787/status' }, fetcher, async () => true)
  const t = 5_000_000
  const first = await source.get(t)
  await source.get(t + 59_000)
  assert.equal(calls, 1)
  assert.ok(lastInit.signal)
  assert.equal(first.services.find((s) => s.id === 'site').state, 'up')
  await source.get(t + 61_000)
  assert.equal(calls, 2)
  // Concurrent misses share one request.
  source.clear()
  await Promise.all([source.get(t), source.get(t), source.get(t)])
  assert.equal(calls, 3)
  assert.doesNotMatch(JSON.stringify(first), /hq\.local|8787|http/)
})

test('status source: HQ down gives unavailable with the site row from its own health; dev mock', async () => {
  const down = createStatusSource({ HQ_STATUS_URL: 'http://hq.local/status' }, async () => { throw new Error('refused') }, async () => true)
  const data = await down.get(1_000)
  assert.equal(data.available, false)
  assert.equal(status.headline(data), 'unavailable')
  assert.equal(data.services.find((s) => s.id === 'site').state, 'up')
  assert.equal(data.services.find((s) => s.id === 'hq').state, 'unknown')
  const bad = createStatusSource({ HQ_STATUS_URL: 'http://hq.local/status' }, async () => ({ ok: true, json: async () => ({ nope: 1 }) }), async () => false)
  assert.equal((await bad.get(1_000)).available, false)
  const dev = createStatusSource({ NODE_ENV: 'development' }, async () => { throw new Error('must not be called') })
  const mock = await dev.get(1_000)
  assert.equal(mock.mock, true)
  assert.equal(mock.incidents.length, 2)
})

test('status page: indexed (no noindex), refresh island, FAQ links to the audit', () => {
  assert.doesNotMatch(readFileSync('src/app/[locale]/status/page.tsx', 'utf8'), /noindex|robots/)
  assert.match(readFileSync('src/components/status-view.tsx', 'utf8'), /REFRESH_MS = 60_000/)
  assert.match(readFileSync('src/components/faq-contact.tsx', 'utf8'), /'audit'/)
  for (const [, dict] of dicts) assert.ok(dict.faq.items.some((i) => /audit|аудит/i.test(i.a)))
  assert.match(readFileSync('src/lib/analytics.ts', 'utf8'), /audit_sent/)
})
