import assert from 'node:assert/strict'
import { test } from 'node:test'
import en from '../src/content/en.ts'
import ru from '../src/content/ru.ts'
import {
  decodeBuild,
  encodeBuild,
  presets,
  quote,
  withDetails,
  withLangs,
} from '../src/lib/builder.ts'
import { estimateDoc, leadLimit, leadSummary } from '../src/lib/estimate-doc.ts'

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
    pages: 20,
    langs: ['ru', 'en', 'tj', 'uz'],
    has: ['logo', 'texts', 'photos', 'domain', 'hosting'],
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
    'websites.landing~g.leads-hack~c.tiktok~s.ugly.lime.neon.soft~d.999.ru-xx.logo-cash.never~u.!!!~w.%%%~z.1',
  )
  assert.deepEqual(build, {
    parts: { websites: { variant: 'landing', addons: [] } },
    extras: [],
    goals: ['leads'],
    style: { accent: 'lime', font: 'soft' },
    details: { pages: 20, langs: ['ru'], has: ['logo'] },
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
    ['pages', 'langs', 'has', 'deadline', 'examples', 'wish'],
  )
  assert.equal(estimateDoc(presets.shop, en, 'en').brief.style.length, 0)
})

test('builder copy: same shape and no long dashes in both languages', () => {
  assert.equal(ru.builder.steps.length, 7)
  assert.equal(en.builder.steps.length, 7)
  for (const dict of [ru, en]) assert.doesNotMatch(JSON.stringify(dict.builder), /[–—]/)
})
