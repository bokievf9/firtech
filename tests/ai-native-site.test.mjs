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

test('every agent page carries the «Позвать человека» block with the contract wording and an illustration', () => {
  assert.equal(ru.aiTeams.agents.page.handoff.title, 'Позвать человека')
  assert.equal(
    ru.aiTeams.agents.page.handoff.text,
    'Одна кнопка в любом чате; агент передаёт диалог с кратким резюме. Порог передачи вы задаёте сами.',
  )
  assert.equal(en.aiTeams.agents.page.handoff.title, 'Call a human')
  const page = readFileSync('src/app/[locale]/ai-team/agent/[id]/page.tsx', 'utf8')
  assert.match(page, /<AgentHandoff dict=\{dict\} \/>/)
  const block = readFileSync('src/components/ai-team/agent-blocks.tsx', 'utf8')
  assert.match(block, /data-agent-handoff/)
  assert.match(block, /role="img"/)
  assert.doesNotMatch(block, /<img|next\/image/)
})

test('data line (Singapore) on the security page, the languages block and the niche pages; hybrid-pricing FAQ entry', async () => {
  const { languagesCopy } = await import('../src/content/langs-integrations.ts')
  const line = { ru: 'Данные хранятся в Сингапуре, на одном сервере, доступ только у вас и у нас по договору.', en: 'Data is stored in Singapore on one server; only you and we have access, under the contract.' }
  assert.deepEqual(languagesCopy.dataNote, line)
  for (const [locale, dict] of [['ru', ru], ['en', en]]) {
    const where = dict.security.sections.find((s) => s.id === 'where')
    assert.equal(where.text[0], line[locale], `${locale} security`)
  }
  assert.match(readFileSync('src/components/languages-note.tsx', 'utf8'), /<DataNote locale=\{locale\} \/>/)
  assert.match(readFileSync('src/app/[locale]/solutions/[kind]/page.tsx', 'utf8'), /<DataNote locale=\{locale\}/)
  const q = ru.faq.items.find((i) => i.q === 'Почему подписка, а не оплата за каждый ответ?')
  assert.equal(
    q.a,
    'Подписка с лимитом разговоров даёт предсказуемый счёт. Оплата за результат звучит честно, но без точного определения результата превращается в спор; мы фиксируем результат словами в смете и оставляем цену понятной.',
  )
  assert.ok(en.faq.items.some((i) => i.q === 'Why a subscription and not a payment for every answer?'))
  assert.equal(ru.faq.items.length, en.faq.items.length)
})
