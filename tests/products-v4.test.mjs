// Products v4 (owner 2026-11-22 night): every AI product is a subscription (setup + monthly with the model usage
// included, a lower monthly with the client's own API key), teams are the sum of their agents minus a discount,
// `implementation` is gone, the channels are listed as equals.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import ru from '../src/content/ru.ts'
import en from '../src/content/en.ts'
import { agentOffers, agentPrice, teamPrice, aiTeamIds, aiTeamBuilderHref } from '../src/lib/ai-teams.ts'
import { decodeBuild } from '../src/lib/builder.ts'
import { channelIds, channels } from '../src/lib/channels.ts'
import {
  agentSubscriptionOf,
  companyMonthly,
  defaultPricing,
  personalPlanList,
  companyPlanOf,
  teamSubscription,
} from '../src/lib/pricing.ts'
import { applyOps, emptyPrices, editorView, priceFields, resolvePricing } from '../src/lib/pricing-edit.ts'
import { pricesJson } from '../src/lib/prices-json.ts'
import { productIds } from '../src/lib/product-ids.ts'

test('subscription defaults: personal tiers, one agent, company, BYOK always lower', () => {
  assert.deepEqual(personalPlanList().map((p) => [p.setup, p.monthly, p.byokMonthly]), [[290, 29, 14], [490, 59, 34], [790, 99, 59]])
  assert.deepEqual(agentSubscriptionOf(), { setup: 220, monthly: 39, byokMonthly: 19 })
  assert.deepEqual(companyPlanOf(), { id: 'company', setup: 1490, monthly: 149, byokMonthly: 104 })
  assert.equal(defaultPricing.teamDiscount, 15)
  assert.equal(defaultPricing.companyPerEmployee, 9)
  for (const p of [...personalPlanList(), companyPlanOf()]) assert.ok(p.byokMonthly < p.monthly, p.id)
})

test('team price = the sum of its agents minus the discount, live from the pricing', () => {
  const t = teamSubscription(3)
  assert.deepEqual(t.full, { setup: 660, monthly: 117, byokMonthly: 57 })
  assert.equal(t.setup, Math.round(660 * 0.85))
  assert.equal(t.monthly, Math.round(117 * 0.85))
  assert.equal(t.byokMonthly, Math.round(57 * 0.85))
  // an edited price flows through
  const edited = { ...defaultPricing, agentSubscription: { setup: 300, monthly: 50, byokMonthly: 25 }, teamDiscount: 0 }
  assert.deepEqual(teamSubscription(2, edited), { setup: 600, monthly: 100, byokMonthly: 50, count: 2, discountPercent: 0, full: { setup: 600, monthly: 100, byokMonthly: 50 } })
  // every team but the whole company has a price; the Director has none
  for (const id of aiTeamIds) assert.equal(teamPrice(id) === null, id === 'company', id)
  for (const a of agentOffers) assert.equal(agentPrice(a.id) === null, !a.standalone, a.id)
})

test('company monthly: five staff included, nine more per employee, BYOK about 30% lower', () => {
  assert.equal(companyMonthly(5, false), 149)
  assert.equal(companyMonthly(8, false), 149 + 3 * 9)
  assert.equal(companyMonthly(3, true), 104)
  assert.ok(companyMonthly(20, true) < companyMonthly(20, false))
})

test('prices are editable in the Пульт, validated and published at /api/prices', () => {
  const paths = priceFields.map((f) => f.path)
  for (const p of ['personalPlans.plus.byokMonthly', 'companyPlan.company.byokMonthly', 'agentSubscription.setup', 'agentSubscription.monthly', 'agentSubscription.byokMonthly', 'teamDiscount', 'companyPerEmployee'])
    assert.ok(paths.includes(p), p)
  const r = applyOps(emptyPrices(), [{ path: 'agentSubscription.monthly', value: 45 }, { path: 'teamDiscount', value: 20 }])
  assert.ok(r.ok)
  const merged = resolvePricing(r.state.overrides)
  assert.equal(merged.agentSubscription.monthly, 45)
  assert.equal(merged.teamDiscount, 20)
  assert.equal(applyOps(emptyPrices(), [{ path: 'teamDiscount', value: 99 }]).ok, false)
  assert.ok(editorView(r.state).fields.length > 0)
  const json = pricesJson(merged)
  assert.deepEqual(json.agentSubscription, { setup: 220, monthly: 45, byokMonthly: 19 })
  assert.equal(json.teamDiscountPercent, 20)
  assert.equal(json.companyPerEmployee, 9)
  assert.ok(json.personalPlans.every((p) => typeof p.byokMonthly === 'number'))
  assert.equal(typeof json.companyPlan.byokMonthly, 'number')
})

