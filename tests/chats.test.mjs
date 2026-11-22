import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Чаты с клиентами (docs/shell.md): normalizing, sorting, unread, merging a poll into the open thread.
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
  assert.deepEqual(v.messages.map((x) => x.thread), ['lead', 'lead', 'lead', 'lead', 'project-4'], 'each message names its thread')
  assert.equal(c.lastClientThread(v.messages), 'project-4', 'the default reply thread is the last client message\'s')
  assert.deepEqual(c.messageThreads(v.messages), ['lead', 'project-4'])
  const noHint = m('POST', 'chats/c3/reply', {}, { text: 'Макет завтра.' }, T0)
  assert.equal(noHint.message.thread, 'project-4', 'no hint: HQ answers into the last client thread')
  const reply = c.normalizeReply(m('POST', 'chats/c3/reply', {}, { text: 'Макет завтра.', thread: 'project-4' }, T0))
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

test('reply thread: the picker choices, the 422 names, the body and the proxy whitelist', async () => {
  const m = createHqMock(T0)
  const choices = c.normalizeThreadChoices(m('GET', 'clients/3/threads', {}, {}, T0))
  assert.deepEqual(choices.map((x) => x.id), ['lead', 'project-4', 'support'], 'the agent thread is not replyable')
  assert.equal(choices[1].label, 'Проект #4: сайт студии')
  assert.equal(c.defaultChoice(choices), 'lead')
  assert.equal(c.defaultChoice(choices, 'project-4'), 'project-4')
  assert.equal(c.defaultChoice(choices, 'project-9'), 'lead', 'an unknown hint falls back')
  assert.equal(c.defaultChoice([]), null)
  assert.deepEqual(c.normalizeThreadChoices(m('GET', 'clients/9/threads', {}, {}, T0)), [])
  assert.equal(c.normalizeThreadChoices({ ok: true }), null)
  const t = c.normalizeThread({ id: 'l12', client: { id: null, name: 'A' }, leadId: 12, ticketId: 3 })
  assert.deepEqual(c.fallbackChoices(t).map((x) => x.id), ['lead', 'support'])
  // 422 thread_required: the names HQ sends become the options, labels from the known ones
  const refusal = { ok: false, error: 'thread_required', threads: ['lead', 'support', 'project-4'] }
  assert.deepEqual(c.choicesFrom(refusal.threads, choices).map((x) => x.id), ['lead', 'support', 'project-4'])
  assert.deepEqual(c.choicesFrom(['agent-1', 'lead', 'lead', 'x'], []).map((x) => x.id), ['lead'])
  assert.equal(m('POST', 'chats/c3/reply', {}, { text: 'Привет', thread: 'project-77' }, T0).error, 'not_found')
  assert.equal(m('POST', 'chats/c3/reply', {}, { text: 'Привет', replyTo: 'cab_22' }, T0).ok, true, 'replyTo alone is a hint')
  // body and replyTo ids
  assert.deepEqual(c.replyBody('Да', { thread: 'support', replyTo: 'cab_22' }), { text: 'Да', thread: 'support', replyTo: 'cab_22' })
  assert.deepEqual(c.replyBody('Да', { thread: 'agent-1' }), { text: 'Да' })
  assert.deepEqual(c.replyBody('Да', {}), { text: 'Да' })
  assert.equal(c.canReplyTo({ id: 'cab_22', from: 'client' }), true)
  assert.equal(c.canReplyTo({ id: 'ct_5', from: 'client' }), true)
  assert.equal(c.canReplyTo({ id: 'lead_12', from: 'client' }), false)
  assert.equal(c.canReplyTo({ id: 'cab_22', from: 'owner' }), false)
  const { resolveEndpoint } = await import('../src/lib/hq-admin.ts')
  const ok = (body) => resolveEndpoint('POST', ['chats', 'c3', 'reply'], new URLSearchParams(), body).ok
  assert.equal(ok({ text: 'a', thread: 'lead' }), true)
  assert.equal(ok({ text: 'a', thread: 'project-12', replyTo: 'cab_7' }), true)
  assert.equal(ok({ text: 'a' }), true)
  assert.equal(ok({ text: 'a', thread: 'agent-1' }), false)
  assert.equal(ok({ text: 'a', thread: 'project-x' }), false)
  assert.equal(ok({ text: 'a', replyTo: 'a/b' }), false)
  assert.equal(ok({ text: 'a', extra: 1 }), false)
  assert.equal(resolveEndpoint('GET', ['clients', '3', 'threads'], new URLSearchParams(), null).ok, true)
  assert.equal(resolveEndpoint('POST', ['clients', '3', 'threads'], new URLSearchParams(), {}).ok, false)
})

