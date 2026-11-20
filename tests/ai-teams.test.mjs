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
  for (const [, dict] of dicts) assert.equal(Object.keys(dict).at(-1), 'aiTeams')
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

test('ai teams: no price anywhere, the quote pattern and the delivery note are in the copy', () => {
  for (const [, dict] of dicts) {
    assert.ok(dict.aiTeams.quote && dict.aiTeams.quoteNote)
    assert.match(dict.aiTeams.page.delivery, /HQ/)
  }
  assert.equal(ru.aiTeams.quote, 'По смете')
  assert.equal(ru.aiTeams.ctaDiscuss, 'Обсудить')
  const files = [
    'src/app/[locale]/ai-team/page.tsx',
    'src/app/[locale]/ai-team/[id]/page.tsx',
    'src/components/ai-team/team-parts.tsx',
    'src/lib/ai-teams.ts',
  ]
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    assert.doesNotMatch(text, /formatUsd|from '@\/lib\/pricing'|\$\d/, file)
  }
})

test('ai teams: the builder link opens with the aiteam product picked', () => {
  const href = teams.aiTeamBuilderHref('ru')
  assert.match(href, /^\/ru\/builder\?b=/)
  const build = decodeBuild(new URL(href, 'https://x.test').searchParams.get('b'))
  assert.ok(build.products.includes('aiteam'))
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
    assert.equal(dict.footer.pages['ai-team'], dict.aiTeams.nav)
  }
  assert.equal(ru.footer.pages['ai-team'], 'Отдел из ИИ-агентов')
})

test('ai teams: the index shows the live proof from the public office feed, labelled as our own', () => {
  const page = readFileSync('src/app/[locale]/ai-team/page.tsx', 'utf8')
  assert.match(page, /ProofLive/)
  assert.match(page, /t\.proof\.label/)
  assert.match(ru.aiTeams.proof.label, /наш собственный офис/)
  assert.match(en.aiTeams.proof.label, /our own office/)
})
