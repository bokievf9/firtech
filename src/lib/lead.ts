import { z } from 'zod'
import { extraSlugs, serviceSlugs } from './site'
import { cleanText, cleanUrl, leadIntents } from './lead-intent'

export const leadSchema = z.object({
  name: z.string().trim().min(1).max(80),
  contact: z.string().trim().min(3).max(120),
  service: z
    .union([z.enum(serviceSlugs), z.enum(extraSlugs), z.literal('bundle'), z.literal('personal'), z.literal('unknown')])
    .default('unknown'),
  budget: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().max(2000).optional().default(''),
  estimate: z.string().trim().max(1500).optional().default(''),
  locale: z.enum(['ru', 'en']).default('ru'),
  page: z.string().trim().max(600).optional().default(''),
  // Chosen call slot (UTC ISO string from /api/slots); the route checks it is still free.
  slot: z.string().trim().max(40).optional().default(''),
  // The showcase card the lead came from (a direction id, see directions.ts), or `ref:<slug>` for a
  // referral link (see referral.ts); empty for the rest.
  source: z
    .string()
    .trim()
    .max(40)
    .regex(/^(?:ref:[a-z0-9_-]{1,32}|[a-z0-9_-]*)$/)
    .optional()
    .default(''),
  // The builder's brief as ids (`brief v4 contract`, docs/builder-v2.md): business or personal, for HQ's CRM.
  // Bounded; anything else is dropped.
  brief: z
    .record(z.string().max(40), z.unknown())
    .refine((b) => JSON.stringify(b).length <= 3500)
    .optional(),
  // Builder v6 wave 2 (additive, see lead-intent.ts): what the lead is for, the estimate link, the chosen preset and the
  // visitor's own words from «Опишите задачу». HQ reads them as text in `message` and in `brief`.
  intent: z.enum(leadIntents).optional(),
  estimateUrl: z.string().max(900).transform(cleanUrl).optional(),
  preset: z.string().max(40).transform((v) => cleanText(v, 40)).optional(),
  task: z.string().max(2000).transform((v) => cleanText(v, 500)).optional(),
  // Honeypot: hidden from people, bots fill it in.
  website: z.string().max(200).optional().default(''),
})

export type Lead = z.infer<typeof leadSchema>
// What the owner message shows; a stored lead has these too.
export type LeadFields = Pick<
  Lead,
  'name' | 'contact' | 'service' | 'budget' | 'estimate' | 'message' | 'locale' | 'page'
> & { source?: string; account?: string }

export const serviceNames: Record<Lead['service'], string> = {
  websites: 'Сайт',
  bots: 'Агент в Telegram',
  apps: 'Приложение',
  automation: 'Автоматизация / ИИ',
  ai: 'ИИ-ассистент',
  personal: 'Личный ИИ-ассистент (для себя)',
  support: 'Поддержка по подписке',
  payments: 'Онлайн-оплата',
  seo: 'Карты, SEO и аналитика',
  crm: 'CRM под ключ',
  design: 'Дизайн и фирменный стиль',
  rescue: 'Доработка чужого проекта',
  internal: 'Внутренняя система',
  bundle: 'Комплекс из сборки проекта',
  unknown: 'Не знает, нужна консультация',
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Telegram refuses messages over 4096 characters, and a refused lead would block the resend queue.
// The longest fields are cut so a lead at every schema maximum still fits with the status lines;
// the full text stays in the store and in /admin.
export function clip(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}… (полностью в /admin)` : value
}

// The builder sends its estimate as JSON (`{"v":1,"lines":[{"label","usd"}],...}`, see estimate-doc.ts
// `estimateJson`); everywhere a person reads it, it becomes lines of text. Anything else passes through.
export function estimateAsText(value: string): string {
  const t = value.trim()
  if (!t.startsWith('{')) return value
  try {
    const j = JSON.parse(t) as { v?: unknown; lines?: unknown; discountUsd?: unknown; totalUsd?: unknown; monthlyUsd?: unknown; onRequest?: unknown }
    if (j.v !== 1 || !Array.isArray(j.lines) || typeof j.totalUsd !== 'number') return value
    const rows = j.lines.flatMap((l: { label?: unknown; usd?: unknown }) => (typeof l?.label === 'string' && typeof l.usd === 'number' ? [`${l.label} ($${l.usd})`] : []))
    if (typeof j.discountUsd === 'number') rows.push(`Скидка: -$${j.discountUsd}`)
    rows.push(`Итого: $${j.totalUsd}`)
    if (Array.isArray(j.onRequest) && j.onRequest.length) rows.push(`По смете, без цены: ${j.onRequest.filter((x) => typeof x === 'string').join(', ')}`)
    if (typeof j.monthlyUsd === 'number') rows.push(`Поддержка по подписке: $${j.monthlyUsd}/мес`)
    return rows.join('\n')
  } catch {
    return value
  }
}

// Telegram message for the owner (always in Russian; the lead's own language is noted).
export function formatLead(lead: LeadFields, title = 'Новая заявка с сайта Fir Tech') {
  const rows: [string, string][] = [
    ['Имя', lead.name],
    ['Связь', lead.contact],
    ['Услуга', serviceNames[lead.service]],
    ['Бюджет', lead.budget],
    [lead.service === 'bundle' ? 'Сборка' : 'Оценка', estimateAsText(lead.estimate)],
    ['Задача', clip(lead.message, 1000)],
    ['Язык', lead.locale.toUpperCase()],
    ['Страница', clip(lead.page, 300)],
    // Last row, so the lines the lead reader already parses keep their places.
    ['Источник', lead.source ?? ''],
    // The cabinet account the lead was sent from (email), after the source for the same reason.
    ['Аккаунт', lead.account ?? ''],
  ]
  const body = rows
    .filter(([, value]) => value)
    .map(([label, value]) => `<b>${label}:</b> ${escapeHtml(value)}`)
    .join('\n')
  return `<b>${title}</b>\n\n${body}`
}
