import type { Build } from './builder'
import {
  companyDepts,
  companyParts,
  flagshipOptionIds,
  personalExtras,
  personalServices,
  type FlagshipProduct,
} from './builder-ids'
import { companyPlanOf, defaultPricing, personalPlanList, type PersonalLevel, type Plan, type Pricing } from './pricing'

// The two flagships in «Сборка проекта» (owner 2026-11-22): «Персональный ИИ» and «ИИ-компания». Pure and
// tested (tests/flagships.test.mjs). Their options ride in the link as `f.<product>.<ids>`; prices only come
// from the Pricing argument (`personalPlans`, `companyPlan`), never from copy, and never join the one-time
// total of the build (both are setup plus a monthly plan, listed apart like the content subscription).

export { companyDepts, companyParts, personalExtras, personalServices }

// What a flagship starts with when the visitor picks it: the lowest Personal AI level (mail and calendar),
// and for the company the sales department with the control room, the knowledge base and training.
export const defaultOptions: Record<FlagshipProduct, string[]> = {
  personal: ['mail', 'calendar'],
  company: ['sales', 'pult', 'knowledge', 'training'],
}

export function optionsOf(build: Build, product: FlagshipProduct): string[] {
  const picked = build.options?.[product]
  return picked?.length ? picked : [...defaultOptions[product]]
}

// Turns one option on or off (unknown ids are ignored).
export function toggleOption(build: Build, product: FlagshipProduct, option: string): Build {
  if (!(flagshipOptionIds[product] as readonly string[]).includes(option)) return build
  const now = optionsOf(build, product)
  const next = now.includes(option) ? now.filter((x) => x !== option) : [...now, option]
  const order = flagshipOptionIds[product] as readonly string[]
  const sorted = order.filter((id) => next.includes(id))
  return { ...build, options: { ...build.options, [product]: sorted } }
}

// The Personal AI level from what it connects: up to two services is «Старт»; three or four services or the
// voice is «Плюс»; five services or more, or the long memory, is «Максимум».
export function personalLevel(options: readonly string[]): PersonalLevel {
  const services = options.filter((id) => (personalServices as readonly string[]).includes(id)).length
  if (services >= 5 || options.includes('memory')) return 'max'
  if (services >= 3 || options.includes('voice')) return 'plus'
  return 'basic'
}

export type FlagshipPrice = { product: FlagshipProduct; plan: Plan; byQuote: boolean; options: string[] }

// The plan a flagship of this build shows: the level plan of the Personal AI, the starting plan of the company.
export function flagshipPrice(build: Build, product: FlagshipProduct, pricing: Pricing = defaultPricing): FlagshipPrice {
  const options = optionsOf(build, product)
  if (product === 'personal') {
    const level = personalLevel(options)
    const plan = personalPlanList(pricing).find((p) => p.id === level)!
    return { product, plan, byQuote: false, options }
  }
  return { product, plan: companyPlanOf(pricing), byQuote: true, options }
}

// Every flagship picked in a build, in catalogue order.
export function flagshipsOf(build: Build, pricing: Pricing = defaultPricing): FlagshipPrice[] {
  return (['personal', 'company'] as const)
    .filter((id) => (build.products ?? []).includes(id))
    .map((id) => flagshipPrice(build, id, pricing))
}
