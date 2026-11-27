import { tabOf } from '@/lib/approvals'

// Dev stand-in for HQ's `GET /admin/today` (contract: shell-today contract section 1; HQ builds the real one in
// parallel, so THIS is the source of truth for the shape until it lands). The numbers are COMPUTED from the other
// mocks' rows (the pending review queue, leads, invoices, tickets) so the Dashboard, Approvals and Finance agree in
// development exactly as they do against HQ. `tz=Etc/Partial` returns the variant with `night` and `alerts`
// unavailable (the «HQ не отдал» states).

type Row = Record<string, unknown>
export type TodaySources = { reviewItems: Row[]; invoices: Row[]; leads: Row[]; tickets: Row[] }

const DAY_MS = 86_400_000
const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10)
const time = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : NaN)
const minutesSince = (v: unknown, now: number) => (Number.isNaN(time(v)) ? 0 : Math.max(0, Math.round((now - time(v)) / 60_000)))

const KIND_WORD: Record<string, string> = { documents: 'Документ', replies: 'Ответ', content: 'Контент', money: 'Деньги' }
const DECIDE_KIND: Record<string, 'document' | 'reply' | 'content' | 'money'> = { documents: 'document', replies: 'reply', content: 'content', money: 'money' }
const DEPT_WORD: Record<string, string> = { marketing: 'Marketing', sales: 'Sales', support: 'Support', production: 'Production', backoffice: 'Back office', director: 'Director' }
const STAGE: Record<string, [string, number]> = { new: ['Новый', 0], qualified: ['Квалифицирован', 1], proposal: ['КП отправлено', 2], contract: ['Договор', 3] }
const NEXT: Record<string, string> = { new: 'Ответить', qualified: 'Назначить созвон', proposal: 'Напомнить о КП', contract: 'Проверить подпись' }

const ageWord = (m: number) => (m < 60 ? `${m} мин` : m < 60 * 48 ? `${Math.floor(m / 60)} ч` : `${Math.floor(m / 1440)} д`)

