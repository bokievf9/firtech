'use client'

import { useEffect, useState } from 'react'
import type { Dict } from '@/content'
import { markTourSeen, tourSteps, tourSeen } from '@/lib/cabinet-journey'
import { buttonStyles, cn } from '@/lib/cn'
import { fill } from './ui'

type Phase = 'off' | 'tour' | 'static'
function store(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// The first visit to the cabinet (client onboarding): three Fira bubbles pointing at Проекты, Документы and
// Сообщения, «Дальше» / «Понятно», once per account (localStorage, never throws). Under reduced motion the
// bubbles do not move around: the same three hints show as one static note. Never starts again once seen.
export function CabinetTour({ dict, account }: { dict: Dict; account: string }) {
  const t = dict.cabinet.tour
  const [phase, setPhase] = useState<Phase>('off')
  const [at, setAt] = useState(0)

  useEffect(() => {
    if (tourSeen(store(), account)) return
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // A beat after the first paint, so the page settles before the bubble comes.
    const timer = window.setTimeout(() => setPhase(calm ? 'static' : 'tour'), 600)
    return () => window.clearTimeout(timer)
  }, [account])

  const key = tourSteps[at] ?? 'projects'
  useEffect(() => {
    if (phase !== 'tour') return
    const el = document.querySelector<HTMLElement>(`[data-cabinet-tab="${key}"]`)
    if (!el) return
    el.style.setProperty('outline', '2px solid var(--color-accent-text)')
    el.style.setProperty('outline-offset', '3px')
    return () => {
      el.style.removeProperty('outline')
      el.style.removeProperty('outline-offset')
    }
  }, [phase, key])

  function finish() {
    markTourSeen(store(), account)
    setPhase('off')
  }

  if (phase === 'off') return null

  if (phase === 'static') {
    return (
      <aside aria-label={t.label} data-tour-static className="bubble-ink mt-8 !rounded-[20px_20px_20px_6px] p-5 md:p-6">
        <p className="font-display text-title-3 font-bold">{t.staticTitle}</p>
        <ul className="mt-3 grid gap-2 text-callout">
          {tourSteps.map((id) => (
            <li key={id}>
              <span className="bubble-name">{t.steps[id].title}.</span> <span className="opacity-80">{t.steps[id].text}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={finish} className={cn(buttonStyles.primary, 'mt-4')} data-tour-done>
          {t.done}
        </button>
      </aside>
    )
  }

  const last = at === tourSteps.length - 1
  const step = t.steps[key]
  return (
    <div
      role="dialog"
      aria-label={t.label}
      aria-live="polite"
      data-tour-bubble={key}
      className="bubble-ink fixed bottom-24 left-4 right-4 z-40 !rounded-[20px_20px_20px_6px] p-5 md:bottom-6 md:left-6 md:right-auto md:w-[22rem]"
    >
      <div className="flex items-center justify-between gap-3 text-footnote opacity-90">
        <span className="bubble-name">{t.fira}</span>
        <span className="font-mono text-caption">{fill(t.progress, { n: String(at + 1), m: String(tourSteps.length) })}</span>
      </div>
      <p className="mt-2 font-medium">{step.title}</p>
      <p className="mt-1 text-callout leading-relaxed opacity-80">{step.text}</p>
      <button
        type="button"
        onClick={() => (last ? finish() : setAt(at + 1))}
        className={cn(buttonStyles.primary, 'mt-4')}
        data-tour-next
      >
        {last ? t.done : t.next}
      </button>
    </div>
  )
}
