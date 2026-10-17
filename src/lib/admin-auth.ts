import 'server-only'
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dataDir } from './store'
import { sendMessage, telegramEnv } from './telegram'

// Owner login for /admin: a one-time code sent by the bot to TELEGRAM_CHAT_ID, no password.
// State lives next to the leads in $DATA_DIR/admin.json, written the same safe way as store.ts.
// Only hashes are stored: a leaked file gives neither a usable code nor a usable session.

export const CODE_TTL_MS = 5 * 60_000
export const CODE_MAX_ATTEMPTS = 5
export const CODE_MIN_GAP_MS = 60_000
export const CODE_MAX_PER_HOUR = 5
export const CODES_MAX_PER_HOUR_ALL = 20
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000
export const SESSION_COOKIE = 'firtech_admin'
// Random value set in the browser that asked for a code; the code works only together with it.
export const LOGIN_COOKIE = 'firtech_admin_login'

// A code belongs to the browser that requested it (`browser` is the hash of its login cookie), so
// a stranger can neither replace the owner's code nor burn it with wrong tries. Limits count per
// IP (hashed), with a ceiling for everyone so Telegram is never flooded.
type PendingCode = {
  salt: string
  hash: string
  expiresAt: number
  attempts: number
  browser: string
}
type Issued = { at: number; ip: string }
type Session = { id: string; createdAt: number; expiresAt: number }
type AdminDb = { codes: PendingCode[]; issued: Issued[]; sessions: Session[] }
type Who = { browser?: string; ip?: string }

const fileName = () => path.join(dataDir(), 'admin.json')

async function load(): Promise<AdminDb> {
  try {
    const db = JSON.parse(await readFile(fileName(), 'utf8')) as Partial<AdminDb>
    // Files from before codes were bound to a browser kept `code` and plain timestamps.
    const issued = (db.issued ?? []).map((i) => (typeof i === 'number' ? { at: i, ip: '' } : i))
    return { codes: db.codes ?? [], issued, sessions: db.sessions ?? [] }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { codes: [], issued: [], sessions: [] }
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

// One read-modify-write at a time, like the lead store.
function serialize<T>(task: (db: AdminDb) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => {
    const db = await load()
    const result = await task(db)
    await save(db)
    return result
  })
  queue = run.catch(() => {})
  return run
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const codeHash = (salt: string, code: string) =>
  createHmac('sha256', salt).update(code).digest('hex')

function sameHex(a: string, b: string) {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

export type IssueResult =
  { ok: true; code: string } | { ok: false; error: 'too_soon' | 'too_many'; retryAfter: number }

const hourAgo = (now: number) => now - 60 * 60_000
const retryAfter = (until: number, now: number) => Math.ceil((until - now) / 1000)

// New code for this browser, replacing its earlier one. Per IP at most one a minute and five an
// hour; twenty an hour for everyone together.
export function issueCode(now = Date.now(), who: Who = {}): Promise<IssueResult> {
  const browser = sha256(who.browser ?? '')
  const ip = sha256(who.ip ?? '')
  return serialize((db) => {
    db.issued = db.issued.filter((i) => i.at > hourAgo(now))
    db.codes = db.codes.filter((c) => c.expiresAt > now)
    const mine = db.issued.filter((i) => i.ip === ip)
    const last = mine.at(-1)
    if (last && now - last.at < CODE_MIN_GAP_MS) {
      return {
        ok: false,
        error: 'too_soon',
        retryAfter: retryAfter(last.at + CODE_MIN_GAP_MS, now),
      }
    }
    const window = mine.length >= CODE_MAX_PER_HOUR ? mine : db.issued
    if (mine.length >= CODE_MAX_PER_HOUR || db.issued.length >= CODES_MAX_PER_HOUR_ALL) {
      const oldest = window[0]?.at ?? now
      return { ok: false, error: 'too_many', retryAfter: retryAfter(oldest + 60 * 60_000, now) }
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const salt = randomBytes(16).toString('hex')
    db.codes = db.codes.filter((c) => c.browser !== browser)
    db.codes.push({
      salt,
      hash: codeHash(salt, code),
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      browser,
    })
    db.issued.push({ at: now, ip })
    return { ok: true, code }
  })
}

export const codeMessage = (code: string) =>
  `Код для входа в панель Fir Tech: <code>${code}</code>. Если это не вы, ничего не делайте.`

export type RequestResult =
  | { ok: true }
  | { ok: false; error: 'too_soon' | 'too_many'; retryAfter: number }
  | { ok: false; error: 'not_configured' | 'send_failed' }

// Issues a code and sends it to the owner's chat only. The code never goes back to the browser.
export async function requestLoginCode(now = Date.now(), who: Who = {}): Promise<RequestResult> {
  const { token, ownerChatId } = telegramEnv()
  if (!token || !ownerChatId) return { ok: false, error: 'not_configured' }
  const issued = await issueCode(now, who)
  if (!issued.ok) return issued
  try {
    await sendMessage(ownerChatId, codeMessage(issued.code))
    return { ok: true }
  } catch (error) {
    console.error('[admin] could not send the login code', error)
    // A code nobody received is useless; the rate limit still counts it.
    const browser = sha256(who.browser ?? '')
    await serialize((db) => {
      db.codes = db.codes.filter((c) => c.browser !== browser)
    })
    return { ok: false, error: 'send_failed' }
  }
}

export type VerifyResult =
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; error: 'no_code' | 'expired' | 'locked' }
  | { ok: false; error: 'wrong'; attemptsLeft: number }

// Checks a typed code from the browser that asked for it. Five wrong tries burn the code; success
// burns it too and opens a session.
export function verifyCode(input: string, now = Date.now(), browserId = ''): Promise<VerifyResult> {
  const browser = sha256(browserId)
  return serialize((db): VerifyResult => {
    const pending = db.codes.find((c) => c.browser === browser)
    const drop = () => {
      db.codes = db.codes.filter((c) => c !== pending)
    }
    if (!pending) return { ok: false, error: 'no_code' }
    if (now > pending.expiresAt) {
      drop()
      return { ok: false, error: 'expired' }
    }
    if (pending.attempts >= CODE_MAX_ATTEMPTS) {
      drop()
      return { ok: false, error: 'locked' }
    }
    const clean = input.replace(/\s/g, '')
    if (!/^\d{6}$/.test(clean) || !sameHex(codeHash(pending.salt, clean), pending.hash)) {
      pending.attempts += 1
      const attemptsLeft = CODE_MAX_ATTEMPTS - pending.attempts
      if (attemptsLeft <= 0) {
        drop()
        return { ok: false, error: 'locked' }
      }
      return { ok: false, error: 'wrong', attemptsLeft }
    }
    drop()
    const token = randomBytes(32).toString('base64url')
    const expiresAt = now + SESSION_TTL_MS
    db.sessions = db.sessions.filter((s) => s.expiresAt > now)
    db.sessions.push({ id: sha256(token), createdAt: now, expiresAt })
    return { ok: true, token, expiresAt }
  })
}

// True only for a known, unexpired session. Read-only, so page loads never write the file.
export async function isValidSession(token: string | undefined | null, now = Date.now()) {
  if (!token || token.length > 100) return false
  const id = sha256(token)
  const { sessions } = await load()
  return sessions.some((s) => s.expiresAt > now && sameHex(s.id, id))
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
