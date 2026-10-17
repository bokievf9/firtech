import { z } from 'zod'
import type { Goal, Project, Task } from '@/content/control'
import type { Stats } from './admin-data'

// Pure helpers behind /admin/jarvis: the request shape, the briefing Claude reads and the panel
// tags it may answer with. No I/O here, so they are tested directly and the client can use them.

export const jarvisState = ['idle', 'listening', 'thinking', 'speaking'] as const
export type JarvisState = (typeof jarvisState)[number]

// Panels the assistant may point at with a [[focus:<id>]] tag at the end of a reply.
export const focusTargets = ['vibely', 'firtech', 'tasks', 'goals', 'leads'] as const
export type FocusTarget = (typeof focusTargets)[number]

export const chatRequest = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(24)
    .refine((m) => m.at(-1)?.role === 'user', 'last_must_be_user'),
})
export type ChatMessage = z.infer<typeof chatRequest>['messages'][number]

export type Health = { id: Project['id']; ok: boolean; ms: number | null }

// Leads go to Claude only as counts: no names, contacts or texts leave the site.
export type LeadSummary = Pick<Stats, 'today' | 'week' | 'month' | 'total'> & {
  conversion: number
  stale: number
  upcoming: number
  funnel: Record<string, number>
}

export function leadSummary(stats: Stats): LeadSummary {
  return {
    today: stats.today,
    week: stats.week,
    month: stats.month,
    total: stats.total,
    conversion: Math.round(stats.conversion * 100),
    stale: stats.stale.length,
    upcoming: stats.upcoming.length,
    funnel: Object.fromEntries(stats.funnel.map((f) => [f.status, f.count])),
  }
}

const statusWords: Record<Task['status'], string> = {
  decide: 'ждёт решения владельца',
  check: 'нужно проверить',
  todo: 'сделать',
  ongoing: 'регулярно',
  later: 'отложено',
}

export function briefing(input: {
  now: Date
  projects: Project[]
  health: Health[]
  tasks: Task[]
  goals: Goal[]
  leads: LeadSummary
}) {
  const date = input.now.toLocaleString('ru-RU', { timeZone: 'Asia/Dushanbe' })
  const projectLines = input.projects.map((p) => {
    const h = input.health.find((x) => x.id === p.id)
    const state = h?.ok ? `онлайн, ответ ${h.ms} мс` : 'НЕ ОТВЕЧАЕТ'
    const facts = p.facts.map((f) => `${f.label}: ${f.value}`).join('; ')
    return `- ${p.name} (${p.domain}): ${p.about}. Сейчас ${state}. ${facts}.`
  })
  const taskLines = input.tasks.map(
    (t) =>
      `- ${t.id} [${statusWords[t.status]}, ${t.owner === 'me' ? 'владелец' : 'Claude'}, приоритет ${t.priority}]: ${t.title}`,
  )
  const goalLines = input.goals.map((g) => `- ${g.title}: ${g.progress}% (оценка). Дальше: ${g.next}`)
  const l = input.leads
  return `Ты Джарвис, голосовой ассистент владельца студии Fir Tech, в духе J.A.R.V.I.S.: спокойный, точный, с лёгкой иронией. Обращайся «сэр».
Отвечай по-русски, коротко: одно-три предложения. Без markdown, списков и эмодзи: ответ озвучивается голосом. Числа пиши цифрами.
Опирайся только на сводку ниже. Если данных нет, так и скажи и предложи, где посмотреть. Не выдумывай цифры.
Если ответ про конкретную панель, добавь в самом конце одну метку: ${focusTargets.map((t) => `[[focus:${t}]]`).join(' ')}. Метку не объясняй.

Сейчас (Душанбе): ${date}

ПРОЕКТЫ
${projectLines.join('\n')}

ЗАЯВКИ FIR TECH
Сегодня ${l.today}, за 7 дней ${l.week}, за 30 дней ${l.month}, всего ${l.total}. Конверсия в сделку ${l.conversion}%. Без ответа больше суток: ${l.stale}. Созвонов на 7 дней: ${l.upcoming}. По статусам: ${Object.entries(l.funnel).map(([k, v]) => `${k} ${v}`).join(', ')}.

ЗАДАЧИ
${taskLines.join('\n')}

ЦЕЛИ
${goalLines.join('\n')}`
}

const focusTag = /\[\[focus:([a-z]+)\]\]/g

// Text as it should be shown and spoken: tags removed, including a half-written one at the end of
// a stream that is still coming in.
export function visibleText(text: string) {
  return text.replace(focusTag, '').replace(/\[\[[a-z:]*$/, '').trim()
}

export function focusOf(text: string): FocusTarget[] {
  return [...text.matchAll(focusTag)]
    .map((m) => m[1] ?? '')
    .filter((t): t is FocusTarget => (focusTargets as readonly string[]).includes(t))
}
