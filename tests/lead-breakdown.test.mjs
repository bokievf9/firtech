import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeBuild, decodeBuild } from '../src/lib/builder.ts'
import en from '../src/content/en.ts'
import ru from '../src/content/ru.ts'
import { leadSummary } from '../src/lib/estimate-doc.ts'
import { findBuildCode, leadBreakdown } from '../src/lib/lead-breakdown.ts'

// A full brief: kind, products, goals, channels, style, details and a wish.
const full =
  'websites.landing.telegram~bots.booking.payments~x.seo-support~k.barber~p.adminbot-site~g.leads-booking~c.instagram-telegram~y.noir.serif.sharp.airy.premium.luxe~d.5.ru-en.logo-texts.month'
const wish = Buffer.from('Хочу сайт как у конкурента', 'utf8').toString('base64url')
const withWish = `${full}~w.${wish}`

test('findBuildCode: the link in a field, in the estimate text, in the message, or nowhere', () => {
  assert.equal(findBuildCode('https://firtech.pro/ru/builder?b=apps.pwa')?.code, 'apps.pwa')
  assert.equal(findBuildCode('https://firtech.pro/en/builder/estimate?b=apps.pwa&x=1')?.locale, 'en')
  assert.equal(findBuildCode(null, 'Смета тут: https://firtech.pro/ru/builder?b=bots.booking~k.cafe) конец')?.code, 'bots.booking~k.cafe')
  assert.equal(findBuildCode('?b=websites.landing%7Ek.cafe')?.code, 'websites.landing~k.cafe')
  assert.equal(findBuildCode('нет ссылки', null, undefined), null)
  assert.equal(findBuildCode(), null)
})

test('leadBreakdown: a full builder link gives niche, products, goals, channels, style, details, estimate and links', () => {
  const b = leadBreakdown({ builderUrl: `https://firtech.pro/ru/builder?b=${withWish}`, message: 'Нужен сайт и бот для барбершопа' })
  assert.equal(b.empty, false)
  assert.equal(b.oldLink, false)
  assert.equal(b.locale, 'ru')
  assert.equal(b.code, withWish)
  assert.deepEqual(b.build, decodeBuild(withWish))
  assert.equal(b.estimateHref, `/ru/builder/estimate?b=${withWish}`)
  assert.equal(b.buildHref, `/ru/builder?b=${withWish}`)
  const labels = Object.fromEntries(b.answers.map((r) => [r.id, r.value]))
  assert.ok(labels.kind, 'niche')
  assert.ok(labels.products.includes(','), 'two products')
  assert.ok(labels.goals && labels.channels, 'goals and channels')
  assert.equal(labels.pages, '5')
  assert.equal(labels.langs, 'RU, EN')
  assert.ok(labels.has && labels.deadline)
  assert.equal(labels.wish, 'Хочу сайт как у конкурента')
  assert.ok(b.style.length >= 4, 'style rows')
  assert.equal(b.swatch.mode, 'dark')
  assert.ok(/^#[0-9a-f]{6}$/i.test(b.swatch.accent))
  assert.deepEqual(b.doc.parts.map((p) => p.id), ['websites', 'bots'])
  assert.deepEqual(b.doc.extras.map((p) => p.id), ['seo'])
  assert.ok(b.doc.monthly, 'support is the monthly line')
  assert.ok(b.doc.parts.every((p) => p.price.startsWith('$')))
  assert.ok(b.doc.stages.length >= 2, 'stages')
  assert.equal(b.doc.link.endsWith(`builder?b=${withWish}`), true)
  assert.equal(b.message, 'Нужен сайт и бот для барбершопа')
})

test('leadBreakdown reads the link out of the lead text and the estimate keeps its own words', () => {
  const build = decodeBuild(full)
  const estimate = leadSummary(build, ru, 'ru')
  const b = leadBreakdown({ estimate, message: `Сборка: https://firtech.pro/ru/builder?b=${full}` })
  assert.equal(b.code, full)
  assert.equal(b.estimateText, estimate.trim())
  assert.ok(b.doc)
  // The same numbers as the estimate text the client sent.
  assert.ok(estimate.includes(b.doc.total))
})

test('leadBreakdown: an old link (parts and extras only) still gives prices, with the old-link flag', () => {
  const b = leadBreakdown({ builderUrl: 'https://firtech.pro/ru/builder?b=websites.landing.telegram~x.seo' })
  assert.equal(b.oldLink, true)
  assert.deepEqual(b.answers, [])
  assert.deepEqual(b.style, [])
  assert.equal(b.swatch, null)
  assert.equal(b.doc.parts.length, 1)
  assert.equal(b.doc.extras.length, 1)
  assert.ok(b.estimateHref.endsWith('b=websites.landing.telegram~x.seo'))
})

test('leadBreakdown: a bare code, the English page and an unknown part are handled', () => {
  const bare = leadBreakdown({ builderUrl: 'apps.pwa', locale: 'en' })
  assert.equal(bare.locale, 'en')
  assert.equal(bare.doc.parts[0].name, en.services.items.apps.name)
  assert.equal(bare.estimateHref, '/en/builder/estimate?b=apps.pwa')
  const link = leadBreakdown({ builderUrl: 'https://firtech.pro/en/builder?b=apps.pwa', locale: 'ru' })
  assert.equal(link.locale, 'en', 'the link wins over the lead locale')
  // Unknown ids are dropped by decodeBuild, the rest survives.
  const odd = leadBreakdown({ builderUrl: 'https://firtech.pro/ru/builder?b=zzz.nope~apps.pwa~k.unknownkind' })
  assert.deepEqual(odd.doc.parts.map((p) => p.id), ['apps'])
})

test('leadBreakdown: missing or broken data never throws and says there is nothing', () => {
  const none = leadBreakdown({})
  assert.equal(none.empty, true)
  assert.equal(none.doc, null)
  assert.equal(none.estimateHref, null)
  assert.equal(leadBreakdown({ estimate: null, message: null, builderUrl: null }).empty, true)
  // Only words: no link, the message and the estimate text are kept as they are.
  const words = leadBreakdown({ message: '  Нужен бот  ', estimate: 'Итого: $300' })
  assert.equal(words.empty, false)
  assert.equal(words.build, null)
  assert.equal(words.message, 'Нужен бот')
  assert.equal(words.estimateText, 'Итого: $300')
  // A link whose code decodes to nothing keeps the words and no breakdown.
  const broken = leadBreakdown({ builderUrl: 'https://firtech.pro/ru/builder?b=%%%', message: 'привет' })
  assert.equal(broken.doc, null)
  assert.equal(broken.message, 'привет')
  const junk = leadBreakdown({ builderUrl: 'https://firtech.pro/ru/builder?b=qqq.zzz' })
  assert.equal(junk.doc, null)
  assert.equal(junk.empty, false, 'a link was there')
})

test('encode then break down is a round trip for the build', () => {
  const build = decodeBuild(withWish)
  const b = leadBreakdown({ builderUrl: `/ru/builder?b=${encodeBuild(build)}` })
  assert.deepEqual(b.build, build)
})
