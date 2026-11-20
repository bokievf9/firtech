'use client'

import { Code, FileText, PhoneCall, RocketLaunch, ShieldCheck } from '@phosphor-icons/react'
import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const icons = [PhoneCall, FileText, Code, RocketLaunch]

const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia('(min-width: 1024px)')
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

// «Как работаем» (#process): a sticky horizontal timeline on large screens. The section is as tall
// as the track is wide, so vertical scroll pans the four steps and the rules card sideways while a
// line fills under them. Phones and reduced motion: the same cards in a plain vertical list.
export function WorkTimeline({ dict }: { dict: Dict }) {
  const w = dict.work
  const steps = dict.process.steps
  const section = useRef<HTMLElement>(null)
  const track = useRef<HTMLOListElement>(null)
  const reduce = useReducedMotion()
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => false,
  )
  const pinned = wide && !reduce
  const [distance, setDistance] = useState(0)

  useEffect(() => {
    if (!pinned) return
    const el = track.current
    if (!el) return
    const measure = () => setDistance(Math.max(0, el.scrollWidth - window.innerWidth + 64))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [pinned])

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 })
  const x = useTransform(progress, (v) => -v * distance)

  return (
    <section
      ref={section}
      id="process"
      className="relative"
      style={pinned && distance ? { height: `calc(100vh + ${distance}px)` } : undefined}
    >
      <div className={cn(pinned ? 'sticky top-0 flex h-[100dvh] flex-col justify-center overflow-hidden' : 'py-section')}>
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{w.eyebrow}</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-[18ch] font-display text-title font-semibold">{w.title}</h2>
            <p className="max-w-[36ch] text-lead text-muted">{w.sub}</p>
          </div>
        </div>

        <div className="relative mt-12 lg:mt-16">
          <motion.ol
            ref={track}
            className={cn(
              'grid gap-gutter px-4 md:grid-cols-2 md:px-8',
              pinned && 'flex w-max pr-[20vw] pl-[max(2rem,calc((100vw-var(--container-7xl))/2+2rem))]',
            )}
            style={pinned ? { x } : undefined}
          >
            {steps.map((step, i) => {
              const Icon = icons[i] ?? Code
              return (
                <li
                  key={step.title}
                  className={cn(
                    'relative flex flex-col justify-between gap-10 rounded-card border border-line bg-surface p-6 md:p-8',
                    pinned && 'h-[23rem] w-[26rem] shrink-0 min-[1920px]:w-[30rem]',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-full border border-accent-text/40 text-accent-text">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="font-display text-6xl font-semibold tracking-tight text-fg/10">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
                      {w.step} {i + 1}
                    </p>
                    <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-3 max-w-[36ch] leading-relaxed text-muted">{step.text}</p>
                  </div>
                </li>
              )
            })}
            <li
              className={cn(
                'rounded-card border border-accent-text/30 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_70%)] p-6 md:p-8',
                pinned && 'h-[23rem] w-[38rem] shrink-0 min-[1920px]:w-[44rem]',
              )}
            >
              <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-accent-text uppercase">
                <ShieldCheck size={16} aria-hidden="true" />
                {w.rulesTitle}
              </p>
              <ul className="mt-6 grid gap-5 sm:grid-cols-2">
                {w.rules.map((rule) => (
                  <li key={rule.title}>
                    <p className="font-medium">{rule.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{rule.text}</p>
                  </li>
                ))}
              </ul>
            </li>
          </motion.ol>
          {pinned && (
            <div className="mx-auto mt-10 h-px max-w-7xl bg-line" aria-hidden="true">
              <motion.div className="h-full origin-left bg-accent" style={{ scaleX: progress }} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
