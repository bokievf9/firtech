import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, beforeEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Same mapping as admin.test.mjs: 'server-only' and '@/...' for plain Node.
const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier === 'next/server') return next('next/server.js', context)
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

const root = await mkdtemp(path.join(tmpdir(), 'firtech-echo-test-'))
process.env.DATA_DIR = root
process.env.ANTHROPIC_API_KEY = 'test-key'
delete process.env.ECHO_DAILY_USD
after(() => rm(root, { recursive: true, force: true }))

const tools = await import('../src/lib/echo-tools.ts')
const spend = await import('../src/lib/echo-spend.ts')
const echo = await import('../src/lib/echo.ts')
const chat = await import('../src/lib/echo-chat.ts')
const ttsLib = await import('../src/lib/echo-tts.ts')
const voice = await import('../src/lib/echo-voice.ts')
const control = await import('../src/content/control.ts')
const auth = await import('../src/lib/admin-auth.ts')

const SECRETS = ['Секретное Имя', 'secret_contact', '+992000000000', 'Тайный Текст']
const leads = [
  {
    id: 1,
    name: SECRETS[0],
    contact: SECRETS[1],
    message: SECRETS[3],
    createdAt: '2026-10-16T08:00:00Z',
    status: 'new',
    service: 'websites',
  },
  {
    id: 2,
    name: 'Другой',
    contact: SECRETS[2],
    createdAt: new Date().toISOString(),
    status: 'won',
    service: 'bots',
  },
]
const containsSecret = (text) => SECRETS.concat('Другой').find((s) => text.includes(s))

// ---- fake stores -------------------------------------------------------------------------------

function fakeStores(initial = []) {
  const state = { tasks: initial.map((t) => ({ ...t })), seq: 0 }
  const now = new Date().toISOString()
  return {
    state,
    listTasks: async () => state.tasks.map((t) => ({ ...t })),
    createTask: async (input) => {
      const task = {
        id: `t${++state.seq}`,
        status: 'todo',
        priority: 'normal',
        due: null,
        notes: '',
        source: 'ui',
        createdAt: now,
        updatedAt: now,
        doneAt: null,
        ...input,
      }
      state.tasks.push(task)
      return { ...task }
    },
    updateTask: async (id, patch) => {
      const task = state.tasks.find((t) => t.id === id)
      if (!task) return null
      Object.assign(task, patch)
      return { ...task }
    },
    deleteTask: async (id) => {
      const before = state.tasks.length
      state.tasks = state.tasks.filter((t) => t.id !== id)
      return state.tasks.length < before
    },
    listIgItems: async () => [
      {
        id: 'a',
        date: tools.dushanbeDay(Date.now()),
        time: '10:00',
        kind: 'post',
        title: 'Знакомство',
        folder: null,
        note: '',
        published: false,
        publishedAt: null,
      },
      {
        id: 'b',
        date: '2000-01-01',
        time: '10:00',
        kind: 'post',
        title: 'Старый',
        folder: null,
        note: '',
        published: true,
        publishedAt: null,
      },
    ],
    leadCounts: async () => ({ today: 1, week: 2, month: 5 }),
  }
}
const task = (id, title, extra = {}) => ({
  id,
  project: 'firtech',
  title,
  status: 'todo',
  priority: 'normal',
  due: null,
  notes: '',
  source: 'ui',
  createdAt: '2026-10-18T00:00:00Z',
  updatedAt: '2026-10-18T00:00:00Z',
  doneAt: null,
  ...extra,
})

function setup(initial = []) {
  const stores = fakeStores(initial)
  const confirmations = new tools.Confirmations()
  // One owner message = one request: begin() first, then the tools run inside it.
  const turn = (text, now = Date.now()) => {
    const req = confirmations.begin('s1', text, now)
    const ctx = { stores, confirmations, session: 's1', request: req }
    return (name, input) => tools.runTool(ctx, name, input)
  }
  return { stores, confirmations, turn }
}
const parse = (outcome) => JSON.parse(outcome.content)

// ---- tools -------------------------------------------------------------------------------------

