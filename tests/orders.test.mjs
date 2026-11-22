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

const o = await import('../src/lib/orders.ts')
const p = await import('../src/lib/shell.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')

const T0 = Date.parse('2026-11-22T10:00:00Z')
const iso = (m) => new Date(T0 - m * 60_000).toISOString()
const task = (id, title, status, min, extra = {}) => ({
  id, title, dept: 'marketing', status, assigneeId: 'a1', assigneeTitle: 'Контент-мейкер', priority: null, dueAt: null,
  createdAt: iso(min + 5), updatedAt: iso(min), tags: [], progressLine: null, lastEvent: null, ...extra,
})
const tasks = [
  task(1, 'Пост про бота', 'running', 10),
  task(2, 'Договор для Sadaf', 'approval', 30, { dept: 'back-office', assigneeId: 'a2', assigneeTitle: 'Документы' }),
  task(3, 'Отчёт недели', 'done', 60),
  task(4, 'Статья про сайт', 'blocked', 90, { tags: ['от владельца'] }),
  task(5, 'Старая задача', 'cancelled', 120),
  task(6, 'Клип', 'inbox', 5),
]
const msg = (id, role, text, min, taskId) => ({ id, role, text, at: iso(min), ...(taskId !== undefined ? { taskId } : {}) })

test('sendOf: a /command runs, free text becomes a task through say, blanks do nothing', () => {
  assert.deepEqual(o.sendOf('/status'), { kind: 'command', name: 'status', arg: '' })
  assert.deepEqual(o.sendOf('  /retry 15 '), { kind: 'command', name: 'retry', arg: '15' })
  assert.deepEqual(o.sendOf('Сделай пост про бота'), { kind: 'say', text: 'Сделай пост про бота' })
  assert.deepEqual(o.sendOf('Привет\nвторая строка'), { kind: 'say', text: 'Привет\nвторая строка' })
  assert.equal(o.sendOf('   '), null)
})

test('suggestCommands: autocomplete by prefix first, then by word, only while the command is being typed', () => {
  assert.deepEqual(o.suggestCommands('/st').map((c) => c.name), ['status', 'costs'], 'prefix first, then a match inside')
  assert.deepEqual(o.suggestCommands('/sta').map((c) => c.name), ['status'])
  assert.ok(o.suggestCommands('/').length >= 8, 'a bare slash lists commands')
  assert.equal(o.suggestCommands('/').length, 8)
  assert.deepEqual(o.suggestCommands('/zzz'), [])
  assert.deepEqual(o.suggestCommands('status'), [])
  assert.deepEqual(o.suggestCommands('/retry 5'), [], 'an argument is being typed')
  assert.equal(o.suggestCommands('/пауза').length, 0)
  assert.equal(o.completeCommand(o.DIRECTOR_COMMANDS[0]), '/status ')
  // Every suggested command is one the proxy lets through.
  for (const c of o.DIRECTOR_COMMANDS) assert.equal(proxy.resolveEndpoint('POST', ['command'], new URLSearchParams(), { name: c.name }).ok, true, c.name)
})

test('buildTimeline: tasks and chat in one list, newest first, a task replaces the message that made it', () => {
  const messages = [
    msg('m1', 'me', 'Сделай клип про бота', 6),
    msg('m2', 'director', 'Принял. Задача #6 ушла в маркетинг.', 5, 6),
    msg('m3', 'me', '/status', 3),
    msg('m4', 'director', 'Задач открыто: 4', 2),
  ]
  const all = o.buildTimeline(tasks, messages, { filter: 'all', query: '' })
  assert.deepEqual(all.map((e) => e.key), ['mm4', 'mm3', 't6', 't1', 't2', 't3', 't4', 't5'])
  const t6 = all.find((e) => e.key === 't6')
  assert.deepEqual(t6.replies, ['Принял. Задача #6 ушла в маркетинг.'])
  assert.equal(t6.mine, true)
  assert.ok(!all.some((e) => e.key === 'mm1' || e.key === 'mm2'), 'the line that made task 6 is not repeated')
  assert.equal(all.find((e) => e.key === 't5').column, 'gone')
})

