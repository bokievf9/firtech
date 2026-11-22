import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, scryptSync } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, beforeEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Password login of the owner panel (docs/shell.md «Login»). Throwaway passwords and hashes only.
const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export{}', shortCircuit: true }
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

const root = await mkdtemp(path.join(tmpdir(), 'firtech-admin-login-test-'))
let dirCount = 0
after(() => rm(root, { recursive: true, force: true }))

const PASSWORD = 'throwaway-test-password-for-node-tests'
// N=16384 keeps the suite fast; the script and production use 32768.
function makeHash(password, n = 16384, salt = randomBytes(16)) {
  const key = scryptSync(password, salt, 64, { N: n, r: 8, p: 1, maxmem: 96 * 1024 * 1024 })
  return `scrypt$${n}$${salt.toString('base64url')}$${key.toString('base64url')}`
}
const HASH = makeHash(PASSWORD)

beforeEach(() => {
  process.env.DATA_DIR = path.join(root, `d${++dirCount}`)
  process.env.ADMIN_PASSWORD_HASH = HASH
})

const pw = await import('../src/lib/admin-password.ts')
const auth = await import('../src/lib/admin-auth.ts')
const loginRoute = await import('../src/app/api/admin/login/route.ts')
const logoutRoute = await import('../src/app/api/admin/logout/route.ts')
const exportRoute = await import('../src/app/api/admin/export/route.ts')

const ORIGIN = 'http://localhost'
function request(url, { method = 'POST', body, raw, cookie, origin = ORIGIN, ip, type = 'application/json' } = {}) {
  const headers = { host: 'localhost' }
  if (type) headers['content-type'] = type
  if (origin) headers.origin = origin
  if (ip) headers['x-real-ip'] = ip
  if (cookie) headers.cookie = `${auth.SESSION_COOKIE}=${cookie}`
  const payload = raw ?? (body !== undefined ? JSON.stringify(body) : undefined)
  return new Request(`${ORIGIN}${url}`, { method, headers, ...(payload !== undefined ? { body: payload } : {}) })
}
const tokenOf = (response) =>
  response.headers.get('set-cookie')?.match(new RegExp(`${auth.SESSION_COOKIE}=([^;]*)`))?.[1]
const exportWith = (cookie) => exportRoute.GET(request('/api/admin/export', { method: 'GET', cookie }))
const fast = (ip, extra = {}) => ({ ip, delayMs: 0, env: process.env, ...extra })

test('hash format: valid lines parse, malformed and weak ones are refused', () => {
  const ok = pw.parsePasswordHash(HASH)
  assert.equal(ok.n, 16384)
  assert.equal(ok.salt.length, 16)
  assert.equal(ok.hash.length, 64)
  assert.equal(pw.parsePasswordHash(makeHash('x'.repeat(12), 32768)).n, 32768)
  const [, , salt, hash] = HASH.split('$')
  const hexSalt = Buffer.from(salt, 'base64url').toString('hex')
  for (const bad of [
    undefined,
    '',
    'scrypt',
    `scrypt$16384$${salt}`,
    `scrypt$16384$${salt}$${hash}$extra`,
    `bcrypt$16384$${salt}$${hash}`,
    `scrypt$8192$${salt}$${hash}`, // too weak
    `scrypt$1024$${salt}$${hash}`,
    `scrypt$65536$${salt}$${hash}`, // not an allowed N
    `scrypt$016384$${salt}$${hash}`,
    `scrypt$16384$${salt}==$${hash}`, // padding
    `scrypt$16384$${salt}$${hash.slice(0, -2)}`, // 63-byte key
    `scrypt$16384$${Buffer.alloc(8).toString('base64url')}$${hash}`, // salt too short
    `scrypt$16384$${hexSalt}+/$${hash}`,
    `scrypt$16384$${salt}$${hash.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))}x`,
  ]) {
    assert.equal(pw.parsePasswordHash(bad), null, String(bad))
  }
  assert.deepEqual(pw.passwordConfig({}), { ok: false, reason: 'missing' })
  // What @next/env leaves of an unescaped line in .env.local: refused, login closed.
  const warn = console.warn
  const seen = []
  console.warn = (...args) => seen.push(args.join(' '))
  try {
    assert.deepEqual(pw.passwordConfig({ ADMIN_PASSWORD_HASH: 'scrypt' }), { ok: false, reason: 'malformed' })
  } finally {
    console.warn = warn
  }
  assert.equal(seen.length, 1)
  assert.equal(seen[0].includes('scrypt$'), false)
  assert.equal(pw.passwordConfig({ ADMIN_PASSWORD_HASH: HASH }).ok, true)
})