test('tools: add, update, list, blocked, lead counts, instagram today', async () => {
  const { stores, turn } = setup([task('t0', 'Проверить оплату домена')])
  const run = turn('сделай')
  const added = await run('add_task', {
    project: 'vibely',
    title: 'Позвонить банку',
    priority: 'high',
    due: '2026-10-20',
  })
  assert.equal(added.isError, false)
  assert.equal(added.act, 'Добавлена задача: Позвонить банку')
  assert.equal(stores.state.tasks.at(-1).source, 'echo')
  assert.equal(stores.state.tasks.at(-1).priority, 'high')

  const updated = await run('update_task', { match: 'оплату домена', status: 'blocked' })
  assert.equal(parse(updated).task.status, 'blocked')
  assert.match(updated.act, /^Задача ждёт владельца: /)

  const blocked = parse(await run('blocked_on_owner', {}))
  assert.deepEqual(
    blocked.tasks.map((t) => t.id),
    ['t0'],
  )

  const listed = parse(await run('list_tasks', { project: 'vibely' }))
  assert.equal(listed.count, 1)
  assert.deepEqual(Object.keys(listed.tasks[0]).sort(), [
    'due',
    'id',
    'priority',
    'project',
    'status',
    'title',
  ])

  assert.deepEqual(parse(await run('lead_counts', { period: 'week' })), {
    period: 'week',
    count: 2,
  })

  const ig = parse(await run('instagram_today', {}))
  assert.equal(ig.total, 1)
  assert.deepEqual(ig.items, [
    { time: '10:00', kind: 'post', title: 'Знакомство', published: false },
  ])
})

test('tools: bad input and ambiguous matches come back as errors', async () => {
  const { turn } = setup([task('t1', 'Цены на ботов'), task('t2', 'Цены на сайты')])
  const run = turn('x')
  for (const [name, input] of [
    ['add_task', { project: 'nope', title: 'x' }],
    ['add_task', { project: 'firtech', title: '' }],
    ['add_task', { project: 'firtech', title: 'x', due: '2026-02-31' }],
    ['update_task', { id: 't1' }],
    ['update_task', { status: 'done' }],
    ['lead_counts', { period: 'year' }],
    ['no_such_tool', {}],
  ]) {
    const out = await run(name, input)
    assert.equal(out.isError, true, name)
    assert.equal(out.act, undefined)
  }
  const many = await run('update_task', { match: 'цены', status: 'done' })
  assert.equal(many.isError, true)
  assert.equal(parse(many).candidates.length, 2)
  assert.equal((await run('update_task', { id: 'zzz', status: 'done' })).isError, true)
})

test('delete_task: two steps, and the model cannot confirm by itself', async () => {
  const { stores, turn, confirmations } = setup([task('t1', 'Старая идея'), task('t2', 'Другое')])

  // Request 1: the model asks to delete, then tries again in the same request.
  const first = turn('удали старую идею')
  const ask = await first('delete_task', { id: 't1' })
  assert.equal(parse(ask).needs_confirmation, true)
  assert.equal(stores.state.tasks.length, 2)
  const selfConfirm = await first('delete_task', { id: 't1' })
  assert.equal(selfConfirm.isError, true, 'same request cannot confirm, or ask twice')
  assert.equal(stores.state.tasks.length, 2)

  // Request 2: the owner says something else. The proposal is cancelled.
  const other = turn('а что по заявкам?')
  assert.equal(parse(await other('delete_task', { id: 't1' })).needs_confirmation, true)
  assert.equal(stores.state.tasks.length, 2)

  // Request 3: the owner says yes, but to a different id the model never proposed.
  const yes = turn('да')
  const wrong = await yes('delete_task', { id: 't2' })
  assert.equal(wrong.isError, true, 'a yes approves only the task that was asked about')
  assert.equal(stores.state.tasks.length, 2)

  // A fresh proposal, then a real yes the next message with the same id.
  const again = turn('удали старую идею')
  assert.equal(parse(await again('delete_task', { id: 't1' })).needs_confirmation, true)
  const confirm = turn('Да, удаляй!')
  const done = await confirm('delete_task', { id: 't1' })
  assert.equal(parse(done).deleted, true)
  assert.equal(done.act, 'Удалена задача: Старая идея')
  assert.deepEqual(
    stores.state.tasks.map((t) => t.id),
    ['t2'],
  )
  assert.equal(confirmations.peek('s1'), null)

  // Consumed: a second yes does not delete anything else.
  const replay = turn('да')
  assert.equal(parse(await replay('delete_task', { id: 't2' })).needs_confirmation, true)
  assert.equal(stores.state.tasks.length, 1)
})

