import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  articleText,
  articles,
  getArticle,
  readingTime,
  visibleArticles,
  wordCount,
} from '../src/content/blog/index.ts'
import { fillArticlePrices } from '../src/content/blog/prices.ts'
import { bundleDiscount, catalog, defaultPricing, extraPrice, formatUsd } from '../src/lib/pricing.ts'

test('blog: slugs are unique and URL-safe, dates are ISO', () => {
  const slugs = articles.map((a) => a.slug)
  assert.equal(new Set(slugs).size, slugs.length)
  for (const a of articles) {
    assert.match(a.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/)
    assert.match(a.date, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(!Number.isNaN(Date.parse(a.date)))
  }
})

test('blog: drafts are hidden unless drafts are shown', () => {
  const drafts = articles.filter((a) => !a.published)
  assert.equal(visibleArticles(true).length, articles.length)
  assert.equal(visibleArticles(false).length, articles.length - drafts.length)
  for (const a of drafts) {
    assert.equal(getArticle(a.slug, false), undefined)
    assert.equal(getArticle(a.slug, true), a)
  }
  assert.equal(getArticle('nope', true), undefined)
})

test('blog: every article has both languages, a real length and a reading time', () => {
  for (const a of articles) {
    for (const locale of ['ru', 'en']) {
      const c = a[locale]
      assert.ok(c.title && c.description, `${a.slug} ${locale} title/description`)
      assert.ok(c.blocks.some((b) => b.type === 'h2'), `${a.slug} ${locale} has headings`)
      assert.ok(c.blocks.some((b) => b.type === 'cta'), `${a.slug} ${locale} links the builder`)
      const words = wordCount(c)
      assert.ok(words >= 600 && words <= 1300, `${a.slug} ${locale}: ${words} words`)
      assert.ok(readingTime(c) >= 3)
    }
  }
  assert.equal(readingTime({ title: 'a', description: '', blocks: [] }), 1)
})

test('blog copy: no em or en dashes, prices only from pricing.ts', () => {
  const known = new Set(
    [
      ...Object.values(catalog).flatMap((c) => [
        ...Object.values(c.variants),
        ...Object.values(c.addons),
      ]),
      ...Object.values(extraPrice).map((e) => e.from ?? 0),
    ].map(formatUsd),
  )
  // Sums the articles quote as examples: landing + language + telegram, FAQ bot + AI.
  const w = catalog.websites
  const b = catalog.bots
  known.add(formatUsd(w.variants.landing + w.addons.language + w.addons.telegram))
  known.add(formatUsd(b.variants.faq + b.addons.ai))

  for (const a of articles.map((x) => fillArticlePrices(x, defaultPricing))) {
    for (const locale of ['ru', 'en']) {
      const text = articleText(a[locale])
      assert.doesNotMatch(text, /\{price:/, `${a.slug} ${locale} has an unfilled price token`)
      assert.doesNotMatch(text, /[\u2013\u2014]/, `${a.slug} ${locale} has a long dash`)
      for (const amount of text.match(/\$\d+(?:,\d{3})*/g) ?? []) {
        assert.ok(known.has(amount), `${a.slug} ${locale}: ${amount} is not in pricing.ts`)
      }
      for (const percent of text.match(/\d+%/g) ?? []) {
        assert.equal(percent, `${Math.round(bundleDiscount * 100)}%`)
      }
    }
  }
})

test('blog: articles carry price tokens, the live pricing fills them', () => {
  for (const a of articles)
    for (const locale of ['ru', 'en'])
      assert.doesNotMatch(articleText(a[locale]), /\$\d/, `${a.slug} ${locale} types a price`)
  const cost = articles.find((a) => a.slug === 'website-cost-2026')
  const pricing = structuredClone(defaultPricing)
  pricing.catalog.websites.variants.landing = 199
  pricing.bundleDiscount = 15
  const text = articleText(fillArticlePrices(cost, pricing).en)
  assert.match(text, /\$199/)
  assert.match(text, /15%/)
  assert.doesNotMatch(text, /\$150\b/)
})
