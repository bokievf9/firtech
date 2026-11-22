'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Emotion } from '@/lib/fira/pose'
import type { Turtle7 } from '@/lib/fira/turtle7'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { FiraFallback7 } from './fira-fallback7'

// Round seven component: the standing turtle (A B C D) traced from the owner's reference art. Its own lazy chunk; the SVG stand-in shows before
// the first WebGL frame, without WebGL and under prefers-reduced-motion. The speech hook and the bubble of
// round four (`useSpeech`, `SpeechBubble` in fira-turtle.tsx) work with it unchanged.
const Scene7 = dynamic(() => import('./fira-scene7'), { ssr: false })

export type FiraTurtle7Props = {
  variant?: Turtle7
  emotion?: Emotion
  size?: number
  lookAt?: boolean
  /** Mouth amplitude 0..1 (the Piper audio later, the synthetic envelope now). */
  mouth?: number
  theme?: 'light' | 'dark'
  /** Fixed time in seconds for stills (no blink, no fidgets). */
  clock?: number
  spin?: number
  className?: string
  style?: CSSProperties
  label?: string
  onReady?: () => void
}

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

export function FiraTurtle7({ variant = 'a', emotion = 'idle', size = 320, lookAt = true, mouth, theme, clock, spin, className, style, label, onReady }: FiraTurtle7Props) {
  const reduce = useReducedMotion()
  const host = useRef<HTMLDivElement>(null)
  const [gl, setGl] = useState(false)
  const [seen, setSeen] = useState(true)
  const [shown, setShown] = useState(false)
  const [tab, setTab] = useState(true)
  const [dk, setDk] = useState(false)
  useEffect(() => {
    const sync = () => setDk(document.documentElement.dataset.theme === 'dark')
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
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
  const fade = 'opacity 220ms cubic-bezier(0.23, 1, 0.32, 1)'
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
      <FiraFallback7 variant={variant} emotion={emotion} dark={theme ? theme === 'dark' : dk} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: use3d && shown ? 0 : 1, transition: fade }} />
      {use3d ? (
        <div style={{ position: 'absolute', inset: 0, opacity: shown ? 1 : 0, transition: fade }}>
          <Scene7
            variant={variant}
            emotion={emotion}
            lookAt={lookAt}
            mouth={mouth}
            theme={theme}
            clock={clock}
            spin={spin}
           
            active={seen && tab}
            onReady={() => {
              setShown(true)
              onReady?.()
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
