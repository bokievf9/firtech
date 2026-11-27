'use client'

import { animate, useMotionValue, useTransform, motion } from 'motion/react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { Dict } from '@/content'
import { filmScenes } from '@/lib/film'
import { spring } from '@/lib/motion'
import { RAIL_MIN, isHomePath, railAllowed, sectionsFor } from '@/lib/sections'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { jumpTo, sectionProgress, useNav } from './nav-store'

// The Fira marker is decorative and only needed after hydration: its SVG code loads on its own.
const FiraFlat = dynamic(() => import('../fira/fira-flat').then((m) => m.FiraFlat), { ssr: false })

const ROW = 28 // px per section (the storyboard's 8 x 28 px rail)
const MARK = 28 // marker size

// Desktop section rail (docs/motion-storyboard.md §3.2, 3.5): a thin vertical line on the right edge with
// one real <a href="#id"> tick per section. The server renders it for the home page; other pages fill it
// after hydration. The flat Fira marker sits on the active tick and rides the scroll toward the next one:
// a spring (damping 1.0) moves it between ticks and starts from the live position, the 0..1 progress
// inside a section is added on top, so a second section change mid-flight redirects it without a jump.
export function SectionRail({ rail }: { rail: Dict['rail'] }) {
  const pathname = usePathname()
  const nav = useNav()
  const reduce = useReducedMotion()
  const home = isHomePath(pathname)
  const fresh = nav.path === pathname
  const staticItems = useMemo(() => sectionsFor(pathname, { rail }), [pathname, rail])
  const items = fresh && nav.items.length ? nav.items : staticItems
  const active = fresh && nav.active >= 0 ? nav.active : 0
  const count = items.length
  const show = railAllowed(pathname) && count >= RAIL_MIN

  const list = useRef<HTMLOListElement>(null)
  const [rowH, setRowH] = useState(ROW)
  const idx = useMotionValue(active)
  const last = useRef(active)
  const reduceRef = useRef(reduce)
  useEffect(() => {
    reduceRef.current = reduce
  }, [reduce])

  useLayoutEffect(() => {
    const el = list.current
    if (!el || count === 0) return
    const measure = () => setRowH(el.clientHeight / count)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [count, show])

  const pos = useTransform([idx, sectionProgress], ([i, p]: number[]) => (i ?? 0) + (reduceRef.current ? 0 : (p ?? 0)))
  useEffect(() => pos.on('change', (v) => (last.current = v)), [pos])
  const transform = useTransform(pos, (v) => `translateY(${((v + 0.5) * rowH - MARK / 2).toFixed(2)}px)`)

  const prev = useRef(active)
  useEffect(() => {
    if (prev.current === active) return
    prev.current = active
    if (reduce) {
      idx.set(active)
      return
    }
    // Keep the marker where it is on screen, then spring to the new tick (a retarget, never a restart).
    idx.set(last.current - sectionProgress.get())
    const controls = animate(idx, active, spring.ui)
    return () => controls.stop()
  }, [active, idx, reduce])

  if (!show) return null

  const emotion = home ? (filmScenes[active]?.emotion ?? 'happy') : 'happy'

  const onClick = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    jumpTo(id, e.detail !== 0)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(e.key)) return
    const links = [...e.currentTarget.querySelectorAll<HTMLAnchorElement>('a[data-rail-tick]')]
    const at = links.findIndex((l) => l === document.activeElement)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? links.length - 1 : Math.min(links.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))
    e.preventDefault()
    links[next]?.focus()
  }

  return (
    <nav
      aria-label={rail.label}
      data-section-rail
      data-hidden={nav.paletteOpen ? 'true' : undefined}
      className="rail print-hidden fixed top-1/2 right-6 z-30 hidden -translate-y-1/2 lg:block"
    >
      <span aria-hidden="true" className="rail-pill material-thick pointer-events-none absolute -inset-y-2.5 -right-2 w-[10.5rem] rounded-2xl" />
      <ol ref={list} onKeyDown={onKeyDown} className="relative flex w-5 flex-col" style={{ height: `min(60vh, ${count * ROW}px)` }}>
        <span aria-hidden="true" className="absolute top-3.5 bottom-3.5 left-1/2 w-px -translate-x-1/2 bg-line-strong" />
        {items.map((item, i) => (
          <li key={item.id} className="relative min-h-0 flex-1">
            <a
              href={`#${item.id}`}
              data-rail-tick
              aria-label={item.label}
              aria-current={i === active ? 'location' : undefined}
              tabIndex={i === active ? 0 : -1}
              onClick={(e) => onClick(e, item.id)}
              className="rail-tick group relative flex h-full w-5 items-center justify-center rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent-text"
            >
              <span aria-hidden="true" className="rail-dot block size-1.5 rounded-full bg-faint" />
              <span aria-hidden="true" className="rail-label pointer-events-none absolute top-1/2 right-7 w-28 -translate-y-1/2 truncate text-right font-mono text-[11px] text-muted">
                {item.label}
              </span>
            </a>
          </li>
        ))}
        <motion.span
          aria-hidden="true"
          data-rail-fira
          className="rail-fira pointer-events-none absolute top-0 left-1/2 -ml-3.5 size-7"
          style={{ transform }}
        >
          <FiraFlat emotion={emotion} className="size-7" />
        </motion.span>
      </ol>
      <span aria-hidden="true" className="rail-hint pointer-events-none absolute -top-6 right-0 font-mono text-[10px] text-faint">
        {rail.hint}
      </span>
    </nav>
  )
}