test('delete_task: a yes needs the question first, a stale question expires, sessions are separate', async () => {
  const { stores, confirmations } = setup([task('t1', 'Идея')])
  const ctx = (session, text, now) => ({
    stores,
    confirmations,
    session,
    request: confirmations.begin(session, text, now),
  })
  const t0 = Date.now()
  // "да" with no pending deletion never deletes.
  const naked = ctx('a', 'да', t0)
  assert.equal(
    parse(await tools.runTool(naked, 'delete_task', { id: 't1' })).needs_confirmation,
    true,
  )
  // A pending deletion of session a cannot be confirmed from session b.
  const other = ctx('b', 'да', t0 + 1000)
  assert.equal(
    parse(await tools.runTool(other, 'delete_task', { id: 't1' })).needs_confirmation,
    true,
  )
  assert.equal(stores.state.tasks.length, 1)
  // Six minutes later the yes is too late.
  const late = ctx('a', 'да', t0 + 6 * 60_000)
  assert.equal(
    parse(await tools.runTool(late, 'delete_task', { id: 't1' })).needs_confirmation,
    true,
  )
  assert.equal(stores.state.tasks.length, 1)
})

test('isExplicitYes accepts only plain agreement', () => {
  for (const ok of [
    'да',
    'Да.',
    'подтверждаю',
    'удаляй',
    'да, удаляй',
    'Да, подтверждаю удаление'.replace(' удаление', ''),
    'да сэр',
  ])
    assert.ok(tools.isExplicitYes(ok), ok)
  for (const no of [
    '',
    'нет',
    'не удаляй',
    'да, но сначала покажи список',
    'удалить',
    'ага',
    'да нет',
    'да да да да да',
  ])
    assert.ok(!tools.isExplicitYes(no), no)
})

test('privacy: no tool result carries a lead name, contact or text', async () => {
  const { turn } = setup([task('t1', 'Позвонить клиенту')])
  const run = turn('x')
  const results = []
  for (const [name, input] of [
    ['add_task', { project: 'firtech', title: 'Новая' }],
    ['list_tasks', {}],
    ['blocked_on_owner', {}],
    ['lead_counts', { period: 'today' }],
    ['lead_counts', { period: 'month' }],
    ['instagram_today', {}],
    ['delete_task', { id: 't1' }],
  ])
    results.push((await run(name, input)).content)
  // The count provider is the only door to leads, and it returns numbers.
  const counts = await fakeStores().leadCounts()
  assert.ok(Object.values(counts).every((n) => typeof n === 'number'))
  for (const text of results) assert.equal(containsSecret(text), undefined, text)
  const def = JSON.stringify(tools.toolDefinitions)
  assert.equal(containsSecret(def), undefined)
})

test('briefing with live tasks and Instagram stays free of lead details', () => {
  const summary = echo.leadSummary(
    // computeStats is covered in echo.test.mjs; the summary here is built from the same shape.
    {
      today: 1,
      week: 2,
      month: 3,
      total: 4,
      conversion: 0.25,
      stale: [1],
      upcoming: [],
      funnel: [{ status: 'new', count: 4 }],
    },
  )
  const text = echo.briefing({
    now: new Date(),
    projects: control.projects,
    health: [],
    tasks: control.tasks,
    goals: control.goals,
    leads: summary,
    liveTasks: [
      task('t9', 'Ответить по смете', { status: 'blocked', priority: 'high', due: '2026-10-20' }),
      task('t8', 'Готово', { status: 'done' }),
    ],
    instagram: [
      {
        id: 'x',
        date: '2026-10-19',
        time: '10:00',
        kind: 'post',
        title: 'Знакомство',
        folder: null,
        note: '',
        published: false,
        publishedAt: null,
      },
    ],
  })
  assert.match(text, /t9 \[blocked, приоритет high, срок 2026-10-20, firtech\]: Ответить по смете/)
  assert.ok(!text.includes('Готово'), 'done tasks are left out')
  assert.match(text, /2026-10-19 10:00 post: Знакомство \(не опубликовано\)/)
  assert.equal(containsSecret(text), undefined)
  assert.ok(!/[–—]/.test(text), 'no long dashes')
})

