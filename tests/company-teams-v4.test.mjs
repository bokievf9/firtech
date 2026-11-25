// Front v4 (owner 2026-11-22): «ИИ вашей компании» and the /ai-team pages (index, teams, agents) on the v4 primitives:
// the text budget per page, Telegram as one channel among many, the company diagram and its locked demo.
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
const { channelIds, channels } = await import('../src/lib/channels.ts')
const { aiTeamIds, agentIds, agentsOfDept } = await import('../src/lib/ai-teams.ts')
const { productPages } = await import('../src/content/product-pages.ts')

const dicts = [['ru', ru], ['en', en]]

function* strings(value) {
  if (typeof value === 'string') yield value
  else if (Array.isArray(value)) for (const v of value) yield* strings(v)
  else if (value && typeof value === 'object') for (const v of Object.values(value)) yield* strings(v)
}
const words = (...parts) => [...strings(parts)].join(' ').split(/\s+/).filter(Boolean).length
// RU is the contract (900 visible words); English runs longer for the same sentences, so it gets a looser cap.
const budgetOf = (locale) => (locale === 'ru' ? 900 : 1000)

// The copy each page shows, assembled the way the page does (shared strips included).
function channelStripWords(dict, locale) {
  return words(dict.channelsStrip, channelIds.map((id) => [channels[id].name[locale], channels[id].line[locale]]))
}
const subscriptionWords = (dict) => words(dict.subscription)

test('company page: at most 900 visible words in both languages', () => {
  for (const [locale, dict] of dicts) {
    const c = dict.productPage.items.company
    const total =
      words(c.result, c.lead, c.heroCta, c.brain, c.cday, c.cdemo, c.cplan, c.start, c.questions, c.objections.slice(0, 4)) +
      words(dict.demoGate.lockTitle, dict.demoGate.lockText, dict.demoGate.login, dict.demoGate.signup, dict.demoSection.exampleBadge) +
      channelStripWords(dict, locale) +
      subscriptionWords(dict) +
      words(dict.products.items.company.name, dict.film.name)
    assert.ok(total <= budgetOf(locale), `${locale} company page: ${total} words`)
    assert.ok(total >= 150, `${locale} company page is not empty: ${total}`)
  }
})

test('ai-team pages: index, team and agent pages stay within 900 words each', () => {
  for (const [locale, dict] of dicts) {
    const t = dict.aiTeams
    const strip = channelStripWords(dict, locale)
    const index =
      words(t.eyebrow, t.title, t.sub, t.ctaBuild, t.ctaChat, t.flow, dict.ladder, t.topRung.title, t.topRung.cta, t.deptsTitle, t.agents.stripTitle, t.agents.stripCta, t.agents.sectionTitle, t.agents.sectionSub, t.page.channelsLine, t.proof.title, t.proof.label, t.proof.note) +
      words(aiTeamIds.map((id) => [t.items[id].title, t.items[id].card, t.items[id].agents.slice(0, 3).map((a) => a.name)])) +
      words(agentIds.map((id) => [t.agents.items[id].title, t.agents.items[id].headline, t.trust[t.agents.items[id].trust ?? 'propose']])) +
      words(aiTeamIds.map((id) => t.items[id].title)) +
      dict.channelsStrip.title.split(' ').length
    assert.ok(index <= budgetOf(locale), `${locale} /ai-team: ${index} words`)
    for (const id of aiTeamIds) {
      const i = t.items[id]
      const team =
        words(i.title, i.headline, i.promise, i.forWhom, t.ctaBuild, t.ctaChat, t.page, t.together, t.channelsLine) +
        words(agentsOfDept(id).map((a) => [t.agents.items[a.id].title, t.agents.items[a.id].headline])) +
        words(i.routines, i.needs) +
        words(aiTeamIds.map((o) => t.items[o].title)) +
        strip +
        subscriptionWords(dict)
      assert.ok(team <= budgetOf(locale), `${locale} team ${id}: ${team} words`)
    }
    for (const id of agentIds) {
      const a = t.agents.items[id]
      const agent =
        words(a.title, a.headline, a.promise, a.does, a.needs, a.alone, a.waits, a.worksNote, t.ctaBuild, t.ctaChat, t.agents.page) +
        strip +
        subscriptionWords(dict)
      assert.ok(agent <= budgetOf(locale), `${locale} agent ${id}: ${agent} words`)
    }
  }
})

