// The two flagships (owner 2026-11-22, review item 14): «Персональный ИИ» (`personal`) and «ИИ-компания» (`company`):
// catalogue order, prices from one source, the builder options and levels, the old `agent` address, the two
// product pages with their own structure, the pilot offer only on the flagships, the HQ contract file.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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
const { productIds, flagshipIds, legacyProductRedirects } = await import('../src/lib/product-ids.ts')
const { productIds: catalogIds, productCatalog } = await import('../src/content/builder-catalog.ts')
const { decodeBuild, encodeBuild, emptyBuild, quote, toggleProduct } = await import('../src/lib/builder.ts')
const { flagshipPrice, flagshipsOf, optionsOf, personalLevel, toggleOption, defaultOptions } = await import('../src/lib/flagships.ts')
const { personalPlanList, companyPlanOf, stageDefs } = await import('../src/lib/pricing.ts')
const { priceFields, resolvePricing } = await import('../src/lib/pricing-edit.ts')
const { pricesJson } = await import('../src/lib/prices-json.ts')
const { productPages } = await import('../src/content/product-pages.ts')
const { estimateDoc, leadSummary } = await import('../src/lib/estimate-doc.ts')
const { previewModes, productFamily } = await import('../src/lib/builder-v2.ts')
const { flagshipText } = await import('../src/content/builder-v2.ts')

const dicts = [['ru', ru], ['en', en]]

test('flagships: first everywhere products are listed, the old personal assistant is gone', () => {
  assert.deepEqual([...flagshipIds], ['personal', 'company'])
  assert.deepEqual(productIds.slice(0, 2), ['personal', 'company'])
  assert.deepEqual(catalogIds.slice(0, 2), ['personal', 'company'])
  assert.ok(!productIds.includes('agent') && !catalogIds.includes('agent'))
  assert.deepEqual(legacyProductRedirects, { agent: '/products/personal', implementation: '/ai-team' })
  for (const [, dict] of dicts) {
    assert.deepEqual(Object.keys(dict.products.items).slice(0, 2), ['personal', 'company'])
    assert.deepEqual(Object.keys(dict.productPage.items).slice(0, 2), ['personal', 'company'])
  }
  // The 404 list and the sitemap order come from the same ids; the 404 search finds both flagships first.
  const nf = readFileSync('src/content/not-found.ts', 'utf8')
  assert.ok(nf.indexOf('/products/personal') < nf.indexOf('/products/admin'))
  assert.ok(nf.indexOf('/products/company') < nf.indexOf('/products/admin'))
  assert.doesNotMatch(nf, /\/products\/agent/)
})

test('flagships: /products/agent redirects to /products/personal in both languages', () => {
  const config = readFileSync('next.config.ts', 'utf8')
  assert.match(config, /source: '\/:locale\(ru\|en\)\/products\/agent', destination: '\/:locale\/products\/personal', permanent: true/)
  assert.match(config, /source: '\/products\/agent', destination: '\/products\/personal'/)
  // «ИИ-отдел под ключ» was removed (owner 2026-11-22): its page leads to the AI teams.
  assert.match(config, /source: '\/:locale\(ru\|en\)\/products\/implementation', destination: '\/:locale\/ai-team', permanent: true/)
  assert.match(config, /source: '\/products\/implementation', destination: '\/ai-team', permanent: true/)
})

test('flagships: prices in one source, editable in the Пульт, published for HQ', () => {
  assert.deepEqual(personalPlanList().map((p) => [p.id, p.setup, p.monthly]).slice(0, 1), [['basic', 290, 29]])
  assert.deepEqual(personalPlanList().map((p) => [p.setup, p.monthly, p.byokMonthly]), [[290, 29, 14], [490, 59, 34], [790, 99, 59]])
  assert.deepEqual(companyPlanOf(), { id: 'company', setup: 1490, monthly: 149, byokMonthly: 104 })
  const paths = priceFields.map((f) => f.path)
  for (const p of ['personalPlans.basic.setup', 'personalPlans.max.monthly', 'companyPlan.company.setup', 'companyPlan.company.monthly'])
    assert.ok(paths.includes(p), p)
  const live = resolvePricing({ personalPlans: { basic: { setup: 300 } }, companyPlan: { company: { monthly: 199 } } })
  assert.equal(personalPlanList(live)[0].setup, 300)
  assert.equal(companyPlanOf(live).monthly, 199)
  const json = pricesJson(live)
  assert.deepEqual(json.personalPlans, personalPlanList(live))
  assert.deepEqual(json.companyPlan, companyPlanOf(live))
  assert.equal(json.products.company.byQuote, true)
  // HQ still requires the retired Dono and Polly plans: kept, but no product shows them.
  assert.deepEqual(json.agentPlans.map((p) => p.id), ['dono', 'polly'])
  assert.ok(Object.values(json.products).every((p) => p.kind !== 'plans' || p.plans.every((x) => !['dono', 'polly'].includes(x.id))))
  // The AI company pays in four stages like an app.
  assert.deepEqual(stageDefs('company').map((s) => s.share), stageDefs('app').map((s) => s.share))
})

