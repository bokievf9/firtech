'use client'

import { motionValue } from 'motion/react'
import { useSyncExternalStore } from 'react'
import type { RailItem } from '@/lib/sections'

// One small store for the whole navigation layer: the sections of the page, the active one, whether the
// palette is open. The tracker (section-tracker.tsx) writes it; the rail, the progress line, the header
// label and the palette read it. `progress` is a motion value (0..1 toward the next section) so the Fira
// marker moves per frame without a React render.
export type NavState = { path: string; items: readonly RailItem[]; active: number; paletteOpen: boolean; sheetOpen: boolean }

let state: NavState = { path: '', items: [], active: -1, paletteOpen: false, sheetOpen: false }
const listeners = new Set<() => void>()

export const sectionProgress = motionValue(0)

export function getNav(): NavState {
  return state
}

export function setNav(patch: Partial<NavState>): void {
  const next = { ...state, ...patch }
  if (next.path === state.path && next.items === state.items && next.active === state.active && next.paletteOpen === state.paletteOpen && next.sheetOpen === state.sheetOpen) return
  state = next
  for (const l of listeners) l()
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

const server: NavState = { path: '', items: [], active: -1, paletteOpen: false, sheetOpen: false }

export function useNav(): NavState {
  return useSyncExternalStore(subscribe, getNav, () => server)
}

export function sameItems(a: readonly RailItem[], b: readonly RailItem[]): boolean {
  return a.length === b.length && a.every((x, i) => x.id === b[i]?.id && x.label === b[i]?.label)
}

// Jump to a section. Pointer and tap: the browser's own smooth scroll (the user can interrupt it);
// keyboard and reduced motion: instant. The hash is updated without adding a history entry.
let silentUntil = 0
// True shortly after an instant (keyboard) jump: the rail tick stays quiet for it.
export const tickMuted = () => performance.now() < silentUntil

export function jumpTo(id: string, smooth: boolean): void {
  const el = document.getElementById(id)
  if (!el) return
  if (!smooth) silentUntil = performance.now() + 600
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'instant', block: 'start' })
  try {
    history.replaceState(null, '', `#${id}`)
  } catch {
    // Some embedded browsers block it: the jump still happened.
  }
}

export const openPalette = () => setNav({ paletteOpen: true, sheetOpen: false })
export const closePalette = () => setNav({ paletteOpen: false })
export const openSheet = () => setNav({ sheetOpen: true, paletteOpen: false })
export const closeSheet = () => setNav({ sheetOpen: false })
