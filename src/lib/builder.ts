import {
  kindCatalog,
  kindIds,
  legacyBuilderProducts,
  productCatalog,
  productIds,
  type KindId,
  type ProductId,
} from '../content/builder-catalog'
import { bundleFraction, defaultPricing, estimate, extraPrices, type Pricing } from './pricing'
import { serviceSlugs, type ServiceSlug } from './site'
import {
  afterSteps,
  budgets,
  buildChannels,
  buildGoals,
  clientSources,
  clientTools,
  clientTypes,
  deliveryChannels,
  detailAssets,
  flagshipOptionIds,
  flagshipProducts,
  type FlagshipProduct,
  detailDeadlines,
  detailLangs,
  fears,
  siteNeeds,
  themeIds,
  themeMoods,
  type AfterStep,
  type Budget,
  type BuildChannel,
  type BuildGoal,
  type ClientSource,
  type ClientTool,
  type ClientType,
  type DeliveryChannel,
  type DetailAsset,
  type DetailDeadline,
  type DetailLang,
  type Fear,
  type SiteNeed,
  type ThemeId,
  type ThemeMood,
} from './builder-ids'
import {
  discoveryJson,
  parseDiscoveryJson,
  parsePersonalJson,
  personalJson,
  personalOnly,
  type Discovery,
  type PersonalBrief,
} from './builder-personal'
import { catalogJson, isCatalogChunk, keepSubNiches, parseCatalogJson, type CatalogPick } from './builder-capabilities'

// The project builder: a visitor combines several services and extras into one quote. All prices
// come from pricing.ts, so the builder and the showcase always agree.

// Extras that make sense as a part of a build. The others are already a format or option of a main
// service (AI assistant, CRM, payments, internal systems) or are not something you "build" (rescue).
// `rescue`, `crm` and `internal` were added 2026-11-22; their prices are the ones already in pricing.ts.
export const buildExtras = ['support', 'seo', 'design', 'rescue', 'crm', 'internal'] as const
export type BuildExtra = (typeof buildExtras)[number]

export type BuildPart = { variant: string; addons: string[] }

// The brief around the parts: goals, look and details. None of it changes the price; it travels
// with the build (link, lead, PDF) so the first call starts from what the visitor already said.
export {
  buildGoals,
  buildChannels,
  detailLangs,
  detailAssets,
  detailDeadlines,
  clientTypes,
  clientSources,
  afterSteps,
  clientTools,
  fears,
  budgets,
  deliveryChannels,
  siteNeeds,
  themeIds,
  themeMoods,
  type BuildGoal,
  type BuildChannel,
  type DetailLang,
  type DetailAsset,
  type DetailDeadline,
  type ClientType,
  type ClientSource,
  type AfterStep,
  type ClientTool,
  type Fear,
  type Budget,
  type DeliveryChannel,
  type SiteNeed,
  type ThemeId,
  type ThemeMood,
} from './builder-ids'

// Style has two layers. The old four (`look`, `accent`, `theme`, `font`) still decode, so old links
// keep their look. The new axes (palette, type, shape, density, mood) combine freely, and a ready
// look (`kit`) sets all five at once. Style only restyles the mockup and never changes the price.
export const styleLooks = ['minimal', 'bold', 'premium', 'friendly', 'tech'] as const
export type StyleLook = (typeof styleLooks)[number]
export const styleAccents = [
  'lime',
  'mint',
  'sky',
  'violet',
  'coral',
  'amber',
  'rose',
  'mono',
] as const
export type StyleAccent = (typeof styleAccents)[number]
export const styleThemes = ['dark', 'light'] as const
export type StyleTheme = (typeof styleThemes)[number]
export const styleFonts = ['strict', 'soft', 'bold'] as const
export type StyleFont = (typeof styleFonts)[number]

