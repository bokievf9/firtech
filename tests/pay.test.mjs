// Payment page: HQ client, sanitizing, helpers, sitemap, copy lint and header rules.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

const pay = await import('../src/lib/pay.ts')
const { fetchInvoice, mockInvoice } = await import('../src/lib/pay-hq.ts')
const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const sitemap = (await import('../src/app/sitemap.ts')).default
const nextConfig = (await import('../next.config.ts')).default

const KEY = 'abcDEF0123456789_-xyz'
const TRON = 'TXYZabcdefghijkmnopqrstuvwxyz12345'
const TON = 'UQAbcdefghijklmnopqrstuvwxyz0123456789_-ABCDEFGH'
const prod = { NODE_ENV: 'production', HQ_PAY_URL: 'http://hq.test/pay' }

const raw = (extra = {}) => ({
  number: 'FT-2026-001',
  title: 'Site',
  clientFirstName: 'Anna',
  amountUsd: 150,
  payAmountUsd: 150.07,
  status: 'issued',
  dueDate: '2026-12-01',
  issuedAt: '2026-11-19',
  paidAt: null,
  paidVia: null,
  txId: null,
  locale: 'ru',
  methods: [
    { id: 'usdt_trc20', network: 'TRON (TRC20)', address: TRON, note: 'n' },
    { id: 'usdt_ton', network: 'TON', address: TON, note: '' },
  ],
  ...extra,
})
const reply = (body, status = 200) => async () => new Response(JSON.stringify(body), { status })

test('validation: number and key shapes', () => {
  for (const n of ['FT-2026-001', 'FT-2026-12345']) assert.ok(pay.isInvoiceNumber(n), n)
  for (const n of ['FT-26-001', 'FT-2026-01', 'ft-2026-001', 'FT-2026-001/../x', '', 5]) assert.ok(!pay.isInvoiceNumber(n), String(n))
  assert.ok(pay.isInvoiceKey(KEY))
  for (const k of ['short', 'a'.repeat(129), 'abc def0123456789xyz', 'abc/../0123456789xyz', '']) assert.ok(!pay.isInvoiceKey(k), k)
})

test('fetchInvoice: bad number or key never calls HQ', async () => {
  let calls = 0
  const f = async () => (calls++, new Response('{}'))
  assert.deepEqual(await fetchInvoice('bad', KEY, prod, f), { ok: false, error: 'not_found' })
  assert.deepEqual(await fetchInvoice('FT-2026-001', 'short', prod, f), { ok: false, error: 'not_found' })
  assert.equal(calls, 0)
})

test('fetchInvoice: success calls the right URL and returns a sanitized invoice', async () => {
  let url = ''
  let init
  const f = async (u, i) => ((url = u), (init = i), new Response(JSON.stringify({ ok: true, invoice: raw({ extra: 'x' }) })))
  const res = await fetchInvoice('FT-2026-001', KEY, prod, f)
  assert.equal(url, `http://hq.test/pay/FT-2026-001?k=${KEY}`)
  assert.equal(init.cache, 'no-store')
  assert.ok(init.signal)
  assert.equal(res.ok, true)
  assert.equal(res.invoice.methods.length, 2)
  assert.equal('extra' in res.invoice, false)
})

test('fetchInvoice: default HQ URL in production without HQ_PAY_URL', async () => {
  let url = ''
  await fetchInvoice('FT-2026-001', KEY, { NODE_ENV: 'production' }, async (u) => ((url = u), new Response('{}', { status: 404 })))
  assert.equal(url, `http://127.0.0.1:8787/pay/FT-2026-001?k=${KEY}`)
})

