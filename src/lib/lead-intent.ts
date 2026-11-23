// What a lead is for (builder v6 wave 2, contract wave2-contract.md): the estimate page and the builder send the
// same /api/lead with an `intent`. HQ lead-intake forwards only `message`, `page`, `brief` and `source`, so the
// intent, the estimate link and the follow-up time travel as text in `message` and as short keys in `brief`.
export const leadIntents = ['quote', 'pay-first', 'save-link'] as const
export type LeadIntent = (typeof leadIntents)[number]

export const REMIND_AFTER_MS = 24 * 60 * 60 * 1000
export const messageLimit = 2000
export const briefLimit = 3500

type Shape = {
  intent?: LeadIntent
  estimateUrl?: string
  preset?: string
  task?: string
  message: string
  brief?: Record<string, unknown>
  account?: string
}

// A link or a short free text from the form: no control characters, no markup brackets, bounded.
export const cleanText = (value: string, max: number) =>
  value
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

export const cleanUrl = (value: string) => {
  const v = cleanText(value, 700)
  return /^https?:\/\/\S+$/.test(v) ? v : ''
}

const headline: Record<LeadIntent, string> = {
  quote: 'Запрос: проект отправлен в работу, смета в сборке. Напоминание клиенту завтра.',
  'save-link': 'Запрос: клиент просит прислать ссылку на смету. Без давления: одно письмо или сообщение с ссылкой, ответ не требуется.',
  'pay-first': 'Запрос: клиент нажал «Оплатить первый этап». Подтвердить смету и выставить счёт на первый этап в рабочий день (кабинет и почта).',
}

// The text HQ reads first: the intent line, the estimate link, the follow-up time, the task; then the old message.
export function intentNote(lead: Shape, remindAt: string | null): string {
  if (!lead.intent) return lead.message
  const lines = [headline[lead.intent]]
  if (lead.estimateUrl) lines.push(`Смета: ${lead.estimateUrl}`)
  if (remindAt) lines.push(`Напомнить: ${remindAt}`)
  if (lead.preset) lines.push(`Пресет: ${lead.preset}`)
  if (lead.task) lines.push(`Задача клиента: ${lead.task}`)
  if (lead.account) lines.push(`Аккаунт: ${lead.account}`)
  const head = lines.join('\n')
  const rest = lead.message ? `\n\n${lead.message}` : ''
  return `${head}${rest}`.slice(0, messageLimit)
}

// Applies the intent to a parsed lead: follow-up time (`quote` and `save-link`, now + 1 day), the text, the brief keys.
export function applyIntent<T extends Shape>(lead: T, now: Date = new Date()): T & { remindAt?: string } {
  if (!lead.intent) return lead
  const remindAt = lead.intent === 'pay-first' ? null : new Date(now.getTime() + REMIND_AFTER_MS).toISOString()
  const extra: Record<string, unknown> = { intent: lead.intent }
  if (remindAt) extra.remindAt = remindAt
  if (lead.estimateUrl) extra.estimateUrl = lead.estimateUrl
  if (lead.preset) extra.preset = lead.preset
  if (lead.account) extra.account = lead.account
  let brief: Record<string, unknown> = { ...(lead.brief ?? {}), ...extra }
  if (JSON.stringify(brief).length > briefLimit) {
    // Too big: drop the link first (it is in `message` and `page` anyway), then the builder's own brief.
    const { estimateUrl: _u, ...short } = extra
    void _u
    brief = { ...(lead.brief ?? {}), ...short }
    if (JSON.stringify(brief).length > briefLimit) brief = { ...short }
  }
  return { ...lead, message: intentNote(lead, remindAt), brief, ...(remindAt ? { remindAt } : {}) }
}
