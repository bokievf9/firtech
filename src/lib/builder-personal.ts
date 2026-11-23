import type { Build } from './builder'
import {
  discApprover,
  discBase,
  discHeard,
  discHours,
  discLeads,
  discPains,
  discSizes,
  discSuccess,
  personalChannels,
  personalConnect,
  personalHand,
  personalTiers,
  personalWhoAll,
  type DiscApprover,
  type DiscBase,
  type DiscHeard,
  type DiscHours,
  type DiscLeads,
  type DiscPain,
  type DiscSize,
  type DiscSuccess,
  type PersonalChannel,
  type PersonalConnect,
  type PersonalHand,
  type PersonalTone,
  type PersonalWhoAny,
  toneAxes,
} from './builder-ids'
import { personalServices, type FlagshipProduct } from './builder-ids'
import type { PersonalLevel } from './pricing'
import { capabilitiesBrief, withCatalog } from './builder-capabilities'
import { agentOnly } from './builder-agent'

// «Сборка проекта» v4: the personal path and the discovery fields (owner review 2026-11-22). Pure and tested
// (tests/builder-v2.test.mjs). The personal brief rides in the link as `m.<base64url JSON>`, the discovery
// answers as `v.<base64url JSON>`; both are bounded and unknown ids are dropped on decode.

export type PersonalBrief = {
  who?: PersonalWhoAny
  hand?: PersonalHand[]
  where?: PersonalChannel[]
  connect?: PersonalConnect[]
  tone?: PersonalTone
  tier?: PersonalLevel
  // Own API key (BYOK): the cheaper monthly fee. Chunk key `b` 0|1; absent in old links.
  byok?: boolean
}

export type Discovery = {
  size?: DiscSize
  leads?: DiscLeads
  base?: DiscBase
  hours?: DiscHours
  tz?: string
  approver?: DiscApprover
  site?: string
  instagram?: string
  pains?: DiscPain[]
  success?: DiscSuccess[]
  heard?: DiscHeard
}

export const personalLimit = 900
export const discoveryLimit = 700
export const defaultTone: PersonalTone = [1, 1, 1, 1, 1]

const clean = (text: string, max: number) =>
  text.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, max)
const ids = <T extends string>(v: unknown, known: readonly T[]): T[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => typeof x === 'string' && (known as readonly string[]).includes(x)))] : []
const one = <T extends string>(v: unknown, known: readonly T[]): T | undefined =>
  typeof v === 'string' && (known as readonly string[]).includes(v) ? (v as T) : undefined

// ----------------------------------------------------------------- JSON chunks

export function personalJson(p: PersonalBrief | undefined): string {
  if (!p) return ''
  const o: Record<string, unknown> = {}
  if (p.who) o.w = p.who
  if (p.hand?.length) o.h = p.hand
  if (p.where?.length) o.c = p.where
  if (p.connect?.length) o.k = p.connect
  if (p.tone) o.n = p.tone
  if (p.tier) o.t = p.tier
  if (p.byok !== undefined) o.b = p.byok ? 1 : 0
  // An empty object still means «personal path chosen».
  return JSON.stringify(o).slice(0, personalLimit)
}

export function parsePersonalJson(text: string): PersonalBrief | undefined {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const out: PersonalBrief = {}
  const who = one(o.w, personalWhoAll)
  if (who) out.who = who
  const hand = ids(o.h, personalHand)
  if (hand.length) out.hand = hand
  const where = ids(o.c, personalChannels)
  if (where.length) out.where = where
  const connect = ids(o.k, personalConnect)
  if (connect.length) out.connect = connect
  if (Array.isArray(o.n) && (o.n.length === 3 || o.n.length === toneAxes) && o.n.every((x) => x === 0 || x === 1 || x === 2))
    out.tone = [...(o.n as number[]), ...defaultTone.slice(o.n.length)]
  const tier = one(o.t, personalTiers)
  if (tier) out.tier = tier
  if (o.b === 0 || o.b === 1) out.byok = o.b === 1
  return out
}