test('fetchInvoice: failure modes map to short codes', async () => {
  const run = (f) => fetchInvoice('FT-2026-001', KEY, prod, f)
  assert.deepEqual(await run(reply({ ok: false, error: 'not_found' }, 404)), { ok: false, error: 'not_found' })
  assert.deepEqual(await run(reply({}, 500)), { ok: false, error: 'hq_error' })
  assert.deepEqual(await run(async () => new Response('not json')), { ok: false, error: 'hq_error' })
  assert.deepEqual(await run(reply({ ok: false })), { ok: false, error: 'hq_error' })
  assert.deepEqual(await run(reply({ ok: true, invoice: raw({ number: 'FT-2026-002' }) })), { ok: false, error: 'hq_error' })
  assert.deepEqual(await run(async () => { throw new TypeError('fetch failed') }), { ok: false, error: 'hq_unreachable' })
  assert.deepEqual(await run(async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e }), { ok: false, error: 'hq_timeout' })
})

test('parseInvoice: drops unknown methods and bad addresses', () => {
  const inv = pay.parseInvoice(
    raw({
      methods: [
        { id: 'usdt_trc20', network: 'TRON', address: TRON, note: '' },
        { id: 'usdt_trc20', network: 'TRON', address: TRON, note: 'dup' },
        { id: 'btc', network: 'Bitcoin', address: TRON, note: '' },
        { id: 'usdt_ton', network: 'TON', address: 'UQshort', note: '' },
        { id: 'usdt_ton', network: 'TON', address: TRON, note: '' },
        { id: 'usdt_trc20', network: 'TRON', address: 'T' + 'l'.repeat(33), note: '' },
      ],
    }),
  )
  assert.deepEqual(inv.methods.map((m) => m.id), ['usdt_trc20'])
  assert.ok(pay.parseInvoice(raw({ methods: [{ id: 'usdt_ton', network: 'TON', address: 'EQ' + 'a'.repeat(46), note: '' }] })))
})

test('parseInvoice: rejects broken invoices, keeps paid without methods', () => {
  for (const bad of [null, [], 'x', raw({ status: 'weird' }), raw({ amountUsd: -1 }), raw({ payAmountUsd: 'x' }), raw({ number: 'x' }), raw({ title: '' }), raw({ methods: [] })])
    assert.equal(pay.parseInvoice(bad), null)
  const paid = pay.parseInvoice(raw({ status: 'paid', methods: [], paidAt: '2026-11-20T10:00:00Z', paidVia: 'usdt_ton', txId: 'abcdef1234567890' }))
  assert.equal(paid.status, 'paid')
  assert.equal(paid.paidVia, 'usdt_ton')
  const odd = pay.parseInvoice(raw({ paidVia: 'cash', txId: '<script>', dueDate: 'soon', locale: 'fr' }))
  assert.equal(odd.paidVia, null)
  assert.equal(odd.txId, null)
  assert.equal(odd.dueDate, null)
  assert.equal(odd.locale, 'ru')
})

test('mock: only in development without HQ_PAY_URL', async () => {
  const dev = await fetchInvoice('FT-2026-001', 'demo', { NODE_ENV: 'development' }, async () => { throw new Error('no call') })
  assert.equal(dev.ok, true)
  assert.equal(dev.invoice.number, 'FT-2026-001')
  assert.equal(mockInvoice.status, 'issued')
  assert.ok(pay.parseInvoice(mockInvoice), 'mock passes the parser')
  assert.deepEqual(await fetchInvoice('FT-2026-001', 'wrong', { NODE_ENV: 'development' }), { ok: false, error: 'not_found' })
  assert.deepEqual(await fetchInvoice('FT-2026-009', 'demo', { NODE_ENV: 'development' }), { ok: false, error: 'not_found' })
  // production never serves the mock
  const res = await fetchInvoice('FT-2026-001', 'demo', { NODE_ENV: 'production' }, async () => { throw new Error('x') })
  assert.deepEqual(res, { ok: false, error: 'not_found' })
  // with HQ_PAY_URL set even in development the real call is made
  let called = false
  await fetchInvoice('FT-2026-001', KEY, { NODE_ENV: 'development', HQ_PAY_URL: 'http://x/pay' }, async () => ((called = true), new Response('{}', { status: 404 })))
  assert.ok(called)
})

