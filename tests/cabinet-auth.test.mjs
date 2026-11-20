// Cabinet sign-in rework (2026-11-20): error mapping, safe return paths, callback/proxy rules,
// session-cookie label, health page, «Get started» copy.
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

const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const auth = await import('../src/lib/cabinet-auth.ts')
const { hasSessionCookie } = await import('../src/lib/cabinet-client.ts')
const { cabinetHealth } = await import('../src/lib/cabinet-health.ts')
const hq = await import('../src/lib/cabinet-hq.ts')
const { authCookieOptions, serverCookieOptions } = await import('../src/lib/supabase/config.ts')
const sitemap = (await import('../src/app/sitemap.ts')).default

test('auth errors: every Supabase code maps to a key both dictionaries explain', () => {
  const cases = {
    invalid_credentials: 'invalid_credentials',
    email_not_confirmed: 'email_not_confirmed',
    user_already_exists: 'user_exists',
    email_exists: 'user_exists',
    weak_password: 'weak_password',
    same_password: 'same_password',
    over_email_send_rate_limit: 'email_rate_limit',
    over_request_rate_limit: 'rate_limit',
    email_address_not_authorized: 'email_unavailable',
    otp_expired: 'link_expired',
    flow_state_not_found: 'callback',
    flow_state_expired: 'link_expired',
    bad_code_verifier: 'callback',
    pkce_code_verifier_not_found: 'other_browser',
    access_denied: 'oauth_cancelled',
    provider_disabled: 'oauth',
    signup_disabled: 'signup_disabled',
    session_not_found: 'session_expired',
  }
  for (const [code, key] of Object.entries(cases)) assert.equal(auth.authErrorKey({ code }), key, code)
  assert.equal(auth.authErrorKey({ status: 429 }), 'rate_limit')
  assert.equal(auth.authErrorKey({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }), 'network')
  assert.equal(auth.authErrorKey({ message: 'PKCE code verifier not found in storage' }), 'other_browser')
  assert.equal(auth.authErrorKey({ code: 'toString' }), 'generic')
  assert.equal(auth.authErrorKey({ message: 'secret text' }), 'generic')
  assert.equal(auth.authErrorKey(null), 'generic')
  for (const key of auth.authErrorKeys) {
    assert.ok(ru.cabinet.auth.errors[key], `ru ${key}`)
    assert.ok(en.cabinet.auth.errors[key], `en ${key}`)
  }
  assert.equal(auth.isAuthErrorKey('callback'), true)
  assert.equal(auth.isAuthErrorKey('<script>'), false)
})

test('auth log fields: code and status only, never the message', () => {
  const line = auth.authLogFields('sign_in', { code: 'invalid_credentials', status: 400, message: 'a@b.co is wrong' })
  assert.deepEqual(line, { where: 'sign_in', code: 'invalid_credentials', status: 400 })
  assert.equal(auth.authLogFields('x', { code: 'bad code; drop' }).code, 'unknown')
  assert.equal(auth.authLogFields('x', { name: 'AuthPKCECodeVerifierMissingError' }).code, 'AuthPKCECodeVerifierMissingError')
  assert.ok(!JSON.stringify(auth.authLogFields('x', { message: 'token eyJabc' })).includes('eyJ'))
})

test('callback failure: a confirmed sign-up is told to sign in with the password', () => {
  assert.equal(auth.callbackFailureKey('flow_state_not_found', 'signup'), 'confirmed_login')
  assert.equal(auth.callbackFailureKey('pkce_code_verifier_not_found', 'signup'), 'confirmed_login')
  assert.equal(auth.callbackFailureKey('flow_state_not_found', 'oauth'), 'callback')
  assert.equal(auth.callbackFailureKey('otp_expired', 'signup'), 'link_expired')
  assert.equal(auth.callbackFailureKey('access_denied', 'oauth'), 'oauth_cancelled')
  assert.equal(auth.callbackFailureKey(undefined, null), 'callback')
})

test('safe next path: same locale, same site, cabinet fallback', () => {
  assert.equal(auth.safeNextPath('/ru/cabinet/reset', 'ru'), '/ru/cabinet/reset')
  assert.equal(auth.safeNextPath('/ru/builder?b=abc&draft=1#contact', 'ru'), '/ru/builder?b=abc&draft=1#contact')
  assert.equal(auth.safeNextPath('/ru?draft=1#contact', 'ru'), '/ru?draft=1#contact')
  assert.equal(auth.safeNextPath('/ru', 'ru'), '/ru')
  for (const bad of ['//evil.com', 'https://evil.com', '/en/cabinet', '/ruevil', '/ru/../admin', '/ru//x', '/ru/\\evil', '/ru/x\n', null, 42, 'x'.repeat(800)])
    assert.equal(auth.safeNextPath(bad, 'ru'), '/ru/cabinet', String(bad).slice(0, 30))
})

