'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const ease = [0.16, 1, 0.3, 1] as const

// "We launch [websites / bots / apps / automation] for your business": the changing word names
// every service in the first second. The h1 keeps the plain sentence for search engines and
// screen readers; the animated version is decorative.
export function HeroHeadline({
  title,
  lead,
  words,
  tail,
}: {
  title: string
  lead: string
  words: string[]
  tail: string
}) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduce) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % words.length), 2600)
    return () => clearInterval(timer)
  }, [reduce, words.length])

  return (
    <h1 className="text-[clamp(2.5rem,4.7vw,4.6rem)] leading-[1.02] font-semibold tracking-[-0.045em]">
      <span className="sr-only">{title}</span>
      <span aria-hidden="true" className="block">
        <Line delay={0.05}>{lead}</Line>
        <span className="relative block h-[1.16em] overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={words[index]}
              className="absolute inset-x-0 top-0 block whitespace-nowrap text-accent"
              initial={reduce ? false : { y: '105%', filter: 'blur(8px)', opacity: 0 }}
              animate={{ y: '0%', filter: 'blur(0px)', opacity: 1 }}
              exit={reduce ? undefined : { y: '-105%', filter: 'blur(8px)', opacity: 0 }}
              transition={{ duration: 0.8, ease }}
            >
              {words[index]}
            </motion.span>
          </AnimatePresence>
          {/* Keeps the line tall on the first paint before the word animates in. */}
          <span className="invisible block whitespace-nowrap">{words[0]}</span>
        </span>
        <Line delay={0.18}>{tail}</Line>
      </span>
    </h1>
  )
}

function Line({ children, delay }: { children: string; delay: number }) {
  const reduce = useReducedMotion()
  return (
    <span className="-mb-[0.1em] block overflow-hidden pb-[0.1em]">
      <motion.span
        className="block"
        initial={reduce ? false : { y: '105%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 1, delay, ease }}
      >
        {children}
      </motion.span>
    </span>
  )
}