test('builder: flagship options ride in the link, set the level, never join the one-time total', () => {
  let b = toggleProduct(emptyBuild, 'personal')
  assert.deepEqual(optionsOf(b, 'personal'), defaultOptions.personal)
  assert.equal(flagshipPrice(b, 'personal').plan.id, 'basic')
  for (const id of ['tasks', 'study']) b = toggleOption(b, 'personal', id)
  assert.equal(personalLevel(optionsOf(b, 'personal')), 'plus')
  b = toggleOption(b, 'personal', 'memory')
  assert.equal(flagshipPrice(b, 'personal').plan.id, 'max')
  assert.equal(personalLevel(['mail', 'voice']), 'plus')
  assert.equal(personalLevel(['mail', 'calendar', 'tasks', 'study', 'notes']), 'max')
  assert.equal(personalLevel(['mail']), 'basic')
  // unknown options are ignored
  assert.deepEqual(toggleOption(b, 'personal', 'sales'), b)
  b = toggleProduct(b, 'company')
  b = toggleOption(b, 'company', 'marketing')
  const code = encodeBuild(b)
  assert.match(code, /f\.personal\.mail-calendar-tasks-study-memory/)
  assert.match(code, /f\.company\.sales-marketing-pult-knowledge-training/)
  assert.deepEqual(decodeBuild(code), b)
  assert.equal(quote(b).total, 0)
  const company = flagshipsOf(b).find((f) => f.product === 'company')
  assert.equal(company.byQuote, true)
  // leaving the build takes the options too
  const off = toggleProduct(b, 'personal')
  assert.equal(off.options?.personal, undefined)
  assert.deepEqual(off.options?.company, b.options.company)
  // old links with `p.agent` decode as the Personal AI
  assert.deepEqual(decodeBuild('p.agent-adminbot').products, ['personal', 'adminbot'])
  // the flagships have their goals and previews
  assert.equal(productFamily.personal, 'assistant')
  assert.equal(productFamily.company, 'department')
  assert.ok(previewModes(toggleProduct(emptyBuild, 'personal')).includes('personal'))
  assert.ok(previewModes(toggleProduct(emptyBuild, 'company')).includes('department'))
  // every option has a name and a hint in both languages
  for (const ids of [['mail', 'calendar', 'tasks', 'study', 'notes', 'messengers', 'voice', 'memory'], ['sales', 'marketing', 'support', 'production', 'backoffice', 'pult', 'knowledge', 'channels', 'training']])
    for (const id of ids) for (const loc of ['ru', 'en']) assert.ok(flagshipText.options[id].name[loc] && flagshipText.options[id].hint[loc], id)
})

test('builder: the estimate and the lead list the flagship with its plan, apart from the total', () => {
  const b = toggleOption(toggleProduct(toggleProduct(emptyBuild, 'adminbot'), 'personal'), 'personal', 'voice')
  for (const [locale, dict] of dicts) {
    const doc = estimateDoc(b, dict, locale)
    const row = doc.onRequest.find((r) => r.id === 'personal')
    assert.match(row.price, /\$490 \+ \$59/)
    assert.equal(doc.total, `$${quote(b).total}`)
    const lead = leadSummary(b, dict, locale)
    assert.ok(lead.includes(productCatalog.personal.name[locale]))
    assert.ok(lead.length <= 1500)
  }
})

