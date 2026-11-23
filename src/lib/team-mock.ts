// Development stand-in for HQ's Team (contract «Команда», 2026-11-24). In memory and scripted: 23 employees with presence and
// a short `now`, a chat per employee (chips and keywords get a fixed reply with cards, «медленно» answers 202 and the reply shows
// up in the next GET), assigning a task (creates a real task in the main mock), and a standup for any day up to today.
// Nothing is ever sent to a client.
import { isTeamId, TEAM_IDS } from './team'

type Reply = { ok: true; [k: string]: unknown } | { ok: false; error: string }
type Rec = Record<string, unknown>
type Card = { kind: string; id: string; title: string; href: string; meta?: Record<string, string | number> }
type Msg = { id: string; role: 'owner' | 'agent'; text: string; at: string; cards?: Card[] }

type Row = { title: string; dept: string; presence: 'working' | 'waiting' | 'idle' | 'off'; now?: string; queue: number; agoMin: number; used: number; limit: number; kpi: [number, number, number | null]; version: number }
const ORG: Record<string, Row> = {
  director: { title: 'Director', dept: 'hq', presence: 'working', now: 'собираю сводку для владельца', queue: 2, agoMin: 4, used: 1.2, limit: 5, kpi: [41, 12, 4.8], version: 3 },
  'marketing-head': { title: 'Head of Marketing', dept: 'marketing', presence: 'working', now: 'собираю пачку контента на неделю', queue: 3, agoMin: 20, used: 6.4, limit: 25, kpi: [18, 9, 4.6], version: 4 },
  'content-maker': { title: 'Content Maker', dept: 'marketing', presence: 'working', now: 'монтирую клип про ночные заявки', queue: 4, agoMin: 7, used: 9.1, limit: 25, kpi: [0, 14, 4.4], version: 2 },
  'trend-scout': { title: 'Trend Scout', dept: 'marketing', presence: 'idle', queue: 0, agoMin: 95, used: 0.9, limit: 25, kpi: [0, 6, null], version: 1 },
  publisher: { title: 'Publisher', dept: 'marketing', presence: 'waiting', now: 'жду одобрения поста в Telegram', queue: 1, agoMin: 42, used: 0.4, limit: 25, kpi: [0, 8, 4.7], version: 1 },
  seo: { title: 'SEO Specialist', dept: 'marketing', presence: 'waiting', now: 'нужен доступ к Search Console', queue: 1, agoMin: 180, used: 1.7, limit: 25, kpi: [0, 3, null], version: 2 },
  analyst: { title: 'Analyst', dept: 'marketing', presence: 'off', queue: 0, agoMin: 1200, used: 0.3, limit: 25, kpi: [2, 1, 4.9], version: 1 },
  'sales-head': { title: 'Head of Sales', dept: 'sales', presence: 'idle', queue: 1, agoMin: 12, used: 2.2, limit: 20, kpi: [26, 7, 4.5], version: 3 },
  'lead-intake': { title: 'Lead Handler', dept: 'sales', presence: 'working', now: 'квалифицирую новую заявку', queue: 3, agoMin: 2, used: 5.8, limit: 20, kpi: [64, 11, 4.3], version: 5 },
  prospector: { title: 'Prospector', dept: 'sales', presence: 'working', now: 'собираю список салонов красоты', queue: 1, agoMin: 35, used: 3.3, limit: 20, kpi: [0, 4, null], version: 2 },
  presales: { title: 'Presales', dept: 'sales', presence: 'waiting', now: 'пишу КП #12', queue: 2, agoMin: 50, used: 4.9, limit: 20, kpi: [9, 5, 4.6], version: 3 },
  'support-head': { title: 'Head of Support', dept: 'support', presence: 'idle', queue: 0, agoMin: 360, used: 0.5, limit: 15, kpi: [5, 1, null], version: 1 },
  'customer-support': { title: 'Customer Support', dept: 'support', presence: 'idle', queue: 2, agoMin: 30, used: 3.8, limit: 15, kpi: [37, 6, 4.2], version: 4 },
  monitoring: { title: 'Monitoring', dept: 'support', presence: 'working', now: 'проверяю сервисы', queue: 0, agoMin: 4, used: 0.2, limit: 15, kpi: [0, 0, null], version: 1 },
  billing: { title: 'Billing', dept: 'support', presence: 'idle', queue: 1, agoMin: 140, used: 0.6, limit: 15, kpi: [3, 4, 4.8], version: 2 },
  'production-head': { title: 'Head of Production', dept: 'production', presence: 'idle', queue: 1, agoMin: 90, used: 1.4, limit: 15, kpi: [11, 3, 4.7], version: 2 },
  'project-manager': { title: 'Project Manager', dept: 'production', presence: 'working', now: 'веду этап «Дизайн» у двух проектов', queue: 2, agoMin: 15, used: 2.6, limit: 15, kpi: [14, 5, 4.5], version: 3 },
  reviewer: { title: 'Reviewer', dept: 'production', presence: 'idle', queue: 0, agoMin: 200, used: 0.8, limit: 15, kpi: [0, 6, 4.6], version: 1 },
  deployer: { title: 'Deployer', dept: 'production', presence: 'off', queue: 0, agoMin: 2000, used: 0.1, limit: 15, kpi: [0, 2, null], version: 1 },
  'backoffice-head': { title: 'Head of Back Office', dept: 'backoffice', presence: 'idle', queue: 1, agoMin: 300, used: 0.7, limit: 10, kpi: [8, 2, 4.7], version: 2 },
  finance: { title: 'Finance', dept: 'backoffice', presence: 'working', now: 'сверяю расходы за ноябрь', queue: 1, agoMin: 300, used: 1.1, limit: 10, kpi: [12, 3, 4.8], version: 2 },
  documents: { title: 'Documents', dept: 'backoffice', presence: 'off', queue: 0, agoMin: 180, used: 0.3, limit: 10, kpi: [4, 5, 4.4], version: 2 },
  knowledge: { title: 'Knowledge', dept: 'backoffice', presence: 'idle', queue: 0, agoMin: 600, used: 0.2, limit: 10, kpi: [7, 1, null], version: 1 },
}

