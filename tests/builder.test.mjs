import assert from 'node:assert/strict'
import { test } from 'node:test'
import en from '../src/content/en.ts'
import ru from '../src/content/ru.ts'
import {
  applyKind,
  decodeBuild,
  emptyBuild,
  encodeBuild,
  isStartingSet,
  presets,
  toggleProduct,
  quote,
  withDetails,
  withLangs,
} from '../src/lib/builder.ts'
import { estimateDoc, estimateJson, leadEstimateFields, leadLimit, leadPage, leadSummary } from '../src/lib/estimate-doc.ts'

const full = {
  parts: {
    websites: { variant: 'shop', addons: ['language', 'telegram', 'payments', 'cms'] },
    bots: { variant: 'miniapp', addons: ['payments', 'broadcasts', 'admin', 'ai'] },
    apps: { variant: 'mobile', addons: ['accounts', 'payments', 'push', 'admin'] },
    automation: { variant: 'assistant', addons: ['sheets', 'alerts', 'training', 'support'] },
  },
  extras: ['support', 'seo', 'design'],
  goals: ['leads', 'sales', 'booking', 'routine', 'brand'],
  channels: ['instagram', 'telegram', 'search', 'word'],
  style: { look: 'premium', accent: 'coral', theme: 'light', font: 'soft' },
  details: {
    langs: ['ru', 'en', 'tj', 'uz'],
    has: ['logo', 'texts', 'photos', 'domain', 'hosting', 'access'],
    examples: ['https://example.com/very/long/path/' + 'a'.repeat(60), 'кафе.tj/меню'],
    deadline: 'asap',
    wish: 'Нужен раздел с меню, доставкой по городу и оплатой картой. '.repeat(6).slice(0, 300),
  },
}

test('builder link: every new field survives a round trip', () => {
  assert.deepEqual(decodeBuild(encodeBuild(full)), full)
  const partial = {
    parts: { bots: { variant: 'faq', addons: [] } },
    extras: [],
    style: { accent: 'sky' },
    details: { deadline: 'month', wish: 'Тест ~ с . точками - и ~тильдами' },
  }
  assert.deepEqual(decodeBuild(encodeBuild(partial)), partial)
})

test('builder link: old links decode as before, presets stay compact', () => {
  assert.deepEqual(decodeBuild('websites.landing.telegram~bots.booking.payments~x.seo'), {
    parts: {
      websites: { variant: 'landing', addons: ['telegram'] },
      bots: { variant: 'booking', addons: ['payments'] },
    },
    extras: ['seo'],
  })
  for (const build of Object.values(presets)) {
    assert.doesNotMatch(encodeBuild(build), /~[gcsduw]\./)
    assert.deepEqual(decodeBuild(encodeBuild(build)), build)
  }
})

test('builder link: unknown values are dropped', () => {
  const build = decodeBuild(
    'websites.landing~g.leads-hack~c.snapchat~s.ugly.lime.neon.soft~d.999.ru-xx.logo-cash.never~u.!!!~w.%%%~z.1',
  )
  assert.deepEqual(build, {
    parts: { websites: { variant: 'landing', addons: [] } },
    extras: [],
    goals: ['leads'],
    style: { accent: 'lime', font: 'soft' },
    details: { langs: ['ru'], has: ['logo'] },
  })
  // A text chunk that is not a link is dropped.
  assert.equal(decodeBuild(encodeBuild({ ...full, details: { examples: ['<script>'] } })).details, undefined)
})

test('quote: style, goals and details never change the price', () => {
  const bare = { parts: full.parts, extras: full.extras }
  assert.deepEqual(quote(full), quote(bare))
})

test('languages: two or more turn on the website option, without a website only a note', () => {
  const site = { parts: { websites: { variant: 'landing', addons: [] } }, extras: [] }
  const two = withLangs(site, ['ru', 'en'])
  assert.deepEqual(two.parts.websites.addons, ['language'])
  assert.deepEqual(two.details, { langs: ['ru', 'en'] })
  assert.deepEqual(withLangs(two, ['ru']).parts.websites.addons, [])
  assert.deepEqual(withLangs(withLangs(two, ['ru', 'en', 'tj']), ['ru', 'en']).parts.websites.addons, ['language'])
  const bot = { parts: { bots: { variant: 'faq', addons: [] } }, extras: [] }
  assert.deepEqual(quote(withLangs(bot, ['ru', 'en', 'uz'])), quote(bot))
  assert.equal(withDetails(two, { langs: [] }).details, undefined)
})

