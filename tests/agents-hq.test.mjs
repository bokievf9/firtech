import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// HQ «Agents» (2026-11-23): normalizers, grouping, the version diff, the proxy whitelist and the dev mock (edit, rollback).
const a = await import('../src/lib/agents-hq.ts')
const mock = await import('../src/lib/agents-mock.ts')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('the list is normalized and grouped by department with the head first', () => {
  const list = a.normalizeAgentList({
    ok: true,
    departments: [{ id: 'marketing', budgetUsd: 25, monthUsd: 4 }],
    agents: [
      { id: 'content-maker', title: 'Content Maker', dept: 'marketing', role: 'worker', monthUsd: 1 },
      { id: 'marketing-head', title: 'Head of Marketing', dept: 'marketing', role: 'head', monthUsd: 2, hasFira: true },
      { id: 'director', title: 'Director', dept: 'hq', role: 'director' },
      { id: '../bad', title: 'x', dept: 'x' },
    ],
  })
  assert.equal(list.agents.length, 3)
  const g = a.groupAgents(list)
  assert.deepEqual(g.map((x) => x.dept.id), ['hq', 'marketing'])
  assert.deepEqual(g[1].agents.map((x) => x.id), ['marketing-head', 'content-maker'])
  assert.equal(g[1].dept.budgetUsd, 25)
  assert.equal(a.normalizeAgentList(null), null)
})

test('the card keeps known fields only and survives a bad body', () => {
  assert.equal(a.normalizeAgentCard({ agent: { id: 'Bad Id' } }), null)
  const c = a.normalizeAgentCard({
    agent: { id: 'seo', title: 'SEO Specialist', dept: 'marketing', role: 'worker', secret: 'x' },
    instructions: { text: 'abc', version: 2, chars: 3, versions: [{ version: 2, actor: 'owner', note: 'n', at: '2026-11-23T10:00:00.000Z', chars: 3 }, { version: 'x' }] },
    fira: { pack: 'lead-manager', title: 'ИИ-менеджер заявок', tools: ['price_list', 5] },
    history: { tasksByStatus: { done: 3 }, recentTasks: [{ id: 5, status: 'done', at: 'nope' }] },
  })
  assert.equal(c.agent.title, 'SEO Specialist')
  assert.equal('secret' in c.agent, false)
  assert.equal(c.instructions.versions.length, 2)
  assert.deepEqual(c.fira.tools, ['price_list'])
  assert.equal(c.history.recentTasks[0].at, null)
  assert.equal(c.fira.error, null)
})

test('lineDiff marks added and removed lines', () => {
  const d = a.lineDiff('one\ntwo\nthree', 'one\n2\nthree')
  assert.deepEqual(d.map((x) => x.op + x.text), [' one', '-two', '+2', ' three'])
  assert.ok(a.lineDiff('same', 'same').every((x) => x.op === ' '))
})

test('dev mock: first edit keeps the old text as v1, rollback adds a version, unchanged is refused', () => {
  const handle = mock.createAgentsMock(Date.parse('2026-11-23T08:00:00Z'))
  const now = Date.parse('2026-11-23T09:00:00Z')
  const list = handle('GET', ['agents'], {}, now)
  assert.ok(list.agents.some((x) => x.id === 'client-bot' && x.title === 'Client Assistant'))
  const before = handle('GET', ['agents', 'marketing-head'], {}, now).instructions.text
  const saved = handle('POST', ['agents', 'marketing-head', 'instructions'], { text: 'Новая', note: 'n' }, now)
  assert.equal(saved.instructions.version, 2)
  assert.deepEqual(saved.instructions.versions.map((v) => v.actor), ['owner', 'seed'])
  assert.equal(handle('POST', ['agents', 'marketing-head', 'instructions'], { text: 'Новая' }, now).error, 'unchanged')
  const back = handle('POST', ['agents', 'marketing-head', 'instructions', 'rollback'], { version: 1 }, now)
  assert.equal(back.instructions.version, 3)
  assert.equal(back.instructions.text, before)
  assert.equal(handle('POST', ['agents', 'marketing-head', 'instructions', 'rollback'], { version: 9 }, now).error, 'unknown_version')
  assert.equal(handle('GET', ['agents', 'ghost'], {}, now).error, 'not_found')
})

test('the section, page and copy are wired; no ids of clients, no empty catch, no long dashes', () => {
  assert.match(read('src/app/admin/(hq)/agents/page.tsx'), /AgentsSection/)
  const src = read('src/components/admin/hq/agents-section.tsx')
  assert.match(src, /agents\/\$\{id\}\/instructions\/rollback/)
  assert.match(src, /Pending/)
  for (const f of ['src/components/admin/hq/agents-section.tsx', 'src/lib/agents-hq.ts', 'src/lib/agents-mock.ts']) {
    assert.doesNotMatch(read(f), /catch\s*(\([^)]*\))?\s*\{\s*\}/, f)
    assert.doesNotMatch(read(f), /[–—]/, f)
  }
})
