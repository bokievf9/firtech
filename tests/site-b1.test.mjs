import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import ru from '../src/content/ru.ts'
import en from '../src/content/en.ts'
import { notFoundText, searchPages } from '../src/content/not-found.ts'
import { decodeBuild } from '../src/lib/builder.ts'
import { footerColumns, homeAnchors, homeSections, localePages, notFoundLinks, sectionAnchor } from '../src/lib/home.ts'
import { agentPlans, catalog, estimate, extraPrice, startingPrice } from '../src/lib/pricing.ts'
import { productBuild, productBuilderHref, productIds, productPrice } from '../src/lib/products.ts'
import { serviceSlugs } from '../src/lib/site.ts'
import { solutionKinds } from '../src/lib/solutions.ts'

const dicts = { ru, en }

test('products: the seven from COMPANY.md, flagship first, texts in both languages', () => {
  assert.deepEqual(productIds, ['admin', 'receptionist', 'automation', 'content', 'miniapp', 'agent', 'implementation'])
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

test('product prices come only from pricing.ts, or the card says «по смете»', () => {
  const allowed = new Set([
    ...Object.values(startingPrice),
    ...Object.values(catalog).flatMap((c) => [...Object.values(c.variants), ...Object.values(c.addons)]),
    ...Object.values(extraPrice).map((e) => e.from),
    estimate('bots', 'booking', []).min,
  ])
  for (const id of productIds) {
    const price = productPrice[id]
    if (price.kind === 'from') assert.ok(allowed.has(price.from), `${id}: ${price.from}`)
    if (price.kind === 'plans') assert.equal(price.plans, agentPlans)
  }
  assert.deepEqual(
    agentPlans.map((p) => [p.id, p.setup, p.monthly]),
    [['dono', 150, 15], ['polly', 100, 10]],
  )
  assert.equal(productPrice.content.kind, 'quote')
  assert.equal(productPrice.implementation.kind, 'quote')
  // Copy never carries a price or a long dash.
  for (const dict of [ru, en]) {
    const text = JSON.stringify([dict.products, dict.proof, dict.work, dict.pricingHome, dict.faqContact, dict.hero.sequence, dict.footer])
    assert.doesNotMatch(text, /\$\s?\d/)
    assert.doesNotMatch(text, /[–—]/)
  }
})

test('product builder links decode to the product preset', () => {
  for (const id of productIds) {
    const href = productBuilderHref('ru', id)
    const build = productBuild[id]
    if (!build) {
      assert.equal(href, '/ru/builder')
      continue
    }
    const b = new URL(href, 'https://x').searchParams.get('b')
    assert.deepEqual(decodeBuild(b)?.parts, build.parts, id)
  }
})

test('home page: eight sections in order, page.tsx renders homeSections', () => {
  assert.deepEqual(homeSections, ['hero', 'products', 'demo', 'proof', 'process', 'pricing', 'faqContact', 'footer'])
  for (const id of ['top', 'products', 'demo', 'proof', 'process', 'pricing', 'contact', 'faq', 'services'])
    assert.ok(homeAnchors.includes(id), id)
  assert.equal(sectionAnchor.faqContact, 'contact')
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
  if (rest[0] === 'solutions') return rest.length === 1 || solutionKinds.includes(rest[1])
  if (!localePages.includes(rest[0]) || rest.length !== 1) return false
  return existsSync(new URL(`../src/app/[locale]/${rest[0]}/page.tsx`, import.meta.url))
}

test('footer: products lead, every link points to an existing route, labels exist', () => {
  for (const locale of ['ru', 'en']) {
    const cols = footerColumns(locale)
    assert.equal(cols[0].id, 'products')
    assert.equal(cols[0].links.length, 7)
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
  assert.ok(searchPages(notFoundText.ru.pages, 'Запись').some((p) => p.path === '#product-admin'))
  assert.ok(searchPages(notFoundText.en.pages, 'mini app').some((p) => p.path === '#product-miniapp'))
  assert.equal(notFoundText.ru.pages.length, notFoundText.en.pages.length)
  // The 404 pages exist and use the shared view.
  for (const file of ['../src/app/[locale]/not-found.tsx', '../src/app/global-not-found.tsx'])
    assert.match(readFileSync(new URL(file, import.meta.url), 'utf8'), /<NotFoundView/)
})
