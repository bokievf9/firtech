import assert from 'node:assert/strict'
import { test } from 'node:test'
import en from '../src/content/en.ts'
import ru from '../src/content/ru.ts'
import * as S from '../src/lib/status-line.ts'

const counts = (agents, working, waiting, doneToday) => ({ agents, working, waiting, tasksRunning: working, doneToday })

test('Russian line with plural forms', () => {
  const c = ru.hero.live
  assert.equal(
    S.statusLine('ru', counts(24, 6, 2, 14), 10, c),
    'Сейчас в офисе: 24 агента · 6 работают · 2 ждут решения · 14 задач сделано сегодня · обновлено 10 с назад',
  )
  assert.equal(
    S.statusLine('ru', counts(21, 1, 1, 1), 0, c),
    'Сейчас в офисе: 21 агент · 1 работает · 1 ждёт решения · 1 задача сделана сегодня · обновлено только что',
  )
  assert.equal(S.statusLine('ru', counts(19, 5, 0, 3), 125, c).endsWith('3 задачи сделаны сегодня · обновлено 2 мин назад'), true)
  assert.equal(S.plural('ru', 11, c.agents), 'агентов')
  assert.equal(S.plural('ru', 112, c.agents), 'агентов')
  assert.equal(S.plural('ru', 0, c.agents), 'агентов')
})

test('English line', () => {
  const c = en.hero.live
  assert.equal(
    S.statusLine('en', counts(24, 6, 2, 14), 10, c),
    'In the office now: 24 agents · 6 working · 2 waiting for a decision · 14 tasks done today · updated 10 s ago',
  )
  assert.equal(
    S.statusLine('en', counts(1, 1, 1, 1), 1, c),
    'In the office now: 1 agent · 1 working · 1 waiting for a decision · 1 task done today · updated just now',
  )
})

test('data age: never negative, seconds then minutes', () => {
  const c = ru.hero.live
  assert.equal(S.formatUpdated(-5, c), 'обновлено только что')
  assert.equal(S.formatUpdated(59.9, c), 'обновлено 59 с назад')
  assert.equal(S.formatUpdated(60, c), 'обновлено 1 мин назад')
})

test('segments keep the order and keys the hero renders', () => {
  const segs = S.statusSegments('ru', counts(19, 6, 2, 14), ru.hero.live)
  assert.deepEqual(segs.map((s) => s.key), ['agents', 'working', 'waiting', 'done'])
  assert.deepEqual(segs.map((s) => s.n), [19, 6, 2, 14])
})
