import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, beforeEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Same mapping as admin.test.mjs: 'server-only', '@/...' and 'next/server' for plain Node.
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

const OWNER = 1000
process.env.TELEGRAM_BOT_TOKEN = 'test-token'
process.env.TELEGRAM_CHAT_ID = String(OWNER)

const root = await mkdtemp(path.join(tmpdir(), 'firtech-pulse-test-'))
let dirCount = 0
after(() => rm(root, { recursive: true, force: true }))

// Fake Bot API: keeps the last message text so login() can read the code.
let lastText = ''
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body)
  lastText = body.text ?? lastText
  return Response.json({
    ok: true,
    result: String(url).endsWith('sendMessage') ? { message_id: 1 } : true,
  })
}

beforeEach(() => {
  process.env.DATA_DIR = path.join(root, `d${++dirCount}`)
})

const auth = await import('../src/lib/admin-auth.ts')
const tasks = await import('../src/lib/tasks-store.ts')
const ig = await import('../src/lib/instagram-store.ts')
const md = await import('../src/lib/tasks-md.ts')
const sync = await import('../src/lib/tasks-sync.ts')
const codeRoute = await import('../src/app/api/admin/code/route.ts')
const loginRoute = await import('../src/app/api/admin/login/route.ts')
const tasksRoute = await import('../src/app/api/admin/tasks/route.ts')
const taskRoute = await import('../src/app/api/admin/tasks/[id]/route.ts')
const igRoute = await import('../src/app/api/admin/instagram/route.ts')
const igItemRoute = await import('../src/app/api/admin/instagram/items/[id]/route.ts')
const igDaysRoute = await import('../src/app/api/admin/instagram/days/route.ts')

const ORIGIN = 'http://localhost'
function request(url, { method = 'POST', body, cookie, origin = ORIGIN, browser } = {}) {
  const headers = { host: 'localhost', 'content-type': 'application/json' }
  if (origin) headers.origin = origin
  const cookies = []
  if (cookie) cookies.push(`${auth.SESSION_COOKIE}=${cookie}`)
  if (browser) cookies.push(`${auth.LOGIN_COOKIE}=${browser}`)
  if (cookies.length) headers.cookie = cookies.join('; ')
  return new Request(`${ORIGIN}${url}`, {
    method,
    headers,
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  })
}
async function login() {
  const first = await codeRoute.POST(request('/api/admin/code'))
  const browser = first.headers
    .get('set-cookie')
    .match(new RegExp(`${auth.LOGIN_COOKIE}=([^;]+)`))[1]
  const code = lastText.match(/(\d{6})/)[1]
  const response = await loginRoute.POST(request('/api/admin/login', { body: { code }, browser }))
  assert.equal(response.status, 200)
  return response.headers.get('set-cookie').match(new RegExp(`${auth.SESSION_COOKIE}=([^;]+)`))[1]
}
const params = (id) => ({ params: Promise.resolve({ id }) })
const base = { project: 'firtech', title: 'Проверить смету' }

test('tasks store: create, update, delete and persistence', async () => {
  assert.deepEqual(await tasks.listTasks(), [])
  const task = await tasks.createTask({ ...base, title: '  Позвонить клиенту  ' })
  assert.match(task.id, /^t[0-9a-z]+$/)
  assert.equal(task.title, 'Позвонить клиенту')
  assert.deepEqual(
    {
      status: task.status,
      priority: task.priority,
      due: task.due,
      notes: task.notes,
      source: task.source,
      doneAt: task.doneAt,
    },
    { status: 'todo', priority: 'normal', due: null, notes: '', source: 'ui', doneAt: null },
  )
  const file = path.join(process.env.DATA_DIR, 'tasks.json')
  assert.equal((await stat(file)).mode & 0o777, 0o600)
  assert.equal(JSON.parse(await readFile(file, 'utf8')).tasks[0].id, task.id)

  const changed = await tasks.updateTask(task.id, {
    priority: 'high',
    due: '2026-11-02',
    notes: 'заметка',
  })
  assert.equal(changed.priority, 'high')
  assert.equal(changed.due, '2026-11-02')
  assert.equal((await tasks.listTasks())[0].notes, 'заметка')

  assert.equal(await tasks.updateTask('nope', { title: 'x' }), null)
  assert.equal(await tasks.deleteTask('nope'), false)
  assert.equal(await tasks.deleteTask(task.id), true)
  assert.deepEqual(await tasks.listTasks(), [])
})

