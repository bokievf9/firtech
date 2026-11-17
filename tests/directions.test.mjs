import assert from 'node:assert/strict'
import { test } from 'node:test'
import ru from '../src/content/ru.ts'
import en from '../src/content/en.ts'
import { directionIds, directionPrices, directionService } from '../src/lib/directions.ts'
import { formatLead, leadSchema } from '../src/lib/lead.ts'

test('every direction has a price, a lead service and texts in both languages', () => {
  for (const id of directionIds) {
    assert.ok(directionPrices[id].from > 0, id)
    assert.ok(
      leadSchema.safeParse({ name: 'A', contact: '@abc', service: directionService[id] }).success,
      id,
    )
    for (const dict of [ru, en]) {
      const item = dict.directions.items[id]
      assert.ok(item.title && item.lines.length === 2 && item.before && item.after, id)
    }
  }
})

test('showcase texts carry no prices and no long dashes: prices come from the config', () => {
  for (const dict of [ru, en]) {
    const text = JSON.stringify([dict.directions, dict.dono, dict.region, dict.hero])
    assert.doesNotMatch(text, /\$\s?\d/)
    assert.doesNotMatch(text, /[–—]/)
  }
})

test('proposed prices from the brief', () => {
  assert.deepEqual(Object.fromEntries(directionIds.map((id) => [id, directionPrices[id].from])), {
    admin: 250,
    receptionist: 300,
    automation: 150,
    content: 60,
    miniapp: 500,
    agent: 400,
    implementation: 800,
    training: 150,
    site: 150,
  })
  assert.equal(directionPrices.receptionist.supportMonthly, 25)
  assert.equal(directionPrices.training.team, 400)
})

test('lead source: optional card id, the last row of the Telegram text', () => {
  const plain = leadSchema.parse({ name: 'A', contact: '@abc' })
  assert.equal(plain.source, '')
  assert.doesNotMatch(formatLead(plain), /Источник/)
  const lead = leadSchema.parse({ name: 'A', contact: '@abc', source: 'receptionist' })
  assert.equal(formatLead(lead).split('\n').at(-1), '<b>Источник:</b> receptionist')
  assert.equal(leadSchema.safeParse({ name: 'A', contact: '@abc', source: '<b>' }).success, false)
})
