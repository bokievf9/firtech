'use client'

import { useEffect, useRef } from 'react'

// ⌘K and object links open a panel with `?focus=<id>`. The panel marks the matching row (`focusRow`: a data
// attribute for tests and scripts, `aria-current` for screen readers, a quiet accent wash from `focusRowClass`)
// and `useFocusRow` scrolls it into view once, when the rows are on screen (`ready`).
export const focusRow = (id: string | number, focus: string | null | undefined) =>
  focus && String(id) === focus ? ({ 'data-focus-row': String(id), 'aria-current': 'true' } as const) : {}

export const focusRowClass = 'bg-accent/10 ring-1 ring-accent-text/50'

export function useFocusRow(focus: string | null | undefined, ready: boolean) {
  const done = useRef<string | null>(null)
  useEffect(() => {
    if (!focus || !ready || done.current === focus) return
    const el = document.querySelector<HTMLElement>(`[data-focus-row="${focus.replace(/["\\]/g, '')}"]`)
    if (!el) return
    done.current = focus
    el.scrollIntoView({ block: 'center', inline: 'center' })
  }, [focus, ready])
}
