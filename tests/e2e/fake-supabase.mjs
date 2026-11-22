// A tiny stand-in for Supabase (auth + the `profiles` table over PostgREST) so the signed-in cabinet can
// be tested and screenshotted without a real project. Only what the cabinet calls is answered.
// Run: `node tests/e2e/fake-supabase.mjs` (port FAKE_SUPABASE_PORT, default 3418), then start the site with
// NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<port> and put the cookie from `sessionCookie()` into the browser.
// FAKE_SUPABASE_LEGACY=1 = a database where migration 0003 was not run (the new profile columns are missing).
// FAKE_SUPABASE_RLS=deny = the update policy is missing (PostgREST answers 42501).
// Test hooks: `POST /__fake/reset` (back to the seed), `POST /__fake/mode {legacy?, rls?, delayMs?}`, `GET /__fake/profile`.
import { createServer } from 'node:http'

export const FAKE_USER = { id: '00000000-0000-4000-8000-0000000000e2', email: 'anna@example.com' }

const BASE_COLUMNS = ['id', 'email', 'name', 'telegram', 'locale', 'marketing_consent', 'hq_synced_at', 'created_at', 'updated_at']
const NEW_COLUMNS = [
  'phone', 'company', 'niche', 'website', 'city', 'legal_name', 'legal_address', 'refund_wallet',
  'recommendations_consent', 'notify_channel',
]

function b64url(text) {
  return Buffer.from(text).toString('base64url')
}

export function fakeAccessToken(userId = FAKE_USER.id) {
  const exp = Math.floor(Date.now() / 1000) + 30 * 86400
  return `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ sub: userId, exp, role: 'authenticated', aud: 'authenticated' }))}.fake`
}

function fakeUser() {
  return {
    id: FAKE_USER.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: FAKE_USER.email,
    email_confirmed_at: '2026-11-01T10:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: 'Анна' },
    identities: [{ id: FAKE_USER.id, provider: 'email', identity_data: { email: FAKE_USER.email } }],
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
  }
}

export function fakeSession() {
  const now = Math.floor(Date.now() / 1000)
  return {
    access_token: fakeAccessToken(),
    refresh_token: 'fake-refresh',
    token_type: 'bearer',
    expires_in: 30 * 86400,
    expires_at: now + 30 * 86400,
    user: fakeUser(),
  }
}

// The cookie @supabase/ssr reads for a project at http://127.0.0.1:<port>: `sb-127-auth-token`.
export function sessionCookie() {
  return { name: 'sb-127-auth-token', value: `base64-${b64url(JSON.stringify(fakeSession()))}` }
}

function seed() {
  return {
    [FAKE_USER.id]: {
      id: FAKE_USER.id,
      email: FAKE_USER.email,
      name: 'Анна',
      telegram: '@anna_salon',
      locale: 'ru',
      marketing_consent: false,
      hq_synced_at: '2026-11-01T10:00:00Z',
      created_at: '2026-11-01T10:00:00Z',
      updated_at: '2026-11-01T10:00:00Z',
      phone: null,
      company: null,
      niche: null,
      website: null,
      city: null,
      legal_name: null,
      legal_address: null,
      refund_wallet: null,
      recommendations_consent: false,
      notify_channel: 'email',
    },
  }
}

const state = {
  rows: seed(),
  legacy: process.env.FAKE_SUPABASE_LEGACY === '1',
  rls: process.env.FAKE_SUPABASE_RLS === 'deny' ? 'deny' : 'ok',
  delayMs: 0,
  authCalls: [],
}

const columns = () => (state.legacy ? BASE_COLUMNS : [...BASE_COLUMNS, ...NEW_COLUMNS])

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

const pgError = (res, status, code, message) => send(res, status, { code, message, details: null, hint: null })

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const SERVICE = '*service-role*'

function userFromAuth(req) {
  const auth = req.headers.authorization ?? ''
  const token = auth.replace(/^Bearer /, '')
  if (token && token === (process.env.FAKE_SUPABASE_SERVICE_KEY ?? 'dev-service')) return SERVICE
  if (!token || token.split('.').length !== 3) return null
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return payload.sub === FAKE_USER.id ? FAKE_USER.id : null
  } catch {
    return null
  }
}

function project(row, select) {
  if (!select || select === '*') return Object.fromEntries(columns().map((c) => [c, row[c] ?? null]))
  return Object.fromEntries(select.split(',').map((c) => [c.trim(), row[c.trim()] ?? null]))
}

function unknownColumn(names) {
  const known = new Set(columns())
  return names.find((n) => !known.has(n))
}

