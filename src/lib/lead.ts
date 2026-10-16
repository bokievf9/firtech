import { z } from 'zod'
import { extraSlugs, serviceSlugs } from './site'

export const leadSchema = z.object({
  name: z.string().trim().min(1).max(80),
  contact: z.string().trim().min(3).max(120),
  service: z
    .union([z.enum(serviceSlugs), z.enum(extraSlugs), z.literal('bundle'), z.literal('unknown')])
    .default('unknown'),
  budget: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().max(2000).optional().default(''),
  estimate: z.string().trim().max(1500).optional().default(''),
  locale: z.enum(['ru', 'en']).default('ru'),
  page: z.string().trim().max(600).optional().default(''),
  // Chosen call slot (UTC ISO string from /api/slots); the route checks it is still free.
  slot: z.string().trim().max(40).optional().default(''),
  // Honeypot: hidden from people, bots fill it in.
  website: z.string().max(200).optional().default(''),
})

export type Lead = z.infer<typeof leadSchema>
// What the owner message shows; a stored lead has these too.
export type LeadFields = Pick<
  Lead,
  'name' | 'contact' | 'service' | 'budget' | 'estimate' | 'message' | 'locale' | 'page'
>

export const serviceNames: Record<Lead['service'], string> = {
  websites: 'Сайт',
  bots: 'Telegram-бот',
  apps: 'Приложение',
  automation: 'Автоматизация / ИИ',
  ai: 'ИИ-ассистент',
  support: 'Поддержка по подписке',
  payments: 'Онлайн-оплата',
  seo: 'Карты, SEO и аналитика',
  crm: 'CRM под ключ',
  design: 'Дизайн и фирменный стиль',
  rescue: 'Доработка чужого проекта',
  internal: 'Внутренняя система',
  bundle: 'Комплекс из конструктора',
  unknown: 'Не знает, нужна консультация',
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Telegram message for the owner (always in Russian; the lead's own language is noted).
export function formatLead(lead: LeadFields, title = 'Новая заявка с сайта Fir Tech') {
  const rows: [string, string][] = [
    ['Имя', lead.name],
    ['Связь', lead.contact],
    ['Услуга', serviceNames[lead.service]],
    ['Бюджет', lead.budget],
    [lead.service === 'bundle' ? 'Сборка' : 'Калькулятор', lead.estimate],
    ['Задача', lead.message],
    ['Язык', lead.locale.toUpperCase()],
    ['Страница', lead.page],
  ]
  const body = rows
    .filter(([, value]) => value)
    .map(([label, value]) => `<b>${label}:</b> ${escapeHtml(value)}`)
    .join('\n')
  return `<b>${title}</b>\n\n${body}`
}
