import assert from 'node:assert/strict'
import { test } from 'node:test'
import { directionIds, directionService } from '../src/lib/directions.ts'
import { formatLead, leadSchema } from '../src/lib/lead.ts'

test('every direction maps to a valid lead service', () => {
  for (const id of directionIds) {
    assert.ok(
      leadSchema.safeParse({ name: 'A', contact: '@abc', service: directionService[id] }).success,
      id,
    )
  }
})

test('lead source: optional card id, the last row of the Telegram text', () => {
  const plain = leadSchema.parse({ name: 'A', contact: '@abc' })
  assert.equal(plain.source, '')
  assert.doesNotMatch(formatLead(plain), /Источник/)
  const lead = leadSchema.parse({ name: 'A', contact: '@abc', source: 'receptionist' })
  assert.equal(formatLead(lead).split('\n').at(-1), '<b>Источник:</b> receptionist')
  assert.equal(leadSchema.safeParse({ name: 'A', contact: '@abc', source: '<b>' }).success, false)
})
