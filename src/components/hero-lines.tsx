'use client'

import { motion } from 'motion/react'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const ease = [0.16, 1, 0.3, 1] as const

// The hero headline, line by line from under a mask. Decorative: the h1 also carries the plain
// sentence for search engines and screen readers.
export function HeroLines({ lines, accent }: { lines: string[]; accent: number }) {
  const reduce = useReducedMotion()
  return (
    <span aria-hidden="true" className="block">
      {lines.map((line, i) => (
        <span key={line} className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
          <motion.span
            className={i === accent ? 'block text-accent' : 'block'}
            initial={reduce ? false : { y: '110%' }}
            animate={{ y: '0%' }}
            transition={{ duration: 1, delay: 0.05 + i * 0.12, ease }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </span>
  )
}
