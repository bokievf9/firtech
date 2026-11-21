// Copy QA (owner 2026-11-22): the public dictionaries, the blog articles and llms.txt are scanned for AI tells,
// stock phrases, long dashes, exclamation marks, «бот» inside product names and numerals in the hero.
// Sections that another stream owns (builder, builderCatalog, estimate, cabinet, admin) are not scanned.
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return next(candidate, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
})

const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const { articles } = await import('../src/content/blog/index.ts')

function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k)
}

const skipped = new Set(['builder', 'builderCatalog', 'estimate', 'estimator', 'cabinet', 'admin', 'leadAuth'])
const publicOf = (dict) => Object.fromEntries(Object.entries(dict).filter(([k]) => !skipped.has(k)))
const legal = /^(privacy|terms)\b/

const scopes = [
  ['ru', publicOf(ru)],
  ['en', publicOf(en)],
  ['blog', articles.map((a) => ({ ru: a.ru, en: a.en }))],
]

// AI tells by sentence shape.
const shapeTells = [
  /\bэто не [^.!?]{1,60}, а\b/i,
  /\bне просто [^.!?]{1,60}, а\b/i,
  /\bне только [^.!?]{1,60}, но и\b/i,
  /\bit'?s not [^.!?]{1,60}, it'?s\b/i,
  /\bnot (just|only|merely) [^.!?]{1,60}, (but|it)\b/i,
  /\bбез [^,.!?]{1,30}, без [^,.!?]{1,30}, (и )?без\b/i,
  /\bno [^,.!?]{1,30}, no [^,.!?]{1,30}, (and )?no\b/i,
  /, (позволяя|делая|помогая|обеспечивая|allowing|making|helping|ensuring)\b/i,
  /\bрезультат\?\s/i,
  /\bthe result\?\s/i,
]

