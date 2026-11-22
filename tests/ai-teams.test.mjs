// «Отдел из ИИ-агентов» (2026-11-21): six offers, both locales in one shape, no prices or digits in
// copy, pages in localePages, the sitemap and the footer.
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
const teams = await import('../src/lib/ai-teams.ts')
const { footerColumns, localePages } = await import('../src/lib/home.ts')
const { decodeBuild } = await import('../src/lib/builder.ts')
const sitemap = (await import('../src/app/sitemap.ts')).default

const dicts = [['ru', ru], ['en', en]]
const ids = ['marketing', 'sales', 'support', 'production', 'backoffice', 'company']

function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k)
}

// The shape of a value: keys of objects, lengths of arrays, `s` for strings.
function shape(value) {
  if (Array.isArray(value)) return value.map(shape)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
  return typeof value
}

test('ai teams: the six offers, in order, with the helpers', () => {
  assert.deepEqual([...teams.aiTeamIds], ids)
  for (const id of ids) {
    assert.ok(teams.isAiTeamId(id))
    assert.ok(teams.aiTeamAccent[id].soft && teams.aiTeamAccent[id].text)
  }
  assert.equal(teams.isAiTeamId('nope'), false)
  assert.deepEqual(teams.aiTeamPaths, ['/ai-team', ...ids.map((id) => `/ai-team/${id}`)])
})

test('ai teams: every offer has the full copy in both locales, titles RU and EN', () => {
  for (const [locale, dict] of dicts) {
    assert.deepEqual(Object.keys(dict.aiTeams.items), ids, locale)
    for (const id of ids) {
      const item = dict.aiTeams.items[id]
      for (const key of ['title', 'card', 'promise', 'forWhom', 'metaTitle', 'metaDescription', 'how'])
        assert.ok(item[key] && item[key].length >= 8, `${locale} ${id} ${key}`)
      assert.ok(item.agents.length >= 2, `${locale} ${id} agents`)
      for (const a of item.agents) {
        assert.ok(a.name && a.does, `${locale} ${id} agent`)
        assert.ok(teams.trustLevels.includes(a.trust), `${locale} ${id} ${a.name} trust`)
      }
      assert.ok(item.routines.length >= 3, `${locale} ${id} routines`)
      assert.ok(item.needs.length >= 3, `${locale} ${id} needs`)
      assert.ok(item.faq.length >= 3 && item.faq.length <= 4, `${locale} ${id} faq`)
    }
  }
  assert.notEqual(ru.aiTeams.items.marketing.title, en.aiTeams.items.marketing.title)
})

test('ai teams: RU and EN dictionaries have the same shape, the section is last', () => {
  assert.deepEqual(shape(ru.aiTeams), shape(en.aiTeams))
  for (const [, dict] of dicts) assert.equal(Object.keys(dict).filter((k) => k !== 'firaGuide').at(-1), 'aiTeams')
})

test('ai teams: copy has no digits, dollar amounts, long dashes or AI tells', () => {
  const tells = [
    /\bэто не [^.!?]{1,60}, а\b/i,
    /\bне просто [^.!?]{1,60}, а\b/i,
    /\bне только [^.!?]{1,60}, но и\b/i,
    /\bit'?s not [^.!?]{1,60}, it'?s\b/i,
    /\bnot (just|only|merely) [^.!?]{1,60}, (but|it)\b/i,
    /\bбез [^,.!?]{1,30}, без [^,.!?]{1,30}, (и )?без\b/i,
    /\bno [^,.!?]{1,30}, no [^,.!?]{1,30}, (and )?no\b/i,
    /, (позволяя|делая|помогая|обеспечивая|allowing|making|helping|ensuring)\b/i,
  ]
  for (const [locale, dict] of dicts)
    for (const [at, text] of strings(dict.aiTeams)) {
      assert.doesNotMatch(text, /\d/, `${locale} ${at}: no digits (nothing that looks like a price)`)
      assert.doesNotMatch(text, /[$€₽]|USD|\bdollars?\b|долл/i, `${locale} ${at}`)
      assert.doesNotMatch(text, /[–—]/, `${locale} ${at}`)
      assert.doesNotMatch(text, /!/, `${locale} ${at}`)
      for (const re of tells) assert.doesNotMatch(text, re, `${locale} ${at}`)
    }
})

