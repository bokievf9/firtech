'use client'

import { Code, FileText, PhoneCall, RocketLaunch } from '@phosphor-icons/react'
import { motion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import type { Dict } from '@/content'
import { RiseText } from './rise-text'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const icons = [PhoneCall, FileText, Code, RocketLaunch]

// The line between the steps fills as the section scrolls by: it reads as "this is the order".
export function Process({ dict }: { dict: Dict }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 60%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 20 })

  return (
    <section id="process" className="mx-auto site-container py-24 md:py-36">
      <RiseText
        text={dict.process.title}
        className="text-4xl font-semibold tracking-[-0.035em] md:text-6xl"
      />
      <div ref={ref} className="relative mt-16">
        <div
          className="absolute top-5 right-0 left-5 hidden h-px bg-line md:block"
          aria-hidden="true"
        >
          <motion.div
            className="h-full origin-left bg-accent"
            style={{ scaleX: reduce ? 1 : progress }}
          />
        </div>
        <div className="absolute top-0 bottom-0 left-5 w-px bg-line md:hidden" aria-hidden="true">
          <motion.div
            className="h-full w-full origin-top bg-accent"
            style={{ scaleY: reduce ? 1 : progress }}
          />
        </div>
        <ol className="grid gap-10 md:grid-cols-4 md:gap-8">
          {dict.process.steps.map((step, i) => {
            const Icon = icons[i] ?? Code
            return (
              <motion.li
                key={step.title}
                data-reveal
                className="relative pl-16 md:pl-0"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                <StepDot progress={progress} at={i / dict.process.steps.length} reduce={!!reduce}>
                  <Icon size={18} />
                </StepDot>
                <h3 className="text-xl font-semibold tracking-tight md:mt-8">{step.title}</h3>
                <p className="mt-3 max-w-[34ch] leading-relaxed text-muted">{step.text}</p>
              </motion.li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

// The step's circle turns lime once the progress line reaches it.
function StepDot({
  progress,
  at,
  reduce,
  children,
}: {
  progress: MotionValue<number>
  at: number
  reduce: boolean
  children: React.ReactNode
}) {
  const range = [Math.max(0, at - 0.02), at + 0.06]
  // The fill amount (0..1) is a CSS variable; the colours mix in CSS so they follow the theme.
  const fill = useTransform(progress, range, [0, 1])
  const scale = useTransform(progress, [at - 0.02, at + 0.03, at + 0.1], [1, 1.18, 1])
  return (
    <motion.span
      className="absolute top-0 left-0 flex size-10 items-center justify-center rounded-full border border-line-strong bg-[color-mix(in_oklab,var(--color-accent)_calc(var(--p)*100%),var(--color-bg))] text-[color-mix(in_oklab,var(--color-accent-ink)_calc(var(--p)*100%),var(--color-accent-text))] md:relative"
      style={reduce ? ({ '--p': 1 } as object) : ({ '--p': fill, scale } as object)}
    >
      {children}
    </motion.span>
  )
}