// ---- cost --------------------------------------------------------------------------------------

test('spend: Sonnet $2/$10, Opus $4/$20, fallback at the dearer rate, loops add up', () => {
  const m = (input, output) => ({ input_tokens: input, output_tokens: output })
  assert.equal(spend.costUsd(m(1e6, 0), 'sonnet'), 2)
  assert.equal(spend.costUsd(m(0, 1e6), 'sonnet'), 10)
  assert.equal(spend.costUsd(m(1e6, 0), 'opus'), 4)
  assert.equal(spend.costUsd(m(0, 1e6), 'opus'), 20)
  assert.equal(spend.costUsd({ cache_read_input_tokens: 1e6 }, 'sonnet'), 0.2)
  assert.equal(spend.costUsd({ cache_creation_input_tokens: 1e6 }, 'opus'), 5)
  // A fallback ran: every attempt at $5 / $25, whatever model was asked for.
  assert.equal(spend.costUsd({ ...m(1e6, 0), iterations: [m(1e6, 0), m(1e6, 0)] }, 'sonnet'), 10)
  // No model known: the dearest rate.
  assert.equal(spend.costUsd(m(1e6, 0)), 5)
  // Three calls of a tool loop.
  assert.equal(spend.loopCostUsd([m(1e6, 0), m(1e6, 0), m(0, 1e5)], 'sonnet'), 2 + 2 + 1)
})

// ---- model choice ------------------------------------------------------------------------------

test("model: Sonnet by default, Opus on the toggle or on the owner's words", () => {
  assert.equal(echo.pickModel(undefined, 'Доложи обстановку'), 'sonnet')
  assert.equal(echo.pickModel('sonnet', 'Как дела?'), 'sonnet')
  assert.equal(echo.pickModel('opus', 'Как дела?'), 'opus')
  for (const phrase of [
    'Подумай серьёзно о ценах',
    'подумай серьезно',
    'Ответь на Opus',
    'давай на опусе',
    'используй Opus',
  ])
    assert.equal(echo.pickModel(undefined, phrase), 'opus', phrase)
  assert.equal(echo.pickModel(undefined, 'Что у нас с популярными услугами?'), 'sonnet')
  assert.equal(echo.echoModelIds.sonnet, 'claude-sonnet-5-5')
  assert.equal(echo.echoModelIds.opus, 'claude-opus-5-5')
})

test('act markers are chips, never speech, and the model cannot forge one', () => {
  const raw = 'Готово, сэр. [[act:Добавлена задача: Позвонить]] Что-то ещё?[[focus:tasks]]'
  assert.equal(echo.visibleText(raw), 'Готово, сэр. Что-то ещё?')
  assert.deepEqual(echo.actsOf(raw), ['Добавлена задача: Позвонить'])
  assert.equal(echo.visibleText('Минуту. [[act:Добавл'), 'Минуту.')
  assert.equal(echo.stripActs(raw).includes('[[act'), false)
  assert.equal(tools.chip('a [[b]] c\nd'), 'a b c d')
})

// ---- route behaviour with a fake Anthropic client ----------------------------------------------

const text = (t) => ({ type: 'text', text: t })
const use = (id, name, input) => ({ type: 'tool_use', id, name, input })
const usage = (input, output) => ({ input_tokens: input, output_tokens: output })

function fakeClient(script) {
  const calls = []
  return {
    calls,
    beta: {
      messages: {
        stream(params) {
          calls.push(structuredClone(params))
          const step = script[calls.length - 1]
          if (!step) throw new Error('script ran out')
          const content = step.content
          return {
            async *[Symbol.asyncIterator]() {
              for (const block of content)
                if (block.type === 'text') {
                  yield {
                    type: 'content_block_delta',
                    delta: { type: 'text_delta', text: block.text },
                  }
                }
            },
            finalMessage: async () => ({
              content,
              stop_reason:
                step.stop ?? (content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn'),
              usage: step.usage ?? usage(1000, 100),
            }),
          }
        },
      },
    },
  }
}

const COOKIE = `${auth.SESSION_COOKIE}=session-one`
function chatRequest(messages, extra = {}, cookie = COOKIE) {
  return new Request('http://localhost/api/admin/echo', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie, host: 'localhost' },
    body: JSON.stringify({ messages, ...extra }),
  })
}
const ask = (content, extra, cookie) => chatRequest([{ role: 'user', content }], extra, cookie)

