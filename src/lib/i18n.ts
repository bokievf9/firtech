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
