'use client'

import { animate, motion, useMotionTemplate, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef } from 'react'

const CELLS = 30
const BAND = 10
// Cell i shows digit (10 - i % 10) % 10: the next cell is the next lower digit and 0 wraps to 9, so
// a countdown always rolls forward through the column, never back across all ten digits.
const cellFor = (v: number) => BAND + ((10 - v) % 10)

// One digit that rolls vertically (odometer) with a short motion blur while it moves. Only the
// digits whose value changed move, each is its own element, so a tick touches one or two columns.
// `dir` -1 = counting down, +1 = counting up (after the deadline). Reduced motion swaps the text.
export function Digit({ value, dir, reduce }: { value: number; dir: 1 | -1; reduce: boolean }) {
  const pos = useMotionValue(cellFor(value))
  const blur = useMotionValue(0)
  const transform = useTransform(pos, (v) => `translateY(${(-v / CELLS) * 100}%)`)
  const filter = useMotionTemplate`blur(${blur}px)`
  const shown = useRef(value)
  const target = useRef(cellFor(value))

  useEffect(() => {
    if (reduce) {
      shown.current = value
      return
    }
    const from = shown.current
    if (from === value) return
    shown.current = value
    const step = dir === -1 ? (from - value + 10) % 10 : -((value - from + 10) % 10)
    target.current += step
    const goal = target.current
    animate(pos, goal, {
      type: 'spring',
      stiffness: 210,
      damping: 26,
      mass: 0.9,
      onComplete: () => {
        if (target.current !== goal) return
        const norm = ((goal - BAND) % 10 + 10) % 10 + BAND
        target.current = norm
        pos.jump(norm)
      },
    })
    animate(blur, [0, 3, 0], { duration: 0.38, ease: 'easeOut' })
  }, [value, dir, reduce, pos, blur])

  if (reduce) {
    return <span className="inline-block h-[1em] w-[0.74em] text-center leading-[1]">{value}</span>
  }
  return (
    <span className="relative inline-block h-[1em] w-[0.74em] overflow-hidden" aria-hidden="true">
      <motion.span className="absolute inset-x-0 top-0 flex flex-col" style={{ transform, filter }}>
        {Array.from({ length: CELLS }, (_, i) => (
          <span key={i} className="block h-[1em] text-center leading-[1]">
            {(10 - (i % 10)) % 10}
          </span>
        ))}
      </motion.span>
    </span>
  )
}
