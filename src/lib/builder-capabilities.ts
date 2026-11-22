import type { Build } from './builder'
import {
  capabilities,
  capabilityById,
  capabilityCovered,
  capabilityGroups,
  catalogUi,
  channelGroups,
  channelOptions,
  contentFormats,
  contentFrequencies,
  integrationGroups,
  integrations,
  personalSkills,
  results,
  resultGroups,
  skillGroups,
  allSubNicheIds,
  subNiches,
  type Group,
  type Item,
} from '../content/capabilities'
import type { KindId } from '../content/builder-catalog'
import { kindCatalog } from '../content/builder-catalog'

// «Сборка проекта» v5: what the visitor picked from the capability catalogue (content/capabilities.ts), its
// link chunk, the lead summary rows and the brief for HQ. Pure and tested (tests/builder-capabilities.test.mjs).
// The picks travel in ONE chunk `x.<base64url JSON>` (the chunk letter `x` is shared with the old extras list
// `x.seo-support`: a catalogue chunk is told apart by its base64 of `{`, which always starts with `ey`; no
// extra id does). The JSON is bounded (`catalogLimit`) and unknown ids are dropped on decode.

export type CatalogPick = {
  // sub-niches of the picked kind (`su`), outcome goals (`rs`), agent capabilities (`cp`), channel
  // sub-options (`ch`), integrations (`in`), content format -> frequency (`ct`), personal skills (`sk`)
  sub?: string[]
  res?: string[]
  cap?: string[]
  chn?: string[]
  int?: string[]
  con?: Record<string, string>
  skl?: string[]
}
export type CatalogKey = keyof CatalogPick

export const catalogLimit = 1200
const keyOf: Record<CatalogKey, string> = { sub: 'su', res: 'rs', cap: 'cp', chn: 'ch', int: 'in', con: 'ct', skl: 'sk' }
const listKeys = ['sub', 'res', 'cap', 'chn', 'int', 'skl'] as const

const ids = (items: readonly { id: string }[]) => new Set(items.map((i) => i.id))
const known: Record<(typeof listKeys)[number], Set<string>> = {
  sub: new Set(allSubNicheIds),
  res: ids(results),
  cap: ids(capabilities),
  chn: ids(channelOptions),
  int: ids(integrations),
  skl: ids(personalSkills),
}
const formatIds = ids(contentFormats)
const freqIds = ids(contentFrequencies)

export const catalogEmpty = (c: CatalogPick | undefined) =>
  !c || (!listKeys.some((k) => c[k]?.length) && !Object.keys(c.con ?? {}).length)

export const catalogCount = (c: CatalogPick | undefined) =>
  listKeys.reduce((n, k) => n + (c?.[k]?.length ?? 0), 0) + Object.keys(c?.con ?? {}).length

// ---------------------------------------------------------------- the chunk

// Compact JSON: `{"su":[..],"rs":[..],"cp":[..],"ch":[..],"in":[..],"ct":{"f01":"q3"},"sk":[..]}`. Too long:
// ids are dropped from the end of the longest list until it fits.
export function catalogJson(c: CatalogPick | undefined): string {
  if (catalogEmpty(c)) return ''
  const work: CatalogPick = {
    ...(c!.sub?.length ? { sub: [...c!.sub] } : {}),
    ...(c!.res?.length ? { res: [...c!.res] } : {}),
    ...(c!.cap?.length ? { cap: [...c!.cap] } : {}),
    ...(c!.chn?.length ? { chn: [...c!.chn] } : {}),
    ...(c!.int?.length ? { int: [...c!.int] } : {}),
    ...(c!.con && Object.keys(c!.con).length ? { con: { ...c!.con } } : {}),
    ...(c!.skl?.length ? { skl: [...c!.skl] } : {}),
  }
  const text = () => {
    const o: Record<string, unknown> = {}
    for (const k of [...listKeys, 'con'] as const) if (work[k]) o[keyOf[k]] = work[k]
    return JSON.stringify(o)
  }
  let out = text()
  while (out.length > catalogLimit) {
    const longest = listKeys.filter((k) => work[k]?.length).sort((a, b) => work[b]!.length - work[a]!.length)[0]
    if (longest) {
      work[longest]!.pop()
      if (!work[longest]!.length) delete work[longest]
    } else {
      const keys = Object.keys(work.con ?? {})
      if (!keys.length) break
      delete work.con![keys[keys.length - 1]!]
      if (!Object.keys(work.con!).length) delete work.con
    }
    out = text()
  }
  return out.length <= catalogLimit ? out : ''
}

