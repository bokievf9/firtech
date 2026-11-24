// «Языки» and «Подключаем» blocks (owner audit 2026-11-24): both locales exist, no «бот», no dashes, no digits-prices,
// the components are used where the brief says, the FAQ carries the honest answers.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
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

const copy = await import('../src/content/langs-integrations.ts')
const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')

function* strings(v) {
  if (typeof v === 'string') yield v
  else if (Array.isArray(v)) for (const x of v) yield* strings(x)
  else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* strings(x)
}

test('both blocks exist in RU and EN and are clean', () => {
  const blocks = { languages: { ...copy.languagesCopy, example: undefined }, integrations: copy.integrationsCopy }
  for (const [name, block] of Object.entries(blocks))
    for (const loc of ['ru', 'en']) {
      const texts = [...strings(block)].length
      assert.ok(texts > 0, name)
      const walk = (v) => (v && typeof v === 'object' && 'ru' in v && 'en' in v ? [v[loc]] : v && typeof v === 'object' ? Object.values(v).flatMap(walk) : [])
      const found = walk(block)
      assert.ok(found.length >= 3, `${name} ${loc}`)
      for (const t of found) {
        assert.ok(t.trim().length > 1, `${name} ${loc} empty`)
        assert.ok(!/бот/i.test(t) && !/\bbots?\b/i.test(t), `${name} ${loc} «бот»: ${t}`)
        assert.ok(!/[–—]/.test(t), `${name} ${loc} dash: ${t}`)
        assert.ok(!/\$|usd|\d{3,}/i.test(t), `${name} ${loc} price: ${t}`)
      }
    }
  assert.equal(copy.integrationIds.length, 5)
  assert.match(copy.languagesCopy.note.ru, /Узбекский, казахский и таджикский/)
  assert.match(copy.integrationsCopy.line.ru, /Подключение входит в этап запуска/)
})

test('the Uzbek example has three lines, Latin script, no prices, no dashes', () => {
  const lines = copy.languagesCopy.example
  assert.equal(lines.length, 3)
  for (const l of lines) {
    assert.ok(!/[Ѐ-ӿ]/.test(l.text), 'Latin only')
    assert.ok(!/[–—]/.test(l.text) && !/\$|\d{4,}/.test(l.text))
  }
})

test('FAQ carries the languages answer and the CRM answer mentions Sheets and Mini App', () => {
  for (const [dict, q] of [[ru, 'На каких языках работает агент?'], [en, 'Which languages does the agent speak?']]) {
    const item = dict.faq.items.find((i) => i.q === q)
    assert.ok(item, q)
    assert.ok(item.a.includes('Uzbek') || item.a.includes('Узбекский'))
  }
  for (const dict of [ru, en]) {
    const all = [...strings(dict.solutions)].filter((s) => /amoCRM or Bitrix24\. If|amoCRM или Bitrix24\. Если/.test(s))
    assert.equal(all.length, 1)
    assert.match(all[0], /Google Sheets/)
    assert.match(all[0], /Mini App/)
  }
})

test('components are wired where the brief says', () => {
  const read = (p) => readFileSync(p, 'utf8')
  const agentPage = read('src/app/[locale]/ai-team/agent/[id]/page.tsx')
  assert.match(agentPage, /<IntegrationsList/)
  assert.match(agentPage, /<LanguagesNote[^>]* example/)
  const teamPage = read('src/app/[locale]/ai-team/[id]/page.tsx')
  assert.match(teamPage, /<IntegrationsList/)
  assert.match(teamPage, /<LanguagesNote/)
  assert.doesNotMatch(teamPage, /<LanguagesNote[^>]* example/)
  const builder = read('src/components/builder-agent.tsx')
  assert.match(builder, /<IntegrationsList[^>]* compact/)
  assert.match(builder, /<LanguagesNote/)
  assert.match(read('src/components/home-agents.tsx'), /<IntegrationsList[^>]* compact/)
})
