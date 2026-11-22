'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/cn'

// Four short questions as chips; the answer of the open one sits under them (one open at a time).
export function QuestionChips({ items }: { items: { q: string; a: string }[] }) {
  const base = useId()
  const [open, setOpen] = useState(0)
  return (
    <div data-questions>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <button
            key={item.q}
            type="button"
            id={`${base}-q-${i}`}
            aria-expanded={open === i}
            aria-controls={`${base}-a`}
            onClick={() => setOpen(i)}
            className={cn(
              'pressable rounded-full border border-hairline px-4 py-2.5 text-left text-callout transition-colors',
              open === i ? 'border-accent-text/50 bg-accent/15 text-fg' : 'border-line-strong text-muted hover:text-fg',
            )}
          >
            {item.q}
          </button>
        ))}
      </div>
      <p
        key={open}
        id={`${base}-a`}
        role="region"
        aria-labelledby={`${base}-q-${open}`}
        className="chat-in mt-5 max-w-[60ch] rounded-card border border-hairline border-line bg-surface p-card text-body text-muted"
      >
        {items[open]!.a}
      </p>
    </div>
  )
}
