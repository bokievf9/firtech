'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { FILM_MIN_WIDTH, type FilmSceneId } from '@/lib/film'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// The director of the home film. It only decides whether the film runs: a wide screen, motion
// allowed, WebGL, and the page fully loaded and idle (so the first screen never waits for three.js).
// Phones, reduced motion and no WebGL keep the plain sections with the flat Fira on every mark.
// The overlay (one WebGL Fira travelling between the marks) is its own chunk.
const FilmOverlay = dynamic(() => import('./film-overlay'), { ssr: false })

export type FilmCopy = { name: string; overlay: string; scenes: Record<FilmSceneId, string> }

const query = `(min-width: ${FILM_MIN_WIDTH}px)`
const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia(query)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

export function FilmStage({ copy }: { copy: FilmCopy }) {
  const reduce = useReducedMotion()
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(query).matches, () => false)
  const [armed, setArmed] = useState<boolean | null>(null)

  useEffect(() => {
    let idle = 0
    let timer = 0
    const arm = () => {
      const go = () => setArmed(hasWebGL())
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(go, { timeout: 2500 })
      else timer = globalThis.setTimeout(go, 600) as unknown as number
    }
    if (document.readyState === 'complete') arm()
    else window.addEventListener('load', arm, { once: true })
    return () => {
      window.removeEventListener('load', arm)
      if (idle) window.cancelIdleCallback(idle)
      globalThis.clearTimeout(timer)
    }
  }, [])

  return wide && !reduce && armed ? <FilmOverlay copy={copy} /> : null
}
