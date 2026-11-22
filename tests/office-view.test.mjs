import assert from 'node:assert/strict'
import { test } from 'node:test'
import { officeMock } from '../src/lib/office-mock.ts'
import * as v from '../src/lib/office-view.ts'

test('every contract status maps to a chip; only working breathes', () => {
  const all = ['working', 'waiting', 'blocked', 'idle', 'sleeping', 'paused', 'offline']
  for (const s of all) {
    const chip = v.statusChip(s)
    assert.equal(chip.status, s)
    assert.equal(chip.breathing, s === 'working')
  }
  assert.equal(v.statusChip('working').tone, 'live')
  assert.equal(v.statusChip('blocked').tone, 'bad')
})

test('an unknown status is shown as offline', () => {
  assert.deepEqual(v.statusChip('on-fire'), { status: 'offline', tone: 'ghost', breathing: false })
})

test('minutes since, never negative, null for bad input', () => {
  const now = Date.parse('2026-11-19T12:00:00Z')
  assert.equal(v.minutesSince('2026-11-19T11:55:30Z', now), 4)
  assert.equal(v.minutesSince('2026-11-19T12:05:00Z', now), 0)
  assert.equal(v.minutesSince(null, now), null)
  assert.equal(v.minutesSince('nope', now), null)
})

test('duration and data age formatting', () => {
  assert.equal(v.formatDuration(0), 'under a minute')
  assert.equal(v.formatDuration(5), '5 min')
  assert.equal(v.formatDuration(130), '2 h 10 min')
  assert.equal(v.formatDuration(120), '2 h')
  assert.equal(v.formatDuration(60 * 49), '2 d')
  assert.equal(v.formatDataAge(7), '7 s')
  assert.equal(v.formatDataAge(125), '2 min')
})

test('Tashkent clock is UTC+5', () => {
  assert.equal(v.formatClock(Date.parse('2026-11-19T18:40:00Z'), 'Asia/Tashkent'), '23:40')
  assert.equal(v.formatClock(0, 'Not/AZone'), '--:--')
})

test('countdown to the next run', () => {
  const now = Date.parse('2026-11-19T12:00:00Z')
  assert.equal(v.formatUntil('2026-11-19T15:05:00Z', now), 'in 3 h 5 min')
  assert.equal(v.formatUntil('2026-11-19T11:00:00Z', now), 'now')
  assert.equal(v.formatUntil(null, now), '')
})

test('activity is newest first and capped at 40', () => {
  const rows = Array.from({ length: 55 }, (_, i) => ({
    at: new Date(Date.UTC(2026, 10, 19, 0, i)).toISOString(),
    agent: 'a',
    action: 'x',
    object: String(i),
  }))
  const out = v.capActivity(rows)
  assert.equal(out.length, v.ACTIVITY_CAP)
  assert.equal(out[0].object, '54')
})

test('the mock satisfies the contract check and has the five departments', () => {
  const m = officeMock()
  assert.ok(v.looksLikeOffice(m))
  assert.deepEqual(
    m.departments.map((d) => d.id),
    ['marketing', 'sales', 'support', 'production', 'back-office'],
  )
  assert.equal(v.looksLikeOffice({ ok: true }), false)
  assert.equal(v.looksLikeOffice(null), false)
})
