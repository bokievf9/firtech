// Fira live (chat 2.0): the shared state machine, the SSE parser, the one hint per page and session, reduced motion, link cards.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ru from '../src/content/ru.ts'
import en from '../src/content/en.ts'
import {
  DOTS_MIN_MS, HAPPY_MS, SLEEP_MS, SORRY_MS, cardsFor, chunkText, cleanCards, createFiraStore, hintDue, hintKeyFor, hintSeenList,
  markHint, pageSlug, parseSse, sseLine, suggestGroupFor,
} from '../src/lib/fira/live.ts'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

// A manual clock: timers run in order when time is advanced; promises are given a tick to settle after each timer.
function clock() {
  let now = 1000
  let seq = 0
  const queue = []
  const timers = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq
      queue.push({ id, at: now + ms, fn })
      return id
    },
    clearTimeout: (id) => {
      const i = queue.findIndex((q) => q.id === id)
      if (i >= 0) queue.splice(i, 1)
    },
  }
  const tick = () => new Promise((r) => setImmediate(r))
  async function advance(ms) {
    const end = now + ms
    for (;;) {
      await tick()
      queue.sort((a, b) => a.at - b.at)
      const next = queue[0]
      if (!next || next.at > end) break
      queue.shift()
      now = Math.max(now, next.at)
      next.fn()
    }
    now = end
    await tick()
  }
  return { timers, advance }
}

test('state machine: thinking shows dots for at least 600 ms, then talking word by word, then happy 1.2 s, then idle', async () => {
  const c = clock()
  const s = createFiraStore({ timers: c.timers })
  const seen = []
  s.subscribe(() => seen.push(s.getSnapshot().state))
  s.dots(true)
  assert.equal(s.getSnapshot().state, 'thinking')
  assert.deepEqual(s.getSnapshot().bubble, { text: '', dots: true, wordsShown: 0 })
  const done = s.say('один два три')
  await c.advance(DOTS_MIN_MS - 100)
  assert.equal(s.getSnapshot().bubble.dots, true, 'still dots before 600 ms')
  assert.equal(s.getSnapshot().state, 'thinking')
  await c.advance(150)
  assert.equal(s.getSnapshot().state, 'talking')
  assert.equal(s.getSnapshot().bubble.wordsShown, 1)
  assert.equal(s.getSnapshot().bubble.dots, false)
  await c.advance(200)
  assert.equal(s.getSnapshot().bubble.wordsShown, 2)
  await c.advance(200)
  await done
  assert.equal(s.getSnapshot().bubble.wordsShown, 3)
  assert.equal(s.getSnapshot().state, 'happy')
  await c.advance(HAPPY_MS + 10)
  assert.equal(s.getSnapshot().state, 'idle')
  assert.equal(s.getSnapshot().bubble, null)
  assert.ok(seen.indexOf('thinking') < seen.indexOf('talking') && seen.indexOf('talking') < seen.indexOf('happy'))
})

test('state machine: a stream feeds the words as they arrive and holds a half word back', async () => {
  const c = clock()
  const s = createFiraStore({ timers: c.timers })
  s.dots(true)
  let push
  let finish
  const stream = (async function* () {
    yield 'Привет, '
    await new Promise((r) => (push = r))
    yield 'как де'
    await new Promise((r) => (finish = r))
    yield 'ла?'
  })()
  const done = s.say('', { stream })
  await c.advance(DOTS_MIN_MS + 50)
  assert.equal(s.getSnapshot().state, 'talking')
  assert.equal(s.getSnapshot().bubble.wordsShown, 1)
  await c.advance(600)
  assert.equal(s.getSnapshot().bubble.wordsShown, 1, 'the second word is not complete yet')
  push()
  await c.advance(300)
  assert.equal(s.getSnapshot().bubble.wordsShown, 2, 'second word complete, the third arrives later')
  finish()
  await c.advance(800)
  await done
  assert.equal(s.getSnapshot().bubble.text, 'Привет, как дела?')
  assert.equal(s.getSnapshot().bubble.wordsShown, 3)
  assert.equal(s.getSnapshot().state, 'happy')
})

