import type { Dict } from '@/content'
import { defaultStyle, encodeBuild, quote, type Build } from './builder'
import { bundleDiscount, formatUsd } from './pricing'
import { serviceSlugs, siteUrl, type ServiceSlug } from './site'

// The printable estimate (`/[locale]/builder/estimate?b=...`): the same quote as the builder's
// summary, turned into labelled rows. Pure, so the numbers can be tested without a browser.

export type EstimateRow = { id: string; name: string; detail: string; term: string; price: string }

export type BriefRow = { id: string; label: string; value: string }
export type Brief = { goals: BriefRow[]; style: BriefRow[]; details: BriefRow[] }

export type EstimateDoc = {
  parts: EstimateRow[]
  extras: EstimateRow[]
  subtotal: string
  discount: string | null
  total: string
  monthly: string | null
  link: string
  brief: Brief
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
    discount: q.discount ? `-${Math.round(bundleDiscount * 100)}%` : null,
    total: formatRange(q.total),
    monthly: q.monthly === null ? null : `${formatUsd(q.monthly)}${dict.builder.perMonth}`,
    link: `${siteUrl}/${locale}/builder?b=${encodeBuild(build)}`,
    brief: briefOf(build, dict),
  }
}

// The brief (goals, style, details) as labelled rows, for the summary screen, the PDF and the lead.
// Only what the visitor picked; the style shows defaults for fields left open once any is picked.
export function briefOf(build: Build, dict: Dict): Brief {
  const t = dict.builder
  const goals: BriefRow[] = []
  if (build.goals?.length)
    goals.push({
      id: 'goals',
      label: t.goalsLabel,
      value: build.goals.map((id) => t.goals[id].name).join(', '),
    })
  if (build.channels?.length)
    goals.push({
      id: 'channels',
      label: t.channelsLabel,
      value: build.channels.map((id) => t.channels[id]).join(', '),
    })

  const style: BriefRow[] = []
  if (build.style && Object.keys(build.style).length) {
    const s = { ...defaultStyle, ...build.style }
    style.push(
      { id: 'look', label: t.looksTitle, value: t.looks[s.look].name },
      { id: 'accent', label: t.accentTitle, value: t.accents[s.accent] },
      { id: 'theme', label: t.themeTitle, value: t.themes[s.theme] },
      { id: 'font', label: t.fontTitle, value: t.fonts[s.font].name },
    )
  }

  const details: BriefRow[] = []
  const d = build.details ?? {}
  if (d.pages) details.push({ id: 'pages', label: t.pagesLabel, value: String(d.pages) })
  if (d.langs?.length)
    details.push({
      id: 'langs',
      label: t.langsLabel,
      value: d.langs.map((id) => id.toUpperCase()).join(', '),
    })
  if (d.has?.length)
    details.push({ id: 'has', label: t.hasLabel, value: d.has.map((id) => t.has[id]).join(', ') })
  if (d.deadline)
    details.push({ id: 'deadline', label: t.deadlineLabel, value: t.deadlines[d.deadline] })
  if (d.examples?.length)
    details.push({ id: 'examples', label: t.examplesLabel, value: d.examples.join(', ') })
  if (d.wish) details.push({ id: 'wish', label: t.wishLabel, value: d.wish })
  return { goals, style, details }
}

// The contact form's estimate field holds at most this many characters (lead schema).
export const leadLimit = 1500

// What the contact form receives from the builder: the quote line by line, then the brief in a few
// compact lines. The wish goes last and is the part shortened if the whole would not fit.
export function leadSummary(build: Build, dict: Dict, locale: string) {
  const t = dict.builder
  const doc = estimateDoc(build, dict, locale)
  const q = quote(build)
  const lines = [
    ...doc.parts.map((row) => `${row.name}: ${row.detail} (${row.price}, ${row.term})`),
    ...doc.extras.map((row) => `${row.name} (${row.price})`),
  ]
  if (q.discount) lines.push(`${t.discount}: ${doc.subtotal} -> ${doc.total}`)
  lines.push(`${t.total}: ${doc.total}`)
  if (doc.monthly) lines.push(`${dict.extras.items.support.name}: ${doc.monthly}`)
  const { goals, style, details } = doc.brief
  for (const row of goals) lines.push(`${row.label}: ${row.value}`)
  if (style.length) lines.push(`${t.styleLabel}: ${style.map((row) => row.value).join(', ')}`)
  const short = details.filter((row) => row.id !== 'wish' && row.id !== 'examples')
  if (short.length) lines.push(short.map((row) => `${row.label}: ${row.value}`).join('; '))
  const examples = details.find((row) => row.id === 'examples')
  if (examples) lines.push(`${examples.label}: ${examples.value}`)
  let text = lines.join('\n')
  const wish = details.find((row) => row.id === 'wish')
  if (wish) {
    const head = `\n${wish.label}: `
    const room = leadLimit - text.length - head.length
    if (room > 20)
      text += head + (wish.value.length > room ? `${wish.value.slice(0, room - 3)}...` : wish.value)
  }
  return text.slice(0, leadLimit)
}

export function formatDocDate(date: Date, locale: string) {
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