async function handleRest(req, res, url) {
  const select = url.searchParams.get('select')
  const idFilter = url.searchParams.get('id')?.replace(/^eq\./, '')
  const uid = userFromAuth(req)
  if (select && select !== '*') {
    const missing = unknownColumn(select.split(',').map((c) => c.trim()))
    if (missing) return pgError(res, 400, '42703', `column profiles.${missing} does not exist`)
  }
  const visible = (id) => uid === SERVICE || (uid && id === uid)
  if (req.method === 'GET') {
    const rows = Object.values(state.rows).filter((r) => (!idFilter || r.id === idFilter) && visible(r.id))
    return send(res, 200, rows.map((r) => project(r, select)))
  }
  const body = await readBody(req)
  if (body && typeof body === 'object') {
    const missing = unknownColumn(Object.keys(Array.isArray(body) ? body[0] ?? {} : body))
    if (missing) return pgError(res, 400, 'PGRST204', `Could not find the '${missing}' column of 'profiles' in the schema cache`)
  }
  if (req.method === 'PATCH') {
    if (state.rls === 'deny') return pgError(res, 403, '42501', 'permission denied for table profiles')
    const row = idFilter ? state.rows[idFilter] : null
    if (!row || !visible(row.id)) return send(res, 200, [])
    Object.assign(row, body, { updated_at: new Date().toISOString() })
    return send(res, 200, [project(row, select)])
  }
  if (req.method === 'POST') {
    if (state.rls === 'deny') return pgError(res, 403, '42501', 'permission denied for table profiles')
    const values = Array.isArray(body) ? body[0] : body
    if (!values || !visible(values.id)) return pgError(res, 403, '42501', 'new row violates row-level security policy')
    state.rows[values.id] = { ...seed()[FAKE_USER.id], ...(state.rows[values.id] ?? {}), ...values, updated_at: new Date().toISOString() }
    return send(res, 201, [project(state.rows[values.id], select)])
  }
  return send(res, 405, { message: 'method' })
}

async function handleAuth(req, res, url) {
  const path = url.pathname.replace(/^\/auth\/v1/, '')
  if (path === '/user' && req.method === 'GET') {
    return userFromAuth(req) === FAKE_USER.id ? send(res, 200, fakeUser()) : send(res, 401, { code: 'bad_jwt', msg: 'invalid JWT' })
  }
  if (path === '/user' && req.method === 'PUT') {
    if (!userFromAuth(req)) return send(res, 401, { code: 'bad_jwt', msg: 'invalid JWT' })
    const body = (await readBody(req)) ?? {}
    const user = fakeUser()
    if (body.email) user.new_email = body.email
    return send(res, 200, user)
  }
  if (path === '/token') {
    const body = (await readBody(req)) ?? {}
    if (url.searchParams.get('grant_type') === 'password') {
      if (body.email === FAKE_USER.email && body.password === 'correct-horse-1') return send(res, 200, fakeSession())
      return send(res, 400, { code: 'invalid_credentials', msg: 'Invalid login credentials' })
    }
    return send(res, 200, fakeSession())
  }
  // Code sign-in (2026-11-22): sign-up, resend and recover always answer; the code 123456 verifies, any other is the
  // `otp_expired` error Supabase gives for a wrong or an old code. `/__fake/auth` records the calls.
  if (path === '/signup' && req.method === 'POST') {
    const body = (await readBody(req)) ?? {}
    state.authCalls.push({ path, email: body.email })
    if (body.email === 'exists@example.com') return send(res, 200, { ...fakeUser(), email: body.email, identities: [] })
    const user = { ...fakeUser(), email: body.email, email_confirmed_at: null }
    return send(res, 200, user)
  }
  if ((path === '/resend' || path === '/recover') && req.method === 'POST') {
    const body = (await readBody(req)) ?? {}
    state.authCalls.push({ path, email: body.email, type: body.type })
    return send(res, 200, {})
  }
  if (path === '/verify' && req.method === 'POST') {
    const body = (await readBody(req)) ?? {}
    state.authCalls.push({ path, email: body.email, type: body.type, token: body.token })
    if (body.token === '123456') return send(res, 200, fakeSession())
    if (body.token === '999999') return send(res, 429, { code: 'over_request_rate_limit', msg: 'Too many requests' })
    return send(res, 403, { code: 'otp_expired', msg: 'Token has expired or is invalid' })
  }
  if (path === '/logout') {
    res.writeHead(204)
    return res.end()
  }
  return send(res, 404, { msg: 'not found' })
}

export function startFakeSupabase(port = Number(process.env.FAKE_SUPABASE_PORT ?? 3418)) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
    try {
      if (state.delayMs) await new Promise((r) => setTimeout(r, state.delayMs))
      if (url.pathname === '/__fake/reset') {
        state.rows = seed()
        state.legacy = process.env.FAKE_SUPABASE_LEGACY === '1'
        state.rls = 'ok'
        state.delayMs = 0
        state.authCalls = []
        return send(res, 200, { ok: true })
      }
      if (url.pathname === '/__fake/mode') {
        const body = (await readBody(req)) ?? {}
        if (typeof body.legacy === 'boolean') state.legacy = body.legacy
        if (body.rls === 'deny' || body.rls === 'ok') state.rls = body.rls
        if (typeof body.delayMs === 'number') state.delayMs = body.delayMs
        return send(res, 200, { ok: true })
      }
      if (url.pathname === '/__fake/auth') return send(res, 200, state.authCalls)
      if (url.pathname === '/__fake/profile') return send(res, 200, state.rows[FAKE_USER.id] ?? null)
      if (url.pathname === '/health') return send(res, 200, { ok: true })
      if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url)
      if (url.pathname === '/rest/v1/profiles') return await handleRest(req, res, url)
      return send(res, 404, { message: 'not found' })
    } catch (error) {
      return send(res, 500, { message: error instanceof Error ? error.message : 'error' })
    }
  })
  server.listen(port, '127.0.0.1')
  return server
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startFakeSupabase()
  console.log(`fake supabase on ${process.env.FAKE_SUPABASE_PORT ?? 3418}`)
}
