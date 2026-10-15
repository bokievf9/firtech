'use client'

import { ArrowRight, Clock } from '@phosphor-icons/react'
import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import Link from 'next/link'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn, homeAnchor } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { estimate, formatUsd } from '@/lib/pricing'
import type { ServiceSlug } from '@/lib/site'
import { RiseText } from './rise-text'
import { CafeDemo, DeliveryDemo, SalesDemo, SalonDemo } from './showcase-demos'
import { useReducedMotion } from '@/lib/use-reduced-motion'

type CaseId = keyof Dict['showcase']['items']

// Each concept is priced from the real calculator, so the numbers on the card match the estimator.
const cases: { id: CaseId; service: ServiceSlug; variant: string; addons: string[] }[] = [
  { id: 'cafe', service: 'websites', variant: 'landing', addons: ['telegram'] },
  { id: 'salon', service: 'bots', variant: 'booking', addons: [] },
  { id: 'delivery', service: 'bots', variant: 'miniapp', addons: ['payments'] },
  { id: 'sales', service: 'automation', variant: 'crm', addons: ['alerts'] },
]

// Concept projects in a horizontal track. On wide screens the section pins and vertical scrolling
// pans the track sideways (Motion useScroll, no scroll listeners); on phones, with reduced motion,
// or before measuring, the cards simply stack.
export function Showcase({ locale, dict }: { locale: Locale; dict: Dict }) {
  const s = dict.showcase
  const reduce = useReducedMotion()
  const outer = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState<{ distance: number; height: number } | null>(null)

  useLayoutEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const measure = () => {
      if (!track.current || !query.matches || reduce) return setPan(null)
      const distance = track.current.scrollWidth - window.innerWidth
      setPan(distance > 0 ? { distance, height: window.innerHeight + distance } : null)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (track.current) ro.observe(track.current)
    query.addEventListener('change', measure)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      query.removeEventListener('change', measure)
      window.removeEventListener('resize', measure)
    }
  }, [reduce])

  const { scrollYProgress } = useScroll({ target: outer, offset: ['start start', 'end end'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })
  const x = useTransform(smooth, [0, 1], [0, -(pan?.distance ?? 0)])

  const demos: Record<CaseId, ReactNode> = {
    cafe: <CafeDemo t={s.demo} business={s.items.cafe.business} />,
    salon: <SalonDemo t={s.demo} />,
    delivery: <DeliveryDemo t={s.demo} />,
    sales: <SalesDemo t={s.demo} />,
  }

  return (
    <section
      ref={outer}
      id="examples"
      className="relative"
      style={pan ? { height: pan.height } : undefined}
    >
      <div
        className={cn(
          pan && 'sticky top-0 flex h-[100dvh] flex-col justify-center overflow-hidden',
        )}
      >
        <div className="mx-auto w-full max-w-7xl px-4 pt-24 md:px-8 lg:pt-24">
          <RiseText
            text={s.title}
            className="text-4xl font-semibold tracking-[-0.035em] md:text-6xl [@media(min-width:1024px)_and_(max-height:860px)]:text-5xl"
          />
          <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted [@media(min-width:1024px)_and_(max-height:860px)]:mt-3 [@media(min-width:1024px)_and_(max-height:860px)]:text-base">
            {s.sub}
          </p>
        </div>

        <motion.div
          ref={track}
          style={pan ? { x } : undefined}
          className={cn(
            'mt-12 [@media(min-width:1024px)_and_(max-height:860px)]:mt-7 flex flex-col gap-4 px-4 pb-24 md:px-8 lg:flex-row lg:gap-6 lg:pr-[8vw] lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))]',
            // Pinned: the track is as wide as its cards and Motion slides it. Not pinned (reduced
            // motion): it becomes a normal horizontal scroller that snaps to each card.
            pan
              ? 'lg:w-max lg:pb-0'
              : 'lg:snap-x lg:snap-mandatory lg:overflow-x-auto lg:scroll-pl-8',
          )}
        >
          {cases.map((c) => {
            const item = s.items[c.id]
            const { min } = estimate(c.service, c.variant, c.addons)
            return (
              <article
                key={c.id}
                className="grid shrink-0 snap-start overflow-hidden rounded-card border border-line bg-surface lg:h-[min(560px,64dvh)] lg:w-[min(1040px,82vw)] lg:grid-cols-[1.05fr_1fr]"
              >
                <div className="flex flex-col p-6 md:p-10">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted">{item.business}</span>
                    <span className="ml-auto rounded-full border border-line-strong px-2.5 py-0.5 text-xs text-faint">
                      {s.concept}
                    </span>
                  </div>
                  <h3 className="mt-6 text-3xl leading-tight font-semibold tracking-[-0.03em] md:text-4xl">
                    {item.title}
                  </h3>
                  <dl className="mt-6 grid gap-4 text-[15px] leading-relaxed">
                    <div>
                      <dt className="text-sm text-faint">{s.task}</dt>
                      <dd className="mt-1 text-muted">{item.task}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-faint">{s.result}</dt>
                      <dd className="mt-1">{item.result}</dd>
                    </div>
                  </dl>
                  <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 lg:mt-auto">
                    <p className="font-mono text-2xl text-accent">
                      <span className="text-sm text-muted">{s.from} </span>
                      {formatUsd(min)}
                    </p>
                    <p className="flex items-center gap-1.5 text-sm text-muted">
                      <Clock size={15} />
                      {item.term}
                    </p>
                    <Link
                      href={homeAnchor(locale, 'contact')}
                      className={cn(buttonStyles.secondary, 'group ml-auto py-2.5')}
                    >
                      {s.cta}
                      <ArrowRight
                        size={14}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </Link>
                  </div>
                </div>
                <div className="dot-grid relative flex items-center justify-center overflow-hidden border-t border-line bg-bg/40 px-4 lg:border-t-0 lg:border-l">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(closest-side,rgb(29_58_42/0.7),transparent)]"
                  />
                  <div className="relative">{demos[c.id]}</div>
                </div>
              </article>
            )
          })}
        </motion.div>

        {pan && (
          <div className="mx-auto mt-8 w-full max-w-7xl px-8" aria-hidden="true">
            <div className="h-px w-40 overflow-hidden bg-line">
              <motion.div className="h-full origin-left bg-accent" style={{ scaleX: smooth }} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
