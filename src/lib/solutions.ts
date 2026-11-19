import type { Dict } from '@/content'
import { genericFaq, kindCatalog } from '../content/builder-catalog'
import { businessKinds, encodeBuild, presets, quote, type BusinessKind } from './builder'
import { formatUsd } from './pricing'

// Niche landing pages ("solutions"): one per business kind from the builder, except "other". Each
// page shows the kind's builder preset, so its price and contents always match the builder.
export type SolutionKind = Exclude<BusinessKind, 'other'>
export const allSolutionKinds = businessKinds.filter(
  (kind): kind is SolutionKind => kind !== 'other',
)

// The five original niches, with hand-written pages and their own FAQ. The footer lists only these:
// the full list (all kinds) lives on /solutions and in the sitemap.
export const solutionKinds = ['cafe', 'salon', 'shop', 'delivery', 'services'] as const

export function isSolutionKind(value: string): value is SolutionKind {
  return (allSolutionKinds as readonly string[]).includes(value)
}

// Opens the builder with this kind's starting set already picked (kind and products included).
export function solutionBuilderHref(locale: string, kind: SolutionKind) {
  return `/${locale}/builder?b=${encodeBuild(presets[kind])}`
}

export type SolutionCopy = {
  metaTitle: string
  metaDescription: string
  title: string
  sub: string
  card: string
  problems: { pain: string; fix: string }[]
  faq: { q: string; a: string }[]
}

// Meta descriptions stay within 120-160 characters (tested): the longest closing line that fits.
const metaTails = {
  ru: [
    'Состав стартового набора, цена и сроки на одной странице. Цену считает наш калькулятор.',
    'Состав стартового набора, цена и сроки на одной странице.',
  ],
  en: [
    'Contents of the starting set, price and timing on one page. Our calculator works out the price.',
    'Contents of the starting set, price and timing on one page.',
  ],
}

function metaDescription(sub: string, locale: string) {
  const tails = metaTails[locale === 'ru' ? 'ru' : 'en']
  const fits = tails.find((tail) => `${sub} ${tail}`.length <= 160)
  return `${sub} ${fits ?? tails[tails.length - 1]}`
}

// A kind's page text: the hand-written copy in the dictionary when there is some, otherwise built
// from the kind's row in the catalogue (headline, lead, three pains answered by three gets) and the
// shared FAQ. Every kind resolves to a complete page in both languages.
export function solutionCopy(kind: SolutionKind, locale: string, dict: Dict): SolutionCopy {
  const written = (dict.solutions.items as Record<string, SolutionCopy | undefined>)[kind]
  if (written) return written
  const entry = kindCatalog[kind]
  const [name, title, sub, pains, gets] = locale === 'ru' ? entry.ru : entry.en
  const from = formatUsd(quote(presets[kind]).total)
  return {
    metaTitle: title,
    metaDescription: metaDescription(sub, locale),
    title,
    sub,
    card: sub,
    problems: pains.map((pain, i) => ({ pain, fix: gets[i] ?? '' })),
    faq: genericFaq(locale, name, from),
  }
}