export function parseCatalogJson(text: string): CatalogPick | undefined {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const out: CatalogPick = {}
  for (const k of listKeys) {
    const v = o[keyOf[k]]
    if (!Array.isArray(v)) continue
    const list = [...new Set(v.filter((x): x is string => typeof x === 'string' && known[k].has(x)))]
    if (list.length) out[k] = list
  }
  const ct = o.ct
  if (ct && typeof ct === 'object' && !Array.isArray(ct)) {
    const con: Record<string, string> = {}
    for (const [format, freq] of Object.entries(ct as Record<string, unknown>))
      if (formatIds.has(format) && typeof freq === 'string' && freqIds.has(freq)) con[format] = freq
    if (Object.keys(con).length) out.con = con
  }
  return catalogEmpty(out) ? undefined : out
}

// A catalogue chunk's body (after `x.`): base64 of a JSON object starts with `ey`.
export const isCatalogChunk = (body: string) => body.startsWith('ey')

// ---------------------------------------------------------------- build helpers

export function withCatalog(build: Build, patch: Partial<CatalogPick>): Build {
  const catalog: CatalogPick = { ...build.catalog, ...patch }
  for (const k of listKeys) if (!catalog[k]?.length) delete catalog[k]
  if (!catalog.con || !Object.keys(catalog.con).length) delete catalog.con
  const next: Build = { ...build, catalog }
  if (catalogEmpty(catalog)) delete next.catalog
  return next
}

export const toggleId = (list: readonly string[] | undefined, id: string): string[] =>
  list?.includes(id) ? list.filter((x) => x !== id) : [...(list ?? []), id]

// Sub-niches only make sense for the picked kind: a kind change drops the others.
export function keepSubNiches(build: Build): Build {
  const sub = build.catalog?.sub
  if (!sub?.length) return build
  const own = new Set((build.kind ? subNiches[build.kind] ?? [] : []).map((s) => s.id))
  return withCatalog(build, { sub: sub.filter((id) => own.has(id)) })
}

// The three pains of a niche, from the kind catalogue (the one place they are written).
export const nichePains = (kind: KindId, locale: string): readonly string[] =>
  kindCatalog[kind][locale === 'ru' ? 'ru' : 'en'][3]

// Which picked capabilities the picked products (and the teams of the AI company) already provide, and which are
// «по смете»: no price is ever printed for them.
export function capabilityScope(build: Build): { covered: string[]; quote: string[] } {
  const products = [...(build.products ?? []), ...(build.personal ? ['personal'] : [])]
  const teams = build.options?.company ?? []
  const covered: string[] = []
  const quote: string[] = []
  for (const id of build.catalog?.cap ?? []) {
    const cap = capabilityById[id]
    if (!cap) continue
    ;(capabilityCovered(cap, products, teams) ? covered : quote).push(id)
  }
  return { covered, quote }
}

// ------------------------------------------------------------ lead summary

export type CatalogRow = { id: string; label: string; value: string }
const L = (locale: string) => (locale === 'ru' ? 'ru' : 'en')
export const rowLimit = 240

// «Группа: a, b; Группа: c» in catalogue order, cut at `limit` with «+N ещё».
function grouped(picked: readonly string[], items: readonly Item[], groupList: readonly Group[], locale: string, limit = rowLimit): string {
  const loc = L(locale)
  const rank = (g: string) => groupList.findIndex((x) => x.id === g)
  const flat = items
    .filter((i) => picked.includes(i.id))
    .sort((a, b) => rank(a.group) - rank(b.group))
    .map((i) => ({ group: i.group, name: i.name[loc] }))
  const render = (entries: typeof flat) => {
    const parts: string[] = []
    let last = ''
    for (const e of entries) {
      const title = groupList.find((x) => x.id === e.group)!.name[loc]
      if (e.group === last) parts[parts.length - 1] += `, ${e.name}`
      else parts.push(`${title}: ${e.name}`)
      last = e.group
    }
    return parts.join('; ')
  }
  const more = (n: number) => ` (+${n} ${catalogUi.more[loc]})`
  let shown = flat.length
  if (render(flat).length > limit) {
    shown = 1
    while (shown < flat.length && render(flat.slice(0, shown + 1)).length + more(flat.length - shown - 1).length <= limit) shown++
  }
  return render(flat.slice(0, shown)) + (shown < flat.length ? more(flat.length - shown) : '')
}

