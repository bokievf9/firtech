import { z } from 'zod'
import { extraSlugs, serviceSlugs } from './site'

export const leadSchema = z.object({
  name: z.string().trim().min(1).max(80),
  contact: z.string().trim().min(3).max(120),
  service: z
    .union([z.enum(serviceSlugs), z.enum(extraSlugs), z.literal('unknown')])
    .default('unknown'),
  budget: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().max(2000).optional().default(''),
  estimate: z.string().trim().max(300).optional().default(''),
  locale: z.enum(['ru', 'en']).default('ru'),
  page: z.string().trim().max(200).optional().default(''),
  // Honeypot: hidden from people, bots fill it in.
  website: z.string().max(200).optional().default(''),
})

export type Lead = z.infer<typeof leadSchema>

const serviceNames: Record<Lead['service'], string> = {
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
  unknown: 'Не знает, нужна консультация',
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Telegram message for the owner (always in Russian; the lead's own language is noted).
export function formatLead(lead: Lead) {
  const rows: [string, string][] = [
    ['Имя', lead.name],
    ['Связь', lead.contact],
    ['Услуга', serviceNames[lead.service]],
    ['Бюджет', lead.budget],
    ['Калькулятор', lead.estimate],
    ['Задача', lead.message],
    ['Язык', lead.locale.toUpperCase()],
    ['Страница', lead.page],
  ]
  const body = rows
    .filter(([, value]) => value)
    .map(([label, value]) => `<b>${label}:</b> ${escapeHtml(value)}`)
    .join('\n')
  return `<b>Новая заявка с сайта Fir Tech</b>\n\n${body}`
}
