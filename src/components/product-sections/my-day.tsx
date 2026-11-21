'use client'

import { ArrowLeft, ArrowRight, CheckCircle } from '@phosphor-icons/react'
import { useId, useState } from 'react'
import type { ProductBlocks } from '@/content/product-pages'
import { cn } from '@/lib/cn'

type Copy = NonNullable<ProductBlocks['myday']>

// «Один день с вашим ИИ» (Персональный ИИ, owner 2026-11-22): pick who you are, then walk the day by the hour.
// Each moment is one message of the AI, your one-word answer and what happened. Plain state, no timers, so it
// reads the same under reduced motion; the hours are a real tablist (arrow keys move between them).
export function MyDay({ copy, note }: { copy: Copy; note: string }) {
  const base = useId()
  const [who, setWho] = useState(0)
  const [at, setAt] = useState(0)
  const persona = copy.personas[who] ?? copy.personas[0]!
  const moments = persona.moments
  const moment = moments[Math.min(at, moments.length - 1)]!

  function onKey(e: React.KeyboardEvent, i: number) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (i + dir + moments.length) % moments.length
    setAt(next)
    document.getElementById(`${base}-h-${next}`)?.focus()
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12" data-myday>
      <div className="lg:col-span-4">
        <p className="text-xs tracking-[0.14em] text-faint uppercase">{copy.pick}</p>
        <div className="mt-3 grid gap-2" role="radiogroup" aria-label={copy.pick}>
          {copy.personas.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={who === i}
              data-myday-persona={p.id}
              onClick={() => {
                setWho(i)
                setAt(0)
              }}
              className={cn(
                'rounded-xl border px-4 py-3 text-left transition-[border-color,background-color] duration-200',
                who === i ? 'border-accent-text bg-accent/10' : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className="block font-medium">{p.name}</span>
              <span className="mt-0.5 block text-sm leading-snug text-muted">{p.who}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 lg:col-span-8">
        <div role="tablist" aria-label={persona.name} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {moments.map((m, i) => (
            <button
              key={`${persona.id}-${m.time}`}
              id={`${base}-h-${i}`}
              type="button"
              role="tab"
              aria-selected={at === i}
              aria-controls={`${base}-panel`}
              tabIndex={at === i ? 0 : -1}
              data-myday-hour={m.time}
              onClick={() => setAt(i)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-2 text-left transition-[border-color,background-color] duration-200',
                at === i ? 'border-accent-text bg-accent text-accent-ink' : 'border-line-strong text-muted hover:text-fg',
              )}
            >
              <span className="block font-mono text-sm">{m.time}</span>
              <span className={cn('block text-[11px]', at === i ? 'text-accent-ink/80' : 'text-faint')}>{m.label}</span>
            </button>
          ))}
        </div>

        <div
          id={`${base}-panel`}
          role="tabpanel"
          aria-labelledby={`${base}-h-${at}`}
          className="glass mt-5 rounded-panel p-4 md:p-6"
        >
          <div className="flex items-center gap-3 border-b border-glass-line pb-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pine font-brand text-xs text-accent-text">ft</span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{moment.label}</p>
              <p className="font-mono text-xs text-muted">{moment.time}</p>
            </div>
          </div>
          <ol key={`${who}-${at}`} aria-live="polite" className="mt-4 grid gap-2.5">
            <li className="chat-in max-w-[92%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-snug">{moment.ai}</li>
            <li className="chat-in ml-auto max-w-[80%] rounded-[18px] rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-snug text-accent-ink [animation-delay:120ms]">
              {moment.you}
            </li>
            <li className="chat-in flex items-center gap-2 text-sm text-accent-text [animation-delay:240ms]">
              <CheckCircle size={16} weight="fill" aria-hidden="true" />
              {moment.done}
            </li>
          </ol>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-glass-line pt-4">
            <button
              type="button"
              onClick={() => setAt((a) => Math.max(0, a - 1))}
              disabled={at === 0}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm text-muted transition-colors hover:text-fg disabled:opacity-40"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              {copy.prev}
            </button>
            <span className="font-mono text-xs text-faint">
              {at + 1} / {moments.length}
            </span>
            <button
              type="button"
              onClick={() => setAt((a) => Math.min(moments.length - 1, a + 1))}
              disabled={at === moments.length - 1}
              data-myday-next
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-accent-text/50 px-4 text-sm transition-colors hover:bg-accent/10 disabled:opacity-40"
            >
              {copy.next}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="mt-4 text-xs text-faint">{note}</p>
      </div>
    </div>
  )
}
