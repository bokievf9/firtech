import assert from 'node:assert/strict'
import { test } from 'node:test'
import en from '../src/content/en.ts'
import ru from '../src/content/ru.ts'
import { decodeBuild, encodeBuild } from '../src/lib/builder.ts'
import { estimateDoc } from '../src/lib/estimate-doc.ts'
import { dismissLastBuild, lastBuild, LAST_BUILD_KEY, rememberBuild } from '../src/lib/estimate-last.ts'
import { estimateLeadBody, estimateLink, parseContact } from '../src/lib/estimate-live.ts'
import { startLine } from '../src/lib/estimate-start.ts'
import { applyIntent, REMIND_AFTER_MS } from '../src/lib/lead-intent.ts'
import { leadSchema } from '../src/lib/lead.ts'
import { START_IN_DAYS } from '../src/lib/pricing.ts'

const code = 'websites.landing.telegram~bots.booking.payments~k.cafe'
const build = decodeBuild(code)
const memory = () => {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }
}

test('START_IN_DAYS: the honest start line, Russian plural and English', () => {
  assert.equal(START_IN_DAYS, 3)
  assert.equal(startLine(ru), 'Старт через 3 рабочих дня после оплаты первого этапа.')
  assert.equal(startLine(ru, 1), 'Старт через 1 рабочий день после оплаты первого этапа.')
  assert.equal(startLine(ru, 5), 'Старт через 5 рабочих дней после оплаты первого этапа.')
  assert.equal(startLine(ru, 11), 'Старт через 11 рабочих дней после оплаты первого этапа.')
  assert.equal(startLine(en), 'Work starts 3 working days after the first stage is paid.')
  assert.equal(estimateDoc(build, ru, 'ru').start, startLine(ru))
})

test('estimateLink and parseContact', () => {
  assert.equal(estimateLink('ru', build, 'https://x.test'), `https://x.test/ru/builder/estimate?b=${encodeBuild(build)}`)
  assert.equal(parseContact(' anna@example.com '), 'anna@example.com')
  assert.equal(parseContact('@nick_name'), '@nick_name')
  assert.equal(parseContact('t.me/nick_name'), '@nick_name')
  assert.equal(parseContact('nope'), null)
  assert.equal(parseContact('a@b'), null)
})

test('lead payload shapes: save-link and pay-first pass the lead schema', () => {
  const save = estimateLeadBody('save-link', build, ru, 'ru', { contact: 'anna@example.com', base: 'https://x.test' })
  assert.equal(save.intent, 'save-link')
  assert.equal(save.contact, 'anna@example.com')
  assert.equal(save.estimateUrl, `https://x.test/ru/builder/estimate?b=${encodeBuild(build)}`)
  assert.ok(leadSchema.safeParse(save).success)
  const pay = estimateLeadBody('pay-first', build, en, 'en', { who: { name: 'Anna', email: 'anna@example.com', telegram: '@anna_t' }, base: 'https://x.test' })
  assert.equal(pay.intent, 'pay-first')
  assert.equal(pay.name, 'Anna')
  assert.equal(pay.contact, 'anna@example.com, @anna_t')
  const parsed = leadSchema.safeParse(pay)
  assert.ok(parsed.success)
  assert.equal(parsed.data.intent, 'pay-first')
  assert.equal(parsed.data.estimateUrl, pay.estimateUrl)
})

test('lead schema: bad intent is refused, link and task are sanitized', () => {
  const base = { name: 'A', contact: 'anna@example.com' }
  assert.equal(leadSchema.safeParse({ ...base, intent: 'spam' }).success, false)
  const p = leadSchema.parse({ ...base, intent: 'quote', estimateUrl: 'javascript:alert(1)', task: 'a<b>\n\nneed   a site', preset: 'cafe' })
  assert.equal(p.estimateUrl, '')
  assert.equal(p.task, 'a b need a site')
  assert.equal(p.preset, 'cafe')
  assert.equal(leadSchema.parse({ ...base, task: 'x'.repeat(2000) }).task.length, 500)
})

test('applyIntent: remindAt = now + 1 day for quote and save-link, none for pay-first, text and brief carry it', () => {
  const now = new Date('2026-11-24T10:00:00.000Z')
  const at = new Date(now.getTime() + REMIND_AFTER_MS).toISOString()
  assert.equal(at, '2026-11-25T10:00:00.000Z')
  const quote = applyIntent({ intent: 'quote', estimateUrl: 'https://x.test/e', message: 'old text', brief: { v: 1 }, account: 'a@b.co' }, now)
  assert.equal(quote.remindAt, at)
  assert.ok(quote.message.includes(`Напомнить: ${at}`))
  assert.ok(quote.message.includes('Смета: https://x.test/e'))
  assert.ok(quote.message.endsWith('old text'))
  assert.deepEqual(quote.brief, { v: 1, intent: 'quote', remindAt: at, estimateUrl: 'https://x.test/e', account: 'a@b.co' })
  const save = applyIntent({ intent: 'save-link', message: '' }, now)
  assert.equal(save.remindAt, at)
  const pay = applyIntent({ intent: 'pay-first', message: 'm' }, now)
  assert.equal(pay.remindAt, undefined)
  assert.ok(!pay.message.includes('Напомнить'))
  assert.equal(pay.brief.remindAt, undefined)
  const none = { message: 'plain' }
  assert.equal(applyIntent(none, now), none)
})

test('applyIntent: the message stays within the schema limit and a huge brief keeps the builder brief', () => {
  const big = applyIntent({ intent: 'quote', message: 'x'.repeat(2000) })
  assert.equal(big.message.length, 2000)
  const brief = { v: 1, pad: 'y'.repeat(3300) }
  const out = applyIntent({ intent: 'quote', estimateUrl: 'https://x.test/' + 'z'.repeat(200), message: '', brief })
  assert.equal(out.brief.pad, brief.pad)
  assert.equal(out.brief.estimateUrl, undefined)
  assert.equal(out.brief.intent, 'quote')
})

test('last build storage: remember, read, dismiss, broken and blocked storage', () => {
  const s = memory()
  assert.equal(lastBuild(s), null)
  assert.equal(rememberBuild(build, s, 123), true)
  assert.deepEqual(lastBuild(s), { code: encodeBuild(build), savedAt: 123 })
  dismissLastBuild(s)
  assert.equal(lastBuild(s), null)
  rememberBuild(build, s, 456)
  assert.equal(lastBuild(s)?.savedAt, 456)
  s.setItem(LAST_BUILD_KEY, '{not json')
  assert.equal(lastBuild(s), null)
  s.setItem(LAST_BUILD_KEY, JSON.stringify({ code: '', savedAt: 1 }))
  assert.equal(lastBuild(s), null)
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
  assert.equal(rememberBuild(build, blocked), false)
  assert.equal(lastBuild(blocked), null)
  assert.equal(lastBuild(null), null)
  assert.equal(rememberBuild({ parts: {}, extras: [] }, s), false)
})
