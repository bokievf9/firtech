'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { reveal } from '@/lib/motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// Fades a block up as it enters the viewport, once. Used to pace the page section by section.
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      data-reveal
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ ...reveal, delay }}
    >
      {children}
    </motion.div>
  )
}