test('chat search and «mark unread» through HQ', async () => {
  const list = [
    c.normalizeThread({ id: 'c1', client: { id: 1, name: 'Анна', email: 'anna@example.com', contact: '@anna' }, preview: 'Когда макет?' }),
    c.normalizeThread({ id: 'c2', client: { id: 2, name: 'Фаррух', contact: '+992 90' }, preview: 'Спасибо' }),
  ]
  assert.equal(c.searchThreads(list, '').length, 2)
  assert.deepEqual(c.searchThreads(list, ' АННА ').map((x) => x.id), ['c1'])
  assert.deepEqual(c.searchThreads(list, 'example.com').map((x) => x.id), ['c1'])
  assert.deepEqual(c.searchThreads(list, '@anna').map((x) => x.id), ['c1'])
  assert.deepEqual(c.searchThreads(list, 'спасибо').map((x) => x.id), ['c2'])
  assert.deepEqual(c.searchThreads(list, 'никого'), [])
  assert.equal(c.markedUnread(list[1]).unread, 1)
  assert.equal(c.markedUnread({ ...list[1], unread: 3 }).unread, 3, 'an unread thread stays as it is')
  const m = createHqMock(T0)
  const done = m('POST', 'chats/t4/unread', {}, {}, T0)
  assert.equal(done.ok, true)
  assert.equal(c.normalizeThread(done.thread).unread, 1)
  assert.equal(m('POST', 'chats/c3/unread', {}, {}, T0).thread.unread, 1, 'already unread: unchanged')
  assert.equal(m('POST', 'chats/zzz/unread', {}, {}, T0).error, 'not_found')
  const { resolveEndpoint } = await import('../src/lib/hq-admin.ts')
  assert.equal(resolveEndpoint('POST', ['chats', 't4', 'unread'], new URLSearchParams(), {}).ok, true)
  assert.equal(resolveEndpoint('POST', ['chats', 't4', 'unread'], new URLSearchParams(), { a: 1 }).ok, false)
  assert.equal(resolveEndpoint('GET', ['chats', 't4', 'unread'], new URLSearchParams(), null).ok, false)
})

test('autopilot chip: lead threads use the lead manager, support and project threads use support, no settings = no chip', () => {
  assert.equal(c.autopilotKindOf('lead'), 'leadManager')
  assert.equal(c.autopilotKindOf('support'), 'support')
  assert.equal(c.autopilotKindOf('project-4'), 'support')
  assert.equal(c.autopilotKindOf(null), 'leadManager')
  assert.equal(c.chatAutopilotKind({ leadId: 1, ticketId: 2 }), 'leadManager')
  assert.equal(c.chatAutopilotKind({ leadId: null, ticketId: 2 }), 'support')
  assert.equal(c.chatAutopilotKind({ leadId: 1, ticketId: null }, 'project-9'), 'support')
  const st = { autopilot: { leadManager: 'autopilot', support: 'ask_me' } }
  assert.equal(c.autopilotChip(st, 'leadManager').text, 'Autopilot: Autopilot')
  assert.equal(c.autopilotChip(st, 'support').text, 'Autopilot: Ask me')
  assert.equal(c.autopilotChip({ autopilot: { leadManager: 'policy' } }, 'leadManager').text, 'Autopilot: Policy')
  assert.match(c.autopilotChip(st, 'support').title, /Support mode in Settings/)
  assert.equal(c.autopilotChip(null, 'support'), null)
  assert.equal(c.autopilotChip({ autopilot: { support: 'bogus' } }, 'support'), null)
})
