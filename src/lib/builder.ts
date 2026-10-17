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
export type BuildStyle = {
  look?: StyleLook
  accent?: StyleAccent
  theme?: StyleTheme
  font?: StyleFont
}
// What the mockup shows until the visitor picks: the studio's own look.
export const defaultStyle: Required<BuildStyle> = {
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
  parts: Partial<Record<ServiceSlug, BuildPart>>
  extras: BuildExtra[]
  goals?: BuildGoal[]
  channels?: BuildChannel[]
  style?: BuildStyle
  details?: BuildDetails
}

export const emptyBuild: Build = { parts: {}, extras: [] }

export const businessKinds = ['cafe', 'salon', 'shop', 'delivery', 'services', 'other'] as const
export type BusinessKind = (typeof businessKinds)[number]

// Starting sets per kind of business, so nobody starts from a blank page. Pure suggestions: the
// visitor edits them in the next steps.
export const presets: Record<BusinessKind, Build> = {
  cafe: {
    parts: {
      websites: { variant: 'landing', addons: ['telegram'] },
      bots: { variant: 'booking', addons: ['payments'] },
    },
    extras: ['seo'],
  },
  salon: {
    parts: {
      bots: { variant: 'booking', addons: ['broadcasts'] },
      websites: { variant: 'landing', addons: ['telegram'] },
    },
    extras: ['seo'],
  },
  shop: {
    parts: { websites: { variant: 'shop', addons: ['payments', 'cms'] } },
    extras: ['seo', 'support'],
  },
  delivery: {
    parts: {
      bots: { variant: 'miniapp', addons: ['payments', 'admin'] },
      automation: { variant: 'integration', addons: ['alerts'] },
    },
    extras: ['support'],
  },
  services: {
    parts: {
      websites: { variant: 'company', addons: ['telegram'] },
      automation: { variant: 'crm', addons: ['training'] },
    },
    extras: [],
  },
  other: { parts: { websites: { variant: 'landing', addons: [] } }, extras: [] },
}

export type QuoteLine = { id: ServiceSlug | BuildExtra; min: number; max: number }
export type Quote = {
  lines: QuoteLine[]
  subtotal: { min: number; max: number }
  discount: { min: number; max: number } | null
  total: { min: number; max: number }
  monthly: number | null
}

const round10 = (value: number) => Math.round(value / 10) * 10

export function quote(build: Build): Quote {
  const lines: QuoteLine[] = []
  for (const slug of serviceSlugs) {
    const part = build.parts[slug]
    if (part) lines.push({ id: slug, ...estimate(slug, part.variant, part.addons) })
  }
  let monthly: number | null = null
  for (const id of buildExtras) {
    if (!build.extras.includes(id)) continue
    const { from, monthly: perMonth } = extraPrice[id]
    if (from === null) continue
    if (perMonth) monthly = (monthly ?? 0) + from
    else lines.push({ id, min: from, max: round10(from * 1.4) })
  }
  const subtotal = {
    min: lines.reduce((sum, l) => sum + l.min, 0),
    max: lines.reduce((sum, l) => sum + l.max, 0),
  }
  const discount =
    lines.length >= 2
      ? { min: round10(subtotal.min * bundleDiscount), max: round10(subtotal.max * bundleDiscount) }
      : null
  const total = discount
    ? { min: subtotal.min - discount.min, max: subtotal.max - discount.max }
    : subtotal
  return { lines, subtotal, discount, total, monthly }
}

// A build fits in one query parameter, so it can be saved or sent to a partner:
// `websites.landing.telegram-payments~bots.booking~x.support-seo`, then the brief:
// `g.leads-sales` goals, `c.instagram` channels, `s.minimal.coral.light.soft` style (`_` = not
// picked), `d.5.ru-en.logo-texts.month` details, and the free texts as base64url: `u.<url>` (one
// chunk per example) and `w.<wish>`. Old links (parts and extras only) decode as before; anything
// unknown is dropped.
export function encodeBuild(build: Build) {
  const parts = serviceSlugs.flatMap((slug) => {
    const part = build.parts[slug]
    if (!part) return []
    return [[slug, part.variant, ...(part.addons.length ? [part.addons.join('-')] : [])].join('.')]
  })
  if (build.extras.length) parts.push(`x.${build.extras.join('-')}`)
  if (build.goals?.length) parts.push(`g.${build.goals.join('-')}`)
  if (build.channels?.length) parts.push(`c.${build.channels.join('-')}`)
  const style = build.style
  if (style && (style.look || style.accent || style.theme || style.font)) {
    const s = [style.look, style.accent, style.theme, style.font].map((v) => v ?? '_')
    parts.push(`s.${s.join('.')}`)
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
    const [head = '', second = '', third = '', fourth = '', fifth = ''] = chunk.split('.')
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
    if (!slug || !(second in catalog[slug].variants)) continue
    build.parts[slug] = {
      variant: second,
      addons: keepKnown(third, Object.keys(catalog[slug].addons)),
    }
  }
  if (Object.keys(style).length) build.style = style
  if (Object.keys(details).length) build.details = details
  const hasBrief = Boolean(build.goals || build.channels || build.style || build.details)
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
