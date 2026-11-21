import { Check } from '@phosphor-icons/react/ssr'
import { cn } from '@/lib/cn'

// A small CSS picture for one capability on a product page (owner 2026-11-22). Five kinds, drawn
// from the capability's own example line and chips: a chat bubble with buttons, time slots, a
// checklist, a row of bars and a stack of cards. Decorative: the capability text beside it says
// the same in words, so the picture is hidden from screen readers. No data, labelled as a sample
// by the section.
export type MockKind = 'chat' | 'slots' | 'checks' | 'bars' | 'cards'

const barWidths = ['w-4/5', 'w-3/5', 'w-2/5', 'w-1/2']

export function CapabilityMock({
  kind,
  example,
  chips,
  className,
}: {
  kind: MockKind
  example: string
  chips: readonly string[]
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'dot-grid relative grid min-h-[9.5rem] content-center gap-3 overflow-hidden rounded-[14px] border border-line bg-bg/60 p-4',
        className,
      )}
    >
      {kind === 'chat' && (
        <>
          <p className="max-w-[92%] rounded-[16px] rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-[13px] leading-snug">
            {example}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip, i) => (
              <span
                key={chip}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs',
                  i === 0 ? 'border-accent-text bg-accent/10 text-fg' : 'border-accent-text/30 text-muted',
                )}
              >
                {chip}
              </span>
            ))}
          </div>
        </>
      )}
      {kind === 'slots' && (
        <>
          <p className="text-[13px] leading-snug text-muted">{example}</p>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip, i) => (
              <span
                key={chip}
                className={cn(
                  'rounded-lg border px-3 py-1.5 font-mono text-xs',
                  i === 1 ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-fg',
                )}
              >
                {chip}
              </span>
            ))}
          </div>
        </>
      )}
      {kind === 'checks' && (
        <>
          <ul className="grid gap-2">
            {chips.map((chip) => (
              <li key={chip} className="flex items-center gap-2 text-[13px]">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent-text">
                  <Check size={11} weight="bold" />
                </span>
                {chip}
              </li>
            ))}
          </ul>
          <p className="text-xs text-faint">{example}</p>
        </>
      )}
      {kind === 'bars' && (
        <>
          <ul className="grid gap-2.5">
            {chips.map((chip, i) => (
              <li key={chip} className="grid grid-cols-[5.5rem_1fr] items-center gap-3 text-xs text-muted">
                <span className="truncate">{chip}</span>
                <span className={cn('h-2 rounded-full bg-accent/70', barWidths[i % barWidths.length])} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-faint">{example}</p>
        </>
      )}
      {kind === 'cards' && (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {chips.map((chip, i) => (
              <li
                key={chip}
                className={cn(
                  'rounded-xl border px-3 py-2 text-[13px]',
                  i === 0 ? 'border-accent-text/50 bg-accent/10' : 'border-line bg-surface',
                )}
              >
                {chip}
              </li>
            ))}
          </ul>
          <p className="text-xs text-faint">{example}</p>
        </>
      )}
    </div>
  )
}
