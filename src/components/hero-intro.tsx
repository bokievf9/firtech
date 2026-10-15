'use client'

import { motion } from 'motion/react'
import { Children, type ReactNode } from 'react'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// Staggers the hero's headline, text and buttons in on first paint.
export function HeroIntro({
  children,
  className,
  delay = 0.08,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  return (
    <div className={className}>
      {Children.map(children, (child, i) => (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: delay + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}