test('ai teams: meta descriptions are 120-160 characters, titles within 70', () => {
  for (const [locale, dict] of dicts) {
    const check = (label, text) => assert.ok(text.length >= 120 && text.length <= 160, `${locale} ${label}: ${text.length}`)
    check('index', dict.aiTeams.metaDescription)
    assert.ok(dict.aiTeams.metaTitle.length <= 70, `${locale} index title`)
    for (const id of ids) {
      check(id, dict.aiTeams.items[id].metaDescription)
      assert.ok(dict.aiTeams.items[id].metaTitle.length <= 70, `${locale} ${id} title`)
    }
  }
})

test('ai teams: prices only from the pricing helpers, never typed, and the delivery note is in the copy', () => {
  for (const [, dict] of dicts) {
    assert.match(dict.aiTeams.page.delivery, /каналах|channels/)
    assert.equal(dict.aiTeams.quote, undefined, 'the «по смете» line is gone, teams and agents show their subscription')
  }
  assert.equal(ru.aiTeams.ctaDiscuss, 'Спросить агента')
  const files = [
    'src/app/[locale]/ai-team/page.tsx',
    'src/app/[locale]/ai-team/[id]/page.tsx',
    'src/app/[locale]/ai-team/agent/[id]/page.tsx',
    'src/components/ai-team/team-parts.tsx',
    'src/components/ai-team/team-price.tsx',
    'src/lib/ai-teams.ts',
  ]
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    assert.doesNotMatch(text, /\$\d|\b(?:setup|monthly):\s*\d/, file)
  }
  // The team page and the agent page both read the live pricing through the shared card.
  assert.match(readFileSync('src/components/ai-team/team-price.tsx', 'utf8'), /getPricing/)
  assert.match(readFileSync('src/app/[locale]/ai-team/[id]/page.tsx', 'utf8'), /TeamPriceCard/)
  assert.match(readFileSync('src/app/[locale]/ai-team/agent/[id]/page.tsx', 'utf8'), /AgentPriceCard/)
})

test('ai teams: the builder link opens with the AI company picked and the team as its option', () => {
  const href = teams.aiTeamBuilderHref('ru', 'support')
  assert.match(href, /^\/ru\/builder\?b=/)
  const build = decodeBuild(new URL(href, 'https://x.test').searchParams.get('b'))
  assert.ok(build.products.includes('company'))
  assert.ok(build.options.company.includes('support'))
  const whole = decodeBuild(new URL(teams.aiTeamBuilderHref('en'), 'https://x.test').searchParams.get('b'))
  assert.ok(whole.products.includes('company'))
})

test('ai teams: pages exist, in localePages, in the sitemap with alternates', async () => {
  assert.ok(localePages.includes('ai-team'))
  assert.ok(existsSync('src/app/[locale]/ai-team/page.tsx'))
  assert.ok(existsSync('src/app/[locale]/ai-team/[id]/page.tsx'))
  const pages = readFileSync('src/app/[locale]/ai-team/[id]/page.tsx', 'utf8')
  assert.match(pages, /generateStaticParams/)
  assert.match(pages, /dynamicParams = false/)
  const entries = await sitemap()
  const urls = entries.map((e) => e.url)
  for (const locale of ['ru', 'en'])
    for (const p of teams.aiTeamPaths) assert.ok(urls.some((u) => u.endsWith(`/${locale}${p}`)), `${locale}${p}`)
  const one = entries.find((e) => e.url.endsWith('/ru/ai-team/sales'))
  assert.deepEqual(Object.keys(one.alternates.languages).sort(), ['en', 'ru'])
})

test('ai teams: one footer link in the Products column, labelled in both languages', () => {
  for (const [locale, dict] of dicts) {
    const products = footerColumns(locale).find((c) => c.id === 'products')
    const links = products.links.filter((l) => l.href === `/${locale}/ai-team`)
    assert.equal(links.length, 1)
    assert.equal(dict.footer.pages['ai-team'], dict.nav.aiTeams)
  }
  assert.equal(ru.footer.pages['ai-team'], 'ИИ-команды')
})

