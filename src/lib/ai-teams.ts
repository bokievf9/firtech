import type { Dict } from '@/content'
import type { Locale } from './i18n'
import { productBuild } from './products'
import { encodeBuild } from './builder'
import { agentSubscriptionOf, defaultPricing, teamSubscription, type Pricing, type Subscription, type TeamSubscription } from './pricing'

// «Отдел из ИИ-агентов» (owner decision 2026-11-21): each department of the Fir Tech agent company
// (COMPANY.md) can be bought as a product for the client's own business, one by one or as the whole
// company. Pages come first; delivery (a separate HQ instance on the client's bots and keys) comes
// later. Prices are NOT set: the pages say «по смете» and never carry a number (pricing.ts is not
// touched). All visible text lives in `dict.aiTeams` (ru.ts / en.ts); this module holds the ids,
// the department colours, links and meta.

export const aiTeamIds = ['marketing', 'sales', 'support', 'production', 'backoffice', 'company'] as const
export type AiTeamId = (typeof aiTeamIds)[number]

export function isAiTeamId(value: string): value is AiTeamId {
  return (aiTeamIds as readonly string[]).includes(value)
}

// How much an agent does alone (COMPANY.md, trust levels): `propose` = prepares, the owner presses
// the button; `auto` = acts and reports; `both` = acts on routine, money/prices/contracts stay with
// the owner.
export const trustLevels = ['propose', 'auto', 'both'] as const
export type AiTeamTrust = (typeof trustLevels)[number]

// Department colour tokens (globals.css). Literal class names so Tailwind sees them.
export const aiTeamAccent: Record<AiTeamId, { soft: string; text: string; fill: string; border: string }> = {
  marketing: { soft: 'bg-dept-marketing-soft', text: 'text-dept-marketing-text', fill: 'bg-dept-marketing', border: 'border-dept-marketing/40' },
  sales: { soft: 'bg-dept-sales-soft', text: 'text-dept-sales-text', fill: 'bg-dept-sales', border: 'border-dept-sales/40' },
  support: { soft: 'bg-dept-support-soft', text: 'text-dept-support-text', fill: 'bg-dept-support', border: 'border-dept-support/40' },
  production: { soft: 'bg-dept-production-soft', text: 'text-dept-production-text', fill: 'bg-dept-production', border: 'border-dept-production/40' },
  backoffice: { soft: 'bg-dept-backoffice-soft', text: 'text-dept-backoffice-text', fill: 'bg-dept-backoffice', border: 'border-dept-backoffice/40' },
  company: { soft: 'bg-dept-company-soft', text: 'text-dept-company-text', fill: 'bg-dept-company', border: 'border-dept-company/40' },
}

export type AiTeamCopy = Dict['aiTeams']['items'][AiTeamId]

export function aiTeamCopy(id: AiTeamId, dict: Dict): AiTeamCopy {
  return dict.aiTeams.items[id]
}

export const aiTeamsPath = '/ai-team'
export const aiTeamPath = (id: AiTeamId) => `${aiTeamsPath}/${id}`

// The builder opens with the AI company picked and this team as its option (`p.company`, `f.company.<team>`); the whole
// company opens with the defaults. The removed «ИИ-отдел под ключ» product no longer exists (owner 2026-11-22).
export function aiTeamBuilderHref(locale: Locale | string, team: AiTeamId = 'company') {
  const build = productBuild('company')
  const withTeam = team === 'company' ? build : { ...build, options: { company: [team, 'pult', 'knowledge', 'training'] } }
  return `/${locale}/builder?b=${encodeBuild(withTeam)}`
}

// Every page of this section, for the sitemap (and tests).
export const aiTeamPaths = [aiTeamsPath, ...aiTeamIds.map(aiTeamPath)]

// Every sellable role as a product of its own (owner 2026-11-21: «каждого агента мы можем продавать по
// отдельности»). Roles follow COMPANY.md; only what Fir Tech runs today. `standalone: false` means the
// agent is sold only together with at least one department (the Director). `worksWith` lists the agents
// it normally gets work from or hands work to; the sentence about it is `worksNote` in the copy. All
// visible text is `dict.aiTeams.agents.items[id]`. Prices stay «по смете» (never typed here).
export type AgentOffer = {
  id: string
  dept: AiTeamId
  trust: AiTeamTrust
  standalone: boolean
  worksWith: readonly string[]
}

