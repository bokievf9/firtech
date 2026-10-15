'use client'

import { motion, useMotionValue, useSpring } from 'motion/react'
import type { ReactNode } from 'react'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// Pulls its child a few pixels toward the pointer: the main call to action feels alive under the
// cursor. Motion values only, so moving the mouse never re-renders React. Touch screens skip it.
export function Magnetic({
  children,
  strength = 0.28,
  className,
}: {
  children: ReactNode
  strength?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.6 })

  return (
    <motion.div
      className={className ?? 'inline-flex'}
      style={reduce ? undefined : { x: sx, y: sy }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== 'mouse') return
        const r = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - (r.left + r.width / 2)) * strength)
        y.set((e.clientY - (r.top + r.height / 2)) * strength)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}
