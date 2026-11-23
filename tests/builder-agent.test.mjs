// «Один агент» in the builder (v6, 2026-11-24): the `a.` link chunk, prices (one agent, the team formula from two,
// the two paid options), payment stages by the owner's rule, the deep link from an agent page, the lead brief and the
// estimate rows, and that the old builder links still decode.
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

const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const { decodeBuild, encodeBuild, emptyBuild, quote } = await import('../src/lib/builder.ts')
const A = await import('../src/lib/builder-agent.ts')
const ids = await import('../src/lib/agent-ids.ts')
const teams = await import('../src/lib/ai-teams.ts')
const { agentStages } = await import('../src/lib/payment-stages.ts')
const { defaultPricing } = await import('../src/lib/pricing.ts')
const { estimateDoc, estimateJson, leadSummary } = await import('../src/lib/estimate-doc.ts')
const { leadBriefOf } = await import('../src/lib/builder-personal.ts')

const paramB = (href) => new URL(href, 'https://x.test').searchParams.get('b')
const sample = () => {
  let b = A.startAgent(emptyBuild, 'lead-handler')
  b = A.withAgentBrief(b, { channels: ['telegram', 'web'], connect: ['crm', 'calendar'], volume: 'm', knowledge: true })
  return b
}

test('the leaf id list matches the 18 standalone agents of ai-teams', () => {
  assert.deepEqual([...ids.standaloneAgentIds].sort(), teams.agentOffers.filter((a) => a.standalone).map((a) => a.id).sort())
  assert.equal(ids.standaloneAgentIds.length, 18)
})

test('popularAgentIds are standalone agents and exported from ai-teams', () => {
  assert.deepEqual([...teams.popularAgentIds], ['lead-handler', 'support', 'content-maker', 'analyst', 'onboarding', 'documents'])
  for (const id of teams.popularAgentIds) assert.ok(teams.agentOffer(id).standalone)
})

test('encode and decode: the agent path round-trips', () => {
  const b = sample()
  const code = encodeBuild(b)
  assert.match(code, /(^|~)a\.lead-handler\.telegram-web\.crm-calendar\.m\.path-knowledge/)
  const back = decodeBuild(code)
  assert.deepEqual(back.agents, ['lead-handler'])
  assert.deepEqual(back.agentBrief, { channels: ['telegram', 'web'], connect: ['crm', 'calendar'], volume: 'm', knowledge: true })
  assert.equal(encodeBuild(back), code)
  assert.ok(A.isAgentPath(back))
})

test('agents added to another build have no path flag; unknown ids and flags are dropped', () => {
  const b = { parts: { websites: { variant: 'landing', addons: [] } }, extras: [], agents: ['support', 'analyst'] }
  const back = decodeBuild(encodeBuild(b))
  assert.deepEqual(back.agents, ['support', 'analyst'])
  assert.equal(back.agentBrief, undefined)
  assert.ok(!A.isAgentPath(back))
  const junk = decodeBuild('a.nope_support_director.fax-telegram.x-crm.huge.path-evil')
  assert.deepEqual(junk.agents, ['support'])
  assert.deepEqual(junk.agentBrief, { channels: ['telegram'], connect: ['crm'] })
})

test('old builder links decode as before', () => {
  const old = 'websites.landing.telegram~bots.booking~x.support-seo~k.barber~p.adminbot-site'
  const b = decodeBuild(old)
  assert.equal(b.agents, undefined)
  assert.equal(b.agentBrief, undefined)
  assert.equal(encodeBuild(b), old)
  assert.deepEqual(decodeBuild('p.agent').products, ['personal'])
})

test('agentBuilderHref: the deep link lands on the agent path with the agent chosen', () => {
  const href = teams.agentBuilderHref('ru', 'support')
  assert.match(href, /^\/ru\/builder\?b=a\.support\./)
  const b = decodeBuild(paramB(href))
  assert.deepEqual(b.agents, ['support'])
  assert.ok(A.isAgentPath(b))
  assert.equal(A.agentReady(b), false)
  assert.deepEqual(A.agentIssues(b, 0), [])
  assert.deepEqual(A.agentIssues(b, 1), ['where'])
  assert.match(teams.agentBuilderHref('en', 'analyst'), /^\/en\/builder\?b=/)
  // The Director is sold only with a team: it opens the AI company instead.
  assert.match(teams.agentBuilderHref('ru', 'director'), /p\.company/)
})

test('pricing: one agent, the team formula from two, the paid options, all from Pricing', () => {
  const one = A.agentQuote(sample(), defaultPricing)
  assert.equal(one.count, 1)
  assert.equal(one.setup, defaultPricing.agentSubscription.setup)
  assert.equal(one.monthly, defaultPricing.agentSubscription.monthly)
  assert.equal(one.discountPercent, 0)
  assert.deepEqual(one.addons.map((a) => a.id), ['knowledge'])
  assert.equal(one.oneTime, one.setup + A.agentAddonPrices(defaultPricing).knowledge)
  const two = A.agentQuote(A.toggleAgent(sample(), 'support'), defaultPricing)
  assert.equal(two.count, 2)
  assert.equal(two.setup, Math.round(defaultPricing.agentSubscription.setup * 2 * 0.85))
  assert.equal(two.monthly, Math.round(defaultPricing.agentSubscription.monthly * 2 * 0.85))
  assert.equal(two.discountPercent, defaultPricing.teamDiscount)
  // A changed price in the live pricing reaches the quote.
  const pricing = { ...defaultPricing, agentSubscription: { setup: 500, monthly: 50, byokMonthly: 20 } }
  assert.equal(A.agentQuote(A.startAgent(emptyBuild, 'seo'), pricing).setup, 500)
  assert.equal(A.agentQuote(emptyBuild, defaultPricing), null)
})

