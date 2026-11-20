'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { StageField as Field } from './golive-gl'

export type StageFieldHandle = { pulse(): void; setOver(over: boolean): void; setProgress(p: number): void }

// The stage backdrop: a token-based CSS gradient (.golive-aurora, there from the first paint and the
// whole background under reduced motion or without WebGL) with the shader faded in over it. The
// shader runs only while the stage is on screen and the tab is visible.
export const StageField = forwardRef<StageFieldHandle, { reduce: boolean }>(function StageField({ reduce }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fieldRef = useRef<Field | null>(null)
  const pending = useRef({ over: false, progress: 0 })
  const [shown, setShown] = useState(false)

  useImperativeHandle(ref, () => ({
    pulse: () => fieldRef.current?.pulse(),
    setOver: (v) => {
      pending.current.over = v
      fieldRef.current?.setOver(v)
    },
    setProgress: (p) => {
      pending.current.progress = p
      fieldRef.current?.setProgress(p)
    },
  }))

  useEffect(() => {
    if (reduce) return
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let visible = true
    let io: IntersectionObserver | null = null
    const host = canvas.closest('section') ?? canvas
    const sync = () => fieldRef.current?.setRunning(visible && !document.hidden)
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = canvas.getBoundingClientRect()
      fieldRef.current?.setPointer((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
    }
    void import('./golive-gl').then(({ createStageField }) => {
      if (cancelled) return
      const field = createStageField(canvas, () => setShown(true))
      if (!field) return
      fieldRef.current = field
      field.setOver(pending.current.over)
      field.setProgress(pending.current.progress)
      io = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? true
        sync()
      })
      io.observe(host)
      document.addEventListener('visibilitychange', sync)
      host.addEventListener('pointermove', onPointer as EventListener, { passive: true })
      sync()
    })
    return () => {
      cancelled = true
      io?.disconnect()
      document.removeEventListener('visibilitychange', sync)
      host.removeEventListener('pointermove', onPointer as EventListener)
      fieldRef.current?.destroy()
      fieldRef.current = null
    }
  }, [reduce])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="golive-aurora absolute inset-0" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full transition-opacity duration-[1600ms] ease-out"
        style={{ opacity: shown && !reduce ? 1 : 0 }}
      />
    </div>
  )
})
