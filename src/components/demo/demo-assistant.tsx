'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// The «Персональный ИИ» demo tab: a scripted conversation, five questions the visitor taps (brief, mail,
// promises from memory, time for a task, a language lesson).
// Labelled «Пример»; nothing is sent anywhere.
export function DemoAssistant({ copy, badge }: { copy: Dict['demoSection']['personal']; badge: string }) {
  const reduce = useReducedMotion()
  const [asked, setAsked] = useState<number[]>([])
  const listRef = useRef<HTMLOListElement>(null)
  const log = [
    { from: 'agent' as const, text: copy.greet },
    ...asked.flatMap((i) => [
      { from: 'me' as const, text: copy.prompts[i]!.q },
      { from: 'agent' as const, text: copy.prompts[i]!.a },
    ]),
  ]
  const left = copy.prompts.map((p, i) => ({ q: p.q, i })).filter((p) => !asked.includes(p.i))

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [asked.length, reduce])

  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-5">
        <p className="max-w-[44ch] text-muted">{copy.intro}</p>
        <p className="mt-6 inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs text-accent-text">{badge}</p>
      </div>
      <div className="lg:col-span-7">
        <div className="glass flex h-[26rem] flex-col overflow-hidden rounded-panel" data-demo-assistant>
          <div className="flex items-center gap-3 border-b border-glass-line px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-pine font-brand text-xs text-accent-text">ft</span>
            <div>
              <p className="text-sm font-medium">{copy.name}</p>
              <p className="text-xs text-muted">{copy.sub}</p>
            </div>
          </div>
          <ol ref={listRef} aria-live="polite" className="grid flex-1 content-start gap-2.5 overflow-y-auto p-4">
            {log.map((m, i) => (
              <li
                key={`${i}-${m.text}`}
                className={cn(
                  'chat-in max-w-[88%] rounded-[18px] px-4 py-2.5 text-[15px] leading-snug',
                  m.from === 'me' ? 'ml-auto rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md bg-surface-2',
                )}
              >
                {m.text}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-2 border-t border-glass-line p-4">
            {left.length > 0 ? (
              left.map((p) => (
                <button
                  key={p.i}
                  type="button"
                  data-assistant-option={p.i}
                  onClick={() => setAsked((a) => [...a, p.i])}
                  className="rounded-full border border-accent-text/40 px-4 py-2 text-sm transition-[background-color,border-color] duration-200 hover:border-accent-text hover:bg-accent/10"
                >
                  {p.q}
                </button>
              ))
            ) : (
              <>
                <p className="text-sm text-muted">{copy.end}</p>
                <button
                  type="button"
                  onClick={() => setAsked([])}
                  className="rounded-full border border-line-strong px-4 py-2 text-sm text-muted transition-colors hover:text-fg"
                >
                  {copy.restart}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