export function discoveryJson(d: Discovery | undefined): string {
  if (!d) return ''
  const o: Record<string, unknown> = {}
  if (d.size) o.sz = d.size
  if (d.leads) o.ld = d.leads
  if (d.base) o.kb = d.base
  if (d.hours) o.hr = d.hours
  if (d.tz) o.tz = d.tz
  if (d.approver) o.ap = d.approver
  if (d.site) o.si = d.site
  if (d.instagram) o.ig = d.instagram
  if (d.pains?.length) o.pa = d.pains
  if (d.success?.length) o.su = d.success
  if (d.heard) o.he = d.heard
  if (!Object.keys(o).length) return ''
  let text = JSON.stringify(o)
  // Too long: the free texts first, then the chip lists from the end.
  for (const key of ['si', 'ig', 'tz', 'su', 'pa']) {
    if (text.length <= discoveryLimit) break
    delete o[key]
    text = JSON.stringify(o)
  }
  return text.slice(0, discoveryLimit)
}

const link = (v: unknown) => {
  if (typeof v !== 'string') return undefined
  const value = v.replace(/[\u0000-\u001f\u007f\s]/g, '').slice(0, 100)
  return /^(https?:\/\/)?[@\p{L}\p{N}._-]+([./?#][^\s]*)?$/u.test(value) && value.length >= 3 ? value : undefined
}

export function parseDiscoveryJson(text: string): Discovery | undefined {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const out: Discovery = {}
  const size = one(o.sz, discSizes)
  if (size) out.size = size
  const leads = one(o.ld, discLeads)
  if (leads) out.leads = leads
  const base = one(o.kb, discBase)
  if (base) out.base = base
  const hours = one(o.hr, discHours)
  if (hours) out.hours = hours
  if (typeof o.tz === 'string' && clean(o.tz, 30)) out.tz = clean(o.tz, 30)
  const approver = one(o.ap, discApprover)
  if (approver) out.approver = approver
  const site = link(o.si)
  if (site) out.site = site
  const instagram = link(o.ig)
  if (instagram) out.instagram = instagram
  const pains = ids(o.pa, discPains)
  if (pains.length) out.pains = pains
  const success = ids(o.su, discSuccess)
  if (success.length) out.success = success
  const heard = one(o.he, discHeard)
  if (heard) out.heard = heard
  return Object.keys(out).length ? out : undefined
}

export const cleanLink = link

// ------------------------------------------------------------ build helpers

// Without a tier picked, the level that fits what is handed over (the same rule as the flagship).
export function suggestedTier(p: PersonalBrief | undefined): PersonalLevel {
  const n = p?.hand?.length ?? 0
  return n >= 6 ? 'max' : n >= 3 ? 'plus' : 'basic'
}
// The monthly fee of a tier on our account or on the client's own key; both from `pricing.personalPlans`.
export const monthlyOf = (plan: { monthly: number; byokMonthly?: number }, byok: boolean | undefined) =>
  byok ? plan.byokMonthly ?? plan.monthly : plan.monthly
export const tierOf = (p: PersonalBrief | undefined): PersonalLevel => p?.tier ?? suggestedTier(p)

// What the personal agent hands over becomes the services the flagship price reads (`f.personal.`), so the
// existing price helper stays the one source: the picked tier decides the level (Start: two services,
// Plus: three and the voice, Max: five and the long memory).
const serviceOf: Record<PersonalHand, string> = {
  mail: 'mail', calendar: 'calendar', study: 'study', money: 'tasks', health: 'tasks', languages: 'study', content: 'notes',
  home: 'tasks', docs: 'notes', reminders: 'tasks', calls: 'messengers', search: 'notes',
}
export function flagshipOptionsOf(p: PersonalBrief | undefined): string[] {
  const tier = tierOf(p)
  const wanted = [...new Set([...(p?.hand ?? []).map((h) => serviceOf[h]), ...(p?.connect?.includes('telegram') || p?.connect?.includes('whatsapp') ? ['messengers'] : [])])]
  const pool = (personalServices as readonly string[]).filter((s) => wanted.includes(s))
  const fill = (n: number) => {
    const out = pool.slice(0, n)
    for (const s of personalServices) if (out.length < n && !out.includes(s)) out.push(s)
    return out
  }
  if (tier === 'basic') return fill(2)
  if (tier === 'plus') return [...fill(3), 'voice']
  return [...fill(5), 'memory']
}

// Applies a change to the personal brief and keeps the product and the flagship options in step with it.
export function withPersonal(build: Build, patch: Partial<PersonalBrief>): Build {
  const personal: PersonalBrief = { ...build.personal, ...patch }
  for (const key of Object.keys(personal) as (keyof PersonalBrief)[]) {
    const v = personal[key]
    if (v === undefined || (Array.isArray(v) && key !== 'tone' && !v.length)) delete personal[key]
  }
  return syncPersonal({ ...build, personal })
}

export function syncPersonal(build: Build): Build {
  const personal = build.personal ?? {}
  const options = { ...build.options, personal: flagshipOptionsOf(personal) as string[] }
  return { ...build, personal, products: ['personal'], options: options as Build['options'] }
}

export function startPersonal(build: Build): Build {
  const next: Build = { parts: {}, extras: [], ...(build.discovery ? { discovery: build.discovery } : {}) }
  // Only the personal skills of the catalogue belong to this path.
  const skl = build.catalog?.skl
  return syncPersonal({ ...(skl?.length ? withCatalog(next, { skl }) : next), personal: {} })
}

// Back to the business path: every personal chunk and every business chunk goes, only the discovery answers
// (shared by both paths) stay. The two paths never carry each other's state.
export function stopPersonal(build: Build): Build {
  return { parts: {}, extras: [], ...(build.discovery ? { discovery: build.discovery } : {}) }
}

// The personal path as it is: the brief, its flagship options and the shared discovery. Any business chunk
// (kind, products, parts, goals, channels, style, details, delivery, site) that rode along from an earlier
// build or an old link is dropped, so a personal lead and its estimate never name a niche or a product.
export function personalOnly(build: Build): Build {
  if (!build.personal) return build
  const skl = build.catalog?.skl
  const base: Build = { parts: {}, extras: [], personal: build.personal, ...(build.discovery ? { discovery: build.discovery } : {}) }
  // The personal skills of the catalogue are part of the personal brief; business picks are dropped.
  return syncPersonal(skl?.length ? withCatalog(base, { skl }) : base)
}

export function withDiscovery(build: Build, patch: Partial<Discovery>): Build {
  const discovery: Discovery = { ...build.discovery, ...patch }
  for (const key of Object.keys(discovery) as (keyof Discovery)[]) {
    const v = discovery[key]
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete discovery[key]
  }
  const next: Build = { ...build, discovery }
  if (!Object.keys(discovery).length) delete next.discovery
  return next
}

export type PersonalIssue = 'who' | 'hand' | 'where'
// What blocks «Дальше» on a personal screen (0-based: who, hand over, where, connect, character, tier, about, day).
export function personalIssues(build: Build, step: number): PersonalIssue[] {
  const p = build.personal ?? {}
  if (step === 0) return p.who ? [] : ['who']
  if (step === 1) return p.hand?.length ? [] : ['hand']
  if (step === 2) return p.where?.length ? [] : ['where']
  return []
}
export const personalReady = (build: Build) => personalIssues(build, 0).length + personalIssues(build, 1).length + personalIssues(build, 2).length === 0

// ------------------------------------------------------------- the lead brief

export type LeadBrief = Record<string, unknown>

// The `brief` object of the lead JSON for HQ (documented in docs/builder-v2.md «brief v4 contract»): ids only,
// short keys, at most `leadBriefLimit` characters. HQ's `webLeadSchema` is not strict, so it ignores or reads it.
export const leadBriefLimit = 3500
export function leadBriefOf(source: Build): LeadBrief | null {
  const build = agentOnly(personalOnly(source))
  const out: LeadBrief = { v: 1 }
  if (build.agentBrief) {
    // The agent path (builder v6): the agent id (the first one), all agent ids, the channels, what to connect, the volume and options.
    out.type = 'agent'
    if (build.agents?.length) {
      out.agent = build.agents[0]
      out.agents = build.agents
    }
    const a = build.agentBrief
    if (a.channels?.length) out.channels = a.channels
    if (a.connect?.length) out.connect = a.connect
    if (a.volume) out.volume = a.volume
    if (a.knowledge) out.knowledge = true
    if (a.training) out.training = true
  } else if (build.personal) {
    out.type = 'personal'
    const p = build.personal
    if (p.who) out.who = p.who
    if (p.hand?.length) out.hand = p.hand
    if (p.where?.length) out.where = p.where
    if (p.connect?.length) out.connect = p.connect
    if (p.tone) out.tone = { formality: p.tone[0], brevity: p.tone[1], initiative: p.tone[2], humor: p.tone[3] ?? 1, firmness: p.tone[4] ?? 1 }
    out.tier = tierOf(p)
    out.byok = p.byok === true
  } else {
    out.type = 'business'
    if (build.agents?.length) out.agents = build.agents
    if (build.kind) out.niche = build.kind
    if (build.products?.length) out.products = build.products
    if (build.goals?.length) out.goals = build.goals
    if (build.channels?.length) out.sources = build.channels
    if (build.delivery?.length) out.delivery = build.delivery
    if (build.siteNeed) out.siteNeed = build.siteNeed
    if (build.style?.themeId) out.theme = build.style.themeId
    const d = build.details ?? {}
    const details: Record<string, unknown> = {}
    for (const key of ['company', 'clients', 'clientTypes', 'sources', 'after', 'tools', 'owner', 'fears', 'budget', 'deadline', 'langs', 'has'] as const) {
      const v = d[key]
      if (v !== undefined && !(Array.isArray(v) && !v.length) && v !== '') details[key] = v
    }
    if (Object.keys(details).length) out.details = details
  }
  if (build.discovery) out.discovery = build.discovery
  // v5: the catalogue picks (ids only). Too long for the limit: the catalogue goes first, the rest stays.
  const caps = capabilitiesBrief(build)
  if (caps) out.capabilities = caps
  if (Object.keys(out).length <= 2) return null
  if (JSON.stringify(out).length > leadBriefLimit && caps) {
    delete out.capabilities
    for (const key of ['content', 'integrations', 'channels', 'skills', 'results', 'abilities', 'quote']) {
      if (JSON.stringify({ ...out, capabilities: caps }).length <= leadBriefLimit) break
      delete caps[key]
    }
    if (Object.keys(caps).length) out.capabilities = caps
  }
  return JSON.stringify(out).length <= leadBriefLimit ? out : null
}

// ---------------------------------------------------------------- the day

export type DayRow = { time: string; hand: PersonalHand | 'start' | 'end' }
const timeOf: Record<PersonalHand, string> = {
  reminders: '08:00', mail: '08:30', calendar: '09:00', study: '10:00', calls: '12:00', money: '13:00', docs: '14:00',
  search: '15:00', content: '16:00', home: '17:30', health: '19:00', languages: '20:30',
}
// The «ваш день с ИИ» timeline: a morning brief, one row per handed-over area in the order of the day (at most
// six), an evening wrap-up. Generated from the choices, nothing invented about the person.
export function dayTimeline(p: PersonalBrief | undefined): DayRow[] {
  const rows: DayRow[] = (p?.hand ?? []).map((hand) => ({ time: timeOf[hand], hand }))
  rows.sort((a, b) => a.time.localeCompare(b.time))
  return [{ time: '07:30', hand: 'start' }, ...rows.slice(0, 6), { time: '21:30', hand: 'end' }]
}
export type { FlagshipProduct }