test('implementation is gone: redirect, no product, the builder link decodes to the company', () => {
  assert.ok(!productIds.includes('implementation'))
  for (const dict of [ru, en]) {
    assert.equal(dict.products.items.implementation, undefined)
    assert.equal(dict.productPage.items.implementation, undefined)
  }
  const config = readFileSync('next.config.ts', 'utf8')
  assert.match(config, /products\/implementation', destination: '\/ai-team'/)
  const build = decodeBuild('p.implementation')
  assert.deepEqual(build.products, ['company'])
  const teamBuild = decodeBuild(new URL(aiTeamBuilderHref('ru', 'sales'), 'https://x.test').searchParams.get('b'))
  assert.ok(teamBuild.options.company.includes('sales'))
})

test('names: Personal AI levels and the company product', () => {
  assert.deepEqual([ru.products.plans.basic, ru.products.plans.plus, ru.products.plans.max], ['Спутник', 'Второй пилот', 'Второе я'])
  assert.deepEqual([en.products.plans.basic, en.products.plans.plus, en.products.plans.max], ['Companion', 'Copilot', 'Alter Ego'])
  assert.equal(ru.products.items.company.name, 'ИИ вашей компании')
  assert.equal(en.products.items.company.name, 'Your company’s AI')
  assert.equal(ru.nav.aiTeams, 'ИИ-команды')
  assert.equal(en.nav.aiTeams, 'AI teams')
  // the company copy reads «one brain that knows the business»: no org-chart-as-product words left
  const company = JSON.stringify(ru.productPage.items.company)
  assert.doesNotMatch(company, /пакет агентов|оргсхем/i)
  assert.match(company, /один ИИ|Один мозг/)
})

test('channels: seven equals, both languages, Telegram is one of them', () => {
  assert.deepEqual([...channelIds], ['telegram', 'whatsapp', 'web', 'cabinet', 'voice', 'email', 'desktop'])
  for (const id of channelIds) {
    for (const loc of ['ru', 'en']) assert.ok(channels[id].name[loc] && channels[id].line[loc], `${id} ${loc}`)
    assert.doesNotMatch(JSON.stringify(channels[id]), /[–—]/, id)
  }
  assert.ok(ru.channelsStrip.title && en.channelsStrip.title)
  for (const id of ['personal', 'company', 'admin', 'receptionist', 'content', 'automation']) {
    const pages = readFileSync('src/content/product-pages.ts', 'utf8')
    assert.match(pages, new RegExp(`${id}: \\{[^}]*'channels'`), id)
  }
})

test('the subscription card is one shared component with the own-key switch', () => {
  assert.ok(existsSync('src/components/products/subscription-card.tsx'))
  const card = readFileSync('src/components/products/subscription-card.tsx', 'utf8')
  assert.match(card, /byokMonthly/)
  assert.match(card, /radiogroup/)
  for (const f of ['src/components/products/plan-levels.tsx', 'src/components/ai-team/team-price.tsx'])
    assert.match(readFileSync(f, 'utf8'), /SubscriptionCard/, f)
  assert.deepEqual(Object.keys(ru.subscription), Object.keys(en.subscription))
  // the card is the only place the amounts show: copy carries tokens, never digits
  for (const dict of [ru, en]) assert.doesNotMatch(JSON.stringify(dict.subscription), /\d|\$/)
})
