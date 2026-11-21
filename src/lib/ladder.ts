import { agentPath, aiTeamPath, type AgentId, type AiTeamId } from './ai-teams'
import { productPath, type ProductId } from './product-ids'

// Levels instead of duplicates (owner 2026-11-22): every direction has three rungs, drawn as one
// ladder on the products section and on /ai-team. «Один агент» is a single role (or the product that
// is one agent), «На автопилоте» is the next step up, «Целый отдел» is the department. Each rung
// links to its own page. All text is `dict.ladder`.
export const ladderIds = ['content', 'sales', 'support'] as const
export type LadderId = (typeof ladderIds)[number]

export const ladderLevels = ['agent', 'auto', 'dept'] as const
export type LadderLevel = (typeof ladderLevels)[number]

type Target =
  | { kind: 'agent'; id: AgentId }
  | { kind: 'product'; id: ProductId }
  | { kind: 'dept'; id: AiTeamId }

export const ladders: Record<LadderId, Record<LadderLevel, Target>> = {
  content: {
    agent: { kind: 'agent', id: 'content-maker' },
    auto: { kind: 'product', id: 'content' },
    dept: { kind: 'dept', id: 'marketing' },
  },
  sales: {
    agent: { kind: 'product', id: 'receptionist' },
    auto: { kind: 'agent', id: 'prospector' },
    dept: { kind: 'dept', id: 'sales' },
  },
  support: {
    agent: { kind: 'agent', id: 'support' },
    auto: { kind: 'agent', id: 'monitoring' },
    dept: { kind: 'dept', id: 'support' },
  },
}

// The path of a rung, `/<locale>` + this.
export function rungPath(target: Target): string {
  if (target.kind === 'product') return productPath(target.id)
  if (target.kind === 'agent') return agentPath(target.id)
  return aiTeamPath(target.id)
}
