// AI-native wave on the site (owner contract 2026-11-25): result unit per agent, handoff block, data line, hybrid FAQ.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import test from 'node:test'
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

const { getDict } = await import('../src/content/index.ts')
const { agentIds } = await import('../src/lib/ai-teams.ts')
const { estimateDoc } = await import('../src/lib/estimate-doc.ts')
const { emptyBuild } = await import('../src/lib/builder.ts')
const { startAgent } = await import('../src/lib/builder-agent.ts')

const ru = getDict('ru')
const en = getDict('en')

test('every agent has a public result unit (ru and en), shown on the card, the page header and the estimate line', () => {
  for (const [locale, dict] of [['ru', ru], ['en', en]]) {
    for (const id of agentIds) {
      const r = dict.aiTeams.agents.items[id].result
      assert.ok(typeof r === 'string' && r.includes(' = ') && r.length > 25, `${locale} ${id} result`)
      assert.doesNotMatch(r, /—|–/, `${locale} ${id}`)
    }
  }
  assert.equal(ru.aiTeams.agents.items['lead-handler'].result, 'Обработанная заявка = ответ клиенту и запись в CRM')
  assert.equal(ru.aiTeams.agents.items.support.result, 'Решённое обращение = ответ, который клиент не оспорил за 24 часа')
  assert.equal(ru.aiTeams.agents.page.resultLabel, 'Результат, за который платите')
  assert.match(readFileSync('src/components/ai-team/agent-list.tsx', 'utf8'), /copy\.result/)
  assert.match(readFileSync('src/app/[locale]/ai-team/agent/[id]/page.tsx', 'utf8'), /page\.result/)
  const doc = estimateDoc(startAgent(emptyBuild, 'support'), ru, 'ru')
  const row = doc.agents?.rows.find((r) => r.id === 'agent-support')
  assert.ok(row, 'support row in the estimate')
  assert.equal(row.detail, `Результат, за который платите: ${ru.aiTeams.agents.items.support.result}`)
})