test('state machine: errors go to sorry for 2 s then idle; point returns to idle; release only from the named state', async () => {
  const c = clock()
  const s = createFiraStore({ timers: c.timers })
  s.dots(true)
  s.fail()
  assert.equal(s.getSnapshot().state, 'sorry')
  assert.equal(s.getSnapshot().bubble, null)
  await c.advance(SORRY_MS - 50)
  assert.equal(s.getSnapshot().state, 'sorry')
  await c.advance(100)
  assert.equal(s.getSnapshot().state, 'idle')
  s.point('chat-card')
  assert.equal(s.getSnapshot().state, 'point')
  assert.equal(s.getSnapshot().pointTo, 'chat-card')
  await c.advance(3000)
  assert.equal(s.getSnapshot().state, 'idle')
  assert.equal(s.getSnapshot().pointTo, undefined)
  s.set('listening')
  s.release('talking')
  assert.equal(s.getSnapshot().state, 'listening')
  s.release('listening')
  assert.equal(s.getSnapshot().state, 'idle')
})

test('state machine: 120 s without activity sleeps, a move wakes her, activity restarts the timer', async () => {
  const c = clock()
  const s = createFiraStore({ timers: c.timers })
  s.sleepAfter(SLEEP_MS)
  await c.advance(SLEEP_MS - 5000)
  s.wake() // a pointer move: the timer restarts
  await c.advance(SLEEP_MS - 5000)
  assert.equal(s.getSnapshot().state, 'idle')
  await c.advance(6000)
  assert.equal(s.getSnapshot().state, 'sleep')
  s.wake()
  assert.equal(s.getSnapshot().state, 'idle')
  // she does not fall asleep in the middle of a conversation
  s.set('listening')
  await c.advance(SLEEP_MS + 1000)
  assert.equal(s.getSnapshot().state, 'listening')
})

test('reduced motion: no dots, the whole text at once, no sleep, no wave', async () => {
  const c = clock()
  const s = createFiraStore({ timers: c.timers, reduced: () => true })
  s.dots(true)
  assert.equal(s.getSnapshot().state, 'thinking')
  assert.equal(s.getSnapshot().bubble, null, 'no dots bubble')
  const done = s.say('один два три четыре')
  await c.advance(5)
  await done
  assert.equal(s.getSnapshot().bubble.dots, false)
  assert.equal(s.getSnapshot().bubble.wordsShown, 4)
  assert.equal(s.getSnapshot().state, 'happy')
  s.set('wave')
  assert.notEqual(s.getSnapshot().state, 'wave')
  s.sleepAfter(SLEEP_MS)
  await c.advance(SLEEP_MS * 2)
  assert.notEqual(s.getSnapshot().state, 'sleep')
  s.set('sleep')
  assert.notEqual(s.getSnapshot().state, 'sleep')
})

test('SSE: events are parsed across chunk borders, garbage is skipped, cards are cleaned', () => {
  const wire = sseLine({ t: 'Привет ' }) + sseLine({ t: 'мир' }) + sseLine({ done: true, cards: [{ kind: 'page', title: 'Как <b>мы</b>', href: '/ru/how-we-work' }, { kind: 'page', title: 'x', href: 'https://evil.example/x' }, { kind: 'zzz', title: 'x', href: '/ru/x' }], meta: { state: 'chat' } })
  const cut = 37
  const a = parseSse(wire.slice(0, cut))
  const b = parseSse(a.rest + wire.slice(cut))
  const events = [...a.events, ...b.events]
  assert.deepEqual(events.slice(0, 2), [{ t: 'Привет ' }, { t: 'мир' }])
  const end = events[2]
  assert.equal(end.done, true)
  assert.deepEqual(end.cards, [{ kind: 'page', title: 'Как bмы/b', href: '/ru/how-we-work' }])
  assert.deepEqual(end.meta, { state: 'chat' })
  assert.deepEqual(parseSse('data: {oops\n\ndata: {"t":"ok"}\n\n').events, [{ t: 'ok' }])
  assert.deepEqual(parseSse('data: {"t":"a"}\r\n\r\n').events, [{ t: 'a' }])
  assert.deepEqual(cleanCards('nope'), [])
  assert.equal(cleanCards(Array.from({ length: 6 }, () => ({ kind: 'page', title: 't', href: '/en/blog' }))).length, 3)
})

