// Content Studio (HQ section «Content», 2026-11-23): the proxy whitelist, the view models, the dev mock and the section wiring.
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
        } catch (e) {
          if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e
        }
      }
    }
    return next(specifier, context)
  },
})

const mk = await import('../src/lib/marketing-chat.ts')
const shell = await import('../src/lib/hq-shell.ts')
const { resolveEndpoint } = await import('../src/lib/hq-admin.ts')
const { createMarketingMock } = await import('../src/lib/marketing-mock.ts')
const q = (o = {}) => new URLSearchParams(o)
const NOW = Date.parse('2026-11-24T10:00:00Z')

test('a card leads to the Shell section of its kind, and HQ href is never followed', () => {
  assert.equal(mk.cardHref({ kind: 'order', id: 'o1' }), '/admin/content?tab=orders')
  assert.equal(mk.cardHref({ kind: 'plan', id: 'p1' }), '/admin/calendar')
  assert.equal(mk.cardHref({ kind: 'rule', id: 'r' }), '/admin/content?tab=rules')
  assert.equal(mk.cardHref({ kind: 'item', id: '41' }), '/admin/content?tab=feed&focus=41')
  assert.equal(mk.cardHref({ kind: 'metric', id: 'w' }), '/admin/analytics')
  assert.equal(mk.cardHref({ kind: 'campaign', id: '3' }), '/admin/content?tab=campaigns')
  const card = mk.parseCard({ kind: 'order', id: 'o1', title: 'T', href: 'https://evil.example/x' })
  assert.equal(JSON.stringify(card).includes('evil'), false)
  assert.equal(mk.parseCard({ kind: 'nope', id: 'a' }), null)
  assert.equal(mk.parseCard({ kind: 'item', id: '../x' }), null)
})

test('chips send the plain texts of the contract; a topic gets its prefix', () => {
  assert.deepEqual(mk.CHIPS.map((c) => c.text), ['План на неделю', 'Покажи правила', 'Что зашло за неделю'])
  assert.equal(mk.topicText('  бот для барбершопа '), 'Новая тема: бот для барбершопа')
})

test('normalizers: oldest first, 202 pending, rules history newest first, junk dropped', () => {
  const chat = mk.normalizeChat({ ok: true, items: [{ id: 'b', role: 'fira', text: 'B', at: '2026-11-24T10:01:00Z', cards: [{ kind: 'plan', id: 'p', title: 'P' }, { kind: 'x', id: 'q' }] }, { id: 'a', role: 'owner', text: 'A', at: '2026-11-24T10:00:00Z' }, { role: 'owner' }], rules: { version: 3, updatedAt: 'x' } })
  assert.deepEqual(chat.items.map((i) => i.id), ['a', 'b'])
  assert.equal(chat.items[1].cards.length, 1)
  assert.equal(mk.pendingDone(chat, 'b'), true)
  assert.equal(mk.pendingDone(chat, 'zz'), false)
  assert.deepEqual(mk.normalizeReply({ ok: true, pending: 'm9' }), { pending: 'm9' })
  const r = mk.normalizeReply({ ok: true, reply: { id: 'm1', text: 'Hi', cards: [] }, actions: [{ type: 'order_created', ref: 'o' }] })
  assert.equal(r.reply.role, 'fira')
  assert.deepEqual(r.actions, ['order_created'])
  assert.equal(mk.normalizeReply({ ok: true }), null)
  const rules = mk.normalizeRules({ ok: true, text: 'T', version: 2, history: [{ version: 1, at: 'a', note: 'n' }, { version: 2, at: 'b', note: 'm' }, { nope: 1 }] })
  assert.deepEqual(rules.history.map((h) => h.version), [2, 1])
  assert.equal(mk.normalizeRules({ ok: true, text: 'T' }), null)
})

