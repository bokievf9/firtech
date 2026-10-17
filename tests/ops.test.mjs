import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decide } from '../scripts/ops/watch.mjs'
import { shouldSend } from '../scripts/ops/backup.mjs'

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
