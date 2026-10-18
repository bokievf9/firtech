import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as v from '../src/lib/pulse-view.ts'

const task = (id, status, priority = 'normal', due = null, project = 'firtech') => ({
  id,
  project,
  title: id,
  status,
  priority,
  due,
  notes: '',
  source: 'ui',
  createdAt: `2026-10-18T0${id.length}:00:00Z`,
  updatedAt: '2026-10-18T00:00:00Z',
  doneAt: null,
})

test('blocked tasks come first, done last, then priority and due date', () => {
  const sorted = v.sortTasks([
    task('a', 'done', 'high'),
    task('b', 'todo', 'low'),
    task('c', 'todo', 'high', '2026-10-20'),
    task('d', 'todo', 'high', '2026-10-19'),
    task('e', 'doing', 'low'),
    task('f', 'blocked', 'low'),
  ])
  assert.deepEqual(
    sorted.map((t) => t.id),
    ['f', 'e', 'd', 'c', 'b', 'a'],
  )
})

test('next open tasks skip done and other projects, blocked count is per project', () => {
  const list = [
    task('a', 'done'),
    task('b', 'blocked'),
    task('c', 'todo'),
    task('d', 'todo', 'normal', null, 'vibely'),
    task('e', 'todo', 'low'),
    task('f', 'doing'),
  ]
  assert.deepEqual(
    v.nextOpenTasks(list, 'firtech', 3).map((t) => t.id),
    ['b', 'f', 'c'],
  )
  assert.equal(v.blockedCount(list, 'firtech'), 1)
  assert.equal(v.blockedCount(list, 'vibely'), 0)
  assert.equal(v.openCount(list, 'firtech'), 4)
})

test('status cycles todo, doing, blocked, done and back', () => {
  assert.equal(v.nextStatus('todo'), 'doing')
  assert.equal(v.nextStatus('doing'), 'blocked')
  assert.equal(v.nextStatus('blocked'), 'done')
  assert.equal(v.nextStatus('done'), 'todo')
})

test('progress averages goals; "all" goals belong to tools; none gives null', () => {
  const goals = [
    { project: 'vibely', progress: 80 },
    { project: 'firtech', progress: 70 },
    { project: 'firtech', progress: 30 },
    { project: 'all', progress: 75 },
  ]
  assert.equal(v.projectProgress(goals, 'firtech'), 50)
  assert.equal(v.projectProgress(goals, 'vibely'), 80)
  assert.equal(v.projectProgress(goals, 'tools'), 75)
  assert.equal(v.projectProgress(goals, 'instagram'), null)
})

test('due state compares with today', () => {
  assert.equal(v.dueState(null, '2026-10-18'), 'none')
  assert.equal(v.dueState('2026-10-17', '2026-10-18'), 'overdue')
  assert.equal(v.dueState('2026-10-18', '2026-10-18'), 'today')
  assert.equal(v.dueState('2026-10-19', '2026-10-18'), 'later')
  assert.equal(v.shortDate('2026-10-19'), '19.10')
})

test('instagram: next unpublished in calendar order, trend skips empty days', () => {
  const item = (id, date, time, published = false) => ({ id, date, time, published })
  const next = v.nextIgItems(
    [
      item('c', '2026-10-20', '10:00'),
      item('a', '2026-10-19', '12:00', true),
      item('b', '2026-10-19', '10:00'),
      item('d', '2026-10-21', '10:00'),
    ],
    2,
  )
  assert.deepEqual(
    next.map((i) => i.id),
    ['b', 'c'],
  )
  const days = [
    { date: '2026-10-18', followers: 120, reach: null },
    { date: '2026-10-16', followers: 100, reach: 40 },
    { date: '2026-10-17', followers: null, reach: 55 },
  ]
  assert.deepEqual(v.trendSeries(days, 'followers'), [100, 120])
  assert.deepEqual(v.trendSeries(days, 'reach'), [40, 55])
  assert.deepEqual(v.trendSummary([100, 120]), { last: 120, delta: 20 })
  assert.deepEqual(v.trendSummary([]), { last: null, delta: null })
  assert.equal(v.barPercent(1, 100), 4)
  assert.equal(v.barPercent(0, 5), 0)
})
