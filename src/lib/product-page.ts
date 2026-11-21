import { stagesFor, stageTemplateForProduct, type PaymentStage } from './payment-stages'
import { defaultPricing, type Pricing, type StageTemplateId } from './pricing'
import { ladderIds, ladderLevels, ladders, type LadderId, type LadderLevel } from './ladder'
import type { Dict } from '../content/ru'
import { quote } from './builder'
import { productBuild, productPrices, type ProductId } from './products'
import { mainPartTerm } from './solutions'

// What the «Цена и оплата» block of a product page shows (owner 2026-11-22), all from the live
// pricing: a priced product gets the stage table of its template at its own price; the content and
// personal-assistant subscriptions say they are paid monthly in advance; unpriced ones say «по смете».
export type ProductPayment =
  | { kind: 'stages'; template: StageTemplateId; total: number; stages: PaymentStage[] }
  | { kind: 'subscription' }
  | { kind: 'quote' }

export function productPayment(id: ProductId, pricing: Pricing = defaultPricing): ProductPayment {
  const price = productPrices(pricing)[id]
  if (price.kind === 'plans') return { kind: 'subscription' }
  if (price.kind === 'quote') return { kind: 'quote' }
  const template = stageTemplateForProduct(id, pricing)
  if (!template) return { kind: 'quote' }
  const stages = stagesFor(template, price.from, pricing)
  if (!stages.length) return { kind: 'quote' }
  return { kind: 'stages', template, total: price.from, stages }
}

// The ladder rung a product stands on (the autopilot content product, the lead manager as the one
// agent of the sales track), if any.
export function ladderOfProduct(id: ProductId): { track: LadderId; level: LadderLevel } | null {
  for (const track of ladderIds)
    for (const level of ladderLevels) {
      const target = ladders[track][level]
      if (target.kind === 'product' && target.id === id) return { track, level }
    }
  return null
}

// The term of the product's main part, the same way solution pages count it: the most expensive service line of the
// product's build and its format's term from the dictionary. Null when the build has no service part (subscriptions).
export function productTerm(id: ProductId, dict: Dict, pricing: Pricing = defaultPricing): string | null {
  const build = productBuild(id)
  return mainPartTerm(build, quote(build, pricing).lines, dict)
}