test('buildTimeline filters: mine, waiting for me, done; chat only in all and mine', () => {
  const messages = [msg('m1', 'me', 'Сделай клип', 6), msg('m2', 'director', 'Принял', 5, 6), msg('m3', 'me', '/costs', 3)]
  const mine = o.buildTimeline(tasks, messages, { filter: 'mine', query: '' })
  assert.deepEqual(mine.filter((e) => e.kind === 'task').map((e) => e.task.id).sort(), [4, 6], 'by the composer and by the owner tag')
  assert.ok(mine.some((e) => e.kind === 'me'), 'my commands stay')
  const waiting = o.buildTimeline(tasks, messages, { filter: 'waiting', query: '' })
  assert.deepEqual(waiting.map((e) => e.task.id).sort(), [2, 4])
  const done = o.buildTimeline(tasks, messages, { filter: 'done', query: '' })
  assert.deepEqual(done.map((e) => e.task.id), [3])
  assert.ok(done.every((e) => e.kind === 'task'))
})

test('buildTimeline search and person filter', () => {
  const messages = [msg('m1', 'me', 'Покажи расходы', 3), msg('m2', 'director', 'Расходы за месяц: $12', 2)]
  assert.deepEqual(o.buildTimeline(tasks, messages, { filter: 'all', query: 'договор' }).map((e) => e.key), ['t2'])
  assert.deepEqual(o.buildTimeline(tasks, messages, { filter: 'all', query: 'расходы' }).map((e) => e.key), ['mm2', 'mm1'])
  assert.deepEqual(o.buildTimeline(tasks, messages, { filter: 'all', query: '#4' }).map((e) => e.key), ['t4'])
  assert.deepEqual(o.buildTimeline(tasks, messages, { filter: 'all', query: 'документы' }).map((e) => e.key), ['t2'], 'by assignee')
  const person = o.buildTimeline(tasks, messages, { filter: 'all', query: '', person: { assigneeId: 'a2' } })
  assert.deepEqual(person.map((e) => e.key), ['t2'], 'one person: only their tasks, no chat')
  assert.deepEqual(o.buildTimeline(null, [], { filter: 'all', query: '' }), [])
})

test('orderCounts and orderActions', () => {
  const messages = [msg('m2', 'director', 'Принял', 5, 6)]
  assert.deepEqual(o.orderCounts(tasks, messages), { all: 5, mine: 2, waiting: 2, done: 1 })
  assert.deepEqual(o.orderCounts(null, []), { all: 0, mine: 0, waiting: 0, done: 0 })
  assert.deepEqual(o.orderActions({ status: 'running' }), ['remind', 'cancel'])
  assert.deepEqual(o.orderActions({ status: 'blocked' }), ['start', 'remind', 'cancel'])
  assert.deepEqual(o.orderActions({ status: 'inbox' }), ['start', 'remind', 'cancel'])
  assert.deepEqual(o.orderActions({ status: 'done' }), [])
  assert.deepEqual(o.orderActions({ status: 'cancelled' }), [])
  assert.equal(o.cancelText({ id: 12, title: 'Пост' }), 'Отмени поручение #12: Пост')
  assert.equal(o.remindText({ id: 12, title: 'Пост' }), 'Напомни мне про поручение #12: Пост')
})

test('director tabs: Поручения replaces tasks and chat, old tab names still resolve', () => {
  assert.deepEqual(p.PANEL_TABS.director, ['inbox', 'tasks', 'documents', 'feed', 'drill'])
  assert.equal(p.panelTab('director', 'chat'), 'tasks')
  assert.equal(p.panelTab('director', 'approvals'), 'tasks', 'the old Одобрения tab is a section of Поручения')
  assert.equal(p.panelTab('director', 'documents'), 'documents')
  assert.equal(p.panelTab('director', 'tasks'), 'tasks')
  assert.equal(p.panelTab('director', 'nope'), 'inbox')
  assert.equal(p.panelTab('sales', undefined), 'leads')
})

