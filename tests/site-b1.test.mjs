import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import ru from '../src/content/ru.ts'
import en from '../src/content/en.ts'
import { notFoundLinks, notFoundText, searchPages } from '../src/content/not-found.ts'
import { productCatalog } from '../src/content/builder-catalog.ts'
import { decodeBuild, productParts, quote } from '../src/lib/builder.ts'
import { footerColumns, homeAnchors, homeSections, localePages, sectionAnchor } from '../src/lib/home.ts'
import { agentPlans, companyPlan, contentPlans, personalPlans } from '../src/lib/pricing.ts'
import { builderProduct, productBuild, productBuilderHref, productIds, productPrice } from '../src/lib/products.ts'
import { serviceSlugs } from '../src/lib/site.ts'
import { isSolutionKind } from '../src/lib/solutions.ts'
import { isAgentId, isAiTeamId } from '../src/lib/ai-teams.ts'

const dicts = { ru, en }

test('products: the two flagships first, then the products from COMPANY.md, texts in both languages', () => {
  assert.deepEqual(productIds, ['personal', 'company', 'admin', 'receptionist', 'automation', 'content', 'miniapp'])
  for (const dict of [ru, en]) {
    for (const id of productIds) {
      const item = dict.products.items[id]
      assert.ok(item.name && item.benefit && item.forWhom, id)
      assert.equal(item.inside.length, 3, id)
      assert.ok(dict.products.demo[id], id)
    }
    assert.deepEqual(Object.keys(dict.products.items), [...productIds])
  }
})

test('product prices come only from pricing.ts (as the builder counts them), or «по смете»', () => {
  for (const id of productIds) {
    const price = productPrice[id]
    const entry = productCatalog[builderProduct[id]]
    if (price.kind === 'from') {
      assert.ok(entry.priced, id)
      assert.equal(price.from, quote({ parts: productParts(builderProduct[id]), extras: [] }).total, id)
    } else if (price.kind === 'plans') {
      assert.deepEqual(price.plans, id === 'personal' ? personalPlans : id === 'company' ? [companyPlan] : contentPlans, id)
      assert.equal(price.byQuote === true, id === 'company', `${id} byQuote`)
      assert.equal(entry.priced, false, id)
    } else assert.equal(entry.priced, false, id)
  }
  assert.deepEqual(
    agentPlans.map((p) => [p.id, p.setup, p.monthly]),
    [['dono', 150, 15], ['polly', 100, 10]],
  )
  assert.deepEqual(
    contentPlans.map((p) => [p.id, p.setup, p.monthly]),
    [['content', 90, 60]],
  )
  assert.equal(productPrice.content.kind, 'plans')
  assert.equal(productPrice.personal.kind, 'plans')
  assert.equal(productPrice.company.kind, 'plans')
  // Owner 2026-11-22: Personal AI from $290 + $29 a month in three levels, the AI company from $1,490 + $149.
  assert.deepEqual(personalPlans[0], { id: 'basic', setup: 290, monthly: 29, byokMonthly: 14 })
  assert.deepEqual(personalPlans.map((p) => p.id), ['basic', 'plus', 'max'])
  for (let i = 1; i < personalPlans.length; i++) assert.ok(personalPlans[i].setup > personalPlans[i - 1].setup && personalPlans[i].monthly > personalPlans[i - 1].monthly)
  assert.deepEqual(companyPlan, { id: 'company', setup: 1490, monthly: 149, byokMonthly: 104 })
  assert.equal(productPrice.implementation, undefined)
  // Every plan id has a label in both dictionaries.
  for (const dict of [ru, en])
    for (const p of [...personalPlans, companyPlan, ...agentPlans, ...contentPlans]) assert.ok(dict.products.plans[p.id], p.id)
  // Copy never carries a price or a long dash.
  for (const dict of [ru, en]) {
    const text = JSON.stringify([dict.products, dict.work, dict.pricingHome, dict.faqContact, dict.hero.sequence, dict.footer])
    assert.doesNotMatch(text, /\$\s?\d/)
    assert.doesNotMatch(text, /[–—]/)
  }
})

