import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'

// HQ phase 1 (docs/pult.md «HQ»): section list, tabs, links from old panels, no «Пульт» in admin texts.
const s = await import('../src/lib/hq-shell.ts')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('sections: thirteen English names, four built, keys 1-9', () => {
  assert.deepEqual(s.HQ_SECTIONS.map((x) => x.label), ['Inbox', 'Approvals', 'Tasks', 'Calendar', 'Chats', 'Clients', 'Projects', 'Documents', 'Agents', 'Processes', 'Content', 'Finance', 'Settings'])
  assert.deepEqual(s.HQ_SECTIONS.filter((x) => x.state === 'ready').map((x) => x.id), ['inbox', 'clients', 'projects', 'documents'])
  assert.equal(s.sectionForKey('1').id, 'inbox')
  assert.equal(s.sectionForKey('9').id, 'agents')
  assert.equal(s.sectionForKey('0'), null)
  assert.equal(s.sectionForKey('10'), null)
  for (const x of s.HQ_SECTIONS.filter((x) => x.state === 'soon')) assert.ok(x.legacy.startsWith('/admin/office?panel='), x.id)
})

test('tabs fall back to the first one', () => {
  assert.equal(s.sectionTab('clients', 'calls'), 'calls')
  assert.equal(s.sectionTab('clients', 'nope'), 'pipeline')
  assert.equal(s.sectionTab('projects', null), 'projects')
})

test('hqHref sends built panels to HQ and the rest to the office', () => {
  assert.equal(s.hqHref('sales', 'leads', '12'), '/admin/clients?tab=pipeline&focus=12')
  assert.equal(s.hqHref('production', 'projects', '3'), '/admin/projects?tab=projects&focus=3')
  assert.equal(s.hqHref('backoffice', 'invoices', 'F-1'), '/admin/projects?tab=payments&focus=F-1')
  assert.equal(s.hqHref('support', 'tickets', '5'), '/admin/office?panel=support&tab=tickets&focus=5')
  assert.equal(s.hqHref('marketing'), '/admin/office?panel=marketing')
})

test('pages exist, the old office stays, /admin opens HQ, no «Пульт» in admin texts', () => {
  for (const p of ['inbox', 'clients', 'projects', 'documents', '[section]']) assert.ok(existsSync(new URL(`../src/app/admin/(hq)/${p}/page.tsx`, import.meta.url)), p)
  assert.ok(existsSync(new URL('../src/app/admin/office/page.tsx', import.meta.url)))
  assert.match(read('src/app/admin/page.tsx'), /redirect\('\/admin\/inbox'\)/)
  const text = read('src/content/admin.ts').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  assert.doesNotMatch(text, /[Пп]ульт/)
  assert.doesNotMatch(read('src/content/golive.ts'), /[Пп]ульт/)
})

test('HQ components have no empty catch and no long dashes', () => {
  for (const f of ['src/components/admin/hq/hq-shell.tsx', 'src/components/admin/hq/sections.tsx', 'src/components/admin/hq/section-view.tsx', 'src/components/admin/hq/use-approvals.ts', 'src/lib/hq-shell.ts']) {
    const t = read(f)
    assert.doesNotMatch(t, /catch\s*(\([^)]*\))?\s*\{\s*\}/, f)
    assert.doesNotMatch(t, /[–—]/, f)
  }
})
