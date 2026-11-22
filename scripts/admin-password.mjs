#!/usr/bin/env node
// Prints the ADMIN_PASSWORD_HASH line for the owner panel login (src/lib/admin-password.ts):
//   scrypt$32768$<salt>$<hash>   (N=32768, r=8, p=1, 64-byte key; salt 16 bytes; base64url, no padding)
//
//   node scripts/admin-password.mjs            asks for the password without echo (recommended)
//   node scripts/admin-password.mjs <password> takes it from the arguments (lands in shell history)
//   printf '%s' "$PW" | node scripts/admin-password.mjs   reads it from a pipe
//
// Only the hash line goes to stdout; prompts and errors go to stderr. Nothing is stored or logged.
import { randomBytes, scryptSync } from 'node:crypto'

const N = 32768
const MIN = 12
const MAX = 256

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin
    process.stderr.write(prompt)
    input.setRawMode(true)
    input.resume()
    input.setEncoding('utf8')
    let value = ''
    const done = (result, error) => {
      input.setRawMode(false)
      input.pause()
      input.removeListener('data', onData)
      process.stderr.write('\n')
      if (error) reject(error)
      else resolve(result)
    }
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') return done(value)
        if (char === '\u0003') return done('', new Error('cancelled'))
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1)
        else value += char
      }
    }
    input.on('data', onData)
  })
}

async function readPiped() {
  let text = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) text += chunk
  return text.replace(/\r?\n$/, '')
}

async function readPassword() {
  if (process.argv.length > 2) return process.argv.slice(2).join(' ')
  if (!process.stdin.isTTY) return readPiped()
  const first = await readHidden('Password: ')
  const second = await readHidden('Again: ')
  if (first !== second) fail('The two passwords differ.')
  return first
}

function hashLine(password, salt = randomBytes(16)) {
  const key = scryptSync(password, salt, 64, { N, r: 8, p: 1, maxmem: 96 * 1024 * 1024 })
  return `scrypt$${N}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

let password
try {
  password = await readPassword()
} catch (error) {
  fail(error instanceof Error ? error.message : 'Could not read the password.')
}
if (password.length < MIN) fail(`Use at least ${MIN} characters (a long random password is best).`)
if (password.length > MAX) fail(`At most ${MAX} characters.`)
process.stdout.write(`${hashLine(password)}\n`)
