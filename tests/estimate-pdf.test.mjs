import assert from 'node:assert/strict'
import { test } from 'node:test'
import en from '../src/content/en.ts'
import ru from '../src/content/ru.ts'
import { decodeBuild, encodeBuild, quote } from '../src/lib/builder.ts'
import { estimateDoc, formatDocDate, formatRange } from '../src/lib/estimate-doc.ts'
import { siteUrl } from '../src/lib/site.ts'

const code = 'websites.landing.telegram~bots.booking.payments~automation.crm~x.seo-support'

test('estimateDoc: rows, totals and link match the builder quote', () => {
  const build = decodeBuild(code)
  const q = quote(build)
  const doc = estimateDoc(build, ru, 'ru')
  assert.deepEqual(
    doc.parts.map((r) => r.id),
    ['websites', 'bots', 'automation'],
  )
  assert.equal(doc.parts[0].name, ru.services.items.websites.name)
  assert.equal(doc.parts[0].detail, 'Лендинг + Заявки в Telegram')
  assert.equal(doc.parts[0].term, ru.estimator.catalog.websites.variants.landing.term)
  assert.deepEqual(
    doc.extras.map((r) => r.id),
    ['seo'],
  )
  assert.equal(doc.total, formatRange(q.total))
  assert.equal(doc.subtotal, formatRange(q.subtotal))
  assert.equal(doc.discount, `-${formatRange(q.discount)}`)
  assert.equal(doc.monthly, `$${q.monthly}${ru.builder.perMonth}`)
  assert.equal(doc.link, `${siteUrl}/ru/builder?b=${encodeBuild(build)}`)
})

test('estimateDoc: one part has no discount and no monthly line, English labels', () => {
  const doc = estimateDoc(decodeBuild('apps.pwa'), en, 'en')
  assert.equal(doc.discount, null)
  assert.equal(doc.monthly, null)
  assert.equal(doc.extras.length, 0)
  assert.equal(doc.parts[0].name, en.services.items.apps.name)
  assert.equal(doc.subtotal, doc.total)
  assert.equal(doc.link, `${siteUrl}/en/builder?b=apps.pwa`)
})

test('formatDocDate: localized long date', () => {
  const date = new Date(2026, 9, 16)
  assert.match(formatDocDate(date, 'ru'), /16 октября 2026/)
  assert.equal(formatDocDate(date, 'en'), '16 October 2026')
})
