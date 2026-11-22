import assert from 'node:assert/strict'
import { test } from 'node:test'
import en from '../src/content/en.ts'
import ru from '../src/content/ru.ts'
import { decodeBuild, encodeBuild, quote } from '../src/lib/builder.ts'
import { estimateDoc, formatDocDate, leadSummary, scopeLine } from '../src/lib/estimate-doc.ts'
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
  assert.equal(doc.total, `$${q.total.toLocaleString('en-US')}`)
  assert.equal(doc.subtotal, `$${q.subtotal.toLocaleString('en-US')}`)
  assert.equal(doc.discount, "-10%")
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

test('no ranges: every price in the doc is one exact amount', () => {
  const doc = estimateDoc(decodeBuild(code), ru, 'ru')
  for (const price of [...doc.parts, ...doc.extras].map((r) => r.price).concat(doc.subtotal, doc.total))
    assert.match(price, /^\$[\d,]+$/)
})

test('scope line: nothing, both, or one of domain and hosting', () => {
  const base = decodeBuild('apps.pwa')
  const withHas = (has) => ({ ...base, details: { has } })
  for (const [dict, d] of [[ru, 'ru'], [en, 'en']]) {
    const s = dict.builder.scope
    assert.equal(scopeLine(base, dict), s.none, d)
    assert.equal(scopeLine(withHas(['domain', 'hosting']), dict), s.both, d)
    assert.equal(scopeLine(withHas(['domain']), dict), s.domain, d)
    assert.equal(scopeLine(withHas(['hosting', 'logo']), dict), s.hosting, d)
    assert.equal(estimateDoc(base, dict, d).scope, s.none)
  }
  assert.match(ru.builder.scope.none, /Домен, хостинг, сервер и платные сторонние сервисы \(SMS, API, платежи\) в сумму не входят/)
  assert.match(leadSummary(base, ru, 'ru'), /в сумму не входят/)
})

test('estimate sheet: signed out gets the sign-in step with a return link, signed in and off open it', async () => {
  const { estimateAccess, estimateReturnPath } = await import('../src/lib/estimate-gate.ts')
  assert.equal(estimateAccess('loading'), 'wait')
  assert.equal(estimateAccess('out'), 'gate')
  assert.equal(estimateAccess('in'), 'open')
  assert.equal(estimateAccess('off'), 'open')
  const link = '/en/builder/estimate?b=websites.landing~bots.booking'
  assert.equal(estimateReturnPath('/en/builder/estimate', '?b=websites.landing~bots.booking'), link)
  const { readFileSync } = await import('node:fs')
  const sheet = readFileSync('src/components/estimate-sheet.tsx', 'utf8')
  assert.match(sheet, /estimateAccess\(me\.status\)/)
  assert.match(sheet, /<LeadAuthStep[^>]*returnPath=\{returnPath\}/)
  for (const d of [ru, en]) assert.ok(d.builder.estimate.gateTitle && d.builder.estimate.gateText)
})