test('the proxy lets every marketing route through with strict bodies', () => {
  assert.deepEqual(resolveEndpoint('GET', ['marketing', 'chat'], q({ limit: '50', before: 'm1', x: '1' }), undefined).query, { limit: '50', before: 'm1' })
  assert.equal(resolveEndpoint('POST', ['marketing', 'chat'], q(), { text: 'План на неделю' }).ok, true)
  for (const body of [{}, { text: ' ' }, { text: 'a', extra: 1 }, { text: 'a'.repeat(2001) }]) assert.equal(resolveEndpoint('POST', ['marketing', 'chat'], q(), body).ok, false, JSON.stringify(body))
  assert.equal(resolveEndpoint('GET', ['marketing', 'rules'], q(), undefined).ok, true)
  assert.equal(resolveEndpoint('PUT', ['marketing', 'rules'], q(), { text: 'Правила', note: 'n' }).ok, true)
  assert.equal(resolveEndpoint('PUT', ['marketing', 'rules'], q(), { text: '' }).ok, false)
  assert.equal(resolveEndpoint('PUT', ['marketing', 'rules'], q(), { text: 'x', version: 2 }).ok, false)
  assert.equal(resolveEndpoint('POST', ['marketing', 'rules', 'rollback'], q(), { version: 1 }).ok, true)
  assert.equal(resolveEndpoint('POST', ['marketing', 'rules', 'rollback'], q(), { version: '1' }).ok, false)
  assert.equal(resolveEndpoint('POST', ['marketing', 'plan', 'accept'], q(), { planId: 'plan_1' }).ok, true)
  assert.equal(resolveEndpoint('POST', ['marketing', 'plan', 'accept'], q(), { planId: '../x' }).ok, false)
  assert.equal(resolveEndpoint('DELETE', ['marketing', 'rules'], q(), undefined).ok, false)
  assert.equal(resolveEndpoint('GET', ['marketing', 'other'], q(), undefined).ok, false)
})

test('the dev mock answers the chips, goes 202 on a slow one, versions and rolls back the rules', () => {
  const h = createMarketingMock()
  const chat = (text, t) => h('POST', ['marketing', 'chat'], {}, { text }, t)
  assert.equal(chat('План на неделю', NOW).reply.cards[0].kind, 'plan')
  assert.equal(chat('Покажи правила', NOW).reply.cards[0].kind, 'rule')
  assert.deepEqual(chat('Что зашло за неделю', NOW).reply.cards.map((c) => c.kind), ['metric', 'item'])
  assert.equal(chat('Новая тема: кофейни', NOW).reply.cards[0].kind, 'order')
  const slow = chat('Новая тема: медленно', NOW)
  assert.ok(slow.pending)
  assert.equal(h('GET', ['marketing', 'chat'], {}, {}, NOW + 1000).items.some((i) => i.id === slow.pending), false)
  assert.equal(h('GET', ['marketing', 'chat'], {}, {}, NOW + 4000).items.some((i) => i.id === slow.pending), true)
  const r1 = h('GET', ['marketing', 'rules'], {}, {}, NOW)
  assert.equal(r1.version, 1)
  assert.equal(h('PUT', ['marketing', 'rules'], {}, { text: r1.text }, NOW).error, 'unchanged')
  const r2 = h('PUT', ['marketing', 'rules'], {}, { text: 'Новый текст', note: 'тест' }, NOW)
  assert.equal(r2.version, 2)
  const r3 = h('POST', ['marketing', 'rules', 'rollback'], {}, { version: 1 }, NOW)
  assert.equal(r3.version, 3)
  assert.equal(r3.text, r1.text)
  assert.deepEqual(r3.history.map((x) => x.version), [3, 2, 1])
  assert.equal(h('POST', ['marketing', 'rules', 'rollback'], {}, { version: 9 }, NOW).error, 'not_found')
})

test('Content has Rules and Marketing tabs, and the panel is wired into the section', () => {
  assert.ok(shell.HQ_TABS.content.includes('rules') && shell.HQ_TABS.content.includes('marketing'))
  const sectionSrc = readFileSync(new URL('../src/components/admin/hq/content-studio.tsx', import.meta.url), 'utf8')
  assert.match(sectionSrc, /MarketingPanel/)
  assert.match(sectionSrc, /MarketingRules/)
})
