import { officeMock } from './office-mock'
import {
  effectivePresence,
  sameId,
  type Approval,
  type HqDepartment,
  type HqTask,
  type Id,
  type InboxItem,
  type InboxKind,
  type PresenceMode,
  type TaskEvent,
} from './hq-admin-view'

// Stand-in for HQ's admin API (same shapes as the contract), used in development when HQ_ADMIN_URL
// is unset. It keeps state in memory, so approving, retrying, typing to the Director and switching
// presence behave like the real thing until the dev server restarts. People and task ids match
// office-mock.ts, so clicking a person in the pixel office filters to their tasks.

type Query = Record<string, string>
type Json = Record<string, unknown>
export type MockReply = { ok: true; [k: string]: unknown } | { ok: false; error: string }

type DrillRow = { id: string; title: string; startedAt: number; answerAfterS: number; fails: boolean }

type MockState = {
  // Proposals held for the 10:00 batch (approvalsQueued); /command approve releases them.
  queued: Approval[]
  decided: Set<string>
  mode: PresenceMode
  lastPingAt: string | null
  awayAfterMin: number
  paused: boolean
  inbox: InboxItem[]
  approvals: Approval[]
  tasks: HqTask[]
  events: Map<string, TaskEvent[]>
  nextInbox: number
  nextTask: number
  tick: number
  drill: { dept: string; rows: DrillRow[] } | null
}

const TZ = 'Asia/Tashkent'
const iso = (t: number) => new Date(t).toISOString()

const titles = (): Map<string, { title: string; dept: string }> => {
  const office = officeMock()
  const map = new Map<string, { title: string; dept: string }>([['director', { title: 'Director', dept: 'director' }]])
  for (const d of office.departments) {
    map.set(d.head.id, { title: d.head.title, dept: d.id })
    for (const w of d.workers) map.set(w.id, { title: w.title, dept: d.id })
  }
  return map
}