export const stylePalettes = [
  'fir',
  'midnight',
  'noir',
  'ember',
  'aurora',
  'forest',
  'plum',
  'graphite',
  'paper',
  'sand',
  'mintlight',
  'skylight',
  'blush',
  'lemon',
  'lavender',
  'latte',
] as const
export type StylePalette = (typeof stylePalettes)[number]
export const styleTypes = [
  'geometric',
  'grotesk',
  'humanist',
  'serif',
  'mono',
  'rounded',
  'condensed',
] as const
export type StyleType = (typeof styleTypes)[number]
export const styleShapes = ['sharp', 'soft', 'pill'] as const
export type StyleShape = (typeof styleShapes)[number]
export const styleDensities = ['airy', 'compact'] as const
export type StyleDensity = (typeof styleDensities)[number]
export const styleMoods = ['minimal', 'bold', 'playful', 'premium'] as const
export type StyleMood = (typeof styleMoods)[number]
export const styleKits = [
  'fir',
  'nocturne',
  'atelier',
  'sunny',
  'candy',
  'brutal',
  'luxe',
  'clinic',
  'eco',
  'bistro',
  'barber',
  'techy',
  'aurora',
  'journal',
  'kids',
  'forest',
  'wine',
  'coffee',
  'ember',
] as const
export type StyleKit = (typeof styleKits)[number]

export type BuildStyle = {
  look?: StyleLook
  accent?: StyleAccent
  theme?: StyleTheme
  font?: StyleFont
  palette?: StylePalette
  type?: StyleType
  shape?: StyleShape
  density?: StyleDensity
  mood?: StyleMood
  kit?: StyleKit
  // The theme by genre and its mood (2026-11-22). Palette, type, shape, density and mood above, when
  // set next to a theme, are the visitor's fine tuning inside it.
  themeId?: ThemeId
  themeMood?: ThemeMood
}
// What the mockup shows until the visitor picks: the studio's own look.
export const defaultStyle: Required<Pick<BuildStyle, 'look' | 'accent' | 'theme' | 'font'>> = {
  look: 'tech',
  accent: 'lime',
  theme: 'dark',
  font: 'strict',
}

export const pagesRange = { min: 1, max: 20 } as const
export const textLimits = {
  wish: 300,
  example: 100,
  examples: 2,
  company: 40,
  clients: 160,
  owner: 80,
  detailsJson: 900,
} as const
export type BuildDetails = {
  // Kept for old links only: the question was removed from the screen (2026-11-22).
  pages?: number
  langs?: DetailLang[]
  has?: DetailAsset[]
  examples?: string[]
  deadline?: DetailDeadline
  wish?: string
  // Details that save the first call (2026-11-22); they ride in one base64url JSON chunk `u.{...}`.
  company?: string
  clients?: string
  clientTypes?: ClientType[]
  sources?: ClientSource[]
  after?: AfterStep[]
  tools?: ClientTool[]
  owner?: string
  fears?: Fear[]
  budget?: Budget
}

export type Build = {
  kind?: BusinessKind
  products?: ProductId[]
  parts: Partial<Record<ServiceSlug, BuildPart>>
  extras: BuildExtra[]
  goals?: BuildGoal[]
  channels?: BuildChannel[]
  style?: BuildStyle
  details?: BuildDetails
  // Where an agent lives (Telegram, a site widget, WhatsApp later, the Fir Tech playground) and
  // whether it gets a website at all. Neither changes a price.
  delivery?: DeliveryChannel[]
  siteNeed?: SiteNeed
  // Options of the flagships (services of the Personal AI, departments of the AI company), chunk `f.`.
  // They pick the plan level shown in the builder; the one-time total never includes them.
  options?: Partial<Record<FlagshipProduct, string[]>>
  // The personal path (2026-11-22): who the person is, what they hand over, where the agent lives, what it
  // connects to, its character and tier. Chunk `m.<base64url JSON>`. The discovery answers of both paths
  // (size, volumes, hours, pains, success, how they heard of us) ride in chunk `v.<base64url JSON>`.
  personal?: PersonalBrief
  discovery?: Discovery
  // v5 (2026-11-23): picks from the capability catalogue (sub-niches, results, abilities, channel sub-options,
  // integrations, content, personal skills), one chunk `x.<base64url JSON>` (lib/builder-capabilities.ts).
  catalog?: CatalogPick
}

export const emptyBuild: Build = { parts: {}, extras: [] }

// The kinds, their copy and presets live in src/content/builder-catalog.ts (one table per kind).
export const businessKinds = kindIds
export type BusinessKind = KindId
export { productIds, type ProductId }

