'use client'

import { useEffect, useRef, useState } from 'react'
import { cn, filterPill } from '@/components/admin/kit'
import { useReducedMotion } from '@/lib/use-reduced-motion'

export type NavItem = { id: string; label: string }

// Which section is under the top of the scroll area: the last one whose top has passed the line.
export function useActiveSection(ids: string[], line = 140) {
  const [active, setActive] = useState(ids[0] ?? '')
  const key = ids.join('|')
  useEffect(() => {
    const list = key.split('|').filter(Boolean)
    const els = list.map((id) => document.getElementById(id))
    const read = () => {
      let cur = list[0] ?? ''
      els.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= line) cur = list[i]!
      })
      setActive(cur)
    }
    const area = els[0]?.closest<HTMLElement>('[data-scroll-area], main, [data-hq-shell] div.overflow-y-auto') ?? null
    read()
    const target: HTMLElement | Window = area ?? window
    target.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => {
      target.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [key, line])
  return active
}

export function useJump() {
  const reduced = useReducedMotion()
  return (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

// Wide screens: the table of contents on the right, sticky, one line per section, the current one marked.
export function SectionRail({ items, active, label, className }: { items: NavItem[]; active: string; label: string; className?: string }) {
  const jump = useJump()
  return (
    <nav aria-label={label} className={cn('sticky top-20 self-start', className)} data-section-nav="rail">
      <p className="px-3 pb-1.5 text-caption text-faint">{label}</p>
      <ul className="grid gap-0.5">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              aria-current={active === it.id ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault()
                jump(it.id)
              }}
              className={cn('pressable block rounded-lg px-3 py-1.5 text-callout outline-none focus-visible:ring-2 focus-visible:ring-accent-text', active === it.id ? 'bg-elevated text-fg shadow-card' : 'text-muted hover:bg-fill hover:text-fg')}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// Phones and tablets: a compact strip of pills that scrolls sideways inside the page header; it follows the current section.
export function SectionStrip({ items, active, label, className }: { items: NavItem[]; active: string; label: string; className?: string }) {
  const jump = useJump()
  const strip = useRef<HTMLUListElement>(null)
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('[aria-current="location"]')
    const box = strip.current
    if (!el || !box) return
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: 'auto' })
  }, [active])
  return (
    <nav aria-label={label} className={cn('-mx-3 px-3 sm:mx-0 sm:px-0', className)} data-section-nav="strip">
      <ul ref={strip} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {items.map((it) => (
          <li key={it.id} className="shrink-0">
            <a
              href={`#${it.id}`}
              aria-current={active === it.id ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault()
                jump(it.id)
              }}
              className={filterPill(active === it.id, 'sm')}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
