// Copy leftovers (2026-11-25): owner rules over the ru/en dictionaries and the two docs.
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

const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')

// The legacy /pay/[number] page keeps USDT until HQ stops crypto invoices: its own `pay` block is exempt.
// The persona id 'founder' (a entrepreneur persona of the day-by-hour demo) is an id, not copy.
const strip = (d) => JSON.stringify({ ...d, pay: undefined }).replaceAll('"id":"founder"', '')
const docs = ['docs/sales-playbook-site.md', 'docs/products-contract.md'].map((f) => [f, readFileSync(f, 'utf8')])

test('no founder wording in client-facing copy', () => {
  assert.doesNotMatch(strip(ru), /основател/i)
  assert.doesNotMatch(strip(en), /founder/i)
  for (const [f, t] of docs) assert.doesNotMatch(t, /основател/i, f)
})

test('no crypto or USDT outside the legacy pay block and docs', () => {
  for (const d of [ru, en]) assert.doesNotMatch(strip(d), /usdt|crypto|криптовалют|\bкрипто/i)
  for (const [f, t] of docs) assert.doesNotMatch(t, /usdt|crypto|криптовалют|\bкрипто/i, f)
})

test('the manager is never round-the-clock; the agent is', () => {
  const bad = /менеджер[а-я]* (отвечает|ответ)[^.]{0,60}круглосуточ|круглосуточ[^.]{0,40}менеджер|первый ответ[^.]{0,30}круглосуточ|manager replies[^.]{0,60}(24\/7|around the clock)/i
  assert.doesNotMatch(strip(ru), bad)
  assert.doesNotMatch(strip(en), bad)
  for (const [f, t] of docs) {
    for (const line of t.split('\n')) if (/5 минут/.test(line)) assert.doesNotMatch(line, /5 минут,? круглосуточно/, f)
  }
  assert.match(readFileSync('src/content/golive.ts', 'utf8'), /первый ответ менеджера за 5 минут в рабочее время/)
})

test('no free trials or free pilots promised (owner 2026-11-25: «бесплатных пилотов нет»)', () => {
  assert.doesNotMatch(strip(ru), /бесплатн[а-я]+ пробн|пробный период|пилот[а-я]* бесплатно|бесплатн[а-я]+ пилот/i)
  assert.doesNotMatch(strip(en), /free trial|free pilot/i)
})
