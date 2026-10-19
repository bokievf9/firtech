import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as t from '../src/lib/pulse-today.ts'
import { funnelSteps, plural } from '../src/lib/pulse-view.ts'

let seq = 0
const task = (status, due = null, extra = {}) => ({
  id: `t${++seq}`,
  project: 'firtech',
  title: `task ${seq}`,
  status,
  priority: 'normal',
  due,
  notes: '',
  source: 'ui',
  createdAt: `2026-10-1${seq % 10}T00:00:00Z`,
  updatedAt: '2026-10-18T00:00:00Z',
  doneAt: null,
  ...extra,
})
const ig = (id, date, time, published = false) => ({
  id,
  date,
  time,
  kind: 'post',
  title: id,
  folder: null,
  note: '',
  published,
  publishedAt: null,
})

// 2026-10-19 09:14 in Dushanbe is 04:14 UTC.
const NOW = Date.parse('2026-10-19T04:14:00Z')

test('day keys follow Dushanbe (UTC+5), including the day boundary', () => {
  assert.equal(t.dushanbeKey(Date.parse('2026-10-18T18:59:59Z')), '2026-10-18')
  assert.equal(t.dushanbeKey(Date.parse('2026-10-18T19:00:00Z')), '2026-10-19')
  assert.equal(t.dushanbeKey(Date.parse('2026-10-19T18:59:00Z')), '2026-10-19')
  assert.equal(t.dushanbeClock(Date.parse('2026-10-18T19:05:00Z')), '00:05')
  assert.equal(t.dushanbeClock(NOW), '09:14')
})

