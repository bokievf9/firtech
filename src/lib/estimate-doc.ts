import { startLine } from './estimate-start'
import { guaranteeLine } from './guarantee'
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
import {
  approverText, baseText, chanText, channelNames, devText, discToolText, langText, rhythmText, roleText, srcText, whenText, connectText, discLabels, handText, heardText, hoursText, leadsText,
  painText, personalLabels, sizeText, successText, tierText, toneUi, whoTextAll,
} from '../content/builder-personal'
import { depthLabel, depthTitle, depthUi } from '../content/builder-depth'
import { depthQuestions } from './builder-depth'
import { deptOfAgents } from './builder-dept'
import { cleanNote, monthlyOf, personalOnly, tierOf } from './builder-personal'
import { catalogRows } from './builder-capabilities'
import { flagshipPrice } from './flagships'
import { defaultStyle, encodeBuild, productsOnRequest, quote, type Build } from './builder'
import { usesAxes } from './builder-style'
import { effectiveDelivery, effectiveSiteNeed, hasAgent } from './builder-v2'
import { agentStages, stagesFor } from './payment-stages'
import { agentQuote, isAgentPath, agentOnly } from './builder-agent'
import { agentUi } from '../content/builder-agent'
import { channelName } from './channels'
import type { ChannelId } from './channels'
import { defaultPricing, formatUsd, type Pricing } from './pricing'
import { serviceSlugs, siteUrl, type ServiceSlug } from './site'

// The printable estimate (`/[locale]/builder/estimate?b=...`): the same quote as the builder's
// summary, turned into labelled rows. Pure, so the numbers can be tested without a browser.

export type EstimateRow = { id: string; name: string; detail: string; term: string; price: string }

export type StageRow = { id: string; n: number; name: string; share: string; amount: string }

export type BriefRow = { id: string; label: string; value: string }
export type Brief = { goals: BriefRow[]; setup: BriefRow[]; style: BriefRow[]; details: BriefRow[]; catalog: BriefRow[] }

export type EstimateAgents = { rows: EstimateRow[]; monthly: string; monthlyUsd: number; setupUsd: number }

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
  // Agents sold one by one (builder v6): a row per agent with its own price, the team discount and the paid options as
  // rows, and the subscription per month. Their one-time setup is already inside `total`. null without agents.
  agents: EstimateAgents | null
  // The money-back guarantee sentence for the footer notes (dictionary `guarantee.line`).
  guarantee: string
  // What is not in the price (domain, hosting, paid third-party services), per the brief.
  scope: string
  link: string
  // The honest start (START_IN_DAYS): «Старт через 3 рабочих дня после оплаты первого этапа».
  start: string
  // The top block (owner audit 2026-11-24): what to pay now, the subscription apart, null when there is nothing to show.
  payNow: { label: string; amount: string; stage: string } | null
  // The cabinet coupon (contract coupon/contract.md): the discount line on the one-time part, `couponNote` when the
  // bundle discount is the larger one and the coupon stays for the next order. Both null without a valid coupon.
  coupon: { label: string; amount: string; percent: number } | null
  couponNote: string | null
  subscription: { label: string; amount: string; text: string } | null
  sketch: string
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

// The cabinet coupon on the ONE-TIME part (setup + stages), never on the monthly. Not stacked with the bundle
// discount: the larger of the two applies. `subtotal` is the one-time sum before any discount, `bundleAmount` what
// the bundle already took off it (0 = none), `bundlePercent` its percent. Whole USD like the other discounts.
export function couponMath(subtotal: number, bundleAmount: number, bundlePercent: number, percent: number) {
  const bundled = subtotal - bundleAmount
  if (!(percent > 0) || subtotal <= 0) return { amount: 0, total: bundled, kept: false }
  if (bundleAmount > 0 && bundlePercent >= percent) return { amount: 0, total: bundled, kept: true }
  const amount = Math.round((subtotal * percent) / 100)
  return { amount, total: subtotal - amount, kept: false }
}