test('«Собрать проект» opens the builder with the product picked', () => {
  for (const id of productIds) {
    const b = new URL(productBuilderHref('ru', id), 'https://x').searchParams.get('b')
    assert.match(b, new RegExp(`(^|~)p\\.${builderProduct[id]}($|~)`), id)
    const decoded = decodeBuild(b)
    assert.deepEqual(decoded?.products, [builderProduct[id]], id)
    assert.deepEqual(decoded?.parts, productBuild(id).parts, id)
  }
})

test('home page: the film sections in order, page.tsx renders homeSections', () => {
  assert.deepEqual(homeSections, ['hero', 'pains', 'demo', 'products', 'agents', 'office', 'solutions', 'process', 'pricing', 'faq', 'footer'])
  for (const id of ['top', 'pains', 'office', 'products', 'demo', 'solutions', 'process', 'pricing', 'faq', 'services'])
    assert.ok(homeAnchors.includes(id), id)
  assert.equal(homeAnchors.includes('contact'), false)
  assert.equal(sectionAnchor.faq, 'faq')
  const page = readFileSync(new URL('../src/app/[locale]/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /homeSections\.map/)
  for (const id of homeSections) assert.match(page, new RegExp(`\\b${id}:`), id)
})

// A link resolves when it is the home page, a home anchor, a service, a solution or a locale page.
function resolves(href, locale) {
  const [path, hash] = href.split('#')
  if (path === `/${locale}`) return !hash || homeAnchors.includes(hash)
  const rest = path.replace(`/${locale}/`, '').split('/')
  if (rest[0] === 'services') return serviceSlugs.includes(rest[1]) && rest.length === 2
  if (rest[0] === 'products') return rest.length === 2 && productIds.includes(rest[1])
  if (rest[0] === 'solutions') return rest.length === 1 || (rest.length === 2 && isSolutionKind(rest[1]))
  if (rest[0] === 'ai-team') {
    if (rest.length === 2) return isAiTeamId(rest[1])
    if (rest.length === 3) return rest[1] === 'agent' && isAgentId(rest[2])
  }
  if (!localePages.includes(rest[0]) || rest.length !== 1) return false
  return existsSync(new URL(`../src/app/[locale]/${rest[0]}/page.tsx`, import.meta.url))
}

test('footer: products lead, every link points to an existing route, labels exist', () => {
  for (const locale of ['ru', 'en']) {
    const cols = footerColumns(locale)
    assert.equal(cols[0].id, 'products')
    assert.equal(cols[0].links.length, 8) // seven products + the AI-team page (2026-11-21)
    assert.deepEqual(cols[0].links.slice(0, 2).map((l) => l.id), ['personal', 'company']) // flagships first
    for (const col of cols)
      for (const link of col.links) {
        assert.ok(resolves(link.href, locale), link.href)
        if (link.kind === 'page') assert.ok(dicts[locale].footer.pages[link.id], link.id)
      }
  }
})

test('404: links resolve, search finds pages, texts in both languages', () => {
  for (const locale of ['ru', 'en']) {
    const t = notFoundText[locale]
    for (const link of notFoundLinks(locale)) {
      assert.ok(resolves(link.href, locale), link.href)
      assert.ok(t.links[link.id], link.id)
    }
    for (const page of t.pages) assert.ok(resolves(`/${locale}${page.path}`, locale), page.path)
    assert.equal(searchPages(t.pages, '').length, 0)
  }
  assert.ok(searchPages(notFoundText.ru.pages, 'Запись').some((p) => p.path === '/products/admin'))
  assert.ok(searchPages(notFoundText.en.pages, 'mini app').some((p) => p.path === '/products/miniapp'))
  assert.equal(notFoundText.ru.pages.length, notFoundText.en.pages.length)
  // The 404 pages exist and use the shared view.
  for (const [file, view] of [
    ['../src/app/[locale]/not-found.tsx', /<LocaleNotFound/],
    ['../src/components/not-found/locale-not-found.tsx', /<NotFoundView/],
    ['../src/app/global-not-found.tsx', /<NotFoundView/],
  ])
    assert.match(readFileSync(new URL(file, import.meta.url), 'utf8'), view)
})
