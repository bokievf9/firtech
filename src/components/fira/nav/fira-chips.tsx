'use client'

import { chipsFor, type Chip } from '@/lib/fira/nav/chips'
import type { Loc } from '@/lib/fira/nav/sitemap'

// Three chips above the chat input, by page context (Fira nav 2.0). One row, scrolls sideways on a phone so it takes a
// single line. What a chip does is decided by the chat panel (`onChip`): a tour, a trip, a section or a prepared question.
export function FiraChips({
  context, locale, label, disabled, onChip,
}: {
  context: string
  locale: Loc
  label: string
  disabled?: boolean
  onChip: (chip: Chip) => void
}) {
  const chips = chipsFor(context)
  return (
    <div data-fira-chips={context || 'home'} role="group" aria-label={label} className="flex gap-2 overflow-x-auto px-3 pt-2 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          disabled={disabled}
          data-fira-chip={chip.id}
          data-chat-suggest=""
          onClick={() => onChip(chip)}
          className="shrink-0 rounded-full border border-accent-text/40 px-3.5 py-2 text-sm whitespace-nowrap text-fg transition-[background-color,border-color,transform,opacity] duration-200 hover:border-accent-text hover:bg-accent/10 active:scale-[0.97] disabled:opacity-50"
        >
          {chip.label[locale]}
        </button>
      ))}
    </div>
  )
}
