import type { Dict } from '@/content'
import { genericFaq, kindCatalog } from '../content/builder-catalog'
import { solutionPromises } from '../content/solution-promises'
import { businessKinds, encodeBuild, presets, type Build, type BusinessKind } from './builder'
import { serviceSlugs, type ServiceSlug } from './site'
import { defaultPricing, type Pricing } from './pricing'
import { nichePrice } from './builder-presets'
import { priceLine } from './price-format'

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
  // What we build for this niche (cards, meta, JSON-LD).
  title: string
  // The niche page headline: the result the owner of this business gets (content/solution-promises.ts).
  promise: string
  sub: string
  card: string
  problems: { pain: string; fix: string }[]
  faq: { q: string; a: string }[]
}

// Meta descriptions stay within 120-160 characters (tested): the longest closing line that fits.
const metaTails = {
  ru: [
    'Состав стартового набора, цена, сроки и этапы оплаты на одной странице. Всё видно до заявки.',
    'Состав стартового набора, цена, сроки и этапы оплаты на одной странице.',
    'Состав стартового набора, цена и сроки на одной странице.',
  ],
  en: [
    'Contents of the starting set, price, timing and payment stages on one page. All of it is clear before you apply.',
    'Contents of the starting set, price, timing and payment stages on one page.',
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
export function solutionCopy(
  kind: SolutionKind,
  locale: string,
  dict: Dict,
  pricing: Pricing = defaultPricing,
): SolutionCopy {
  const promise = solutionPromises[kind][locale === 'ru' ? 'ru' : 'en']
  const written = (dict.solutions.items as Record<string, Omit<SolutionCopy, 'promise'> | undefined>)[kind]
  if (written) return { ...written, promise }
  const entry = kindCatalog[kind]
  const [name, title, sub, pains, gets] = locale === 'ru' ? entry.ru : entry.en
  const np = nichePrice(kind, pricing)
  const from = priceLine(np.oneTime, np.monthly, locale)
  return {
    metaTitle: title,
    metaDescription: metaDescription(sub, locale),
    title,
    promise,
    sub,
    card: sub,
    problems: pains.map((pain, i) => ({ pain, fix: gets[i] ?? '' })),
    faq: genericFaq(locale, name, from),
  }
}

// The term of the build's main part: the most expensive service line and its format's term from the
// dictionary (`estimator.catalog`). Terms stay per part, like in the builder, so this names the one
// that sets the pace; null when the build has no service part.
export function mainPartTerm(
  build: Build,
  lines: readonly { id: string; price: number }[],
  dict: Dict,
): string | null {
  let best: { slug: ServiceSlug; price: number } | null = null
  for (const line of lines) {
    if (!(serviceSlugs as readonly string[]).includes(line.id) || !build.parts[line.id as ServiceSlug]) continue
    if (!best || line.price > best.price) best = { slug: line.id as ServiceSlug, price: line.price }
  }
  if (!best) return null
  const variant = build.parts[best.slug]!.variant
  const variants = dict.estimator.catalog[best.slug].variants as Record<string, { term: string }>
  return variants[variant]?.term ?? null
}