test('tasks store: doneAt follows the status', async () => {
  const task = await tasks.createTask(base)
  const done = await tasks.updateTask(task.id, { status: 'done' })
  assert.ok(done.doneAt)
  const again = await tasks.updateTask(task.id, { status: 'done', title: 'Другое имя' })
  assert.equal(again.doneAt, done.doneAt)
  const reopened = await tasks.updateTask(task.id, { status: 'doing' })
  assert.equal(reopened.doneAt, null)
  assert.ok(reopened.updatedAt >= done.updatedAt)
  assert.ok((await tasks.createTask({ ...base, status: 'done' })).doneAt)
})

test('tasks store: validation', async () => {
  const bad = [
    { ...base, title: '   ' },
    { ...base, title: 'x'.repeat(201) },
    { ...base, notes: 'x'.repeat(2001) },
    { ...base, due: '2026-13-40' },
    { ...base, due: '19.10.2026' },
    { ...base, status: 'later' },
    { ...base, priority: 'urgent' },
    { ...base, project: 'other' },
    { ...base, extra: 1 },
  ]
  for (const input of bad) await assert.rejects(tasks.createTask(input))
  const task = await tasks.createTask({ ...base, title: 'x'.repeat(200), notes: 'y'.repeat(2000) })
  await assert.rejects(tasks.updateTask(task.id, { due: 'soon' }))
  await assert.rejects(tasks.updateTask(task.id, {}))
  assert.equal((await tasks.updateTask(task.id, { due: null })).due, null)
  assert.equal((await tasks.listTasks()).length, 1)
})

test('tasks store: concurrent creates lose nothing', async () => {
  const made = await Promise.all(
    Array.from({ length: 25 }, (_, i) => tasks.createTask({ ...base, title: `Задача ${i}` })),
  )
  assert.equal(new Set(made.map((t) => t.id)).size, 25)
  assert.equal((await tasks.listTasks()).length, 25)
})

test('instagram store: seed, publish toggle, days', async () => {
  const items = await ig.listIgItems()
  assert.equal(items.length, 27)
  assert.equal(new Set(items.map((i) => i.id)).size, items.length)
  assert.ok(items.every((i) => /^2026-1[01]-\d\d$/.test(i.date) && /^\d\d:\d\d$/.test(i.time)))
  assert.ok(items.some((i) => i.id === '2026-10-19-1000-01_post_intro' && i.kind === 'post'))
  assert.equal(items.filter((i) => i.kind === 'reel').length, 3)
  assert.ok(items.every((i) => !i.published && i.publishedAt === null))

  const on = await ig.setIgPublished('2026-10-19-1000-01_post_intro', true)
  assert.equal(on.published, true)
  assert.ok(on.publishedAt)
  const stamp = on.publishedAt
  assert.equal((await ig.setIgPublished('2026-10-19-1000-01_post_intro', true)).publishedAt, stamp)
  const off = await ig.setIgPublished('2026-10-19-1000-01_post_intro', false)
  assert.deepEqual([off.published, off.publishedAt], [false, null])
  assert.equal(await ig.setIgPublished('nope', true), null)
  assert.equal((await ig.listIgItems()).length, 27)

  assert.deepEqual(await ig.listIgDays(), [])
  await ig.setIgDay({ date: '2026-10-20', followers: 12, reach: null })
  await ig.setIgDay({ date: '2026-10-19', followers: 10, reach: 100 })
  await ig.setIgDay({ date: '2026-10-20', followers: 15, reach: 200 })
  assert.deepEqual(await ig.listIgDays(), [
    { date: '2026-10-19', followers: 10, reach: 100 },
    { date: '2026-10-20', followers: 15, reach: 200 },
  ])
  for (const bad of [
    { date: '2026-10-20', followers: -1, reach: null },
    { date: '2026-10-20', followers: 1.5, reach: null },
    { date: '2026-99-20', followers: 1, reach: null },
    { date: '20.10.2026', followers: 1, reach: null },
    { date: '2026-10-20', followers: 1 },
  ])
    await assert.rejects(ig.setIgDay(bad))
})

