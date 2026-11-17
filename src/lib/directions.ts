import type { LeadService } from './site'

// The eight directions of the showcase plus websites as the ninth card. Prices are USD and live
// only here (proposed 2026-11-18, the owner approves them before publication); card texts are in
// the dictionaries under `directions.items.<id>`. The id is also the lead `source`.
export const directionIds = [
  'admin',
  'receptionist',
  'automation',
  'content',
  'miniapp',
  'agent',
  'implementation',
  'training',
  'site',
] as const
export type DirectionId = (typeof directionIds)[number]

export type DirectionPrice = {
  from: number
  // `month`: the price is a monthly subscription; `person`: the price is per person.
  unit?: 'month' | 'person'
  // Extra price lines: monthly support after launch, and a price for a whole team.
  supportMonthly?: number
  team?: number
}

export const directionPrices: Record<DirectionId, DirectionPrice> = {
  admin: { from: 250 },
  receptionist: { from: 300, supportMonthly: 25 },
  automation: { from: 150 },
  content: { from: 60, unit: 'month' },
  miniapp: { from: 500 },
  agent: { from: 400 },
  implementation: { from: 800 },
  training: { from: 150, unit: 'person', team: 400 },
  site: { from: 150 },
}

// What the contact form preselects for a card (the lead keeps `source` as well).
export const directionService: Record<DirectionId, LeadService | 'unknown'> = {
  admin: 'bots',
  receptionist: 'ai',
  automation: 'automation',
  content: 'unknown',
  miniapp: 'bots',
  agent: 'ai',
  implementation: 'ai',
  training: 'unknown',
  site: 'websites',
}

// Cards that also have a detailed service page.
export const directionPage: Partial<Record<DirectionId, 'websites' | 'bots' | 'automation'>> = {
  admin: 'bots',
  automation: 'automation',
  site: 'websites',
}

export function isDirectionId(value: string): value is DirectionId {
  return (directionIds as readonly string[]).includes(value)
}
