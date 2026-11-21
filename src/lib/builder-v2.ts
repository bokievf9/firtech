import { kindCatalog, type KindCategory } from '../content/builder-catalog'
import type { DemoNiche } from '../content/builder-v2'
import { deptForGoal } from '../content/builder-v2'
import {
  buildExtras,
  productParts,
  toggleProduct,
  type Build,
  type BuildExtra,
  type BusinessKind,
  type DeliveryChannel,
  type ProductId,
  type SiteNeed,
} from './builder'
import { familyGoalIds, legacyGoals, type GoalFamily } from './builder-ids'
import { defaultPricing, type Pricing } from './pricing'
import { serviceSlugs, type ServiceSlug } from './site'

// «Сборка проекта» v2 rules (owner review 2026-11-22): which goals, parts, extras and delivery channels
// a build offers, what is required before «Дальше», and what the final preview shows. Pure and
// tested (tests/builder-v2.test.mjs); prices only ever come from the Pricing argument.

// ------------------------------------------------------------------- families

export const productFamily: Record<ProductId, GoalFamily> = {
  personal: 'assistant',
  company: 'department',
  adminbot: 'admin',
  intake: 'leadmgr',
  bot: 'agent',
  automation: 'automation',
  content: 'content',
  miniapp: 'miniapp',
  aiteam: 'department',
  site: 'site',
  app: 'app',
}

// Agent products live somewhere (Telegram, a widget, the Fir Tech playground) and may go without a site.
// The flagships are not here: the Personal AI always lives in the client's Telegram and the AI company sets
// its channels in its own options (`lib/flagships.ts`).
export const agentProducts: readonly ProductId[] = ['adminbot', 'intake', 'bot']
export const hasAgent = (build: Build) => (build.products ?? []).some((id) => agentProducts.includes(id))
const has = (build: Build, id: ProductId) => (build.products ?? []).includes(id)

// -------------------------------------------------------------------- goals

// Goals that suit a niche's category, in priority order across every family. A family's list is
// reordered by it, so a salon sees «меньше неявок» first and a shop «каталог с ценами».
const categoryPriority: Record<KindCategory, readonly string[]> = {
  food: ['promo', 'repeat', 'ordertg', 'regular', 'reels', 'cards', 'season', 'faqoff', 'nocalls', 'onlineorder', 'prices'],
  beauty: ['noshow', 'nocalls', 'fillslots', 'upsell', 'reviews', 'portfolio', 'stories', 'reels', 'bookingtg', 'loyalty', 'trust'],
  retail: ['catalog', 'onlineorder', 'cards', 'repeat', 'loyalty', 'paytg', 'prices', 'nolost', 'paytrack', 'upsell'],
  services: ['portfolio', 'trust', 'speedlead', 'leadcollect', 'qualify', 'followup', 'moreleads', 'nolost', 'prices', 'reviews', 'handover'],
  education: ['reviews', 'repeat', 'bookingtg', 'langs', 'leadcollect', 'onboard', 'train', 'regular'],
  realty: ['trust', 'prices', 'speedlead', 'leadcollect', 'qualify', 'followup', 'nolost', 'handover', 'docs', 'portfolio', 'moreleads'],
  travel: ['langs', 'prices', 'faqoff', 'handover', 'season', 'portfolio', 'leadcollect'],
  b2b: ['reports', 'portfolio', 'qualify', 'followup', 'nolost', 'synctools', 'docs', 'knowledge', 'leadcollect', 'moreleads'],
  health: ['noshow', 'trust', 'nocalls', 'faqoff', 'reviews', 'handover', 'docs'],
  other: [],
}

export const goalsLimit = 9

