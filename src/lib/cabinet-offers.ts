import { productBuilderHref, type ProductId } from './products'

// What the cabinet offers the client, picked from their state (owner 2026-11-21: «больше
// промоушена»). Honest and data-driven: no invented numbers, prices come from pricing.ts through
// the product cards. `bundleDiscount` (pricing.ts) is 10% off the total of ONE estimate from two
// parts, so a second project is never promised a discount: the card only says to build the second
// part in the builder.

export type OfferState = {
  leadCount: number
  projectCount: number
  // A project that is not finished (status `draft` or `active`).
  projectInWork: boolean
}

export type Offer = { id: string; kind: 'product' | 'audit' | 'builder'; product?: ProductId; href: string }

export type OfferStage = 'start' | 'waiting' | 'grow'

export type OfferPlan = {
  stage: OfferStage
  // The cards of the «Обзор» block, one CTA each.
  cards: Offer[]
  // Two cards for the slim strip at the bottom of the other tabs.
  strip: Offer[]
}

export const offerStage = (s: OfferState): OfferStage =>
  s.projectCount > 0 ? 'grow' : s.leadCount > 0 ? 'waiting' : 'start'

const product = (locale: string, id: ProductId): Offer => ({
  id: `product-${id}`,
  kind: 'product',
  product: id,
  href: productBuilderHref(locale, id),
})
const audit = (locale: string): Offer => ({ id: 'audit', kind: 'audit', href: `/${locale}/audit` })
const second = (locale: string): Offer => ({ id: 'second', kind: 'builder', href: `/${locale}/builder` })

export function pickOffers(state: OfferState, locale: string): OfferPlan {
  const stage = offerStage(state)
  if (stage === 'start') {
    const cards = [product(locale, 'admin'), product(locale, 'receptionist'), product(locale, 'automation'), audit(locale)]
    return { stage, cards, strip: [cards[0]!, cards[3]!] }
  }
  if (stage === 'waiting') {
    const cards = [audit(locale), product(locale, 'content'), product(locale, 'automation')]
    return { stage, cards, strip: [cards[0]!, cards[1]!] }
  }
  // A project exists: subscription, AI implementation, automation. «Second part» only while one is in work.
  const cards: Offer[] = [product(locale, 'content'), product(locale, 'implementation'), product(locale, 'automation')]
  if (state.projectInWork) cards.push(second(locale))
  return { stage, cards, strip: [cards[0]!, state.projectInWork ? second(locale) : cards[1]!] }
}

export const offerState = (d: {
  leads: readonly unknown[] | null
  projects: readonly { status: string }[]
}): OfferState => ({
  leadCount: d.leads?.length ?? 0,
  projectCount: d.projects.length,
  projectInWork: d.projects.some((p) => p.status !== 'done'),
})

// The newest three for the blog block: only what the client needs.
export type OfferArticle = { slug: string; title: string; date: string }
export function latestArticles(
  articles: readonly { slug: string; date: string; ru: { title: string }; en: { title: string } }[],
  locale: 'ru' | 'en',
  max = 3,
): OfferArticle[] {
  return [...articles]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, max)
    .map((a) => ({ slug: a.slug, title: a[locale].title, date: a.date }))
}
