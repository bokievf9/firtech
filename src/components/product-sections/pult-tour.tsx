'use client'

import { useId, useState } from 'react'
import type { ProductBlocks } from '@/content/product-pages'
import { cn } from '@/lib/cn'

type Copy = NonNullable<ProductBlocks['pult']>

// A tour of the control room (ИИ-компания): three screens of our own Пульт as light CSS mocks (office, review
// centre, assignments), switched by tabs. No screenshots, so the page stays light on a phone.
export function PultTour({ copy }: { copy: Copy }) {
  const base = useId()
  const [at, setAt] = useState(0)
  const tab = copy.tabs[at] ?? copy.tabs[0]!
  const tone = (state: string, i: number) =>
    i === tab.rows.length - 1 && tab.id === 'office'
      ? 'bg-accent text-accent-ink'
      : /Ждёт|Waiting|Править|Edit/.test(state)
        ? 'border border-accent-text/60 text-accent-text'
        : 'border border-line-strong text-muted'

  return (
    <div className="grid gap-6 lg:grid-cols-12" data-pult-tour>
      <div className="lg:col-span-4">
        <div role="tablist" aria-label={copy.label} className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {copy.tabs.map((t, i) => (
            <button
              key={t.id}
              id={`${base}-t-${i}`}
              type="button"
              role="tab"
              aria-selected={at === i}
              aria-controls={`${base}-p`}
              data-pult-tab={t.id}
              onClick={() => setAt(i)}
              className={cn(
                'shrink-0 rounded-xl border px-4 py-3 text-left transition-[border-color,background-color] duration-200',
                at === i ? 'border-accent-text bg-accent/10' : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className="block font-medium">{t.name}</span>
              <span className="mt-1 hidden text-sm leading-snug text-muted lg:block">{t.caption}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted lg:hidden">{tab.caption}</p>
      </div>
      <div className="min-w-0 lg:col-span-8">
        <div
          id={`${base}-p`}
          role="tabpanel"
          aria-labelledby={`${base}-t-${at}`}
          className="overflow-hidden rounded-card border border-line-strong bg-bg"
        >
          <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
            <span className="size-2 rounded-full bg-fg/15" />
            <span className="size-2 rounded-full bg-fg/15" />
            <span className="size-2 rounded-full bg-fg/15" />
            <span className="ml-3 truncate font-mono text-[11px] text-faint">
              {copy.label} · {tab.name}
            </span>
          </div>
          <ul className="grid gap-2 p-3 md:p-5" key={tab.id}>
            {tab.rows.map((row, i) => (
              <li
                key={`${row.who}-${row.what}`}
                className="chat-in grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-line bg-surface px-3 py-3 md:grid-cols-[9rem_minmax(0,1fr)_auto] md:px-4"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="text-xs font-medium tracking-[0.08em] text-faint uppercase md:text-[13px] md:tracking-normal md:normal-case">
                  {row.who}
                </span>
                <span className="col-span-2 row-start-2 text-[15px] leading-snug md:col-span-1 md:row-start-auto">{row.what}</span>
                <span className={cn('col-start-2 row-start-1 shrink-0 rounded-full px-2.5 py-1 text-[11px] md:col-start-auto md:row-start-auto', tone(row.state, i))}>
                  {row.state}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-xs text-faint">{copy.note}</p>
      </div>
    </div>
  )
}
