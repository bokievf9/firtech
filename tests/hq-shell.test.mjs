import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'

// HQ phase 1 (docs/pult.md «HQ»): section list, tabs, links from old panels, no «Пульт» in admin texts.
const s = await import('../src/lib/hq-shell.ts')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('sections: seventeen English names in four groups, all built, keys 1-9', () => {
  assert.deepEqual(s.HQ_SECTIONS.map((x) => x.label), ['Inbox', 'Approvals', 'Tasks', 'Calendar', 'Chats', 'Clients', 'Projects', 'Documents', 'Finance', 'Content', 'Agents', 'Processes', 'Knowledge', 'Settings', 'Quality', 'Audit log', 'Analytics'])
  assert.deepEqual(s.HQ_SECTIONS.filter((x) => x.state === 'ready').map((x) => x.id), s.HQ_SECTIONS.map((x) => x.id))
  assert.deepEqual(s.HQ_GROUPS.map((g) => g.label), ['Work', 'Clients', 'Company', 'Control'])
  const byGroup = (g) => s.HQ_SECTIONS.filter((x) => x.group === g).map((x) => x.id)
  assert.deepEqual(byGroup('work'), ['inbox', 'approvals', 'tasks', 'calendar', 'chats'])
  assert.deepEqual(byGroup('clients'), ['clients', 'projects', 'documents', 'finance'])
  assert.deepEqual(byGroup('company'), ['content', 'agents', 'processes', 'knowledge', 'settings'])
  assert.deepEqual(byGroup('control'), ['quality', 'audit', 'analytics'])
  assert.ok(!s.HQ_SECTIONS.some((x) => x.id === 'campaigns'))
  assert.equal(s.sectionForKey('1').id, 'inbox')
  assert.equal(s.sectionForKey('9').id, 'finance')
  assert.equal(s.sectionForKey('0'), null)
  assert.equal(s.sectionForKey('10'), null)
  for (const x of s.HQ_SECTIONS.filter((x) => x.state === 'soon')) assert.ok(x.legacy.startsWith('/admin/office?panel='), x.id)
})

test('no duplicate tabs: payments only in Finance, campaigns inside Content, no calendar tab', () => {
  assert.deepEqual(s.HQ_TABS.projects, ['projects'])
  assert.deepEqual(s.HQ_TABS.finance, ['invoices', 'payments', 'costs'])
  assert.deepEqual(s.HQ_TABS.content, ['feed', 'orders', 'campaigns'])
  assert.equal(s.sectionTab('content', 'calendar'), 'feed')
  assert.equal(s.sectionTab('projects', 'payments'), 'projects')
  assert.match(read('src/app/admin/(hq)/campaigns/page.tsx'), /redirect\('\/admin\/content\?tab=campaigns'\)/)
  assert.match(read('src/app/admin/(hq)/projects/page.tsx'), /redirect\(`\/admin\/finance/)
})

test('tabs fall back to the first one', () => {
  assert.equal(s.sectionTab('clients', 'calls'), 'calls')
  assert.equal(s.sectionTab('clients', 'nope'), 'pipeline')
  assert.equal(s.sectionTab('projects', null), 'projects')
})

test('hqHref sends built panels to HQ and the rest to the office', () => {
  assert.equal(s.hqHref('sales', 'leads', '12'), '/admin/clients?tab=pipeline&focus=12')
  assert.equal(s.hqHref('production', 'projects', '3'), '/admin/projects?tab=projects&focus=3')
  assert.equal(s.hqHref('backoffice', 'invoices', 'F-1'), '/admin/finance?tab=invoices&focus=F-1')
  assert.equal(s.hqHref('backoffice', 'payments', 'F-1'), '/admin/finance?tab=payments&focus=F-1')
  assert.equal(s.hqHref('support', 'tickets', '5'), '/admin/office?panel=support&tab=tickets&focus=5')
  assert.equal(s.hqHref('marketing'), '/admin/office?panel=marketing')
})

test('pages exist, the old office stays, /admin opens HQ, no «Пульт» in admin texts', () => {
  for (const p of ['inbox', 'approvals', 'chats', 'review', 'golive', 'clients', 'projects', 'tasks', 'calendar', 'documents', 'agents', 'processes', 'content', 'finance', 'settings', 'audit', 'analytics', 'knowledge', 'quality', '[section]']) assert.ok(existsSync(new URL(`../src/app/admin/(hq)/${p}/page.tsx`, import.meta.url)), p)
  assert.ok(existsSync(new URL('../src/app/admin/office/page.tsx', import.meta.url)))
  assert.match(read('src/app/admin/page.tsx'), /redirect\('\/admin\/inbox'\)/)
  const text = read('src/content/admin.ts').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  assert.doesNotMatch(text, /[Пп]ульт/)
  assert.doesNotMatch(read('src/content/golive.ts'), /[Пп]ульт/)
})

test('the workplace is called Shell: no «HQ» in visible admin copy', () => {
  const code = (f) => read(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  for (const f of ['src/content/admin.ts', 'src/content/golive.ts', 'src/lib/doc-editor.ts', 'src/lib/pricing-edit.ts']) assert.doesNotMatch(code(f), /\bHQ\b/, f)
  for (const p of ['inbox', 'clients', 'settings', 'agents', '[section]']) {
    const t = read(`src/app/admin/(hq)/${p}/page.tsx`)
    assert.match(t, /Shell · /, p)
    assert.doesNotMatch(t, /HQ ·/, p)
  }
})

test('HQ components have no empty catch and no long dashes', () => {
  for (const f of ['src/components/admin/hq/hq-shell.tsx', 'src/components/admin/hq/finance-view.tsx', 'src/lib/finance.ts', 'src/components/admin/hq/processes-view.tsx', 'src/lib/processes.ts', 'src/components/admin/hq/sections.tsx', 'src/components/admin/hq/section-view.tsx', 'src/components/admin/hq/content-studio.tsx', 'src/components/admin/hq/agents-section.tsx', 'src/lib/agents-hq.ts', 'src/lib/agents-mock.ts', 'src/components/admin/hq/settings-section.tsx', 'src/lib/settings-hq.ts', 'src/lib/settings-mock.ts', 'src/components/admin/hq/inbox-approvals.tsx', 'src/lib/hq-shell.ts', 'src/components/admin/hq/knowledge-section.tsx', 'src/components/admin/hq/quality-section.tsx', 'src/components/admin/hq/kq-ui.tsx', 'src/lib/knowledge-hq.ts', 'src/lib/quality-hq.ts', 'src/lib/knowledge-mock.ts']) {
    const t = read(f)
    assert.doesNotMatch(t, /catch\s*(\([^)]*\))?\s*\{\s*\}/, f)
    assert.doesNotMatch(t, /[–—]/, f)
  }
})