test('verify: right password only; wrong, empty, too long, non-string and no hash are false', async () => {
  const stored = pw.parsePasswordHash(HASH)
  assert.equal(await pw.verifyPassword(PASSWORD, stored), true)
  assert.equal(await pw.verifyPassword(`${PASSWORD}x`, stored), false)
  assert.equal(await pw.verifyPassword('', stored), false)
  assert.equal(await pw.verifyPassword(undefined, stored), false)
  assert.equal(await pw.verifyPassword(12345, stored), false)
  assert.equal(await pw.verifyPassword('x'.repeat(pw.PASSWORD_MAX_LENGTH + 1), stored), false)
  assert.equal(await pw.verifyPassword(PASSWORD, null), false)
  // A 256-character password is still allowed.
  const long = 'y'.repeat(pw.PASSWORD_MAX_LENGTH)
  assert.equal(await pw.verifyPassword(long, pw.parsePasswordHash(makeHash(long))), true)
})

test('verify: no hash still costs one full scrypt (no early return)', async () => {
  const strong = pw.parsePasswordHash(makeHash(PASSWORD, 32768))
  const time = async (run) => {
    const t0 = performance.now()
    await run()
    return performance.now() - t0
  }
  await pw.verifyPassword('warm-up', strong)
  const real = await time(() => pw.verifyPassword('wrong-password', strong))
  const none = await time(() => pw.verifyPassword('wrong-password', null))
  const tooLong = await time(() => pw.verifyPassword('z'.repeat(10_000), strong))
  assert.ok(none > real * 0.4, `no-hash path ${none} ms vs ${real} ms`)
  assert.ok(tooLong > real * 0.4, `too-long path ${tooLong} ms vs ${real} ms`)
})

test('script: prints one hash line that verifies, refuses short passwords', async () => {
  const script = path.resolve('scripts/admin-password.mjs')
  const fromArgv = execFileSync(process.execPath, [script, PASSWORD], { encoding: 'utf8' })
  assert.match(fromArgv, /^scrypt\$32768\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}\n$/)
  const parsed = pw.parsePasswordHash(fromArgv.trim())
  assert.equal(await pw.verifyPassword(PASSWORD, parsed), true)
  assert.equal(await pw.verifyPassword('another-password-1', parsed), false)
  const fromPipe = execFileSync(process.execPath, [script], { input: `${PASSWORD}\n`, encoding: 'utf8' })
  assert.equal(await pw.verifyPassword(PASSWORD, pw.parsePasswordHash(fromPipe.trim())), true)
  assert.notEqual(fromPipe, fromArgv, 'a fresh salt every time')
  assert.throws(() => execFileSync(process.execPath, [script, 'short'], { stdio: 'pipe' }))
})

