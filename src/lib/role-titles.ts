import type { Locale } from './i18n'

// Agent role titles for PUBLIC pages (owner 2026-11-22): HQ and /admin speak English, but clients
// reading the Russian site see Russian names; the English site keeps English. One map keyed by HQ
// agent id; `roleTitle` falls back to the English title HQ sends (so a renamed id still maps), then
// to that title as it is. The Russian names match `aiTeams.agents.items` in content/ru.ts.
// Admin code does not use this module.

type Pair = { ru: string; en: string }
const p = (ru: string, en: string): Pair => ({ ru, en })

export const ROLE_TITLES: Record<string, Pair> = {
  director: p('Директор', 'Director'),
  'marketing-head': p('Руководитель маркетинга', 'Head of Marketing'),
  'content-maker': p('Контент-мейкер', 'Content Maker'),
  'trend-scout': p('Трендвотчер', 'Trend Scout'),
  publisher: p('Публикатор', 'Publisher'),
  seo: p('SEO-специалист', 'SEO'),
  analyst: p('Аналитик', 'Analyst'),
  'sales-head': p('Руководитель продаж', 'Head of Sales'),
  'lead-intake': p('Менеджер заявок', 'Lead Manager'),
  'lead-handler': p('Менеджер заявок', 'Lead Manager'),
  'client-bot': p('Ассистент клиента', 'Client Assistant'),
  prospector: p('Разведчик', 'Prospector'),
  presales: p('Пресейл', 'Presales'),
  referral: p('Менеджер рефералов', 'Referral Manager'),
  'referral-manager': p('Менеджер рефералов', 'Referral Manager'),
  'support-head': p('Руководитель поддержки', 'Head of Support'),
  monitoring: p('Мониторинг', 'Monitoring'),
  'customer-support': p('Служба поддержки', 'Customer Support'),
  support: p('Служба поддержки', 'Customer Support'),
  onboarding: p('Менеджер онбординга', 'Onboarding Manager'),
  'onboarding-manager': p('Менеджер онбординга', 'Onboarding Manager'),
  'production-head': p('Руководитель производства', 'Head of Production'),
  'project-manager': p('Менеджер проекта', 'Project Manager'),
  'reviewer-qa': p('Ревьюер и QA', 'Reviewer and QA'),
  deployer: p('Деплойер', 'Deployer'),
  'back-office-head': p('Руководитель бэк-офиса', 'Head of Back Office'),
  'backoffice-head': p('Руководитель бэк-офиса', 'Head of Back Office'),
  finance: p('Финансы', 'Finance'),
  billing: p('Биллинг', 'Billing'),
  documents: p('Документы', 'Documents'),
  'knowledge-base': p('База знаний', 'Knowledge Base'),
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

// English HQ title (any case) to the pair, for ids the map does not know.
const BY_TITLE: Map<string, Pair> = new Map(
  Object.values(ROLE_TITLES).map((v) => [norm(v.en), v] as [string, Pair]),
)
BY_TITLE.set('ai lead manager', ROLE_TITLES['lead-intake']!)

export function roleTitle(id: string, hqTitle: string, locale: Locale): string {
  const pair = ROLE_TITLES[id] ?? BY_TITLE.get(norm(hqTitle))
  return pair ? pair[locale] : hqTitle
}
