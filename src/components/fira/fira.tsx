'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import type { Emotion, Variant } from '@/lib/fira/pose'
import { FiraFallback } from './fira-fallback'

export { emotions, variants } from '@/lib/fira/pose'
export type { Emotion, Variant } from '@/lib/fira/pose'

export type FiraProps = {
  variant?: Variant
  emotion?: Emotion
  /** Square size in CSS pixels. */
  size?: number
  /** Eyes and head follow the pointer, within limits. */
  lookAt?: boolean
  /** Mouth amplitude 0..1 (lip-sync, see useMouthFromAudio). Overrides the talking idle. */
  mouth?: number
  /** Force a token set; default follows <html data-theme> live. */
  theme?: 'light' | 'dark'
  /** Fixed time in seconds, for stills (no blink, hop frozen at that phase). */
  clock?: number
  className?: string
  style?: CSSProperties
  /** Accessible name; without it the figure is decorative. */
  label?: string
}

// The scene is a separate chunk: three.js and R3F load only when Fira is shown with WebGL.
const Scene = dynamic(() => import('./fira-scene'), { ssr: false })

let glOk: boolean | undefined
function hasWebGL(): boolean {
  if (glOk !== undefined) return glOk
  try {
    const c = document.createElement('canvas')
    glOk = Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    glOk = false
  }
  return glOk
}

// Fira, the lime dot of the logo come alive. WebGL (R3F) when the device allows it, a still-ish SVG
// otherwise (no WebGL, or prefers-reduced-motion). Draws only while on screen and the tab is visible.
export function Fira({ variant = 'a', emotion = 'idle', size = 240, lookAt = true, mouth, theme, clock, className, style, label }: FiraProps) {
  const reduce = useReducedMotion()
  const host = useRef<HTMLDivElement>(null)
  const [gl, setGl] = useState(false)
  const [seen, setSeen] = useState(true)
  const [shown, setShown] = useState(false)
  const [tab, setTab] = useState(true)

  useEffect(() => {
    const id = requestAnimationFrame(() => setGl(hasWebGL()))
    return () => cancelAnimationFrame(id)
  }, [])
  useEffect(() => {
    const el = host.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setSeen(entry?.isIntersecting ?? true), { rootMargin: '80px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const sync = () => setTab(!document.hidden)
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  const use3d = gl && !reduce
  return (
    <div
      ref={host}
      className={className}
      style={{ position: 'relative', width: size, height: size, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-fira-mode={use3d ? 'webgl' : 'svg'}
      data-fira-ready={shown ? '1' : '0'}
      data-fira={`${variant}-${emotion}`}
    >
      <FiraFallback
        variant={variant}
        emotion={emotion}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: use3d && shown ? 0 : 1, transition: 'opacity 220ms cubic-bezier(0.23, 1, 0.32, 1)' }}
      />
      {use3d ? (
        <div style={{ position: 'absolute', inset: 0, opacity: shown ? 1 : 0, transition: 'opacity 220ms cubic-bezier(0.23, 1, 0.32, 1)' }}>
          <Scene variant={variant} emotion={emotion} lookAt={lookAt} mouth={mouth} theme={theme} clock={clock} active={seen && tab} onReady={() => setShown(true)} />
        </div>
      ) : null}
    </div>
  )
}
