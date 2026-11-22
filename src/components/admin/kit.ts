import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// `cn` from '@/lib/cn' does not know the v4 text steps (`text-callout`, `text-footnote`, `text-caption`...) and drops
// them next to a text colour (`text-muted`), so Shell code merges classes with `cn` below, which does.
const merge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['display', 'title', 'title-2', 'title-3', 'lead', 'headline', 'body', 'callout', 'footnote', 'caption'] }] } },
})
export const cn = (...inputs: ClassValue[]) => merge(clsx(inputs))

// Shell class kit on design system v4 (docs/design-system-v4.md, docs/shell-design-audit.md): one look for
// the small controls every Shell panel uses. Pure strings, no hooks, so server and client files import it.
// Rules: pills for controls, 12 px fields, lime only as the fill of THE primary action, quiet selection
// (elevated pill + hairline), press feedback on pointer-down (`pressable`), hover only on a real pointer.

// Round icon-only button of the bar and the rows (36 px; the hit area is padded by the parent gap).
export const iconBtn =
  'pressable inline-grid size-9 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-fill-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-text disabled:pointer-events-none disabled:opacity-50'

export const btn =
  'pressable inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-line-strong px-4 text-sm text-fg outline-none hover:bg-fill focus-visible:ring-2 focus-visible:ring-accent-text disabled:pointer-events-none disabled:opacity-50'
export const btnPrimary =
  'pressable inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] outline-none hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50'
export const btnDanger =
  'pressable inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-danger/50 px-4 text-sm text-danger outline-none hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-danger disabled:pointer-events-none disabled:opacity-50'

export const inputClass =
  'ym-disable-keys w-full rounded-xl border border-line-strong bg-field px-3 py-2 text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent-text focus:ring-2 focus:ring-accent/25 md:text-sm'

// Filter / view pills (one system for Pills, Chips, scope buttons): the selected one is an elevated pill with a
// hairline, never a lime fill. `count` goes inside in tabular figures.
export const filterPill = (active: boolean, size: 'md' | 'sm' = 'md') =>
  cn(
    'pressable inline-flex shrink-0 items-center gap-1.5 rounded-full border text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent-text',
    size === 'md' ? 'min-h-10 px-3.5' : 'min-h-9 px-3',
    active ? 'border-line-strong bg-elevated text-fg shadow-card' : 'border-transparent bg-fill text-muted hover:bg-fill-strong hover:text-fg',
  )

// A hairline card in the flow (solid, not glass): list rows, kanban cards, composer.
export const cardClass = 'rounded-card border border-line bg-surface'
export const rowHover = 'transition-colors hover:bg-fill focus-visible:bg-fill'