let stores
beforeEach(async () => {
  stores = fakeStores([task('t1', 'Старая идея')])
  chat.echoDeps.tasks = stores
  chat.echoDeps.instagram = stores
  chat.echoDeps.health = async () => []
  chat.echoDeps.leads = async () => leads
  chat.echoDeps.confirmations = new tools.Confirmations()
  chat.echoLimits.reset()
  delete process.env.ECHO_DAILY_USD
  await spend.addSpend(-(await spend.spentToday()))
})

test('route: tool loop streams text and chips, sends results back, counts every call', async () => {
  const client = fakeClient([
    {
      content: [
        text('Добавляю. '),
        use('u1', 'add_task', { project: 'firtech', title: 'Позвонить банку' }),
      ],
      usage: usage(1_000_000, 0),
    },
    { content: [text('Готово, сэр.')], usage: usage(1_000_000, 100_000) },
  ])
  chat.echoDeps.client = () => client
  const res = await chat.handleEcho(ask('Запомни: позвонить банку'))
  assert.equal(res.headers.get('x-echo-model'), 'sonnet')
  const body = await res.text()
  assert.equal(echo.visibleText(body), 'Добавляю. Готово, сэр.')
  assert.deepEqual(echo.actsOf(body), ['Добавлена задача: Позвонить банку'])
  assert.equal(stores.state.tasks.at(-1).title, 'Позвонить банку')
  assert.equal(stores.state.tasks.at(-1).source, 'echo')

  assert.equal(client.calls.length, 2)
  const [first, second] = client.calls
  assert.equal(first.model, 'claude-sonnet-5-5')
  assert.equal(first.output_config.effort, 'low')
  assert.equal(first.tool_choice, undefined, 'forced tool use is a 400, so it stays on auto')
  assert.deepEqual(
    first.tools.map((t) => t.name),
    [
      'add_task',
      'update_task',
      'list_tasks',
      'delete_task',
      'lead_counts',
      'blocked_on_owner',
      'instagram_today',
    ],
  )
  assert.deepEqual(first.betas, ['server-side-fallback-2026-07-01'])
  assert.equal(first.fallbacks, 'default')
  // The second call carries the assistant turn unchanged and every result in ONE user turn.
  const [, assistant, results] = second.messages
  assert.equal(assistant.role, 'assistant')
  assert.equal(assistant.content[1].id, 'u1')
  assert.equal(results.role, 'user')
  assert.equal(results.content.length, 1)
  assert.equal(results.content[0].type, 'tool_result')
  assert.equal(results.content[0].tool_use_id, 'u1')
  assert.equal(results.content[0].is_error, false)

  // 2 x $2 for input + 100k output at $10/M = $5.
  assert.equal(await spend.spentToday(), 5)
  // The loop's second call counted against the per-session limit too.
  assert.equal(chat.echoLimits.recent('session-one').length, 2)
})

test('route: invalid tool input goes back as is_error and the loop goes on', async () => {
  const client = fakeClient([
    { content: [use('u1', 'add_task', { project: 'nope', title: 'x' })] },
    { content: [text('Не вышло, поправлю.')] },
  ])
  chat.echoDeps.client = () => client
  const body = await (await chat.handleEcho(ask('добавь задачу'))).text()
  const result = client.calls[1].messages.at(-1).content[0]
  assert.equal(result.is_error, true)
  assert.match(result.content, /invalid input/)
  assert.deepEqual(echo.actsOf(body), [])
  assert.equal(stores.state.tasks.length, 1)
})