// Starting sets per kind of business, so nobody starts from a blank page: the kind, its usual
// products and the parts they need. Pure suggestions: the visitor edits them in the next steps.
function presetOf(id: BusinessKind): Build {
  const entry = kindCatalog[id]
  const build: Build = { parts: {}, extras: [] }
  for (const chunk of entry.preset.split('~')) {
    const [head = '', second = '', third = ''] = chunk.split('.')
    if (head === 'x') build.extras = keepKnown(second, buildExtras)
    else if ((serviceSlugs as readonly string[]).includes(head))
      build.parts[head as ServiceSlug] = {
        variant: second,
        addons: third ? third.split('-') : [],
      }
  }
  return {
    kind: id,
    ...(entry.products.length ? { products: [...entry.products] } : {}),
    ...build,
  }
}

export const presets = Object.fromEntries(
  businessKinds.map((id) => [id, presetOf(id)]),
) as Record<BusinessKind, Build>

// What a product pre-selects, as a build (parts only). Unpriced products select nothing.
export function productParts(id: ProductId): Build['parts'] {
  const spec = productCatalog[id].parts
  return spec ? (decodeBuild(spec)?.parts ?? {}) : {}
}

// Products with a matching price in pricing.ts add their parts to the quote; the rest are listed
// "on quote" and are never summed into a number.
export function productsOnRequest(build: Build): ProductId[] {
  return (build.products ?? []).filter((id) => !productCatalog[id].priced)
}

// Turns a product on or off. On: its parts join the build (an existing part keeps its format and
// gains the product's options). Off: parts that came from this product and were not changed since
// leave again, unless another picked product still needs them.
export function toggleProduct(build: Build, id: ProductId): Build {
  const products = build.products ?? []
  const parts = { ...build.parts }
  const mine = productParts(id)
  let next: ProductId[]
  if (products.includes(id)) {
    next = products.filter((p) => p !== id)
    for (const slug of serviceSlugs) {
      const own = mine[slug]
      const part = parts[slug]
      if (!own || !part) continue
      const shared = next.some((other) => productParts(other)[slug])
      const untouched =
        part.variant === own.variant && part.addons.every((a) => own.addons.includes(a))
      if (!shared && untouched) delete parts[slug]
    }
  } else {
    next = [...products, id]
    for (const slug of serviceSlugs) {
      const own = mine[slug]
      if (!own) continue
      const part = parts[slug]
      parts[slug] = part
        ? { ...part, addons: [...new Set([...part.addons, ...own.addons])] }
        : { variant: own.variant, addons: [...own.addons] }
    }
  }
  const out: Build = { ...build, parts }
  if (next.length) out.products = next
  else delete out.products
  // A flagship that leaves the build takes its options with it.
  if (out.options && !next.includes(id) && (flagshipProducts as readonly string[]).includes(id)) {
    const options = { ...out.options }
    delete options[id as FlagshipProduct]
    if (Object.keys(options).length) out.options = options
    else delete out.options
  }
  return withSiteLanguage(out)
}

// A kind's starting set replaces kind, products, parts and extras; the brief the visitor already
// gave (goals, channels, style, details) stays. Goals come from the kind only while none are set.
export function applyKind(build: Build, id: BusinessKind): Build {
  const preset = structuredClone(presets[id])
  const next: Build = { ...build, ...preset }
  if (!preset.products) delete next.products
  if (!build.goals?.length && kindCatalog[id].goals.length) next.goals = [...kindCatalog[id].goals]
  return keepSubNiches(withSiteLanguage(next))
}

// Two or more languages already chosen on the details screen keep the paid "second language"
// option on a website that joins the build later (another kind, product or part picked after).
export function withSiteLanguage(build: Build): Build {
  const site = build.parts.websites
  if (!site || (build.details?.langs?.length ?? 0) < 2 || site.addons.includes('language'))
    return build
  return {
    ...build,
    parts: { ...build.parts, websites: { ...site, addons: [...site.addons, 'language'] } },
  }
}

