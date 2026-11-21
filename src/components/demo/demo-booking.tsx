'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { bookingNext, bookingOptions, bookingStart } from '@/lib/demo-booking'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// The «ИИ-администратор» demo tab: a booking dialogue driven by a small state machine
// (src/lib/demo-booking.ts). Labelled «Пример»; no real booking, no Telegram link.
export function DemoBooking({ copy, badge }: { copy: Dict['demoSection']['admin']; badge: string }) {
  const reduce = useReducedMotion()
  const [state, setState] = useState(() => bookingStart(copy))
  const listRef = useRef<HTMLOListElement>(null)
  const options = bookingOptions(state, copy)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [state.log.length, reduce])

  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-5">
        <p className="max-w-[44ch] text-muted">{copy.intro}</p>
        <p className="mt-6 inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs text-accent-text">{badge}</p>
      </div>
      <div className="lg:col-span-7">
        <div className="glass flex h-[26rem] flex-col overflow-hidden rounded-panel" data-demo-booking>
          <div className="flex items-center gap-3 border-b border-glass-line px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-pine font-brand text-xs text-accent-text">ft</span>
            <div>
              <p className="text-sm font-medium">{copy.agent}</p>
              <p className="text-xs text-muted">{copy.salon}</p>
            </div>
          </div>
          <ol ref={listRef} aria-live="polite" className="grid flex-1 content-start gap-2.5 overflow-y-auto p-4">
            {state.log.map((m, i) => (
              <li
                key={`${i}-${m.text}`}
                className={cn(
                  'chat-in max-w-[88%] rounded-[18px] px-4 py-2.5 text-[15px] leading-snug',
                  m.from === 'client' ? 'ml-auto rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md bg-surface-2',
                )}
              >
                {m.text}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2 border-t border-glass-line p-4">
            {options.map((label, i) => (
              <button
                key={label}
                type="button"
                data-booking-option={i}
                onClick={() => setState((s) => bookingNext(s, i, copy))}
                className="rounded-full border border-accent-text/40 px-4 py-2 text-sm transition-[background-color,border-color] duration-200 hover:border-accent-text hover:bg-accent/10"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
