#!/usr/bin/env node
// Browser smoke test of the cabinet sign-in and the gated lead forms (not part of `npm test`).
//
// It starts a tiny fake Supabase Auth (GoTrue) on SMOKE_AUTH_PORT (default 3012) and `next start` on
// SMOKE_PORT (default 3011), then drives headless Chromium through:
//   1. /ru/cabinet/login renders both forms (tabs, Google) with the «Начало работы» title;
//   2. sign-up ends on «Проверьте почту» with the address and the resend button, resend works;
//   3. sign-in with an unconfirmed address shows the sentence and the resend button;
//   4. «Продолжить с Google» leaves for /auth/v1/authorize from the browser, with our callback,
//      `prompt=select_account`, `sb_flow_id`, and a verifier cookie in the browser;
//   5. the home contact form shows the sign-in step for a signed-out visitor and keeps the draft;
//   6. POST /api/lead without a session answers 401;
//   7. /ru/cabinet/health renders yes/no rows.
// Screenshots go to .smoke/ (gitignored).
//
// The site must be built with the fake auth URL baked in (NEXT_PUBLIC_* are build-time):
//   NEXT_PUBLIC_SUPABASE_URL=http://localhost:3012 NEXT_PUBLIC_SUPABASE_ANON_KEY=smoke-anon \
//   NEXT_PUBLIC_SITE_URL=http://localhost:3011 npm run build
//   node scripts/smoke-cabinet.mjs
// Playwright: PLAYWRIGHT_CORE=<path to a playwright-core package> (else `playwright-core` or
// `playwright` from node_modules) and CHROME_PATH=<browser binary> (else the newest headless shell
// in ~/Library/Caches/ms-playwright).
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const PORT = Number(process.env.SMOKE_PORT || 3011)
const AUTH_PORT = Number(process.env.SMOKE_AUTH_PORT || 3012)
const SITE = `http://localhost:${PORT}`
const AUTH = `http://localhost:${AUTH_PORT}`
const OUT = path.resolve('.smoke')
mkdirSync(OUT, { recursive: true })

async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_CORE, 'playwright-core', 'playwright'].filter(Boolean)
  for (const c of candidates) {
    try {
      const spec = c.startsWith('/') ? pathToFileURL(path.join(c, 'index.mjs')).href : c
      const mod = await import(spec)
      return mod.chromium ?? mod.default?.chromium
    } catch {}
  }
  throw new Error('playwright-core not found: set PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core')
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const cache = path.join(homedir(), 'Library/Caches/ms-playwright')
  if (!existsSync(cache)) return undefined
  const shells = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()
  for (const dir of shells) {
    for (const sub of readdirSync(path.join(cache, dir))) {
      const bin = path.join(cache, dir, sub, 'chrome-headless-shell')
      if (existsSync(bin)) return bin
    }
  }
  return undefined
}

// Fake GoTrue: just enough for sign-up, sign-in, resend, user and the OAuth start.
const authCalls = []
const fakeAuth = createServer((req, res) => {
  const url = new URL(req.url, AUTH)
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const json = (status, data) => {
      res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' })
      res.end(JSON.stringify(data))
    }
    authCalls.push(`${req.method} ${url.pathname}`)
    if (req.method === 'OPTIONS') return json(204, {})
    const input = body ? JSON.parse(body) : {}
    if (url.pathname === '/auth/v1/signup') {
      return json(200, { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: input.email, identities: [{ id: 'i1' }], created_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} })
    }
    if (url.pathname === '/auth/v1/token') {
      if (String(input.email ?? '').startsWith('unconfirmed')) return json(400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' })
      return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
    }
    if (url.pathname === '/auth/v1/resend') return json(200, {})
    if (url.pathname === '/auth/v1/user') return json(401, { code: 401, error_code: 'no_authorization', msg: 'no session' })
    if (url.pathname === '/auth/v1/authorize') {
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end('<h1>fake google</h1>')
    }
    json(404, { code: 404, msg: 'not found' })
  })
})

