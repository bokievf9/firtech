export const locales = ['ru', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'ru'

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

// Picks the visitor's language for "/": English only when the browser prefers it over Russian
// (and its neighbours: Tajik, Uzbek, Kazakh, Kyrgyz, Ukrainian, Belarusian read Russian well).
export function pickLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag = '', q] = part.trim().split(';q=')
      return { lang: tag.toLowerCase().slice(0, 2), q: q ? Number(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)
  const russianFriendly = ['ru', 'tg', 'uz', 'kk', 'ky', 'uk', 'be']
  for (const { lang } of ranked) {
    if (russianFriendly.includes(lang)) return 'ru'
    if (lang === 'en') return 'en'
  }
  return 'en'
}

// First path segments of the pages that live under /ru and /en. A bare link to one of them
// (`https://firtech.pro/terms` in a contract or an offer) goes to the visitor's language like "/".
export const bareLocalePages = [
  'terms', 'privacy', 'pay-how', 'compare', 'referral', 'audit', 'status', 'builder', 'blog', 'ai-team', 'cabinet', 'solutions', 'services', 'how-we-work', 'products', 'security',
] as const

export function isBareLocalePath(pathname: string): boolean {
  const first = pathname.split('/')[1] ?? ''
  return (bareLocalePages as readonly string[]).includes(first)
}
