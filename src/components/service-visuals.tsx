'use client'

import {
  Browser,
  ChartBar,
  DeviceMobile,
  Lightning,
  Robot,
  Table,
  TelegramLogo,
} from '@phosphor-icons/react'
import { motion, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const ease = [0.16, 1, 0.3, 1] as const

// Live miniatures for the service cards. Each one shows the product doing its job, not a picture
// of it, and only runs while it is on screen.

// A landing page assembling itself block by block, ending on the enquiry button.
export function SiteAssembly({ term, label }: { term: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const reduce = useReducedMotion()
  const show = reduce || inView
  const block = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 14, scale: 0.98 },
    animate: show ? { opacity: 1, y: 0, scale: 1 } : undefined,
    transition: { duration: 0.6, delay: 0.15 + i * 0.12, ease },
  })

  return (
    <div ref={ref} className="grid items-end gap-6 pt-4 sm:grid-cols-[1fr_auto]">
      <div>
        <p className="font-mono text-5xl tracking-tight md:text-6xl">{term}</p>
        <p className="mt-2 text-sm text-faint">{label}</p>
      </div>
      <div className="w-full max-w-[260px] overflow-hidden rounded-xl border border-line-strong bg-bg/70 sm:w-[240px]">
        <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <Browser size={12} className="ml-auto text-faint" />
        </div>
        <div className="grid gap-2 p-3">
          <motion.div {...block(0)} className="h-2.5 w-3/5 rounded-full bg-fg/80" />
          <motion.div {...block(1)} className="h-2 w-4/5 rounded-full bg-fg/25" />
          <motion.div {...block(2)} className="grid grid-cols-3 gap-1.5 pt-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-10 rounded-md bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface-2))]"
              />
            ))}
          </motion.div>
          <motion.div
            {...block(3)}
            className="mt-1 flex h-7 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-ink"
          >
            <motion.span
              className="h-1.5 w-12 rounded-full bg-accent-ink/70"
              animate={show && !reduce ? { scaleX: [1, 0.7, 1] } : undefined}
              transition={{ duration: 1.6, delay: 1.2, repeat: Infinity, repeatDelay: 1.4 }}
            />
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// Three phones that fan out when the card comes into view; the middle one is the app.
export function PhoneFan() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const reduce = useReducedMotion()
  const open = reduce || inView
  const phones = [
    { rotate: -12, x: -18, y: 10 },
    { rotate: 0, x: 0, y: -14 },
    { rotate: 12, x: 18, y: 10 },
  ]

  return (
    <div ref={ref} className="flex h-36 items-end justify-center gap-3 pt-6 sm:justify-start">
      {phones.map((p, i) => (
        <motion.div
          key={i}
          initial={reduce ? false : { rotate: 0, x: 0, y: 30, opacity: 0 }}
          animate={open ? { rotate: p.rotate, x: p.x, y: p.y, opacity: 1 } : undefined}
          transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.1 + i * 0.08 }}
          className={cn(
            'flex h-28 w-16 flex-col gap-1.5 rounded-[16px] border bg-bg/60 p-2',
            i === 1 ? 'z-10 border-accent/50' : 'border-line-strong',
          )}
        >
          <span className="mx-auto h-1 w-5 rounded-full bg-line-strong" />
          {i === 1 ? (
            <>
              <span className="h-6 rounded-md bg-accent/80" />
              <span className="h-1.5 w-4/5 rounded-full bg-fg/30" />
              <span className="h-1.5 w-3/5 rounded-full bg-fg/20" />
              <span className="mt-auto flex justify-center">
                <DeviceMobile size={14} className="text-accent" />
              </span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-4/5 rounded-full bg-fg/15" />
              <span className="h-8 rounded-md bg-fg/[0.06]" />
              <span className="h-1.5 w-3/5 rounded-full bg-fg/15" />
            </>
          )}
        </motion.div>
      ))}
    </div>
  )
}

// Site -> Telegram -> AI -> CRM -> Sheets, with a signal passing along the chain on a loop.
export function FlowChain({ site }: { site: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const steps = [
    { icon: Browser, label: site },
    { icon: TelegramLogo, label: 'Telegram' },
    { icon: Robot, label: 'AI' },
    { icon: Table, label: 'CRM' },
    { icon: ChartBar, label: 'Sheets' },
  ]

  useEffect(() => {
    if (reduce || !inView) return
    const timer = setInterval(() => setActive((a) => (a + 1) % (steps.length + 2)), 650)
    return () => clearInterval(timer)
  }, [reduce, inView, steps.length])

  return (
    <div ref={ref} className="flex flex-wrap items-center gap-2">
      {steps.map(({ icon: Icon, label }, i) => {
        const lit = !reduce && active >= i && active < steps.length + 1
        return (
          <span key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full border bg-bg/50 px-3.5 py-2 text-sm transition-[border-color,color,background-color] duration-300',
                lit ? 'border-accent/70 bg-accent/[0.08] text-fg' : 'border-line-strong text-muted',
              )}
            >
              <Icon
                size={16}
                className={cn('transition-colors duration-300', lit ? 'text-accent' : 'text-faint')}
              />
              {label}
            </span>
            {i < steps.length - 1 && (
              <Lightning
                size={12}
                weight="fill"
                className={cn(
                  'transition-colors duration-300',
                  lit && active > i ? 'text-accent' : 'text-faint',
                )}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}
