'use client'

import { createContext, createElement, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { FIRA_EVENT, FIRA_SAY_EVENT, SLEEP_MS, applyFiraSay, createFiraStore, type FiraEvent, type FiraSay, type FiraLive, type FiraStore } from '@/lib/fira/live'

// React side of the shared Fira state (lib/fira/live.ts): one store per page view in a context, read with
// useSyncExternalStore. Outside a provider the hooks see a private idle store, so a component can render alone.
const reducedNow = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let fallback: FiraStore | null = null
const Ctx = createContext<FiraStore | null>(null)

export function useFiraStore(): FiraStore {
  const c = useContext(Ctx)
  if (c) return c
  fallback ??= createFiraStore({ reduced: reducedNow })
  return fallback
}

export function useFiraLive(): FiraLive {
  const store = useFiraStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

// Any pointer move, key or scroll wakes her and restarts the 120 s sleep timer (no sleep under reduced motion).
export function FiraLiveProvider({ children, onEvent }: { children: ReactNode; onEvent?: (e: FiraEvent) => void }) {
  const [store] = useState(() => createFiraStore({ reduced: reducedNow }))
  useEffect(() => {
    store.sleepAfter(SLEEP_MS)
    const wake = () => store.wake()
    const names = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    for (const n of names) window.addEventListener(n, wake, { passive: true })
    const onFira = (e: Event) => onEvent?.((e as CustomEvent<FiraEvent>).detail)
    window.addEventListener(FIRA_EVENT, onFira)
    const onSay = (e: Event) => applyFiraSay(store, (e as CustomEvent<FiraSay>).detail)
    window.addEventListener(FIRA_SAY_EVENT, onSay)
    return () => {
      window.removeEventListener(FIRA_SAY_EVENT, onSay)
      for (const n of names) window.removeEventListener(n, wake)
      window.removeEventListener(FIRA_EVENT, onFira)
      store.destroy()
    }
  }, [store, onEvent])
  return createElement(Ctx.Provider, { value: store }, children)
}
