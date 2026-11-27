import { useSyncExternalStore } from 'react'

// Sound (docs/motion-storyboard.md §7): off by default, one toggle, the choice in localStorage['fir-sound'].
// T1 owns the toggle state and a no-op `playCue`; T4 adds the lazy sprite behind the same call.
export const SOUND_KEY = 'fir-sound'

export type CueName = 'on' | 'tick' | 'page' | 'palette' | 'cta' | 'cold'

const listeners = new Set<() => void>()
let cached: boolean | null = null

function read(): boolean {
  if (cached !== null) return cached
  try {
    cached = localStorage.getItem(SOUND_KEY) === 'on'
  } catch {
    cached = false
  }
  return cached
}

export function soundOn(): boolean {
  return typeof window !== 'undefined' && read()
}

export function setSound(on: boolean): void {
  cached = on
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // Storage blocked: the choice lasts for this page view only.
  }
  for (const l of listeners) l()
  if (on) playCue('on')
}

export function toggleSound(): void {
  setSound(!read())
}

// No-op until the sprite exists (T4). Callers may call it freely; it never throws and never plays while off.
export function playCue(name: CueName): void {
  void name
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function useSound(): boolean {
  return useSyncExternalStore(subscribe, read, () => false)
}
