'use client'

import { motion, useScroll, useTransform } from 'motion/react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { Dict } from '@/content'
import { RAIL_MIN, railAllowed, sectionsFor } from '@/lib/sections'
import { openSheet, useNav } from './nav-store'

const FiraFlat = dynamic(() => import('../fira/fira-flat').then((m) => m.FiraFlat), { ssr: false })

const MARK = 18

// Phone progress line (docs/motion-storyboard.md §3.3): a 2 px line directly under the header bar, filled
// by the whole-page scroll progress (scaleX, no per-frame React work). Section boundaries are 1 px gaps
// cut into the line by a CSS mask that is computed on layout changes only. The Fira marker rides the
// leading edge 1:1. A tap anywhere on the 44 px strip opens the section sheet. Replaces ScrollProgress.
export function ProgressLine({ rail }: { rail: Dict['rail'] }) {
  const pathname = usePathname()
  const nav = useNav()
  const { scrollYProgress } = useScroll()
  const [width, setWidth] = useState(0)
  const [mask, setMask] = useState<string | undefined>(undefined)
  const staticItems = useMemo(() => sectionsFor(pathname, { rail }), [pathname, rail])
  const items = nav.path === pathname && nav.items.length ? nav.items : staticItems
  const tappable = railAllowed(pathname) && items.length >= RAIL_MIN
  const x = useTransform(scrollYProgress, (v) => `translateX(${(v * width - MARK / 2).toFixed(1)}px)`)

  useEffect(() => {
    const measure = () => {
      setWidth(document.documentElement.clientWidth)
      if (!tappable) return setMask(undefined)
      const range = document.documentElement.scrollHeight - window.innerHeight
      if (range <= 0) return setMask(undefined)
      const stops: string[] = ['#000 0']
      items.forEach((item, i) => {
        if (i === 0) return
        const el = document.getElementById(item.id)
        if (!el) return
        const f = ((window.scrollY + el.getBoundingClientRect().top) / range) * 100
        if (f <= 0 || f >= 100) return
        stops.push(`#000 calc(${f.toFixed(2)}% - 0.5px)`, `transparent calc(${f.toFixed(2)}% - 0.5px)`, `transparent calc(${f.toFixed(2)}% + 0.5px)`, `#000 calc(${f.toFixed(2)}% + 0.5px)`)
      })
      setMask(stops.length > 1 ? `linear-gradient(to right, ${stops.join(', ')})` : undefined)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [items, tappable])

  const line = (
    <>
      <span aria-hidden="true" className="relative block h-0.5 w-full" style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}>
        <span className="absolute inset-0 bg-line-strong" />
        <motion.span className="absolute inset-0 origin-left bg-accent" style={{ scaleX: scrollYProgress }} />
      </span>
      <motion.span aria-hidden="true" data-progress-fira className="rail-fira pointer-events-none absolute top-1/2 left-0 -mt-[9px] size-[18px]" style={{ transform: x }}>
        <FiraFlat emotion="happy" className="size-[18px]" />
      </motion.span>
    </>
  )

  return (
    <div className="progress-line print-hidden fixed inset-x-0 top-16 z-40 md:top-[4.25rem] lg:hidden" data-progress-line>
      {tappable ? (
        <button
          type="button"
          aria-label={rail.open}
          aria-haspopup="dialog"
          onClick={openSheet}
          className="relative -mt-[21px] flex h-11 w-full items-center outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-accent-text"
        >
          {line}
        </button>
      ) : (
        <div className="pointer-events-none relative flex h-0.5 w-full items-center">{line}</div>
      )}
    </div>
  )
}