test('flagship pages: their own structure, both cut to the short v4 list (the pilot block left the company page, its copy stays)', () => {
  const personal = productPages.personal.sections
  const company = productPages.company.sections
  // Personal AI (front v4): result -> where it lives -> twelve skills -> who you are + demo -> levels -> start -> questions.
  const order = (list, ids) => ids.every((id, i) => i === 0 || list.indexOf(ids[i - 1]) < list.indexOf(id))
  assert.deepEqual(personal, ['hero', 'channels', 'skills', 'myday', 'plans', 'start', 'questions'])
  // AI company (front v4): the brain diagram -> where it lives -> a company day -> ask Fira -> subscription -> start -> questions.
  assert.deepEqual(company, ['hero', 'brain', 'channels', 'cday', 'cdemo', 'cplan', 'start', 'questions'])
  assert.ok(order(company, ['hero', 'brain', 'channels', 'cday', 'cdemo', 'cplan', 'start', 'questions']))
  assert.equal(productPages.company.face, 'fira')
  assert.equal(productPages.company.callFirst, true)
  // the two pages share no block of their own
  const shared = new Set(['hero', 'channels', 'start', 'questions'])
  assert.equal(personal.filter((s) => !shared.has(s) && company.includes(s)).length, 0)
  for (const id of productIds) assert.equal(productPages[id].sections.includes('pilot'), false, `${id} pilot`)
  for (const [locale, dict] of dicts) {
    const p = dict.productPage.items.personal
    const c = dict.productPage.items.company
    // the founder block (Dono, Polly, memory, setup, lives) is gone from the Personal AI page
    for (const key of ['cases', 'memory', 'setup', 'lives', 'pilot']) assert.equal(p[key], undefined, `${locale} personal ${key}`)
    assert.doesNotMatch(JSON.stringify(p), /Dono|Polly/)
    assert.equal(p.myday.personas.length, 8, locale)
    for (const persona of p.myday.personas) assert.ok(persona.steps.length === 4 && persona.asks.length === 3, `${locale} ${persona.id}`)
    assert.equal(c.rollout.stages.length, 4)
    // the rollout stages are the stage template's titles, so the page and the stage table agree
    assert.deepEqual(c.rollout.stages.map((s) => s.title), stageDefs('company').map((s) => s.title[locale]))
    assert.equal(c.trust.levels.length, 3)
    assert.equal(c.pult.tabs.length, 3)
    assert.equal(c.pilot, undefined, `${locale} free pilot removed (owner 2026-11-25)`)
    // the company page's own blocks have copy, no founder / Dono / Polly mentions, four chips as questions
    for (const key of ['brain', 'cday', 'cdemo', 'cplan', 'start', 'questions', 'heroCta']) assert.ok(c[key], `${locale} company ${key}`)
    assert.equal(c.brain.sources.length, 4, locale)
    assert.equal(c.brain.outputs.length, 2, locale)
    assert.ok(c.brain.roles.length >= 3, locale)
    assert.equal(c.cday.items.length, 5, locale)
    assert.equal(c.cplan.points.length, 3, locale)
    assert.equal(c.start.steps.length, 3, locale)
    assert.doesNotMatch(JSON.stringify([c.brain, c.cday, c.cdemo, c.cplan, c.start, c.heroCta, c.result, c.lead]), /Dono|Polly|основател|founder/i, locale)
    for (const page of [p, c]) assert.ok(page.objections.length >= 4, `${locale} objections`)
    // The «demo on your data in 24 hours» promise is not written yet (owner 2026-11-22).
    assert.doesNotMatch(JSON.stringify([p, c]), /24 час|24 hours/i)
    // the brief's objections are answered
    assert.match(JSON.stringify(p.objections), locale === 'ru' ? /ошибётся/ : /mistake/)
    assert.match(JSON.stringify(c.objections), locale === 'ru' ? /дорого/i : /expensive/i)
  }
  // Fira is the face of the company page, light on phones (flat SVG until idle on wide screens).
  const hero = readFileSync('src/components/products/fira-hero.tsx', 'utf8')
  assert.match(hero, /FiraFlat/)
  assert.match(hero, /min-width: 1024px/)
  assert.match(hero, /useReducedMotion/)
  // the levels come from the live pricing
  assert.match(readFileSync('src/components/products/plan-levels.tsx', 'utf8'), /await getPricing\(\)/)
})

test('flagships: the HQ contract and the playbook know the ids, names, prices and need rules', () => {
  assert.ok(existsSync('docs/products-contract.md'))
  const contract = readFileSync('docs/products-contract.md', 'utf8')
  for (const word of ['personal', 'company', 'Персональный ИИ', 'ИИ вашей компании', 'personalPlans', 'companyPlan', 'agentPlans', 'byokMonthly', 'agentSubscription', 'teamDiscountPercent', 'f.personal', '/products/agent', '/products/implementation'])
    assert.ok(contract.includes(word), word)
  const playbook = readFileSync('docs/sales-playbook-site.md', 'utf8')
  assert.match(playbook, /## Флагманы/)
  // /ai-team carries the top rung of the ladder
  assert.match(readFileSync('src/app/[locale]/ai-team/page.tsx', 'utf8'), /productPath\('company'\)/)
  for (const [, dict] of dicts) assert.ok(dict.aiTeams.topRung.title)
})
