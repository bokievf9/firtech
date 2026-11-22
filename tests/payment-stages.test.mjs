// Payment by stages (owner decision 2026-11-21): templates, small projects, rounding, mixed bundles.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { productCatalog } from '../src/content/builder-catalog.ts'
import { productParts, quote } from '../src/lib/builder.ts'
import {
  fillStageTokens,
  stageTemplateForProduct,
  stageTemplateId,
  stageTrackLabel,
  stagesFor,
} from '../src/lib/payment-stages.ts'
import {
  estimate,
  paymentStages,
  smallProjectMaxUsd,
  stageTemplateIds,
} from '../src/lib/pricing.ts'

const sum = (stages) => stages.reduce((s, x) => s + x.amountUsd, 0)
const site = (variant, addons = []) => ({ websites: { variant, addons } })

test('templates: shares sum to 100, ids unique, both languages, small is 50/50', () => {
  assert.equal(smallProjectMaxUsd, 300)
  assert.deepEqual(Object.keys(paymentStages).sort(), [...stageTemplateIds].sort())
  for (const [id, stages] of Object.entries(paymentStages)) {
    assert.equal(stages.reduce((s, x) => s + x.share, 0), 100, id)
    assert.equal(new Set(stages.map((x) => x.id)).size, stages.length, id)
    assert.equal(stages.at(-1).id, 'launch', `${id}: the last stage is the launch`)
    for (const st of stages) assert.ok(st.title.ru && st.title.en, `${id}.${st.id}`)
  }
  assert.deepEqual(paymentStages.small.map((x) => x.share), [50, 50])
  assert.deepEqual(paymentStages.site.map((x) => x.share), [30, 40, 30])
  assert.deepEqual(paymentStages.bot.map((x) => x.share), [30, 40, 30])
  assert.deepEqual(paymentStages.automation.map((x) => x.share), [20, 50, 30])
  assert.deepEqual(paymentStages.app.map((x) => x.share), [25, 25, 25, 25])
})

test('small projects: under the limit two stages 50/50, the limit itself uses the template', () => {
  const small = stagesFor({ parts: { bots: { variant: 'faq', addons: [] } } }, 290)
  assert.deepEqual(small.map((s) => [s.id, s.share, s.amountUsd]), [['start', 50, 145], ['launch', 50, 145]])
  assert.equal(stagesFor({ parts: site('landing') }, 299).length, 2)
  assert.equal(stagesFor({ parts: site('landing') }, 300).length, 3)
  assert.equal(stageTemplateId(site('landing'), 150), 'small')
})

test('each template picks by its part and the sum equals the total', () => {
  const cases = [
    [{ websites: { variant: 'company', addons: [] } }, 'site'],
    [{ bots: { variant: 'booking', addons: ['admin'] } }, 'bot'],
    [{ bots: { variant: 'miniapp', addons: ['payments'] } }, 'app'],
    [{ apps: { variant: 'pwa', addons: [] } }, 'app'],
    [{ automation: { variant: 'crm', addons: [] } }, 'automation'],
  ]
  for (const [parts, id] of cases) {
    const total = quote({ parts, extras: [] }).total
    assert.ok(total >= smallProjectMaxUsd, id)
    const stages = stagesFor({ parts }, total)
    assert.deepEqual(stages.map((s) => s.id), paymentStages[id].map((s) => s.id), id)
    assert.equal(sum(stages), total, id)
  }
})

test('rounding: whole dollars, the last stage takes the remainder', () => {
  const stages = stagesFor('site', 333)
  assert.deepEqual(stages.map((s) => s.amountUsd), [100, 133, 100])
  assert.equal(sum(stages), 333)
  const app = stagesFor('app', 801)
  assert.deepEqual(app.map((s) => s.amountUsd), [200, 200, 200, 201])
  for (const total of [1, 7, 99, 301, 457, 1234, 9999]) {
    for (const id of stageTemplateIds) {
      const st = stagesFor(id, total)
      assert.equal(sum(st), total, `${id} ${total}`)
      assert.ok(st.every((s) => Number.isInteger(s.amountUsd) && s.amountUsd >= 0), `${id} ${total}`)
    }
  }
  assert.deepEqual(stagesFor('site', 0), [])
  assert.deepEqual(stagesFor('site', -5), [])
})

test('mixed bundles: the most expensive part sets the template, shares apply to the whole total', () => {
  const parts = { ...site('landing'), apps: { variant: 'mobile', addons: [] }, bots: { variant: 'faq', addons: [] } }
  assert.equal(stageTemplateId(parts, 2000), 'app')
  const q = quote({ parts, extras: [] })
  assert.ok(q.discount)
  const stages = stagesFor({ parts }, q.total)
  assert.deepEqual(stages.map((s) => s.share), [25, 25, 25, 25])
  assert.equal(sum(stages), q.total)
  // A site plus a cheaper bot: the site wins.
  const siteBot = { websites: { variant: 'shop', addons: [] }, bots: { variant: 'faq', addons: [] } }
  assert.equal(stageTemplateId(siteBot, quote({ parts: siteBot, extras: [] }).total), 'site')
  // Extras only: nothing to pick from, a total over the limit falls back to the site template.
  assert.equal(stageTemplateId({}, 500), 'site')
  assert.equal(estimate('websites', 'shop', []), 700)
})

test('products: template by the product parts, none for subscriptions', () => {
  const adminTotal = quote({ parts: productParts('adminbot'), extras: [] }).total
  assert.equal(stageTemplateForProduct('adminbot'), adminTotal < smallProjectMaxUsd ? 'small' : 'bot')
  assert.equal(stageTemplateForProduct('miniapp'), 'app')
  assert.equal(stageTemplateForProduct('aiteam'), 'automation')
  assert.equal(stageTemplateForProduct('app'), 'app')
  assert.equal(stageTemplateForProduct('content'), null)
  assert.equal(stageTemplateForProduct('agent'), null)
  // Home product ids resolve through the builder product.
  assert.equal(stageTemplateForProduct('company'), null) // the AI company has its own four-stage template
  assert.equal(stageTemplateForProduct('receptionist'), stageTemplateForProduct('intake'))
  for (const id of Object.keys(productCatalog)) {
    const t = stageTemplateForProduct(id)
    assert.ok(t === null || stageTemplateIds.includes(t), id)
  }
})

test('copy helpers: the small-project token and the cabinet track label', () => {
  assert.equal(fillStageTokens('Проекты дешевле {small}'), 'Проекты дешевле $300')
  assert.equal(stageTrackLabel('Этап {n}: оплата', 2), 'Этап 2: оплата')
})
