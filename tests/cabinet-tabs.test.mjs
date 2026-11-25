// Cabinet tabs (2026-11-21): tab list, default tab, badges, ?tab parsing, keys, copy and call sites.
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

const tabs = await import('../src/lib/cabinet-tabs.ts')
const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const read = (f) => readFileSync(path.resolve(f), 'utf8')

test('tab list (v3): projects, documents, messages, materials, referrals, profile', () => {
  assert.deepEqual([...tabs.cabinetTabs], ['projects', 'documents', 'messages', 'materials', 'referrals', 'profile'])
  for (const dict of [ru, en]) {
    for (const id of tabs.cabinetTabs) assert.ok(dict.cabinet.tabs[id], id)
    for (const gone of ['overview', 'leads', 'invoices', 'support']) assert.equal(gone in dict.cabinet.tabs, false, gone)
  }
  assert.deepEqual(tabs.cabinetTabs.map((id) => ru.cabinet.tabs[id]), ['Проекты', 'Документы', 'Сообщения', 'Материалы', 'Рекомендации', 'Профиль'])
  assert.deepEqual(tabs.cabinetTabs.map((id) => en.cabinet.tabs[id]), ['Projects', 'Documents', 'Messages', 'Materials', 'Referrals', 'Profile'])
})

test('the «Ваш агент» tab is gone: ?tab=agent opens the messages', () => {
  assert.equal(tabs.cabinetTabs.includes('agent'), false)
  assert.deepEqual(tabs.visibleTabs(), ['projects', 'documents', 'messages', 'materials', 'referrals', 'profile'])
  assert.equal(tabs.parseTab('agent', 'projects', tabs.visibleTabs()), 'messages')
})

test('the first screen is always the project', () => {
  assert.equal(tabs.defaultTab(), 'projects')
})

test('?tab parsing: legacy names map to the new tabs, anything unknown falls back', () => {
  assert.equal(tabs.parseTab('documents', 'projects'), 'documents')
  assert.equal(tabs.parseTab(['messages', 'profile'], 'projects'), 'messages')
  assert.equal(tabs.parseTab('overview', 'profile'), 'projects')
  assert.equal(tabs.parseTab('leads', 'profile'), 'projects')
  assert.equal(tabs.parseTab('invoices', 'projects'), 'documents')
  assert.equal(tabs.parseTab('support', 'projects'), 'messages')
  assert.equal(tabs.parseTab('hack', 'projects'), 'projects')
  assert.equal(tabs.parseTab(null, 'projects'), 'projects')
  assert.equal(tabs.parseTab(undefined, 'projects'), 'projects')
  assert.equal(tabs.parseTab('__proto__', 'projects'), 'projects')
  assert.equal(tabs.parseTab('constructor', 'projects'), 'projects')
})

test('badges: documents that wait for the client and unread messages; zero gives none', () => {
  assert.deepEqual(tabs.tabCounts({ docsNeedingClient: 0, unread: 0 }), {})
  assert.deepEqual(tabs.tabCounts({ docsNeedingClient: 2, unread: 0 }), { documents: 2 })
  assert.deepEqual(tabs.tabCounts({ docsNeedingClient: 1, unread: 5 }), { documents: 1, messages: 5 })
  assert.equal(tabs.isOpenLead({ stage: 'proposal' }), true)
  assert.equal(tabs.isOpenLead({ stage: 'project' }), false)
})

test('withTab keeps other parameters, replaces the tab and drops the other tab\'s parameters', () => {
  assert.equal(tabs.withTab('', 'documents'), '?tab=documents')
  assert.equal(tabs.withTab('?lead=12&follow=a.b', 'messages'), '?lead=12&follow=a.b&tab=messages')
  assert.equal(tabs.withTab('?tab=profile&lead=3', 'projects'), '?tab=projects&lead=3')
  assert.equal(tabs.withTab('?tab=documents&doc=q-14', 'messages', { ref: 'lead-14' }), '?tab=messages&ref=lead-14')
  assert.equal(tabs.withTab('', 'documents', { doc: 'c-2' }), '?tab=documents&doc=c-2')
  assert.equal(tabs.withTab('?doc=x', 'documents', { doc: null }), '?tab=documents')
})

test('arrow keys wrap over the visible tabs, Home and End jump, other keys do nothing', () => {
  assert.equal(tabs.tabFromKey('projects', 'ArrowRight'), 'documents')
  assert.equal(tabs.tabFromKey('profile', 'ArrowRight'), 'projects')
  assert.equal(tabs.tabFromKey('projects', 'ArrowLeft'), 'profile')
  assert.equal(tabs.tabFromKey('documents', 'Home'), 'projects')
  assert.equal(tabs.tabFromKey('documents', 'End'), 'profile')
  assert.equal(tabs.tabFromKey('documents', 'Enter'), null)
  assert.equal(tabs.tabFromKey('messages', 'ArrowRight', tabs.visibleTabs()), 'materials')
  assert.equal(tabs.tabFromKey('agent', 'ArrowRight', tabs.visibleTabs()), null)
})

test('the bar is an accessible tablist, polls the unread badge, and the page uses it', () => {
  const bar = read('src/components/cabinet/cabinet-tabs.tsx')
  for (const needle of ['nav-capsule', 'role="tablist"', 'role="tab"', 'tabId(\'cabinet\'', 'role="tabpanel"', 'aria-labelledby', '/api/cabinet/threads', 'COUNTS_EVENT']) {
    assert.ok(bar.includes(needle), needle)
  }
  const page = read('src/app/[locale]/cabinet/page.tsx')
  assert.match(page, /<CabinetTabs/)
  assert.match(page, /tabs=\{view\.tabs\}/)
  // Only the active panel is mounted, so a panel's own refresh stops with its tab.
  assert.match(bar, /id === tab &&/)
})

test('the cabinet label for a signed-out visitor: RU «Личный кабинет», EN «Client area»', () => {
  assert.equal(ru.nav.cabinetStart, 'Личный кабинет')
  assert.equal(en.nav.cabinetStart, 'Client area')
})

test('the Google button carries the four-colour G', () => {
  const mark = read('src/components/cabinet/google-mark.tsx')
  for (const colour of ['#4285F4', '#34A853', '#FBBC05', '#EA4335']) assert.ok(mark.includes(colour), colour)
  assert.match(mark, /aria-hidden="true"/)
  assert.match(mark, /width=\{size\}/)
  const button = read('src/components/cabinet/oauth-button.tsx')
  assert.match(button, /<GoogleMark \/>/)
  assert.match(button, /t\.redirecting/)
})