const names = (picked: readonly string[], items: readonly Item[], locale: string, limit = rowLimit) => {
  const loc = L(locale)
  const list = items.filter((i) => picked.includes(i.id)).map((i) => i.name[loc])
  let text = ''
  for (let i = 0; i < list.length; i++) {
    const next = text ? `${text}, ${list[i]}` : list[i]!
    if (next.length + (` (+${list.length - i - 1} ${catalogUi.more[loc]})`).length > limit && i > 0) return `${text} (+${list.length - i} ${catalogUi.more[loc]})`
    text = next
  }
  return text
}

const labels = {
  sub: { ru: 'Уточнение ниши', en: 'Niche detail' },
  res: { ru: 'Ожидаемый результат', en: 'Expected results' },
  cap: { ru: 'Возможности агента', en: 'Agent abilities' },
  quote: { ru: 'По смете (не входят в цену продуктов)', en: 'On quote (not in the product price)' },
  chn: { ru: 'Каналы подробно', en: 'Channels in detail' },
  int: { ru: 'Интеграции', en: 'Integrations' },
  con: { ru: 'Контент', en: 'Content' },
  skl: { ru: 'Умения ассистента', en: 'Assistant skills' },
}

export function catalogRows(build: Build, locale: string): CatalogRow[] {
  const c = build.catalog
  if (catalogEmpty(c)) return []
  const loc = L(locale)
  const rows: CatalogRow[] = []
  const add = (id: string, label: string, value: string) => {
    if (value) rows.push({ id, label, value })
  }
  const subs = build.kind ? subNiches[build.kind] ?? [] : []
  add('c-sub', labels.sub[loc], subs.filter((s) => c!.sub?.includes(s.id)).map((s) => s.name[loc]).join(', '))
  add('c-res', labels.res[loc], grouped(c!.res ?? [], results, resultGroups, locale))
  add('c-cap', labels.cap[loc], grouped(c!.cap ?? [], capabilities, capabilityGroups, locale))
  add('c-chn', labels.chn[loc], grouped(c!.chn ?? [], channelOptions, channelGroups, locale))
  add('c-int', labels.int[loc], grouped(c!.int ?? [], integrations, integrationGroups, locale))
  const con = Object.entries(c!.con ?? {})
    .map(([f, q]) => {
      const format = contentFormats.find((x) => x.id === f)
      const freq = contentFrequencies.find((x) => x.id === q)
      return format && freq ? `${format.name[loc]}: ${freq.name[loc].toLowerCase()}` : ''
    })
    .filter(Boolean)
    .join('; ')
  add('c-ct', labels.con[loc], con.length > rowLimit ? `${con.slice(0, rowLimit - 4)}...` : con)
  add('c-skl', labels.skl[loc], grouped(c!.skl ?? [], personalSkills, skillGroups, locale))
  const { quote } = capabilityScope(build)
  add('c-quote', labels.quote[loc], names(quote, capabilities, locale))
  return rows
}

// ------------------------------------------------------------ the HQ brief

// `brief.capabilities` (docs/builder-v2.md «brief v5»): ids only, each key a list. `quote` = capability ids the
// picked products do not provide (priced by estimate, never by a number here). `content` maps format -> frequency.
export function capabilitiesBrief(build: Build): Record<string, unknown> | null {
  const c = build.catalog
  if (catalogEmpty(c)) return null
  const out: Record<string, unknown> = {}
  if (c!.sub?.length) out.subniche = c!.sub
  if (c!.res?.length) out.results = c!.res
  if (c!.cap?.length) out.abilities = c!.cap
  const { quote } = capabilityScope(build)
  if (quote.length) out.quote = quote
  if (c!.chn?.length) out.channels = c!.chn
  if (c!.int?.length) out.integrations = c!.int
  if (c!.con && Object.keys(c!.con).length) out.content = c!.con
  if (c!.skl?.length) out.skills = c!.skl
  return out
}