// The goals offered for a build: the primary product's family set (at least six outcomes), two from
// each further family, reordered by the niche. Without a product, the website set. Goals the visitor
// already ticked stay in the list.
export function goalsFor(build: Build): string[] {
  const families = [...new Set((build.products ?? []).map((id) => productFamily[id]))]
  if (!families.length) families.push(build.parts.bots ? 'agent' : 'site')
  const out: string[] = []
  families.forEach((family, i) => {
    const ids = familyGoalIds[family] as readonly string[]
    for (const id of i === 0 ? ids : ids.slice(0, 2)) if (!out.includes(id)) out.push(id)
  })
  const priority = build.kind ? categoryPriority[kindCatalog[build.kind].category] : []
  const front = priority.filter((id) => out.includes(id))
  const ordered = [...front, ...out.filter((id) => !front.includes(id))].slice(0, goalsLimit)
  const extra = (build.goals ?? []).filter((id) => !ordered.includes(id))
  return [...ordered, ...extra]
}

export const allGoalSets = familyGoalIds
export const legacyGoalIds = legacyGoals

// ------------------------------------------------------------------- extras

// Sanity order of the paid options inside a part: what most clients need first, cheap and
// self-explanatory before the rare ones.
export const addonOrder: Record<ServiceSlug, readonly string[]> = {
  websites: ['cms', 'payments', 'telegram', 'language'],
  bots: ['ai', 'broadcasts', 'payments', 'admin'],
  apps: ['accounts', 'payments', 'push', 'admin'],
  automation: ['sheets', 'alerts', 'training', 'support'],
}
export const extraOrder: readonly BuildExtra[] = ['seo', 'design', 'crm', 'internal', 'rescue', 'support']

// Owner rule (2026-11-22): a second language of a site cannot cost more than a lead channel («заявки
// в Telegram»). Prices stay as they are in pricing.ts; when the rule is broken the language option is
// hidden from the features step and listed for the owner in docs/builder-v2.md.
export function languageRuleBroken(pricing: Pricing = defaultPricing) {
  const language = pricing.catalog.websites.addons.language ?? 0
  const leadChannel = pricing.catalog.websites.addons.telegram ?? Number.POSITIVE_INFINITY
  return language > leadChannel
}

// Every extra the owner's price rules hide, with the numbers (for the docs and the tests).
export function hiddenByPriceRule(pricing: Pricing = defaultPricing) {
  return languageRuleBroken(pricing)
    ? [
        {
          service: 'websites' as const,
          id: 'language',
          price: pricing.catalog.websites.addons.language ?? 0,
          limit: pricing.catalog.websites.addons.telegram ?? 0,
        },
      ]
    : []
}

// What the picked products already include (shown pre-selected on the parts step, never offered
// again as an extra).
export function includedAddons(build: Build, slug: ServiceSlug): string[] {
  const out = new Set<string>()
  for (const id of build.products ?? []) {
    const own = productParts(id)[slug]
    for (const addon of own?.addons ?? []) out.add(addon)
  }
  return [...out]
}

// The paid options offered inside a part, in sanity order. Hidden: what a product already includes,
// the lead channel «заявки в Telegram» for the receptionist (it answers in the chat itself), the second
// language while the price rule is broken (unless the part already has it from a preset), and anything
// for a part the build does not have.
export function visibleAddons(build: Build, slug: ServiceSlug, pricing: Pricing = defaultPricing): string[] {
  const part = build.parts[slug]
  if (!part) return []
  const known = Object.keys(pricing.catalog[slug].addons)
  const included = includedAddons(build, slug)
  const hidden = new Set<string>(included)
  if (slug === 'websites' && has(build, 'intake')) hidden.add('telegram')
  if (slug === 'websites' && languageRuleBroken(pricing) && !part.addons.includes('language'))
    hidden.add('language')
  // The lead manager only answers and collects requests: mailings and payments are for a shop or a clinic
  // (or when another product of the build brings them anyway).
  if (slug === 'bots' && has(build, 'intake') && !has(build, 'adminbot') && !has(build, 'miniapp') && !has(build, 'bot')) {
    const niche = demoNicheOf(build.kind)
    if (niche !== 'shop' && niche !== 'clinic') {
      hidden.add('broadcasts')
      hidden.add('payments')
    }
  }
  const order = addonOrder[slug]
  return known
    .filter((id) => !hidden.has(id))
    .sort((a, b) => rank(order, a) - rank(order, b))
}
const rank = (order: readonly string[], id: string) => {
  const i = order.indexOf(id)
  return i === -1 ? order.length : i
}

