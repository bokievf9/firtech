import { officeMock } from './office-mock'
import { createPultMock } from './shell-mock'
import { createReviewMock } from './review-mock'
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
export type MockReply = { ok: true; [k: string]: unknown } | { ok: false; error: string; allowed?: string[]; from?: unknown; mail?: unknown }

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
    task(13, 'Клип: ИИ-менеджер заявок', 'running', 'content-maker', 7, { tags: ['видео'] }),
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
    item(8, 2, 'progress', 'Lead manager взял новую заявку в работу.', { taskId: 21 }),
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
  ['progress', 'Lead manager: заявка квалифицирована, бюджет до $500.', 21],
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

// ---- CRM views (agents/docs/admin-crm-api.md): a small fixed dataset, same shapes and the same
// prospect state machine (409 on illegal transitions), kept in memory with the rest of the mock.
const PROSPECT_STATUSES = ['new', 'proposed', 'sent', 'replied', 'no_reply', 'skipped']
const PROSPECT_NEXT: Record<string, string[]> = {
  new: ['proposed', 'skipped'],
  proposed: ['sent', 'skipped'],
  sent: ['replied', 'no_reply', 'skipped'],
  no_reply: ['replied'],
  replied: [],
  skipped: [],
}

type Row = Record<string, unknown> & { id: number | string }

