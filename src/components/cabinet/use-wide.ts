'use client'

import { useSyncExternalStore } from 'react'

// True on screens at least `min` px wide (the `lg` breakpoint by default). Server and first paint say
// false, so a phone never flashes the wide layout; it subscribes to changes, no effect and no state.
export function useWide(min = 1024): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(`(min-width: ${min}px)`)
      query.addEventListener('change', notify)
      return () => query.removeEventListener('change', notify)
    },
    () => window.matchMedia(`(min-width: ${min}px)`).matches,
    () => false,
  )
}