test('OAuth starts in the browser: callback URL, account picker, no server action left', () => {
  const opts = auth.oauthOptions('https://firtech.pro', 'ru', '/ru/audit?draft=1')
  const url = new URL(opts.redirectTo)
  assert.equal(url.origin + url.pathname, 'https://firtech.pro/ru/cabinet/auth/callback')
  assert.equal(url.searchParams.get('next'), '/ru/audit?draft=1')
  assert.equal(url.searchParams.get('flow'), 'oauth')
  assert.deepEqual(opts.queryParams, { prompt: 'select_account' })
  assert.equal(new URL(auth.callbackUrl('https://firtech.pro/', 'en', '//evil', 'signup')).searchParams.get('next'), '/en/cabinet')
  const actions = readFileSync('src/app/[locale]/cabinet/actions.ts', 'utf8')
  assert.ok(!actions.includes('signInWithOAuth'), 'OAuth must not start in a server action')
  const button = readFileSync('src/components/cabinet/oauth-button.tsx', 'utf8')
  assert.match(button, /'use client'/)
  assert.match(button, /from '@\/lib\/supabase\/client'/)
  assert.match(button, /signInWithOAuth/)
  assert.match(readFileSync('src/lib/supabase/client.ts', 'utf8'), /detectSessionInUrl: false/)
  // The flow id rides in the redirect, so the callback can pick this flow's own verifier.
  for (const f of ['client', 'server']) assert.match(readFileSync(`src/lib/supabase/${f}.ts`, 'utf8'), /appendPkceFlowIdToRedirects: true/, f)
})