// A link that is exactly a starting set (a kind's preset or one product's parts, as the solution
// and product cards build them) and nothing else: the visitor has not configured anything yet.
export function isStartingSet(build: Build): boolean {
  const code = encodeBuild(build)
  return (
    businessKinds.some((id) => encodeBuild(presets[id]) === code) ||
    productIds.some((id) => encodeBuild(toggleProduct(emptyBuild, id)) === code)
  )
}

export type QuoteLine = { id: ServiceSlug | BuildExtra; price: number }
export type Quote = {
  lines: QuoteLine[]
  subtotal: number
  discount: number | null
  total: number
  monthly: number | null
}

const round10 = (value: number) => Math.round(value / 10) * 10

export function quote(build: Build, pricing: Pricing = defaultPricing): Quote {
  const lines: QuoteLine[] = []
  for (const slug of serviceSlugs) {
    const part = build.parts[slug]
    if (part) lines.push({ id: slug, price: estimate(slug, part.variant, part.addons, pricing) })
  }
  const extraPrice = extraPrices(pricing)
  let monthly: number | null = null
  for (const id of buildExtras) {
    if (!build.extras.includes(id)) continue
    const { from, monthly: perMonth } = extraPrice[id]
    if (from === null) continue
    if (perMonth) monthly = (monthly ?? 0) + from
    else lines.push({ id, price: from })
  }
  const subtotal = lines.reduce((sum, l) => sum + l.price, 0)
  const discount = lines.length >= 2 ? round10(subtotal * bundleFraction(pricing)) : null
  const total = discount ? subtotal - discount : subtotal
  return { lines, subtotal, discount, total, monthly }
}

// A build fits in one query parameter, so it can be saved or sent to a partner:
// `websites.landing.telegram-payments~bots.booking~x.support-seo`, then the brief:
// `k.barber` the business kind, `p.adminbot-site` the products, `g.leads-sales` goals,
// `c.instagram` channels, `s.minimal.coral.light.soft` the old style (`_` = not picked),
// `y.noir.serif.sharp.airy.premium.luxe` the style axes (palette, type, shape, density, mood, ready
// look), `t.clinic.calm` the theme and its mood (2026-11-22), `d._.ru-en.logo-texts.month` details
// (the first field, once the page count, is always `_` now), `l.telegram-playground` where the agent
// lives, `z.no` whether it gets a site, and the free texts as base64url: `u.<url>` (one chunk per
// example), `u.<json>` (the new details as a capped JSON object, told apart by its opening brace)
// and `w.<wish>`. Old links decode as before; anything unknown is dropped.
export function encodeBuild(build: Build) {
  const parts = serviceSlugs.flatMap((slug) => {
    const part = build.parts[slug]
    if (!part) return []
    return [[slug, part.variant, ...(part.addons.length ? [part.addons.join('-')] : [])].join('.')]
  })
  if (build.extras.length) parts.push(`x.${build.extras.join('-')}`)
  const catalog = catalogJson(build.catalog)
  if (catalog) parts.push(`x.${toBase64Url(catalog)}`)
  if (build.kind) parts.push(`k.${build.kind}`)
  if (build.products?.length) parts.push(`p.${build.products.join('-')}`)
  const personal = build.personal ? personalJson(build.personal) : ''
  if (personal) parts.push(`m.${toBase64Url(personal)}`)
  const discovery = discoveryJson(build.discovery)
  if (discovery) parts.push(`v.${toBase64Url(discovery)}`)
  if (build.goals?.length) parts.push(`g.${build.goals.join('-')}`)
  if (build.channels?.length) parts.push(`c.${build.channels.join('-')}`)
  // An empty list is a choice too (nothing ticked yet), told apart from "never asked" by `l.none`.
  if (build.delivery) parts.push(`l.${build.delivery.length ? build.delivery.join('-') : 'none'}`)
  if (build.siteNeed) parts.push(`z.${build.siteNeed}`)
  for (const id of flagshipProducts) {
    const picked = build.options?.[id]
    if (picked?.length) parts.push(`f.${id}.${picked.join('-')}`)
  }
  const style = build.style
  if (style && (style.look || style.accent || style.theme || style.font)) {
    const s = [style.look, style.accent, style.theme, style.font].map((v) => v ?? '_')
    parts.push(`s.${s.join('.')}`)
  }
  if (
    style &&
    (style.palette || style.type || style.shape || style.density || style.mood || style.kit)
  ) {
    const y = [style.palette, style.type, style.shape, style.density, style.mood, style.kit].map(
      (v) => v ?? '_',
    )
    parts.push(`y.${y.join('.')}`)
  }
  if (style?.themeId) parts.push(`t.${style.themeId}.${style.themeMood ?? 'calm'}`)
  const d = build.details
  if (d && (d.langs?.length || d.has?.length || d.deadline)) {
    const fields = ['_', list(d.langs), list(d.has), d.deadline ?? '_']
    parts.push(`d.${fields.join('.')}`)
  }
  for (const url of d?.examples ?? []) if (url) parts.push(`u.${toBase64Url(url)}`)
  const json = detailsJson(d)
  if (json) parts.push(`u.${toBase64Url(json)}`)
  if (d?.wish) parts.push(`w.${toBase64Url(d.wish)}`)
  return parts.join('~')
}

