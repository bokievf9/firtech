'use client'

import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { motion, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { RiseText } from './rise-text'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const ease = [0.16, 1, 0.3, 1] as const

// "Now" versus "with Fir Tech" behind one switch. It flips by itself once, shortly after the
// section comes into view, so the visitor sees the change happen; after that it is theirs.
// Both texts share one grid cell, so switching never moves the layout.
export function Pains({ dict }: { dict: Dict }) {
  const p = dict.pains
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.45 })
  const reduce = useReducedMotion()
  const [after, setAfter] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!inView || touched) return
    const timer = setTimeout(() => setAfter(true), reduce ? 0 : 1400)
    return () => clearTimeout(timer)
  }, [inView, touched, reduce])

  return (
    <section className="border-y border-line bg-surface/40">
      <div ref={ref} className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-36">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <RiseText
              text={p.title}
              className="text-4xl font-semibold tracking-[-0.035em] md:text-6xl"
            />
            <p className="mt-5 text-lg text-muted">{p.sub}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={after}
            aria-label={p.toggle}
            onClick={() => {
              setTouched(true)
              setAfter((v) => !v)
            }}
            className="relative grid w-full shrink-0 grid-cols-2 rounded-full border border-line-strong bg-bg p-1 text-sm font-medium sm:w-[340px]"
          >
            <motion.span
              aria-hidden="true"
              className={cn(
                'absolute inset-y-1 w-[calc(50%-4px)] rounded-full',
                after ? 'bg-accent' : 'bg-surface-2',
              )}
              animate={{ x: after ? 'calc(100% + 0px)' : '0%' }}
              style={{ left: 4 }}
              transition={
                reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 }
              }
            />
            <span
              className={cn(
                'relative z-10 py-3 transition-colors duration-300',
                after ? 'text-muted' : 'text-fg',
              )}
            >
              {p.before}
            </span>
            <span
              className={cn(
                'relative z-10 py-3 transition-colors duration-300',
                after ? 'text-accent-ink' : 'text-muted',
              )}
            >
              {p.after}
            </span>
          </button>
        </div>

        <ul className="mt-14 grid gap-3 md:grid-cols-2 md:gap-4" aria-live="polite">
          {p.items.map((item, i) => (
            <li
              key={item.pain}
              className={cn(
                'grid rounded-card border p-6 transition-[border-color,background-color] duration-500 md:p-7',
                after ? 'border-accent/25 bg-pine/25' : 'border-line bg-bg/40',
              )}
            >
              <Face shown={!after} delay={i * 0.04} reduce={!!reduce}>
                <XCircle size={22} weight="light" className="mt-0.5 shrink-0 text-faint" />
                <span className="text-lg leading-snug text-muted">{item.pain}</span>
              </Face>
              <Face shown={after} delay={i * 0.06} reduce={!!reduce}>
                <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-accent" />
                <span className="text-lg leading-snug">{item.fix}</span>
              </Face>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Face({
  shown,
  delay,
  reduce,
  children,
}: {
  shown: boolean
  delay: number
  reduce: boolean
  children: React.ReactNode
}) {
  return (
    <motion.p
      aria-hidden={!shown}
      className="col-start-1 row-start-1 flex gap-3"
      initial={false}
      animate={
        shown
          ? { opacity: 1, y: 0, filter: 'blur(0px)' }
          : { opacity: 0, y: shown ? 0 : -10, filter: 'blur(4px)' }
      }
      transition={
        reduce ? { duration: 0 } : { duration: 0.55, delay: shown ? delay + 0.12 : 0, ease }
      }
    >
      {children}
    </motion.p>
  )
}
