import type { Dict } from '@/content'
import {
  builderUi,
  densityNames,
  kindName,
  moodNames,
  paletteNames,
  pick,
  productCatalog,
  shapeNames,
  typeNames,
  kitNames,
} from '../content/builder-catalog'
import { defaultStyle, encodeBuild, productsOnRequest, quote, type Build } from './builder'
import { usesAxes } from './builder-style'
import { stagesFor } from './payment-stages'
import { bundleDiscount, formatUsd } from './pricing'
import { serviceSlugs, siteUrl, type ServiceSlug } from './site'

// The printable estimate (`/[locale]/builder/estimate?b=...`): the same quote as the builder's
// summary, turned into labelled rows. Pure, so the numbers can be tested without a browser.

export type EstimateRow = { id: string; name: string; detail: string; term: string; price: string }

export type StageRow = { id: string; n: number; name: string; share: string; amount: string }

export type BriefRow = { id: string; label: string; value: string }
export type Brief = { goals: BriefRow[]; style: BriefRow[]; details: BriefRow[] }

export type EstimateDoc = {
  // The business kind's name, when the build has one.
  kind: string | null
  // Every picked product by name; those without a price are also in `onRequest`.
  products: string[]
  // Products without a price in pricing.ts: "on quote", never part of a sum.
  onRequest: EstimateRow[]
  parts: EstimateRow[]
  extras: EstimateRow[]
  subtotal: string
  discount: string | null
  total: string
  monthly: string | null
  // Payment stages with amounts (owner decision 2026-11-21); empty when nothing is priced.
  stages: StageRow[]
  // The money-back guarantee sentence for the footer notes (dictionary `guarantee.line`).
  guarantee: string
  // What is not in the price (domain, hosting, paid third-party services), per the brief.
  scope: string
  link: string
  brief: Brief
}

type Variants = Record<string, { name: string; term: string }>

// What the price does not cover: domain, hosting, paid third-party services. Depends on what the
// client already has (`has` in the brief); the strings live in the dictionaries (`builder.scope`).
export function scopeLine(build: Build, dict: Dict) {
  const has = build.details?.has ?? []
  const domain = has.includes('domain')
  const hosting = has.includes('hosting')
  const s = dict.builder.scope
  if (domain && hosting) return s.both
  if (domain) return s.domain
  if (hosting) return s.hosting
  return s.none
}

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
        price: formatUsd(line.price),
      })
    } else {
      extras.push({
        id: line.id,
        name: dict.extras.items[line.id].name,
        detail: '',
        term: '',
        price: formatUsd(line.price),
      })
    }
  }
  const quoteWord = pick(builderUi.onRequest, locale)
  const onRequest: EstimateRow[] = productsOnRequest(build).map((id) => ({
    id,
    name: pick(productCatalog[id].name, locale),
    detail: pick(productCatalog[id].hint, locale),
    term: '',
    price: quoteWord,
  }))
  return {
    kind: build.kind ? kindName(build.kind, locale) : null,
    products: (build.products ?? []).map((id) => pick(productCatalog[id].name, locale)),
    onRequest,
    parts,
    extras,
    subtotal: formatUsd(q.subtotal),
    discount: q.discount ? `-${Math.round(bundleDiscount * 100)}%` : null,
    // No priced lines: nothing to sum, the quote says so instead of showing zero.
    total: q.lines.length ? formatUsd(q.total) : quoteWord,
    monthly: q.monthly === null ? null : `${formatUsd(q.monthly)}${dict.builder.perMonth}`,
    stages: stagesFor(build, q.total).map((stage, i) => ({
      id: stage.id,
      n: i + 1,
      name: stage.title[locale === 'ru' ? 'ru' : 'en'],
      share: `${stage.share}%`,
      amount: formatUsd(stage.amountUsd),
    })),
    guarantee: dict.guarantee.line,
    scope: scopeLine(build, dict),
    link: `${siteUrl}/${locale}/builder?b=${encodeBuild(build)}`,
    brief: briefOf(build, dict, locale),
  }
}

// The brief (goals, style, details) as labelled rows, for the summary screen, the PDF and the lead.
// Only what the visitor picked; the style shows defaults for fields left open once any is picked.
export function briefOf(build: Build, dict: Dict, locale = 'ru'): Brief {
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
  if (build.style && usesAxes(build.style)) {
    const s = build.style
    const ui = builderUi
    if (s.kit)
      style.push({ id: 'look', label: t.looksTitle, value: pick(kitNames[s.kit].name, locale) })
    else style.push({ id: 'look', label: t.looksTitle, value: pick(ui.customStyle, locale) })
    if (s.palette)
      style.push({
        id: 'palette',
        label: pick(ui.axes.palette, locale),
        value: pick(paletteNames[s.palette], locale),
      })
    if (s.type)
      style.push({
        id: 'type',
        label: pick(ui.axes.type, locale),
        value: pick(typeNames[s.type].name, locale),
      })
    if (s.shape)
      style.push({
        id: 'shape',
        label: pick(ui.axes.shape, locale),
        value: pick(shapeNames[s.shape], locale),
      })
    if (s.density)
      style.push({
        id: 'density',
        label: pick(ui.axes.density, locale),
        value: pick(densityNames[s.density], locale),
      })
    if (s.mood)
      style.push({
        id: 'mood',
        label: pick(ui.axes.mood, locale),
        value: pick(moodNames[s.mood].name, locale),
      })
  } else if (build.style && Object.keys(build.style).length) {
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
  const ui = builderUi
  const lines: string[] = []
  if (doc.kind) lines.push(`${pick(ui.kindLabel, locale)}: ${doc.kind}`)
  if (doc.products.length) lines.push(`${pick(ui.productsLabel, locale)}: ${doc.products.join(', ')}`)
  lines.push(
    ...doc.parts.map((row) => `${row.name}: ${row.detail} (${row.price}, ${row.term})`),
    ...doc.extras.map((row) => `${row.name} (${row.price})`),
  )
  if (q.discount) lines.push(`${t.discount}: ${doc.subtotal} -> ${doc.total}`)
  lines.push(`${t.total}: ${doc.total}`)
  // Products without a price are listed apart and never summed.
  if (doc.onRequest.length)
    lines.push(
      `${pick(ui.onRequestLabel, locale)}: ${doc.onRequest.map((row) => row.name).join(', ')}`,
    )
  if (doc.monthly) lines.push(`${dict.extras.items.support.name}: ${doc.monthly}`)
  if (doc.stages.length)
    lines.push(
      `${t.stageLead}: ${doc.stages.map((s) => `${s.n}. ${s.amount} (${s.share})`).join(', ')}`,
    )
  lines.push(doc.scope)
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