const list = (ids: readonly string[] | undefined) => (ids?.length ? ids.join('-') : '_')

// The new details as a compact JSON object (short keys), capped so the link stays short: when it is
// too long the free texts are shortened first, then the chip lists are dropped from the end.
function detailsJson(d: BuildDetails | undefined): string {
  if (!d) return ''
  const obj: Record<string, unknown> = {}
  if (d.company) obj.co = d.company
  if (d.clients) obj.cl = d.clients
  if (d.clientTypes?.length) obj.ct = d.clientTypes
  if (d.sources?.length) obj.so = d.sources
  if (d.after?.length) obj.af = d.after
  if (d.tools?.length) obj.to = d.tools
  if (d.owner) obj.ow = d.owner
  if (d.fears?.length) obj.fe = d.fears
  if (d.budget) obj.bu = d.budget
  if (!Object.keys(obj).length) return ''
  let text = JSON.stringify(obj)
  if (text.length > textLimits.detailsJson) {
    for (const key of ['cl', 'ow', 'co'] as const)
      if (typeof obj[key] === 'string') obj[key] = (obj[key] as string).slice(0, 40)
    text = JSON.stringify(obj)
  }
  for (const key of ['fe', 'to', 'af', 'so', 'ct'] as const) {
    if (text.length <= textLimits.detailsJson) break
    delete obj[key]
    text = JSON.stringify(obj)
  }
  return text.slice(0, textLimits.detailsJson)
}

function parseDetailsJson(text: string): Partial<BuildDetails> | undefined {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const str = (key: string, max: number) => {
    const v = o[key]
    return typeof v === 'string' ? cleanLine(v, max) : undefined
  }
  const ids = <T extends string>(key: string, known: readonly T[]): T[] => {
    const v = o[key]
    return Array.isArray(v) ? keepKnown(v.filter((x) => typeof x === 'string').join('-'), known) : []
  }
  const out: Partial<BuildDetails> = {}
  const company = str('co', textLimits.company)
  if (company) out.company = company
  const clients = str('cl', textLimits.clients)
  if (clients) out.clients = clients
  const owner = str('ow', textLimits.owner)
  if (owner) out.owner = owner
  const ct = ids('ct', clientTypes)
  if (ct.length) out.clientTypes = ct
  const so = ids('so', clientSources)
  if (so.length) out.sources = so
  const af = ids('af', afterSteps)
  if (af.length) out.after = af
  const to = ids('to', clientTools)
  if (to.length) out.tools = to
  const fe = ids('fe', fears)
  if (fe.length) out.fears = fe
  const bu = typeof o.bu === 'string' ? oneOf(o.bu, budgets) : undefined
  if (bu) out.budget = bu
  return Object.keys(out).length ? out : undefined
}

// One line of free text: control characters out, spaces collapsed, at most `max` characters.
export function cleanLine(text: string, max: number) {
  return (
    text
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max) || undefined
  )
}

