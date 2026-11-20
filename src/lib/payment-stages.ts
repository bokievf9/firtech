import { productCatalog } from '../content/builder-catalog'
import { productParts, type Build, type ProductId } from './builder'
import {
  defaultPricing,
  estimate,
  formatUsd,
  stageDefs,
  type Pricing,
  type StageTemplateId,
} from './pricing'
import { builderProduct, isProductId, type ProductId as HomeProductId } from './products'
import { serviceSlugs, type ServiceSlug } from './site'

// Payment by stages (owner decision 2026-11-21, contract: payment-stages-contract). Pure helpers over
// the config in pricing.ts: which template a build uses and what each stage costs.

export type PaymentStage = {
  id: string
  title: { ru: string; en: string }
  // Percent of the one-time total, from the template.
  share: number
  // Whole USD; the last stage absorbs the rounding remainder, so the sum equals the total.
  amountUsd: number
}

type Parts = Build['parts']

// bots.miniapp is a Mini App (the `app` template); other bot formats are `bot`.
function templateOfPart(slug: ServiceSlug, variant: string): Exclude<StageTemplateId, 'small'> {
  if (slug === 'websites') return 'site'
  if (slug === 'apps') return 'app'
  if (slug === 'automation') return 'automation'
  return variant === 'miniapp' ? 'app' : 'bot'
}

// The template of the most expensive part (ties: the first in service order). null = no parts.
export function templateForParts(
  parts: Parts,
  pricing: Pricing = defaultPricing,
): Exclude<StageTemplateId, 'small'> | null {
  let best: { id: Exclude<StageTemplateId, 'small'>; price: number } | null = null
  for (const slug of serviceSlugs) {
    const part = parts[slug]
    if (!part) continue
    const price = estimate(slug, part.variant, part.addons, pricing)
    if (!best || price > best.price) best = { id: templateOfPart(slug, part.variant), price }
  }
  return best?.id ?? null
}

// The template for a total: under the small-project limit two stages 50/50, else the parts'
// template (a total without parts, e.g. extras only, uses `site`).
export function stageTemplateId(
  parts: Parts,
  totalUsd: number,
  pricing: Pricing = defaultPricing,
): StageTemplateId {
  if (totalUsd < pricing.smallProjectMaxUsd) return 'small'
  return templateForParts(parts, pricing) ?? 'site'
}

// A catalogue product (builder id, or a home product id) to its template at its own price.
// Subscriptions (content, personal agents) and unpriced products have no stages: null.
export function stageTemplateForProduct(
  id: ProductId | HomeProductId,
  pricing: Pricing = defaultPricing,
): StageTemplateId | null {
  const key = (isProductId(id) ? builderProduct[id] : id) as ProductId
  if (!productCatalog[key]?.priced) return null
  const parts = productParts(key)
  const template = templateForParts(parts, pricing)
  if (!template) return null
  let total = 0
  for (const slug of serviceSlugs) {
    const part = parts[slug]
    if (part) total += estimate(slug, part.variant, part.addons, pricing)
  }
  return total < pricing.smallProjectMaxUsd ? 'small' : template
}

// Stages for a total. `source` is a build (or its parts) that picks the template, or a template id.
export function stagesFor(
  source: Pick<Build, 'parts'> | Parts | StageTemplateId,
  totalUsd: number,
  pricing: Pricing = defaultPricing,
): PaymentStage[] {
  const total = Math.round(totalUsd)
  if (!(total > 0)) return []
  let id: StageTemplateId
  if (typeof source === 'string') id = source
  else {
    const parts = ('parts' in source ? source.parts : source) as Parts
    id = stageTemplateId(parts, total, pricing)
  }
  const template = stageDefs(id, pricing)
  let paid = 0
  return template.map((stage, i) => {
    const last = i === template.length - 1
    const amountUsd = last ? total - paid : Math.round((total * stage.share) / 100)
    paid += amountUsd
    return { id: stage.id, title: stage.title, share: stage.share, amountUsd }
  })
}

// Cabinet track label for a stage, from the dictionary template (`cabinet.stageTrack.*`, `{n}`).
export function stageTrackLabel(template: string, n: number) {
  return template.replace('{n}', String(n))
}

// Copy carries `{small}` (the small-project limit); the amount comes from pricing.ts.
export function fillStageTokens(text: string, pricing: Pricing = defaultPricing) {
  return text.replaceAll('{small}', formatUsd(pricing.smallProjectMaxUsd))
}
