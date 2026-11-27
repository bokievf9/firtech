'use client'

import { useServerInsertedHTML } from 'next/navigation'
import { useEffect } from 'react'
import { COLD_MS, COLD_SKIP_MS, coldOpenScript } from '@/lib/cold-open'
import { playCue } from '@/lib/sound'

// Pre-paint gate, in the server HTML only (same pattern as ThemeInit). It marks <html> only on the first visit.
export function ColdOpenInit() {
  useServerInsertedHTML(() => <script dangerouslySetInnerHTML={{ __html: coldOpenScript }} />)
  return null
}

// The overlay: the wordmark, the lime dot, then a hole that opens from the dot. All of it is CSS keyed on
// `html[data-cold]` (globals.css), `aria-hidden`, never takes a click, and ends itself by 1.8 s. The page and its h1
// are in the HTML beneath it from the first paint. Any input skips it (fade 120 ms); the key was written by the script.
export function ColdOpen() {
  useEffect(() => {
    const root = document.documentElement
    if (root.dataset.cold !== 'on') return
    let done = false
    const finish = () => {
      done = true
      delete root.dataset.cold
      off()
    }
    const skip = () => {
      if (done) return
      root.dataset.cold = 'skip'
      window.clearTimeout(end)
      window.setTimeout(finish, COLD_SKIP_MS + 30)
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
    const off = () => {
      for (const e of events) window.removeEventListener(e, skip)
    }
    for (const e of events) window.addEventListener(e, skip, { passive: true })
    const end = window.setTimeout(finish, COLD_MS + 100)
    const pulse = window.setTimeout(() => playCue('cold'), 400) // the dot pulse; silent unless sound was already on
    return () => {
      window.clearTimeout(end)
      window.clearTimeout(pulse)
      off()
      if (!done) delete root.dataset.cold
    }
  }, [])

  return (
    <div className="cold-open" aria-hidden="true" data-cold-open>
      <span className="cold-open-mark font-brand">
        fir<span className="cold-open-dot">.</span>tech
      </span>
    </div>
  )
}
