import {
  kindCatalog,
  kindIds,
  productCatalog,
  productIds,
  type KindId,
  type ProductId,
} from '../content/builder-catalog'
import { bundleDiscount, catalog, estimate, extraPrice } from './pricing'
import { serviceSlugs, type ServiceSlug } from './site'

// The project builder: a visitor combines several services and extras into one quote. All prices
// come from pricing.ts, so the builder, the calculator and the showcase always agree.

// Extras that make sense as a part of a build. The others are already a format or option of a main
// service (AI assistant, CRM, payments, internal systems) or are not something you "build" (rescue).
export const buildExtras = ['support', 'seo', 'design'] as const
export type BuildExtra = (typeof buildExtras)[number]

export type BuildPart = { variant: string; addons: string[] }

// The brief around the parts: goals, look and details. None of it changes the price; it travels
// with the build (link, lead, PDF) so the first call starts from what the visitor already said.
export const buildGoals = ['leads', 'sales', 'booking', 'routine', 'brand'] as const
export type BuildGoal = (typeof buildGoals)[number]
export const buildChannels = ['instagram', 'telegram', 'search', 'word'] as const
export type BuildChannel = (typeof buildChannels)[number]

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
}
// What the mockup shows until the visitor picks: the studio's own look.
export const defaultStyle: Required<Pick<BuildStyle, 'look' | 'accent' | 'theme' | 'font'>> = {
  look: 'tech',
  accent: 'lime',
  theme: 'dark',
  font: 'strict',
}

export const detailLangs = ['ru', 'en', 'tj', 'uz'] as const
export type DetailLang = (typeof detailLangs)[number]
export const detailAssets = ['logo', 'texts', 'photos', 'domain', 'hosting'] as const
export type DetailAsset = (typeof detailAssets)[number]
export const detailDeadlines = ['asap', 'month', 'relaxed'] as const
export type DetailDeadline = (typeof detailDeadlines)[number]
export const pagesRange = { min: 1, max: 20 } as const
export const textLimits = { wish: 300, example: 100, examples: 2 } as const
export type BuildDetails = {
  pages?: number
  langs?: DetailLang[]
  has?: DetailAsset[]
  examples?: string[]
  deadline?: DetailDeadline
  wish?: string
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
  return out
}

// A kind's starting set replaces kind, products, parts and extras; the brief the visitor already
// gave (goals, channels, style, details) stays. Goals come from the kind only while none are set.
export function applyKind(build: Build, id: BusinessKind): Build {
  const preset = structuredClone(presets[id])
  const next: Build = { ...build, ...preset }
  if (!preset.products) delete next.products
  if (!build.goals?.length && kindCatalog[id].goals.length) next.goals = [...kindCatalog[id].goals]
  return next
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

export function quote(build: Build): Quote {
  const lines: QuoteLine[] = []
  for (const slug of serviceSlugs) {
    const part = build.parts[slug]
    if (part) lines.push({ id: slug, price: estimate(slug, part.variant, part.addons) })
  }
  let monthly: number | null = null
  for (const id of buildExtras) {
    if (!build.extras.includes(id)) continue
    const { from, monthly: perMonth } = extraPrice[id]
    if (from === null) continue
    if (perMonth) monthly = (monthly ?? 0) + from
    else lines.push({ id, price: from })
  }
  const subtotal = lines.reduce((sum, l) => sum + l.price, 0)
  const discount = lines.length >= 2 ? round10(subtotal * bundleDiscount) : null
  const total = discount ? subtotal - discount : subtotal
  return { lines, subtotal, discount, total, monthly }
}

// A build fits in one query parameter, so it can be saved or sent to a partner:
// `websites.landing.telegram-payments~bots.booking~x.support-seo`, then the brief:
// `k.barber` the business kind, `p.adminbot-site` the products, `g.leads-sales` goals,
// `c.instagram` channels, `s.minimal.coral.light.soft` the old style (`_` = not picked),
// `y.noir.serif.sharp.airy.premium.luxe` the new style axes (palette, type, shape, density, mood,
// ready look), `d.5.ru-en.logo-texts.month` details, and the free texts as base64url: `u.<url>` (one
// chunk per example) and `w.<wish>`. Old links (parts and extras only) decode as before; anything
// unknown is dropped.
export function encodeBuild(build: Build) {
  const parts = serviceSlugs.flatMap((slug) => {
    const part = build.parts[slug]
    if (!part) return []
    return [[slug, part.variant, ...(part.addons.length ? [part.addons.join('-')] : [])].join('.')]
  })
  if (build.extras.length) parts.push(`x.${build.extras.join('-')}`)
  if (build.kind) parts.push(`k.${build.kind}`)
  if (build.products?.length) parts.push(`p.${build.products.join('-')}`)
  if (build.goals?.length) parts.push(`g.${build.goals.join('-')}`)
  if (build.channels?.length) parts.push(`c.${build.channels.join('-')}`)
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
  const d = build.details
  if (d && (d.pages || d.langs?.length || d.has?.length || d.deadline)) {
    const fields = [d.pages ? String(d.pages) : '_', list(d.langs), list(d.has), d.deadline ?? '_']
    parts.push(`d.${fields.join('.')}`)
  }
  for (const url of d?.examples ?? []) if (url) parts.push(`u.${toBase64Url(url)}`)
  if (d?.wish) parts.push(`w.${toBase64Url(d.wish)}`)
  return parts.join('~')
}

const list = (ids: readonly string[] | undefined) => (ids?.length ? ids.join('-') : '_')

export function decodeBuild(value: string | null | undefined): Build | null {
  if (!value) return null
  const build: Build = { parts: {}, extras: [] }
  const style: BuildStyle = {}
  const details: BuildDetails = {}
  for (const chunk of value.slice(0, 2000).split('~')) {
    const [head = '', second = '', third = '', fourth = '', fifth = '', sixth = ''] =
      chunk.split('.')
    if (head === 'k') {
      const kind = oneOf(second, businessKinds)
      if (kind) build.kind = kind
      continue
    }
    if (head === 'p') {
      const products = keepKnown(second, productIds)
      if (products.length) build.products = products
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
      build.extras = keepKnown(second, buildExtras)
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
      const pages = clampPages(Number(second))
      if (pages) details.pages = pages
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
      if (head === 'u') {
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
    if (!slug || !Object.hasOwn(catalog[slug].variants, second)) continue
    build.parts[slug] = {
      variant: second,
      addons: keepKnown(third, Object.keys(catalog[slug].addons)),
    }
  }
  if (Object.keys(style).length) build.style = style
  if (Object.keys(details).length) build.details = details
  const hasBrief = Boolean(
    build.kind || build.products || build.goals || build.channels || build.style || build.details,
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
export function withLangs(build: Build, langs: DetailLang[]): Build {
  const next = withDetails(build, { langs })
  const site = build.parts.websites
  if (site && langs.length) {
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
export function leadServiceOf(build: Build): ServiceSlug | 'bundle' {
  const q = quote(build)
  const single = q.lines.length === 1 && !q.monthly ? q.lines[0]?.id : undefined
  return single && (serviceSlugs as readonly string[]).includes(single)
    ? (single as ServiceSlug)
    : 'bundle'
}
