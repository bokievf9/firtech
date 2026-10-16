import type { Dict } from '@/content'
import { encodeBuild, quote, type Build } from './builder'
import { formatUsd } from './pricing'
import { serviceSlugs, siteUrl, type ServiceSlug } from './site'

// The printable estimate (`/[locale]/builder/estimate?b=...`): the same quote as the builder's
// summary, turned into labelled rows. Pure, so the numbers can be tested without a browser.

export type EstimateRow = { id: string; name: string; detail: string; term: string; price: string }

export type EstimateDoc = {
  parts: EstimateRow[]
  extras: EstimateRow[]
  subtotal: string
  discount: string | null
  total: string
  monthly: string | null
  link: string
}

type Variants = Record<string, { name: string; term: string }>

export const formatRange = (r: { min: number; max: number }) =>
  `${formatUsd(r.min)} - ${formatUsd(r.max)}`

const isService = (id: string): id is ServiceSlug =>
  (serviceSlugs as readonly string[]).includes(id)

export function estimateDoc(build: Build, dict: Dict, locale: string): EstimateDoc {
  const q = quote(build)
  const parts: EstimateRow[] = []
  const extras: EstimateRow[] = []
  for (const line of q.lines) {
    if (isService(line.id)) {
      const part = build.parts[line.id]
      const c = dict.estimator.catalog[line.id]
      const variant = part ? (c.variants as Variants)[part.variant] : undefined
      const addons = (part?.addons ?? []).map((id) => (c.addons as Record<string, string>)[id])
      parts.push({
        id: line.id,
        name: dict.services.items[line.id].name,
        detail: [variant?.name, ...addons].filter(Boolean).join(' + '),
        term: variant?.term ?? '',
        price: formatRange(line),
      })
    } else {
      extras.push({
        id: line.id,
        name: dict.extras.items[line.id].name,
        detail: '',
        term: '',
        price: formatRange(line),
      })
    }
  }
  return {
    parts,
    extras,
    subtotal: formatRange(q.subtotal),
    discount: q.discount ? `-${formatRange(q.discount)}` : null,
    total: formatRange(q.total),
    monthly: q.monthly === null ? null : `${formatUsd(q.monthly)}${dict.builder.perMonth}`,
    link: `${siteUrl}/${locale}/builder?b=${encodeBuild(build)}`,
  }
}

export function formatDocDate(date: Date, locale: string) {
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
