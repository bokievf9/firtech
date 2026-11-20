// Client cabinet (2026-11-19): HQ client, sync body, referral link, copy, sitemap, soon state.
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
const hq = await import('../src/lib/cabinet-hq.ts')
const data = await import('../src/lib/cabinet-data.ts')
const auth = await import('../src/lib/cabinet-auth.ts')
const { supabaseConfig, cabinetEnabled } = await import('../src/lib/supabase/config.ts')
const sitemap = (await import('../src/app/sitemap.ts')).default
const { referralPercent } = await import('../src/lib/pricing.ts')

const env = { HQ_ADMIN_URL: 'http://hq.test/admin', HQ_ADMIN_TOKEN: 'secret-token', NODE_ENV: 'production' }
const reply = (status, body) => async () => new Response(JSON.stringify(body), { status })

const goodBody = {
  ok: true,
  client: { id: 7, name: 'Алиса', email: 'a@b.co', telegram: '@alice', createdAt: '2026-11-01T00:00:00Z' },
  projects: [
    { id: 1, what: 'Сайт', product: 'site', status: 'active', stage: 'brief', deadline: '2026-12-01T00:00:00Z',
      nextMilestone: { kind: 'brief', title: 'Бриф', dueAt: null }, tasksTotal: 4, tasksDone: 1, createdAt: null },
    { what: 'no id' },
  ],
  invoices: [{ id: 'bl:5', kind: 'invoice', status: 'issued', title: 'Сайт', amountUsd: 300, number: 'FT-1', createdAt: null }],
  documents: [{ id: 'bo:1', source: 'back_office', kind: 'contract', status: 'approved', title: 'Договор', excerpt: 'x', createdAt: null }],
  tickets: [{ id: 3, text: 'hi', status: 'weird', createdAt: null, answeredAt: null }],
  referrals: [{ id: 1, referred: 'Боб', status: 'proposed', reward: '10%', createdAt: null, paidAt: null, rewardedAt: null }],
  referralSlug: 'Alice Smith',
}

test('fetchClientByEmail: parses a good body, drops broken rows, calls the right URL with the token', async () => {
  let seen
  const fetcher = async (url, init) => {
    seen = { url, init }
    return new Response(JSON.stringify(goodBody), { status: 200 })
  }
  const r = await hq.fetchClientByEmail(' A@B.co ', env, fetcher)
  assert.equal(r.ok, true)
  assert.equal(seen.url, 'http://hq.test/admin/clients/by-email?email=a%40b.co')
  assert.equal(seen.init.headers['x-admin-token'], 'secret-token')
  assert.equal(r.data.client.id, 7)
  assert.equal(r.data.projects.length, 1)
  assert.equal(r.data.tickets[0].status, 'open')
  assert.equal(r.data.referralSlug, 'alice_smith')
  assert.equal(r.data.invoices[0].amountUsd, 300)
})

test('fetchClientByEmail: failure modes map to the short codes and never leak the token', async () => {
  const cases = [
    [reply(404, { ok: false, error: 'not_found' }), 'not_found'],
    [reply(500, {}), 'hq_error'],
    [reply(401, {}), 'hq_error'],
    [reply(200, { ok: true, client: {} }), 'hq_error'],
    [reply(200, 'nope'), 'hq_error'],
    [async () => { throw new TypeError('fetch failed secret-token') }, 'hq_unreachable'],
    [async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }) }, 'hq_timeout'],
  ]
  for (const [fetcher, code] of cases) {
    const r = await hq.fetchClientByEmail('a@b.co', env, fetcher)
    assert.deepEqual(r, { ok: false, error: code })
    assert.ok(!JSON.stringify(r).includes('secret-token'))
  }
  assert.deepEqual(await hq.fetchClientByEmail('', env, reply(200, goodBody)), { ok: false, error: 'not_found' })
})

test('hq: production without a token sends nothing; development without env gets the mock', async () => {
  let called = false
  const fetcher = async () => { called = true; return new Response('{}') }
  const prod = await hq.fetchClientByEmail('a@b.co', { NODE_ENV: 'production' }, fetcher)
  assert.deepEqual(prod, { ok: false, error: 'hq_error' })
  assert.equal(called, false)
  const dev = await hq.fetchClientByEmail('a@b.co', { NODE_ENV: 'development' }, fetcher)
  assert.equal(dev.ok, true)
  assert.equal(dev.data.client.email, 'a@b.co')
  assert.equal(called, false)
  const t = await hq.createClientTicket(1, 'hello', { NODE_ENV: 'development' }, fetcher)
  assert.equal(t.ok && t.data.text, 'hello')
})

