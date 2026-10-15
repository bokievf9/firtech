'use client'

import { motion, useScroll, useSpring } from 'motion/react'

// Thin accent line on top of the header that fills as the page is read.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 })
  return (
    <motion.div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 h-[2px] origin-left bg-accent"
      style={{ scaleX }}
    />
  )
}