const iso = (t: number) => new Date(t).toISOString()

// A standup for one day: deterministic, two or three lines per agent that did something.
const STANDUP: Record<string, { did: string[]; plan: string[]; need?: string[] }> = {
  director: { did: ['Собрал вечернюю сводку, отправил в Inbox'], plan: ['Разобрать очередь одобрений до 11:00'] },
  'marketing-head': { did: ['Утвердил план публикаций на неделю'], plan: ['Проверить два клипа от Content Maker'], need: ['Решение по карусели про цены'] },
  'content-maker': { did: ['Смонтировал клип про ночные заявки'], plan: ['Обложки для двух рилсов'] },
  publisher: { did: ['Поставил пост в расписание'], plan: ['Опубликовать после одобрения'], need: ['Одобрение поста в Telegram'] },
  'lead-intake': { did: ['Ответил на 6 заявок, 2 квалифицированы'], plan: ['Дожать два диалога без ответа'] },
  presales: { did: ['Собрал КП #12'], plan: ['КП #13 после созвона'], need: ['Одобрение КП #12'] },
  'customer-support': { did: ['Закрыл 4 тикета'], plan: ['Ответить на тикет про новый тариф'] },
  'project-manager': { did: ['Закрыл веху «Сдача» в одном проекте'], plan: ['Напомнить о плате за этап'] },
  finance: { did: ['Сверил оплаты за неделю'], plan: ['Отчёт по расходам за ноябрь'] },
}

