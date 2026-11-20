import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Чаты с клиентами (docs/pult.md): normalizing, sorting, unread, merging a poll into the open thread.
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

const c = await import('../src/lib/chats.ts')
const { createHqMock } = await import('../src/lib/hq-admin-mock.ts')
const T0 = Date.parse('2026-11-21T10:00:00Z')
const thread = (id, over = {}) => ({ id, client: { id: null, name: id, email: null, contact: '' }, channels: ['web'], lastAt: '2026-11-21T08:00:00Z', unread: 0, preview: '', leadId: null, ticketId: null, textsStored: true, openTicket: false, ...over })

test('sortThreads: unread first, then newest', () => {
  const list = [
    thread('old', { lastAt: '2026-11-20T08:00:00Z' }),
    thread('new', { lastAt: '2026-11-21T09:00:00Z' }),
    thread('unread-old', { lastAt: '2026-11-19T08:00:00Z', unread: 2 }),
    thread('unread-new', { lastAt: '2026-11-21T07:00:00Z', unread: 1 }),
    thread('none', { lastAt: null }),
  ].map((x) => c.normalizeThread(x))
  assert.deepEqual(c.sortThreads(list).map((x) => x.id), ['unread-new', 'unread-old', 'new', 'old', 'none'])
  assert.equal(c.unreadTotal(list), 2)
})

test('normalizeChats on the mock: unread count, textsStored false for the anonymous web thread', () => {
  const v = c.normalizeChats(createHqMock(T0)('GET', 'chats', {}, {}, T0))
  assert.equal(v.unread, 1)
  assert.equal(v.items[0].id, 'c3')
  const anon = v.items.find((x) => x.id.startsWith('w'))
  assert.equal(anon.textsStored, false)
  assert.equal(anon.client.name, 'Посетитель сайта')
  assert.equal(c.normalizeChats({ ok: true }), null)
  assert.equal(c.normalizeThread({ id: 'bad id!' }), null)
})

test('thread view: messages by time, alias ids open the client thread, reply is optimistic-friendly', () => {
  const m = createHqMock(T0)
  const v = c.normalizeThreadView(m('GET', 'chats/l12', {}, {}, T0))
  assert.equal(v.thread.id, 'c3')
  assert.equal(v.messages.length, 5)
  assert.deepEqual(v.messages.map((x) => x.from), ['client', 'hq', 'client', 'owner', 'client'])
  assert.equal(v.messages[0].channel, 'web')
  const reply = c.normalizeReply(m('POST', 'chats/c3/reply', {}, { text: 'Макет завтра.' }, T0))
  assert.equal(reply.sent, true)
  assert.equal(reply.via, 'cabinet')
  assert.equal(reply.thread.unread, 0)
  assert.equal(c.replyNote(reply), 'Отправлено в кабинет')
  const anon = c.normalizeReply(m('POST', 'chats/w7f3/reply', {}, { text: 'Привет' }, T0))
  assert.equal(anon.sent, false)
  assert.match(c.replyNote(anon), /Не доставлено/)
  assert.equal(m('GET', 'chats/zzz', {}, {}, T0).error, 'not_found')
})

test('mergeMessages keeps local replies the server has not returned yet', () => {
  const s = [{ id: 'a' }, { id: 'b' }]
  const merged = c.mergeMessages(s, [{ id: 'a' }, { id: 'local_1' }, { id: 'local_2' }])
  assert.deepEqual(merged.map((x) => x.id), ['a', 'b', 'local_1', 'local_2'])
  assert.deepEqual(c.mergeMessages([{ id: 'local_1' }], [{ id: 'local_1' }]).map((x) => x.id), ['local_1'])
})

test('threadLinks and the Enter rule', () => {
  const t = c.normalizeThread(thread('c3', { client: { id: 3, name: 'Анна' }, leadId: 12, ticketId: 4 }))
  assert.deepEqual(c.threadLinks(t).map((l) => l.label), ['Открыть лид', 'Открыть тикет', 'Открыть клиента'])
  assert.equal(c.threadLinks(t)[0].href, '/admin/office?panel=sales&tab=leads&focus=12')
  assert.equal(c.threadLinks(c.normalizeThread(thread('w1'))).length, 0)
  assert.equal(c.sendsOnEnter({ key: 'Enter', shiftKey: false }), true)
  assert.equal(c.sendsOnEnter({ key: 'Enter', shiftKey: true }), false)
  assert.equal(c.sendsOnEnter({ key: 'Enter', shiftKey: false, isComposing: true }), false)
})
