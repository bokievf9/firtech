import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { hitUrl, metrikaAllowed, metrikaInitScript, track, trackHit, ymId } from '../src/lib/analytics.ts'

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

test('security 2026-11-23 (P1-7): Metrika is off on the cabinet, payment, demo and unsubscribe pages', () => {
  for (const p of ['/ru/cabinet', '/en/cabinet/login', '/ru/cabinet?tab=documents', '/ru/cabinet/unsubscribe', '/en/pay/INV-12', '/ru/pay', '/ru/demo/abc123', '/en/demo', '/agent/x1', '/admin/office', '/ru/news/unsubscribe', '/unsubscribe', '/RU/Cabinet']) {
    assert.equal(metrikaAllowed(p), false, p)
  }
  for (const p of ['/', '/ru', '/en/builder', '/ru/pay-how', '/ru/blog/kak-vybrat', '/ru/products/admin', '/en/demo-salon', '/ru/solutions/salon']) {
    assert.equal(metrikaAllowed(p), true, p)
  }
})

test('security 2026-11-23 (P1-7): hits carry no query or hash, webvisor is off, the first hit is sent by hand', () => {
  assert.equal(hitUrl('https://firtech.pro/ru/pay/7?k=secret#x'), 'https://firtech.pro/ru/pay/7')
  assert.equal(hitUrl('javascript:alert(1)'), '')
  assert.equal(hitUrl('nonsense'), '')
  process.env.NEXT_PUBLIC_YM_ID = '12345'
  const calls = fakeYm()
  trackHit('https://firtech.pro/ru/builder?b=abc&ref=x', 'https://firtech.pro/ru/cabinet/unsubscribe?token=t')
  trackHit('/ru/blog?utm=1')
  assert.deepEqual(calls, [
    [12345, 'hit', 'https://firtech.pro/ru/builder', { referer: 'https://firtech.pro/ru/cabinet/unsubscribe' }],
    [12345, 'hit', '/ru/blog'],
  ])
  const script = metrikaInitScript(12345)
  assert.match(script, /webvisor:false/)
  assert.doesNotMatch(script, /webvisor:true/)
  assert.match(script, /defer:true/)
  assert.match(script, /ym\(12345,"hit",location\.origin\+location\.pathname/)
  assert.doesNotMatch(script, /location\.href/)
  const component = readFileSync('src/components/yandex-metrika.tsx', 'utf8')
  assert.match(component, /if \(!id \|\| !allowed\) return null/)
  assert.match(component, /disableYaCounter\$\{id\}/)
  assert.doesNotMatch(component, /webvisor:true/)
})