export function createTeamMock(start = Date.now(), deps: { addTask?: (task: { title: string; assigneeId: string; assigneeTitle: string; dept: string; dueAt: string | null }, now: number) => number } = {}) {
  const chats = new Map<string, Msg[]>()
  const pending = new Map<string, { readyAt: number; msg: Msg }>()
  const queueExtra = new Map<string, number>()
  let seq = 1000
  let taskSeq = 900

  const log = (id: string, now: number): Msg[] => {
    let m = chats.get(id)
    if (!m) {
      m = [{ id: `m-${id}-1`, role: 'agent', text: `Привет. Я ${ORG[id]!.title}. Спрашивай про дела, или напиши «@имя задача», и я передам.`, at: iso(start - 3_600_000) }]
      chats.set(id, m)
    }
    const p = pending.get(id)
    if (p && now >= p.readyAt) {
      m.push(p.msg)
      pending.delete(id)
    }
    return m
  }

  const member = (id: string, now: number) => {
    const o = ORG[id]!
    return {
      id,
      title: o.title,
      dept: o.dept,
      presence: o.presence,
      ...(o.now ? { now: o.now } : {}),
      queue: o.queue + (queueExtra.get(id) ?? 0),
      lastResultAt: iso(now - o.agoMin * 60_000),
      budget: { usedUsd: o.used, limitUsd: o.limit },
      kpi: { answers7d: o.kpi[0], approvals7d: o.kpi[1], rating7d: o.kpi[2] },
    }
  }

  const recent = (id: string, now: number) => [
    { at: iso(now - 20 * 60_000), kind: 'task', title: `Задача для ${ORG[id]!.title}: сверка за неделю`, href: '/admin/tasks?task=12' },
    { at: iso(now - 70 * 60_000), kind: 'approval', title: 'Одобрено: пост в Telegram', href: '/admin/approvals' },
    { at: iso(now - 3 * 3_600_000), kind: 'answer', title: 'Ответ владельцу в чате', href: `/admin/team/${id}` },
  ]

  const scripted = (id: string, text: string): { text: string; cards: Card[]; actions: { type: string }[] } => {
    const t = text.toLowerCase()
    const k = ++seq
    if (t.includes('лид'))
      return {
        text: 'Сейчас в воронке 3 новых лида: один квалифицирован, два ждут ответа. Самый тёплый запрос на сайт с Telegram-ботом.',
        cards: [
          { kind: 'lead', id: '6', title: 'Лид: сайт с Telegram-ботом', href: '/admin/clients?tab=pipeline&focus=6', meta: { stage: 'qualified', source: 'site' } },
          { kind: 'metric', id: 'funnel', title: 'Воронка за неделю', href: '/admin/analytics', meta: { new: 3, qualified: 1 } },
        ],
        actions: [{ type: 'none' }],
      }
    if (t.includes('кп'))
      return {
        text: `Готовлю КП${text.length > 14 ? ` по запросу «${text.slice(text.toLowerCase().indexOf('кп') + 3, 90).trim()}»` : ''}. Черновик уйдёт тебе на одобрение, клиенту ничего не отправится.`,
        cards: [{ kind: 'document', id: `kp_${k}`, title: 'КП: черновик', href: '/admin/documents?tab=documents', meta: { state: 'draft' } }],
        actions: [{ type: 'draft_created' }],
      }
    if (t.includes('тикет'))
      return {
        text: 'Открытых тикетов два: один про новый тариф, второй про доступ в кабинет. SLA не нарушен.',
        cards: [{ kind: 'task', id: '31', title: 'Тикет: новый тариф', href: '/admin/tasks?task=31', meta: { age: '2 ч' } }],
        actions: [{ type: 'none' }],
      }
    if (t.includes('проект'))
      return {
        text: 'Два проекта в работе: у одного закрыт этап «Дизайн», у другого идёт сборка. Просрочек нет.',
        cards: [{ kind: 'project', id: '3', title: 'Проект: Pulse Gym', href: '/admin/projects?focus=3', meta: { stage: 'build', due: 'в срок' } }],
        actions: [{ type: 'none' }],
      }
    if (t.includes('не оплатил'))
      return {
        text: 'Не оплачен один счёт за этап, просрочка 2 дня. Напомнить можно из карточки.',
        cards: [{ kind: 'invoice', id: '14', title: 'Счёт #14: этап 2', href: '/admin/finance?tab=invoices&focus=14', meta: { overdue: '2 дня', usd: 450 } }],
        actions: [{ type: 'none' }],
      }
    if (t.includes('ждёт меня') || t.includes('жду'))
      return {
        text: 'Ждут тебя два решения: КП на проверку и пост в Telegram.',
        cards: [{ kind: 'item', id: '14', title: 'Пост в Telegram: кейс бота', href: '/admin/content?tab=feed&focus=14' }],
        actions: [{ type: 'none' }],
      }
    if (t.includes('чем занят'))
      return { text: ORG[id]!.now ? `Сейчас: ${ORG[id]!.now}. В очереди ${ORG[id]!.queue}.` : `Сейчас свободен. В очереди ${ORG[id]!.queue}.`, cards: [], actions: [{ type: 'none' }] }
    return { text: 'Понял. Могу рассказать, чем занят, или взять задачу: напиши «@имя задача».', cards: [], actions: [{ type: 'none' }] }
  }

  const standup = (date: string, now: number): Reply => {
    const d = Date.parse(`${date}T00:00:00Z`)
    if (Number.isNaN(d) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'invalid' }
    if (d > now) return { ok: true, date, entries: [] }
    const entries = Object.entries(STANDUP).map(([agent, e]) => ({ agent, did: e.did, plan: e.plan, need: e.need ?? [] }))
    return { ok: true, date, entries, postedToInboxAt: `${date}T04:00:00.000Z` }
  }

  return function handle(method: string, seg: string[], query: Rec, body: Rec, now: number): Reply | null {
    if (seg[0] !== 'team') return null
    if (seg.length === 1 && method === 'GET') return { ok: true, members: TEAM_IDS.map((id) => member(id, now)) }
    if (seg[1] === 'standup') {
      if (seg.length === 2 && method === 'GET') return standup(typeof query.date === 'string' && query.date ? query.date : iso(now).slice(0, 10), now)
      if (seg.length === 3 && seg[2] === 'reply' && method === 'POST') {
        const agent = typeof body.agent === 'string' ? body.agent : ''
        const text = typeof body.text === 'string' ? body.text.trim() : ''
        if (!isTeamId(agent) || !ORG[agent] || !text) return { ok: false, error: 'invalid' }
        const m = log(agent, now)
        m.push({ id: `m${++seq}`, role: 'owner', text, at: iso(now) })
        const reply: Msg = { id: `m${++seq}`, role: 'agent', text: 'Принял твой ответ по планёрке, учту в работе.', at: iso(now + 1000) }
        m.push(reply)
        return { ok: true, reply: { id: reply.id, text: reply.text, cards: [] }, actions: [{ type: 'none' }] }
      }
      return { ok: false, error: 'not_found' }
    }
    const id = seg[1] ?? ''
    if (!ORG[id]) return { ok: false, error: 'not_found' }
    if (seg.length === 2 && method === 'GET') return { ok: true, ...member(id, now), recent: recent(id, now), instructions: { version: ORG[id]!.version, updatedAt: iso(now - 2 * 86_400_000) } }
    if (seg[2] === 'chat' && seg.length === 3) {
      const m = log(id, now)
      if (method === 'GET') {
        const limit = Math.min(Number(query.limit) || 50, 200)
        return { ok: true, items: m.slice(-limit), pending: pending.has(id) ? [pending.get(id)!.msg.id] : [] }
      }
      if (method === 'POST') {
        const text = typeof body.text === 'string' ? body.text.trim() : ''
        if (!text) return { ok: false, error: 'invalid' }
        m.push({ id: `m${++seq}`, role: 'owner', text, at: iso(now) })
        const r = scripted(id, text)
        const msg: Msg = { id: `m${++seq}`, role: 'agent', text: r.text, at: iso(now + 2000), cards: r.cards }
        if (text.toLowerCase().includes('медленно')) {
          pending.set(id, { readyAt: now + 3500, msg })
          return { ok: true, pending: msg.id }
        }
        m.push(msg)
        return { ok: true, reply: { id: msg.id, text: msg.text, cards: r.cards }, actions: r.actions }
      }
    }
    if (seg[2] === 'assign' && seg.length === 3 && method === 'POST') {
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text) return { ok: false, error: 'invalid' }
      const dueAt = typeof body.dueAt === 'string' ? body.dueAt : null
      const taskId = deps.addTask ? deps.addTask({ title: text, assigneeId: id, assigneeTitle: ORG[id]!.title, dept: ORG[id]!.dept, dueAt }, now) : ++taskSeq
      queueExtra.set(id, (queueExtra.get(id) ?? 0) + 1)
      return { ok: true, task: { id: taskId, href: `/admin/tasks?task=${taskId}` } }
    }
    return { ok: false, error: 'not_found' }
  }
}