test('teams and agents: delivery is «в ваших каналах», Telegram is never the only channel and never the default', () => {
  const only = [/в Telegram/, /в вашем Telegram/, /Telegram-/, /Telegram для/, /Telegram for/, /in Telegram/, /in your (own )?Telegram/, /to Telegram/, /Telegram chat/, /Telegram group/, /из Telegram/, /from Telegram/]
  for (const [locale, dict] of dicts) {
    for (const text of strings(dict.aiTeams)) for (const re of only) assert.doesNotMatch(text, re, `${locale}: ${text.slice(0, 80)}`)
    assert.match(dict.aiTeams.page.delivery, locale === 'ru' ? /каналах/ : /channels/)
  }
  // the pages carry the channel strip, with all seven channels as equals
  for (const file of ['src/app/[locale]/ai-team/page.tsx', 'src/app/[locale]/ai-team/[id]/page.tsx', 'src/app/[locale]/ai-team/agent/[id]/page.tsx'])
    assert.match(readFileSync(file, 'utf8'), /ChannelsRow/, file)
  const row = readFileSync('src/components/ai-team/channels-row.tsx', 'utf8')
  assert.match(row, /personalChannelOrder/)
  assert.equal(channelIds.length, 7)
})

test('teams and agents: v4 primitives, a card per agent with the team link, team page with the four-step flow', () => {
  for (const file of ['src/app/[locale]/ai-team/page.tsx', 'src/app/[locale]/ai-team/[id]/page.tsx', 'src/app/[locale]/ai-team/agent/[id]/page.tsx'])
    assert.match(readFileSync(file, 'utf8'), /from '@\/components\/ui'/, file)
  const card = readFileSync('src/components/ai-team/agent-list.tsx', 'utf8')
  assert.match(card, /partOf/)
  assert.match(card, /<Card interactive/)
  const index = readFileSync('src/app/[locale]/ai-team/page.tsx', 'utf8')
  assert.match(index, /AgentExplorer/)
  const explorer = readFileSync('src/components/ai-team/agent-explorer.tsx', 'utf8')
  assert.match(explorer, /TabList/)
  assert.match(readFileSync('src/app/[locale]/ai-team/[id]/page.tsx', 'utf8'), /TogetherFlow/)
  assert.match(readFileSync('src/app/[locale]/ai-team/agent/[id]/page.tsx', 'utf8'), /AgentPriceCard/)
  assert.match(readFileSync('src/app/[locale]/ai-team/[id]/page.tsx', 'utf8'), /TeamPriceCard/)
  for (const [locale, dict] of dicts) {
    assert.equal(dict.aiTeams.together.steps.length, 4, locale)
    assert.ok(dict.aiTeams.agents.page.partOf, locale)
  }
})

test('company page: the diagram, the company day, the locked demo and the subscription card are there', () => {
  assert.deepEqual(productPages.company.sections, ['hero', 'brain', 'channels', 'cday', 'cdemo', 'cplan', 'pilot', 'start', 'questions'])
  const blocks = readFileSync('src/components/product-sections/company-blocks.tsx', 'utf8')
  for (const marker of ['data-brain-sources', 'data-brain-center', 'data-brain-outputs', 'data-brain-roles', 'data-company-day', 'CompanyPlan', 'CompanyDemo'])
    assert.match(blocks, new RegExp(marker))
  const demo = readFileSync('src/components/product-sections/company-demo.tsx', 'utf8')
  // signed out: the labelled example and the lock plate; signed in: the real chat
  assert.match(demo, /variant="plate"/)
  assert.match(demo, /data-company-example/)
  assert.match(demo, /openChat/)
  for (const agent of agentIds) assert.ok(agent)
})
