import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// '@/...' for plain Node (same mapping as processes.test.mjs).
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

// HQ «Tasks» and «Calendar» (2026-11-23): filters, view model, grid, links, whitelist, dev mock, texts.
const cal = await import('../src/lib/calendar.ts')
const tk = await import('../src/lib/tasks-hq.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const shell = await import('../src/lib/hq-shell.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

const task = (id, over = {}) => ({
  id, title: `Задача ${id}`, dept: 'marketing', status: 'running', assigneeId: 'content-maker', assigneeTitle: 'Content Maker', priority: null, dueAt: null,
  createdAt: '2026-11-23T08:00:00.000Z', updatedAt: '2026-11-23T09:00:00.000Z', tags: [], progressLine: null, lastEvent: null, ...over,
})

test('tasks: status filter by board column, cancelled apart', () => {
  const items = [task(1), task(2, { status: 'blocked' }), task(3, { status: 'done' }), task(4, { status: 'cancelled' }), task(5, { status: 'weird' })]
  assert.equal(tk.filterByStatus(items, 'all').length, 5)
  assert.deepEqual(tk.filterByStatus(items, 'running').map((t) => t.id), [1])
  assert.deepEqual(tk.filterByStatus(items, 'blocked').map((t) => t.id), [2])
  assert.deepEqual(tk.filterByStatus(items, 'cancelled').map((t) => t.id), [4])
  // an unknown status waits in the inbox column, never disappears
  assert.deepEqual(tk.filterByStatus(items, 'inbox').map((t) => t.id), [5])
})

test('tasks: departments and agents options, agents limited by department', () => {
  const items = [task(1), task(2, { dept: 'sales', assigneeId: 'lead-intake', assigneeTitle: 'Lead Handler' }), task(3, { assigneeId: null, assigneeTitle: null }), task(4, { dept: 'sales', assigneeId: 'lead-intake', assigneeTitle: 'Lead Handler' })]
  assert.deepEqual(tk.taskDepts(items), ['marketing', 'sales'])
  assert.deepEqual(tk.agentOptions(items, '').map((a) => a.id), ['content-maker', 'lead-intake'])
  assert.deepEqual(tk.agentOptions(items, 'sales'), [{ id: 'lead-intake', title: 'Lead Handler' }])
  assert.equal(tk.plainFirst(['<b>Готово</b>']), 'Готово')
  assert.equal(tk.plainFirst([]), null)
})

test('calendar: normalizer keeps known fields, drops junk, fills the company day', () => {
  const data = cal.normalizeCalendar({
    ok: true, from: '2026-11-23', to: '2026-11-29', tz: 'Asia/Tashkent', today: '2026-11-24',
    events: [
      { id: 'call:1', kind: 'call', at: '2026-11-23T20:30:00.000Z', allDay: false, title: 'Анна', detail: 'bot', dept: 'sales', status: 'confirmed', link: 'calls:7', evil: '<x>' },
      { id: 'content:2', kind: 'content', at: '2026-11-24T00:00:00.000Z', allDay: true, title: 'Рилс', link: 'content:item:2' },
      { id: 'bad:1', kind: 'nope', at: '2026-11-24T00:00:00.000Z' },
      { id: 'bad:2', kind: 'call', at: 'not a date' },
      { kind: 'call', at: '2026-11-24T00:00:00.000Z' },
    ],
  })
  assert.ok(data)
  assert.equal(data.events.length, 2)
  assert.equal(data.events[0].evil, undefined)
  // 20:30 UTC is already the next day in Tashkent (UTC+5)
  assert.equal(data.events[0].day, '2026-11-24')
  assert.deepEqual(data.counts, { call: 1, milestone: 0, routine: 0, content: 1 })
  assert.equal(cal.normalizeCalendar({ ok: true, from: 'x', to: 'y', events: [] }), null)
  assert.equal(cal.normalizeCalendar({ ok: true, from: '2026-11-23', to: '2026-11-29' }), null)
})

test('calendar: week starts on Monday, month grid is whole weeks, shifts and ranges', () => {
  assert.equal(cal.weekStart('2026-11-23'), '2026-11-23') // a Monday
  assert.equal(cal.weekStart('2026-11-29'), '2026-11-23') // the Sunday after
  assert.deepEqual(cal.gridDays('week', '2026-11-25'), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'])
  const month = cal.gridDays('month', '2026-11-15')
  assert.equal(month.length % 7, 0)
  assert.equal(month[0], cal.weekStart('2026-11-01'))
  assert.ok(month.includes('2026-11-01') && month.includes('2026-11-30'))
  assert.ok(month.length <= 42)
  assert.equal(cal.addMonths('2026-12-15', 1), '2027-01-01')
  assert.equal(cal.shiftAnchor('week', '2026-11-23', -1), '2026-11-16')
  assert.equal(cal.shiftAnchor('month', '2026-01-31', 1), '2026-02-01')
  const r = cal.rangeOf(month)
  assert.ok(Date.parse(r.to) - Date.parse(r.from) <= 41 * 86_400_000)
})

test('calendar: events group by day, kind filter, all-day first', () => {
  const data = cal.normalizeCalendar({
    ok: true, from: '2026-11-23', to: '2026-11-29', tz: 'UTC',
    events: [
      { id: 'a', kind: 'call', at: '2026-11-23T10:00:00.000Z', title: 'A' },
      { id: 'b', kind: 'content', at: '2026-11-23T00:00:00.000Z', allDay: true, title: 'B' },
      { id: 'c', kind: 'routine', at: '2026-11-23T06:00:00.000Z', title: 'C' },
    ],
  })
  const all = cal.eventsByDay(data.events, new Set(cal.CALENDAR_KINDS))
  assert.deepEqual(all.get('2026-11-23').map((e) => e.id), ['b', 'c', 'a'])
  const calls = cal.eventsByDay(data.events, new Set(['call']))
  assert.deepEqual(calls.get('2026-11-23').map((e) => e.id), ['a'])
})

test('calendar: links go to the HQ section that holds the object', () => {
  assert.equal(cal.calendarHref('calls:7'), '/admin/clients?tab=calls&focus=7')
  assert.equal(cal.calendarHref('projects:2'), '/admin/projects?tab=projects&focus=2')
  assert.equal(cal.calendarHref('content:item:5'), '/admin/content?tab=feed&focus=5')
  assert.equal(cal.calendarHref('routines:marketing-daily-today'), '/admin/office?panel=company&tab=company')
  assert.equal(cal.calendarHref('evil:1'), null)
  assert.equal(cal.calendarHref('calls:<script>'), null)
  assert.equal(cal.calendarHref(''), null)
})

test('whitelist: GET calendar with from and to only, nothing else', () => {
  const r = (method, segs, query = {}) => proxy.resolveEndpoint(method, segs, new URLSearchParams(query), undefined)
  const ok = r('GET', ['calendar'], { from: '2026-11-23', to: '2026-11-29', evil: '1' })
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.query, { from: '2026-11-23', to: '2026-11-29' })
  assert.equal(r('POST', ['calendar']).ok, false)
  assert.equal(r('GET', ['calendar', 'x']).ok, false)
})

test('dev mock: a week and a month in the contract shape, bad range refused', () => {
  const T0 = Date.parse('2026-11-23T10:00:00Z')
  const mock = createHqMock(T0)
  const week = cal.normalizeCalendar(mock('GET', 'calendar', { from: '2026-11-23', to: '2026-11-29' }, {}, T0))
  assert.ok(week)
  for (const k of cal.CALENDAR_KINDS) assert.ok(week.counts[k] > 0, k)
  assert.ok(week.events.every((e) => e.day >= '2026-11-23' && e.day <= '2026-11-29'))
  assert.ok(week.events.every((e) => cal.calendarHref(e.link)), 'every mock event links somewhere')
  const month = cal.normalizeCalendar(mock('GET', 'calendar', { from: '2026-11-02', to: '2026-12-06' }, {}, T0))
  assert.ok(month.events.length > week.events.length)
  assert.equal(mock('GET', 'calendar', { from: '2026-01-01', to: '2026-12-31' }, {}, T0).ok, false)
  assert.equal(mock('GET', 'calendar', { from: 'x', to: 'y' }, {}, T0).ok, false)
})

test('Tasks and Calendar are built sections with their own pages', () => {
  for (const id of ['tasks', 'calendar']) {
    const s = shell.sectionById(id)
    assert.equal(s.state, 'ready')
    assert.equal(shell.isSoonSection(id), false)
    assert.match(read(`src/app/admin/(hq)/${id}/page.tsx`), /export default/)
  }
  assert.match(read('src/components/admin/hq/tasks-section.tsx'), /Assignments/)
  assert.match(read('src/components/admin/hq/tasks-section.tsx'), /TaskDrawer/)
})

test('texts: no «Пульт», no long dashes, no empty catch in the new files', () => {
  for (const f of ['src/components/admin/hq/tasks-section.tsx', 'src/components/admin/hq/calendar-view.tsx', 'src/lib/calendar.ts', 'src/lib/tasks-hq.ts', 'src/app/admin/(hq)/tasks/page.tsx', 'src/app/admin/(hq)/calendar/page.tsx']) {
    const t = read(f)
    assert.doesNotMatch(t, /catch\s*(\([^)]*\))?\s*\{\s*\}/, f)
    assert.doesNotMatch(t, /[–—]/, f)
  }
  const texts = read('src/content/admin.ts').match(/\n    tasks: \{\n      filters[\s\S]*?\n    sectionHints/)[0]
  assert.doesNotMatch(texts, /[Пп]ульт|[–—]/)
})