const SAMPLE = `# Задачи

Вступление.

## Fir Tech (firtech.pro)

Ждут решения владельца:
- [ ] Подтвердить цены
      по каждому формату.
- [x] Купить домен (2026-10-16)

Маркетинг:
- [ ] Писать клиентам

Instagram, на завтра (2026-10-19):
- [ ] Reels переделать

Идеи на потом:
- [ ] Генератор смет

## Vibely (vibelydate.com)

- Простая строка без чекбокса.
- [ ] Аудит

## Прочее

- [ ] Не из наших разделов
`

test('TASKS.md: parse', () => {
  const blocks = md.parseTasksMd(SAMPLE)
  assert.deepEqual(
    blocks.map((b) => [b.project, b.status, b.priority, b.title]),
    [
      ['firtech', 'blocked', 'normal', 'Подтвердить цены'],
      ['firtech', 'done', 'normal', 'Купить домен'],
      ['firtech', 'todo', 'normal', 'Писать клиентам'],
      ['instagram', 'todo', 'normal', 'Reels переделать'],
      ['firtech', 'todo', 'low', 'Генератор смет'],
      ['vibely', 'todo', 'normal', 'Аудит'],
    ],
  )
  assert.equal(blocks[0].notes, 'по каждому формату.')
  assert.equal(blocks[1].doneDate, '2026-10-16')
  assert.equal(blocks[3].due, '2026-10-19')
})

test('TASKS.md: export keeps prose and unchanged lines byte for byte', async () => {
  const file = path.join(process.env.DATA_DIR, 'T.md')
  await mkdir(process.env.DATA_DIR, { recursive: true })
  await writeFile(file, SAMPLE)
  const first = await sync.importTasksMd(file)
  assert.deepEqual([first.added, first.closed, first.kept], [6, 0, 0])
  const second = await sync.importTasksMd(file)
  assert.deepEqual([second.added, second.closed, second.kept], [0, 0, 6])
  assert.equal((await tasks.listTasks()).length, 6)

  await sync.exportTasksMd(file)
  assert.equal(await readFile(file, 'utf8'), SAMPLE)
})

