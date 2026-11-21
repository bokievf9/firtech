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
  assert.equal(estimate('websites', 'landing', []), 150)
  assert.equal(estimate('bots', 'faq', ['ai']), 220)
  assert.equal(estimate('apps', 'unknown', ['nope']), 0)
})

test('lead schema: requires name and contact, defaults the rest', () => {
  const ok = leadSchema.parse({ name: ' Мадина ', contact: '@madina' })
  assert.equal(ok.name, 'Мадина')
  assert.equal(ok.service, 'unknown')
  assert.equal(ok.locale, 'ru')
  assert.equal(leadSchema.safeParse({ name: '', contact: '@x' }).success, false)
  assert.equal(leadSchema.safeParse({ name: 'A', contact: 'x' }).success, false)
  assert.equal(leadSchema.safeParse({ name: 'A', contact: '@abc', service: 'hack' }).success, false)
  const bundle = leadSchema.parse({
    name: 'A',
    contact: '@abc',
    service: 'bundle',
    estimate: 'x'.repeat(900),
  })
  assert.match(formatLead(bundle), /Комплекс из сборки проекта/)
  assert.match(formatLead(bundle), /<b>Сборка:<\/b>/)
})

test('formatLead escapes HTML from visitors', () => {
  const text = formatLead(leadSchema.parse({ name: '<b>x</b>', contact: '@a&b' }))
  assert.match(text, /&lt;b&gt;x&lt;\/b&gt;/)
  assert.match(text, /@a&amp;b/)
})

test('dictionaries: hero, showcase and products line up in both languages', async () => {
  const { default: ru } = await import('../src/content/ru.ts')
  const { default: en } = await import('../src/content/en.ts')
  for (const dict of [ru, en]) {
    assert.equal(dict.hero.lines.length, 2)
    assert.equal(dict.hero.trust.length, 3)
    assert.equal(dict.work.rules.length, 4)
  }
  assert.deepEqual(Object.keys(ru.showcase.items), Object.keys(en.showcase.items))
  assert.deepEqual(Object.keys(ru.products.items), Object.keys(en.products.items))
})

test('builder quote: parts add up, 10% off from two parts, support is monthly', async () => {
  const { quote } = await import('../src/lib/builder.ts')
  const single = quote({ parts: { websites: { variant: 'landing', addons: [] } }, extras: [] })
  assert.equal(single.total, 150)
  assert.deepEqual(single.lines, [{ id: 'websites', price: 150 }])
  assert.equal(single.discount, null)

  const combo = quote({
    parts: { websites: { variant: 'landing', addons: [] }, bots: { variant: 'faq', addons: [] } },
    extras: ['support'],
  })
  assert.equal(combo.subtotal, 250)
  assert.equal(combo.discount, 30)
  assert.equal(combo.total, 220)
  assert.equal(combo.monthly, 20)
  assert.equal(quote({ parts: {}, extras: ['support'] }).discount, null)
})

test('builder link: round trip, unknown pieces dropped', async () => {
  const { decodeBuild, encodeBuild, presets } = await import('../src/lib/builder.ts')
  for (const build of Object.values(presets))
    assert.deepEqual(decodeBuild(encodeBuild(build)), build)
  assert.deepEqual(decodeBuild('websites.shop.payments-hack~evil.x~bots.nope~x.seo-gold'), {
    parts: { websites: { variant: 'shop', addons: ['payments'] } },
    extras: ['seo'],
  })
  assert.equal(decodeBuild(''), null)
  assert.equal(decodeBuild('nothing'), null)
})

test('formatLead: a lead at every field maximum fits a Telegram message', () => {
  const lead = leadSchema.parse({
    name: 'Н'.repeat(80),
    contact: '@'.repeat(120),
    service: 'bundle',
    budget: '$'.repeat(40),
    message: '<&>'.repeat(700).slice(0, 2000),
    estimate: 'с'.repeat(1500),
    page: 'https://firtech.pro/ru/builder?b='.padEnd(600, 'x'),
  })
  const text = formatLead(lead, 'Заявка №99999 с сайта Fir Tech')
  // Telegram counts characters after parsing the HTML entities.
  const plain = text.replace(/<[^>]+>/g, '').replace(/&lt;|&gt;|&amp;/g, '.')
  // Status, booking, note and the "sent late" line add up to about 600 more.
  assert.ok(plain.length < 3400, `too long: ${plain.length}`)
  assert.match(text, /полностью в \/admin/)
})
