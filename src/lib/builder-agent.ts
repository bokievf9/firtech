import type { Build } from './builder'
import {
  agentAddonIds,
  agentChannelIds,
  agentConnectIds,
  agentVolumeIds,
  standaloneAgentIds,
  type AgentAddonId,
  type AgentChannelId,
  type AgentConnectId,
  type AgentVolumeId,
  type StandaloneAgentId,
} from './agent-ids'
import { agentSubscriptionOf, defaultPricing, teamSubscription, type Pricing } from './pricing'

// «Один агент» in «Сборка проекта» (builder v6): one agent as a product, and agents added as lines to any build.
// Pure and tested (tests/builder-agent.test.mjs). The link chunk is `a.<ids>.<channels>.<connect>.<volume>.<flags>`:
// agent ids joined by `_` (they carry hyphens), the other lists by `-`, `_` = nothing picked; flags are `path` (the agent
// path of the builder, as opposed to agents added to another build), `knowledge` and `training`. Prices only from Pricing.

export type AgentBrief = {
  channels?: AgentChannelId[]
  connect?: AgentConnectId[]
  volume?: AgentVolumeId
  knowledge?: boolean
  training?: boolean
}

export const agentLimit = 6

const known = <T extends string>(list: string, ids: readonly T[], sep: string): T[] => [
  ...new Set(list.split(sep).filter((x): x is T => (ids as readonly string[]).includes(x))),
]

export const isAgentPath = (build: Build) => Boolean(build.agentBrief) && !build.personal

export function agentChunk(build: Build): string {
  const agents = build.agents ?? []
  const brief = build.agentBrief
  if (!agents.length && !brief) return ''
  const flags = [...(brief ? ['path'] : []), ...(brief?.knowledge ? ['knowledge'] : []), ...(brief?.training ? ['training'] : [])]
  const f = (list: readonly string[] | undefined) => (list?.length ? list.join('-') : '_')
  return ['a', agents.length ? agents.join('_') : '_', f(brief?.channels), f(brief?.connect), brief?.volume ?? '_', f(flags)].join('.')
}

// Reads the fields of an `a.` chunk (already split on dots) into the build.
export function readAgentChunk(build: Build, fields: string[]): void {
  const [ids = '', channels = '', connect = '', volume = '', flags = ''] = fields
  const agents = known(ids, standaloneAgentIds, '_').slice(0, agentLimit)
  if (agents.length) build.agents = agents
  const flagList = flags.split('-')
  if (flagList.includes('path')) {
    const brief: AgentBrief = {}
    const ch = known(channels, agentChannelIds, '-')
    if (ch.length) brief.channels = ch
    const co = known(connect, agentConnectIds, '-')
    if (co.length) brief.connect = co
    if ((agentVolumeIds as readonly string[]).includes(volume)) brief.volume = volume as AgentVolumeId
    if (flagList.includes('knowledge')) brief.knowledge = true
    if (flagList.includes('training')) brief.training = true
    build.agentBrief = brief
  }
}

// ---------------------------------------------------------------- build helpers

export function startAgent(build: Build, first?: StandaloneAgentId): Build {
  return { parts: {}, extras: [], ...(build.discovery ? { discovery: build.discovery } : {}), agentBrief: {}, ...(first ? { agents: [first] } : {}) }
}

// Back to the business path: the agent chunks leave, the discovery answers stay.
export function stopAgent(build: Build): Build {
  return { parts: {}, extras: [], ...(build.discovery ? { discovery: build.discovery } : {}) }
}

// A build that is the agent path and nothing else: business chunks that rode along from an old link are dropped.
export function agentOnly(build: Build): Build {
  if (!isAgentPath(build)) return build
  return {
    parts: {},
    extras: [],
    agentBrief: build.agentBrief,
    ...(build.agents?.length ? { agents: build.agents } : {}),
    ...(build.discovery ? { discovery: build.discovery } : {}),
  }
}

export function withAgentBrief(build: Build, patch: Partial<AgentBrief>): Build {
  const brief: AgentBrief = { ...build.agentBrief, ...patch }
  for (const key of Object.keys(brief) as (keyof AgentBrief)[]) {
    const v = brief[key]
    if (v === undefined || v === false || (Array.isArray(v) && !v.length)) delete brief[key]
  }
  return { ...build, agentBrief: brief }
}

// Picks the one agent of the agent path (single choice).
export function chooseAgent(build: Build, id: StandaloneAgentId): Build {
  return { ...build, agents: [id] }
}

// Adds or removes an agent line (any build). At most `agentLimit`; the first stays the main one.
export function toggleAgent(build: Build, id: StandaloneAgentId): Build {
  const now = build.agents ?? []
  const agents = now.includes(id) ? now.filter((x) => x !== id) : now.length >= agentLimit ? now : [...now, id]
  const next: Build = { ...build, agents }
  if (!agents.length) delete next.agents
  return next
}

export type AgentIssue = 'agent' | 'where' | 'volume'
// What blocks «Дальше» on a screen of the agent path (0-based: agent, where, connect, volume, extras, estimate).
export function agentIssues(build: Build, step: number): AgentIssue[] {
  if (step === 0) return build.agents?.length ? [] : ['agent']
  if (step === 1) return build.agentBrief?.channels?.length ? [] : ['where']
  if (step === 3) return build.agentBrief?.volume ? [] : ['volume']
  return []
}
export const agentStepCount = 6
export const agentLastStep = agentStepCount - 1
// Every screen before `step` is done, so the visitor may jump there.
export const agentReachable = (build: Build, step: number) =>
  step === 0 || Array.from({ length: step }, (_, i) => i).every((i) => agentIssues(build, i).length === 0)
export const agentReady = (build: Build) => agentReachable(build, agentLastStep)

// ----------------------------------------------------------------------- prices

// The two paid options have their own prices in pricing.ts (`agentAddons`, owner 2026-11-24).
export function agentAddonPrices(pricing: Pricing = defaultPricing): Record<AgentAddonId, number> {
  return { knowledge: pricing.agentAddons?.knowledge ?? 0, training: pricing.agentAddons?.training ?? 0 }
}

export type AgentQuote = {
  count: number
  // One agent's own subscription, before the team discount.
  unit: { setup: number; monthly: number }
  // The subscription of all agents (the team formula from two agents).
  setup: number
  monthly: number
  discountPercent: number
  addons: { id: AgentAddonId; price: number }[]
  // Setup and paid options: what the one-time payment is.
  oneTime: number
}

export function agentQuote(build: Build, pricing: Pricing = defaultPricing): AgentQuote | null {
  const count = build.agents?.length ?? 0
  if (!count) return null
  const unit = agentSubscriptionOf(pricing)
  const sub = count >= 2 ? teamSubscription(count, pricing) : unit
  const prices = agentAddonPrices(pricing)
  const addons = agentAddonIds.filter((id) => build.agentBrief?.[id]).map((id) => ({ id, price: prices[id] }))
  const oneTime = sub.setup + addons.reduce((sum, a) => sum + a.price, 0)
  return {
    count,
    unit: { setup: unit.setup, monthly: unit.monthly },
    setup: sub.setup,
    monthly: sub.monthly,
    discountPercent: count >= 2 ? pricing.teamDiscount : 0,
    addons,
    oneTime,
  }
}