test('ai teams: the index shows the live proof from the public office feed, labelled as our own', () => {
  const page = readFileSync('src/app/[locale]/ai-team/page.tsx', 'utf8')
  assert.match(page, /ProofLive/)
  assert.match(page, /t\.proof\.label/)
  assert.match(ru.aiTeams.proof.label, /наш собственный офис/)
  assert.match(en.aiTeams.proof.label, /our own office/)
})

// Every agent (role) is a product of its own (owner 2026-11-21).
const agentIds = [
  'trend-scout', 'content-maker', 'publisher', 'analyst', 'seo',
  'lead-handler', 'prospector', 'presales', 'referral',
  'support', 'monitoring', 'billing', 'onboarding',
  'project-manager', 'reviewer-qa', 'deployer',
  'documents', 'knowledge-base',
  'director',
]
const { notFoundText } = await import('../src/content/not-found.ts')

test('agents: the roles from COMPANY.md, each in an existing department, flags and links valid', () => {
  assert.deepEqual([...teams.agentIds], agentIds)
  assert.equal(new Set(agentIds).size, agentIds.length)
  for (const offer of teams.agentOffers) {
    assert.ok(teams.isAiTeamId(offer.dept), `${offer.id} dept`)
    assert.ok(teams.trustLevels.includes(offer.trust), `${offer.id} trust`)
    assert.equal(typeof offer.standalone, 'boolean')
    for (const other of offer.worksWith) {
      assert.ok(teams.isAgentId(other), `${offer.id} works with ${other}`)
      assert.notEqual(other, offer.id)
    }
    assert.match(teams.agentSource(offer.id), /^[a-z0-9_-]{1,40}$/, 'a valid lead source slug')
    assert.ok(teams.agentsOfDept(offer.dept).some((a) => a.id === offer.id))
  }
  assert.equal(teams.isAgentId('nope'), false)
  // Every department except none has at least one agent; the Director is the only one that needs a department.
  for (const dept of ids) assert.ok(teams.agentsOfDept(dept).length >= 1, dept)
  assert.deepEqual(teams.agentOffers.filter((a) => !a.standalone).map((a) => a.id), ['director'])
  assert.equal(teams.agentOffer('director').dept, 'company')
  assert.deepEqual(teams.agentPaths, agentIds.map((id) => `/ai-team/agent/${id}`))
})

test('agents: full copy in both locales, same shape, three FAQ, trust note, works-with sentence', () => {
  assert.deepEqual(shape(ru.aiTeams.agents), shape(en.aiTeams.agents))
  for (const [locale, dict] of dicts) {
    assert.deepEqual(Object.keys(dict.aiTeams.agents.items), agentIds, locale)
    for (const id of agentIds) {
      const a = dict.aiTeams.agents.items[id]
      for (const key of ['title', 'promise', 'worksNote', 'alone', 'waits', 'metaTitle', 'metaDescription'])
        assert.ok(a[key] && a[key].length >= 5, `${locale} ${id} ${key}`)
      assert.ok(a.does.length >= 3 && a.does.length <= 5, `${locale} ${id} does`)
      assert.ok(a.needs.length >= 3, `${locale} ${id} needs`)
      assert.equal(a.faq.length, 3, `${locale} ${id} faq`)
      for (const f of a.faq) assert.ok(f.q.endsWith('?') && f.a.length > 10, `${locale} ${id} faq item`)
      const m = a.metaDescription.length
      assert.ok(m >= 120 && m <= 160, `${locale} ${id} meta ${m}`)
      assert.ok(a.metaTitle.length <= 70, `${locale} ${id} title`)
    }
  }
  assert.notEqual(ru.aiTeams.agents.items.publisher.title, en.aiTeams.agents.items.publisher.title)
  // The Director is a «managing agent» and says it needs a department.
  assert.match(ru.aiTeams.agents.items.director.title, /управляющий агент/)
  assert.match(en.aiTeams.agents.items.director.title, /managing agent/)
  assert.match(ru.aiTeams.agents.items.director.worksNote, /хотя бы одна команда/)
  // Agent copy never carries digits, dollars, long dashes or exclamation marks.
  for (const [locale, dict] of dicts)
    for (const [at, text] of strings(dict.aiTeams.agents)) {
      assert.doesNotMatch(text, /\d/, `${locale} ${at}`)
      assert.doesNotMatch(text, /[$€₽]|USD|\bdollars?\b|долл/i, `${locale} ${at}`)
      assert.doesNotMatch(text, /[–—]/, `${locale} ${at}`)
      assert.doesNotMatch(text, /!/, `${locale} ${at}`)
    }
})