test('callback: flow id passed, token_hash supported, cookies only on success, retry page', () => {
  const route = readFileSync('src/app/[locale]/cabinet/auth/callback/route.ts', 'utf8')
  assert.match(route, /exchangeCodeForSession\(code, flowId \? \{ flowId \} : undefined\)/)
  assert.match(route, /verifyOtp\(\{ token_hash: tokenHash/)
  assert.match(route, /pending\.push/)
  assert.match(route, /cabinet\/auth\/confirm\?/)
  // Logs carry codes and booleans: never the auth code, the token hash or a slice of them.
  assert.ok(!/codeTail|code\.slice|tokenHash\.slice|\{ code \}|, code\b(?! \?)/.test(route), 'no raw code in logs')
  const retry = readFileSync('src/components/cabinet/callback-retry.tsx', 'utf8')
  assert.match(retry, /exchangeCodeForSession\(code\)/)
  assert.match(retry, /window\.location\.replace\(next\)/)
})

test('proxy: no cookie work on the callback, no-store on cabinet routes; shared cookie options', () => {
  const proxy = readFileSync('src/proxy.ts', 'utf8')
  assert.match(proxy, /isAuthCallbackPath\(pathname\) \? NextResponse\.next\(\)/)
  assert.match(proxy, /'cache-control', 'private, no-store'/)
  assert.equal(auth.isAuthCallbackPath('/ru/cabinet/auth/callback'), true)
  assert.equal(auth.isAuthCallbackPath('/en/cabinet/auth/callback/'), true)
  assert.equal(auth.isAuthCallbackPath('/ru/cabinet'), false)
  assert.equal(auth.isAuthCallbackPath('/ru/cabinet/auth/confirm'), false)
  assert.deepEqual(authCookieOptions(true), { path: '/', sameSite: 'lax', secure: true })
  assert.equal(serverCookieOptions({ NODE_ENV: 'production' }).secure, true)
  assert.equal(serverCookieOptions({ NODE_ENV: 'development' }).secure, false)
  for (const f of ['server', 'middleware', 'client'])
    assert.match(readFileSync(`src/lib/supabase/${f}.ts`, 'utf8'), /cookieOptions: /, f)
  for (const page of ['login/page', 'auth/confirm/page', 'health/page'])
    assert.match(readFileSync(`src/app/[locale]/cabinet/${page}.tsx`, 'utf8'), /export const dynamic = 'force-dynamic'/, page)
})

test('sign-up and resend: check-email shows the address, resend button, two-an-hour limit', () => {
  for (const d of [ru, en]) {
    assert.match(d.cabinet.auth.checkEmailText, /\{email\}/)
    assert.match(d.cabinet.auth.resent, /\{email\}/)
    assert.ok(d.cabinet.auth.resend)
  }
  assert.match(ru.cabinet.auth.mailLimit, /двух раз в час/)
  assert.match(en.cabinet.auth.mailLimit, /twice an hour/)
  const actions = readFileSync('src/app/[locale]/cabinet/actions.ts', 'utf8')
  assert.match(actions, /export async function resendAction/)
  assert.match(actions, /auth\.resend\(\{\s*type: 'signup'/)
  assert.match(actions, /canResend: key === 'email_not_confirmed'/)
  const forms = readFileSync('src/components/cabinet/auth-forms.tsx', 'utf8')
  assert.match(forms, /<ResendBox/)
})

test('session cookie label: a session, not a verifier', () => {
  assert.equal(hasSessionCookie('a=1; sb-lxuigwowgxzjadtenpyk-auth-token=base64-xyz'), true)
  assert.equal(hasSessionCookie('sb-abc-auth-token.0=base64-xyz; x=1'), true)
  assert.equal(hasSessionCookie('sb-abc-auth-token-code-verifier=abc'), false)
  assert.equal(hasSessionCookie('sb-abc-auth-token='), false)
  assert.equal(hasSessionCookie(''), false)
})

test('«Get started»: nav and login copy (owner 2026-11-20)', () => {
  assert.equal(ru.nav.cabinetStart, 'Личный кабинет') // owner 2026-11-21: «Начать» did not read well
  assert.equal(en.nav.cabinetStart, 'Get started')
  assert.equal(ru.nav.cabinet, 'Кабинет')
  assert.equal(en.nav.cabinet, 'Cabinet')
  assert.equal(ru.cabinet.auth.title, 'Начало работы')
  assert.equal(en.cabinet.auth.title, 'Get started')
  assert.equal(ru.cabinet.auth.tabIn, 'Войти')
  assert.equal(ru.cabinet.auth.tabUp, 'Создать аккаунт')
  assert.equal(en.cabinet.auth.tabIn, 'Sign in')
  assert.equal(en.cabinet.auth.tabUp, 'Create account')
  for (const f of ['src/components/header.tsx', 'src/components/footer.tsx'])
    assert.match(readFileSync(f, 'utf8'), /<CabinetNavLabel signedIn=\{dict\.nav\.cabinet\} start=\{dict\.nav\.cabinetStart\} \/>/, f)
})

test('health: booleans only, never a value; noindex and out of the sitemap', async () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://lxuigwowgxzjadtenpyk.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-secret-value',
    SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
    HQ_ADMIN_TOKEN: 'hq-secret',
  }
  const h = cabinetHealth(env)
  assert.deepEqual(h, { supabaseUrl: true, anonKey: true, serviceKey: true, siteUrl: false, hqConfigured: true, leadIntake: false })
  const json = JSON.stringify(h)
  for (const v of Object.values(env)) assert.ok(!json.includes(v))
  assert.equal(cabinetHealth({ NEXT_PUBLIC_SUPABASE_URL: 'nope' }).supabaseUrl, false)
  assert.equal(await hq.pingHq({ NODE_ENV: 'development' }), 'mock')
  assert.equal(await hq.pingHq({ NODE_ENV: 'production' }), 'not_configured')
  const prod = { NODE_ENV: 'production', HQ_ADMIN_TOKEN: 't', HQ_ADMIN_URL: 'http://hq.test/admin' }
  assert.equal(await hq.pingHq(prod, async () => new Response('{}', { status: 404 })), 'ok')
  assert.equal(await hq.pingHq(prod, async () => new Response('{}', { status: 401 })), 'unauthorized')
  assert.equal(await hq.pingHq(prod, async () => { throw new TypeError('down') }), 'unreachable')
  const page = readFileSync('src/app/[locale]/cabinet/health/page.tsx', 'utf8')
  assert.match(page, /robots: \{ index: false, follow: false \}/)
  assert.ok(!/process\.env\.[A-Z_]+\s*\}/.test(page), 'the page never prints an env value')
  const urls = (await sitemap()).map((e) => e.url)
  assert.ok(!urls.some((u) => u.includes('/cabinet')))
  for (const d of [ru, en]) for (const v of Object.values(d.cabinet.health)) assert.doesNotMatch(v, /[–—]/)
})

test('auth-cookies: stale verifier names from a cookie header', async () => {
  const { cookieNamesFromHeader, staleVerifierNames, clearVerifierCookies } = await import('@/lib/auth-cookies')
  const header = 'a=1; sb-x-code-verifier=abc; sb-x-code-verifier.1=z; sb-y-auth-token=t; sb-x-code-verifier=dup; ; =bad'
  const names = cookieNamesFromHeader(header)
  assert.deepEqual(names, ['a', 'sb-x-code-verifier', 'sb-x-code-verifier.1', 'sb-y-auth-token', 'sb-x-code-verifier'])
  assert.deepEqual(staleVerifierNames(names), ['sb-x-code-verifier'])
  assert.deepEqual(staleVerifierNames(names, ['sb-x-code-verifier']), [])
  assert.deepEqual(staleVerifierNames([]), [])
  const doc = { cookie: 'k=1; sb-a-code-verifier=v; sb-b-code-verifier=w' }
  const writes = []
  const proxy = { get cookie() { return doc.cookie }, set cookie(v) { writes.push(v) } }
  assert.equal(clearVerifierCookies(proxy), 2)
  assert.ok(writes.every((w) => w.includes('Path=/') && w.includes('Max-Age=0')))
  assert.equal(clearVerifierCookies(undefined), 0)
})

test('callback expires stale verifiers and logs cookieBytes', () => {
  const src = readFileSync('src/app/[locale]/cabinet/auth/callback/route.ts', 'utf8')
  assert.match(src, /staleVerifierNames/)
  assert.match(src, /maxAge: 0/)
  assert.match(src, /cookieBytes/)
})