// Stock phrases and marketing filler, RU and EN.
const stock = [
  /в современном мире/i,
  /в наше время/i,
  /в эпоху цифров/i,
  /в динамично/i,
  /уникальн/i,
  /инновацион/i,
  /передов(ой|ые|ых) технологи/i,
  /современн(ые|ых|ый) технологи/i,
  /комплексн(ый|ое|ые|ых) (подход|решени)/i,
  /индивидуальн(ый|ого) подход/i,
  /широк(ий|ого) спектр/i,
  /в кратчайшие сроки/i,
  /высококвалифицирован/i,
  /команда профессионалов/i,
  /лидер рынка/i,
  /на новый уровень/i,
  /раскро(й|йте|ем) потенциал/i,
  /погрузи(тесь|мся)/i,
  /добро пожаловать/i,
  /революци/i,
  /бесшовн/i,
  /кардинально/i,
  /мощн(ый|ые|ого|ых) инструмент/i,
  /\bin today'?s\b/i,
  /\bfast-paced\b/i,
  /\bwhether you('| a)re\b/i,
  /\bhere'?s the thing\b/i,
  /\bsay goodbye\b/i,
  /\bunlock(ing)? the power\b/i,
  /\bcutting-edge\b/i,
  /\bstate-of-the-art\b/i,
  /\bgame-?changer\b/i,
  /\bnext level\b/i,
  /\bseamless(ly)?\b/i,
  /\brobust\b/i,
  /\bstreamlin/i,
  /\bempower/i,
  /\bleverag/i,
  /\bholistic\b/i,
  /\bsupercharg/i,
  /\bdelve\b/i,
  /\bunique\b/i,
  /\binnovative\b/i,
  /\btailored\b/i,
  /\bworld-class\b/i,
  /\bat your fingertips\b/i,
]

// Every hit is collected so one run lists all of them.
function none(hits) {
  assert.deepEqual(hits, [], `${hits.length} hit(s):\n${hits.join('\n')}`)
}

test('copy-qa: no AI-tell sentence shapes in the public copy', () => {
  const hits = []
  for (const [name, value] of scopes)
    for (const [at, text] of strings(value))
      for (const re of shapeTells) if (re.test(text)) hits.push(`${name} ${at}: ${text.slice(0, 100)}`)
  none(hits)
})

test('copy-qa: no stock phrases or marketing filler', () => {
  const hits = []
  for (const [name, value] of scopes)
    for (const [at, text] of strings(value))
      for (const re of stock) if (re.test(text)) hits.push(`${name} ${at} [${re}]: ${text.slice(0, 100)}`)
  none(hits)
})

test('copy-qa: no long dashes and no exclamation marks', () => {
  const hits = []
  for (const [name, value] of scopes)
    for (const [at, text] of strings(value)) if (/[–—!]/.test(text)) hits.push(`${name} ${at}: ${text.slice(0, 100)}`)
  none(hits)
})

test('copy-qa: «бот» is only a channel, never a product name or a product promise', () => {
  const bot = /(?<![а-яё])бот(?:а|ы|ов|у|е|ом|ам|ами|ах)?(?![а-яё])|\bbots?\b/i
  const hits = []
  for (const [locale, dict] of [['ru', ru], ['en', en]]) {
    const checked = {
      products: { ...dict.products, plans: undefined, demo: undefined, classicTitle: undefined, classicSub: undefined },
      productPage: dict.productPage,
      ladder: dict.ladder,
      demoSection: dict.demoSection,
      how: dict.how,
      aiTeams: dict.aiTeams,
      hero: { ...dict.hero, demo: undefined },
      nav: dict.nav,
      footer: dict.footer,
      solutionsHome: dict.solutionsHome,
      showcase: { ...dict.showcase, demo: undefined },
    }
    // The guarantee sentence is an owner-fixed wording (2026-11-19, terms and tests quote it): it keeps «бот» / "bot".
    for (const [at, text] of strings(checked)) if (bot.test(text.replace(dict.guarantee.line, ''))) hits.push(`${locale} ${at}: ${text.slice(0, 100)}`)
  }
  none(hits)
})

test('copy-qa: the hero carries no numerals and no prices', () => {
  for (const [locale, dict] of [['ru', ru], ['en', en]]) {
    const { title, lines, eyebrow, sub, primary, chatCta, teamLink, trust } = dict.hero
    for (const [at, text] of strings({ title, lines, eyebrow, sub, primary, chatCta, teamLink, trust }))
      assert.doesNotMatch(text, /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b|\b(один|два|три|четыре|пять|шесть|семь|восемь|девять|десять)\b/i, `${locale} hero.${at}: ${text}`)
  }
})

test('copy-qa: no sentence longer than 45 words outside the legal pages', () => {
  const hits = []
  for (const [name, value] of scopes)
    for (const [at, text] of strings(value)) {
      if (legal.test(at)) continue
      for (const sentence of text.split(/(?<=[.?])\s+/)) {
        const words = sentence.trim().split(/\s+/).length
        if (words > 45) hits.push(`${name} ${at}: ${words} words: ${sentence.slice(0, 90)}`)
      }
    }
  none(hits)
})

test('copy-qa: the 5-minute promise and the guarantee are word for word the same everywhere', () => {
  for (const [locale, dict] of [['ru', ru], ['en', en]]) {
    const hits = []
    for (const [at, text] of strings(publicOf(dict))) {
      if (!/5 минут|5 minutes/.test(text) || /1-5/.test(text)) continue
      if (!text.includes(dict.sla.short)) hits.push(`${locale} ${at}: ${text.slice(0, 100)}`)
    }
    none(hits)
    assert.ok(dict.contact.sub.includes(dict.sla.line), `${locale} contact.sub carries the full line`)
    assert.ok(dict.sla.llms === dict.sla.line, `${locale} llms line is the same sentence`)
    assert.ok(dict.faq.items.some((i) => i.a.startsWith(dict.sla.line)), `${locale} faq answers with the full line`)
    const guaranteeSentence = dict.guarantee.line.replace(/\.$/, '')
    assert.ok(dict.guarantee.llms.includes(guaranteeSentence.slice(1, 60)), `${locale} llms guarantee`)
    assert.ok(dict.faq.items.some((i) => i.a.includes(guaranteeSentence)), `${locale} faq quotes the guarantee word for word`)
    assert.ok(dict.how.dislike.includes(dict.guarantee.line), `${locale} how-we-work quotes the guarantee word for word`)
    assert.ok(dict.comparePage.contrast.rows.some((r) => r.us.startsWith(dict.guarantee.line)), `${locale} compare quotes the guarantee word for word`)
  }
})

test('copy-qa: one set of product names, no old names, only the three CTAs for the builder and the agent', () => {
  const names = {
    ru: ['ИИ-администратор', 'ИИ-менеджер заявок', 'Автоматизация процессов', 'Контент на автопилоте', 'Telegram Mini App', 'Персональный ИИ-ассистент', 'ИИ-отдел под ключ'],
    en: ['AI booking assistant', 'AI lead manager', 'Process automation', 'Content on autopilot', 'Telegram Mini App', 'Personal AI assistant', 'AI department, turnkey'],
  }
  for (const [locale, dict] of [['ru', ru], ['en', en]]) {
    assert.deepEqual(Object.values(dict.products.items).map((i) => i.name), names[locale])
    const hits = []
    for (const [at, text] of strings(publicOf(dict)))
      if (/ИИ-приёмщик|ИИ-ресепшн|калькулятор|конструктор проект|AI receptionist|calculator|configurator/i.test(text)) hits.push(`${locale} ${at}: ${text.slice(0, 100)}`)
    none(hits)
  }
  assert.equal(ru.nav.cta, 'Собрать проект')
  assert.equal(ru.nav.ask, 'Спросить агента')
  assert.equal(ru.nav.builder, 'Сборка проекта')
  for (const [locale, dict] of [['ru', ru], ['en', en]]) {
    for (const at of ['hero.primary', 'hero.chatCta', 'products.build', 'products.discuss', 'extras.discuss', 'showcase.cta', 'payHow.ctaBuilder', 'comparePage.ctaBuilder', 'referral.ctaBuilder', 'servicePage.conceptCta', 'servicePage.estimate'])
      assert.ok([dict.nav.cta, dict.nav.ask].includes(at.split('.').reduce((o, k) => o[k], dict)), `${locale} ${at}`)
  }
})

test('copy-qa: llms.txt reads as plain text without tells', async () => {
  const { GET } = await import('../src/app/llms.txt/route.ts')
  const body = await (await GET()).text()
  assert.doesNotMatch(body, /[–—]/)
  assert.doesNotMatch(body, /!/)
  // The classic priced service «Telegram bots» keeps its name in the services lines; nothing else may use it.
  const withoutServices = body.split('\n').filter((line) => !line.includes('/services/')).join('\n')
  assert.doesNotMatch(withoutServices, /Telegram bots?\b/i)
  assert.doesNotMatch(withoutServices, /Telegram-бот/i)
  for (const re of [...shapeTells, ...stock]) assert.doesNotMatch(body, re)
  for (const line of body.split('\n')) assert.ok(line.length < 400, `llms line too long: ${line.slice(0, 80)}`)
})
