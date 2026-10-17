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
  const bundle = leadSchema.parse({
    name: 'A',
    contact: '@abc',
    service: 'bundle',
    estimate: 'x'.repeat(900),
  })
  assert.match(formatLead(bundle), /Комплекс из конструктора/)
  assert.match(formatLead(bundle), /<b>Сборка:<\/b>/)
})

test('formatLead escapes HTML from visitors', () => {
  const text = formatLead(leadSchema.parse({ name: '<b>x</b>', contact: '@a&b' }))
  assert.match(text, /&lt;b&gt;x&lt;\/b&gt;/)
  assert.match(text, /@a&amp;b/)
})

test('dictionaries: compare table and stats line up in both languages', async () => {
  const { default: ru } = await import('../src/content/ru.ts')
  const { default: en } = await import('../src/content/en.ts')
  for (const dict of [ru, en]) {
    for (const row of dict.compare.rows)
      assert.equal(row.values.length, dict.compare.columns.length)
    assert.equal(dict.hero.lines.length, 3)
    assert.equal(dict.hero.trust.length, 3)
    assert.equal(dict.trust.stats.length, 4)
  }
  assert.deepEqual(Object.keys(ru.showcase.items), Object.keys(en.showcase.items))
  assert.equal(ru.compare.rows.length, en.compare.rows.length)
})

test('builder quote: parts add up, 10% off from two parts, support is monthly', async () => {
  const { quote } = await import('../src/lib/builder.ts')
  const single = quote({ parts: { websites: { variant: 'landing', addons: [] } }, extras: [] })
  assert.deepEqual(single.total, { min: 150, max: 210 })
  assert.equal(single.discount, null)

  const combo = quote({
    parts: { websites: { variant: 'landing', addons: [] }, bots: { variant: 'faq', addons: [] } },
    extras: ['support'],
  })
  assert.deepEqual(combo.subtotal, { min: 250, max: 350 })
  assert.deepEqual(combo.discount, { min: 30, max: 40 })
  assert.deepEqual(combo.total, { min: 220, max: 310 })
  assert.equal(combo.monthly, 30)
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
