'use client'

import { useSyncExternalStore } from 'react'

const query = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

// Same answer as Motion's useReducedMotion, but hydration-safe: the server and the first client
// render both say "motion allowed", so the HTML matches; the real preference applies right after.
// MotionConfig reducedMotion="user" (MotionProvider) covers what has already started animating.
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
