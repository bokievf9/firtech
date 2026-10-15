import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pickLocale } from '../src/lib/i18n.ts'
import { estimate } from '../src/lib/pricing.ts'
import { formatLead, leadSchema } from '../src/lib/lead.ts'

test('pickLocale: Russian and CIS languages get ru, English gets en', () => {
  assert.equal(pickLocale(null), 'ru')
  assert.equal(pickLocale('ru-RU,ru;q=0.9,en;q=0.8'), 'ru')
  assert.equal(pickLocale('tg-TJ,en;q=0.5'), 'ru')
  assert.equal(pickLocale('en-US,en;q=0.9'), 'en')
  assert.equal(pickLocale('en;q=0.4,uz;q=0.9'), 'ru')
  assert.equal(pickLocale('de-DE'), 'en')
})

test('estimate: base price plus extras, upper bound 40% higher', () => {
  assert.deepEqual(estimate('websites', 'landing', []), { min: 150, max: 210 })
  assert.deepEqual(estimate('bots', 'faq', ['ai']), { min: 350, max: 490 })
  assert.deepEqual(estimate('apps', 'unknown', ['nope']), { min: 0, max: 0 })
})

test('lead schema: requires name and contact, defaults the rest', () => {
  const ok = leadSchema.parse({ name: ' Мадина ', contact: '@madina' })
  assert.equal(ok.name, 'Мадина')
  assert.equal(ok.service, 'unknown')
  assert.equal(ok.locale, 'ru')
  assert.equal(leadSchema.safeParse({ name: '', contact: '@x' }).success, false)
  assert.equal(leadSchema.safeParse({ name: 'A', contact: 'x' }).success, false)
  assert.equal(leadSchema.safeParse({ name: 'A', contact: '@abc', service: 'hack' }).success, false)
})

test('formatLead escapes HTML from visitors', () => {
  const text = formatLead(leadSchema.parse({ name: '<b>x</b>', contact: '@a&b' }))
  assert.match(text, /&lt;b&gt;x&lt;\/b&gt;/)
  assert.match(text, /@a&amp;b/)
})
