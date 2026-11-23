import type { AiTeamId } from './ai-teams'

// Builder depth for the agent path (2026-11-24): after the three questions, a screen of department questions as chips
// plus the visitor's own words. The registry is ids only; labels live in `content/builder-depth.ts`. Ids are only ever
// appended. The answers travel in the agent chunk (`brief.deep`, `brief.note`) and in the lead brief.

export const noteLimit = 500
// The free text «Своими словами»: control characters, angle brackets and runs of spaces go, at most `noteLimit`.
export const cleanNote = (text: string) =>
  text.replace(/[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, noteLimit)
// While typing: keeps single spaces (so a trailing space is not eaten), nothing else changes.
export const typingNote = (text: string) => text.replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]+/g, ' ').replace(/\n/g, ' ').slice(0, noteLimit)
export type DepthQuestion = { id: string; single?: boolean; options: readonly string[] }

const lang = ['ru', 'tj', 'en', 'uz', 'kz', 'other'] as const
const hours = ['h9', 'hlate', 'h24', 'hshift', 'hweekend', 'hflex'] as const

export const depthQuestions: Record<AiTeamId, readonly DepthQuestion[]> = {
  sales: [
    { id: 'sl-src', options: ['instagram', 'telegram', 'whatsapp', 'site', 'ads', 'referral', 'calls', 'other'] },
    { id: 'sl-crm', options: ['none', 'sheets', 'amocrm', 'bitrix', 'hubspot', 'onec', 'other'] },
    { id: 'sl-resp', single: true, options: ['instant', 'm5', 'h1', 'workday', 'nextday'] },
    { id: 'sl-lang', options: lang },
    { id: 'sl-hours', single: true, options: hours },
  ],
  support: [
    { id: 'su-vol', single: true, options: ['t10', 't50', 't200', 't1000', 't1000p'] },
    { id: 'su-chan', options: ['telegram', 'whatsapp', 'email', 'web', 'phone', 'instagram', 'other'] },
    { id: 'su-sla', single: true, options: ['instant', 'm5', 'h1', 'workday', 'nextday'] },
    { id: 'su-kb', options: ['site', 'docs', 'faq', 'chats', 'crm', 'nothing', 'other'] },
    { id: 'su-lang', options: lang },
  ],
  marketing: [
    { id: 'mk-plat', options: ['instagram', 'telegram', 'tiktok', 'youtube', 'linkedin', 'vk', 'blog', 'other'] },
    { id: 'mk-cad', single: true, options: ['daily', 'w3', 'weekly', 'rare', 'unsure'] },
    { id: 'mk-tone', options: ['friendly', 'expert', 'strict', 'playful', 'premium', 'youth'] },
    { id: 'mk-brand', options: ['logo', 'palette', 'fonts', 'photos', 'guide', 'none'] },
    { id: 'mk-lang', options: lang },
  ],
  production: [
    { id: 'pr-type', options: ['web', 'apps', 'design', 'video', 'print', 'services', 'other'] },
    { id: 'pr-tools', options: ['trello', 'notion', 'jira', 'figma', 'sheets', 'telegram', 'other'] },
    { id: 'pr-rep', options: ['daily', 'weekly', 'dashboard', 'telegram', 'none'] },
    { id: 'pr-hours', single: true, options: hours },
  ],
  backoffice: [
    { id: 'bo-docs', options: ['invoices', 'contracts', 'acts', 'payroll', 'reports', 'hr', 'other'] },
    { id: 'bo-inv', options: ['onec', 'excel', 'sheets', 'bank', 'stripe', 'none', 'other'] },
    { id: 'bo-appr', options: ['owner', 'accountant', 'manager', 'smallauto', 'chain'] },
    { id: 'bo-lang', options: lang },
  ],
  company: [
    { id: 'co-lang', options: lang },
    { id: 'co-hours', single: true, options: hours },
    { id: 'co-tools', options: ['sheets', 'crm', 'messengers', 'email', 'docs', 'other'] },
  ],
}

// All questions by id, for decoding (the department of the build does not matter for validation).
export const depthById: Record<string, DepthQuestion> = Object.fromEntries(
  Object.values(depthQuestions).flat().map((q) => [q.id, q]),
)
export const depthLimit = 600

export type Deep = Record<string, string[]>

// Keeps known questions and known options only; single questions keep one answer.
export function cleanDeep(raw: unknown): Deep {
  const out: Deep = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const q = depthById[id]
    if (!q || !Array.isArray(value)) continue
    const picked = [...new Set(value.filter((x): x is string => typeof x === 'string' && q.options.includes(x)))]
    if (picked.length) out[id] = q.single ? picked.slice(0, 1) : picked
  }
  return out
}

export const deepCount = (deep: Deep | undefined) => Object.keys(deep ?? {}).length
