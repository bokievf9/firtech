import 'server-only'
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// The owner's password for /admin, kept on the server only as ADMIN_PASSWORD_HASH:
//   scrypt$<N>$<salt>$<hash>
// N is 16384 or 32768 (r=8, p=1), salt is 16 to 64 bytes, hash is the 64-byte scrypt key; salt and
// hash are base64url without padding. `node scripts/admin-password.mjs` prints such a line.
// The format is parsed strictly: anything else means "not set up" and the login stays closed.

export const PASSWORD_MAX_LENGTH = 256
export const SCRYPT_ALLOWED_N = [16384, 32768] as const
export const SCRYPT_R = 8
export const SCRYPT_P = 1
export const SCRYPT_KEY_LENGTH = 64
// 128 * N * r is 32 MiB at N=32768; leave room so Node never refuses the call.
const SCRYPT_MAXMEM = 96 * 1024 * 1024

export type PasswordHash = { n: number; salt: Buffer; hash: Buffer }

const B64URL = /^[A-Za-z0-9_-]+$/

// Decodes canonical unpadded base64url only (no padding, no stray bits), else null.
function decodeB64url(text: string): Buffer | null {
  if (!B64URL.test(text) || text.length % 4 === 1) return null
  const bytes = Buffer.from(text, 'base64url')
  return bytes.toString('base64url') === text ? bytes : null
}

export function parsePasswordHash(line: string | undefined | null): PasswordHash | null {
  if (typeof line !== 'string' || line.length > 400) return null
  const parts = line.split('$')
  if (parts.length !== 4) return null
  const [scheme, nText, saltText, hashText] = parts as [string, string, string, string]
  if (scheme !== 'scrypt' || !/^[1-9]\d{0,5}$/.test(nText)) return null
  const n = Number(nText)
  if (!(SCRYPT_ALLOWED_N as readonly number[]).includes(n)) return null
  const salt = decodeB64url(saltText)
  const hash = decodeB64url(hashText)
  if (!salt || salt.length < 16 || salt.length > 64) return null
  if (!hash || hash.length !== SCRYPT_KEY_LENGTH) return null
  return { n, salt, hash }
}

function derive(password: string, salt: Buffer, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      { N: n, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
      (error, key) => (error ? reject(error) : resolve(key)),
    )
  })
}

// Stand-in used when there is no valid hash, so a wrong format costs the same work as a wrong password.
const dummy: PasswordHash = {
  n: 32768,
  salt: randomBytes(16),
  hash: randomBytes(SCRYPT_KEY_LENGTH),
}

// True only for the right password. Always runs one scrypt (with the stored N, or N=32768 without a
// usable hash) and one constant-time compare; an empty, too long or non-string input and an unknown
// format all take the same path and come back false.
export async function verifyPassword(password: unknown, stored: PasswordHash | null): Promise<boolean> {
  const usable =
    typeof password === 'string' && password.length > 0 && password.length <= PASSWORD_MAX_LENGTH
  const target = stored ?? dummy
  const input = usable ? (password as string) : 'x'.repeat(16)
  const key = await derive(input, target.salt, target.n)
  const same = timingSafeEqual(key, target.hash)
  return same && usable && stored !== null
}

// Short public fingerprint of the configured hash, stored in each session: a new password (a new
// hash line) gives a new fingerprint and ends every session made with the old one. It reveals
// nothing useful: it is a hash of a hash that already carries a random salt.
export function hashFingerprint(line: string): string {
  return createHash('sha256').update(`firtech-admin-session:${line}`).digest('hex').slice(0, 16)
}

export type PasswordConfig =
  | { ok: true; hash: PasswordHash; fingerprint: string }
  | { ok: false; reason: 'missing' | 'malformed' }

let warned = ''

// Reads ADMIN_PASSWORD_HASH at request time. A malformed value is reported once in the server log,
// without the value itself.
export function passwordConfig(env: Record<string, string | undefined> = process.env): PasswordConfig {
  const line = env.ADMIN_PASSWORD_HASH?.trim() ?? ''
  if (!line) return { ok: false, reason: 'missing' }
  const hash = parsePasswordHash(line)
  if (!hash) {
    const key = hashFingerprint(line)
    if (warned !== key) {
      warned = key
      console.warn('[admin] ADMIN_PASSWORD_HASH is malformed: login is closed (expected the line printed by scripts/admin-password.mjs)')
    }
    return { ok: false, reason: 'malformed' }
  }
  return { ok: true, hash, fingerprint: hashFingerprint(line) }
}
