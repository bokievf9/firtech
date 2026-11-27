'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import type { Dict } from '@/content'
import { ACTIVE_LINE, activeScene, filmScenes } from '@/lib/film'
import type { Locale } from '@/lib/i18n'
import {
  PAGE_LINE,
  activeIndex,
  collectSections,
  isHomePath,
  railAllowed,
  sectionProgress as progressOf,
  sectionsFor,
  type RailItem,
} from '@/lib/sections'
import { sameItems, sectionProgress, setNav } from './nav-store'

// The one writer of the navigation store: finds the sections of the current page, follows the scroll
// (one rAF-throttled passive listener, at most a dozen getBoundingClientRect reads per frame, no React
// state per frame) and keeps the active index and the 0..1 progress toward the next section.
// Home uses the film's own `activeScene` and ACTIVE_LINE so the rail and the WebGL Fira never disagree.
export function SectionTracker({ locale, rail }: { locale: Locale; rail: Dict['rail'] }) {
  const pathname = usePathname()

  useEffect(() => {
    if (!railAllowed(pathname)) {
      setNav({ path: pathname, items: [], active: -1 })
      return
    }
    const home = isHomePath(pathname)
    let items: RailItem[] = home ? sectionsFor(pathname, { rail }) : []
    let raf = 0
    setNav({ path: pathname, items, active: items.length ? 0 : -1 })

    const elFor = (i: number): HTMLElement | null => {
      const item = items[i]
      if (!item) return null
      if (home) {
        const scene = filmScenes[i]
        return (scene && document.querySelector<HTMLElement>(`[data-film-scene="${scene.id}"]`)) || document.getElementById(item.id)
      }
      return document.getElementById(item.id) ?? document.querySelector<HTMLElement>(`[data-rail][id="${item.id}"]`)
    }

    const frame = () => {
      raf = 0
      if (!items.length) return
      const vh = window.innerHeight
      const rects = items.map((_, i) => elFor(i)?.getBoundingClientRect() ?? null)
      const tops = rects.map((r, i) => r?.top ?? (i === 0 ? 0 : Number.POSITIVE_INFINITY))
      let idx: number
      let line: number
      if (home) {
        line = ACTIVE_LINE
        const id = activeScene(
          rects.map((r, i) => ({ id: String(i), top: r?.top ?? Number.POSITIVE_INFINITY, bottom: r?.bottom ?? Number.POSITIVE_INFINITY })),
          vh,
        )
        idx = id === null ? 0 : Number(id)
      } else {
        line = PAGE_LINE
        const atBottom = window.scrollY + vh >= document.documentElement.scrollHeight - 2
        idx = activeIndex(tops, vh, line, atBottom && window.scrollY > 0)
      }
      sectionProgress.set(progressOf(tops, idx, vh, line))
      setNav({ active: idx })
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }

    const refresh = () => {
      if (!home) {
        const next = collectSections(locale)
        if (!sameItems(items, next)) {
          items = next
          setNav({ path: pathname, items })
        }
      }
      schedule()
    }
    refresh()
    const later = window.setTimeout(refresh, 500)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('load', refresh)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(later)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('load', refresh)
    }
  }, [pathname, locale, rail])

  return null
}