test('chunkText: whole words, lossless', () => {
  const text = 'Здравствуйте. Я Фира, ИИ-ассистент Fir Tech.\nРасскажите, что нужно.'
  const chunks = chunkText(text)
  assert.equal(chunks.join(''), text)
  assert.ok(chunks.every((c) => !/^\s/.test(c.trimEnd()) || c.trim().length > 0))
  assert.ok(chunks.length >= 4)
})

test('cards: builder link and keywords give cards, never the current page, three at most', () => {
  const r = { reply: 'Менеджер заявок отвечает за 5 минут. Оплата по этапам. Статья: сколько стоит сайт.', builderLink: '/ru/builder' }
  const cards = cardsFor(r, 'ru', '/ru/pay-how')
  assert.deepEqual(cards.map((c) => c.kind), ['builder', 'agent', 'article'])
  assert.ok(cards.every((c) => c.href.startsWith('/ru/')))
  assert.equal(cardsFor({ reply: 'Оплата по этапам' }, 'ru', '/ru/pay-how').length, 0)
  assert.equal(cardsFor({ reply: 'hello', cta: ['builder'] }, 'en')[0].href, '/en/builder')
})

test('page context: slug, suggestion group, hint key, one hint per page and session', () => {
  assert.equal(pageSlug('/ru'), 'home')
  assert.equal(pageSlug('/en/products/admin/?x=1'), 'products/admin')
  assert.equal(suggestGroupFor('home'), 'home')
  assert.equal(suggestGroupFor('builder'), 'builder')
  assert.equal(suggestGroupFor('privacy'), 'other')
  assert.equal(hintKeyFor('home'), null)
  assert.equal(hintKeyFor('products/admin'), 'product')
  let seen = hintSeenList(null)
  assert.equal(hintDue(seen, 'builder'), true)
  seen = markHint(seen, 'builder')
  assert.equal(hintDue(seen, 'builder'), false)
  assert.equal(hintDue(seen, 'blog/x'), true)
  assert.deepEqual(markHint(seen, 'builder'), seen)
  assert.deepEqual(hintSeenList('{bad'), [])
  for (const d of [ru, en]) for (const k of ['builder', 'product', 'pricing', 'article']) assert.ok(d.chat.hints[k], k)
})

test('copy: RU and EN carry the same Fira chat keys and no dashes', () => {
  for (const key of ['thinking', 'expand', 'shrink', 'suggestLabel']) {
    assert.equal(typeof ru.chat[key], 'string')
    assert.equal(typeof en.chat[key], 'string')
  }
  assert.deepEqual(Object.keys(ru.chat.suggest), Object.keys(en.chat.suggest))
  assert.deepEqual(Object.keys(ru.chat.cardKinds), ['page', 'builder', 'agent', 'article'])
  const flat = JSON.stringify([ru.chat.hints, ru.chat.suggest, en.chat.hints, en.chat.suggest])
  assert.doesNotMatch(flat, /[–—]/)
})

test('wiring: the chat is mounted without a quiet route, the route streams, the panel keeps history and reads the stream', () => {
  const widget = read('src/components/chat/chat-widget.tsx')
  assert.doesNotMatch(widget, /quietRoute/)
  assert.match(widget, /FiraLiveProvider/)
  assert.match(widget, /data-fira-page|firaPage/)
  assert.match(read('src/app/[locale]/layout.tsx'), /<ChatWidget /)
  const route = read('src/app/api/chat/route.ts')
  assert.match(route, /searchParams\.get\('stream'\) === '1'/)
  assert.match(route, /text\/event-stream/)
  assert.match(route, /checkPublicPost/)
  const panel = read('src/components/chat/chat-panel.tsx')
  assert.match(panel, /sessionStorage/)
  assert.match(panel, /\/api\/chat\?stream=1/)
  assert.match(panel, /FiraStage/)
  assert.match(panel, /data-chat-card/)
  assert.match(read('src/components/fira/fira-stage.tsx'), /FiraFallback7/)
})