test('lead summary: a maximal build stays within the form limit and keeps the brief', () => {
  for (const [dict, locale] of [
    [ru, 'ru'],
    [en, 'en'],
  ]) {
    const text = leadSummary(full, dict, locale)
    assert.ok(text.length <= leadLimit, `${locale}: ${text.length}`)
    assert.match(text, new RegExp(dict.builder.looks.premium.name))
    assert.match(text, new RegExp(dict.builder.goals.sales.name))
    assert.match(text, new RegExp(dict.builder.deadlines.asap))
    assert.match(text, new RegExp(`${dict.builder.total}: `))
  }
  const plain = leadSummary(presets.cafe, ru, 'ru')
  assert.doesNotMatch(plain, /Стиль|Цели/)
})

test('estimate doc: brief sections for style, goals and details', () => {
  const doc = estimateDoc(full, ru, 'ru')
  assert.deepEqual(
    doc.brief.style.map((r) => r.value),
    ['Премиум', 'Коралл', 'Светлая', 'Мягкий'],
  )
  assert.equal(doc.brief.goals.length, 2)
  assert.deepEqual(
    doc.brief.details.map((r) => r.id),
    ['deadline', 'has', 'langs', 'examples', 'wish'],
  )
  assert.equal(estimateDoc(presets.shop, en, 'en').brief.style.length, 0)
})

test('builder copy: same shape and no long dashes in both languages', () => {
  assert.equal(ru.builder.steps.length, 7)
  assert.equal(en.builder.steps.length, 7)
  for (const dict of [ru, en]) assert.doesNotMatch(JSON.stringify(dict.builder), /[–—]/)
})

test('leadServiceOf: one main service is itself, anything more is a bundle', async () => {
  const { leadServiceOf, emptyBuild } = await import('../src/lib/builder.ts')
  const one = { ...emptyBuild, parts: { bots: { variant: 'faq', addons: [] } } }
  assert.equal(leadServiceOf(one), 'bots')
  const two = { ...one, parts: { ...one.parts, websites: { variant: 'landing', addons: [] } } }
  assert.equal(leadServiceOf(two), 'bundle')
})

test('builder link: prototype names are not formats', () => {
  assert.equal(decodeBuild('websites.constructor~bots.toString'), null)
  const build = decodeBuild('websites.landing~bots.valueOf.payments')
  assert.deepEqual(Object.keys(build.parts), ['websites'])
  assert.equal(typeof quote(build).total, 'number')
})

test('languages chosen earlier keep the second-language option when a website joins later', () => {
  const two = withLangs({ parts: { bots: { variant: 'faq', addons: [] } }, extras: [] }, ['ru', 'en'])
  assert.equal(two.parts.websites, undefined)
  const withSite = toggleProduct(two, 'site')
  assert.ok(withSite.parts.websites.addons.includes('language'))
  const other = applyKind(two, 'salon')
  assert.ok(other.parts.websites.addons.includes('language'))
  // One language does not add it.
  const one = withLangs({ parts: {}, extras: [] }, ['ru'])
  assert.deepEqual(toggleProduct(one, 'site').parts.websites.addons, [])
})

test('starting sets (card links) are told apart from a configured build', () => {
  assert.equal(isStartingSet(presets.salon), true)
  assert.equal(isStartingSet(toggleProduct(emptyBuild, 'adminbot')), true)
  assert.equal(isStartingSet(toggleProduct(emptyBuild, 'content')), true)
  assert.equal(isStartingSet(withDetails(presets.salon, { wish: 'x' })), false)
  assert.equal(isStartingSet(decodeBuild('websites.shop~bots.faq')), false)
})

