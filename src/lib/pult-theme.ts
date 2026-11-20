import { PANELS, type PanelId } from '@/lib/pult'

// Department colours of the owner panel (docs/pult.md, «Темы и цвета отделов»). The hues live in
// globals.css as --color-dept-<id>, -soft and -text (both theme blocks). This file only names them:
// class strings are written out in full so Tailwind finds them.
export type DeptTheme = {
  id: PanelId
  /** CSS variable names, e.g. `--color-dept-sales`. */
  vars: { fill: string; soft: string; text: string }
  /** The same as `var(...)` values for inline style or canvas code. */
  css: { fill: string; soft: string; text: string }
  /** Tailwind classes: solid stripe/dot/underline, tinted surface, tinted text, tinted border. */
  cls: { bg: string; soft: string; text: string; border: string; chip: string }
}

const CLS: Record<PanelId, DeptTheme['cls']> = {
  director: { bg: 'bg-dept-director', soft: 'bg-dept-director-soft', text: 'text-dept-director-text', border: 'border-dept-director', chip: 'bg-dept-director-soft text-dept-director-text' },
  marketing: { bg: 'bg-dept-marketing', soft: 'bg-dept-marketing-soft', text: 'text-dept-marketing-text', border: 'border-dept-marketing', chip: 'bg-dept-marketing-soft text-dept-marketing-text' },
  sales: { bg: 'bg-dept-sales', soft: 'bg-dept-sales-soft', text: 'text-dept-sales-text', border: 'border-dept-sales', chip: 'bg-dept-sales-soft text-dept-sales-text' },
  support: { bg: 'bg-dept-support', soft: 'bg-dept-support-soft', text: 'text-dept-support-text', border: 'border-dept-support', chip: 'bg-dept-support-soft text-dept-support-text' },
  production: { bg: 'bg-dept-production', soft: 'bg-dept-production-soft', text: 'text-dept-production-text', border: 'border-dept-production', chip: 'bg-dept-production-soft text-dept-production-text' },
  backoffice: { bg: 'bg-dept-backoffice', soft: 'bg-dept-backoffice-soft', text: 'text-dept-backoffice-text', border: 'border-dept-backoffice', chip: 'bg-dept-backoffice-soft text-dept-backoffice-text' },
  company: { bg: 'bg-dept-company', soft: 'bg-dept-company-soft', text: 'text-dept-company-text', border: 'border-dept-company', chip: 'bg-dept-company-soft text-dept-company-text' },
}

export function deptTheme(id: PanelId): DeptTheme {
  const name = `--color-dept-${id}`
  return {
    id,
    vars: { fill: name, soft: `${name}-soft`, text: `${name}-text` },
    css: { fill: `var(${name})`, soft: `var(${name}-soft)`, text: `var(${name}-text)` },
    cls: CLS[id],
  }
}

// HQ names departments freely (`sales`, `Marketing`, `back-office`, `ceo`...): the panel colour for
// a raw name, or null when it is not one of ours (the row stays neutral).
const ALIASES: Record<string, PanelId> = { ceo: 'director', owner: 'director', backoffice: 'backoffice', office: 'backoffice', builders: 'production', builder: 'production', hq: 'company' }
export function deptOf(raw: unknown): PanelId | null {
  if (typeof raw !== 'string') return null
  const k = raw.toLowerCase().replace(/[^a-z]/g, '')
  if ((PANELS as readonly string[]).includes(k)) return k as PanelId
  return ALIASES[k] ?? null
}