test('route: the right password sets an httpOnly 30-day cookie and a session with the fingerprint', async () => {
  const response = await loginRoute.POST(request('/api/admin/login', { body: { password: PASSWORD } }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
  const cookie = response.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=strict/i)
  assert.match(cookie, /Path=\//)
  const expires = Date.parse(cookie.match(/Expires=([^;]+)/i)[1])
  assert.ok(Math.abs(expires - (Date.now() + auth.SESSION_TTL_MS)) < 60_000)
  const token = tokenOf(response)
  assert.equal((await exportWith(token)).status, 200)
  // Only hashes on disk: neither the token nor the password nor the hash line.
  const file = await readFile(path.join(process.env.DATA_DIR, 'admin.json'), 'utf8')
  assert.equal(file.includes(token), false)
  assert.equal(file.includes(PASSWORD), false)
  assert.equal(file.includes(HASH.split('$')[3]), false)
  const [session] = JSON.parse(file).sessions
  assert.equal(session.fp, pw.hashFingerprint(HASH))
})

test('route: wrong password is 401 after the fixed delay, nothing logged', async () => {
  const logs = []
  const saved = { log: console.log, warn: console.warn, error: console.error }
  console.log = console.warn = console.error = (...args) => logs.push(args.join(' '))
  try {
    const t0 = performance.now()
    const response = await loginRoute.POST(request('/api/admin/login', { body: { password: 'wrong-password-123' } }))
    const took = performance.now() - t0
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { ok: false, error: 'wrong' })
    assert.equal(response.headers.get('set-cookie'), null)
    assert.ok(took >= auth.WRONG_DELAY_MS - 20, `answered after ${took} ms`)
  } finally {
    Object.assign(console, saved)
  }
  assert.equal(logs.some((l) => l.includes('wrong-password-123') || l.includes(HASH)), false)
})

test('route: 503 not_configured without a valid hash, no fallback', async () => {
  for (const value of [undefined, '', 'scrypt$32768$short$short', 'plain-password']) {
    if (value === undefined) delete process.env.ADMIN_PASSWORD_HASH
    else process.env.ADMIN_PASSWORD_HASH = value
    const warn = console.warn
    console.warn = () => undefined
    try {
      const response = await loginRoute.POST(request('/api/admin/login', { body: { password: value ?? PASSWORD } }))
      assert.equal(response.status, 503, String(value))
      assert.deepEqual(await response.json(), { ok: false, error: 'not_configured' })
      assert.equal(response.headers.get('set-cookie'), null)
    } finally {
      console.warn = warn
    }
  }
})

test('route: same origin and JSON only, bad bodies are 400', async () => {
  for (const origin of [null, 'https://evil.example']) {
    const response = await loginRoute.POST(request('/api/admin/login', { body: { password: PASSWORD }, origin }))
    assert.equal(response.status, 403)
  }
  for (const type of ['text/plain', 'application/x-www-form-urlencoded', null]) {
    const response = await loginRoute.POST(request('/api/admin/login', { raw: JSON.stringify({ password: PASSWORD }), type }))
    assert.equal(response.status, 415, String(type))
  }
  assert.equal((await loginRoute.POST(request('/api/admin/login', { raw: '{not json' }))).status, 400)
  assert.equal((await loginRoute.POST(request('/api/admin/login', { raw: JSON.stringify({ password: 'a'.repeat(5000) }) }))).status, 400)
  // A missing or non-string password is just a wrong one (it still counts against the limits).
  const missing = await auth.loginWithPassword(undefined, fast('10.9.0.1'))
  assert.deepEqual(missing, { ok: false, error: 'wrong' })
})

test('limits per IP: five free tries, then one a minute, ten an hour; success clears the IP', async () => {
  const t0 = Date.now()
  const ip = '10.0.0.1'
  for (let i = 0; i < auth.LOGIN_FREE_TRIES; i++)
    assert.equal((await auth.loginWithPassword('nope-nope-nope', fast(ip, { now: t0 + i }))).error, 'wrong')
  const soon = await auth.loginWithPassword(PASSWORD, fast(ip, { now: t0 + 10_000 }))
  assert.equal(soon.error, 'too_many')
  assert.ok(soon.retryAfter > 0 && soon.retryAfter <= 60)
  // Another IP is not held back.
  assert.equal((await auth.loginWithPassword('nope-nope-nope', fast('10.0.0.2', { now: t0 + 10_000 }))).error, 'wrong')
  // One a minute up to ten an hour.
  let at = t0 + auth.LOGIN_FREE_TRIES - 1
  for (let i = auth.LOGIN_FREE_TRIES; i < auth.LOGIN_MAX_PER_HOUR; i++) {
    at += auth.LOGIN_MIN_GAP_MS + 1
    assert.equal((await auth.loginWithPassword('nope-nope-nope', fast(ip, { now: at }))).error, 'wrong')
  }
  const locked = await auth.loginWithPassword(PASSWORD, fast(ip, { now: at + auth.LOGIN_MIN_GAP_MS + 1 }))
  assert.equal(locked.error, 'too_many')
  assert.ok(locked.retryAfter > 60)
  // An hour after the first tries the IP may try again, and a success forgets its attempts.
  const later = t0 + 60 * 60_000 + 10
  assert.equal((await auth.loginWithPassword(PASSWORD, fast(ip, { now: later }))).ok, true)
  for (let i = 0; i < auth.LOGIN_FREE_TRIES; i++)
    assert.equal((await auth.loginWithPassword('nope-nope-nope', fast(ip, { now: later + 1 + i }))).error, 'wrong')

  // The route answers 429 with Retry-After.
  const response = await loginRoute.POST(request('/api/admin/login', { body: { password: PASSWORD }, ip }))
  assert.equal(response.status, 429)
  assert.deepEqual(Object.keys(await response.json()).sort(), ['error', 'ok', 'retryAfter'])
  assert.ok(Number(response.headers.get('retry-after')) > 0)
})

test('limits per IP: parallel requests cannot pass the limit', async () => {
  const now = Date.now()
  const results = await Promise.all(
    Array.from({ length: 12 }, () => auth.loginWithPassword('nope-nope-nope', fast('10.3.0.1', { now }))),
  )
  // Every in-flight attempt counts as wrong before its check finishes: five are checked, the rest wait.
  assert.equal(results.filter((r) => r.error === 'wrong').length, auth.LOGIN_FREE_TRIES)
  assert.equal(results.filter((r) => r.error === 'too_many').length, 12 - auth.LOGIN_FREE_TRIES)
})

test('limits for everyone: thirty wrong attempts an hour only slow the login, the owner still gets in', async () => {
  assert.ok(auth.GLOBAL_SLOW_MS >= 3000 && auth.GLOBAL_SLOW_MS <= 5000)
  const now = Date.now()
  for (let i = 0; i < auth.LOGIN_MAX_PER_HOUR_ALL; i++)
    assert.equal((await auth.loginWithPassword('nope-nope-nope', fast(`10.1.${i}.1`, { now }))).error, 'wrong')
  // Past the ceiling: a wrong password is still "wrong" (not "too_many") and waits the extra pause.
  const t0 = Date.now()
  const wrong = await auth.loginWithPassword('nope-nope-nope', fast('10.2.0.2', { now: now + 500, slowMs: 120 }))
  assert.equal(wrong.error, 'wrong')
  assert.ok(Date.now() - t0 >= 110, 'extra delay applied')
  // The owner's right password passes, also slowed; it does not matter that thirty strangers failed.
  const t1 = Date.now()
  const owner = await auth.loginWithPassword(PASSWORD, fast('10.2.0.1', { now: now + 1000, slowMs: 120 }))
  assert.equal(owner.ok, true)
  assert.ok(Date.now() - t1 >= 110, 'extra delay applied to a right password too')
  // Per-IP limits still hold during the ceiling: one IP cannot go past ten an hour.
  const same = []
  for (let i = 0; i < auth.LOGIN_MAX_PER_HOUR + 1; i++)
    same.push((await auth.loginWithPassword('nope-nope-nope', fast('10.9.9.9', { now: now + 2000 + i * auth.LOGIN_MIN_GAP_MS, slowMs: 0 }))).error)
  assert.equal(same.at(-1), 'too_many')
})

test('fingerprint: a new password hash ends the old sessions; old sessions without it stay', async () => {
  const made = await auth.loginWithPassword(PASSWORD, fast('10.4.0.1'))
  assert.equal(made.ok, true)
  // A session from before the password login (no fingerprint), as global-setup and old files have.
  const legacy = await auth.createSession()
  assert.equal(await auth.isValidSession(made.token), true)
  process.env.ADMIN_PASSWORD_HASH = makeHash('a-brand-new-throwaway-password')
  assert.equal(await auth.isValidSession(made.token), false)
  assert.equal((await exportWith(made.token)).status, 401)
  assert.equal(await auth.isValidSession(legacy.token), true)
  // Back to the old hash line: the old session counts again (same fingerprint).
  process.env.ADMIN_PASSWORD_HASH = HASH
  assert.equal(await auth.isValidSession(made.token), true)
  // No valid hash at all: fingerprinted sessions are out.
  delete process.env.ADMIN_PASSWORD_HASH
  assert.equal(await auth.isValidSession(made.token), false)
  assert.equal(await auth.isValidSession(legacy.token, Date.now() + auth.SESSION_TTL_MS + 1), false)
})

test('logout: revokes the session on the server and clears the cookie, also for a stale one', async () => {
  const response = await loginRoute.POST(request('/api/admin/login', { body: { password: PASSWORD } }))
  const token = tokenOf(response)
  const other = (await auth.loginWithPassword(PASSWORD, fast('10.5.0.1'))).token
  const out = await logoutRoute.POST(request('/api/admin/logout', { body: {}, cookie: token }))
  assert.equal(out.status, 200)
  assert.match(out.headers.get('set-cookie'), /Max-Age=0|Expires=Thu, 01 Jan 1970/i)
  assert.equal((await exportWith(token)).status, 401)
  assert.equal(await auth.isValidSession(token), false)
  assert.equal((await exportWith(other)).status, 200)
  const file = JSON.parse(await readFile(path.join(process.env.DATA_DIR, 'admin.json'), 'utf8'))
  assert.equal(file.sessions.length, 1)
  // Without a cookie, or with an unknown one, it still answers 200 and clears it.
  assert.equal((await logoutRoute.POST(request('/api/admin/logout', { body: {} }))).status, 200)
  // Origin is checked.
  assert.equal((await logoutRoute.POST(request('/api/admin/logout', { body: {}, cookie: other, origin: 'https://evil.example' }))).status, 403)
  // "all" needs a valid session, then ends every one.
  assert.equal((await logoutRoute.POST(request('/api/admin/logout', { body: { all: true }, cookie: token }))).status, 401)
  assert.equal((await logoutRoute.POST(request('/api/admin/logout', { body: { all: true }, cookie: other }))).status, 200)
  assert.equal((await exportWith(other)).status, 401)
})

test('the Telegram code login is gone', async () => {
  const { existsSync, readFileSync } = await import('node:fs')
  assert.equal(existsSync(path.resolve('src/app/api/admin/code/route.ts')), false)
  const lib = readFileSync(path.resolve('src/lib/admin-auth.ts'), 'utf8')
  assert.doesNotMatch(lib, /issueCode|verifyCode|sendMessage|from '\.\/telegram'/)
  const form = readFileSync(path.resolve('src/components/admin/login-form.tsx'), 'utf8')
  assert.match(form, /type=\{visible \? 'text' : 'password'\}/)
  assert.match(form, /autoComplete="current-password"/)
  assert.doesNotMatch(form, /api\/admin\/code|one-time-code/)
})

test('security 2026-11-23 (P2-1): IPv6 counts per /64, mapped IPv4 as IPv4', async () => {
  assert.equal(auth.ipBucket('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64')
  assert.equal(auth.ipBucket('2001:0db8:0001:0002:ffff:1:2:3'), '2001:db8:1:2::/64')
  assert.equal(auth.ipBucket('[2001:db8::1]'), '2001:db8:0:0::/64')
  assert.equal(auth.ipBucket('::ffff:203.0.113.9'), '203.0.113.9')
  assert.equal(auth.ipBucket('203.0.113.9'), '203.0.113.9')
  const now = Date.now()
  // Rotating the host part inside one /64 no longer gives fresh tries.
  for (let i = 0; i < auth.LOGIN_FREE_TRIES; i++)
    assert.equal((await auth.loginWithPassword('nope-nope-nope', fast(`2001:db8:7:7::${i + 1}`, { now: now + i }))).error, 'wrong')
  assert.equal((await auth.loginWithPassword('nope-nope-nope', fast('2001:db8:7:7:dead:beef:0:1', { now: now + 100 }))).error, 'too_many')
  assert.equal((await auth.loginWithPassword('nope-nope-nope', fast('2001:db8:7:8::1', { now: now + 100 }))).error, 'wrong', 'another /64 is not held back')
})

test('security 2026-11-23 (P2-1): attempts are capped and written debounced, not on every try', async () => {
  const now = Date.now()
  await auth.loginWithPassword('nope-nope-nope', fast('10.77.0.1', { now }))
  const file = path.join(process.env.DATA_DIR, 'admin.json')
  await assert.rejects(readFile(file, 'utf8'), 'nothing written synchronously')
  await auth.flushLoginAttempts()
  assert.equal(JSON.parse(await readFile(file, 'utf8')).attempts.length, 1)
  assert.ok(auth.ATTEMPTS_CAP >= 100 && auth.ATTEMPTS_CAP <= 5000)
  // Booking only (no scrypt), many IPs: the list never grows past the cap.
  await Promise.all(Array.from({ length: auth.ATTEMPTS_CAP + 50 }, (_, i) => auth.reserveAttempt(`ip-${i}`, now + 1)))
  await auth.flushLoginAttempts()
  assert.ok(JSON.parse(await readFile(file, 'utf8')).attempts.length <= auth.ATTEMPTS_CAP)
})
