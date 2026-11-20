import assert from 'node:assert/strict'
import { test } from 'node:test'
import { goliveItems, goliveBlocks, goliveText } from '../src/content/golive.ts'
import {
  agoText,
  applyAction,
  chipText,
  emptyGolive,
  groupItems,
  parseAction,
  progress,
  remaining,
  sanitize,
} from '../src/lib/golive.ts'

const T0 = Date.parse('2026-11-21T10:00:00Z')

test('remaining: splits the time left into hours, minutes, seconds (no days)', () => {
  const deadline = new Date(T0 + (2 * 86400 + 13 * 3600 + 42 * 60 + 7) * 1000).toISOString()
  const r = remaining(deadline, T0)
  assert.deepEqual([r.hours, r.minutes, r.seconds, r.over], [61, 42, 7, false])
  assert.equal(chipText(r), '61:42:07')
})

test('remaining: 2 days 3 h reads as 51 h, a fresh 72 h timer as 72:00:00', () => {
  const r = remaining(new Date(T0 + (2 * 86400 + 3 * 3600) * 1000).toISOString(), T0)
  assert.equal(r.hours, 51)
  assert.equal(chipText(r), '51:00:00')
  assert.equal(chipText(remaining(new Date(T0 + 72 * 3600_000).toISOString(), T0)), '72:00:00')
  assert.equal(chipText(remaining(new Date(T0 + 72 * 3600_000 - 2000).toISOString(), T0)), '71:59:58')
  assert.equal(agoText(remaining(new Date(T0 - (2 * 86400 + 4 * 3600) * 1000).toISOString(), T0)), '2 д 4 ч')
})

test('remaining: not started and over', () => {
  assert.equal(remaining(null, T0).over, false)
  assert.equal(remaining('garbage', T0).totalMs, 0)
  const r = remaining(new Date(T0 - 3 * 3600_000 - 5 * 60_000).toISOString(), T0)
  assert.equal(r.over, true)
  assert.ok(r.totalMs < 0)
  assert.equal(agoText(r), '3 ч 05 мин')
  assert.equal(remaining(new Date(T0).toISOString(), T0).over, true)
})

test('start sets the deadline 72 hours ahead by default', () => {
  const s = applyAction(emptyGolive(), { action: 'start' }, T0)
  assert.equal(Date.parse(s.deadline) - T0, 72 * 3600_000)
  assert.equal(s.startedAt, new Date(T0).toISOString())
  const s5 = applyAction(emptyGolive(), { action: 'start', hours: 5 }, T0)
  assert.equal(Date.parse(s5.deadline) - T0, 5 * 3600_000)
})

test('reset clears the timer and keeps the ticks; toggle and note work', () => {
  let s = applyAction(emptyGolive(), { action: 'start' }, T0)
  s = applyAction(s, { action: 'toggle', id: 'site-copy', done: true }, T0)
  s = applyAction(s, { action: 'note', id: 'site-copy', text: '  ок  ' }, T0)
  assert.equal(s.notes['site-copy'], 'ок')
  s = applyAction(s, { action: 'reset' }, T0)
  assert.equal(s.deadline, null)
  assert.ok(s.done['site-copy'])
  s = applyAction(s, { action: 'toggle', id: 'site-copy', done: false }, T0)
  s = applyAction(s, { action: 'note', id: 'site-copy', text: '' }, T0)
  assert.deepEqual([s.done, s.notes], [{}, {}])
})

test('progress and groups', () => {
  const done = { 'site-copy': 'x', 'site-seo': 'x' }
  const p = progress(goliveItems, done)
  assert.equal(p.done, 2)
  assert.equal(p.total, goliveItems.length)
  assert.equal(p.percent, Math.round((2 / goliveItems.length) * 100))
  const groups = groupItems(goliveItems, done)
  assert.equal(groups.length, goliveBlocks.length)
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), goliveItems.length)
  assert.equal(groups[0].progress.done, 2)
  assert.deepEqual(progress([], {}), { done: 0, total: 0, percent: 0 })
})