export function createCrmMock(start = Date.now()) {
  const ago = (min: number) => iso(start - min * 60_000)
  const ahead = (days: number) => iso(start + days * 86_400_000)
  const prospect = (id: number, over: Record<string, unknown>): Row => ({
    id, name: '', niche: '', city: 'Dushanbe', website: '', instagram: '', telegram: '', phone: '',
    noticed: '', offer: '', hook: '', source: 'scout', status: 'new', followups: 0, draft: null, draftKind: null,
    sentText: null, note: '', createdAt: ago(60 * 30), proposedAt: null, sentAt: null, repliedAt: null, ...over,
  })
  const prospects: Row[] = [
    prospect(7, { name: 'Bro Barber', niche: 'barber', telegram: '@brobarber', noticed: 'Запись только по звонку, сайта нет.', offer: 'Лендинг с онлайн-записью.', hook: 'Клиенты не дозваниваются в выходные.' }),
    prospect(6, { name: 'Sadaf Clinic', niche: 'clinic', website: 'sadaf-clinic.example', status: 'proposed', noticed: 'Сайт без мобильной версии.', offer: 'Новый сайт и бот для записи.', hook: 'Пациенты пишут в Instagram и ждут ответа часами.', draft: 'Здравствуйте! Посмотрел ваш сайт на телефоне...', draftKind: 'email', proposedAt: ago(60 * 5) }),
    prospect(5, { name: 'Pulse Gym', niche: 'gym', instagram: '@pulse.gym', status: 'sent', followups: 1, sentText: 'Здравствуйте! Сделаем вам страницу с расписанием.', proposedAt: ago(60 * 40), sentAt: ago(60 * 30) }),
    prospect(4, { name: 'Dilovar Auto', niche: 'auto', phone: '+992 90 000 00 04', status: 'no_reply', followups: 2, proposedAt: ago(60 * 90), sentAt: ago(60 * 80) }),
    prospect(3, { name: 'Zebo Beauty', niche: 'beauty', instagram: '@zebo.beauty', status: 'replied', note: 'Просила прислать примеры.', proposedAt: ago(60 * 120), sentAt: ago(60 * 110), repliedAt: ago(60 * 100) }),
    prospect(2, { name: 'Old Cafe', niche: 'cafe', status: 'skipped', createdAt: ago(60 * 200) }),
  ]
  const notes = new Map<string, string>(prospects.map((p) => [`p${p.id}`, String(p.note)]))
  const tickets: Row[] = [
    { id: 3, clientName: 'Алиса', contact: '@alice', text: 'Бот не отвечает с утра, клиенты жалуются.', clientId: 1, status: 'open', money: true, slaAlerted: true, note: '', answer: null, createdAt: ago(95), answeredAt: null },
    { id: 2, clientName: 'Боб', contact: '@bob', text: 'Можно поменять цвет кнопки на сайте?', status: 'open', money: false, slaAlerted: false, note: '', answer: null, createdAt: ago(60 * 7), answeredAt: null },
  ]
  const documents: Row[] = [
    { id: 'bl:5', source: 'billing', kind: 'invoice', status: 'issued', client: 'Алиса', title: 'Сайт, этап 1', excerpt: 'Сайт, этап 1', amountUsd: 300, number: 'FT-2026-001', createdAt: ago(60 * 20), link: null },
    { id: 'bl:7', source: 'billing', kind: 'invoice', status: 'draft', client: 'Sadaf Clinic', title: 'Сайт и бот, этап 1', excerpt: 'Счёт FT-2026-007, сайт и бот, этап 1', amountUsd: 600, number: 'FT-2026-007', createdAt: ago(300), link: null },
    { id: 'ps:31', source: 'presales', kind: 'kp', status: 'draft', client: 'Боб', title: 'КП на Telegram-бота', excerpt: 'Бот для записи клиентов: меню, напоминания, оплата.', amountUsd: null, number: null, createdAt: ago(60 * 26), link: null },
    { id: 'bo:2', source: 'back_office', kind: 'contract', status: 'pending', client: 'Алиса', title: 'Договор на разработку сайта', excerpt: 'Исполнитель обязуется разработать сайт...', amountUsd: null, number: null, createdAt: ago(60 * 50), link: null },
  ]
  const projects: Row[] = [
    { id: 2, client: 'Алиса', what: 'Сайт', product: 'site', status: 'active', source: 'owner', taskId: null, stage: 'brief', deadline: ahead(3), nextMilestone: { kind: 'brief', title: 'Бриф', dueAt: ahead(3) }, tasksTotal: 4, tasksDone: 1, createdAt: ago(60 * 60) },
  ]
  // P-07: the client's cabinet documents; two have a problem (id 7: the letter did not go out and a resend works, id 8: it fails
  // again), id 9 is fine.
  const cabinetDocs: { id: number; [k: string]: unknown; mail: { state: string | null; error: string; attempts: number }; problems: string[]; actions: string[] }[] = [
    { id: 9, clientId: 1, client: 'Алиса', kind: 'contract', title: 'Договор на сайт', number: 'Д-9', leadId: 3, projectId: 2, state: 'signed', createdAt: ago(60 * 50), deliveredAt: ago(60 * 50), mail: { state: 'sent', error: '', attempts: 1 }, pdf: true, signedPdf: true, problems: [], actions: ['resend'] },
    { id: 8, clientId: 2, client: 'Боб', kind: 'invoice', title: 'Счёт, этап 1', number: 'FT-2026-008', leadId: 5, projectId: null, state: 'issued', createdAt: ago(60 * 3), deliveredAt: ago(60 * 3), mail: { state: 'failed', error: 'http_500', attempts: 3 }, pdf: true, signedPdf: false, problems: ['email_failed'], actions: ['resend'] },
    { id: 7, clientId: 1, client: 'Алиса', kind: 'quote', title: 'Коммерческое предложение', number: 'КП-12', leadId: 3, projectId: null, state: 'awaiting_client', createdAt: ago(60 * 2), deliveredAt: null, mail: { state: 'failed', error: 'http_500', attempts: 1 }, pdf: false, signedPdf: false, problems: ['email_failed', 'no_pdf'], actions: ['resend'] },
  ]
  const referrals: Row[] = [
    { id: 1, referrer: 'Алиса', referred: 'Боб', leadId: null, source: 'owner', status: 'proposed', reward: '10%', rewardRequested: false, createdAt: ago(60 * 48), paidAt: null, rewardedAt: null },
  ]
  const withNote = (kind: 'p' | 't', r: Row): Row => ({ ...r, note: notes.get(`${kind}${r.id}`) ?? '' })
  const prospectRow = (r: Row): Row => ({ ...withNote('p', r), nextStatuses: PROSPECT_NEXT[String(r.status)] ?? [] })

  const page = (rows: Row[], q: Record<string, string>, search: string[], filters: string[]) => {
    const needle = (q.q ?? '').toLowerCase()
    const hit = rows.filter(
      (r) =>
        filters.every((f) => !q[f] || String(r[f]) === q[f]) &&
        (!needle || search.some((f) => String(r[f] ?? '').toLowerCase().includes(needle))),
    )
    const from = Math.max(0, Number(q.cursor) || 0)
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 50))
    return { items: hit.slice(from, from + limit), nextCursor: from + limit < hit.length ? String(from + limit) : null }
  }
  const list = (rows: Row[], q: Record<string, string>, search: string[], filters: string[], extra: Record<string, unknown> = {}) => ({
    ok: true as const, available: true, ...extra, ...page(rows, q, search, filters),
  })

  const write = (kind: 'p' | 't', rows: Row[], id: string, body: Json, now: number): MockReply => {
    const row = rows.find((r) => String(r.id) === id)
    if (!row) return { ok: false, error: 'not_found' }
    const statuses = kind === 'p' ? PROSPECT_STATUSES : ['open', 'answered']
    const allowed = Object.keys(body).filter((k) => !['status', 'note'].includes(k))
    if (allowed.length) return { ok: false, error: kind === 't' && body.reply !== undefined ? 'reply_not_supported' : 'invalid' }
    if (typeof body.note === 'string' && body.note.length > 2000) return { ok: false, error: 'invalid' }
    if (body.status !== undefined) {
      const next = String(body.status)
      if (!statuses.includes(next)) return { ok: false, error: 'invalid_status', allowed: statuses }
      if (next !== row.status) {
        if (kind === 'p') {
          const can = PROSPECT_NEXT[String(row.status)] ?? []
          if (!can.includes(next)) return { ok: false, error: 'illegal_transition', from: row.status, allowed: can }
          if (next === 'proposed') row.proposedAt = iso(now)
          if (next === 'sent') row.sentAt = iso(now)
          if (next === 'replied') row.repliedAt = iso(now)
        } else row.answeredAt = next === 'answered' ? iso(now) : null
        row.status = next
      }
    }
    if (typeof body.note === 'string') notes.set(`${kind}${row.id}`, body.note)
    return { ok: true, available: true, statuses, item: kind === 'p' ? prospectRow(row) : withNote('t', row) }
  }

  const count = (rows: Row[], key: string, values: string[]) =>
    Object.fromEntries(values.map((v) => [v, rows.filter((r) => r[key] === v).length]))

  return function handle(method: 'GET' | 'POST', seg: string[], q: Record<string, string>, body: Json, now: number): MockReply {
    const name = seg[1] ?? ''
    if (method === 'POST' && name === 'cabinet-docs') {
      const doc = cabinetDocs.find((d) => String(d.id) === seg[2])
      if (!doc) return { ok: false, error: 'not_found' }
      if (body.action !== 'resend') return { ok: false, error: 'invalid', allowed: ['resend'] }
      if (!doc.actions.includes('resend')) return { ok: false, error: 'not_sendable' }
      // The second document keeps failing (HQ answers 502 `email_failed` and the mark stays).
      if (doc.id === 8) {
        doc.mail.attempts += 1
        return { ok: false, error: 'email_failed', mail: doc.mail }
      }
      doc.mail = { state: 'sent', error: '', attempts: doc.mail.attempts + 1 }
      doc.problems = doc.problems.filter((p) => p !== 'email_failed')
      return { ok: true, mail: doc.mail }
    }
    if (method === 'POST') {
      if (seg.length !== 3 || !/^\d+$/.test(seg[2]!)) return { ok: false, error: 'not_found' }
      if (name === 'prospects') return write('p', prospects, seg[2]!, body, now)
      if (name === 'tickets') return write('t', tickets, seg[2]!, body, now)
      return { ok: false, error: 'not_found' }
    }
    if (seg.length !== 2) return { ok: false, error: 'not_found' }
    switch (name) {
      case 'summary':
        return {
          ok: true,
          generatedAt: iso(now),
          prospects: { available: true, total: prospects.length, byStatus: count(prospects, 'status', PROSPECT_STATUSES) },
          leads: { available: true, total: 2, byStatus: { inbox: 1, assigned: 1 } },
          tickets: { available: true, open: tickets.filter((t) => t.status === 'open').length, byStatus: count(tickets, 'status', ['open', 'answered']) },
          documents: { available: true, pending: documents.length, byKind: { contract: { pending: 1 }, kp: { draft: 1 }, invoice: { issued: 1 } } },
          projects: { available: true, active: projects.filter((p) => p.status === 'active').length, byStatus: count(projects, 'status', ['draft', 'active', 'done']) },
          referrals: { available: true, total: referrals.length, byStatus: count(referrals, 'status', ['proposed', 'paid', 'rewarded']) },
          reviews: { available: true, pending: 0 },
          chats: { available: true, web: 12, telegram: 3 },
        }
      case 'prospects':
        return list(prospects.map(prospectRow), q, ['name', 'city', 'niche', 'telegram', 'phone', 'website', 'instagram'], ['status', 'niche'], { statuses: PROSPECT_STATUSES })
      case 'leads':
        return list(
          [
            { id: 2, kind: 'lead', taskId: 42, status: 'assigned', name: 'Боб', contact: '@bob', service: 'bot', niche: '', task: 'Бот для записи клиентов', deadline: '', budget: '', source: 'telegram', temperature: 'warm', lang: 'ru', priceAsked: true, priceApproved: false, createdAt: ago(60 * 26) },
            { id: 1, kind: 'lead', taskId: 41, status: 'inbox', name: 'Алиса', contact: '@alice', service: 'site', niche: '', task: 'Сайт для студии', deadline: '', budget: '', source: 'site', temperature: 'cold', lang: 'ru', priceAsked: false, priceApproved: false, createdAt: ago(60 * 60) },
          ],
          q, ['name', 'contact', 'service', 'source'], [],
        )
      case 'clients':
        return {
          ...list(
            [
              { id: 'alisa', name: 'Алиса', contact: '@alice', sources: ['billing', 'documents', 'project', 'site', 'support'], firstTouchAt: ago(60 * 60), lastTouchAt: ago(95), counts: { leads: 1, tickets: 1, projects: 1, invoices: 1, documents: 1 } },
              { id: 'bob', name: 'Боб', contact: '@bob', sources: ['documents', 'support', 'telegram'], firstTouchAt: ago(60 * 26), lastTouchAt: ago(60 * 7), counts: { leads: 1, tickets: 1, projects: 0, invoices: 0, documents: 1 } },
            ],
            q, ['name', 'contact'], [],
          ),
          chats: { web: 12, telegram: 3 },
        }
      case 'tickets':
        return list(tickets.map((t) => withNote('t', t)), q, ['clientName', 'contact', 'text'], ['status'], { statuses: ['open', 'answered'] })
      case 'documents':
        return list(documents, q, ['client', 'title', 'number'], ['kind', 'status'], { kinds: ['contract', 'invoice', 'kp'] })
      case 'projects':
        return list(projects, q, ['client', 'what', 'product'], ['status'])
      case 'referrals':
        return list(referrals, q, ['referrer', 'referred'], ['status'], { statuses: ['proposed', 'paid', 'rewarded'] })
      case 'reviews':
        return {
          ok: true,
          available: true,
          items: [
            { id: 2, clientId: 1, client: 'Алиса', projectId: 1, rating: 5, text: 'Сделали быстро и без лишних вопросов, сайт уже приносит заявки.', at: ago(60 * 5) },
            { id: 1, clientId: 2, client: 'Pulse Gym', projectId: 3, rating: 4, text: 'Хорошо, но хотелось бы больше правок в пакете.', at: ago(60 * 30) },
          ],
          nextCursor: null,
        }
      case 'cabinet-docs':
        return {
          ok: true,
          items: cabinetDocs.filter((d) => q.problem !== '1' || d.problems.length > 0),
        }
      default:
        return { ok: false, error: 'not_found' }
    }
  }
}