test("route: delete needs the owner's yes in the NEXT message", async () => {
  const client = fakeClient([
    // Message 1: ask, then (cheating) confirm in the same request.
    { content: [use('u1', 'delete_task', { id: 't1' })] },
    { content: [use('u2', 'delete_task', { id: 't1' })] },
    { content: [text('Удалить задачу «Старая идея», сэр?')] },
    // Message 2: "да".
    { content: [use('u3', 'delete_task', { id: 't1' })] },
    { content: [text('Удалено.')] },
  ])
  chat.echoDeps.client = () => client
  const first = await (await chat.handleEcho(ask('удали старую идею'))).text()
  assert.equal(stores.state.tasks.length, 1, 'still there after the model asked twice')
  assert.deepEqual(echo.actsOf(first), [])
  assert.match(client.calls[1].messages.at(-1).content[0].content, /needs_confirmation/)
  assert.match(client.calls[2].messages.at(-1).content[0].content, /one deletion per message/)

  const second = await (
    await chat.handleEcho(
      chatRequest([
        { role: 'user', content: 'удали старую идею' },
        { role: 'assistant', content: 'Удалить задачу «Старая идея», сэр?' },
        { role: 'user', content: 'да' },
      ]),
    )
  ).text()
  assert.equal(stores.state.tasks.length, 0)
  assert.deepEqual(echo.actsOf(second), ['Удалена задача: Старая идея'])
})

test('route: privacy, nothing about a lead reaches the model', async () => {
  const client = fakeClient([
    { content: [use('u1', 'lead_counts', { period: 'week' }), use('u2', 'list_tasks', {})] },
    { content: [text('За неделю две заявки.')] },
  ])
  chat.echoDeps.client = () => client
  await (await chat.handleEcho(ask('сколько заявок?'))).text()
  assert.equal(client.calls.length, 2)
  // Everything the model saw: system prompt, tools, messages and tool results.
  assert.equal(containsSecret(JSON.stringify(client.calls)), undefined)
  const results = client.calls[1].messages.at(-1).content
  assert.equal(results.length, 2, 'parallel calls answered in one turn')
  assert.deepEqual(JSON.parse(results[0].content), { period: 'week', count: 2 })
})

test("route: Sonnet by default, Opus on the toggle or on the owner's words", async () => {
  const run = async (content, extra) => {
    const client = fakeClient([{ content: [text('Хорошо.')] }])
    chat.echoDeps.client = () => client
    const res = await chat.handleEcho(ask(content, extra))
    await res.text()
    return { call: client.calls[0], header: res.headers.get('x-echo-model') }
  }
  const plain = await run('Привет')
  assert.equal(plain.call.model, 'claude-sonnet-5-5')
  const toggled = await run('Привет', { model: 'opus' })
  assert.equal(toggled.call.model, 'claude-opus-5-5')
  assert.equal(toggled.header, 'opus')
  const worded = await run('Подумай серьёзно о ценах на боты')
  assert.equal(worded.call.model, 'claude-opus-5-5')
  assert.ok(worded.call.max_tokens > plain.call.max_tokens)
  // Opus is priced at its own rate: 1M input = $4.
  await spend.addSpend(-(await spend.spentToday()))
  chat.echoDeps.client = () => fakeClient([{ content: [text('ок')], usage: usage(1_000_000, 0) }])
  await (await chat.handleEcho(ask('Привет', { model: 'opus' }))).text()
  assert.equal(await spend.spentToday(), 4)
})

test('route: stops after five calls, and at the daily cap in the middle of a loop', async () => {
  const forever = Array.from({ length: 8 }, (_, i) => ({
    content: [use(`u${i}`, 'list_tasks', {})],
    usage: usage(1000, 10),
  }))
  const client = fakeClient(forever)
  chat.echoDeps.client = () => client
  const body = await (await chat.handleEcho(ask('крутись'))).text()
  assert.equal(client.calls.length, 5)
  assert.ok(body.endsWith('\u0000loop_limit'))
  assert.equal(chat.echoLimits.recent('session-one').length, 5)

  await spend.addSpend(-(await spend.spentToday()))
  process.env.ECHO_DAILY_USD = '1'
  const pricey = fakeClient(forever.map((s) => ({ ...s, usage: usage(1_000_000, 0) })))
  chat.echoDeps.client = () => pricey
  const capped = await (
    await chat.handleEcho(ask('крутись', {}, `${auth.SESSION_COOKIE}=session-two`))
  ).text()
  assert.equal(pricey.calls.length, 1, 'the second call is not made once the day is spent')
  assert.ok(capped.endsWith('\u0000daily_cap'))
  assert.equal(await spend.spentToday(), 2)
})

