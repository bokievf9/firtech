import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as control from '../src/content/control.ts'
import * as echo from '../src/lib/echo.ts'
import { computeStats } from '../src/lib/admin-data.ts'

const now = Date.parse('2026-10-18T08:00:00Z')
const leads = [
  {
    id: 1,
    name: 'Секретное Имя',
    contact: '@secret_contact',
    createdAt: '2026-10-16T08:00:00Z',
    status: 'new',
    service: 'websites',
  },
  {
    id: 2,
    name: 'Другой',
    contact: '+992000000000',
    createdAt: '2026-10-18T07:00:00Z',
    status: 'won',
    service: 'bots',
  },
]

test('briefing carries lead counts but never names or contacts', () => {
  const summary = echo.leadSummary(computeStats(leads, now))
  assert.equal(summary.total, 2)
  assert.equal(summary.stale, 1)
  assert.equal(summary.conversion, 50)
  const text = echo.briefing({
    now: new Date(now),
    projects: control.projects,
    health: [
      { id: 'vibely', ok: true, ms: 420 },
      { id: 'firtech', ok: false, ms: null },
    ],
    tasks: control.tasks,
    goals: control.goals,
    leads: summary,
  })
  for (const secret of ['Секретное', 'secret_contact', '+992000000000', 'Другой'])
    assert.ok(!text.includes(secret), secret)
  assert.match(text, /Vibely.*онлайн, ответ 420 мс/)
  assert.match(text, /Fir Tech.*НЕ ОТВЕЧАЕТ/)
  for (const task of control.tasks) assert.ok(text.includes(task.id))
})

test('focus tags are hidden from the text and parsed into panels', () => {
  const raw = 'Две заявки ждут ответа, сэр. [[focus:leads]] [[focus:nope]]'
  assert.equal(echo.visibleText(raw), 'Две заявки ждут ответа, сэр.')
  assert.deepEqual(echo.focusOf(raw), ['leads'])
  // A tag still arriving in the stream is not shown half-written.
  assert.equal(echo.visibleText('Готово, сэр. [[foc'), 'Готово, сэр.')
})

test('chat request must end on the user and stay small', () => {
  const ok = { messages: [{ role: 'user', content: 'Доложи обстановку' }] }
  assert.ok(echo.chatRequest.safeParse(ok).success)
  assert.ok(
    !echo.chatRequest.safeParse({ messages: [{ role: 'assistant', content: 'x' }] }).success,
  )
  assert.ok(
    !echo.chatRequest.safeParse({ messages: [{ role: 'user', content: 'x'.repeat(2001) }] })
      .success,
  )
  assert.ok(!echo.chatRequest.safeParse({ messages: [{ role: 'system', content: 'x' }] }).success)
})

test('control data is consistent', () => {
  const ids = control.tasks.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const g of control.goals) assert.ok(g.progress >= 0 && g.progress <= 100)
  for (const p of control.projects) assert.match(p.healthUrl, /^https:\/\/.+\/api\/health$/)
  const copy = JSON.stringify([control.projects, control.tasks, control.goals])
  assert.ok(!/[–—]/.test(copy), 'no em or en dashes in copy')
})
