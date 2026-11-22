import { agentPlanList, agentSubscriptionOf, companyPlanOf, contentPlanList, personalPlanList, extraPrices, stageDefs, stageTemplateIds, type Pricing, type StageDef, type StageTemplateId } from './pricing'
import { productIds, productPrices, type ProductPrice } from './products'

// Public machine-readable prices (GET /api/prices): the one source the agents read instead of
// their own copies. Built only from the live `Pricing` (pricing.ts defaults + the owner's overrides
// from the Пульт, pricing-store.ts). `PRICES_UPDATED_AT` is the date of the defaults; the route
// reports the store's own `updatedAt` once the owner has edited anything.
export const PRICES_UPDATED_AT = '2026-11-21'

export function pricesJson(pricing: Pricing, updatedAt: string = PRICES_UPDATED_AT) {
  const prices = productPrices(pricing)
  const products = Object.fromEntries(
    productIds.map((id): [string, ProductPrice] => [id, prices[id]]),
  )
  const stages = Object.fromEntries(
    stageTemplateIds.map((id) => [id, stageDefs(id, pricing)]),
  ) as Record<StageTemplateId, StageDef[]>
  return {
    currency: 'USD' as const,
    updatedAt,
    startingPrice: pricing.startingPrice,
    catalog: pricing.catalog,
    extraPrice: extraPrices(pricing),
    // Flagships (2026-11-22): the three Personal AI levels and the AI company's starting plan (exact sum by the quote).
    personalPlans: personalPlanList(pricing),
    companyPlan: companyPlanOf(pricing),
    // Subscription model (2026-11-22): every AI product is setup + monthly (model usage included) and a lower
    // `byokMonthly` with the client's own API key. One agent, the team discount (percent off the sum of its agents)
    // and the AI company's extra per employee above five.
    agentSubscription: agentSubscriptionOf(pricing),
    teamDiscountPercent: pricing.teamDiscount,
    companyPerEmployee: pricing.companyPerEmployee,
    // DEPRECATED: Dono and Polly are no longer sold; kept while HQ's schema still requires them.
    agentPlans: agentPlanList(pricing),
    contentPlans: contentPlanList(pricing),
    referralPercent: pricing.referralPercent,
    // Payment stages (2026-11-21): templates with id, ru/en title and share; projects with a one-time
    // total under `smallProjectMaxUsd` use the `small` template.
    stages,
    smallProjectMaxUsd: pricing.smallProjectMaxUsd,
    bundleDiscountPercent: pricing.bundleDiscount,
    products,
  }
}
