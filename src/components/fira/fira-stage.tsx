'use client'

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { CHAT_OPEN_EVENT } from '@/components/chat/chat-events'
import { firaFace } from '@/lib/fira/face'
import { FIRA_EVENT, dispatchFira } from '@/lib/fira/live'
import type { Emotion } from '@/lib/fira/pose'
import { aimYaw, canUse3d, isLowEnd, pickEmotion } from '@/lib/fira/presence'
import { type AccSet7 } from '@/lib/fira/turtle7'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { FiraFallback7 } from './fira-fallback7'
import { FiraTurtle7 } from './fira-turtle7'
import { useFiraLive } from './fira-live-store'

// Fira's live presence (Fira live 1.1, F2): one component for the launcher and the chat panel. It turns the
// live store (state, bubble, pointTo) into the pose of the 3D rig, or of the SVG stand-in on phones, weak
// machines, reduced motion and after the frame-rate guard tripped. At most one WebGL canvas per page: the first
// stage to mount owns it, the others stay SVG. The 3D chunk loads on idle and only once she has been on screen.
const SLOW_KEY = 'fira-slow'
const WAVE_MS = 1500
let canvasOwner: string | null = null

export type FiraStageProps = {
  size?: number
  variant?: 'widget' | 'panel'
  /** The page's own pose while the live state is idle (tour, menu, 404...). */
  emotion?: Emotion
  acc?: AccSet7
  /** A parent owns the click (the launcher button): no own button, no open-chat on click. */
  interactive?: boolean
  /** The home film owns the canvas there. */
  disable3d?: boolean
  className?: string
}

const narrowQuery = '(max-width: 1023px)'
const subscribeNarrow = (cb: () => void) => {
  const m = window.matchMedia(narrowQuery)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

export function FiraStage({ size = 44, variant = 'widget', emotion = 'idle', acc, interactive = true, disable3d, className }: FiraStageProps) {
  const id = useId()
  const live = useFiraLive()
  const reduced = useReducedMotion()
  const host = useRef<HTMLDivElement>(null)
  const [armed, setArmed] = useState(false)
  const [seen, setSeen] = useState(false)
  const [owns, setOwns] = useState(false)
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(narrowQuery).matches, () => true)
  const [lowEnd, setLowEnd] = useState(false)
  const [slow, setSlow] = useState(false)
  const [waving, setWaving] = useState(false)
  const [aim, setAim] = useState<number | null>(null)
  const [dark, setDark] = useState(false)

  // Idle mount, device checks, the stored verdict of the frame-rate guard.
  useEffect(() => {
    const first = window.setTimeout(() => {
      setLowEnd(isLowEnd(navigator as Navigator & { deviceMemory?: number }))
      try {
        setSlow(window.sessionStorage.getItem(SLOW_KEY) === '1')
      } catch {
        // storage blocked: the guard decides again this page
      }
    }, 0)
    let idle = 0
    let timer = 0
    const go = () => setArmed(true)
    if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(go, { timeout: 3000 })
    else timer = window.setTimeout(go, 800)
    return () => {
      window.clearTimeout(first)
      if (idle) window.cancelIdleCallback(idle)
      window.clearTimeout(timer)
    }
  }, [])

  // On screen at least once.
  useEffect(() => {
    const el = host.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      const t = window.setTimeout(() => setSeen(true), 0)
      return () => window.clearTimeout(t)
    }
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        setSeen(true)
        io.disconnect()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // One canvas per page: the first stage claims it.
  useEffect(() => {
    let t = 0
    if (canvasOwner === null || canvasOwner === id) {
      canvasOwner = id
      t = window.setTimeout(() => setOwns(true), 0)
    }
    return () => {
      window.clearTimeout(t)
      if (canvasOwner === id) canvasOwner = null
    }
  }, [id])

  useEffect(() => {
    const sync = () => setDark(document.documentElement.dataset.theme === 'dark')
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // Wave when the chat opens (from anywhere); never under reduced motion.
  useEffect(() => {
    if (reduced) return
    let t = 0
    const wave = () => {
      setWaving(true)
      window.clearTimeout(t)
      t = window.setTimeout(() => setWaving(false), WAVE_MS)
    }
    const onFira = (e: Event) => {
      if ((e as CustomEvent<{ type?: string }>).detail?.type === 'open-chat') wave()
    }
    window.addEventListener(CHAT_OPEN_EVENT, wave)
    window.addEventListener(FIRA_EVENT, onFira)
    return () => {
      window.removeEventListener(CHAT_OPEN_EVENT, wave)
      window.removeEventListener(FIRA_EVENT, onFira)
      window.clearTimeout(t)
    }
  }, [reduced])

  // Sleep and wake belong to the shared store (FiraLiveProvider: 120 s without pointer, key or scroll).

  // `point`: turn the body toward the element with data-fira-target = pointTo.
  const pointTo = live.state === 'point' ? live.pointTo : undefined
  useEffect(() => {
    const el = pointTo ? document.querySelector<HTMLElement>(`[data-fira-target="${CSS.escape(pointTo)}"]`) : null
    const me = host.current
    if (!el || !me) {
      setAim(null)
      return
    }
    const a = el.getBoundingClientRect()
    const b = me.getBoundingClientRect()
    setAim(aimYaw(a.left + a.width / 2 - (b.left + b.width / 2)))
  }, [pointTo])

  // Nod on every new word she says.
  const words = live.bubble?.wordsShown ?? 0
  const talking = live.state === 'talking'
  const nodKey = talking ? words : 0

  const em = pickEmotion(live.state, emotion, waving)
  const use3d = canUse3d({ reduced, narrow, lowEnd, disabled: disable3d, slow, owns, seen, armed })
  const onSlow = useCallback(() => {
    setSlow(true)
    try {
      window.sessionStorage.setItem(SLOW_KEY, '1')
    } catch {
      // not remembered
    }
  }, [])

  const body = (
    <>
      {use3d ? (
        <FiraTurtle7 variant={firaFace} acc={acc} emotion={em} size={size} className="block" nod={nodKey} aim={aim} onSlow={onSlow} />
      ) : (
        <div key={reduced ? 0 : nodKey} className={`fira-svg-wrap${!reduced && nodKey > 0 && talking ? ' fira-svg-nod' : ''}${em === 'sleep' ? ' fira-svg-sleep' : ''}`} style={{ width: size, height: size }}>
          <FiraFallback7 variant={firaFace} acc={acc} morph={acc !== undefined} emotion={em} dark={dark} className="block" style={{ width: '100%', height: '100%' }} />
        </div>
      )}
      {live.bubble?.dots && !reduced ? (
        <span data-fira-dots="" aria-hidden="true" className="fira-dots">
          <i />
          <i />
          <i />
        </span>
      ) : null}
      {em === 'sleep' && !reduced ? (
        <span data-fira-z="" aria-hidden="true" className="fira-z">
          z
        </span>
      ) : null}
    </>
  )
  const common = {
    ref: host,
    'data-fira-stage': variant,
    'data-fira-state': em,
    'data-fira-mode': use3d ? 'webgl' : 'svg',
    className: `fira-stage relative inline-block ${className ?? ''}`,
    style: { width: size, height: size },
  }
  if (!interactive) return <div {...common}>{body}</div>
  return (
    <div
      {...common}
      role="button"
      tabIndex={0}
      aria-label="Fira"
      data-fira-click=""
      onClick={() => dispatchFira({ type: 'open-chat' })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          dispatchFira({ type: 'open-chat' })
        }
      }}
    >
      {body}
    </div>
  )
}
