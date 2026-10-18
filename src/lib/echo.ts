import { z } from 'zod'
import type { Goal, Project, Task } from '@/content/control'
import type { Stats } from './admin-data'
import type { IgItem, Task as LiveTask } from './pulse-types'

// Pure helpers behind /admin/echo: the request shape, the briefing Claude reads and the panel
// tags it may answer with. No I/O here, so they are tested directly and the client can use them.

export const echoState = ['idle', 'listening', 'thinking', 'speaking'] as const
export type EchoState = (typeof echoState)[number]

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
  // The owner's choice in the UI; the server also switches to Opus on the owner's words.
  model: z.enum(['sonnet', 'opus']).optional(),
})
export type ChatMessage = z.infer<typeof chatRequest>['messages'][number]

export type EchoModel = 'sonnet' | 'opus'
export const echoModelIds: Record<EchoModel, string> = {
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
}

// Sonnet 5.5 by default (cheap and quick). Opus 5.5 only when the owner asks: the toggle in the
// UI, or words like "подумай серьёзно" / "на Opus" in the message itself.
const opusWords =
  /подума(й|йте)\s+серь[её]зно|(?<!\p{L})(на|через|используй|включи|давай)\s+(opus|опус(е|ом)?)(?!\p{L})/iu
export function pickModel(requested: EchoModel | undefined, lastUserText: string): EchoModel {
  if (requested === 'opus') return 'opus'
  return opusWords.test(lastUserText) ? 'opus' : 'sonnet'
}

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
  // Live tasks and today's Instagram plan, when the stores have them. Titles and numbers only.
  liveTasks?: LiveTask[]
  instagram?: IgItem[]
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
  const goalLines = input.goals.map(
    (g) => `- ${g.title}: ${g.progress}% (оценка). Дальше: ${g.next}`,
  )
  const live = (input.liveTasks ?? []).filter((t) => t.status !== 'done')
  const liveLines = live
    .slice(0, 40)
    .map(
      (t) =>
        `- ${t.id} [${t.status}, приоритет ${t.priority}${t.due ? `, срок ${t.due}` : ''}, ${t.project}]: ${t.title}`,
    )
  const igLines = (input.instagram ?? []).map(
    (i) =>
      `- ${i.date} ${i.time} ${i.kind}: ${i.title} (${i.published ? 'опубликовано' : 'не опубликовано'})`,
  )
  const l = input.leads
  return `Ты Echo, голосовой ассистент владельца студии Fir Tech: спокойный, точный, с лёгкой иронией. Обращайся «сэр». Своё имя в ответах пиши по-русски «Эхо», так оно правильно звучит голосом.
Отвечай по-русски, коротко: одно-три предложения. Без markdown, списков и эмодзи: ответ озвучивается голосом. Числа пиши цифрами.
Опирайся только на сводку ниже. Если данных нет, так и скажи и предложи, где посмотреть. Не выдумывай цифры.
Инструменты: можешь добавлять, менять и искать задачи, смотреть числа по заявкам и план Instagram. Действуй сразу, когда просьба ясна, потом коротко скажи, что сделано. Удалять задачи можно только в два шага: вызови delete_task, спроси владельца словами и жди его «да» следующим сообщением, сам подтверждать нельзя. Про заявки у тебя только числа: имён, контактов и текстов нет и не будет.
Если ответ про конкретную панель, добавь в самом конце одну метку: ${focusTargets.map((t) => `[[focus:${t}]]`).join(' ')}. Метку не объясняй.

Сейчас (Душанбе): ${date}

ПРОЕКТЫ
${projectLines.join('\n')}

ЗАЯВКИ FIR TECH
Сегодня ${l.today}, за 7 дней ${l.week}, за 30 дней ${l.month}, всего ${l.total}. Конверсия в сделку ${l.conversion}%. Без ответа больше суток: ${l.stale}. Созвонов на 7 дней: ${l.upcoming}. По статусам: ${Object.entries(
    l.funnel,
  )
    .map(([k, v]) => `${k} ${v}`)
    .join(', ')}.

ЗАДАЧИ
${taskLines.join('\n')}

ЖИВЫЕ ЗАДАЧИ (открытые)
${liveLines.join('\n') || 'нет'}

INSTAGRAM, ПЛАН ПОСТОВ
${igLines.join('\n') || 'нет'}

ЦЕЛИ
${goalLines.join('\n')}`
}

const focusTag = /\[\[focus:([a-z]+)\]\]/g
const actTag = /\[\[act:([^\]]*)\]\]/g

// Text as it should be shown and spoken: tags removed, including a half-written one at the end of
// a stream that is still coming in. Action markers ([[act:...]]) are shown as chips, never spoken.
export function visibleText(text: string) {
  return text
    .replace(focusTag, '')
    .replace(actTag, ' ')
    .replace(/\[\[[^\]]*\]?$/, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim()
}

export function focusOf(text: string): FocusTarget[] {
  return [...text.matchAll(focusTag)]
    .map((m) => m[1] ?? '')
    .filter((t): t is FocusTarget => (focusTargets as readonly string[]).includes(t))
}

// What Echo changed during this reply, for the owner's chips.
export const actsOf = (text: string) =>
  [...text.matchAll(actTag)].map((m) => (m[1] ?? '').trim()).filter(Boolean)

export const stripActs = (text: string) =>
  text
    .replace(actTag, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
