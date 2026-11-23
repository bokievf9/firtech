// «Самые нужные агенты» on the home page (v6 B2): the section after the products, six popular agents plus Personal AI,
// links to the agent page and the builder, the nav item, the footer column, the /ai-team popular filter.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const { homeSections, sectionAnchor, footerColumns } = await import('../src/lib/home.ts')
const { popularAgentIds } = await import('../src/lib/agent-ids.ts')
const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')

const read = (p) => readFileSync(p, 'utf8')

test('home agents: the section sits right after the products and has its anchor', () => {
  assert.equal(homeSections[homeSections.indexOf('products') + 1], 'agents')
  assert.equal(sectionAnchor.agents, 'agents')
})

test('home agents: six popular agents + Personal AI, links and analytics hooks', () => {
  assert.equal(popularAgentIds.length, 6)
  const src = read('src/components/home-agents.tsx')
  assert.match(src, /popularAgentIds\.map/)
  assert.match(src, /agentBuilderHref\(locale, id\)/)
  assert.match(src, /data-cta=\{`home_agents_\$\{id\}`\}/)
  assert.match(src, /data-home-agent-card="personal"/)
  assert.match(src, /personalBuilderHref/)
  assert.match(src, /agentSubscriptionOf\(pricing\)/)
  assert.match(src, /ItemList/)
  assert.match(read('src/app/[locale]/page.tsx'), /agents: <HomeAgents/)
})

test('home agents: texts in both languages, title as agreed', () => {
  assert.equal(ru.homeAgents.title, 'Самые нужные агенты')
  for (const d of [ru, en]) {
    for (const k of ['title', 'sub', 'view', 'build', 'all', 'personalRole', 'personalJob', 'personalBuild']) assert.ok(d.homeAgents[k], k)
    assert.ok(d.nav.agents)
    assert.ok(d.footer.agents)
    assert.ok(d.footer.pages['all-agents'])
    assert.ok(d.aiTeams.agents.popularLabel)
    for (const id of popularAgentIds) assert.ok(d.aiTeams.agents.items[id].title, id)
  }
})

test('nav: «Агенты» goes to /ai-team#agents, before the AI teams, in the mobile menu too (same list)', () => {
  const header = read('src/components/header.tsx')
  const a = header.indexOf('dict.nav.agents')
  const b = header.indexOf('dict.nav.aiTeams')
  assert.ok(a > 0 && a < b)
  assert.match(header, /ai-team#agents/)
  assert.equal((header.match(/links\.map/g) ?? []).length, 2) // desktop bar and the sheet share `links`
})

test('footer: «Агенты» column with the six popular agents and «Все агенты»', () => {
  for (const locale of ['ru', 'en']) {
    const col = footerColumns(locale).find((c) => c.id === 'agents')
    assert.ok(col)
    assert.deepEqual(col.links.slice(0, 6).map((l) => l.id), [...popularAgentIds])
    assert.equal(col.links.at(-1).href, `/${locale}/ai-team#agents`)
  }
})

test('/ai-team: the explorer has a «Популярные» chip first and #agents selects it', () => {
  const ex = read('src/components/ai-team/agent-explorer.tsx')
  assert.match(ex, /items=\{\[\{ id: 'popular'/)
  assert.match(ex, /#agents/)
  assert.match(read('src/app/[locale]/ai-team/page.tsx'), /popularIds=\{popularAgentIds\}/)
})