function seed(now: number): MockState {
  const ago = (min: number) => iso(now - min * 60_000)
  const people = titles()
  const ev = (min: number, kind: string, actor: string, body: string): TaskEvent => ({ at: ago(min), kind, actor, body })
  const task = (
    id: number,
    title: string,
    status: string,
    assigneeId: string,
    minAgo: number,
    extra: Partial<HqTask> = {},
  ): HqTask => {
    const who = people.get(assigneeId)
    return {
      id,
      title,
      dept: who?.dept ?? 'marketing',
      status,
      assigneeId,
      assigneeTitle: who?.title ?? assigneeId,
      priority: 'normal',
      dueAt: null,
      createdAt: ago(minAgo + 60),
      updatedAt: ago(minAgo),
      tags: [],
      progressLine: null,
      lastEvent: null,
      ...extra,
    }
  }
  const tasks: HqTask[] = [
    task(11, 'Отчёт за неделю для владельца', 'done', 'analyst', 90, { tags: ['отчёт'] }),
    task(12, 'Пачка контента на эту неделю', 'running', 'marketing-head', 20, { priority: 'high', tags: ['план'] }),
    task(13, 'Клип: ИИ-приёмщик', 'running', 'content-maker', 7, { tags: ['видео'] }),
    task(14, 'Пост в Telegram: кейс бота', 'approval', 'publisher', 42),
    task(15, 'Статья: сайт для барбершопа', 'blocked', 'seo-specialist', 180, {
      lastEvent: ev(180, 'task.blocked', 'seo-specialist', 'Нет доступа к Search Console: нужен токен'),
    }),
    task(16, 'Тренды недели: ИИ-боты', 'assigned', 'trend-scout', 3),
    task(17, 'Обложки для рилсов', 'review', 'content-maker', 15),
    task(18, 'Идеи для блога на декабрь', 'inbox', 'marketing-head', 4),
    task(21, 'Новая заявка: квалификация', 'running', 'lead-handler', 2, { priority: 'high' }),
    task(22, 'Список: салоны красоты Душанбе', 'running', 'prospector', 35),
    task(23, 'КП для «Барбер Хаус»', 'approval', 'presales', 55, { priority: 'high', dueAt: iso(now + 4 * 3600_000) }),
    task(24, 'Ответить на отзыв в Google', 'done', 'sales-head', 30),
    task(31, 'Проверка аптайма за ночь', 'done', 'monitoring', 240),
    task(32, 'Письмо клиенту: продление поддержки', 'blocked', 'customer-support', 60 * 5, {
      lastEvent: ev(60 * 5, 'task.failed', 'customer-support', 'Агент на паузе: отдел выключен'),
    }),
    task(41, 'Счёт на оплату хостинга', 'approval', 'finance', 25, { tags: ['деньги'] }),
    task(42, 'Договор-шаблон для сайтов', 'review', 'documents', 70),
    task(43, 'Сверка расходов за ноябрь', 'assigned', 'back-office-head', 300),
    task(51, 'План работ по сайту клиента', 'inbox', 'project-manager', 60 * 26),
  ]
  const events = new Map<string, TaskEvent[]>()
  for (const t of tasks) {
    const list: TaskEvent[] = [ev(Math.max(1, (now - Date.parse(t.createdAt)) / 60_000 | 0), 'task.created', 'director', `Директор поставил задачу «${t.title}»`)]
    if (t.status !== 'inbox') list.push(ev(Math.max(1, (now - Date.parse(t.updatedAt)) / 60_000 + 20 | 0), 'task.assigned', 'director', `Назначено: ${t.assigneeTitle}`))
    if (t.lastEvent) list.push(t.lastEvent)
    else list.push(ev((now - Date.parse(t.updatedAt)) / 60_000 | 0, `task.${t.status}`, t.assigneeId ?? 'director', `Статус: ${t.status}`))
    t.lastEvent = list.at(-1)!
    events.set(String(t.id), list)
  }
  const approvals: Approval[] = [
    {
      id: 101,
      kind: 'content_item',
      dept: 'marketing',
      summary: 'Кейс бота для кофейни: пост в канал и сторис',
      text: 'Сделали бота для кофейни: заказ за 30 секунд, оплата в чате, повар видит заказ на планшете. Хотите так же? Напишите нам.',
      parts: [
        { id: 'post', label: 'Пост в канал' },
        { id: 'story', label: 'Сторис' },
      ],
      level: 2,
      taskId: 14,
      createdAt: ago(42),
      locked: true,
    },
    {
      id: 102,
      kind: 'proposal',
      dept: 'sales',
      summary: 'КП для «Барбер Хаус»: сайт с онлайн-записью',
      text: 'Здравствуйте! По вашему запросу подготовили предложение: сайт с онлайн-записью и напоминаниями в Telegram.\n\nСрок 10 рабочих дней, цена от $450. Первый созвон бесплатно, можно завтра в 11:00.',
      parts: null,
      level: 2,
      taskId: 23,
      createdAt: ago(55),
      locked: false,
    },
    {
      id: 103,
      kind: 'payment',
      dept: 'back-office',
      summary: 'Оплатить хостинг на 3 месяца: $36',
      text: 'DigitalOcean, дроплет firtech-sg-1, 3 месяца по $12. Карта студии.',
      parts: null,
      level: 3,
      taskId: 41,
      createdAt: ago(25),
      locked: true,
    },
  ]
  const item = (id: number, min: number, kind: InboxKind, text: string, extra: Partial<InboxItem> = {}): InboxItem => ({
    id,
    at: ago(min),
    kind,
    text,
    read: false,
    deliveredTg: false,
    ...extra,
  })
  const inbox: InboxItem[] = [
    item(1, 60 * 15, 'summary', 'Утренняя сводка: 4 задачи в работе, 3 одобрения ждут, расходы вчера $0.42.', { read: true, deliveredTg: true }),
    item(2, 180, 'alert', 'SEO Specialist застрял: нет доступа к Search Console.', { taskId: 15, read: true, deliveredTg: true }),
    item(3, 60, 'progress', 'Аналитик закончил отчёт за неделю.', { taskId: 11, read: true }),
    item(4, 55, 'approval', 'Presales ждёт одобрения КП для «Барбер Хаус».', { approvalId: 102, taskId: 23 }),
    item(5, 42, 'approval', 'Publisher ждёт одобрения поста про бота для кофейни.', { approvalId: 101, taskId: 14 }),
    item(6, 25, 'approval', 'Finance просит оплатить хостинг: $36.', { approvalId: 103, taskId: 41 }),
    item(7, 9, 'message', 'Директор: Content Maker закончит клип к вечеру, обложки на проверке.', { taskId: 13 }),
    item(8, 2, 'progress', 'Lead Handler взял новую заявку в работу.', { taskId: 21 }),
  ]
  const queued: Approval[] = [
    {
      id: 104,
      kind: 'proposal',
      dept: 'sales',
      summary: 'Холодное письмо: салон «Лотос»',
      text: 'Здравствуйте! Мы делаем сайты с онлайн-записью для салонов красоты. Покажем пример за 10 минут?',
      parts: null,
      level: 1,
      taskId: 22,
      createdAt: ago(30),
      locked: false,
    },
    {
      id: 105,
      kind: 'proposal',
      dept: 'sales',
      summary: 'Холодное письмо: салон «Нигина»',
      text: 'Здравствуйте! Видели ваш Instagram. Можем сделать запись онлайн прямо из профиля, без звонков.',
      parts: null,
      level: 1,
      taskId: 22,
      createdAt: ago(28),
      locked: false,
    },
  ]
  return {
    queued,
    decided: new Set<string>(),
    mode: 'desk',
    lastPingAt: iso(now),
    awayAfterMin: 10,
    paused: false,
    inbox,
    approvals,
    tasks,
    events,
    nextInbox: 9,
    nextTask: 60,
    tick: Math.floor(now / 90_000),
    drill: null,
  }
}

