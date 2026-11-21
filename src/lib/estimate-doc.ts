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
import {
  afterText,
  assetText,
  budgetText,
  channelText,
  clientTypeText,
  deadlineText,
  deliveryText,
  detailLabels,
  fearText,
  goalText,
  moodText,
  siteNeedText,
  sourceText,
  flagshipText,
  themeText,
  toolText,
} from '../content/builder-v2'
import { flagshipPrice } from './flagships'
import { defaultStyle, encodeBuild, productsOnRequest, quote, type Build } from './builder'
import { usesAxes } from './builder-style'
import { effectiveDelivery, effectiveSiteNeed, hasAgent } from './builder-v2'
import { stagesFor } from './payment-stages'
import { defaultPricing, formatUsd, type Pricing } from './pricing'
import { serviceSlugs, siteUrl, type ServiceSlug } from './site'

// The printable estimate (`/[locale]/builder/estimate?b=...`): the same quote as the builder's
// summary, turned into labelled rows. Pure, so the numbers can be tested without a browser.

export type EstimateRow = { id: string; name: string; detail: string; term: string; price: string }

export type StageRow = { id: string; n: number; name: string; share: string; amount: string }

export type BriefRow = { id: string; label: string; value: string }
export type Brief = { goals: BriefRow[]; setup: BriefRow[]; style: BriefRow[]; details: BriefRow[] }

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

