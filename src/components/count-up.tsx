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
      duration: 1.6,
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