const ticker = [
  ['progress', 'Content Maker: черновой монтаж клипа готов.', 13],
  ['progress', 'Prospector добавил 5 салонов в список.', 22],
  ['message', 'Директор: Head of Marketing собрал пачку на неделю, жду одобрения поста.', 12],
  ['progress', 'Lead Handler: заявка квалифицирована, бюджет до $500.', 21],
] as const

const progressLines: Record<string, string[]> = {
  '12': ['Шаг 2 из 5: темы недели', 'Шаг 3 из 5: черновики постов', 'Шаг 4 из 5: сверка с планом'],
  '13': ['Монтаж: 40%', 'Монтаж: 65%', 'Монтаж: 85%, субтитры'],
  '21': ['Читаю заявку', 'Сверяю с прайсом', 'Пишу ответ клиенту'],
  '22': ['Найдено 12 салонов', 'Найдено 17 салонов', 'Проверяю контакты: 9 из 17'],
}

const deptTitles: Record<string, string> = {
  marketing: 'Маркетинг',
  sales: 'Продажи',
  support: 'Сопровождение',
  production: 'Производство',
  'back-office': 'Бэк-офис',
}

function drillText(state: MockState, now: number): string {
  if (!state.drill) return 'Учения не запускались. Нажмите «Запустить учения».'
  const lines = state.drill.rows.map((r) => {
    const s = (now - r.startedAt) / 1000
    const mark = s < r.answerAfterS ? '⏳' : r.fails ? '🔴' : s < r.answerAfterS + 4 ? '🟡' : '🟢'
    const note =
      mark === '⏳' ? 'ждём ответ' : mark === '🔴' ? 'не ответил' : mark === '🟡' ? `ответил за ${r.answerAfterS} с, проверяю` : `ответил за ${r.answerAfterS} с`
    return `${mark} ${r.title.padEnd(20)} ${note}`
  })
  const head = `Учения: ${state.drill.dept === 'all' ? 'все отделы' : (deptTitles[state.drill.dept] ?? state.drill.dept)}`
  return [head, '', ...lines, '', '⏳ ждём  🟡 проверяю  🟢 ответил  🔴 не ответил'].join('\n')
}

