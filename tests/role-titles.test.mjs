import assert from 'node:assert/strict'
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

const { ROLE_TITLES, roleTitle } = await import('../src/lib/role-titles.ts')
const { publicDemo } = await import('../src/lib/office-public.ts')

const people = (o) => [o.director, ...o.departments.flatMap((d) => [d.head, ...d.workers])]

test('ru: known ids never show the English HQ title, en keeps it', () => {
  for (const p of people(publicDemo(Date.now()))) {
    const ru = roleTitle(p.id, p.title, 'ru')
    assert.match(ru, /[А-Яа-я]/, `${p.id}: ${ru}`)
    assert.equal(roleTitle(p.id, p.title, 'en').toLowerCase(), p.title.toLowerCase())
  }
  for (const [id, v] of Object.entries(ROLE_TITLES)) {
    assert.match(v.ru, /[А-Яа-я]/, id)
    assert.doesNotMatch(v.ru, /[A-Za-z]{4,}/, id)
    assert.equal(roleTitle(id, 'whatever', 'en'), v.en)
  }
})

test('HQ titles in English map by title when the id is unknown; unknown stays as sent', () => {
  assert.equal(roleTitle('new-id', 'Lead Manager', 'ru'), 'Менеджер заявок')
  assert.equal(roleTitle('x', 'Referral Manager', 'ru'), 'Менеджер рефералов')
  assert.equal(roleTitle('x', 'Client Assistant', 'ru'), 'Ассистент клиента')
  assert.equal(roleTitle('x', 'Onboarding Manager', 'ru'), 'Менеджер онбординга')
  assert.equal(roleTitle('x', 'Head of Sales', 'ru'), 'Руководитель продаж')
  assert.equal(roleTitle('x', 'Quantum Wizard', 'ru'), 'Quantum Wizard')
  assert.equal(roleTitle('x', 'Quantum Wizard', 'en'), 'Quantum Wizard')
})