test('addDays crosses month and year ends', () => {
  assert.equal(t.addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(t.addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(t.addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(t.tomorrowOf('2026-10-19'), '2026-10-20')
})

test('week runs Monday to Sunday and a Sunday belongs to the week that ends on it', () => {
  assert.deepEqual(t.weekDays('2026-10-19'), [
    '2026-10-19',
    '2026-10-20',
    '2026-10-21',
    '2026-10-22',
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
  ])
  assert.equal(t.weekDays('2026-10-25')[0], '2026-10-19')
  assert.equal(t.weekDays('2026-10-25')[6], '2026-10-25')
  assert.equal(t.weekDays('2026-10-21')[0], '2026-10-19')
})

test('weekItems keeps published items of this week only, in calendar order', () => {
  const items = [
    ig('late', '2026-10-25', '11:00'),
    ig('old', '2026-10-18', '10:00', true),
    ig('b', '2026-10-19', '18:00'),
    ig('a', '2026-10-19', '10:00', true),
    ig('next', '2026-10-26', '10:00'),
  ]
  assert.deepEqual(
    t.weekItems(items, '2026-10-19').map((i) => i.id),
    ['a', 'b', 'late'],
  )
})

test('decisions: overdue first, then today, then waiting without a date; later dates are left out', () => {
  const today = '2026-10-19'
  const list = [
    task('blocked', null, { id: 'wait' }),
    task('todo', today, { id: 'today' }),
    task('blocked', '2026-10-18', { id: 'late' }),
    task('blocked', '2026-10-20', { id: 'tomorrow' }),
    task('todo', null, { id: 'plain' }),
    task('done', '2026-10-17', { id: 'done' }),
    task('doing', '2026-10-10', { id: 'older' }),
  ]
  assert.deepEqual(
    t.decisionsToday(list, today).map((d) => `${d.task.id}:${d.reason}`),
    ['late:overdue', 'older:overdue', 'today:today', 'wait:waiting'],
  )
})

test('decisions: inside a group blocked and high priority come first', () => {
  const today = '2026-10-19'
  const list = [
    task('todo', today, { id: 'a', priority: 'high' }),
    task('blocked', today, { id: 'b', priority: 'low' }),
    task('blocked', today, { id: 'c', priority: 'high' }),
  ]
  assert.deepEqual(
    t.decisionsToday(list, today).map((d) => d.task.id),
    ['c', 'b', 'a'],
  )
})

test('decisions: postponing to tomorrow takes a waiting task off today', () => {
  const list = [task('blocked', '2026-10-19', { id: 'x' })]
  assert.equal(t.decisionsToday(list, '2026-10-19').length, 1)
  list[0] = { ...list[0], due: '2026-10-20' }
  assert.equal(t.decisionsToday(list, '2026-10-19').length, 0)
  // and the next day it is back, as overdue or today
  assert.equal(t.decisionsToday(list, '2026-10-20')[0]?.reason, 'today')
})

test('decisions and attention with nothing at all', () => {
  assert.deepEqual(t.decisionsToday([], '2026-10-19'), [])
  const a = t.attention([], [], 0, '2026-10-19')
  assert.equal(a.decisions, 0)
  assert.equal(a.overdue, 0)
  assert.equal(a.firstOverdue, null)
  assert.equal(a.publishToday, 0)
  assert.equal(a.today, 0)
  assert.deepEqual(a.decisionProjects, [])
})

test('attention counts waiting tasks per project, the oldest overdue one and unpublished posts', () => {
  const today = '2026-10-19'
  const list = [
    task('blocked', null, { project: 'vibely' }),
    task('blocked', '2026-10-18', { project: 'vibely', id: 'v1' }),
    task('blocked', null, { project: 'firtech' }),
    task('blocked', null, { project: 'firtech' }),
    task('blocked', null, { project: 'firtech' }),
    task('todo', '2026-10-15', { id: 'oldest' }),
    task('done', '2026-10-10'),
  ]
  const items = [
    ig('p1', today, '10:00', true),
    ig('p2', today, '18:00'),
    ig('p3', '2026-10-20', '10:00'),
  ]
  const a = t.attention(list, items, 2, today)
  assert.equal(a.decisions, 5)
  assert.deepEqual(a.decisionProjects, [
    { project: 'firtech', count: 3 },
    { project: 'vibely', count: 2 },
  ])
  assert.equal(a.overdue, 2)
  assert.equal(a.firstOverdue?.id, 'oldest')
  assert.equal(a.stale, 2)
  assert.equal(a.publishToday, 1)
})

test('timeline: timed entries by the clock, all day tasks last, marker at the current time', () => {
  const items = [
    ig('late', '2026-10-19', '18:00'),
    ig('early', '2026-10-19', '08:00', true),
    ig('tom', '2026-10-20', '09:00'),
  ]
  const calls = [
    { id: 1, name: 'A', slot: '2026-10-19T09:00:00Z', state: 'confirmed' }, // 14:00
    { id: 2, name: 'B', slot: '2026-10-20T09:00:00Z', state: 'pending' }, // tomorrow
  ]
  const tasks = [task('todo', '2026-10-19', { id: 'day' }), task('todo', '2026-10-20')]
  const tl = t.dayTimeline({ items, calls, tasks, now: NOW })
  assert.deepEqual(
    tl.entries.map((e) => `${e.time ?? 'all'}:${e.kind}`),
    ['08:00:ig', '14:00:call', '18:00:ig', 'all:task'],
  )
  assert.equal(tl.nowIndex, 1) // 09:14: the 08:00 post is behind, the 14:00 call is ahead
  assert.equal(tl.entries[0].done, true)
})

test('timeline: marker after all timed entries late in the day, empty day is empty', () => {
  const items = [ig('a', '2026-10-19', '10:00')]
  const evening = Date.parse('2026-10-19T16:30:00Z') // 21:30
  const tasks = [task('todo', '2026-10-19')]
  const tl = t.dayTimeline({ items, calls: [], tasks, now: evening })
  assert.equal(tl.nowIndex, 1)
  assert.equal(tl.entries.length, 2)
  const empty = t.dayTimeline({ items: [], calls: [], tasks: [], now: NOW })
  assert.deepEqual(empty, { entries: [], nowIndex: 0 })
})

test('timeline: a call at 00:30 Dushanbe belongs to that Dushanbe day, not the UTC one', () => {
  const now = Date.parse('2026-10-18T19:10:00Z') // 00:10 on the 19th in Dushanbe
  const calls = [{ id: 7, name: 'N', slot: '2026-10-18T19:30:00Z', state: 'confirmed' }]
  const tl = t.dayTimeline({ items: [], calls, tasks: [], now })
  assert.equal(tl.entries.length, 1)
  assert.equal(tl.entries[0].time, '00:30')
  assert.equal(tl.nowIndex, 0)
})

test('stamp and dayPart use Dushanbe time', () => {
  assert.equal(t.stamp('2026-10-18T19:05:00Z'), '19.10 00:05')
  assert.equal(t.stamp('nope'), '')
  assert.equal(t.dayPart(Date.parse('2026-10-18T22:00:00Z')), 'night') // 03:00
  assert.equal(t.dayPart(NOW), 'morning')
  assert.equal(t.dayPart(Date.parse('2026-10-19T08:00:00Z')), 'day') // 13:00
  assert.equal(t.dayPart(Date.parse('2026-10-19T14:00:00Z')), 'evening') // 19:00
})

test('plural picks the Russian form', () => {
  const f = ['решение', 'решения', 'решений']
  assert.deepEqual(
    [1, 2, 5, 11, 12, 21, 22, 25, 0].map((n) => plural(n, f)),
    [
      'решение',
      'решения',
      'решений',
      'решений',
      'решений',
      'решение',
      'решения',
      'решений',
      'решений',
    ],
  )
})

test('funnel steps: later statuses count for earlier steps, conversion is deals over all', () => {
  const r = funnelSteps({ new: 4, taken: 2, called: 2, won: 2, lost: 2 })
  assert.deepEqual(r.steps, { came: 12, taken: 6, called: 4, won: 2 })
  assert.equal(r.lost, 2)
  assert.equal(r.fresh, 4)
  assert.equal(r.conversion, 17)
  assert.deepEqual(funnelSteps({}).steps, { came: 0, taken: 0, called: 0, won: 0 })
  assert.equal(funnelSteps({}).conversion, 0)
})

test('todayCounts: decisions (blocked) and deadlines are counted apart, one source for both views', () => {
  const today = '2026-10-19'
  const list = [
    task('blocked', null, { project: 'vibely' }),
    task('blocked', '2026-10-18', { project: 'vibely' }),
    task('todo', today),
    task('doing', '2026-10-15'),
    task('blocked', '2026-10-25'), // waiting but later: not for today
    task('todo', '2026-10-25'),
    task('done', today),
  ]
  const c = t.todayCounts(list, today)
  assert.equal(c.decisions, 2)
  assert.equal(c.deadlines, 2)
  assert.deepEqual(c.decisionProjects, [{ project: 'vibely', count: 2 }])
  const a = t.attention(list, [], 0, today)
  assert.equal(a.decisions, c.decisions)
  assert.equal(a.deadlines, c.deadlines)
  assert.equal(a.today, c.decisions + c.deadlines)
  assert.deepEqual(t.todayCounts([], today), { decisions: 0, deadlines: 0, decisionProjects: [] })
})

test('timeline: tasks already shown in "decide today" are skipped', () => {
  const a = task('todo', '2026-10-19')
  const b = task('todo', '2026-10-19')
  const tl = t.dayTimeline({ items: [], calls: [], tasks: [a, b], now: NOW, skip: new Set([a.id]) })
  assert.deepEqual(
    tl.entries.map((e) => e.key),
    [`task-${b.id}`],
  )
})
