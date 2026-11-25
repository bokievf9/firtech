import assert from 'node:assert/strict'
import test from 'node:test'
import { getDict } from '../src/content/index.ts'
import { guaranteeLine, fillGuarantee } from '../src/lib/guarantee.ts'
import { defaultPricing } from '../src/lib/pricing.ts'
import * as edit from '../src/lib/pricing-edit.ts'
import { pricesJson } from '../src/lib/prices-json.ts'

const ru = getDict('ru')
const en = getDict('en')

test('guarantee defaults match the contract and render the fixed wording', () => {
  assert.deepEqual(defaultPricing.guarantee, { launchDays: 3, pilotDays: 14, replyShare: 95, replyMinutes: 1 })
  assert.equal(
    guaranteeLine(ru, 'ru', defaultPricing),
    'Запуск за 3 рабочих дня после оплаты первого этапа. В первые 14 дней агент отвечает на 95 % обращений за минуту, круглосуточно. Иначе возвращаем оплату первого этапа целиком.',
  )
  assert.equal(
    guaranteeLine(en, 'en', defaultPricing),
    'Launch within 3 working days after the first-stage payment. In the first 14 days the agent answers 95 % of requests within a minute, around the clock. Otherwise we refund the first stage in full.',
  )
})

test('guarantee line follows the numbers (plural forms, no leftover tokens)', () => {
  const p = { ...defaultPricing, guarantee: { launchDays: 5, pilotDays: 21, replyShare: 90, replyMinutes: 5 } }
  const line = guaranteeLine(ru, 'ru', p)
  assert.match(line, /за 5 рабочих дней/)
  assert.match(line, /90 %/)
  assert.match(line, /за 5 минут,/)
  assert.match(guaranteeLine(en, 'en', p), /within 5 working days.*first 21 days.*within 5 minutes/)
  for (const kind of ['line', 'short', 'llms']) for (const [l, d] of [['ru', ru], ['en', en]]) assert.doesNotMatch(guaranteeLine(d, l, p, kind), /\{/)
  assert.equal(fillGuarantee('{pilotIn}', 'ru', { ...defaultPricing, guarantee: { ...defaultPricing.guarantee, pilotDays: 2 } }), '2 дня')
})

test('guarantee numbers are editable, validated and served by /api/prices', () => {
  for (const k of ['launchDays', 'pilotDays', 'replyShare', 'replyMinutes']) assert.ok(edit.fieldOf(`guarantee.${k}`), k)
  assert.equal(edit.valueError('guarantee.replyShare', 100), null)
  assert.equal(edit.valueError('guarantee.replyShare', 101), 'out_of_range')
  const merged = edit.resolvePricing({ guarantee: { pilotDays: 30 } })
  assert.equal(merged.guarantee.pilotDays, 30)
  assert.equal(merged.guarantee.launchDays, 3)
  assert.equal(pricesJson(merged).guarantee.pilotDays, 30)
})

test('paid pilot: flagship block, compact agent block, source product_<id>_pilot, length from the pricing', async () => {
  const { guaranteeCtx } = await import('../src/lib/guarantee.ts')
  const { productPages } = await import('../src/content/product-pages.ts')
  assert.ok(productPages.company.sections.includes('pilot'))
  const c = guaranteeCtx(ru, 'ru', defaultPricing)
  assert.equal(c.pilot.title, 'Пилот 14 дней на ваших данных')
  assert.equal(c.pilot.cta, 'Начать пилот')
  assert.match(c.pilot.text, /^Первый этап и есть пилот: 14 дней агент работает на ваших настоящих заявках\./)
  const e = guaranteeCtx(en, 'en', { ...defaultPricing, guarantee: { ...defaultPricing.guarantee, pilotDays: 30 } })
  assert.equal(e.pilot.title, 'A 30-day pilot on your data')
  assert.equal(e.pilot.cta, 'Start the pilot')
  const { readFileSync } = await import('node:fs')
  assert.match(readFileSync('src/components/product-sections/flagship-blocks.tsx', 'utf8'), /product_\$\{ctx\.id\}_pilot/)
  assert.match(readFileSync('src/components/ai-team/agent-blocks.tsx', 'utf8'), /product_\$\{id\}_pilot/)
  assert.match(readFileSync('src/app/[locale]/ai-team/agent/[id]/page.tsx', 'utf8'), /<AgentPilot/)
})
