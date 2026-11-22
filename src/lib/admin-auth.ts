import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { passwordConfig, verifyPassword } from './admin-password'
import { dataDir } from './store'

// Owner login for /admin: one password, checked against ADMIN_PASSWORD_HASH (admin-password.ts).
// State lives next to the leads in $DATA_DIR/admin.json, written the same safe way as store.ts.
// Only hashes are stored: a leaked file gives neither the password nor a usable session.

export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000
export const SESSION_COOKIE = 'firtech_admin'

// Limits on login attempts. Every attempt counts as wrong until the password is confirmed, so
// parallel requests cannot slip past the limits. Per IP (hashed) in the last hour: the first five
// go straight through, then one a minute, and after ten the IP waits until the oldest one is an
// hour old. Across all IPs thirty wrong attempts an hour only SLOW the login (every further answer,
// right or wrong, waits GLOBAL_SLOW_MS more); it never closes it, so many IPs cannot lock the owner
// out. A right password forgets the attempts of that IP.
export const LOGIN_FREE_TRIES = 5
export const LOGIN_MIN_GAP_MS = 60_000
export const LOGIN_MAX_PER_HOUR = 10
export const LOGIN_MAX_PER_HOUR_ALL = 30
// Extra pause on every answer while the all-IP ceiling is exceeded (the same for a right and a wrong
// password, so the pause tells nothing).
export const GLOBAL_SLOW_MS = 4000
// Fixed pause before a "wrong password" answer.
export const WRONG_DELAY_MS = 800
// Largest login body read at all (the password itself is capped at 256 characters).
export const PASSWORD_BODY_LIMIT = 2048
const HOUR_MS = 60 * 60_000
// Security 2026-11-23 (P2-1): the attempts list is capped (newest kept) and kept in memory, written to
// admin.json at most once per ATTEMPTS_FLUSH_MS (it used to be rewritten on every attempt), and an IPv6
// visitor counts per /64 (one host gets a whole /64, so rotating addresses inside it gave fresh limits).
export const ATTEMPTS_CAP = 1000
export const ATTEMPTS_FLUSH_MS = 2000

// `fp` = fingerprint of ADMIN_PASSWORD_HASH when the session was made. Sessions written before the
// password login (no `fp`) stay valid until they expire, so a deploy does not sign the owner out.
type Session = { id: string; createdAt: number; expiresAt: number; fp?: string }
type Attempt = { id: string; at: number; ip: string }
type AdminDb = { sessions: Session[]; attempts: Attempt[] }

const fileName = () => path.join(dataDir(), 'admin.json')