export function decodeBuild(value: string | null | undefined): Build | null {
  if (!value) return null
  const build: Build = { parts: {}, extras: [] }
  const style: BuildStyle = {}
  const details: BuildDetails = {}
  for (const chunk of value.slice(0, 6000).split('~')) {
    const [head = '', second = '', third = '', fourth = '', fifth = '', sixth = ''] =
      chunk.split('.')
    if (head === 'k') {
      const kind = oneOf(second, businessKinds)
      if (kind) build.kind = kind
      continue
    }
    if (head === 'p') {
      const products = keepKnown(
        second
          .split('-')
          .map((id) => legacyBuilderProducts[id] ?? id)
          .join('-'),
        productIds,
      )
      if (products.length) build.products = products
      continue
    }
    if (head === 'm') {
      const personal = parsePersonalJson(fromBase64Url(chunk.slice(2)) ?? '')
      if (personal) build.personal = personal
      continue
    }
    if (head === 'v') {
      const discovery = parseDiscoveryJson(fromBase64Url(chunk.slice(2)) ?? '')
      if (discovery) build.discovery = discovery
      continue
    }
    if (head === 'f') {
      const product = oneOf(second, flagshipProducts)
      if (product) {
        const picked = keepKnown(third, flagshipOptionIds[product] as readonly string[])
        if (picked.length) build.options = { ...build.options, [product]: picked }
      }
      continue
    }
    if (head === 'l') {
      const delivery = keepKnown(second, deliveryChannels)
      if (delivery.length || second === 'none') build.delivery = delivery
      continue
    }
    if (head === 'z') {
      const need = oneOf(second, siteNeeds)
      if (need) build.siteNeed = need
      continue
    }
    if (head === 't') {
      const id = oneOf(second, themeIds)
      if (id) {
        style.themeId = id
        style.themeMood = oneOf(third, themeMoods) ?? 'calm'
      }
      continue
    }
    if (head === 'y') {
      const palette = oneOf(second, stylePalettes)
      const type = oneOf(third, styleTypes)
      const shape = oneOf(fourth, styleShapes)
      const density = oneOf(fifth, styleDensities)
      const [mood, kit] = [oneOf(sixth, styleMoods), oneOf(chunk.split('.')[6] ?? '', styleKits)]
      if (palette) style.palette = palette
      if (type) style.type = type
      if (shape) style.shape = shape
      if (density) style.density = density
      if (mood) style.mood = mood
      if (kit) style.kit = kit
      continue
    }
    if (head === 'x') {
      // A catalogue chunk (base64 of `{`, starts with `ey`) shares the letter with the extras list.
      if (isCatalogChunk(second)) {
        const catalog = parseCatalogJson(fromBase64Url(second) ?? '')
        if (catalog) build.catalog = catalog
      } else build.extras = keepKnown(second, buildExtras)
      continue
    }
    if (head === 'g') {
      const goals = keepKnown(second, buildGoals)
      if (goals.length) build.goals = goals
      continue
    }
    if (head === 'c') {
      const channels = keepKnown(second, buildChannels)
      if (channels.length) build.channels = channels
      continue
    }
    if (head === 's') {
      const look = oneOf(second, styleLooks)
      const accent = oneOf(third, styleAccents)
      const theme = oneOf(fourth, styleThemes)
      const font = oneOf(fifth, styleFonts)
      if (look) style.look = look
      if (accent) style.accent = accent
      if (theme) style.theme = theme
      if (font) style.font = font
      continue
    }
    if (head === 'd') {
      // The page count (second field) is no longer asked or kept: old links still parse.
      const langs = keepKnown(third, detailLangs)
      if (langs.length) details.langs = langs
      const has = keepKnown(fourth, detailAssets)
      if (has.length) details.has = has
      const deadline = oneOf(fifth, detailDeadlines)
      if (deadline) details.deadline = deadline
      continue
    }
    if (head === 'u' || head === 'w') {
      const text = fromBase64Url(chunk.slice(2))
      if (head === 'u' && text?.startsWith('{')) {
        Object.assign(details, parseDetailsJson(text) ?? {})
      } else if (head === 'u') {
        const url = cleanExample(text ?? '')
        const examples = details.examples ?? []
        if (url && examples.length < textLimits.examples && !examples.includes(url))
          details.examples = [...examples, url]
      } else {
        const wish = cleanWish(text ?? '')
        if (wish) details.wish = wish
      }
      continue
    }
    const slug = serviceSlugs.find((s) => s === head)
    if (!slug || !Object.hasOwn(defaultPricing.catalog[slug].variants, second)) continue
    build.parts[slug] = {
      variant: second,
      addons: keepKnown(third, Object.keys(defaultPricing.catalog[slug].addons)),
    }
  }
  // A personal link never carries the business chunks that happened to ride along.
  if (build.personal) return personalOnly(build)
  if (Object.keys(style).length) build.style = style
  if (Object.keys(details).length) build.details = details
  const hasBrief = Boolean(
    build.kind ||
      build.products ||
      build.goals ||
      build.channels ||
      build.style ||
      build.details ||
      build.delivery ||
      build.personal ||
      build.discovery ||
      build.catalog ||
      build.siteNeed,
  )
  return Object.keys(build.parts).length || build.extras.length || hasBrief ? build : null
}

