import { cn } from '@/lib/cn'

// The ONE quiet segmented control of the Shell (docs/shell-design-audit.md): a pill track on a quiet fill, the selected
// segment is an elevated pill with a hairline, counts in tabular figures, never a lime fill (lime is for the one
// primary action). 36 px hit areas, `aria-pressed` buttons in a labelled group, press feedback on every segment.
// No sliding animation on purpose: it changes with the keyboard and the pointer alike, and a filter must feel instant.
export function Segmented<K extends string>({
  label,
  items,
  value,
  onChange,
  className,
  as: Tag = 'div',
}: {
  label: string
  items: readonly { key: K; label: React.ReactNode; count?: number; countLabel?: string }[]
  value: K
  onChange: (key: K) => void
  className?: string
  as?: 'div' | 'nav'
}) {
  return (
    <Tag role={Tag === 'div' ? 'group' : undefined} aria-label={label} data-segmented className={cn('inline-flex max-w-full flex-wrap gap-0.5 rounded-[1.125rem] bg-fill p-0.5', className)}>
      {items.map((c) => {
        const on = value === c.key
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={on}
            data-segment={c.key}
            onClick={() => onChange(c.key)}
            className={cn(
              'pressable inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-callout whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent-text',
              on ? 'border-hairline border-line-strong bg-elevated font-medium text-fg shadow-card' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {c.label}
            {c.count !== undefined ? (
              <span className="text-xs tabular-nums text-faint" aria-label={c.countLabel}>
                {c.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </Tag>
  )
}