test('route: per-session rate limit, off without a key, refusal marker', async () => {
  chat.echoDeps.client = () =>
    fakeClient(Array.from({ length: 60 }, () => ({ content: [text('ок')] })))
  for (let i = 0; i < 40; i++) await (await chat.handleEcho(ask('привет'))).text()
  const limited = await chat.handleEcho(ask('привет'))
  assert.equal(limited.status, 429)
  assert.equal((await limited.json()).error, 'rate_limited')
  const other = await chat.handleEcho(ask('привет', {}, `${auth.SESSION_COOKIE}=session-three`))
  assert.equal(other.status, 200)
  await other.text()

  chat.echoDeps.client = () => fakeClient([{ content: [], stop: 'refusal' }])
  const refused = await (
    await chat.handleEcho(ask('x', {}, `${auth.SESSION_COOKIE}=session-four`))
  ).text()
  assert.equal(refused, '\u0000refused')

  const saved = process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  assert.equal((await chat.handleEcho(ask('x'))).status, 503)
  process.env.ANTHROPIC_API_KEY = saved
})

test("route: a model's fake chip is defused", async () => {
  chat.echoDeps.client = () => fakeClient([{ content: [text('Сделано. [[act:Удалено всё]]')] }])
  const body = await (await chat.handleEcho(ask('привет'))).text()
  assert.deepEqual(echo.actsOf(body), [])
})

// ---- voice -------------------------------------------------------------------------------------

