import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decide } from '../scripts/ops/watch.mjs'
import { mkdtemp, readdir, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { ageEncrypt, ageRecipient, backupMessage, copyExtras, shouldSend } from '../scripts/ops/backup.mjs'

test('watch: alerts once after two failures, then once on recovery', () => {
  let s = {}
  let r = decide(s, 'HTTP 502', 0)
  assert.equal(r.say, null)
  r = decide(r.state, 'HTTP 502', 300_000)
  assert.match(r.say, /не работает/)
  r = decide(r.state, 'HTTP 502', 600_000)
  assert.equal(r.say, null)
  r = decide(r.state, null, 900_000)
  assert.match(r.say, /снова работает.*10 мин/)
  assert.equal(decide(r.state, null, 1_200_000).say, null)
  s = decide({}, 'x', 0).state
  assert.equal(decide(s, null, 1).say, null)
})

test('backup: sends only when the data changed', () => {
  assert.equal(shouldSend('a', null), true)
  assert.equal(shouldSend('a', { lastHash: 'a' }), false)
  assert.equal(shouldSend('b', { lastHash: 'a' }), true)
})

test('backup: prices.json and golive.json are copied next to leads.json, missing ones skipped, 14 kept', async () => {
  const root = await mkdtemp(join(tmpdir(), 'backup-'))
  const from = join(root, 'data')
  const to = join(root, 'backups')
  await mkdir(from)
  await mkdir(to)
  await writeFile(join(from, 'prices.json'), '{}')
  assert.deepEqual(await copyExtras(from, to, '2026-11-21'), ['prices.json'])
  assert.deepEqual(await readdir(to), ['prices-2026-11-21.json'])
  await writeFile(join(from, 'golive.json'), '{}')
  for (let d = 1; d <= 16; d++) await copyExtras(from, to, `2026-12-${String(d).padStart(2, '0')}`)
  const names = await readdir(to)
  assert.equal(names.filter((n) => n.startsWith('prices-')).length, 14)
  assert.equal(names.filter((n) => n.startsWith('golive-')).length, 14)
})

// Security 2026-11-23 (P1-6): leads.json never leaves the server unencrypted.
const leadsBytes = Buffer.from(JSON.stringify({ leads: [{ name: 'Анна', contact: '+992900000000' }, { name: 'B', contact: '@b' }] }))
const RECIPIENT = 'age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p'

test('backup: without BACKUP_AGE_RECIPIENT only a summary goes out, never the plain file', async () => {
  let called = 0
  const m = await backupMessage(leadsBytes, '2026-11-23', { env: {}, encrypt: async () => { called++; return Buffer.from('x') } })
  assert.equal(m.kind, 'summary')
  assert.equal(called, 0)
  assert.equal(m.bytes, undefined)
  assert.match(m.text, /2026-11-23: 2 шт\./)
  assert.match(m.text, /BACKUP_AGE_RECIPIENT/)
  assert.doesNotMatch(m.text, /Анна|\+992/)
  assert.equal(ageRecipient({ BACKUP_AGE_RECIPIENT: 'garbage' }), null)
  assert.equal(ageRecipient({ BACKUP_AGE_RECIPIENT: ` ${RECIPIENT} ` }), RECIPIENT)
})

test('backup: with a recipient the file is the age ciphertext; an age failure falls back to the summary', async () => {
  const m = await backupMessage(leadsBytes, '2026-11-23', { env: { BACKUP_AGE_RECIPIENT: RECIPIENT }, encrypt: async (bytes, r) => {
    assert.equal(r, RECIPIENT)
    assert.equal(bytes, leadsBytes)
    return Buffer.from('age-encryption.org/v1\n...')
  } })
  assert.equal(m.kind, 'file')
  assert.equal(m.name, 'firtech-leads-2026-11-23.json.age')
  assert.ok(!m.bytes.includes(Buffer.from('Анна')))
  const failed = await backupMessage(leadsBytes, '2026-11-23', { env: { BACKUP_AGE_RECIPIENT: RECIPIENT }, encrypt: async () => { throw new Error('no age') } })
  assert.equal(failed.kind, 'summary')
  assert.match(failed.text, /age/)
  const src = readFileSync('scripts/ops/backup.mjs', 'utf8')
  assert.doesNotMatch(src, /sendFile\([^)]*`firtech-leads-\$\{day\}\.json`/, 'the plain name is never sent')
})

let hasAge = false
try {
  execFileSync('age-keygen', ['--help'], { stdio: 'ignore' })
  hasAge = true
} catch (error) {
  hasAge = error?.status !== undefined && error.code !== 'ENOENT'
}
test('backup: real age round trip when age is installed', { skip: !hasAge && 'age not installed' }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'age-'))
  const keyFile = join(dir, 'key.txt')
  execFileSync('age-keygen', ['-o', keyFile], { stdio: 'ignore' })
  const recipient = readFileSync(keyFile, 'utf8').match(/public key: (age1[a-z0-9]+)/)[1]
  const encrypted = await ageEncrypt(leadsBytes, recipient)
  assert.ok(!encrypted.includes(Buffer.from('+992900000000')))
  const plain = execFileSync('age', ['-d', '-i', keyFile], { input: encrypted })
  assert.deepEqual(plain, leadsBytes)
})