export function estimateDoc(
  build: Build,
  dict: Dict,
  locale: string,
  pricing: Pricing = defaultPricing,
): EstimateDoc {
  const q = quote(build, pricing)
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
  // The flagships carry their plan: the Personal AI its level, the AI company its starting price «по смете».
  const onRequest: EstimateRow[] = productsOnRequest(build).map((id) => {
    if (id === 'personal' || id === 'company') {
      const f = flagshipPrice(build, id, pricing)
      const loc = locale === 'ru' ? 'ru' : 'en'
      const level = id === 'personal' ? `${flagshipText.levels[f.plan.id as 'basic' | 'plus' | 'max'][loc]}: ` : `${locale === 'ru' ? 'от' : 'from'} `
      return {
        id,
        name: pick(productCatalog[id].name, locale),
        detail: f.options.map((o) => pick(flagshipText.options[o as keyof typeof flagshipText.options].name, locale)).join(', '),
        term: '',
        price: `${level}${formatUsd(f.plan.setup)} + ${formatUsd(f.plan.monthly)}${flagshipText.perMonth[loc]}${f.byQuote ? `, ${flagshipText.byQuote[loc]}` : ''}`,
      }
    }
    return {
      id,
      name: pick(productCatalog[id].name, locale),
      detail: pick(productCatalog[id].hint, locale),
      term: '',
      price: quoteWord,
    }
  })
  return {
    kind: build.kind ? kindName(build.kind, locale) : null,
    products: (build.products ?? []).map((id) => pick(productCatalog[id].name, locale)),
    onRequest,
    parts,
    extras,
    subtotal: formatUsd(q.subtotal),
    discount: q.discount ? `-${Math.round(pricing.bundleDiscount)}%` : null,
    // No priced lines: nothing to sum, the quote says so instead of showing zero.
    total: q.lines.length ? formatUsd(q.total) : quoteWord,
    monthly: q.monthly === null ? null : `${formatUsd(q.monthly)}${dict.builder.perMonth}`,
    stages: stagesFor(build, q.total, pricing).map((stage, i) => ({
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
  const loc = locale === 'ru' ? 'ru' : 'en'
  if (build.goals?.length)
    goals.push({
      id: 'goals',
      label: t.goalsLabel,
      value: build.goals.map((id) => goalText[id]?.name[loc] ?? id).join(', '),
    })
  if (build.channels?.length)
    goals.push({
      id: 'channels',
      label: t.channelsLabel,
      value: build.channels.map((id) => channelText[id].name[loc]).join(', '),
    })

  // Where the agent lives and whether it gets a site: the lead text carries the choice.
  const setup: BriefRow[] = []
  if (hasAgent(build)) {
    const delivery = effectiveDelivery(build)
    if (delivery.length)
      setup.push({
        id: 'delivery',
        label: detailLabels.delivery[loc],
        value: delivery.map((id) => deliveryText[id].name[loc]).join(', '),
      })
    const need = effectiveSiteNeed(build)
    if (need)
      setup.push({ id: 'site', label: detailLabels.site[loc], value: siteNeedText[need].name[loc] })
  }

  const style: BriefRow[] = []
  if (build.style && usesAxes(build.style)) {
    const s = build.style
    const ui = builderUi
    if (s.themeId)
      style.push({
        id: 'theme',
        label: detailLabels.theme[loc],
        value: `${themeText[s.themeId].name[loc]}, ${moodText[s.themeMood ?? 'calm'].name[loc].toLowerCase()}`,
      })
    else if (s.kit)
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
  const row = (id: string, label: string, value: string | undefined) => {
    if (value) details.push({ id, label, value })
  }
  row('company', detailLabels.company[loc], d.company)
  const clients = [d.clients, ...(d.clientTypes ?? []).map((id) => clientTypeText[id][loc])]
    .filter(Boolean)
    .join('; ')
  row('clients', detailLabels.clients[loc], clients)
  row('owner', detailLabels.owner[loc], d.owner)
  if (d.deadline) row('deadline', t.deadlineLabel, deadlineText[d.deadline][loc])
  if (d.after?.length)
    row('after', detailLabels.after[loc], d.after.map((id) => afterText[id][loc]).join(', '))
  if (d.sources?.length)
    row('sources', detailLabels.sources[loc], d.sources.map((id) => sourceText[id][loc]).join(', '))
  if (d.tools?.length)
    row('tools', detailLabels.tools[loc], d.tools.map((id) => toolText[id][loc]).join(', '))
  if (d.has?.length) row('has', t.hasLabel, d.has.map((id) => assetText[id][loc]).join(', '))
  if (d.fears?.length)
    row('fears', detailLabels.fears[loc], d.fears.map((id) => fearText[id][loc]).join(', '))
  if (d.budget) row('budget', detailLabels.budget[loc], budgetText[d.budget][loc])
  if (d.langs?.length) row('langs', t.langsLabel, d.langs.map((id) => id.toUpperCase()).join(', '))
  if (d.examples?.length) row('examples', t.examplesLabel, d.examples.join(', '))
  row('wish', t.wishLabel, d.wish)
  return { goals, setup, style, details }
}

// The estimate as JSON for HQ (`estimate` of the lead, 2026-11-22): `{"v":1,"lines":[{"label","usd"}],
// "discountUsd"?,"totalUsd","monthlyUsd"?,"onRequest"?:[names]}`. `totalUsd` is the sum of the lines minus the
// discount, as HQ checks it. null when nothing is priced or the JSON would not fit `leadLimit`.
export type EstimateJson = {
  v: 1
  lines: { label: string; usd: number }[]
  discountUsd?: number
  totalUsd: number
  monthlyUsd?: number
  onRequest?: string[]
}
export function estimateJson(
  build: Build,
  dict: Dict,
  locale: string,
  pricing: Pricing = defaultPricing,
): EstimateJson | null {
  const q = quote(build, pricing)
  const doc = estimateDoc(build, dict, locale, pricing)
  const rows = [...doc.parts, ...doc.extras]
  const lines = q.lines
    .map((line, i) => {
      const row = rows[i]
      const label = row ? (row.detail ? `${row.name}: ${row.detail}` : row.name) : line.id
      return { label: label.slice(0, 120), usd: line.price }
    })
    .filter((l) => l.usd > 0)
  if (!lines.length || lines.length > 30) return null
  const sum = lines.reduce((acc, l) => acc + l.usd, 0)
  const discountUsd = q.discount ?? 0
  const out: EstimateJson = {
    v: 1,
    lines,
    ...(discountUsd > 0 ? { discountUsd } : {}),
    totalUsd: sum - discountUsd,
    ...(q.monthly ? { monthlyUsd: q.monthly } : {}),
    ...(doc.onRequest.length ? { onRequest: doc.onRequest.map((r) => r.name) } : {}),
  }
  return JSON.stringify(out).length <= leadLimit ? out : null
}

// The builder link for the lead's `page` (600 characters at most, in the lead schema): the whole
// `https://firtech.pro/<locale>/builder?b=...`; a longer one is cut at a `~` so it stays a valid, shorter build.
export const leadPageLimit = 600
export function leadPage(link: string): string {
  if (link.length <= leadPageLimit) return link
  const cut = link.slice(0, leadPageLimit)
  const at = cut.lastIndexOf('~')
  return at > link.indexOf('?b=') + 3 ? cut.slice(0, at) : cut
}

// What the builder's lead carries: the JSON estimate in `estimate` and the text summary in `message`
// (the owner's Telegram card and the cabinet show both); without a JSON the text stays in `estimate`.
export function leadEstimateFields(
  build: Build,
  dict: Dict,
  locale: string,
  pricing: Pricing = defaultPricing,
): { estimate: string; message?: string } {
  const text = leadSummary(build, dict, locale, pricing)
  const json = estimateJson(build, dict, locale, pricing)
  return json ? { estimate: JSON.stringify(json), message: text } : { estimate: text }
}

// The contact form's estimate field holds at most this many characters (lead schema).
export const leadLimit = 1500

// What the contact form receives from the builder: the quote line by line, then the brief in a few
// compact lines. The wish goes last and is the part shortened if the whole would not fit.
export function leadSummary(
  build: Build,
  dict: Dict,
  locale: string,
  pricing: Pricing = defaultPricing,
) {
  const t = dict.builder
  const doc = estimateDoc(build, dict, locale, pricing)
  const q = quote(build, pricing)
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
      `${pick(ui.onRequestLabel, locale)}: ${doc.onRequest
        .map((row) => (row.price === pick(ui.onRequest, locale) ? row.name : `${row.name} (${row.detail}; ${row.price})`))
        .join(', ')}`,
    )
  if (doc.monthly) lines.push(`${dict.extras.items.support.name}: ${doc.monthly}`)
  if (doc.stages.length)
    lines.push(
      `${t.stageLead}: ${doc.stages.map((s) => `${s.n}. ${s.amount} (${s.share})`).join(', ')}`,
    )
  lines.push(doc.scope)
  // The quote lines always go in. The brief follows by priority and is summarised: a row that does
  // not fit the limit is dropped, and the wish (last) is shortened to the room that is left.
  const { goals, setup, style, details } = doc.brief
  const byId = (id: string) => details.find((r) => r.id === id)
  const order: BriefRow[] = [
    ...[byId('company'), byId('clients'), ...setup, byId('after'), byId('owner'), byId('deadline')].filter(
      (r): r is BriefRow => Boolean(r),
    ),
    ...goals,
    ...(style.length
      ? [{ id: 'style', label: t.styleLabel, value: style.map((r) => r.value).join(', ') }]
      : []),
    ...['sources', 'tools', 'has', 'fears', 'budget', 'langs', 'examples']
      .map(byId)
      .filter((r): r is BriefRow => Boolean(r)),
  ]
  let text = lines.join('\n')
  if (text.length > leadLimit) return text.slice(0, leadLimit)
  for (const r of order) {
    const line = `${r.label}: ${r.value}`
    if (text.length + 1 + line.length <= leadLimit) text += `\n${line}`
    else {
      const room = leadLimit - text.length - 1 - r.label.length - 2
      if (room > 30) text += `\n${r.label}: ${r.value.slice(0, room - 3)}...`
    }
  }
  const wish = byId('wish')
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