// Keeps the link's own order (so a build survives a round trip) and drops unknown or repeated ids.
function keepKnown<T extends string>(list: string, known: readonly T[]): T[] {
  const ids = list.split('-').filter((id): id is T => (known as readonly string[]).includes(id))
  return [...new Set(ids)]
}

function oneOf<T extends string>(value: string, known: readonly T[]): T | undefined {
  return (known as readonly string[]).includes(value) ? (value as T) : undefined
}

export function clampPages(value: number) {
  if (!Number.isFinite(value) || value < pagesRange.min) return undefined
  return Math.min(pagesRange.max, Math.round(value))
}

// Free text from the visitor: one line for an example link, a short note for the wish. Control
// characters are dropped; the limits keep the link and the lead short.
export function cleanWish(text: string) {
  return (
    text
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
      .trim()
      .slice(0, textLimits.wish) || undefined
  )
}

export function cleanExample(text: string) {
  const value = text.replace(/[\u0000-\u001f\u007f\s]/g, '').slice(0, textLimits.example)
  // A domain or a link, nothing else: "cafe.tj", "https://cafe.tj/menu".
  return /^(https?:\/\/)?[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+([/?#]\S*)?$/u.test(value)
    ? value
    : undefined
}

function toBase64Url(text: string) {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
}

// Languages on the details screen. With a website in the build, two or more languages turn on its
// existing paid "second language" option (one option, its price from pricing.ts); one language
// turns it off, none leaves it as it is. Without a website the languages are only a note.
// `paid: false` (the owner's price rule hides the option, see builder-v2.ts) only records the languages.
export function withLangs(build: Build, langs: DetailLang[], paid = true): Build {
  const next = withDetails(build, { langs })
  const site = build.parts.websites
  if (paid && site && langs.length) {
    const has = site.addons.includes('language')
    const want = langs.length >= 2
    if (has !== want) {
      const addons = want
        ? [...site.addons, 'language']
        : site.addons.filter((a) => a !== 'language')
      next.parts = { ...build.parts, websites: { ...site, addons } }
    }
  }
  return next
}

// Merges a change into the details and drops empty fields, so an untouched brief stays absent
// (and a build without one encodes exactly as before).
export function withDetails(build: Build, patch: Partial<BuildDetails>): Build {
  const details: BuildDetails = { ...build.details, ...patch }
  for (const key of Object.keys(details) as (keyof BuildDetails)[]) {
    const value = details[key]
    if (value === undefined || value === '' || (Array.isArray(value) && !value.length))
      delete details[key]
  }
  const next: Build = { ...build, details }
  if (!Object.keys(details).length) delete next.details
  return next
}

export function withStyle(build: Build, patch: Partial<BuildStyle>): Build {
  return { ...build, style: { ...build.style, ...patch } }
}

// The lead's service for a build: the service itself when the build is one main service with no
// monthly part, otherwise "bundle".
export function leadServiceOf(build: Build): ServiceSlug | 'personal' | 'bundle' {
  if (build.personal) return 'personal'
  const q = quote(build)
  const single = q.lines.length === 1 && !q.monthly ? q.lines[0]?.id : undefined
  return single && (serviceSlugs as readonly string[]).includes(single)
    ? (single as ServiceSlug)
    : 'bundle'
}
