'use client'

import { useEffect, useState } from 'react'
import { firaFace } from '@/lib/fira/face'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { Fira } from '../fira/fira'
import { FiraFallback3 } from '../fira/fira-fallback3'

// Fira as the face of the AI company page (owner 2026-11-22): the flat SVG in the server HTML, so the first
// screen never waits; on wide screens with motion allowed, once the page is idle, the WebGL figure replaces it.
// Phones keep the SVG (light, no three.js chunk).
export function FiraHero({ label }: { label: string }) {
  const reduce = useReducedMotion()
  const [live, setLive] = useState(false)
  useEffect(() => {
    if (reduce || !window.matchMedia('(min-width: 1024px)').matches) return
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setLive(true))
      return () => w.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(() => setLive(true), 1200)
    return () => window.clearTimeout(id)
  }, [reduce])
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[18rem] lg:max-w-[22rem]" data-fira-hero={live ? 'webgl' : 'svg'}>
      <div aria-hidden="true" className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,var(--hero-glow),transparent_70%)]" />
      {live ? (
        <Fira variant={firaFace} emotion="wave" size={352} label={label} style={{ width: '100%', height: '100%' }} />
      ) : (
        <FiraFallback3 variant={firaFace} emotion="wave" className="relative block size-full" />
      )}
    </div>
  )
}
