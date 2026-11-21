'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { parseTab, tabFromKey, withTab, type CabinetTab } from '@/lib/cabinet-tabs'
import { fill } from './ui'

// Badge changes from the panels (a document accepted, a thread read): `{ documents?, messages? }`.
export const COUNTS_EVENT = 'cabinet:counts'
const UNREAD_POLL_MS = 30_000

// The cabinet home as tabs (owner 2026-11-21, v3 2026-11-22). The tab is in `?tab=` (history entries
// through the History API, which Next keeps in step with useSearchParams, so the server is not asked
// again). Only the active panel is mounted. The badge of «Сообщения» is refreshed every 30 s while the
// page is visible (`/api/cabinet/threads`) and by the panels through COUNTS_EVENT.
// Panels arrive as server-rendered nodes; the bar scrolls sideways on phones with fading edges.
export function CabinetTabs({
  labels,
  tabs,
  counts: initialCounts,
  defaultTab,
  panels,
  strip,
  pollUnread = true,
}: {
  labels: Record<CabinetTab | 'label' | 'badge', string>
  tabs: readonly CabinetTab[]
  counts: Partial<Record<CabinetTab, number>>
  defaultTab: CabinetTab
  panels: Partial<Record<CabinetTab, ReactNode>>
  // The slim «Предложения» strip under every tab.
  strip: ReactNode
  pollUnread?: boolean
}) {
  const search = useSearchParams()
  const tab = parseTab(search.get('tab'), defaultTab, tabs)
  const [counts, setCounts] = useState(initialCounts)

  useEffect(() => {
    const onCounts = (e: Event) => {
      const detail = (e as CustomEvent<Partial<Record<CabinetTab, number>>>).detail ?? {}
      setCounts((c) => {
        const next = { ...c, ...detail }
        for (const key of Object.keys(detail) as CabinetTab[]) if (!next[key]) delete next[key]
        return next
      })
    }
    window.addEventListener(COUNTS_EVENT, onCounts)
    return () => window.removeEventListener(COUNTS_EVENT, onCounts)
  }, [])

  useEffect(() => {
    if (!pollUnread) return
    let alive = true
    async function load() {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/cabinet/threads', { cache: 'no-store' })
        const body = (await res.json().catch(() => null)) as { ok?: boolean; unread?: number } | null
        if (alive && res.ok && body?.ok && typeof body.unread === 'number') {
          const n = body.unread
          setCounts((c) => {
            if ((c.messages ?? 0) === n) return c
            const next = { ...c }
            if (n > 0) next.messages = n
            else delete next.messages
            return next
          })
        }
      } catch {
        // Offline for a moment: the next tick tries again.
      }
    }
    const timer = window.setInterval(load, UNREAD_POLL_MS)
    const onVisible = () => void load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pollUnread])
  const bar = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = () => {
    const el = bar.current
    if (!el) return
    const left = el.scrollLeft > 4
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }))
  }

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // The active tab is brought into view inside the bar only (never scrolls the page).
  useEffect(() => {
    const el = bar.current
    const active = el?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!el || !active) return
    const target = active.offsetLeft - (el.clientWidth - active.clientWidth) / 2
    el.scrollTo({ left: Math.max(0, target), behavior: 'auto' })
    measure()
  }, [tab])

  function select(next: CabinetTab) {
    if (next === tab) return
    window.history.pushState(null, '', withTab(window.location.search, next))
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const next = tabFromKey(tab, e.key, tabs)
    if (!next) return
    e.preventDefault()
    select(next)
    document.getElementById(`cabinet-tab-${next}`)?.focus()
  }

  return (
    <div className="mt-10" id="cabinet-tabs">
      <div className="relative -mx-4 md:mx-0">
        <div
          ref={bar}
          role="tablist"
          aria-label={labels.label}
          onScroll={measure}
          className="flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((id) => {
            const active = id === tab
            const count = counts[id]
            return (
              <button
                key={id}
                id={`cabinet-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`cabinet-panel-${id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => select(id)}
                onKeyDown={onKeyDown}
                data-cabinet-tab={id}
                className={cn(
                  '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 text-[15px] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-text md:px-4',
                  active ? 'border-accent-text text-fg' : 'border-transparent text-muted hover:text-fg',
                )}
              >
                {labels[id]}
                {count ? (
                  <span
                    aria-label={fill(labels.badge, { n: String(count) })}
                    className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 font-mono text-[11px] leading-5 text-accent-ink"
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-0 bottom-px left-0 w-8 bg-gradient-to-r from-bg to-transparent transition-opacity md:hidden',
            edges.left ? 'opacity-100' : 'opacity-0',
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-0 right-0 bottom-px w-8 bg-gradient-to-l from-bg to-transparent transition-opacity md:hidden',
            edges.right ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>

      {tabs.map((id) => (
        <div
          key={id}
          id={`cabinet-panel-${id}`}
          role="tabpanel"
          aria-labelledby={`cabinet-tab-${id}`}
          hidden={id !== tab}
          tabIndex={0}
          className="mt-8 focus-visible:outline-none"
        >
          {id === tab && (
            <div className="grid gap-gutter">
              {panels[id]}
              {strip}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