test('explorer URLs and tx shortening', () => {
  const tx = 'a'.repeat(64)
  assert.equal(pay.explorerUrl('usdt_trc20', tx), `https://tronscan.org/#/transaction/${tx}`)
  assert.equal(pay.explorerUrl('usdt_ton', tx), `https://tonviewer.com/transaction/${tx}`)
  assert.equal(pay.explorerUrl('manual', tx), null)
  assert.equal(pay.explorerUrl('usdt_ton', null), null)
  assert.equal(pay.explorerUrl('usdt_ton', '<x>'), null)
  assert.equal(pay.shortTx(tx), 'aaaaaaaa...aaaaaa')
  assert.equal(pay.shortTx('abc12345'), 'abc12345')
})

test('amount formatting: always two decimals, cents note only when different', () => {
  assert.equal(pay.formatAmount(150.07), '150.07')
  assert.equal(pay.formatAmount(300), '300.00')
  assert.equal(pay.formatAmount(0.5), '0.50')
  assert.equal(pay.hasCents({ amountUsd: 150, payAmountUsd: 150.07 }), true)
  assert.equal(pay.hasCents({ amountUsd: 300, payAmountUsd: 300 }), false)
  assert.equal(pay.formatPayDate('2026-12-01', 'en'), '1 December 2026')
})

test('sitemap: payment pages are not listed', async () => {
  const urls = (await sitemap()).map((e) => e.url)
  assert.equal(urls.some((u) => /\/pay(\/|$)/.test(u)), false)
})

test('copy: pay section exists in both locales with the same shape, no dashes or dollars', () => {
  const keys = (o) => Object.keys(o).sort()
  assert.deepEqual(keys(en.pay), keys(ru.pay))
  assert.deepEqual(keys(en.pay.paidVia), keys(ru.pay.paidVia))
  function* strings(v) {
    if (typeof v === 'string') yield v
    else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* strings(x)
  }
  for (const dict of [ru, en])
    for (const text of strings(dict.pay)) {
      assert.doesNotMatch(text, /[–—]/, text)
      assert.doesNotMatch(text, /\$\s?\d/, text)
      assert.doesNotMatch(text, /\d+[.,]\d{2}\s?(USDT|\$)/, text)
    }
  assert.match(ru.pay.warning, /только USDT и только в выбранной сети/)
  assert.match(ru.pay.centsNote, /Сумма с копейками/)
  assert.match(en.pay.warning, /only USDT/)
  const payment = ru.terms.sections.find((s) => s.id === 'payment')
  assert.ok(payment.list.some((l) => /картой или по счёту/.test(l)))
  assert.ok(en.terms.sections.find((s) => s.id === 'payment').list.some((l) => /by card or by invoice/.test(l)))
})

test('headers: pay pages send no-referrer and noindex, global rule untouched', async () => {
  const rules = await nextConfig.headers()
  const global = rules.find((r) => r.source === '/:path*')
  assert.equal(global.headers.find((h) => h.key === 'Referrer-Policy').value, 'strict-origin-when-cross-origin')
  const page = rules.find((r) => r.source === '/:locale/pay/:path*')
  assert.equal(page.headers.find((h) => h.key === 'Referrer-Policy').value, 'no-referrer')
  assert.match(page.headers.find((h) => h.key === 'X-Robots-Tag').value, /noindex/)
  assert.ok(rules.indexOf(page) > rules.indexOf(global), 'later rule wins')
  const meta = readFileSync('src/app/[locale]/pay/[number]/page.tsx', 'utf8')
  assert.match(meta, /index: false/)
  assert.match(meta, /referrer: 'no-referrer'/)
  assert.match(meta, /force-dynamic/)
  assert.equal(/generateStaticParams/.test(meta), false)
})