test('toggleAgent adds, removes and caps the lines', () => {
  let b = emptyBuild
  for (const id of ids.standaloneAgentIds) b = A.toggleAgent(b, id)
  assert.equal(b.agents.length, A.agentLimit)
  b = A.toggleAgent(b, b.agents[0])
  assert.equal(b.agents.length, A.agentLimit - 1)
  assert.equal(A.toggleAgent(A.toggleAgent(emptyBuild, 'seo'), 'seo').agents, undefined)
})

test('payment stages: under the small limit 50/50, from it 30/40/30', () => {
  const small = agentStages(259, defaultPricing)
  assert.deepEqual(small.map((s) => s.share), [50, 50])
  assert.equal(small.reduce((s, x) => s + x.amountUsd, 0), 259)
  const big = agentStages(374, defaultPricing)
  assert.deepEqual(big.map((s) => s.share), [30, 40, 30])
  assert.equal(big.reduce((s, x) => s + x.amountUsd, 0), 374)
})

test('estimate doc: the agent block, setup inside the total, monthly apart, stages, guarantee', () => {
  for (const [dict, locale] of [[ru, 'ru'], [en, 'en']]) {
    const b = sample()
    const doc = estimateDoc(b, dict, locale, defaultPricing)
    const q = A.agentQuote(b, defaultPricing)
    assert.equal(doc.agents.rows[0].name, dict.aiTeams.agents.items['lead-handler'].title)
    assert.ok(doc.agents.rows.some((r) => r.id === 'agent-knowledge'))
    assert.match(doc.total, new RegExp(String(q.oneTime)))
    assert.match(doc.agents.monthly, new RegExp(String(q.monthly)))
    assert.deepEqual(doc.stages.map((s) => s.share), ['50%', '50%'])
    assert.ok(doc.guarantee.length > 10)
    assert.ok(doc.brief.setup.some((r) => r.id === 'a-where'))
    assert.equal(doc.parts.length, 0)
    const json = estimateJson(b, dict, locale, defaultPricing)
    assert.equal(json.totalUsd, q.oneTime)
    assert.equal(json.monthlyUsd, q.monthly)
    // Two agents plus a website: the stages follow the one-time total with the parts' template.
    const mixed = A.toggleAgent({ parts: { websites: { variant: 'company', addons: [] } }, extras: [], agents: ['support'] }, 'analyst')
    const md = estimateDoc(mixed, dict, locale, defaultPricing)
    const parts = quote(mixed, defaultPricing).total
    assert.equal(estimateJson(mixed, dict, locale, defaultPricing).totalUsd, parts + A.agentQuote(mixed, defaultPricing).oneTime)
    assert.deepEqual(md.stages.map((s) => s.share), ['30%', '40%', '30%'])
  }
})

test('lead: the text summary and the brief carry the agent and the answers', () => {
  const b = sample()
  const text = leadSummary(b, ru, 'ru', defaultPricing)
  assert.match(text, /Менеджер заявок/)
  assert.match(text, /Telegram/)
  assert.match(text, /CRM/)
  assert.doesNotMatch(text, /Состав|Ниша/)
  const brief = leadBriefOf(b)
  assert.equal(brief.type, 'agent')
  assert.equal(brief.agent, 'lead-handler')
  assert.deepEqual(brief.channels, ['telegram', 'web'])
  assert.equal(brief.volume, 'm')
  assert.equal(brief.knowledge, true)
  // Added to a business build the brief keeps its type and lists the agents.
  const mixed = leadBriefOf({ parts: {}, extras: [], kind: 'barber', agents: ['support'] })
  assert.equal(mixed.type, 'business')
  assert.deepEqual(mixed.agents, ['support'])
})

test('agent path drops business chunks that rode along', () => {
  const b = decodeBuild('websites.landing~k.barber~a.support.telegram._.s.path')
  const only = A.agentOnly(b)
  assert.deepEqual(only.parts, {})
  assert.equal(only.kind, undefined)
  assert.deepEqual(only.agents, ['support'])
})

test('copy: both languages, no em dash, no the word «бот», questions for every department', () => {
  const copy = JSON.stringify(readFileSync('src/content/builder-agent.ts', 'utf8').match(/'[^'\n]*'/g))
  assert.doesNotMatch(copy, /[–—]/)
  assert.doesNotMatch(copy, /\bбот/i)
})

test('the agent page links the builder with this agent and keeps the team CTA second', () => {
  const page = readFileSync('src/app/[locale]/ai-team/agent/[id]/page.tsx', 'utf8')
  assert.match(page, /agentBuilderHref\(locale, id\)[^]*data-cta=\{`agent_\$\{id\}_build`\}/)
  assert.match(page, /ctaBuildAgent/)
  assert.match(page, /aiTeamBuilderHref\(locale, offer\.dept\)/)
  assert.equal(ru.aiTeams.ctaBuildAgent, 'Собрать с этим агентом')
})
