'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { AgentStatus, OfficeData } from '@/lib/office-view'
import { publicToScene, type PublicOffice } from '@/lib/office-public'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { officePeople } from '../pixel-office/model'
import { createScene, type HitTarget, type Scene, sameHit } from '../pixel-office/scene'

// The public pixel office in the hero window: the same canvas engine as /admin/office
// (src/components/pixel-office/), fed with the reduced public data (statuses only). The building
// is laid out for the window's width at a CSS scale of 2; on phones the scene is wider than the
// screen and pans slowly from end to end (static and scrollable with reduced motion). The loop
// pauses while the window is off screen. Hover bubbles name the agent and its status, nothing more.

export type LiveOfficeCopy = {
  canvas: string
  status: Record<string, string>
  titles: Record<string, string>
}

// Dev preview of the quiet-hours office: everybody who is up goes to "sleeping", the queue is empty.
function forceScene(base: OfficeData, mode: 'night' | 'day'): OfficeData {
  const night = mode === 'night'
  const status = (st: AgentStatus): AgentStatus =>
    night ? (st === 'paused' || st === 'offline' ? st : 'sleeping') : st === 'sleeping' ? 'idle' : st
  const agent = <T extends { status: AgentStatus }>(a: T): T => ({ ...a, status: status(a.status) })
  return {
    ...base,
    quietHours: night,
    queueEmpty: night,
    director: agent(base.director),
    departments: base.departments.map((d) => ({ ...d, head: agent(d.head), workers: d.workers.map(agent) })),
  }
}

const subscribeNever = () => () => {}
function forceFromUrl(): 'night' | 'day' | null {
  if (process.env.NODE_ENV === 'production') return null
  const v = new URLSearchParams(window.location.search).get('office')
  return v === 'night' || v === 'day' ? v : null
}

const PHONE_BREAK = 640
const PHONE_MIN_WIDTH = 560

// Integer pixel steps by window width: 2x up to laptops, 3x on wide desktops, 4x from about a
// 1920px screen. The building is then laid out to fill the width at that scale.
export function officeScale(width: number): number {
  return width >= 1800 ? 4 : width >= 1500 ? 3 : 2
}

const minWidthFor = (width: number, scale: number) =>
  width < PHONE_BREAK ? PHONE_MIN_WIDTH : Math.floor(width / scale)

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

type Hover = { target: Extract<HitTarget, { kind: 'agent' }>; left: number; top: number }

export default function LiveOffice({ data, copy }: { data: PublicOffice; copy: LiveOfficeCopy }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  // Dev only: ?office=night or ?office=day forces the quiet-hours scene (or a daytime one).
  const force = useSyncExternalStore(subscribeNever, forceFromUrl, () => null)
  const scene = useMemo(() => {
    const base = publicToScene(data)
    if (!force) return base
    return forceScene(base, force)
  }, [data, force])
  const latest = useRef(scene)
  const reduced = useReducedMotion()
  const reducedRef = useRef(reduced)
  const [hover, setHover] = useState<Hover | null>(null)
  const [pan, setPan] = useState(0)
  const scaleRef = useRef(2)

  // Lays the building out for the window and works out how far the phone pan has to travel.
  const fit = useCallback(() => {
    const s = sceneRef.current
    const wrap = wrapRef.current
    if (!s || !wrap) return
    const w = wrap.clientWidth
    const scale = officeScale(w)
    if (scale !== scaleRef.current) {
      scaleRef.current = scale
      s.resize(scale)
    }
    s.setMinWidth(minWidthFor(w, scale))
    const overflow = s.size().width * scale - w
    setPan(overflow > 0 ? -overflow : 0)
  }, [])

  useEffect(() => {
    latest.current = scene
    sceneRef.current?.setData(scene)
    fit()
  }, [scene, fit])

  useEffect(() => {
    reducedRef.current = reduced
    sceneRef.current?.setReducedMotion(reduced)
  }, [reduced])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const w = wrap.clientWidth
    scaleRef.current = officeScale(w)
    const s = createScene(canvas, latest.current, {
      reducedMotion: reducedRef.current,
      minWidth: minWidthFor(w, scaleRef.current),
    })
    s.resize(scaleRef.current)
    sceneRef.current = s
    fit()
    const ro = new ResizeObserver(() => fit())
    ro.observe(wrap)
    const io = new IntersectionObserver(([entry]) => s.setPaused(!(entry?.isIntersecting ?? true)))
    io.observe(wrap)
    return () => {
      ro.disconnect()
      io.disconnect()
      s.destroy()
      sceneRef.current = null
    }
  }, [fit])

  // After the scene exists (effects run in order): the dev switch also moves the sky.
  useEffect(() => {
    sceneRef.current?.setHour(force === 'night' ? 1.5 : force === 'day' ? 14 : null)
  }, [force])

  const people = useMemo(() => officePeople(scene), [scene])
  const titleOf = (id: string, fallback: string) => copy.titles[id] ?? fallback
  const label = fill(copy.canvas, {
    n: people.length,
    working: people.filter((p) => p.status === 'working').length,
    waiting: people.filter((p) => p.status === 'waiting').length,
  })

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = sceneRef.current
    if (!s || e.pointerType !== 'mouse') return
    const box = e.currentTarget.getBoundingClientRect()
    const k = scaleRef.current
    const hit = s.hitTest((e.clientX - box.left) / k, (e.clientY - box.top) / k)
    const agent = hit?.kind === 'agent' ? hit : null
    if (sameHit(agent, hover?.target ?? null)) return
    s.setHover(agent)
    const r = agent ? s.anchorOf(agent) : null
    setHover(agent && r ? { target: agent, left: (r.x + r.w / 2) * k, top: r.y * k - 12 } : null)
  }

  const onPointerLeave = () => {
    sceneRef.current?.setHover(null)
    setHover(null)
  }

  const person = hover ? people.find((p) => p.id === hover.target.id) : undefined
  const panning = pan < 0 && !reduced

  return (
    <div
      ref={wrapRef}
      className={reduced ? 'overflow-x-auto overscroll-x-contain' : 'overflow-hidden'}
    >
      <div
        className={panning ? 'office-pan relative w-max' : 'relative mx-auto w-max'}
        style={panning ? ({ '--pan': `${pan}px` } as React.CSSProperties) : undefined}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          className="block [image-rendering:pixelated]"
        />
        {hover && person ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full border-2 border-[#1a1626] bg-[#f4f1ea] px-2 py-1 font-mono text-[11px] leading-tight whitespace-nowrap text-[#1a1626] shadow-[3px_3px_0_#1a1626]"
            style={{ left: hover.left, top: hover.top }}
          >
            <p className="font-semibold">{titleOf(person.id, person.title)}</p>
            <p className="mt-0.5">{copy.status[person.status] ?? person.status}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