test('parseAction accepts only known actions, ids and short notes', () => {
  assert.deepEqual(parseAction({ action: 'start' }), { action: 'start' })
  assert.equal(parseAction({ action: 'start', hours: 0 }), null)
  assert.equal(parseAction({ action: 'start', hours: '72' }), null)
  assert.equal(parseAction({ action: 'toggle', id: 'nope', done: true }), null)
  assert.equal(parseAction({ action: 'toggle', id: 'site-copy', done: 'yes' }), null)
  assert.ok(parseAction({ action: 'note', id: 'site-copy', text: 'a'.repeat(300) }))
  assert.equal(parseAction({ action: 'note', id: 'site-copy', text: 'a'.repeat(301) }), null)
  assert.equal(parseAction(null), null)
  assert.equal(parseAction({ action: 'drop' }), null)
})

test('sanitize drops unknown ids, bad dates and long notes', () => {
  const s = sanitize({
    deadline: 'nope',
    done: { 'site-copy': '2026-11-21T10:00:00Z', ghost: '2026-11-21T10:00:00Z', 'site-seo': 'bad' },
    notes: { 'site-copy': 'x'.repeat(500), ghost: 'y' },
  })
  assert.equal(s.deadline, null)
  assert.deepEqual(Object.keys(s.done), ['site-copy'])
  assert.equal(s.notes['site-copy'].length, 300)
  assert.equal(s.notes.ghost, undefined)
})

test('checklist data: unique ids, known blocks, no long dashes', () => {
  const ids = goliveItems.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length)
  const blocks = new Set(goliveBlocks.map((b) => b.id))
  for (const i of goliveItems) {
    assert.ok(blocks.has(i.block), i.id)
    assert.ok(['owner', 'claude'].includes(i.owner))
  }
  const text = JSON.stringify([goliveItems, goliveText])
  assert.ok(!/[–—]/.test(text))
})

// ---- full-screen page (2026-11-21) ----
import { existsSync, readFileSync } from 'node:fs'

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('go-live list is 41 items in 8 blocks, every item in a known block', () => {
  assert.equal(goliveItems.length, 41)
  assert.equal(goliveBlocks.length, 8)
  const blocks = new Set(goliveBlocks.map((b) => b.id))
  for (const i of goliveItems) assert.ok(blocks.has(i.block), i.id)
  assert.equal(new Set(goliveItems.map((i) => i.id)).size, 41)
})

test('/admin/golive exists, checks the admin session and renders the stage', () => {
  assert.ok(existsSync(new URL('../src/app/admin/golive/page.tsx', import.meta.url)))
  const page = src('src/app/admin/golive/page.tsx')
  assert.match(page, /requireAdmin\(\)/)
  assert.match(page, /GolivePage/)
  const stage = src('src/components/admin/golive/golive-page.tsx')
  assert.match(stage, /href="\/admin\/office"/)
  assert.match(stage, /ThemeToggle/)
  assert.match(stage, /useReducedMotion/)
})

test('the chip, key 8 and the palette open the page; the old side panel is gone', () => {
  const hub = src('src/components/admin/hub/hub.tsx')
  assert.match(hub, /router\.push\('\/admin\/golive'\)/)
  assert.doesNotMatch(hub, /goliveOpen|GolivePanel/)
  const chip = src('src/components/admin/hub/golive.tsx')
  assert.match(chip, /href="\/admin\/golive"/)
  assert.doesNotMatch(chip, /GolivePanel/)
})

test('the shader is capped (dpr 1.5, 30 fps) and the loops stop on hidden tabs', () => {
  const gl = src('src/components/admin/golive/golive-gl.ts')
  assert.match(gl, /MAX_DPR = 1\.5/)
  assert.match(gl, /FRAME_MS = 1000 \/ 30/)
  const field = src('src/components/admin/golive/stage-field.tsx')
  assert.match(field, /visibilitychange/)
  assert.match(field, /IntersectionObserver/)
})
