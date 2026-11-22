// Cabinet offers (2026-11-21): picked from the visitor's state, honest, prices only through pricing.ts.
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

const offers = await import('../src/lib/cabinet-offers.ts')
const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const read = (f) => readFileSync(path.resolve(f), 'utf8')
const ids = (list) => list.map((o) => o.id)

test('no leads and no projects: three products and the free audit', () => {
  const plan = offers.pickOffers({ leadCount: 0, projectCount: 0, projectInWork: false }, 'ru')
  assert.equal(plan.stage, 'start')
  assert.equal(plan.cards.filter((o) => o.kind === 'product').length, 3)
  assert.ok(plan.cards.some((o) => o.kind === 'audit' && o.href === '/ru/audit'))
  for (const o of plan.cards.filter((c) => c.kind === 'product')) {
    assert.match(o.href, /^\/ru\/builder\?b=/)
    assert.match(o.href, /p\./)
  }
  assert.equal(plan.strip.length, 2)
})

test('a request but no project yet: audit and subscriptions, not the start block', () => {
  const plan = offers.pickOffers({ leadCount: 1, projectCount: 0, projectInWork: false }, 'en')
  assert.equal(plan.stage, 'waiting')
  assert.ok(ids(plan.cards).includes('audit'))
  assert.ok(plan.cards.every((o) => o.href.startsWith('/en/')))
})

test('a project in work: content subscription, the AI company, automation, second part without a discount promise', () => {
  const plan = offers.pickOffers({ leadCount: 1, projectCount: 1, projectInWork: true }, 'ru')
  assert.equal(plan.stage, 'grow')
  assert.deepEqual(ids(plan.cards), ['product-content', 'product-company', 'product-automation', 'second'])
  assert.equal(plan.cards.at(-1).href, '/ru/builder')
  // bundleDiscount is the discount of one estimate (two parts); the second-part copy never promises it.
  for (const dict of [ru, en]) {
    const text = JSON.stringify(dict.cabinet.offers.second)
    assert.doesNotMatch(text, /скидк|discount|%/i)
  }
  const done = offers.pickOffers({ leadCount: 1, projectCount: 1, projectInWork: false }, 'ru')
  assert.equal(ids(done.cards).includes('second'), false)
})

test('state from data', () => {
  assert.deepEqual(offers.offerState({ leads: null, projects: [] }), { leadCount: 0, projectCount: 0, projectInWork: false })
  assert.deepEqual(offers.offerState({ leads: [{}], projects: [{ status: 'done' }, { status: 'active' }] }), {
    leadCount: 1,
    projectCount: 2,
    projectInWork: true,
  })
  assert.equal(offers.offerState({ leads: [], projects: [{ status: 'done' }] }).projectInWork, false)
})

test('copy: same shape in both languages, percent only as the token, no long dashes or dollars', () => {
  const shape = (v) => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v)
  assert.deepEqual(shape(en.cabinet.offers), shape(ru.cabinet.offers))
  assert.deepEqual(shape(en.cabinet.tabs), shape(ru.cabinet.tabs))
  for (const dict of [ru, en]) {
    const text = JSON.stringify([dict.cabinet.offers, dict.cabinet.tabs])
    assert.doesNotMatch(text, /[–—]/)
    assert.doesNotMatch(text, /\$\d|\d\s?%|\d\s?USD/)
    // v3: our own status and the overview blocks are gone from the cabinet copy.
    assert.equal('status' in dict.cabinet.offers, false)
  }
  assert.equal(ru.cabinet.offers.label, 'Предложение')
  assert.equal(en.cabinet.offers.label, 'Offer')
})

test('call sites: clicks are tracked, the strip is compact and the cabinet has no office status block', () => {
  const link = read('src/components/cabinet/offer-link.tsx')
  assert.match(link, /trackEvent\('cabinet_offer_click'\)/)
  assert.match(link, /track\('cabinet_offer'/)
  const view = read('src/components/cabinet/offers.tsx')
  assert.match(view, /ProductPriceTag/)
  assert.match(view, /data-offers-strip/)
  assert.match(view, /rounded-xl border border-line bg-surface p-4/)
  assert.doesNotMatch(view, /\/status|Overview/)
  const page = read('src/app/[locale]/cabinet/page.tsx')
  assert.match(page, /<OffersStrip/)
  assert.doesNotMatch(page, /allArticles|\/status/)
  assert.match(read('src/lib/analytics.ts'), /cabinet_offer: \[params: \{ offer: string \}\]/)
})
