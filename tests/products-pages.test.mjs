// Product pages /[locale]/products/[id] and the ladder (owner 2026-11-22): copy, live price and
// stages, routes, sitemap, 404 list, llms.txt, the «Подробнее» button.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
const { notFoundText } = await import('../src/content/not-found.ts')
const { productIds, productPath, productPrices } = await import('../src/lib/products.ts')
const { productPayment, ladderOfProduct } = await import('../src/lib/product-page.ts')
const { defaultPricing } = await import('../src/lib/pricing.ts')
const { ladderIds, ladderLevels, ladders, rungPath } = await import('../src/lib/ladder.ts')
const { isAgentId, isAiTeamId, agentPaths, aiTeamPaths } = await import('../src/lib/ai-teams.ts')
const sitemap = (await import('../src/app/sitemap.ts')).default

const dicts = [['ru', ru], ['en', en]]
const mocks = ['chat', 'slots', 'checks', 'bars', 'cards']

function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k)
}
function shape(value) {
  if (Array.isArray(value)) return value.map(shape)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
  return typeof value
}

test('product pages: full copy for the seven products in both languages, same shape', () => {
  assert.deepEqual(shape(ru.productPage), shape(en.productPage))
  for (const [locale, dict] of dicts) {
    assert.deepEqual(Object.keys(dict.productPage.items), [...productIds], locale)
    for (const id of productIds) {
      const p = dict.productPage.items[id]
      assert.ok(p.lead.length > 20, `${locale} ${id} lead`)
      assert.ok(p.capabilities.length >= 4 && p.capabilities.length <= 6, `${locale} ${id} capabilities`)
      for (const c of p.capabilities) {
        assert.ok(c.title && c.text && c.example, `${locale} ${id} capability`)
        assert.ok(mocks.includes(c.mock), `${locale} ${id} mock ${c.mock}`)
        assert.ok(c.chips.length >= 2, `${locale} ${id} chips`)
      }
      for (const key of ['day', 'week', 'month']) assert.ok(p.first[key].length > 20, `${locale} ${id} ${key}`)
      assert.ok(p.needs.length >= 3 && p.not.length >= 3, `${locale} ${id} needs/not`)
      // FAQ lives only on the home page (owner 2026-11-22): no per-product FAQ any more.
      assert.equal(p.faq, undefined, `${locale} ${id} faq`)
      assert.ok(p.metaDescription.length >= 120 && p.metaDescription.length <= 160, `${locale} ${id} meta ${p.metaDescription.length}`)
      assert.ok(p.metaTitle.length <= 70, `${locale} ${id} title ${p.metaTitle.length}`)
    }
  }
})

test('product pages: copy has no typed prices, long dashes, exclamation marks or AI tells', () => {
  const tells = [
    /\bэто не [^.!?]{1,60}, а\b/i,
    /\bне просто [^.!?]{1,60}, а\b/i,
    /\bit'?s not [^.!?]{1,60}, it'?s\b/i,
    /\bnot (just|only|merely) [^.!?]{1,60}, (but|it)\b/i,
    /\bбез [^,.!?]{1,30}, без [^,.!?]{1,30}, (и )?без\b/i,
    /\bno [^,.!?]{1,30}, no [^,.!?]{1,30}, (and )?no\b/i,
    /, (позволяя|делая|помогая|обеспечивая|allowing|making|helping|ensuring)\b/i,
  ]
  for (const [locale, dict] of dicts)
    for (const [at, text] of strings([dict.productPage, dict.ladder, dict.demoSection, dict.solutionsHome, dict.askStrip, dict.how])) {
      assert.doesNotMatch(text, /[$€₽]\s?\d|\d\s?(USD|usd|долл)/, `${locale} ${at}`)
      assert.doesNotMatch(text, /[–—]/, `${locale} ${at}`)
      assert.doesNotMatch(text, /!/, `${locale} ${at}`)
      for (const re of tells) assert.doesNotMatch(text, re, `${locale} ${at}`)
    }
})

test('product pages: price comes from the live pricing, stages from the template, subscriptions and quotes say so', () => {
  const prices = productPrices(defaultPricing)
  for (const id of productIds) {
    const pay = productPayment(id, defaultPricing)
    const price = prices[id]
    if (price.kind === 'from') {
      assert.equal(pay.kind, 'stages', id)
      assert.equal(pay.total, price.from, id)
      assert.equal(pay.stages.reduce((sum, s) => sum + s.amountUsd, 0), price.from, `${id} stages add up`)
      assert.equal(pay.stages.reduce((sum, s) => sum + s.share, 0), 100, `${id} shares`)
    } else if (price.kind === 'plans') assert.equal(pay.kind, 'subscription', id)
    else assert.equal(pay.kind, 'quote', id)
  }
  assert.equal(productPayment('content').kind, 'subscription')
  assert.equal(productPayment('agent').kind, 'subscription')
  // A higher price in the live set changes the table (no typed numbers anywhere).
  const live = structuredClone(defaultPricing)
  live.catalog.bots.variants.faq = 400
  const before = productPayment('receptionist', defaultPricing)
  const after = productPayment('receptionist', live)
  assert.ok(after.total > before.total)
})

