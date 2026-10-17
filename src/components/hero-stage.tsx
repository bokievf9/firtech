'use client'

import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { ReactNode } from 'react'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// Hero backdrop and 3D stage. The whole hero listens to the pointer: a soft light follows it
// across the dot grid, and the demo on the right tilts a few degrees toward it. Motion values
// only, nothing re-renders while the mouse moves; touch and reduced motion get a still scene.
// `tilt={false}` keeps an interactive demo flat: controls that move under the cursor are hard to hit.
export function HeroStage({
  copy,
  demo,
  tilt = true,
  footer,
}: {
  copy: ReactNode
  demo: ReactNode
  tilt?: boolean
  footer?: ReactNode
}) {
  const reduce = useReducedMotion()
  const px = useMotionValue(0.7)
  const py = useMotionValue(0.3)
  const sx = useSpring(px, { stiffness: 60, damping: 20 })
  const sy = useSpring(py, { stiffness: 60, damping: 20 })

  const lightX = useTransform(sx, (v) => `${v * 100}%`)
  const lightY = useTransform(sy, (v) => `${v * 100}%`)
  const light = useMotionTemplate`radial-gradient(520px circle at ${lightX} ${lightY}, rgb(181 235 106 / 0.13), transparent 60%)`
  const gridMask = useMotionTemplate`radial-gradient(420px circle at ${lightX} ${lightY}, black, transparent 75%)`
  const rotateY = useTransform(sx, [0, 1], [-7, 7])
  const rotateX = useTransform(sy, [0, 1], [6, -6])

  return (
    <div
      className="relative"
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== 'mouse') return
        const r = e.currentTarget.getBoundingClientRect()
        px.set((e.clientX - r.left) / r.width)
        py.set((e.clientY - r.top) / r.height)
      }}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: light }}
      />
      <motion.div
        aria-hidden="true"
        className="dot-grid pointer-events-none absolute inset-0 opacity-70"
        style={reduce ? undefined : { maskImage: gridMask, WebkitMaskImage: gridMask }}
      />
      {/* Slow pine aurora in the corner: depth without a neon glow. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 right-[-14%] h-[720px] w-[820px] rounded-full bg-[radial-gradient(closest-side,rgb(29_58_42/0.9),transparent)] blur-2xl"
        animate={reduce ? undefined : { x: [0, -40, 0], y: [0, 30, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto grid min-h-[100dvh] max-w-7xl items-center gap-14 px-4 pt-28 pb-20 md:px-8 lg:grid-cols-12 lg:gap-8 lg:pt-24">
        <div className="lg:col-span-7">{copy}</div>
        <div className="lg:col-span-5 [perspective:1400px]">
          <motion.div
            style={
              reduce || !tilt ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }
            }
            initial={reduce ? false : { opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {demo}
          </motion.div>
        </div>
      </div>
      {footer}
    </div>
  )
}