export function todayMock(now: number, tzQuery: string | undefined, s: TodaySources) {
  const partial = tzQuery === 'Etc/Partial'
  const tz = partial ? 'Etc/Partial' : 'Asia/Dushanbe'

  const items = s.reviewItems
    .map((it) => {
      const tab = tabOf({ kind: String(it.kind) })
      const age = minutesSince(it.createdAt, now)
      const id = String(it.id)
      const title = String(it.title || it.summary || id)
      const approvable = Array.isArray(it.actions) && (it.actions as unknown[]).includes('approve')
      return {
        id,
        kind: DECIDE_KIND[tab] ?? 'other',
        title,
        meta: `${KIND_WORD[tab] ?? 'Другое'} · ${DEPT_WORD[String(it.dept)] ?? String(it.dept)} · ${ageWord(age)}`,
        ageMinutes: age,
        href: `/admin/approvals?id=${id}`,
        actions: [
          { id: 'open', label: 'Открыть', kind: 'link', href: `/admin/approvals?id=${id}` },
          ...(approvable ? [{ id: 'approve', label: 'Одобрить', kind: 'post', url: `/admin/review/${id}`, body: { action: 'approve' }, primary: true }] : []),
        ],
      }
    })
    .sort((a, b) => b.ageMinutes - a.ageMinutes)
  const byKind = { document: 0, reply: 0, content: 0, money: 0 } as Record<string, number>
  for (const i of items) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1

  const open = s.leads
    .filter((l) => String(l.stage) in STAGE)
    .sort((a, b) => STAGE[String(a.stage)]![1] - STAGE[String(b.stage)]![1] || time(b.createdAt) - time(a.createdAt))
    .slice(0, 5)
  const hotLeads = open.map((l) => {
    const stage = String(l.stage)
    const contact = String(l.contact ?? '')
    return {
      id: `l_${l.id}`,
      name: String(l.name),
      what: String(l.brief ?? l.service ?? '').slice(0, 60),
      amount: Number(l.estimateUsd) || 0,
      stage,
      stageLabel: STAGE[stage]![0],
      ageMinutes: minutesSince(l.createdAt, now),
      channel: contact.startsWith('@') ? 'telegram' : contact.includes('@') ? 'email' : 'site',
      next: { label: NEXT[stage]!, href: `/admin/chats?lead=l_${l.id}` },
    }
  })

  const amount = (i: Row) => Number(i.amountUsd) || 0
  const issued = s.invoices.filter((i) => i.status === 'issued')
  const late = issued.filter((i) => Boolean(i.dueDate) && time(i.dueDate) < now)
  const perDay = Array.from({ length: 7 }, (_, k) => {
    const day = dayOf(now - (6 - k) * DAY_MS)
    return { day, paid: s.invoices.filter((i) => i.status === 'paid' && i.paidAt && dayOf(time(i.paidAt)) === day).reduce((n, i) => n + amount(i), 0) }
  })
  const since = now - 30 * DAY_MS
  const mine = s.leads.filter((l) => time(l.createdAt) >= since)
  const stagesFrom = (names: string[]) => mine.filter((l) => names.includes(String(l.stage))).length

  const overdueTicket = s.tickets.find((t) => t.status === 'open' && now - time(t.createdAt) > 4 * 3_600_000)
  const alerts = overdueTicket
    ? [{ id: `a_t${overdueTicket.id}`, level: 'bad', text: `Тикет ${String(overdueTicket.clientName ?? 'клиента')} без ответа больше 4 часов`, href: `/admin/chats?thread=t_${overdueTicket.id}` }]
    : []
  const paidToday = s.invoices.find((i) => i.status === 'paid' && now - time(i.paidAt) < DAY_MS)
  const newLeads = s.leads.filter((l) => l.stage === 'new')
  const night = [
    ...newLeads.slice(0, 2).map((l) => ({ kind: 'lead', text: `новый лид ${String(l.name)}`, href: `/admin/clients?focus=l_${l.id}` })),
    ...(paidToday ? [{ kind: 'payment', text: `оплата $${amount(paidToday)} по ${String(paidToday.number)}`, href: '/admin/finance?tab=payments' }] : []),
    ...(overdueTicket ? [{ kind: 'alert', text: `тикет ${String(overdueTicket.clientName ?? '')} без ответа`, href: `/admin/chats?thread=t_${overdueTicket.id}` }] : []),
  ].slice(0, 4)

  const team = [
    ['lead_manager', 'Lead Manager', 'working', 'отвечает Нигине'],
    ['content_maker', 'Content Maker', 'working', 'монтирует рилс'],
    ['pm', 'Project Manager', 'working', 'готовит спецификацию'],
    ['billing', 'Billing', 'waiting', 'ждёт вашего решения'],
    ['support', 'Support', 'blocked', 'тикет Алисы без ответа'],
    ['seo', 'SEO', 'idle', ''],
    ['director', 'Director', 'working', 'собирает сводку'],
  ].map(([id, title, state, doing]) => ({ id, title, state, doing, href: `/admin/team/${id}` }))

  return {
    ok: true,
    generatedAt: new Date(now).toISOString(),
    tz,
    date: dayOf(now),
    night: partial ? { available: false } : { available: true, text: night.map((n) => n.text).join(', '), items: night },
    decide: { available: true, total: items.length, items, byKind },
    hotLeads: { available: true, items: hotLeads },
    money: {
      available: true,
      paid7d: perDay.reduce((n, d) => n + d.paid, 0),
      pending: issued.filter((i) => !late.includes(i)).reduce((n, i) => n + amount(i), 0),
      overdue: late.reduce((n, i) => n + amount(i), 0),
      overdueCount: late.length,
      perDay,
    },
    funnel: {
      available: true,
      days: 30,
      steps: [
        { step: 'leads', label: 'Лиды', n: mine.length },
        { step: 'quotes', label: 'КП', n: stagesFrom(['proposal', 'contract', 'paid', 'project']) },
        { step: 'contracts', label: 'Договор', n: stagesFrom(['contract', 'paid', 'project']) },
        { step: 'paid', label: 'Оплата', n: stagesFrom(['paid', 'project']) },
      ],
    },
    team: { available: true, busy: team.filter((t) => t.state === 'working').length, total: 19, items: team, spendToday: 3.8, limitToday: 10 },
    alerts: partial ? { available: false } : { available: true, items: alerts },
  }
}