test('createClientTicket: POST body, item parsing, errors', async () => {
  let seen
  const fetcher = async (url, init) => {
    seen = { url, init }
    return new Response(JSON.stringify({ ok: true, item: { id: 9, text: 'hi', status: 'open', createdAt: '2026-11-19T00:00:00Z', answeredAt: null } }))
  }
  const r = await hq.createClientTicket(7, '  hi  ', env, fetcher)
  assert.equal(seen.url, 'http://hq.test/admin/clients/7/tickets')
  assert.equal(seen.init.method, 'POST')
  assert.deepEqual(JSON.parse(seen.init.body), { text: 'hi' })
  assert.equal(r.ok && r.data.id, 9)
  assert.deepEqual(await hq.createClientTicket(7, 'x', env, reply(404, {})), { ok: false, error: 'not_found' })
  assert.deepEqual(await hq.createClientTicket(7, 'x', env, reply(200, { ok: true })), { ok: false, error: 'hq_error' })
  assert.deepEqual(await hq.createClientTicket(7, '   ', env, reply(200, {})), { ok: false, error: 'hq_error' })
})

test('HQ client sync: body shape and POST', async () => {
  const profile = { email: ' A@B.co ', name: ' Алиса ', telegram: null, locale: 'en', marketing_consent: true }
  const body = data.clientSyncBody('uid-1', profile)
  assert.deepEqual(body, { email: 'a@b.co', name: 'Алиса', telegram: '', locale: 'en', supabaseId: 'uid-1', marketingConsent: true })
  assert.equal(data.clientSyncBody('u', { ...profile, locale: 'de', marketing_consent: null }).locale, 'ru')
  assert.equal(data.clientSyncBody('u', { ...profile, marketing_consent: null }).marketingConsent, false)
  let seen
  const r = await hq.syncClientToHq('uid-1', profile, env, async (url, init) => {
    seen = { url, init }
    return new Response(JSON.stringify({ ok: true }))
  })
  assert.equal(r.ok, true)
  assert.equal(seen.url, 'http://hq.test/admin/clients')
  assert.equal(seen.init.method, 'POST')
  assert.deepEqual(JSON.parse(seen.init.body), body)
  assert.deepEqual(await hq.syncClientToHq('u', profile, env, reply(500, {})), { ok: false, error: 'hq_error' })
})

test('referral link builder and rule', () => {
  assert.equal(data.cabinetRefLink('ru', 'alice', 'https://firtech.pro'), 'https://firtech.pro/ru/?ref=alice')
  assert.equal(data.cabinetRefLink('en', 'Alice B', 'https://firtech.pro/'), 'https://firtech.pro/en/?ref=alice_b')
  assert.equal(data.cabinetRefLink('ru', null), null)
  assert.equal(data.cabinetRefLink('ru', '!!!'), null)
  assert.match(ru.cabinet.referral.rule, /\{percent\}/)
  assert.ok(!/\d+\s?%/.test(ru.cabinet.referral.rule + en.cabinet.referral.rule))
  assert.equal(typeof referralPercent, 'number')
})

test('project progress, safe next path, telegram, dates', () => {
  assert.deepEqual(data.projectProgress({ stage: 'prototype', status: 'active', tasksDone: 1, tasksTotal: 4 }), { stageIndex: 2, percent: 25 })
  assert.equal(data.projectProgress({ stage: 'done', status: 'done', tasksDone: 0, tasksTotal: 0 }).percent, 100)
  assert.equal(data.projectProgress({ stage: 'x', status: 'active', tasksDone: 0, tasksTotal: 0 }).stageIndex, -1)
  assert.equal(data.safeCabinetNext('/ru/cabinet/reset', 'ru'), '/ru/cabinet/reset')
  for (const bad of ['//evil.com', 'https://evil.com', '/en/cabinet', '/ru/cabinetx', '/ru/cabinet/../admin', '/ru/cabinet//x', null])
    assert.equal(data.safeCabinetNext(bad, 'ru'), '/ru/cabinet', String(bad))
  assert.equal(data.normalizeTelegram('t.me/alice_1'), '@alice_1')
  assert.equal(data.normalizeTelegram(''), '')
  assert.equal(data.normalizeTelegram('ab'), null)
  assert.equal(data.formatDate('2026-11-19T23:59:00Z', 'en'), 'Nov 19, 2026')
  assert.equal(data.formatDate(null, 'ru'), '')
})

test('auth: error mapping, validation, redirect origin', () => {
  assert.equal(auth.authErrorKey({ code: 'invalid_credentials' }), 'invalid_credentials')
  assert.equal(auth.authErrorKey({ message: 'User already registered' }), 'user_exists')
  assert.equal(auth.authErrorKey({ status: 429 }), 'rate_limit')
  assert.equal(auth.authErrorKey({ message: 'boom' }), 'generic')
  for (const key of Object.keys(ru.cabinet.auth.errors)) assert.ok(en.cabinet.auth.errors[key], key)
  for (const k of ['invalid_credentials', 'email_not_confirmed', 'user_exists', 'weak_password', 'rate_limit', 'invalid_email', 'invalid_input', 'callback', 'oauth', 'unavailable', 'generic'])
    assert.ok(ru.cabinet.auth.errors[k], k)
  assert.equal(auth.signUpSchema.safeParse({ email: 'x', password: '12345678', name: '', telegram: '', marketing: false }).success, false)
  assert.equal(auth.signUpSchema.safeParse({ email: 'A@B.co', password: '12345678', name: '', telegram: '', marketing: true }).data.email, 'a@b.co')
  assert.equal(auth.resetSchema.safeParse({ password: '1234567' }).success, false)
  assert.equal(auth.appOrigin(new Headers({ host: 'evil.com' }), { NODE_ENV: 'production' }), 'https://firtech.pro')
  assert.equal(auth.appOrigin(new Headers({ host: 'localhost:3001' }), { NODE_ENV: 'development' }), 'http://localhost:3001')
  assert.equal(auth.isOAuthProvider('google'), true)
  assert.equal(auth.isOAuthProvider('apple'), false)
  assert.deepEqual(auth.oauthProviders, ['google'])
  assert.equal(auth.isOAuthProvider('github'), false)
})