test('agents: pages exist, static for both locales, in the sitemap with alternates, in the 404 list and llms.txt', async () => {
  assert.ok(existsSync('src/app/[locale]/ai-team/agent/[id]/page.tsx'))
  const page = readFileSync('src/app/[locale]/ai-team/agent/[id]/page.tsx', 'utf8')
  assert.match(page, /generateStaticParams/)
  assert.match(page, /dynamicParams = false/)
  assert.match(page, /ChatOpenButton/)
  assert.doesNotMatch(page, /formatUsd|from '@\/lib\/pricing'|\$\d/)
  const urls = (await sitemap()).map((e) => e.url)
  for (const locale of ['ru', 'en'])
    for (const p of teams.agentPaths) assert.ok(urls.some((u) => u.endsWith(`/${locale}${p}`)), `${locale}${p}`)
  const one = (await sitemap()).find((e) => e.url.endsWith('/en/ai-team/agent/publisher'))
  assert.deepEqual(Object.keys(one.alternates.languages).sort(), ['en', 'ru'])
  for (const locale of ['ru', 'en']) {
    const paths = notFoundText[locale].pages.map((p) => p.path)
    for (const p of ['/ai-team', '/ai-team#agents', ...ids.map((id) => `/ai-team/${id}`), ...teams.agentPaths])
      assert.ok(paths.includes(p), `404 ${locale} ${p}`)
  }
  const { GET } = await import('../src/app/llms.txt/route.ts')
  const llms = await (await GET()).text()
  for (const p of teams.allAiTeamPaths) assert.ok(llms.includes(`/en${p}`) && llms.includes(`/ru${p}`), `llms ${p}`)
})

test('agents: the ask button opens the chat with the agent as the source (the contact form is not a page section)', () => {
  const page = readFileSync('src/app/[locale]/ai-team/agent/[id]/page.tsx', 'utf8')
  assert.match(page, /source=\{agentSource\(id\)\}/)
  assert.doesNotMatch(page, /ContactSection|#contact/)
  assert.equal(existsSync('src/components/ai-team/agent-discuss.tsx'), false)
})

test('agents: department pages list their agents and the index has the strip and the agents section', () => {
  const dept = readFileSync('src/app/[locale]/ai-team/[id]/page.tsx', 'utf8')
  assert.match(dept, /agentsOfDept\(id\)/)
  const index = readFileSync('src/app/[locale]/ai-team/page.tsx', 'utf8')
  assert.match(index, /id="agents"/)
  assert.match(index, /stripTitle/)
  for (const [, dict] of dicts) assert.ok(dict.aiTeams.agents.stripTitle && dict.aiTeams.agents.page.listTitle)
})

// Owner review 2026-11-22: headlines speak about the client's result; the department or role name sits above.
test('ai-team pages: every department and agent has a result headline in both languages, used as the h1', () => {
  for (const [locale, dict] of [['ru', ru], ['en', en]]) {
    for (const id of teams.aiTeamIds) {
      const item = dict.aiTeams.items[id]
      assert.ok(item.headline && item.headline !== item.title, `${locale} ${id}`)
    }
    for (const id of teams.agentIds) {
      const item = dict.aiTeams.agents.items[id]
      assert.ok(item.headline && item.headline !== item.title, `${locale} agent ${id}`)
    }
  }
  assert.match(readFileSync('src/app/[locale]/ai-team/[id]/page.tsx', 'utf8'), /\{page\.headline\}/)
  assert.match(readFileSync('src/app/[locale]/ai-team/agent/[id]/page.tsx', 'utf8'), /\{page\.headline\}/)
})