export function createHqMock(start = Date.now()) {
  const state = seed(start)
  const office = () => officeMock()
  const crm = createCrmMock(start)
  const pult = createPultMock(start, { approvals: () => state.approvals })
  const review = createReviewMock(start)

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

  // The Director's history kept by `say` and `command` (GET director/history), seeded with one old exchange.
  type HistoryRow = { id: number; at: string; role: 'owner' | 'command' | 'hq'; text: string; taskId: number | null }
  const history: HistoryRow[] = [
    { id: 1, at: iso(start - 3 * 3_600_000), role: 'owner', text: 'Подготовь пост про запись в Telegram-боте', taskId: null },
    { id: 2, at: iso(start - 3 * 3_600_000 + 2000), role: 'hq', text: 'Принял. Передал Маркетингу, пришлю на проверку.', taskId: null },
  ]
  const pushHistory = (now: number, role: HistoryRow['role'], text: string, taskId: number | null) => {
    history.push({ id: (history.at(-1)?.id ?? 0) + 1, at: iso(now), role, text: text.slice(0, 4000), taskId })
    if (history.length > 2000) history.shift()
  }
  const say = (text: string, now: number) => {
    const lower = text.toLowerCase()
    // «Отмени поручение #12» and «Напомни мне про поручение #12»: the Director acts on an existing task.
    const word = /^(отмени|напомни)[^#]*#(\d+)/i.exec(text.trim())
    if (word) {
      const target = findTask(word[2]!)
      if (!target) return { replies: [`Не нашёл поручение #${word[2]}.`] }
      if (word[1]!.toLowerCase() === 'отмени') {
        target.status = 'cancelled'
        target.updatedAt = iso(now)
        pushEvent(target, { at: iso(now), kind: 'task.cancelled', actor: 'owner', body: 'Владелец отменил поручение' })
        return { replies: [`Отменил поручение #${target.id}: «${target.title}». Исполнитель снят.`] }
      }
      addInbox(now, 'progress', `Напоминание: поручение #${target.id} «${target.title}».`, { taskId: target.id, read: false })
      return { replies: [`Напомню про поручение #${target.id}: «${target.title}». Пришлю в уведомления.`] }
    }
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
        return [`Открытых issues билдера: ${s.builderIssues}.\n#7 Добавить роут /admin в Shell`]
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
        return ['Ты на месте: уведомления идут в Shell.']
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

  return function handle(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, query: Query = {}, body: Json = {}, now = Date.now()): MockReply {
    advance(now)
    const seg = path.split('/').filter(Boolean)
    const v3 = pult(method, seg, query, body, now)
    if (v3) return v3 as MockReply
    if (method === 'PATCH' || method === 'DELETE') return { ok: false, error: 'not_found' }
    const rv = review(method, seg, query, body, now)
    if (rv) return rv as MockReply
    if (seg[0] === 'crm') return crm(method, seg, query, body, now)
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
      case 'POST say': {
        const out = say(String(body.text ?? ''), now)
        const owner = String(body.text ?? '').trim()
        pushHistory(now, 'owner', owner, null)
        out.replies.forEach((r, i) => pushHistory(now, 'hq', r, i === out.replies.length - 1 ? ((out as { taskId?: number }).taskId ?? null) : null))
        return { ok: true, ...out }
      }
      case 'POST command': {
        const replies = command(String(body.name ?? ''), String(body.arg ?? ''), now)
        pushHistory(now, 'command', `/${String(body.name ?? '')}${body.arg ? ` ${String(body.arg)}` : ''}`, null)
        for (const r of replies) pushHistory(now, 'hq', r, null)
        return { ok: true, replies }
      }
      // The Director's history (contract 2026-11-22): the lines `say` and `command` wrote, newest last.
      case 'GET director': {
        if (seg[1] !== 'history') return { ok: false, error: 'not_found' }
        const limit = query.limit === undefined ? 50 : Number(query.limit)
        if (!Number.isInteger(limit) || limit < 1 || limit > 200) return { ok: false, error: 'invalid' }
        return { ok: true, items: history.slice(-limit).map((x) => ({ ...x })) }
      }
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