async function load(): Promise<AdminDb> {
  try {
    // Files from the Telegram-code login also kept `codes` and `issued`: dropped on the next write.
    const db = JSON.parse(await readFile(fileName(), 'utf8')) as Partial<AdminDb>
    return {
      sessions: Array.isArray(db.sessions) ? db.sessions : [],
      attempts: Array.isArray(db.attempts) ? db.attempts : [],
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { sessions: [], attempts: [] }
    throw error
  }
}

async function save(db: AdminDb) {
  await mkdir(dataDir(), { recursive: true })
  const tmp = `${fileName()}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(db, null, 2), { mode: 0o600 })
  await rename(tmp, fileName())
}

let queue: Promise<unknown> = Promise.resolve()

// Login attempts per admin.json path (the tests switch DATA_DIR): the in-memory list is the truth,
// loaded once from the file and written back by every save.
const memAttempts = new Map<string, Attempt[]>()
const loadingAttempts = new Map<string, Promise<Attempt[]>>()
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>()

function attemptsFor(file: string): Promise<Attempt[]> {
  const ready = memAttempts.get(file)
  if (ready) return Promise.resolve(ready)
  let loading = loadingAttempts.get(file)
  if (!loading) {
    loading = load().then((db) => {
      const list = memAttempts.get(file) ?? db.attempts.slice(-ATTEMPTS_CAP)
      memAttempts.set(file, list)
      loadingAttempts.delete(file)
      return list
    })
    loadingAttempts.set(file, loading)
  }
  return loading
}

function setAttempts(file: string, list: Attempt[]) {
  memAttempts.set(file, list.length > ATTEMPTS_CAP ? list.slice(-ATTEMPTS_CAP) : list)
  if (flushTimers.has(file)) return
  const timer = setTimeout(() => {
    flushTimers.delete(file)
    void serialize(() => undefined).catch(() => console.warn('[admin] could not store login attempts'))
  }, ATTEMPTS_FLUSH_MS)
  timer.unref?.()
  flushTimers.set(file, timer)
}

// Writes pending attempts now (tests, and nothing else needs it).
export async function flushLoginAttempts() {
  for (const [file, timer] of flushTimers) {
    clearTimeout(timer)
    flushTimers.delete(file)
  }
  await serialize(() => undefined)
}

// One read-modify-write at a time, like the lead store. A failed task rejects its own caller; the
// queue goes on with the next one.
function serialize<T>(task: (db: AdminDb) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => {
    const db = await load()
    const result = await task(db)
    const mem = memAttempts.get(fileName())
    if (mem) db.attempts = mem
    await save(db)
    return result
  })
  queue = run.catch(() => undefined)
  return run
}

// The key a login attempt counts under: IPv4 as is, an IPv4-mapped IPv6 as its IPv4, any other IPv6
// as its /64 network.
export function ipBucket(raw: string): string {
  const ip = String(raw ?? '').trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0] ?? ''
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip)
  if (mapped) return mapped[1]!
  if (!ip.includes(':')) return ip
  const halves = ip.split('::')
  if (halves.length > 2) return ip
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const groups = halves.length === 2 ? [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail] : head
  const prefix = groups.slice(0, 4).map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16).toString(16) : '0'))
  while (prefix.length < 4) prefix.push('0')
  return `${prefix.join(':')}::/64`
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

function sameHex(a: string, b: string) {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

const retryAfter = (until: number, now: number) => Math.max(1, Math.ceil((until - now) / 1000))
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// New session for the current password (its fingerprint), 30 days.
export function createSession(now = Date.now(), fp?: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = now + SESSION_TTL_MS
  return serialize((db) => {
    db.sessions = db.sessions.filter((s) => s.expiresAt > now)
    db.sessions.push({ id: sha256(token), createdAt: now, expiresAt, ...(fp ? { fp } : {}) })
    return { token, expiresAt }
  })
}

type Reserve = { ok: true; id: string; slow: boolean } | { ok: false; retryAfter: number }

// Checks the limits and books this attempt as wrong in the same step (synchronous after the first load,
// so parallel requests cannot slip past the limits).
export async function reserveAttempt(ip: string, now: number): Promise<Reserve> {
  const file = fileName()
  await attemptsFor(file)
  // Read the CURRENT list after the await: another attempt may have replaced it meanwhile.
  const recent = (memAttempts.get(file) ?? []).filter((a) => a.at > now - HOUR_MS)
  const result = ((): Reserve => {
    const mine = recent.filter((a) => a.ip === ip)
    // The all-IP ceiling only slows the answer down; the per-IP limits below still apply.
    const slow = recent.length >= LOGIN_MAX_PER_HOUR_ALL
    if (mine.length >= LOGIN_MAX_PER_HOUR) {
      const oldest = mine[mine.length - LOGIN_MAX_PER_HOUR]?.at ?? now
      return { ok: false, retryAfter: retryAfter(oldest + HOUR_MS, now) }
    }
    const last = mine.at(-1)
    if (mine.length >= LOGIN_FREE_TRIES && last && now - last.at < LOGIN_MIN_GAP_MS) {
      return { ok: false, retryAfter: retryAfter(last.at + LOGIN_MIN_GAP_MS, now) }
    }
    const id = randomBytes(8).toString('hex')
    recent.push({ id, at: now, ip })
    return { ok: true, id, slow }
  })()
  setAttempts(file, recent)
  return result
}

export type LoginResult =
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; error: 'not_configured' }
  | { ok: false; error: 'wrong' }
  | { ok: false; error: 'too_many'; retryAfter: number }

type LoginOptions = {
  ip?: string
  now?: number
  delayMs?: number
  // Extra pause while the all-IP ceiling is exceeded (tests shorten it).
  slowMs?: number
  env?: Record<string, string | undefined>
}

// The whole password login: config, limits, scrypt check, session. Neither the password nor the
// hash is logged or stored.
export async function loginWithPassword(
  password: unknown,
  { ip = '', now = Date.now(), delayMs = WRONG_DELAY_MS, slowMs = GLOBAL_SLOW_MS, env = process.env }: LoginOptions = {},
): Promise<LoginResult> {
  const config = passwordConfig(env)
  if (!config.ok) return { ok: false, error: 'not_configured' }
  const who = sha256(ipBucket(ip))
  const reserved = await reserveAttempt(who, now)
  if (!reserved.ok) return { ok: false, error: 'too_many', retryAfter: reserved.retryAfter }
  const right = await verifyPassword(password, config.hash)
  if (reserved.slow) await sleep(slowMs)
  if (!right) {
    await sleep(delayMs)
    return { ok: false, error: 'wrong' }
  }
  const file = fileName()
  await attemptsFor(file)
  setAttempts(file, (memAttempts.get(file) ?? []).filter((a) => a.ip !== who))
  const session = await createSession(now, config.fingerprint)
  return { ok: true, ...session }
}

// True only for a known, unexpired session made with the current password (or before passwords,
// without a fingerprint). Read-only, so page loads never write the file.
export async function isValidSession(
  token: string | undefined | null,
  now = Date.now(),
  env: Record<string, string | undefined> = process.env,
) {
  if (!token || token.length > 100) return false
  const id = sha256(token)
  const { sessions } = await load()
  const session = sessions.find((s) => s.expiresAt > now && sameHex(s.id, id))
  if (!session) return false
  if (session.fp === undefined) return true
  const config = passwordConfig(env)
  return config.ok && config.fingerprint === session.fp
}

export function revokeSession(token: string) {
  const id = sha256(token)
  return serialize((db) => {
    db.sessions = db.sessions.filter((s) => s.id !== id)
  })
}

export function revokeAllSessions() {
  return serialize((db) => {
    db.sessions = []
  })
}