export function estimateDoc(
  source: Build,
  dict: Dict,
  locale: string,
  pricing: Pricing = defaultPricing,
  // The percent of a valid cabinet coupon of the signed-in client (`useCabinetCoupon`), null = none.
  couponPercent: number | null = null,
): EstimateDoc {
  // The personal path never shows a niche, products or parts, even when a link carried them; the agent path the same.
  const build = agentOnly(personalOnly(source))
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
      const level = id === 'personal' ? `${(build.personal ? tierText[f.plan.id as 'basic' | 'plus' | 'max'].name : flagshipText.levels[f.plan.id as 'basic' | 'plus' | 'max'])[loc]}: ` : `${locale === 'ru' ? 'от' : 'from'} `
      return {
        id,
        name: pick(productCatalog[id].name, locale),
        detail: f.options.map((o) => pick(flagshipText.options[o as keyof typeof flagshipText.options].name, locale)).join(', '),
        term: '',
        price: `${level}${formatUsd(f.plan.setup)} + ${formatUsd(id === 'personal' ? monthlyOf(f.plan, build.personal?.byok) : f.plan.monthly)}${flagshipText.perMonth[loc]}${id === 'personal' && build.personal?.byok ? ` (${personalLabels.byok[loc]})` : ''}${f.byQuote ? `, ${flagshipText.byQuote[loc]}` : ''}`,
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
  const aq = agentQuote(build, pricing)
  const loc2 = locale === 'ru' ? 'ru' : 'en'
  const agentTitle = (id: string) => (dict.aiTeams.agents.items as Record<string, { title: string }>)[id]?.title ?? id
  const agentResult = (id: string) => {
    const a = dict.aiTeams.agents
    const result = (a.items as Record<string, { result?: string }>)[id]?.result
    return result ? `${a.page.resultLabel}: ${result}` : ''
  }
  const agents: EstimateAgents | null = aq
    ? {
        rows: [
          ...(build.agents ?? []).map((id) => ({
            id: `agent-${id}`,
            name: agentTitle(id),
            detail: agentResult(id),
            term: '',
            price: `${formatUsd(aq.unit.setup)} + ${formatUsd(aq.unit.monthly)}${dict.builder.perMonth}`,
          })),
          ...(aq.count >= 2
            ? [{ id: 'agent-team', name: agentUi.labels.teamDiscount[loc2], detail: '', term: '', price: `-${aq.discountPercent}%` }]
            : []),
          ...aq.addons.map((a) => ({ id: `agent-${a.id}`, name: agentUi.addons[a.id].name[loc2], detail: agentUi.addons[a.id].hint[loc2], term: '', price: formatUsd(a.price) })),
        ],
        monthly: `${formatUsd(aq.monthly)}${dict.builder.perMonth}`,
        monthlyUsd: aq.monthly,
        setupUsd: aq.oneTime,
      }
    : null
  const subtotalOne = q.subtotal + (aq?.oneTime ?? 0)
  const cm = couponMath(subtotalOne, q.discount ?? 0, q.discount ? pricing.bundleDiscount : 0, couponPercent ?? 0)
  const oneTime = cm.amount > 0 ? cm.total : q.total + (aq?.oneTime ?? 0)
  const couponLine = dict.builder.estimate.couponLine.replace('{percent}', String(couponPercent ?? 0))
  const stageRows = aq && !q.lines.length ? agentStages(oneTime, pricing) : stagesFor(build, oneTime, pricing)
  return {
    kind: build.kind ? kindName(build.kind, locale) : null,
    products: build.personal ? [] : (build.products ?? []).map((id) => pick(productCatalog[id].name, locale)),
    onRequest,
    parts,
    extras,
    subtotal: formatUsd(q.subtotal + (aq?.oneTime ?? 0)),
    // With agent lines the discount is shown as the amount it takes off the parts, not as a percent of the whole.
    discount: q.discount && cm.amount === 0 ? (aq ? `-${formatUsd(q.discount)}` : `-${Math.round(pricing.bundleDiscount)}%`) : null,
    // No priced lines: nothing to sum, the quote says so instead of showing zero.
    total: q.lines.length || aq ? formatUsd(oneTime) : quoteWord,
    monthly: q.monthly === null ? null : `${formatUsd(q.monthly)}${dict.builder.perMonth}`,
    agents,
    stages: stageRows.map((stage, i) => ({
      id: stage.id,
      n: i + 1,
      name: stage.title[locale === 'ru' ? 'ru' : 'en'],
      share: `${stage.share}%`,
      amount: formatUsd(stage.amountUsd),
    })),
    guarantee: guaranteeLine(dict, locale, pricing),
    scope: scopeLine(build, dict),
    link: `${siteUrl}/${locale}/builder?b=${encodeBuild(build)}`,
    start: startLine(dict),
    payNow: stageRows.length
      ? { label: dict.builder.estimate.payNowLabel, amount: formatUsd(stageRows[0]!.amountUsd), stage: dict.builder.estimate.payNowStage.replace('{n}', String(stageRows.length)) }
      : null,
    subscription:
      (q.monthly ?? 0) + (aq?.monthly ?? 0) > 0
        ? {
            label: dict.builder.estimate.subscriptionLabel,
            amount: `${formatUsd((q.monthly ?? 0) + (aq?.monthly ?? 0))}${dict.builder.perMonth}`,
            text: dict.builder.estimate.subscriptionText,
          }
        : null,
    coupon: cm.amount > 0 ? { label: couponLine, amount: `-${formatUsd(cm.amount)}`, percent: couponPercent ?? 0 } : null,
    couponNote: cm.kept ? dict.builder.estimate.couponNote : null,
    sketch: dict.builder.estimate.sketch,
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

  // The personal path: the brief comes first in the lead text (ids `p-...`).
  const p = build.personal
  if (p) {
    const add = (id: string, label: string, value: string | undefined) => {
      if (value) setup.push({ id: `p-${id}`, label, value })
    }
    add('who', personalLabels.who[loc], p.who ? whoTextAll[p.who].name[loc] : undefined)
    add('hand', personalLabels.hand[loc], p.hand?.map((id) => handText[id].name[loc]).join(', '))
    add('where', personalLabels.where[loc], p.where?.map((id) => channelNames[id].name[loc]).join(', '))
    add('connect', personalLabels.connect[loc], p.connect?.map((id) => connectText[id][loc]).join(', '))
    add(
      'tone',
      personalLabels.tone[loc],
      p.tone ? toneUi.axes.map((axis, i) => axis.options[p.tone![i] ?? 1]?.[loc]).filter(Boolean).join(', ') : undefined,
    )
    add('tier', personalLabels.tier[loc], tierText[tierOf(p)].name[loc])
    add('byok', personalLabels.byok[loc], p.byok ? personalLabels.yes[loc] : personalLabels.no[loc])
  }

  // The agent path: the agent, where it works, what it connects to, the volume and the paid options.
  const ab = build.agentBrief
  if (ab) {
    const L = agentUi.labels
    const add = (id: string, label: string, value: string | undefined) => {
      if (value) setup.push({ id: `a-${id}`, label, value })
    }
    const titleOf = (id: string) => (dict.aiTeams.agents.items as Record<string, { title: string }>)[id]?.title ?? id
    add('agent', L.agents[loc], build.agents?.map(titleOf).join(', '))
    add('where', L.where[loc], ab.channels?.map((id) => channelName(id as ChannelId, loc)).join(', '))
    add('connect', L.connect[loc], ab.connect?.map((id) => agentUi.connect[id].name[loc]).join(', '))
    add('volume', L.volume[loc], ab.volume ? agentUi.volume[ab.volume][loc] : undefined)
    for (const q of depthQuestions[deptOfAgents(build)]) {
      const picked = ab.deep?.[q.id]
      add(`d-${q.id}`, depthTitle[q.id]![loc], picked?.map((id) => depthLabel(q.id, id)[loc]).join(', '))
    }
    add('d-note', depthUi.note[loc], ab.note && cleanNote(ab.note))
    add('options', L.options[loc], [ab.knowledge && agentUi.addons.knowledge.name[loc], ab.training && agentUi.addons.training.name[loc]].filter(Boolean).join(', '))
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
  const v = build.discovery
  if (v) {
    row('d-size', discLabels.size[loc], v.size && sizeText[v.size][loc])
    row('d-leads', discLabels.leads[loc], v.leads && leadsText[v.leads][loc])
    row('d-base', discLabels.base[loc], v.base && baseText[v.base][loc])
    row('d-hours', discLabels.hours[loc], v.hours && hoursText[v.hours][loc])
    row('d-tz', discLabels.tz[loc], v.tz)
    row('d-approver', discLabels.approver[loc], v.approver && approverText[v.approver][loc])
    row('d-site', discLabels.site[loc], v.site)
    row('d-instagram', discLabels.instagram[loc], v.instagram)
    row('d-pains', discLabels.pains[loc], v.pains?.map((id) => painText[id][loc]).join(', '))
    row('d-success', discLabels.success[loc], v.success?.map((id) => successText[id][loc]).join(', '))
    row('d-heard', discLabels.heard[loc], v.heard && heardText[v.heard][loc])
    row('d-src', discLabels.src[loc], v.src?.map((id) => srcText[id][loc]).join(', '))
    row('d-tools', discLabels.tools[loc], v.tools?.map((id) => discToolText[id][loc]).join(', '))
    row('d-langs', discLabels.langs[loc], v.langs?.map((id) => langText[id][loc]).join(', '))
    row('d-when', discLabels.when[loc], v.when && whenText[v.when][loc])
    row('d-role', discLabels.role[loc], v.role && roleText[v.role][loc])
    row('d-rhythm', discLabels.rhythm[loc], v.rhythm?.map((id) => rhythmText[id][loc]).join(', '))
    row('d-chan', discLabels.chan[loc], v.chan?.map((id) => chanText[id][loc]).join(', '))
    row('d-first', discLabels.first[loc], v.first && handText[v.first].name[loc])
    row('d-dev', discLabels.dev[loc], v.dev?.map((id) => devText[id][loc]).join(', '))
    row('d-note', discLabels.note[loc], v.note && cleanNote(v.note))
  }
  return { goals, setup, style, details, catalog: catalogRows(build, locale) }
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
  const aq = agentQuote(build, pricing)
  if (aq) {
    const titles = (build.agents ?? []).map((id) => (dict.aiTeams.agents.items as Record<string, { title: string }>)[id]?.title ?? id)
    lines.push({ label: `${agentUi.labels.agents[locale === 'ru' ? 'ru' : 'en']}: ${titles.join(', ')} (${agentUi.labels.setupWord[locale === 'ru' ? 'ru' : 'en']})`.slice(0, 120), usd: aq.setup })
    for (const a of aq.addons) lines.push({ label: agentUi.addons[a.id].name[locale === 'ru' ? 'ru' : 'en'], usd: a.price })
  }
  if (!lines.length || lines.length > 30) return null
  const monthlyTotal = (q.monthly ?? 0) + (aq?.monthly ?? 0)
  const sum = lines.reduce((acc, l) => acc + l.usd, 0)
  const discountUsd = q.discount ?? 0
  const out: EstimateJson = {
    v: 1,
    lines,
    ...(discountUsd > 0 ? { discountUsd } : {}),
    totalUsd: sum - discountUsd,
    ...(monthlyTotal ? { monthlyUsd: monthlyTotal } : {}),
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
  source: Build,
  dict: Dict,
  locale: string,
  pricing: Pricing = defaultPricing,
) {
  if (source.personal) return personalLeadSummary(source, dict, locale, pricing)
  if (isAgentPath(source)) return agentLeadSummary(source, dict, locale, pricing)
  const build = source
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
    ...(doc.agents ? doc.agents.rows.map((row) => `${agentUi.labels.agent[locale === 'ru' ? 'ru' : 'en']}: ${row.name} (${row.price})`) : []),
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
  if (doc.agents) lines.push(`${agentUi.labels.monthly[locale === 'ru' ? 'ru' : 'en']}: ${doc.agents.monthly}`)
  if (doc.stages.length)
    lines.push(
      `${t.stageLead}: ${doc.stages.map((s) => `${s.n}. ${s.amount} (${s.share})`).join(', ')}`,
    )
  lines.push(doc.scope)
  // The quote lines always go in. The brief follows by priority and is summarised: a row that does
  // not fit the limit is dropped, and the wish (last) is shortened to the room that is left.
  const { goals, setup, style, details, catalog } = doc.brief
  const byId = (id: string) => details.find((r) => r.id === id)
  const order: BriefRow[] = [
    ...[byId('company'), byId('clients'), ...setup, byId('after'), byId('owner'), byId('deadline')].filter(
      (r): r is BriefRow => Boolean(r),
    ),
    ...goals,
    ...catalog,
    ...(style.length
      ? [{ id: 'style', label: t.styleLabel, value: style.map((r) => r.value).join(', ') }]
      : []),
    ...['sources', 'tools', 'has', 'fears', 'budget', 'd-pains', 'd-success', 'd-leads', 'd-base', 'd-size', 'd-hours', 'd-tz', 'd-approver', 'd-site', 'd-instagram', 'd-heard', 'langs', 'examples']
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

// The agent lead: the agents with their price, the one-time total with its stages, the monthly subscription and
// the answers of the three questions. No niche, no parts.
export function agentLeadSummary(source: Build, dict: Dict, locale: string, pricing: Pricing = defaultPricing) {
  const build = agentOnly(source)
  const loc = locale === 'ru' ? 'ru' : 'en'
  const t = dict.builder
  const doc = estimateDoc(build, dict, locale, pricing)
  const lines: string[] = []
  for (const row of doc.agents?.rows ?? []) lines.push(`${agentUi.labels.agent[loc]}: ${row.name} (${row.price})`)
  lines.push(`${t.total}: ${doc.total}`)
  if (doc.agents) lines.push(`${agentUi.labels.monthly[loc]}: ${doc.agents.monthly}`)
  if (doc.stages.length) lines.push(`${t.stageLead}: ${doc.stages.map((s) => `${s.n}. ${s.amount} (${s.share})`).join(', ')}`)
  const rows: BriefRow[] = [...doc.brief.setup.filter((r) => r.id !== 'a-agent'), ...doc.brief.details.filter((r) => r.id.startsWith('d-'))]
  let text = lines.join('\n')
  for (const r of rows) {
    const line = `${r.label}: ${r.value}`
    if (text.length + 1 + line.length <= leadLimit) text += `\n${line}`
  }
  return text.slice(0, leadLimit)
}

// The personal lead: the tier with its price, who the person is, what they hand over, channels, connections,
// tone and the discovery answers. No niche, no products, no parts, no payment stages (those are the business path).
export function personalLeadSummary(source: Build, dict: Dict, locale: string, pricing: Pricing = defaultPricing) {
  const build = personalOnly(source)
  const loc = locale === 'ru' ? 'ru' : 'en'
  const doc = estimateDoc(build, dict, locale, pricing)
  const { setup, details, catalog } = doc.brief
  const lines: string[] = []
  const price = doc.onRequest[0]
  if (price) lines.push(`${personalLabels.tier[loc]}: ${price.price}`)
  const rows: BriefRow[] = [
    ...setup.filter((r) => r.id !== 'p-tier'),
    ...catalog,
    ...details.filter((r) => r.id.startsWith('d-')),
  ]
  let text = lines.join('\n')
  for (const r of rows) {
    const line = `${r.label}: ${r.value}`
    if (text.length + 1 + line.length <= leadLimit) text += `${text ? '\n' : ''}${line}`
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