test('mock: say makes a task the timeline shows; cancel and reminder words are understood', () => {
  const mock = createHqMock(T0)
  const say = (text) => mock('POST', 'say', {}, { text }, T0)
  const before = mock('GET', 'tasks', { limit: '300' }, {}, T0).items.length
  const r = say('Подготовь КП для салона Нигины')
  assert.equal(r.ok, true)
  assert.ok(r.taskId)
  const after = mock('GET', 'tasks', { limit: '300' }, {}, T0).items
  assert.equal(after.length, before + 1)
  const made = after.find((t) => t.id === r.taskId)
  assert.ok(made.tags.includes('от владельца'))
  const entries = o.buildTimeline(after, [{ id: 'a', role: 'me', text: 'x', at: iso(1) }, { id: 'b', role: 'director', text: r.replies[0], at: iso(0), taskId: r.taskId }], { filter: 'mine', query: '' })
  assert.ok(entries.some((e) => e.kind === 'task' && e.task.id === r.taskId))
  const c = say(o.cancelText(made))
  assert.equal(c.ok, true)
  assert.equal(c.taskId, undefined, 'cancelling does not make a new task')
  assert.equal(mock('GET', `tasks/${r.taskId}`, {}, {}, T0).task.status, 'cancelled')
  const rem = say(o.remindText(after[0]))
  assert.equal(rem.taskId, undefined)
  assert.equal(mock('GET', 'tasks', { limit: '300' }, {}, T0).items.length, before + 1)
})

test('buildTimeline: the Director\'s lines before the one that carries the task id join the task card', () => {
  const messages = [
    msg('m1', 'me', 'Сделай клип про бота', 6),
    msg('m2', 'director', 'Принял. Задача #6 ушла в маркетинг.', 5),
    msg('m3', 'director', 'Напишу, когда будет результат.', 5, 6),
    msg('m4', 'me', '/status', 3),
  ]
  const all = o.buildTimeline(tasks, messages, { filter: 'all', query: '' })
  assert.deepEqual(all.map((e) => e.key).filter((k) => k !== 't1' && k !== 't2' && k !== 't3' && k !== 't4' && k !== 't5'), ['mm4', 't6'])
  assert.deepEqual(all.find((e) => e.key === 't6').replies, ['Принял. Задача #6 ушла в маркетинг.', 'Напишу, когда будет результат.'])
  // The task is filtered out of the list: its lines stay as plain chat.
  const person = o.buildTimeline(tasks, messages, { filter: 'all', query: '', person: { dept: 'back-office' } })
  assert.deepEqual(person.map((e) => e.key), ['t2'])
})

test('Director history: GET director/history is whitelisted, normalized and merged under this tab\'s own lines', async () => {
  const v = await import('../src/lib/hq-admin-view.ts')
  const m = createHqMock(T0)
  assert.equal(proxy.resolveEndpoint('GET', ['director', 'history'], new URLSearchParams('limit=100'), null).ok, true)
  assert.equal(proxy.resolveEndpoint('POST', ['director', 'history'], new URLSearchParams(), {}).ok, false)
  assert.equal(m('GET', 'director/history', { limit: '0' }, {}, T0).error, 'invalid')
  const seeded = v.normalizeDirectorHistory(m('GET', 'director/history', { limit: '100' }, {}, T0))
  assert.equal(seeded.length, 2)
  assert.deepEqual(seeded.map((x) => x.role), ['me', 'director'])
  // say and command append lines newest last, the reply that made a task carries its id
  const said = m('POST', 'say', {}, { text: 'Подготовь КП для салона' }, T0)
  m('POST', 'command', {}, { name: 'status' }, T0)
  const items = m('GET', 'director/history', { limit: '100' }, {}, T0).items
  assert.deepEqual(items.map((x) => x.role).slice(2, 4), ['owner', 'hq'])
  assert.equal(items.find((x) => x.taskId !== null).taskId, said.taskId)
  assert.ok(items.at(-1).id > items[0].id && items.some((x) => x.role === 'command' && x.text === '/status'))
  // merge: lines the server has are not repeated, newer local lines stay, a cleared tab hides old server lines
  const server = v.normalizeDirectorHistory({ items: [
    { id: 1, at: iso(10), role: 'owner', text: 'Сделай клип', taskId: null },
    { id: 2, at: iso(10), role: 'hq', text: '<b>Принял.</b>', taskId: 6 },
  ] })
  const local = [
    msg('l1', 'me', 'Сделай клип', 10),
    msg('l2', 'director', 'Принял.', 10, 6),
    msg('l3', 'me', '/status', 1),
  ]
  const merged = v.mergeHistory(server, local)
  assert.deepEqual(merged.map((x) => x.text), ['Сделай клип', 'Принял.', '/status'])
  assert.deepEqual(v.mergeHistory(server, [], iso(5)), [])
  assert.equal(v.normalizeDirectorHistory({ ok: true }), null)
  assert.deepEqual(v.normalizeDirectorHistory({ items: [{ id: 'x', role: 'bad', at: iso(1), text: 't' }] }), [])
})