export const agentOffers = [
  { id: 'trend-scout', dept: 'marketing', trust: 'auto', standalone: true, worksWith: ['content-maker'] },
  { id: 'content-maker', dept: 'marketing', trust: 'propose', standalone: true, worksWith: ['trend-scout', 'publisher'] },
  { id: 'publisher', dept: 'marketing', trust: 'propose', standalone: true, worksWith: ['content-maker'] },
  { id: 'analyst', dept: 'marketing', trust: 'auto', standalone: true, worksWith: ['publisher', 'lead-handler'] },
  { id: 'seo', dept: 'marketing', trust: 'propose', standalone: true, worksWith: ['content-maker'] },
  { id: 'lead-handler', dept: 'sales', trust: 'both', standalone: true, worksWith: ['presales'] },
  { id: 'prospector', dept: 'sales', trust: 'propose', standalone: true, worksWith: ['lead-handler'] },
  { id: 'presales', dept: 'sales', trust: 'propose', standalone: true, worksWith: ['lead-handler', 'documents'] },
  { id: 'referral', dept: 'sales', trust: 'propose', standalone: true, worksWith: ['lead-handler'] },
  { id: 'support', dept: 'support', trust: 'propose', standalone: true, worksWith: ['knowledge-base'] },
  { id: 'monitoring', dept: 'support', trust: 'auto', standalone: true, worksWith: [] },
  { id: 'billing', dept: 'support', trust: 'propose', standalone: true, worksWith: ['documents'] },
  { id: 'onboarding', dept: 'support', trust: 'propose', standalone: true, worksWith: ['project-manager', 'support'] },
  { id: 'project-manager', dept: 'production', trust: 'propose', standalone: true, worksWith: ['reviewer-qa', 'onboarding'] },
  { id: 'reviewer-qa', dept: 'production', trust: 'propose', standalone: true, worksWith: ['project-manager'] },
  { id: 'deployer', dept: 'production', trust: 'propose', standalone: true, worksWith: ['reviewer-qa', 'monitoring'] },
  { id: 'documents', dept: 'backoffice', trust: 'propose', standalone: true, worksWith: ['presales', 'billing'] },
  { id: 'knowledge-base', dept: 'backoffice', trust: 'auto', standalone: true, worksWith: ['support', 'documents'] },
  { id: 'director', dept: 'company', trust: 'auto', standalone: false, worksWith: [] },
] as const satisfies readonly AgentOffer[]

export type AgentId = (typeof agentOffers)[number]['id']
export const agentIds = agentOffers.map((a) => a.id) as AgentId[]

export function isAgentId(value: string): value is AgentId {
  return (agentIds as string[]).includes(value)
}

export function agentOffer(id: AgentId): (typeof agentOffers)[number] {
  return agentOffers.find((a) => a.id === id)!
}

export function agentsOfDept(dept: AiTeamId): (typeof agentOffers)[number][] {
  return agentOffers.filter((a) => a.dept === dept)
}

export type AgentCopy = Dict['aiTeams']['agents']['items'][AgentId]

export function agentCopy(id: AgentId, dict: Dict): AgentCopy {
  return dict.aiTeams.agents.items[id]
}

export const agentsAnchor = '#agents'
export const agentPath = (id: AgentId) => `${aiTeamsPath}/agent/${id}`
export const agentPaths = agentIds.map(agentPath)
// The contact form `source` for a lead that started on an agent page: a free slug (lead.ts allows
// [a-z0-9_-], 40 characters), so the owner sees which agent the lead asked about.
export const agentSource = (id: AgentId) => `agent-${id}`.slice(0, 40)

export const allAiTeamPaths = [...aiTeamPaths, ...agentPaths]

// Prices of the subscription model (owner 2026-11-22), all from the live pricing: a team is the sum of its agents
// minus the team discount, an agent has its own subscription. The `company` team is the AI company product and has no
// agent sum (`null`).
export function teamPrice(id: AiTeamId, pricing: Pricing = defaultPricing): TeamSubscription | null {
  if (id === 'company') return null
  return teamSubscription(agentsOfDept(id).length, pricing)
}

// One agent's subscription, or `null` for the Director, who is only sold with a team.
export function agentPrice(id: AgentId, pricing: Pricing = defaultPricing): Subscription | null {
  return agentOffer(id).standalone ? agentSubscriptionOf(pricing) : null
}