// The studio-wide extras (SEO, brand kit, monthly support) that make sense for this build.
export function visibleExtras(build: Build): BuildExtra[] {
  const hasParts = Object.keys(build.parts).length > 0
  return extraOrder.filter((id) => {
    if (!(buildExtras as readonly string[]).includes(id)) return false
    if (id === 'seo') return Boolean(build.parts.websites)
    if (id === 'support') return hasParts
    // CRM under key: not when the build already holds the CRM format of automation or a department.
    if (id === 'crm') return hasParts && build.parts.automation?.variant !== 'crm' && !has(build, 'aiteam')
    // Internal systems: for builds with automation or an app, unless the app already is one.
    if (id === 'internal')
      return Boolean(build.parts.automation || build.parts.apps) && build.parts.apps?.variant !== 'internal'
    // A fix of someone else's project: next to any real part.
    if (id === 'rescue') return hasParts
    return true
  })
}

// ---------------------------------------------------------- delivery and site

export const effectiveSiteNeed = (build: Build): SiteNeed | undefined =>
  build.siteNeed ?? (build.parts.websites || has(build, 'site') ? 'need' : undefined)

export function effectiveDelivery(build: Build): DeliveryChannel[] {
  if (!hasAgent(build)) return build.delivery ?? []
  const picked = build.delivery ?? ['telegram']
  const need = effectiveSiteNeed(build)
  return need === 'no' ? picked.filter((id) => id !== 'widget') : picked
}

export type DeliveryOption = { id: DeliveryChannel; disabled: boolean }
export function deliveryOptions(build: Build): DeliveryOption[] {
  const need = effectiveSiteNeed(build)
  return (['telegram', 'widget', 'whatsapp', 'playground'] as const)
    .filter((id) => !(id === 'widget' && need === 'no'))
    .map((id) => ({ id, disabled: id === 'whatsapp' }))
}

// The visitor says whether the agent gets a website. `no` and `have` take the site out of the build
// and the flow never proposes it again; `need` puts a landing page in.
export function applySiteNeed(build: Build, need: SiteNeed): Build {
  let next: Build = { ...build, siteNeed: need }
  if (need === 'need') {
    if (!has(next, 'site') && !next.parts.websites) next = toggleProduct(next, 'site')
    return next
  }
  const parts = { ...next.parts }
  delete parts.websites
  next = { ...next, parts, extras: next.extras.filter((id) => id !== 'seo') }
  if (has(next, 'site')) {
    const products = (next.products ?? []).filter((id) => id !== 'site')
    if (products.length) next.products = products
    else delete next.products
  }
  if (need === 'no' && next.delivery) {
    next.delivery = next.delivery.filter((id) => id !== 'widget')
  }
  return next
}

// A kind or product pick replaces products and parts; an earlier «сайт не нужен» is applied again.
export function reapplySiteNeed(build: Build): Build {
  return build.siteNeed && build.siteNeed !== 'need' ? applySiteNeed(build, build.siteNeed) : build
}

export function toggleDelivery(build: Build, id: DeliveryChannel): Build {
  const now = effectiveDelivery(build)
  const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id]
  return { ...build, delivery: next }
}

// ------------------------------------------------------------------ required

export type StepIssue =
  | 'kind'
  | 'products'
  | 'site'
  | 'goals'
  | 'delivery'
  | 'parts'
  | 'company'
  | 'clients'
  | 'owner'
  | 'deadline'
  | 'after'

export const hasContentOf = (build: Build) =>
  Object.keys(build.parts).length > 0 || (build.products?.length ?? 0) > 0

// Required answers (owner review 2026-11-22). The business name, who the clients are, who answers on
// the client's side and when it must be live are needed for every project; what happens after a
// request is needed when an agent takes the requests.
export function requiredDetails(build: Build): StepIssue[] {
  const d = build.details ?? {}
  const out: StepIssue[] = []
  if (!d.company?.trim()) out.push('company')
  if (!d.clients?.trim() && !d.clientTypes?.length) out.push('clients')
  if (!d.owner?.trim()) out.push('owner')
  if (!d.deadline) out.push('deadline')
  if (hasAgent(build) && !d.after?.length) out.push('after')
  return out
}

