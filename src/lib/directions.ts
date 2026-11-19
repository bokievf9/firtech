import type { LeadService } from './site'

// Card ids of the showcase (the seven products plus two old ones). Prices are never kept here: they
// come from pricing.ts. The id is also the lead `source`.
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
