import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { track, trackHit, ymId } from '../src/lib/analytics.ts'

const savedId = process.env.NEXT_PUBLIC_YM_ID

afterEach(() => {
  delete globalThis.ym
  if (savedId === undefined) delete process.env.NEXT_PUBLIC_YM_ID
  else process.env.NEXT_PUBLIC_YM_ID = savedId
})

function fakeYm() {
  const calls = []
  globalThis.ym = (...args) => calls.push(args)
  return calls
}

test('track: no-op without a counter id or without ym', () => {
  delete process.env.NEXT_PUBLIC_YM_ID
  const calls = fakeYm()
  assert.doesNotThrow(() => track('lead_sent', { service: 'bots' }))
  assert.equal(calls.length, 0)

  process.env.NEXT_PUBLIC_YM_ID = '12345'
  delete globalThis.ym
  assert.doesNotThrow(() => track('builder_link_copied'))
  assert.doesNotThrow(() => trackHit('/ru'))
})

test('track: calls ym(id, reachGoal, goal, params) when ym is there', () => {
  process.env.NEXT_PUBLIC_YM_ID = '12345'
  const calls = fakeYm()
  track('builder_step', { step: 2 })
  track('builder_link_copied')
  trackHit('https://firtech.pro/en', 'https://firtech.pro/ru')
  assert.deepEqual(calls, [
    [12345, 'reachGoal', 'builder_step', { step: 2 }],
    [12345, 'reachGoal', 'builder_link_copied'],
    [12345, 'hit', 'https://firtech.pro/en', { referer: 'https://firtech.pro/ru' }],
  ])
})

test('track: a throwing ym never breaks the page', () => {
  process.env.NEXT_PUBLIC_YM_ID = '1'
  globalThis.ym = () => {
    throw new Error('blocked')
  }
  assert.doesNotThrow(() => track('extra_discuss', { service: 'ai' }))
})

test('ymId: digits only, anything else disables analytics', () => {
  process.env.NEXT_PUBLIC_YM_ID = ' 98765 '
  assert.equal(ymId(), 98765)
  for (const bad of ['', 'abc', '1);alert(1', '-5']) {
    process.env.NEXT_PUBLIC_YM_ID = bad
    assert.equal(ymId(), null)
  }
})