// What blocks «Дальше» on a screen (0-based index: niche, products, goals, set, features, theme,
// details, preview). Empty = free to go on.
export function stepIssues(build: Build, step: number): StepIssue[] {
  const content = hasContentOf(build)
  switch (step) {
    case 0:
      return build.kind || content ? [] : ['kind']
    case 1: {
      if (!content) return ['products']
      if (hasAgent(build) && effectiveSiteNeed(build) === undefined) return ['site']
      return []
    }
    case 2:
      return build.goals?.length ? [] : ['goals']
    case 3: {
      if (!content) return ['parts']
      if (hasAgent(build) && !effectiveDelivery(build).length) return ['delivery']
      return []
    }
    case 6:
      return requiredDetails(build)
    default:
      return []
  }
}

// ------------------------------------------------------------------- preview

export type PreviewMode = 'site' | 'agent' | 'playground' | 'department' | 'miniapp' | 'content' | 'automation' | 'personal'

// The views the final screen offers, the most fitting first: an agent's chat leads, the rest follow
// the order the products were picked in, then parts that no product brought.
export function previewModes(build: Build): PreviewMode[] {
  const modes: PreviewMode[] = []
  if (hasAgent(build)) {
    const delivery = effectiveDelivery(build)
    const playgroundOnly = delivery.includes('playground') && !delivery.some((d) => d === 'telegram' || d === 'widget')
    if (!playgroundOnly) modes.push('agent')
    if (delivery.includes('playground')) modes.push('playground')
  }
  const siteAllowed = effectiveSiteNeed(build) !== 'no'
  for (const id of build.products ?? []) {
    if (id === 'personal') modes.push('personal')
    else if (id === 'aiteam' || id === 'company') modes.push('department')
    else if (id === 'miniapp') modes.push('miniapp')
    else if (id === 'content') modes.push('content')
    else if (id === 'site' && siteAllowed) modes.push('site')
    else if (id === 'automation') modes.push('automation')
  }
  if (build.parts.bots?.variant === 'miniapp') modes.push('miniapp')
  if (build.parts.websites) modes.push('site')
  if (build.parts.automation) modes.push('automation')
  const unique = [...new Set(modes)]
  if (unique.length) return unique
  return [effectiveSiteNeed(build) === 'no' ? 'playground' : 'site']
}

// The playground persona (HQ `demo-<niche>`) closest to a business kind.
export function demoNicheOf(kind: BusinessKind | undefined): DemoNiche {
  switch (kind) {
    case 'barber': case 'salon': case 'nails': case 'spa': case 'cosmetology': case 'massage':
    case 'fitness': case 'yoga': case 'photo':
      return 'salon'
    case 'dentist': case 'clinic': case 'vet': case 'pharmacy':
      return 'clinic'
    case 'shop': case 'webshop': case 'flowers': case 'gifts': case 'clothing': case 'electronics':
    case 'furniture': case 'autoparts': case 'petshop': case 'wholesale':
      return 'shop'
    case 'cafe': case 'restaurant': case 'coffee': case 'bakery': case 'delivery': case 'catering':
      return 'cafe'
    case 'tutor': case 'languages': case 'kidscenter': case 'drivingschool': case 'onlineschool':
      return 'courses'
    default:
      return 'service'
  }
}

// The department an «ИИ-отдел» preview draws: by the first goal that points at one, else support.
export function departmentOf(build: Build): 'marketing' | 'sales' | 'support' | 'production' | 'backoffice' {
  for (const goal of build.goals ?? []) {
    const dept = deptForGoal[goal]
    if (dept) return dept
  }
  return 'support'
}

// Every id that must be known by name somewhere in the UI (used by tests).
export const knownServiceSlugs = serviceSlugs
