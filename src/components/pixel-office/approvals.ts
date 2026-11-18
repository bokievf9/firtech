// Approvals carried to the Director and the little reactions to what happened (Office v2).
// `scene.approvalsByAgent` says how many papers of each agent wait on the Director's desk; when a
// count grows the agent walks a paper up, when the owner approves the agent fetches it back with
// a ✅. `scene.reactions` (newest last) are played once each. Pure module, covered by
// tests/pixel-office.test.mjs ("approvals stack and reactions").

import type { OfficeReaction, ReactionKind } from '@/lib/office-view'
import { buildersSpot, type Desk, directorDropX, type Layout, standX } from './layout'
import type { Pose } from './life'

export const STACK_CAP = 8
// Reactions older than this when first seen are history, not news: they are not played.
export const REACTION_WINDOW_MS = 60_000

// Papers waiting on the Director's desk: the per-agent block when HQ sends it, else the old
// director.pendingApprovals number.
export function approvalsTotal(byAgent: Readonly<Record<string, number>> | undefined, fallback: number): number {
  if (byAgent && Object.keys(byAgent).length) return Object.values(byAgent).reduce((s, n) => s + Math.max(0, Math.floor(n) || 0), 0)
  return Math.max(0, Math.floor(fallback) || 0)
}

export type ApprovalDiff = { agent: string; delta: number }

// Per-agent change between two snapshots (null before = first load, nothing to animate).
export function diffApprovals(
  prev: Readonly<Record<string, number>> | null,
  next: Readonly<Record<string, number>>,
): ApprovalDiff[] {
  if (!prev) return []
  const ids = [...new Set([...Object.keys(prev), ...Object.keys(next)])].sort()
  return ids.map((agent) => ({ agent, delta: (next[agent] ?? 0) - (prev[agent] ?? 0) })).filter((d) => d.delta !== 0)
}

// What the desk shows while papers are on their way: the data total minus papers still being
// carried up, plus approved papers not yet fetched. Capped for drawing.
export function visibleStack(total: number, carrying: number, fetching: number): number {
  return Math.min(STACK_CAP, Math.max(0, total - carrying + fetching))
}

export type Icon = 'check' | 'mail' | 'thumb'
export type Effect = 'confetti' | 'crumple' | 'cloud'
export type ErrandKind = 'deliver' | 'fetch' | 'box'

export type ReactionPlan = {
  errand: ErrandKind | null
  icon: Icon | null
  effect: Effect | null
  // How long the icon or effect stays up.
  ms: number
}

export function reactionPlan(kind: ReactionKind): ReactionPlan {
  switch (kind) {
    case 'approved':
      return { errand: 'fetch', icon: 'check', effect: null, ms: 4000 }
    case 'rejected':
      return { errand: null, icon: null, effect: 'crumple', ms: 2600 }
    case 'published':
      return { errand: null, icon: null, effect: 'confetti', ms: 3200 }
    case 'blocked':
      return { errand: null, icon: null, effect: 'cloud', ms: 8000 }
    case 'issue_closed':
      return { errand: 'box', icon: null, effect: null, ms: 0 }
    case 'lead':
      return { errand: null, icon: 'mail', effect: null, ms: 6000 }
    case 'done':
      return { errand: null, icon: 'thumb', effect: null, ms: 2500 }
  }
}

export const reactionKey = (r: OfficeReaction) => `${r.agent}|${r.kind}|${r.at}`

// Reactions not played yet that are recent enough to be news; marks them as played. Keys no
// longer in the list are forgotten (HQ keeps 10 minutes, so nothing comes back).
export function freshReactions(reactions: readonly OfficeReaction[], seen: Set<string>, now: number): OfficeReaction[] {
  const keys = new Set(reactions.map(reactionKey))
  for (const k of [...seen]) if (!keys.has(k)) seen.delete(k)
  const out: OfficeReaction[] = []
  for (const r of reactions) {
    const key = reactionKey(r)
    if (seen.has(key)) continue
    seen.add(key)
    const at = Date.parse(r.at)
    if (Number.isNaN(at) || now - at > REACTION_WINDOW_MS || at - now > REACTION_WINDOW_MS) continue
    out.push(r)
  }
  return out
}

export type Carry = 'paper' | 'box' | 'folder' | null

export type ErrandStep = {
  floor: number
  x: number
  pose: Pose
  facing: 1 | -1
  // Time to stay once there, then the next step.
  holdMs: number
  // What the person holds on the way to this step and while there.
  carry: Carry
  icon: Icon | null
  // On arrival: put a paper on the desk, or pick one up.
  arrive: 'drop' | 'pick' | null
}

// The walks of an errand. After the last step the person goes back to whatever the status says.
export function errandSteps(kind: ErrandKind, own: Desk, director: Desk | undefined, layout: Layout, index = 0): ErrandStep[] {
  const home = { floor: own.floor, x: standX(own), facing: -1 as const }
  const drop = director ? { floor: director.floor, x: directorDropX(director) + (index % 3) * 4, facing: -1 as const } : null
  switch (kind) {
    case 'deliver':
      return drop ? [{ ...drop, pose: 'hand', holdMs: 1400, carry: 'paper', icon: null, arrive: 'drop' }] : []
    case 'fetch':
      return drop
        ? [
            { ...drop, pose: 'hand', holdMs: 1000, carry: null, icon: null, arrive: 'pick' },
            { ...home, pose: 'stand', holdMs: 2500, carry: 'paper', icon: 'check', arrive: null },
          ]
        : []
    case 'box': {
      const b = buildersSpot(layout, index)
      return [
        { floor: b.floor, x: b.x, facing: -1, pose: 'stand', holdMs: 900, carry: null, icon: null, arrive: null },
        { ...home, pose: 'stand', holdMs: 1800, carry: 'box', icon: null, arrive: null },
      ]
    }
  }
}

// An errand never runs longer than this, whatever happens on the way.
export const ERRAND_MAX_MS = 90_000