test('product pages: route, static params, price tag, stage table, preselected builder, chat, no FAQ', () => {
  const page = readFileSync('src/app/[locale]/products/[id]/page.tsx', 'utf8')
  assert.match(page, /generateStaticParams/)
  assert.match(page, /dynamicParams = false/)
  for (const part of ['ProductPriceTag', 'StageTable', 'productBuilderHref', 'ChatOpenButton', 'productPayment', 'CapabilityMock'])
    assert.match(page, new RegExp(part), part)
  assert.doesNotMatch(page, /<Faq|faqJsonLd/)
  assert.doesNotMatch(page, /formatUsd|from '@\/lib\/pricing'|\$\d|ContactSection|#contact/)
  assert.match(readFileSync('src/components/stage-table.tsx', 'utf8'), /stage\.share|stage\.amountUsd/)
})

test('product pages: the bento card has «Подробнее» to the page and the hero caption links there', () => {
  const bento = readFileSync('src/components/products/products-bento.tsx', 'utf8')
  assert.match(bento, /productPath\(id\)/)
  assert.match(bento, /t\.more/)
  assert.match(readFileSync('src/components/hero/hero-sequence.tsx', 'utf8'), /products\/\$\{product\.id\}/)
  for (const [, dict] of dicts) assert.ok(dict.products.more)
})

test('product pages: in the sitemap with alternates, the 404 list and llms.txt with the new names', async () => {
  const entries = await sitemap()
  const urls = entries.map((e) => e.url)
  for (const locale of ['ru', 'en'])
    for (const id of productIds) assert.ok(urls.some((u) => u.endsWith(`/${locale}${productPath(id)}`)), `${locale} ${id}`)
  const one = entries.find((e) => e.url.endsWith('/ru/products/admin'))
  assert.deepEqual(Object.keys(one.alternates.languages).sort(), ['en', 'ru'])
  for (const locale of ['ru', 'en']) {
    const paths = notFoundText[locale].pages.map((p) => p.path)
    for (const id of productIds) assert.ok(paths.includes(productPath(id)), `404 ${locale} ${id}`)
  }
  const { GET } = await import('../src/app/llms.txt/route.ts')
  const llms = await (await GET()).text()
  for (const id of productIds) {
    assert.ok(llms.includes(`/ru${productPath(id)}`) && llms.includes(`/en${productPath(id)}`), `llms ${id}`)
    assert.ok(llms.includes(ru.products.items[id].name) && llms.includes(en.products.items[id].name), `llms name ${id}`)
  }
})

test('ladder: three rungs per direction, each links to a real page, copy in both languages', () => {
  assert.deepEqual([...ladderIds], ['content', 'sales', 'support'])
  assert.deepEqual([...ladderLevels], ['agent', 'auto', 'dept'])
  for (const id of ladderIds)
    for (const level of ladderLevels) {
      const target = ladders[id][level]
      if (target.kind === 'product') assert.ok(productIds.includes(target.id), `${id} ${level}`)
      if (target.kind === 'agent') assert.ok(isAgentId(target.id), `${id} ${level}`)
      if (target.kind === 'dept') assert.ok(isAiTeamId(target.id), `${id} ${level}`)
      const known = [...productIds.map(productPath), ...agentPaths, ...aiTeamPaths]
      assert.ok(known.includes(rungPath(target)), rungPath(target))
    }
  assert.equal(ladders.content.dept.id, 'marketing')
  assert.equal(ladders.sales.agent.id, 'receptionist')
  assert.deepEqual(ladderOfProduct('content'), { track: 'content', level: 'auto' })
  assert.equal(ladderOfProduct('miniapp'), null)
  assert.deepEqual(shape(ru.ladder), shape(en.ladder))
  for (const [, dict] of dicts) {
    assert.deepEqual(Object.values(dict.ladder.levels).length, 3)
    for (const id of ladderIds) {
      const track = dict.ladder.tracks[id]
      for (const level of ladderLevels) assert.ok(track.rungs[level].title && track.rungs[level].text)
      // Two sentences say what changes between the rungs.
      assert.equal(track.change.split(/(?<=[.])\s/).length, 2, id)
    }
  }
  assert.equal(ru.ladder.levels.agent, 'Один агент')
  assert.equal(ru.ladder.levels.auto, 'На автопилоте')
  assert.equal(ru.ladder.levels.dept, 'Целый отдел')
})

test('ladder: on the products section and on /ai-team, the products section ends with the departments strip', () => {
  assert.match(readFileSync('src/components/products/products-bento.tsx', 'utf8'), /<Ladder /)
  assert.match(readFileSync('src/app/[locale]/ai-team/page.tsx', 'utf8'), /<Ladder /)
  const bento = readFileSync('src/components/products/products-bento.tsx', 'utf8')
  assert.ok(bento.indexOf('data-departments-strip') > bento.indexOf('<Ladder '))
  assert.match(bento, /ai-team#agents/)
})
