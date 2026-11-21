import assert from 'node:assert/strict'
import { test } from 'node:test'
import en from '../src/content/en.ts'
import ru from '../src/content/ru.ts'
import { businessKinds, decodeBuild, presets, quote } from '../src/lib/builder.ts'
import {
  allSolutionKinds,
  isSolutionKind,
  solutionBuilderHref,
  solutionKinds,
} from '../src/lib/solutions.ts'

const dashes = /[–—]/

test('solutions: one page per business kind except "other"', () => {
  assert.deepEqual(
    allSolutionKinds,
    businessKinds.filter((kind) => kind !== 'other'),
  )
  // The footer lists only the original five, all of them real pages.
  for (const kind of solutionKinds) assert.ok(isSolutionKind(kind), kind)
  assert.equal(isSolutionKind('other'), false)
  assert.equal(isSolutionKind('cafe'), true)
})

test('solutions: every kind has ru and en copy with matching problems and FAQ counts', () => {
  for (const kind of solutionKinds) {
    const r = ru.solutions.items[kind]
    const e = en.solutions.items[kind]
    assert.ok(r && e, `${kind}: copy in both languages`)
    for (const page of [r, e]) {
      for (const key of ['metaTitle', 'metaDescription', 'title', 'sub', 'card']) {
        assert.ok(page[key].trim(), `${kind}: ${key}`)
      }
      assert.ok(page.faq.length >= 4 && page.faq.length <= 5, `${kind}: 4-5 FAQs`)
      assert.ok(page.problems.length >= 3, `${kind}: problems`)
      assert.doesNotMatch(JSON.stringify(page), dashes, `${kind}: no em or en dashes`)
    }
    assert.equal(r.faq.length, e.faq.length, `${kind}: same FAQ count`)
    assert.equal(r.problems.length, e.problems.length, `${kind}: same problems count`)
  }
  assert.equal(Object.keys(ru.solutions.items).length, solutionKinds.length)
  assert.doesNotMatch(JSON.stringify(ru.solutions), dashes)
  assert.doesNotMatch(JSON.stringify(en.solutions), dashes)
})

test('solutions: the builder link decodes back to the preset', () => {
  for (const kind of allSolutionKinds) {
    for (const locale of ['ru', 'en']) {
      const href = solutionBuilderHref(locale, kind)
      const url = new URL(href, 'https://firtech.pro')
      assert.equal(url.pathname, `/${locale}/builder`)
      assert.deepEqual(decodeBuild(url.searchParams.get('b')), presets[kind], kind)
    }
  }
})

test('solutions: every preset has a priced starting set', () => {
  for (const kind of allSolutionKinds) {
    const q = quote(presets[kind])
    assert.ok(q.lines.length > 0 && q.total > 0, kind)
  }
})

// Owner review 2026-11-22: the niche page headline is one promise of the result, not a description.
test('solutions: every niche page has a promise headline in both languages, apart from the descriptive title', async () => {
  const { solutionPromises } = await import('../src/content/solution-promises.ts')
  const { allSolutionKinds, solutionCopy } = await import('../src/lib/solutions.ts')
  assert.deepEqual(Object.keys(solutionPromises).sort(), [...allSolutionKinds].sort())
  for (const [locale, dict] of [['ru', ru], ['en', en]])
    for (const kind of allSolutionKinds) {
      const page = solutionCopy(kind, locale, dict)
      assert.equal(page.promise, solutionPromises[kind][locale], `${locale} ${kind}`)
      assert.notEqual(page.promise, page.title, `${locale} ${kind}`)
      assert.ok(page.promise.length <= 90, `${locale} ${kind} promise too long`)
      assert.doesNotMatch(page.promise, /[–—!$]|\d/, `${locale} ${kind}`)
    }
  const { readFileSync } = await import('node:fs')
  assert.match(readFileSync('src/app/[locale]/solutions/[kind]/page.tsx', 'utf8'), /\{page\.promise\}/)
})
