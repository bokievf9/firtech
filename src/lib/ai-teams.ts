import type { Dict } from '@/content'
import type { Locale } from './i18n'
import { productBuilderHref } from './products'

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

// The builder opens with the `aiteam` product picked (`p.aiteam`, product `implementation`).
export function aiTeamBuilderHref(locale: Locale | string) {
  return productBuilderHref(locale, 'implementation')
}

// Every page of this section, for the sitemap (and tests).
export const aiTeamPaths = [aiTeamsPath, ...aiTeamIds.map(aiTeamPath)]