export function createHqMock(start = Date.now()) {
  const state = seed(start)
  const office = () => officeMock()

  const addInbox = (now: number, kind: InboxKind, text: string, extra: Partial<InboxItem> = {}) => {
    state.inbox.push({
      id: state.nextInbox++,
      at: iso(now),
      kind,
      text,
      read: false,
      deliveredTg: effectivePresence(state.mode, state.lastPingAt, state.awayAfterMin, now) === 'away',
      ...extra,
    })
  }

  // Time moves on: a new inbox row every 90 s and fresh progress lines on running tasks.
  const advance = (now: number) => {
    const tick = Math.floor(now / 90_000)
    while (state.tick < tick) {
      state.tick++
      const [kind, text, taskId] = ticker[state.tick % ticker.length]!
      addInbox(now, kind, text, { taskId })
    }
    const step = Math.floor(now / 30_000)
    for (const t of state.tasks) {
      const lines = progressLines[String(t.id)]
      if (lines && t.status === 'running') t.progressLine = lines[step % lines.length] ?? null
    }
  }

  const findTask = (id: string) => state.tasks.find((t) => String(t.id) === id)

  const pushEvent = (task: HqTask, event: TaskEvent) => {
    const list = state.events.get(String(task.id)) ?? []
    list.push(event)
    state.events.set(String(task.id), list)
    task.lastEvent = event
    task.updatedAt = event.at
  }

  const stateBody = (now: number) => ({
    ok: true as const,
    presence: {
      mode: state.mode,
      effective: effectivePresence(state.mode, state.lastPingAt, state.awayAfterMin, now),
      lastPingAt: state.lastPingAt,
      awayAfterMin: state.awayAfterMin,
    },
    inboxUnread: state.inbox.filter((i) => !i.read).length,
    approvalsPending: state.approvals.length,
    approvalsQueued: state.queued.length,
    tasksOpen: state.tasks.filter((t) => !['done', 'cancelled'].includes(t.status)).length,
    builderIssues: office().director.openBuilderIssues,
    quietHours: false,
    tz: TZ,
    generatedAt: iso(now),
    mock: true,
  })

  const departments = (): HqDepartment[] =>
    office().departments.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.head.status === 'paused' ? 'paused' : 'active',
      headId: d.head.id,
      headTitle: d.head.title,
      workers: d.workers.map((w) => ({ id: w.id, title: w.title, status: w.status })),
      counts: Object.fromEntries(
        ['inbox', 'assigned', 'running', 'review', 'approval', 'blocked', 'done'].map((s) => [
          s,
          state.tasks.filter((t) => t.dept === d.id && t.status === s).length,
        ]),
      ),
    }))

  const say = (text: string, now: number) => {
    const lower = text.toLowerCase()
    const dept = /клиент|кп|продаж|заявк/.test(lower)
      ? 'sales'
      : /счёт|счет|оплат|договор/.test(lower)
        ? 'back-office'
        : /сайт|проект/.test(lower)
          ? 'production'
          : 'marketing'
    const head = office().departments.find((d) => d.id === dept)!.head
    const id = state.nextTask++
    const title = text.length > 70 ? `${text.slice(0, 69)}…` : text
    const task: HqTask = {
      id,
      title,
      dept,
      status: 'assigned',
      assigneeId: head.id,
      assigneeTitle: head.title,
      priority: 'normal',
      dueAt: null,
      createdAt: iso(now),
      updatedAt: iso(now),
      tags: ['от владельца'],
      progressLine: null,
      lastEvent: null,
    }
    state.tasks.push(task)
    pushEvent(task, { at: iso(now), kind: 'task.created', actor: 'director', body: `Владелец: ${text}` })
    pushEvent(task, { at: iso(now), kind: 'task.assigned', actor: 'director', body: `Назначено: ${head.title}` })
    return {
      replies: [
        `Принял. Задача #${id} «${title}» ушла в отдел ${deptTitles[dept]}, ведёт ${head.title}.`,
        'Напишу сюда, когда будет результат или понадобится твоё решение.',
      ],
      taskId: id,
    }
  }

  const command = (name: string, arg: string, now: number): string[] => {
    const s = stateBody(now)
    switch (name) {
      case 'status':
        return [
          `<b>Статус</b>\nТы: ${s.presence.effective === 'desk' ? 'на месте' : 'не на месте'}\nЗадач открыто: ${s.tasksOpen}\nОдобрений ждут: ${s.approvalsPending}\nНепрочитанных: ${s.inboxUnread}\nIssues билдера: ${s.builderIssues}${state.paused ? '\nКомпания на паузе.' : ''}`,
        ]
      case 'tasks':
        return [
          state.tasks
            .filter((t) => !['done', 'cancelled'].includes(t.status))
            .slice(0, 12)
            .map((t) => `#${t.id} [${t.status}] ${t.title} (${t.assigneeTitle})`)
            .join('\n') || 'Открытых задач нет.',
        ]
      case 'approve':
        if (state.queued.length) {
          const n = state.queued.length
          state.approvals.push(...state.queued)
          state.queued = []
          return [`Выпустил очередь: ${n} предложения ждут одобрения.`]
        }
        return state.approvals.length
          ? state.approvals.map((a) => `#${a.id} ${a.locked ? '🔒 ' : ''}${a.summary}`)
          : ['Одобрений в очереди нет.']
      case 'costs':
        return [`Расходы сегодня: $${office().costs.todayUsd.toFixed(2)}, за месяц: $${office().costs.monthUsd.toFixed(2)}.`]
      case 'builders':
        return [`Открытых issues билдера: ${s.builderIssues}.\n#7 Добавить роут /admin в HQ`]
      case 'org':
        return [departments().map((d) => `${deptTitles[d.id] ?? d.title}: ${d.headTitle}, людей ${d.workers.length + 1}`).join('\n')]
      case 'pause':
        state.paused = true
        return ['Поставил компанию на паузу. Новые задачи не берём, текущие доделываем.']
      case 'resume':
        state.paused = false
        return ['Работаем дальше.']
      case 'drill':
        return [drillText(state, now)]
      case 'retry': {
        const t = findTask(arg.replace(/^#/, ''))
        if (!t) return ['Укажи номер задачи: /retry 15']
        retry(t, now)
        return [`Задача #${t.id} снова в работе.`]
      }
      case 'desk':
        state.mode = 'desk'
        state.lastPingAt = iso(now)
        return ['Ты на месте: уведомления идут в пульт.']
      case 'away':
        state.mode = 'away'
        return ['Ты не на месте: уведомления идут в Telegram.']
      case 'help':
        return ['/status /tasks /approve /costs /builders /org /pause /resume /drill /retry N /desk /away\nИли просто напиши задачу словами.']
      case 'marketing':
      case 'sales':
      case 'support':
      case 'production':
      case 'backoffice':
      case 'back-office': {
        const id = name === 'backoffice' ? 'back-office' : name
        const d = departments().find((x) => x.id === id)!
        const open = state.tasks.filter((t) => t.dept === id && t.status !== 'done')
        return [`${deptTitles[id]}: ведёт ${d.headTitle}. Открыто задач: ${open.length}.\n${open.map((t) => `#${t.id} ${t.title}`).join('\n')}`]
      }
      default:
        return [`Не знаю команду /${name}. Напиши /help.`]
    }
  }

  const retry = (task: HqTask, now: number) => {
    task.status = 'assigned'
    task.progressLine = null
    pushEvent(task, { at: iso(now), kind: 'task.retry', actor: 'owner', body: 'Владелец нажал «Повторить»' })
    addInbox(now, 'progress', `Задача #${task.id} снова в очереди: ${task.title}.`, { taskId: task.id, read: true })
  }

  return function handle(method: 'GET' | 'POST', path: string, query: Query = {}, body: Json = {}, now = Date.now()): MockReply {
    advance(now)
    const seg = path.split('/').filter(Boolean)
    const key = `${method} ${seg[0] ?? ''}`
    switch (key) {
      case 'GET state':
        return stateBody(now)
      case 'POST ping':
        state.lastPingAt = iso(now)
        return stateBody(now)
      case 'POST presence':
        state.mode = body.mode === 'away' ? 'away' : 'desk'
        if (state.mode === 'desk') state.lastPingAt = iso(now)
        return stateBody(now)
      case 'GET inbox': {
        const limit = Math.min(200, Number(query.limit) || 50)
        let items = [...state.inbox].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        if (query.unread === '1') items = items.filter((i) => !i.read)
        if (query.after) items = items.filter((i) => Number(i.id) > Number(query.after))
        return { ok: true, items: items.slice(0, limit) }
      }
      case 'POST inbox':
        if (seg[1] !== 'read') return { ok: false, error: 'not_found' }
        if (body.all === true) for (const i of state.inbox) i.read = true
        else if (Array.isArray(body.ids)) {
          const ids = new Set((body.ids as Id[]).map(String))
          for (const i of state.inbox) if (ids.has(String(i.id))) i.read = true
        }
        return { ok: true }
      case 'GET approvals':
        return { ok: true, items: state.approvals }
      case 'POST approvals': {
        const a = state.approvals.find((x) => String(x.id) === seg[1])
        if (!a) return { ok: false, error: state.decided.has(seg[1] ?? '') ? 'already_decided' : 'not_found' }
        const partLabel = a.parts?.find((p) => body.part !== undefined && String(p.id) === String(body.part))?.label
        if (body.action === 'edit') {
          a.text = String(body.text ?? '')
          return { ok: true, status: 'pending', message: partLabel ? `Правка сохранена: ${partLabel}.` : 'Правка сохранена.', notes: [] }
        }
        state.decided.add(String(a.id))
        state.approvals = state.approvals.filter((x) => x !== a)
        const task = a.taskId !== null ? findTask(String(a.taskId)) : undefined
        const approved = body.action === 'approve'
        if (task) {
          task.status = approved ? 'running' : 'review'
          pushEvent(task, {
            at: iso(now),
            kind: approved ? 'approval.approved' : 'approval.rejected',
            actor: 'owner',
            body: approved ? 'Владелец одобрил' : 'Владелец отклонил, вернули на доработку',
          })
        }
        for (const i of state.inbox) if (sameId(i.approvalId, a.id)) i.read = true
        return {
          ok: true,
          status: approved ? 'approved' : 'rejected',
          message: approved ? (a.kind === 'payment' ? 'Оплата отправлена в Finance.' : 'Одобрено, исполняем.') : 'Отклонено, вернули на доработку.',
          notes: partLabel ? [`Часть: ${partLabel}`] : [],
        }
      }
      case 'GET tasks': {
        if (seg[1]) {
          const t = findTask(seg[1])
          if (!t) return { ok: false, error: 'task_not_found' }
          const children = state.tasks.filter((c) => c.id !== t.id && c.dept === t.dept && Number(c.id) > Number(t.id) && Number(c.id) < Number(t.id) + 3)
          return {
            ok: true,
            task: {
              ...t,
              body: `Задача от директора: ${t.title}. Сделать по шаблону отдела, результат прислать на проверку.`,
              result: t.status === 'done' ? 'Готово, файл в общей папке.' : null,
              creator: 'director',
              parentId: [13, 14].includes(Number(t.id)) ? 12 : null,
              costUsd: Number(t.id) % 5 === 0 ? 0 : 0.01 * (Number(t.id) % 7),
            },
            events: state.events.get(String(t.id)) ?? [],
            approvals: state.approvals.filter((a) => sameId(a.taskId, t.id)),
            children: t.id === 12 ? children : [],
          }
        }
        let items = [...state.tasks].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        if (query.dept) items = items.filter((t) => t.dept === query.dept)
        if (query.status) {
          const wanted = new Set(query.status.split(','))
          items = items.filter((t) => wanted.has(t.status))
        }
        if (query.open === '1') items = items.filter((t) => t.status !== 'done')
        return { ok: true, items: items.slice(0, Math.min(500, Number(query.limit) || 200)) }
      }
      case 'POST tasks': {
        const t = findTask(seg[1] ?? '')
        if (!t || seg[2] !== 'retry') return { ok: false, error: 'task_not_found' }
        retry(t, now)
        return { ok: true, replies: [`Задача #${t.id} снова в очереди.`], task: t }
      }
      case 'POST say':
        return { ok: true, ...say(String(body.text ?? ''), now) }
      case 'POST command':
        return { ok: true, replies: command(String(body.name ?? ''), String(body.arg ?? ''), now) }
      case 'GET departments':
        return { ok: true, items: departments() }
      case 'GET drill':
        return { ok: true, text: drillText(state, now) }
      case 'POST drill': {
        const arg = String(body.arg ?? '').trim()
        if (arg === 'clear') {
          state.drill = null
          return { ok: true, text: 'Учения очищены.' }
        }
        if (arg === 'table') return { ok: true, text: drillText(state, now) }
        const dept = arg || 'all'
        const rows: DrillRow[] = []
        for (const d of office().departments) {
          if (dept !== 'all' && d.id !== dept) continue
          for (const [i, a] of [d.head, ...d.workers].entries()) {
            rows.push({
              id: a.id,
              title: a.title,
              startedAt: now,
              answerAfterS: 2 + ((i * 3 + a.id.length) % 9),
              fails: a.status === 'paused' || a.status === 'offline',
            })
          }
        }
        state.drill = { dept, rows }
        return { ok: true, text: drillText(state, now) }
      }
      default:
        return { ok: false, error: 'not_found' }
    }
  }
}

export type HqMock = ReturnType<typeof createHqMock>

// One mock per dev server process (kept on globalThis so hot reloads keep its state).
const holder = globalThis as typeof globalThis & { __firtechHqMock?: HqMock }
export function hqMock(): HqMock {
  holder.__firtechHqMock ??= createHqMock()
  return holder.__firtechHqMock
}