test('estimate doc: stage rows with amounts that sum to the total, the rule sentence in the copy', () => {
  const usd = (s) => Number(s.replace(/[^\d]/g, ''))
  const doc = estimateDoc(full, ru, 'ru')
  assert.equal(doc.stages.length, 4) // the mobile app is the most expensive part: the app template
  assert.equal(doc.stages.reduce((sum, s) => sum + usd(s.amount), 0), quote(full).total)
  assert.deepEqual(doc.stages.map((s) => s.n), [1, 2, 3, 4])
  assert.deepEqual(doc.stages.map((s) => s.share), ['25%', '25%', '25%', '25%'])
  assert.equal(doc.stages[0].name, 'Дизайн и прототип')
  assert.equal(estimateDoc(full, en, 'en').stages[0].name, 'Design and prototype')
  assert.deepEqual(Object.keys(ru.builder.stageCols), ['stage', 'what', 'share', 'amount'])
  assert.equal(ru.builder.stageCols.what, 'Что входит')
  assert.equal(ru.builder.stageRule, 'Каждый этап оплачивается до его начала, последний до передачи.')
  assert.match(en.builder.stageRule, /before it starts/)
})

test('estimate doc: a 290 bot is two stages, a 1200 site is three, nothing priced has none', () => {
  const usd = (s) => Number(s.replace(/[^\d]/g, ''))
  // A booking bot (250) with broadcasts (40) is 290, under the 300 limit.
  const bot = { parts: { bots: { variant: 'booking', addons: ['broadcasts'] } }, extras: [] }
  assert.equal(quote(bot).total, 290)
  const small = estimateDoc(bot, ru, 'ru')
  assert.deepEqual(small.stages.map((s) => [s.name, s.share, usd(s.amount)]), [['Старт', '50%', 145], ['Запуск', '50%', 145]])
  // A shop with every add-on (920) plus two extras: over the limit, the site template.
  const big = { parts: { websites: { variant: 'shop', addons: ['language', 'telegram', 'payments', 'cms'] } }, extras: ['seo', 'design'] }
  assert.equal(estimateDoc(big, ru, 'ru').stages.length, 3)
  assert.equal(estimateDoc({ parts: {}, extras: [] }, ru, 'ru').stages.length, 0)
})

test('lead summary: a compact stage line, the limit still holds', () => {
  for (const [dict, locale] of [[ru, 'ru'], [en, 'en']]) {
    const text = leadSummary(full, dict, locale)
    assert.match(text, new RegExp(`${dict.builder.stageLead}: 1\\. \\$[\\d,]+ \\(25%\\), 2\\.`))
    assert.ok(text.length <= leadLimit)
  }
  const plain = leadSummary(presets.cafe, ru, 'ru')
  assert.match(plain, /Оплата по этапам: 1\. \$[\d,]+/)
  // The scope line stays after the stage line.
  assert.ok(plain.indexOf('Оплата по этапам') < plain.indexOf(estimateDoc(presets.cafe, ru, 'ru').scope))
})

test('lead estimate JSON: lines, discount, total as HQ checks it, text summary stays in the message', () => {
  const j = estimateJson(full, ru, 'ru')
  assert.equal(j.v, 1)
  const q = quote(full)
  assert.equal(j.lines.length, q.lines.length)
  assert.ok(j.lines.every((l) => l.label && l.usd > 0))
  assert.equal(j.totalUsd, j.lines.reduce((a, l) => a + l.usd, 0) - (j.discountUsd ?? 0))
  assert.equal(j.totalUsd, q.total)
  assert.equal(j.monthlyUsd, q.monthly)
  const fields = leadEstimateFields(full, ru, 'ru')
  assert.ok(fields.estimate.startsWith('{') && fields.estimate.length <= leadLimit)
  assert.deepEqual(JSON.parse(fields.estimate), j)
  assert.equal(fields.message, leadSummary(full, ru, 'ru'))
  assert.ok(fields.message.length <= 2000)
  // nothing priced: no JSON, the text goes in `estimate` as before
  const none = leadEstimateFields({ parts: {}, extras: [] }, ru, 'ru')
  assert.equal(none.message, undefined)
  assert.equal(estimateJson({ parts: {}, extras: [] }, ru, 'ru'), null)
})

test('lead page: the whole builder link, cut at a ~ when over 600 characters', () => {
  const link = estimateDoc(presets.cafe, ru, 'ru').link
  assert.equal(leadPage(link), link)
  assert.match(link, /\/ru\/builder\?b=/)
  const long = `https://firtech.pro/ru/builder?b=${Array.from({ length: 80 }, (_, i) => `x.part${i}`).join('~')}`
  const cut = leadPage(long)
  assert.ok(cut.length <= 600 && long.startsWith(cut) && !cut.endsWith('~'))
})