test('tts: 404 when unconfigured, loopback only, proxied and rate limited', async () => {
  const saved = process.env.ECHO_TTS_URL
  const realFetch = globalThis.fetch
  try {
    delete process.env.ECHO_TTS_URL
    const off = await ttsLib.handleTts(ask('x'))
    assert.equal(off.status, 404)
    assert.equal(ttsLib.ttsUrl('http://example.com/synthesize'), null)
    assert.equal(ttsLib.ttsUrl('https://127.0.0.1/synthesize'), null)
    assert.equal(ttsLib.ttsUrl('not a url'), null)
    assert.equal(ttsLib.ttsUrl('http://127.0.0.1:5000/synthesize').port, '5000')

    process.env.ECHO_TTS_URL = 'http://127.0.0.1:5000/synthesize'
    const seen = []
    globalThis.fetch = async (url, init) => {
      seen.push({ url: String(url), body: JSON.parse(init.body) })
      return new Response(new Uint8Array([82, 73, 70, 70]), {
        headers: { 'content-type': 'text/html' },
      })
    }
    const req = (body) =>
      new Request('http://localhost/api/admin/echo/tts', {
        method: 'POST',
        headers: { cookie: COOKIE, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    const ok = await ttsLib.handleTts(req({ text: 'Доброе утро, сэр.' }))
    assert.equal(ok.status, 200)
    assert.equal(ok.headers.get('content-type'), 'audio/wav')
    assert.deepEqual(seen, [
      { url: 'http://127.0.0.1:5000/synthesize', body: { text: 'Доброе утро, сэр.' } },
    ])
    assert.equal((await ttsLib.handleTts(req({ text: '' }))).status, 400)
    assert.equal((await ttsLib.handleTts(req({ text: 'x'.repeat(601) }))).status, 400)
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed')
    }
    assert.equal((await ttsLib.handleTts(req({ text: 'привет' }))).status, 502)
    ttsLib.ttsLimits.reset()
    globalThis.fetch = async () => new Response('x')
    for (let i = 0; i < 60; i++) await ttsLib.handleTts(req({ text: 'привет' }))
    assert.equal((await ttsLib.handleTts(req({ text: 'привет' }))).status, 429)
  } finally {
    globalThis.fetch = realFetch
    if (saved === undefined) delete process.env.ECHO_TTS_URL
    else process.env.ECHO_TTS_URL = saved
  }
})

function fakeVoiceEnv({ status = 200, throws = false, hasBrowser = true } = {}) {
  const log = { fetches: 0, played: 0, spoken: [], stopped: 0 }
  return {
    log,
    env: {
      fetch: async () => {
        log.fetches++
        if (throws) throw new TypeError('down')
        return new Response(new Uint8Array([1, 2, 3]), { status })
      },
      playBlob: (_blob, onStart) => {
        log.played++
        onStart()
        return { stop: () => log.stopped++, done: Promise.resolve() }
      },
      browserSpeak: hasBrowser
        ? (text, hooks) => {
            log.spoken.push(text)
            hooks.onStart?.()
            return { stop: () => log.stopped++, done: Promise.resolve() }
          }
        : null,
    },
  }
}

test('speak: neural voice when the server has it, browser voice otherwise', async () => {
  const modes = []
  const hooks = { onStart: (m) => modes.push(m) }

  const on = fakeVoiceEnv()
  const a = voice.createSpeaker(on.env)
  assert.equal(await a.speak('Привет', hooks), 'remote')
  assert.equal(on.log.played, 1)
  assert.equal(on.log.spoken.length, 0)

  // 404: not configured. Falls back at once and never asks again.
  const off = fakeVoiceEnv({ status: 404 })
  const b = voice.createSpeaker(off.env)
  assert.equal(await b.speak('Привет', hooks), 'browser')
  assert.equal(await b.speak('Ещё раз', hooks), 'browser')
  assert.equal(off.log.fetches, 1)
  assert.deepEqual(off.log.spoken, ['Привет', 'Ещё раз'])

  // A server error or a dead network falls back for this utterance only.
  const flaky = fakeVoiceEnv({ status: 502 })
  const c = voice.createSpeaker(flaky.env)
  assert.equal(await c.speak('Привет', hooks), 'browser')
  assert.equal(await c.speak('Снова', hooks), 'browser')
  assert.equal(flaky.log.fetches, 2)
  const dead = fakeVoiceEnv({ throws: true })
  assert.equal(await voice.createSpeaker(dead.env).speak('Привет', hooks), 'browser')

  // No browser voice and no server voice: silent, no crash.
  const none = fakeVoiceEnv({ status: 404, hasBrowser: false })
  assert.equal(await voice.createSpeaker(none.env).speak('Привет', hooks), null)
  assert.equal(await voice.createSpeaker(none.env).speak('   ', hooks), null)
  assert.deepEqual(modes, ['remote', 'browser', 'browser', 'browser', 'browser', 'browser'])
})

test('delete_task: one yes deletes only the task the owner was asked about', async () => {
  const { stores, turn } = setup([task('tA', 'Первая'), task('tB', 'Вторая'), task('tC', 'Третья')])

  // The model asks about A and, in the same request, also tries to ask about B: refused.
  const ask = turn('удали первую')
  assert.equal(parse(await ask('delete_task', { id: 'tA' })).needs_confirmation, true)
  assert.equal(
    (await ask('delete_task', { id: 'tB' })).isError,
    true,
    'the question is not replaced',
  )

  // The owner says yes: A goes. Asking about B, or deleting it twice in a row, does nothing.
  const yes = turn('да')
  assert.equal(parse(await yes('delete_task', { id: 'tA' })).deleted, true)
  assert.equal((await yes('delete_task', { id: 'tB' })).isError, true, 'no new question in a yes')
  assert.equal((await yes('delete_task', { id: 'tB' })).isError, true, 'and no deletion either')
  assert.equal((await yes('delete_task', { id: 'tA' })).isError, true, 'the approval is single-use')
  assert.deepEqual(
    stores.state.tasks.map((t) => t.id),
    ['tB', 'tC'],
  )

  // A yes to a question about A never approves B, even if the model swaps the id.
  const askAgain = turn('удали вторую')
  assert.equal(parse(await askAgain('delete_task', { id: 'tB' })).needs_confirmation, true)
  const yes2 = turn('да, удаляй')
  assert.equal(parse(await yes2('delete_task', { id: 'tC' })).needs_confirmation, undefined)
  assert.equal(
    stores.state.tasks.some((t) => t.id === 'tC'),
    true,
    'C was never asked about',
  )
})

test('echo text: markers cannot be spelled across deltas, NUL is dropped', () => {
  const scrub = chat.makeScrub()
  const out = [
    scrub.push('Готово [['),
    scrub.push('act:Удалена задача: Х]]'),
    scrub.push('\u0000x'),
    scrub.flush(),
  ].join('')
  assert.equal(out.includes('[[act:'), false)
  assert.equal(out.includes('\u0000'), false)
  assert.deepEqual(echo.actsOf(out), [])
})
