'use client'

import { animate, useInView } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// Counts a number up from zero the first time it scrolls into view. The final value is rendered
// on the server, so the real number is in the HTML before any script runs.
export function CountUp({
  value,
  prefix = '',
  suffix = '',
}: {
  value: number
  prefix?: string
  suffix?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || !inView || reduce || value === 0) return
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = `${prefix}${Math.round(v)}${suffix}`
      },
    })
    return () => controls.stop()
  }, [inView, reduce, value, prefix, suffix])

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value}
      {suffix}
    </span>
  )
}

// A live number: counts up from zero the first time, then glides from the old value to each new
// one (the hero's status line, polled every 15 s). Writes the DOM directly while it moves, so
// React renders once per change, not per frame. Reduced motion jumps straight to the value.
export function TickNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = shown.current
    if (reduce || from === value) {
      shown.current = value
      el.textContent = String(value)
      return
    }
    const controls = animate(from, value, {
      duration: from === 0 ? 1.4 : 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        shown.current = Math.round(v)
        el.textContent = String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [value, reduce])

  return (
    <span ref={ref} className="inline-block min-w-[1ch] text-right tabular-nums">
      0
    </span>
  )
}
