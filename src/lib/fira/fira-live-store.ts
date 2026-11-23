'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { SLEEP_AFTER_MS, THINK_MIN_MS, HAPPY_MS, SORRY_MS, type FiraLive, type FiraState } from './live'

// The live store of Fira (React-free core + useSyncExternalStore, no provider). One module-level state:
// the chat sets thinking / talking / happy / sorry, the page sets point, the presence turns that into pose.
const WORD_MS = 180
const initial: FiraLive = { state: 'idle', since: 0, bubble: null }
let live: FiraLive = initial
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const put = (next: Partial<FiraLive>) => {
  live = { ...live, since: Date.now(), ...next }
  emit()
}
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let gen = 0
let timers: number[] = []
let sleepTimer = 0
const later = (fn: () => void, ms: number) => {
  const id = window.setTimeout(fn, ms)
  timers.push(id)
  return id
}
const clear = () => {
  timers.forEach((t) => window.clearTimeout(t))
  timers = []
}
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean)

export const firaActions = {
  set(state: FiraState) {
    gen++
    clear()
    put({ state, bubble: state === 'idle' ? null : live.bubble, pointTo: state === 'point' ? live.pointTo : undefined })
  },
  dots(on: boolean) {
    put({ bubble: on ? { text: '', dots: !reduced(), wordsShown: 0 } : null, state: on ? 'thinking' : live.state })
  },
  point(id: string, ms = 3000) {
    const g = ++gen
    clear()
    put({ state: 'point', pointTo: id })
    later(() => {
      if (g === gen) put({ state: 'idle', pointTo: undefined })
    }, ms)
  },
  /** Words appear one by one (all at once under reduced motion); thinking dots show >= 600 ms first. */
  say(text: string, opts: { stream?: AsyncIterable<string> } = {}) {
    const g = ++gen
    clear()
    const r = reduced()
    let all = words(text)
    let ended = !opts.stream
    let shown = 0
    const started = Date.now()
    put({ state: 'thinking', bubble: { text: '', dots: !r, wordsShown: 0 } })
    if (opts.stream) {
      void (async () => {
        let buf = text
        try {
          for await (const chunk of opts.stream!) {
            if (g !== gen) return
            buf += chunk
            all = words(buf)
          }
        } catch {
          if (g === gen) firaActions.fail()
          return
        }
        ended = true
      })()
    }
    const tick = () => {
      if (g !== gen) return
      const total = all.length
      if (shown < total) {
        shown = r ? total : shown + 1
        put({ state: 'talking', bubble: { text: all.slice(0, shown).join(' '), dots: false, wordsShown: shown } })
        later(tick, r ? 0 : WORD_MS)
      } else if (ended) {
        put({ state: 'happy' })
        later(() => g === gen && put({ state: 'idle', bubble: live.bubble }), HAPPY_MS)
      } else later(tick, 60)
    }
    later(tick, r ? 0 : Math.max(0, THINK_MIN_MS - (Date.now() - started)))
  },
  fail() {
    const g = ++gen
    clear()
    put({ state: 'sorry', bubble: null })
    later(() => g === gen && put({ state: 'idle' }), SORRY_MS)
  },
  wake() {
    window.clearTimeout(sleepTimer)
    if (live.state === 'sleep') put({ state: 'idle' })
  },
  /** No pointer or key for `ms` -> sleep (never under reduced motion). */
  sleepAfter(ms = SLEEP_AFTER_MS) {
    window.clearTimeout(sleepTimer)
    if (reduced()) return
    sleepTimer = window.setTimeout(() => {
      if (live.state === 'idle') put({ state: 'sleep', bubble: null })
    }, ms)
  },
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => void listeners.delete(cb)
}

export function useFiraLive() {
  const snap = useSyncExternalStore(subscribe, () => live, () => initial)
  return useMemo(() => ({ ...snap, ...firaActions }), [snap])
}