test('cabinet copy: same shape in ru and en, no long dashes, no AI tells, no dollar amounts', () => {
  const shape = (v) => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v)
  assert.deepEqual(shape(ru.cabinet), shape(en.cabinet))
  assert.ok(ru.nav.cabinet && en.nav.cabinet)
  const tells = [/\bэто не [^.!?]{1,60}, а\b/i, /\bit'?s not [^.!?]{1,60}, it'?s\b/i, /\bне только [^.!?]{1,60}, но и\b/i, /, (позволяя|делая|помогая|allowing|making|helping)\b/i]
  const accounts = (d) => d.privacy.sections.find((s) => s.id === 'accounts')
  assert.ok(accounts(ru) && accounts(en))
  const pieces = [ru.cabinet, en.cabinet, accounts(ru), accounts(en)]
  function* strings(value) {
    if (typeof value === 'string') yield value
    else if (Array.isArray(value)) for (const v of value) yield* strings(v)
    else if (value && typeof value === 'object') for (const v of Object.values(value)) yield* strings(v)
  }
  for (const piece of pieces)
    for (const text of strings(piece)) {
      assert.doesNotMatch(text, /[–—]/, text)
      assert.doesNotMatch(text, /\$\s?\d/, text)
      for (const re of tells) assert.doesNotMatch(text, re, text)
    }
  // The login page promises exactly what the owner asked for.
  assert.equal(ru.cabinet.auth.tabIn, 'Войти')
  assert.equal(ru.cabinet.auth.tabUp, 'Создать аккаунт')
  assert.equal(ru.cabinet.auth.google, 'Продолжить с Google')
  assert.equal(ru.cabinet.soon.title, 'Кабинет скоро откроется')
  // No wallet addresses on the site.
  for (const text of strings(ru.cabinet)) assert.doesNotMatch(text, /\bT[A-Za-z0-9]{33}\b|0x[0-9a-f]{40}/)
})

test('sitemap leaves the cabinet out; cabinet pages are noindex', async () => {
  const urls = (await sitemap()).map((e) => e.url)
  assert.ok(urls.length > 10)
  assert.ok(!urls.some((u) => u.includes('cabinet')))
  const layout = readFileSync('src/app/[locale]/cabinet/layout.tsx', 'utf8')
  assert.match(layout, /index:\s*false/)
})

test('without Supabase env the cabinet is switched off and every page shows the soon state', () => {
  assert.equal(supabaseConfig({}), null)
  assert.equal(supabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }), null)
  assert.equal(supabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'nope', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' }), null)
  assert.equal(cabinetEnabled({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' }), true)
  for (const page of ['page', 'login/page', 'reset/page']) {
    const file = `src/app/[locale]/cabinet/${page}.tsx`
    assert.ok(existsSync(file), file)
    const code = readFileSync(file, 'utf8')
    assert.match(code, /if \(!cabinetEnabled\(\)\) return <CabinetSoon/, file)
    // The gate comes before anything reads cookies or the session.
    assert.ok(code.indexOf('cabinetEnabled()') < code.indexOf('await createClient(') || !code.includes('await createClient('), file)
  }
  assert.ok(ru.cabinet.soon.title && en.cabinet.soon.title)
  // Header and footer show the link only when told the cabinet is on.
  assert.match(readFileSync('src/components/header.tsx', 'utf8'), /cabinet && \(/)
  assert.match(readFileSync('src/app/[locale]/layout.tsx', 'utf8'), /cabinet=\{cabinet\}/)
})

test('proxy keeps the "/" redirect and refreshes sessions on cabinet routes only', () => {
  const code = readFileSync('src/proxy.ts', 'utf8')
  assert.match(code, /matcher: \[[^\]]*'\/',[^\]]*'\/\(ru\|en\)\/cabinet',\s*'\/\(ru\|en\)\/cabinet\/:path\*',?\s*\]/)
  assert.match(code, /pickLocale/)
  for (const f of ['server', 'client', 'middleware']) assert.ok(existsSync(`src/lib/supabase/${f}.ts`), f)
})

test('migration: profiles table, RLS, own-row policies, trigger, hq_synced_at', () => {
  const sql = readFileSync('supabase/migrations/0001_profiles.sql', 'utf8')
  for (const part of [/create table if not exists public\.profiles/, /references auth\.users \(id\) on delete cascade/, /email text unique not null/, /hq_synced_at timestamptz/, /enable row level security/, /for select to authenticated using \(auth\.uid\(\) = id\)/, /for update to authenticated/, /after insert on auth\.users/, /marketing_consent/])
    assert.match(sql, part)
})
