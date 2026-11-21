'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import type { Emotion } from '@/lib/fira/pose'
import { BUBBLE_FADE, BUBBLE_HOLD, ampAt, bubbleAt, speechTimeline, type Accessory, type EventKind, type LightMode, type Turtle } from '@/lib/fira/turtle'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// Round four component: the turtle (N to Q). Its own lazy chunk; an SVG stand-in shows before the first
// WebGL frame, without WebGL and under prefers-reduced-motion. The home page and the chat do not use it yet.
const Scene4 = dynamic(() => import('./fira-scene4'), { ssr: false })

export type FiraTurtleProps = {
  variant?: Turtle
  emotion?: Emotion
  acc?: Accessory
  size?: number
  lookAt?: boolean
  /** Mouth amplitude 0..1 (the Piper audio later, the synthetic envelope now). */
  mouth?: number
  theme?: 'light' | 'dark'
  /** Fixed time in seconds for stills (no blink, no fidgets). */
  clock?: number
  spin?: number
  event?: { kind: EventKind; id: number } | null
  /** Force the shell-light layer: idle, event or talk. */
  lights?: LightMode
  sfx?: 'off'
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

const shellRx: Record<Turtle, number> = { n: 40, o: 40, p: 46, q: 44 }
function TurtleSvg({ variant, emotion, style }: { variant: Turtle; emotion: Emotion; style?: CSSProperties }) {
  const sleepy = emotion === 'sleep' || emotion === 'sorry'
  const rx = shellRx[variant]
  return (
    <svg viewBox="0 0 120 120" style={style} aria-hidden="true">
      <ellipse cx="60" cy="108" rx="44" ry="5" fill="currentColor" opacity="0.12" />
      <ellipse cx="60" cy="86" rx={rx} ry={variant === 'p' ? 22 : 28} fill="#2f5a14" />
      {[-18, 0, 18].map((x) => <circle key={x} cx={60 + x} cy={variant === 'p' ? 70 : 64} r="5" fill="#c6ff3d" opacity="0.85" />)}
      <rect x="78" y="94" width="14" height="14" rx="7" fill="#c6ff3d" />
      <rect x="28" y="94" width="14" height="14" rx="7" fill="#c6ff3d" />
      <circle cx="92" cy="62" r={variant === 'p' ? 17 : 21} fill="#c6ff3d" />
      <circle cx="88" cy="60" r="2.4" fill="#0d1408" transform={sleepy ? 'translate(0 3) scale(1 0.3)' : undefined} />
      <circle cx="98" cy="60" r="2.4" fill="#0d1408" transform={sleepy ? 'translate(0 3) scale(1 0.3)' : undefined} />
      <path d={emotion === 'sorry' ? 'M88 70 q5 -3 10 0' : 'M88 68 q5 4 10 0'} stroke="#0d1408" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {variant === 'q' ? <><circle cx="88" cy="60" r="6" fill="none" stroke="#0d1408" strokeWidth="1.2" /><circle cx="98" cy="60" r="6" fill="none" stroke="#0d1408" strokeWidth="1.2" /></> : null}
    </svg>
  )
}

export function FiraTurtle({ variant = 'n', emotion = 'idle', acc, size = 320, lookAt = true, mouth, theme, clock, spin, event, lights, sfx, className, style, label, onReady }: FiraTurtleProps) {
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
      data-fira={`${variant}-${emotion}${acc ? `-${acc}` : ''}`}
    >
      <TurtleSvg variant={variant} emotion={emotion} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: use3d && shown ? 0 : 1, transition: fade }} />
      {use3d ? (
        <div style={{ position: 'absolute', inset: 0, opacity: shown ? 1 : 0, transition: fade }}>
          <Scene4
            variant={variant}
            emotion={emotion}
            acc={acc}
            lookAt={lookAt}
            mouth={mouth}
            theme={theme}
            clock={clock}
            spin={spin}
            event={event}
            lights={lights}
            sfx={sfx}
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

// ---- Speech: the mouth follows the envelope, the bubble types by words in step with it ----
export function useSpeech(text: string, run: boolean, opts: { loop?: boolean; rate?: number; pause?: number } = {}) {
  const { loop = true, rate = 1, pause = 1.2 } = opts
  const [st, setSt] = useState({ amp: 0, words: 0, opacity: 0, talking: false })
  const tl = useRef(speechTimeline(text, rate))
  useEffect(() => {
    tl.current = speechTimeline(text, rate)
  }, [text, rate])
  useEffect(() => {
    if (!run) return
    const t0 = performance.now()
    const id = window.setInterval(() => {
      const cycle = tl.current.total + BUBBLE_HOLD + BUBBLE_FADE + pause
      const el = (performance.now() - t0) / 1000
      const t = loop ? el % cycle : Math.min(el, cycle)
      const b = bubbleAt(tl.current, t)
      setSt({ amp: ampAt(tl.current, t), words: b.words, opacity: b.opacity, talking: b.talking })
    }, 33)
    return () => window.clearInterval(id)
  }, [run, loop, pause])
  return run ? st : { amp: 0, words: 0, opacity: 0, talking: false }
}

export function SpeechBubble({ text, shown, opacity, className }: { text: string; shown: number; opacity: number; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean)
  return (
    <div
      role="status"
      data-fira-bubble=""
      className={cn('relative max-w-[17rem] rounded-2xl rounded-bl-md border border-line-strong bg-surface px-4 py-3 text-[15px] leading-snug text-fg shadow-card', className)}
      style={{ opacity, transform: `scale(${0.96 + 0.04 * opacity})`, transformOrigin: 'bottom left', transition: 'opacity 160ms cubic-bezier(0.23, 1, 0.32, 1), transform 160ms cubic-bezier(0.23, 1, 0.32, 1)' }}
    >
      <span aria-hidden="true" className="absolute -bottom-[7px] left-9 size-3.5 rotate-45 border-b border-r border-line-strong bg-surface" />
      {words.map((w, i) => (
        <span key={i} style={{ opacity: i < shown ? 1 : 0, transition: 'opacity 140ms cubic-bezier(0.23, 1, 0.32, 1)' }}>
          {w}{' '}
        </span>
      ))}
    </div>
  )
}