function startNext() {
  const child = spawn('npx', ['next', 'start', '--port', String(PORT)], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: AUTH,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'smoke-anon',
      NEXT_PUBLIC_SITE_URL: SITE,
      DATA_DIR: path.join(OUT, 'data'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (d) => process.env.SMOKE_VERBOSE && process.stdout.write(d))
  child.stderr.on('data', (d) => process.env.SMOKE_VERBOSE && process.stderr.write(d))
  return child
}

async function waitFor(url, ms = 30_000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    try {
      const r = await fetch(url)
      if (r.status < 500) return
    } catch {}
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`timeout waiting for ${url}`)
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
}

await new Promise((r) => fakeAuth.listen(AUTH_PORT, r))
const next = startNext()
let browser
try {
  await waitFor(`${SITE}/ru`)
  const chromium = await loadPlaywright()
  browser = await chromium.launch({ executablePath: chromePath(), headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ru-RU' })
  const page = await context.newPage()

  // 1. Login page.
  await page.goto(`${SITE}/ru/cabinet/login`)
  const title = await page.locator('h1').first().innerText()
  check('login: title «Начало работы»', title.includes('Начало работы'), title)
  check('login: tabs and Google', (await page.getByRole('tab', { name: 'Войти' }).count()) === 1 && (await page.getByRole('tab', { name: 'Создать аккаунт' }).count()) === 1 && (await page.getByRole('button', { name: 'Продолжить с Google' }).count()) === 1)
  await page.screenshot({ path: path.join(OUT, '01-login.png'), fullPage: true })

  // 2. Sign-up -> check email + resend.
  await page.getByRole('tab', { name: 'Создать аккаунт' }).click()
  const up = page.locator('[role=tabpanel]')
  await up.getByLabel('Имя').fill('Smoke')
  await up.getByLabel('Почта').fill('smoke@example.com')
  await up.getByLabel('Пароль').fill('smoke-pass-123')
  await up.getByRole('button', { name: 'Создать аккаунт' }).click()
  await page.getByText('Проверьте почту').first().waitFor({ timeout: 10_000 })
  check('sign-up: «Проверьте почту» with the address', (await page.getByText('smoke@example.com').count()) > 0)
  await page.getByRole('button', { name: 'Отправить письмо ещё раз' }).click()
  await page.getByText('Отправили ещё раз на smoke@example.com.').waitFor({ timeout: 10_000 })
  check('sign-up: resend answered', authCalls.includes('POST /auth/v1/resend'))
  await page.screenshot({ path: path.join(OUT, '02-signup-check-email.png'), fullPage: true })

  // 3. Unconfirmed sign-in.
  await page.goto(`${SITE}/ru/cabinet/login`)
  const inPanel = page.locator('[role=tabpanel]')
  await inPanel.getByLabel('Почта').fill('unconfirmed@example.com')
  await inPanel.getByLabel('Пароль').fill('whatever-123')
  await inPanel.getByRole('button', { name: 'Войти' }).click()
  await page.getByText('Почта ещё не подтверждена').waitFor({ timeout: 10_000 })
  check('sign-in: unconfirmed message and resend button', (await page.getByRole('button', { name: 'Отправить письмо ещё раз' }).count()) === 1)
  await page.screenshot({ path: path.join(OUT, '03-signin-unconfirmed.png'), fullPage: true })

  // 4. Google starts in the browser.
  await page.goto(`${SITE}/ru/cabinet/login`)
  await Promise.all([page.waitForURL(/\/auth\/v1\/authorize/, { timeout: 10_000 }), page.getByRole('button', { name: 'Продолжить с Google' }).click()])
  const auth = new URL(page.url())
  const redirectTo = new URL(auth.searchParams.get('redirect_to') ?? 'http://x/')
  check('google: browser went to /authorize with provider=google', auth.searchParams.get('provider') === 'google')
  check('google: redirect_to is our callback with sb_flow_id', redirectTo.pathname === '/ru/cabinet/auth/callback' && redirectTo.searchParams.has('sb_flow_id'), redirectTo.pathname)
  check('google: prompt=select_account', auth.searchParams.get('prompt') === 'select_account')
  check('google: PKCE challenge sent', Boolean(auth.searchParams.get('code_challenge')))
  const cookies = await context.cookies(SITE)
  check('google: verifier cookie in the browser (path /, lax)', cookies.some((c) => c.name.endsWith('-code-verifier') && c.path === '/' && c.sameSite === 'Lax'))
  await page.screenshot({ path: path.join(OUT, '04-google-authorize.png') })

  // A failed callback lands on the retry page, then on a readable error.
  await page.goto(`${SITE}/ru/cabinet/auth/callback?code=bad-code&flow=oauth&next=%2Fru%2Fcabinet`)
  await page.getByText('Вход не завершён').waitFor({ timeout: 15_000 })
  check('callback: failure ends on a readable sentence', page.url().includes('/cabinet/auth/confirm') || page.url().includes('/cabinet/login'), new URL(page.url()).pathname)
  await page.screenshot({ path: path.join(OUT, '05-callback-failed.png'), fullPage: true })

  // 5. Contact form while signed out.
  const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ru-RU' })
  const home = await fresh.newPage()
  await home.goto(`${SITE}/ru#contact`)
  const form = home.locator('#contact form').first()
  await form.waitFor({ timeout: 15_000 })
  await form.locator('[name=name]').fill('Smoke Lead')
  await form.locator('[name=contact]').fill('@smoke_lead')
  await form.locator('[name=message]').fill('Нужен бот для записи')
  check('lead form: the why sentence is shown', (await home.locator('[data-lead-why]').count()) > 0)
  await form.locator('button[type=submit]').click()
  await home.locator('[data-lead-auth]').waitFor({ timeout: 10_000 })
  check('lead form: sign-in step appears inline', (await home.locator('[data-lead-auth] [data-auth-forms=compact]').count()) === 1)
  const draft = await home.evaluate(() => localStorage.getItem('fir-draft-lead'))
  check('lead form: draft kept', Boolean(draft && draft.includes('Smoke Lead') && !draft.includes('website')))
  await home.locator('[data-lead-auth]').screenshot({ path: path.join(OUT, '06-lead-auth-step.png') })
  await home.screenshot({ path: path.join(OUT, '06-lead-form-page.png') })

  // Draft restored on return with draft=1.
  await home.goto(`${SITE}/ru?draft=1#contact`)
  await home.waitForTimeout(1500)
  check('lead form: draft restored on draft=1', (await home.locator('#contact form [name=name]').first().inputValue()) === 'Smoke Lead')

  // Audit form shows the same step.
  await home.goto(`${SITE}/ru/audit`)
  await home.locator('[name=url]').fill('example.com')
  await home.locator('[name=contact]').fill('@smoke_lead')
  await home.locator('form button[type=submit]').first().click()
  await home.locator('[data-lead-auth]').waitFor({ timeout: 10_000 })
  check('audit form: sign-in step appears inline', true)
  await home.screenshot({ path: path.join(OUT, '07-audit-auth-step.png'), fullPage: true })

  // 6. API without a session.
  const api = await fetch(`${SITE}/api/lead`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'x', contact: '@smoke_x' }) })
  check('api: /api/lead without a session = 401', api.status === 401, String(api.status))
  const audit = await fetch(`${SITE}/api/audit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com', contact: '@smoke_x', locale: 'ru' }) })
  check('api: /api/audit without a session = 401', audit.status === 401, String(audit.status))

  // 7. Health.
  await home.goto(`${SITE}/ru/cabinet/health`)
  const rows = await home.locator('[data-health] > div').count()
  const robots = await home.locator('meta[name=robots]').first().getAttribute('content')
  check('health: rows rendered, noindex', rows >= 6 && /noindex/.test(robots ?? ''), `${rows} rows, ${robots}`)
  const html = await home.content()
  check('health: no key values on the page', !html.includes('smoke-anon'))
  await home.screenshot({ path: path.join(OUT, '08-health.png'), fullPage: true })

  // Header label for a signed-out visitor.
  await home.goto(`${SITE}/ru`)
  check('header: «Начать» while signed out', (await home.locator('[data-place=header-cabinet]').innerText()).includes('Начать'))
} catch (error) {
  check('smoke run', false, error instanceof Error ? error.message : String(error))
} finally {
  await browser?.close()
  next.kill('SIGTERM')
  fakeAuth.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed; screenshots in ${OUT}`)
process.exit(failed.length ? 1 : 0)
