import { bundleDiscount, catalog, estimate, extraPrice } from './pricing'
import { serviceSlugs, type ServiceSlug } from './site'

// The project builder: a visitor combines several services and extras into one quote. All prices
// come from pricing.ts, so the builder, the calculator and the showcase always agree.

// Extras that make sense as a part of a build. The others are already a format or option of a main
// service (AI assistant, CRM, payments, internal systems) or are not something you "build" (rescue).
export const buildExtras = ['support', 'seo', 'design'] as const
export type BuildExtra = (typeof buildExtras)[number]

export type BuildPart = { variant: string; addons: string[] }
export type Build = { parts: Partial<Record<ServiceSlug, BuildPart>>; extras: BuildExtra[] }

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
// `websites.landing.telegram-payments~bots.booking~x.support-seo`. Anything unknown is dropped.
export function encodeBuild(build: Build) {
  const parts = serviceSlugs.flatMap((slug) => {
    const part = build.parts[slug]
    if (!part) return []
    return [[slug, part.variant, ...(part.addons.length ? [part.addons.join('-')] : [])].join('.')]
  })
  if (build.extras.length) parts.push(`x.${build.extras.join('-')}`)
  return parts.join('~')
}

export function decodeBuild(value: string | null | undefined): Build | null {
  if (!value) return null
  const build: Build = { parts: {}, extras: [] }
  for (const chunk of value.slice(0, 400).split('~')) {
    const [head, second = '', third = ''] = chunk.split('.')
    if (head === 'x') {
      build.extras = keepKnown(second, buildExtras)
      continue
    }
    const slug = serviceSlugs.find((s) => s === head)
    if (!slug || !(second in catalog[slug].variants)) continue
    build.parts[slug] = {
      variant: second,
      addons: keepKnown(third, Object.keys(catalog[slug].addons)),
    }
  }
  return Object.keys(build.parts).length || build.extras.length ? build : null
}

// Keeps the link's own order (so a build survives a round trip) and drops unknown or repeated ids.
function keepKnown<T extends string>(list: string, known: readonly T[]): T[] {
  const ids = list.split('-').filter((id): id is T => (known as readonly string[]).includes(id))
  return [...new Set(ids)]
}
