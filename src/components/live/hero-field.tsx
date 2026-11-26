'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import type { Field } from './field-gl'

// Whether this device should run the WebGL field: not with reduced motion, not on 4 cores or
// fewer, not with Save-Data on. Everyone else gets the still CSS gradient (.hero-aurora).
export function fieldAllowed(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  if ((navigator.hardwareConcurrency ?? 0) <= 4) return false
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return !conn?.saveData
}

// The hero backdrop: a CSS gradient that is there from the first paint, and on capable devices a
// WebGL field faded in on top once the browser is idle. The shader module is a separate chunk,
// loaded only when allowed. Runs only while the hero is on screen and the tab is visible.
export function HeroField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shown, setShown] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce || !fieldAllowed()) return
    const canvas = canvasRef.current
    if (!canvas) return
    let field: Field | null = null
    let cancelled = false
    let visible = true
    let io: IntersectionObserver | null = null
    const host = canvas.closest('section') ?? canvas

    const sync = () => field?.setRunning(visible && !document.hidden)
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !field) return
      const r = canvas.getBoundingClientRect()
      field.setPointer((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
    }

    const boot = () => {
      import('./field-gl').then(({ createField }) => {
        if (cancelled) return
        field = createField(canvas, () => setShown(true))
        if (!field) return
        io = new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting ?? true
          sync()
        })
        io.observe(host)
        document.addEventListener('visibilitychange', sync)
        host.addEventListener('pointermove', onPointer as EventListener, { passive: true })
        sync()
      })
    }
    const hasIdle = typeof window.requestIdleCallback === 'function'
    const handle = hasIdle
      ? window.requestIdleCallback(boot, { timeout: 2000 })
      : window.setTimeout(boot, 600)

    return () => {
      cancelled = true
      if (hasIdle) window.cancelIdleCallback(handle)
      else window.clearTimeout(handle)
      io?.disconnect()
      document.removeEventListener('visibilitychange', sync)
      host.removeEventListener('pointermove', onPointer as EventListener)
      field?.destroy()
    }
  }, [reduce])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="hero-aurora absolute inset-0" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full transition-opacity duration-[1600ms] ease-out"
        style={{ opacity: shown && !reduce ? 1 : 0 }}
      />
      <div className="dot-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_60%_at_70%_30%,black,transparent)]" />
    </div>
  )
}
