import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decide } from '../scripts/ops/watch.mjs'
import { mkdtemp, readdir, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { copyExtras, shouldSend } from '../scripts/ops/backup.mjs'

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
