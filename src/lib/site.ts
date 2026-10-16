export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://firtech.pro').replace(
  /\/$/,
  '',
)

const telegramUsername = (process.env.NEXT_PUBLIC_TELEGRAM_USERNAME || '').replace(/^@/, '')
export const telegramUrl = telegramUsername ? `https://t.me/${telegramUsername}` : null
export const telegramHandle = telegramUsername ? `@${telegramUsername}` : null

export const serviceSlugs = ['websites', 'bots', 'apps', 'automation'] as const
export type ServiceSlug = (typeof serviceSlugs)[number]

// Smaller services shown in the "more" section on the home page. They have no own page: some reuse a
// main service's price and page (see `extraPrice` in pricing.ts), the rest are priced after a call.
export const extraSlugs = [
  'ai',
  'support',
  'payments',
  'seo',
  'crm',
  'design',
  'rescue',
  'internal',
] as const
export type ExtraSlug = (typeof extraSlugs)[number]

// Anything a lead can be about: a main service or an extra.
export type LeadService = ServiceSlug | ExtraSlug | 'bundle'

export function isServiceSlug(value: string): value is ServiceSlug {
  return (serviceSlugs as readonly string[]).includes(value)
}
