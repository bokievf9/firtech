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
// hour old. Across all IPs thirty wrong attempts an hour close the login for everyone until the
// hour clears. A right password forgets the attempts of that IP.
export const LOGIN_FREE_TRIES = 5
export const LOGIN_MIN_GAP_MS = 60_000
export const LOGIN_MAX_PER_HOUR = 10
export const LOGIN_MAX_PER_HOUR_ALL = 30
// Fixed pause before a "wrong password" answer.
export const WRONG_DELAY_MS = 800
// Largest login body read at all (the password itself is capped at 256 characters).
export const PASSWORD_BODY_LIMIT = 2048
const HOUR_MS = 60 * 60_000

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

// One read-modify-write at a time, like the lead store. A failed task rejects its own caller; the
// queue goes on with the next one.
function serialize<T>(task: (db: AdminDb) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => {
    const db = await load()
    const result = await task(db)
    await save(db)
    return result
  })
  queue = run.catch(() => undefined)
  return run
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

type Reserve = { ok: true; id: string } | { ok: false; retryAfter: number }

// Checks the limits and books this attempt as wrong in the same step.
function reserveAttempt(ip: string, now: number): Promise<Reserve> {
  return serialize((db): Reserve => {
    db.attempts = db.attempts.filter((a) => a.at > now - HOUR_MS)
    const mine = db.attempts.filter((a) => a.ip === ip)
    if (db.attempts.length >= LOGIN_MAX_PER_HOUR_ALL) {
      const oldest = db.attempts[db.attempts.length - LOGIN_MAX_PER_HOUR_ALL]?.at ?? now
      return { ok: false, retryAfter: retryAfter(oldest + HOUR_MS, now) }
    }
    if (mine.length >= LOGIN_MAX_PER_HOUR) {
      const oldest = mine[mine.length - LOGIN_MAX_PER_HOUR]?.at ?? now
      return { ok: false, retryAfter: retryAfter(oldest + HOUR_MS, now) }
    }
    const last = mine.at(-1)
    if (mine.length >= LOGIN_FREE_TRIES && last && now - last.at < LOGIN_MIN_GAP_MS) {
      return { ok: false, retryAfter: retryAfter(last.at + LOGIN_MIN_GAP_MS, now) }
    }
    const id = randomBytes(8).toString('hex')
    db.attempts.push({ id, at: now, ip })
    return { ok: true, id }
  })
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
  env?: Record<string, string | undefined>
}

// The whole password login: config, limits, scrypt check, session. Neither the password nor the
// hash is logged or stored.
export async function loginWithPassword(
  password: unknown,
  { ip = '', now = Date.now(), delayMs = WRONG_DELAY_MS, env = process.env }: LoginOptions = {},
): Promise<LoginResult> {
  const config = passwordConfig(env)
  if (!config.ok) return { ok: false, error: 'not_configured' }
  const who = sha256(ip)
  const reserved = await reserveAttempt(who, now)
  if (!reserved.ok) return { ok: false, error: 'too_many', retryAfter: reserved.retryAfter }
  const right = await verifyPassword(password, config.hash)
  if (!right) {
    await sleep(delayMs)
    return { ok: false, error: 'wrong' }
  }
  await serialize((db) => {
    db.attempts = db.attempts.filter((a) => a.ip !== who)
  })
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
