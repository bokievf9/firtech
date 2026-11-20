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

test('tab list: the eight tabs in the owner order', () => {
  assert.deepEqual([...tabs.cabinetTabs], ['overview', 'leads', 'projects', 'invoices', 'documents', 'support', 'referrals', 'profile'])
  for (const dict of [ru, en]) {
    for (const id of tabs.cabinetTabs) assert.ok(dict.cabinet.tabs[id], id)
  }
  assert.deepEqual(
    tabs.cabinetTabs.map((id) => ru.cabinet.tabs[id]),
    ['Обзор', 'Заявки', 'Проекты', 'Счета', 'Документы', 'Поддержка', 'Рекомендации', 'Профиль'],
  )
  assert.deepEqual(
    tabs.cabinetTabs.map((id) => en.cabinet.tabs[id]),
    ['Overview', 'Requests', 'Projects', 'Invoices', 'Documents', 'Support', 'Referrals', 'Profile'],
  )
})

test('default tab: requests when there are leads or ?lead=, else the overview', () => {
  assert.equal(tabs.defaultTab({ leadCount: 0 }), 'overview')
  assert.equal(tabs.defaultTab({ leadCount: 2 }), 'leads')
  assert.equal(tabs.defaultTab({ leadCount: 0, leadParam: 'new' }), 'leads')
  assert.equal(tabs.defaultTab({ leadCount: 0, leadParam: '' }), 'overview')
  assert.equal(tabs.defaultTab({ leadCount: 0, leadParam: undefined }), 'overview')
})

test('?tab parsing falls back on anything unknown', () => {
  assert.equal(tabs.parseTab('invoices', 'overview'), 'invoices')
  assert.equal(tabs.parseTab(['support', 'profile'], 'overview'), 'support')
  assert.equal(tabs.parseTab('hack', 'leads'), 'leads')
  assert.equal(tabs.parseTab(null, 'leads'), 'leads')
  assert.equal(tabs.parseTab(undefined, 'overview'), 'overview')
  assert.equal(tabs.parseTab('__proto__', 'overview'), 'overview')
})

test('badges: open requests, unpaid invoices, open tickets; zero gives none', () => {
  assert.deepEqual(tabs.tabCounts({ leads: null, invoices: [], tickets: [] }), {})
  const counts = tabs.tabCounts({
    leads: [{ stage: 'new' }, { stage: 'proposal' }, { stage: 'project' }, { stage: 'lost' }],
    invoices: [{ status: 'issued' }, { status: 'paid' }, { status: 'void' }],
    tickets: [{ status: 'open' }, { status: 'answered' }, { status: 'open' }],
  })
  assert.deepEqual(counts, { leads: 2, invoices: 1, support: 2 })
})

test('withTab keeps other parameters and replaces the tab', () => {
  assert.equal(tabs.withTab('', 'leads'), '?tab=leads')
  assert.equal(tabs.withTab('?lead=12&follow=a.b', 'invoices'), '?lead=12&follow=a.b&tab=invoices')
  assert.equal(tabs.withTab('?tab=profile&lead=3', 'support'), '?tab=support&lead=3')
})

test('arrow keys wrap, Home and End jump, other keys do nothing', () => {
  assert.equal(tabs.tabFromKey('overview', 'ArrowRight'), 'leads')
  assert.equal(tabs.tabFromKey('profile', 'ArrowRight'), 'overview')
  assert.equal(tabs.tabFromKey('overview', 'ArrowLeft'), 'profile')
  assert.equal(tabs.tabFromKey('support', 'Home'), 'overview')
  assert.equal(tabs.tabFromKey('support', 'End'), 'profile')
  assert.equal(tabs.tabFromKey('support', 'Enter'), null)
})

test('the bar is an accessible tablist and the page uses it', () => {
  const bar = read('src/components/cabinet/cabinet-tabs.tsx')
  for (const needle of ['role="tablist"', 'role="tab"', 'role="tabpanel"', 'aria-selected', 'aria-controls', 'onKeyDown', 'border-accent']) {
    assert.ok(bar.includes(needle), needle)
  }
  const page = read('src/app/[locale]/cabinet/page.tsx')
  assert.match(page, /<CabinetTabs/)
  assert.match(page, /defaultTab\(\{ leadCount/)
  // Only the active panel is mounted, so the leads refresh stops with its tab.
  assert.match(bar, /id === tab &&/)
})

test('the cabinet label for a signed-out visitor: RU «Личный кабинет», EN «Get started»', () => {
  assert.equal(ru.nav.cabinetStart, 'Личный кабинет')
  assert.equal(en.nav.cabinetStart, 'Get started')
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