test('TASKS.md: panel edits flow back, round trip is stable', async () => {
  const file = path.join(process.env.DATA_DIR, 'T.md')
  await mkdir(process.env.DATA_DIR, { recursive: true })
  await writeFile(file, SAMPLE)
  await sync.importTasksMd(file)
  const all = await tasks.listTasks()
  const byTitle = (t) => all.find((x) => x.title === t)
  await tasks.updateTask(byTitle('Писать клиентам').id, { status: 'done' })
  await tasks.updateTask(byTitle('Генератор смет').id, { title: 'Генератор персональных смет' })
  await tasks.deleteTask(byTitle('Аудит').id)
  await tasks.createTask({ project: 'vibely', title: 'Новая из панели', notes: 'с заметкой' })
  await tasks.createTask({ project: 'firtech', title: 'Ждёт владельца', status: 'blocked' })

  const summary = await sync.exportTasksMd(file)
  assert.deepEqual([summary.updated, summary.removed, summary.added], [2, 1, 2])
  const out = await readFile(file, 'utf8')
  assert.match(out, /^# Задачи\n\nВступление\.\n/)
  assert.match(out, /- \[x\] Писать клиентам \(\d{4}-\d{2}-\d{2}\)/)
  assert.match(out, /- \[ \] Генератор персональных смет/)
  assert.doesNotMatch(out, /Аудит/)
  assert.match(out, /Из панели:\n- \[ \] Новая из панели\n      с заметкой/)
  assert.match(out, /Ждут решения владельца:\n- \[ \] Ждёт владельца/)
  assert.match(out, /## Прочее\n\n- \[ \] Не из наших разделов/)

  // Reading the file back gives the same tasks, and a second export changes nothing.
  const back = md.parseTasksMd(out)
  assert.equal(back.length, 7)
  assert.equal(back.find((b) => b.title === 'Ждёт владельца').status, 'blocked')
  const before = await readFile(file, 'utf8')
  const again = await sync.exportTasksMd(file)
  assert.deepEqual([again.updated, again.removed, again.added], [0, 0, 0])
  assert.equal(await readFile(file, 'utf8'), before)
  const reimport = await sync.importTasksMd(file)
  assert.deepEqual([reimport.added, reimport.closed], [0, 0])
})

test('TASKS.md: import keeps panel edits, closes tasks checked in the file, export refuses drift', async () => {
  const file = path.join(process.env.DATA_DIR, 'T.md')
  await mkdir(process.env.DATA_DIR, { recursive: true })
  await writeFile(file, SAMPLE)
  await sync.importTasksMd(file)
  const all = await tasks.listTasks()
  const prices = all.find((t) => t.title === 'Подтвердить цены')
  await tasks.updateTask(prices.id, { priority: 'high', notes: 'правка в панели' })

  await writeFile(file, SAMPLE.replace('- [ ] Аудит', '- [x] Аудит (2026-10-20)'))
  const r = await sync.importTasksMd(file)
  assert.deepEqual([r.added, r.closed], [0, 1])
  const audit = (await tasks.listTasks()).find((t) => t.title === 'Аудит')
  assert.equal(audit.status, 'done')
  assert.equal(audit.doneAt, '2026-10-20T00:00:00.000Z')
  const kept = (await tasks.listTasks()).find((t) => t.id === prices.id)
  assert.deepEqual([kept.priority, kept.notes], ['high', 'правка в панели'])

  await writeFile(file, (await readFile(file, 'utf8')) + '\nПриписка сессии.\n')
  await assert.rejects(sync.exportTasksMd(file), sync.DriftError)
  await sync.exportTasksMd(file, { force: true })
  assert.match(await readFile(file, 'utf8'), /правка в панели/)
})

// Routes.
const routes = [
  ['GET', '/api/admin/tasks', () => tasksRoute.GET, undefined],
  ['POST', '/api/admin/tasks', () => tasksRoute.POST, base],
  ['PATCH', '/api/admin/tasks/x', () => taskRoute.PATCH, { title: 'a' }, params('x')],
  ['DELETE', '/api/admin/tasks/x', () => taskRoute.DELETE, undefined, params('x')],
  ['GET', '/api/admin/instagram', () => igRoute.GET, undefined],
  [
    'PATCH',
    '/api/admin/instagram/items/x',
    () => igItemRoute.PATCH,
    { published: true },
    params('x'),
  ],
  [
    'PUT',
    '/api/admin/instagram/days',
    () => igDaysRoute.PUT,
    { date: '2026-10-20', followers: 1, reach: 2 },
  ],
]

test('routes: 401 without a session, 403 without same origin', async () => {
  const cookie = await login()
  for (const [method, url, handler, body, ctx] of routes) {
    const run = (opts) => handler()(request(url, { method, body, ...opts }), ctx)
    assert.equal((await run({})).status, 401, `${method} ${url}`)
    if (method !== 'GET') {
      assert.equal((await run({ cookie, origin: null })).status, 403, `${method} ${url}`)
      assert.equal(
        (await run({ cookie, origin: 'https://evil.example' })).status,
        403,
        `${method} ${url}`,
      )
    }
  }
  assert.deepEqual(await tasks.listTasks(), [])
})

test('routes: tasks API', async () => {
  const cookie = await login()
  const send = (handler, url, method, body, ctx) =>
    handler(request(url, { method, body, cookie }), ctx)

  let response = await send(tasksRoute.POST, '/api/admin/tasks', 'POST', base)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const { task } = await response.json()

  for (const body of [
    { title: 'без проекта' },
    { ...base, extra: 1 },
    { ...base, due: 'завтра' },
    '{broken',
    '',
    { ...base, notes: 'x'.repeat(30_000) },
  ])
    assert.equal((await send(tasksRoute.POST, '/api/admin/tasks', 'POST', body)).status, 400)

  response = await send(tasksRoute.GET, '/api/admin/tasks', 'GET')
  assert.deepEqual(
    (await response.json()).tasks.map((t) => t.id),
    [task.id],
  )

  response = await send(
    taskRoute.PATCH,
    `/api/admin/tasks/${task.id}`,
    'PATCH',
    { status: 'done' },
    params(task.id),
  )
  assert.equal(response.status, 200)
  assert.equal((await response.json()).task.status, 'done')
  for (const body of [{}, { id: 'z' }, { status: 'x' }])
    assert.equal((await send(taskRoute.PATCH, '/x', 'PATCH', body, params(task.id))).status, 400)
  assert.equal(
    (await send(taskRoute.PATCH, '/x', 'PATCH', { title: 'a' }, params('nope'))).status,
    404,
  )

  assert.equal(
    (await send(taskRoute.DELETE, '/x', 'DELETE', undefined, params('nope'))).status,
    404,
  )
  response = await send(taskRoute.DELETE, '/x', 'DELETE', undefined, params(task.id))
  assert.deepEqual(await response.json(), { ok: true })
  assert.deepEqual(await tasks.listTasks(), [])
})

test('routes: Instagram API', async () => {
  const cookie = await login()
  const send = (handler, url, method, body, ctx) =>
    handler(request(url, { method, body, cookie }), ctx)

  let response = await send(igRoute.GET, '/api/admin/instagram', 'GET')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const data = await response.json()
  assert.equal(data.items.length, 27)
  assert.deepEqual(data.days, [])

  const id = data.items[0].id
  response = await send(igItemRoute.PATCH, '/x', 'PATCH', { published: true }, params(id))
  assert.equal((await response.json()).item.published, true)
  for (const body of [{}, { published: 'yes' }, { published: true, x: 1 }])
    assert.equal((await send(igItemRoute.PATCH, '/x', 'PATCH', body, params(id))).status, 400)
  assert.equal(
    (await send(igItemRoute.PATCH, '/x', 'PATCH', { published: true }, params('nope'))).status,
    404,
  )

  response = await send(igDaysRoute.PUT, '/x', 'PUT', {
    date: '2026-10-20',
    followers: 5,
    reach: null,
  })
  assert.deepEqual(await response.json(), {
    day: { date: '2026-10-20', followers: 5, reach: null },
  })
  for (const body of [
    { date: '2026-10-20', followers: -5, reach: null },
    { date: 'x', followers: 1, reach: 1 },
    { date: '2026-10-20', followers: 1 },
    { date: '2026-10-20', followers: 1, reach: 1, z: 1 },
  ])
    assert.equal((await send(igDaysRoute.PUT, '/x', 'PUT', body)).status, 400)
  assert.equal((await (await send(igRoute.GET, '/x', 'GET')).json()).days.length, 1)
})

test('tasks: a title or a note is one line, so it cannot write sections into TASKS.md', async () => {
  const tasks = await import('../src/lib/tasks-store.ts')
  const md = await import('../src/lib/tasks-md.ts')
  const task = await tasks.createTask({
    project: 'firtech',
    title: 'ok\n## Vibely (vibelydate.com)\n- [ ] Injected line',
    notes: 'a\r\nb\u0000c\u2028d',
  })
  assert.equal(/[\n\r\u0000\u2028]/.test(task.title + task.notes), false)
  assert.equal(task.title, 'ok ## Vibely (vibelydate.com) - [ ] Injected line')
  const lines = md.formatBlock(task)
  assert.equal(lines.length >= 1, true)
  // However it is written, it parses back as ONE task, not a new section and a second task.
  const blocks = md.parseTasksMd(`## Fir Tech (firtech.pro)\n\n${lines.join('\n')}\n`)
  assert.equal(blocks.length, 1)
})

test('TASKS.md: an impossible date in a caption or a done line is just no date', async () => {
  const md = await import('../src/lib/tasks-md.ts')
  const blocks = md.parseTasksMd(
    '## Fir Tech (firtech.pro)\n\nЖдут решения (2026-02-30):\n- [ ] Что-то\n- [x] Готово (2026-13-45)\n',
  )
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].due, null)
  assert.equal(blocks[1].doneDate, null)
})
