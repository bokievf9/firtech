export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://firtech.pro').replace(/\/$/, '')

const telegramUsername = (process.env.NEXT_PUBLIC_TELEGRAM_USERNAME || '').replace(/^@/, '')
export const telegramUrl = telegramUsername ? `https://t.me/${telegramUsername}` : null
export const telegramHandle = telegramUsername ? `@${telegramUsername}` : null

export const serviceSlugs = ['websites', 'bots', 'apps', 'automation'] as const
export type ServiceSlug = (typeof serviceSlugs)[number]

export function isServiceSlug(value: string): value is ServiceSlug {
  return (serviceSlugs as readonly string[]).includes(value)
}
