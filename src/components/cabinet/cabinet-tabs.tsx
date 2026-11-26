'use client'

import { useSearchParams } from 'next/navigation'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Badge, TabList } from '@/components/ui'
import { parseTab, withTab, type CabinetTab } from '@/lib/cabinet-tabs'
import { fill } from './ui'

// Badge changes from the panels (a document accepted, a thread read): `{ documents?, messages? }`.
export const COUNTS_EVENT = 'cabinet:counts'
const UNREAD_POLL_MS = 30_000

// The cabinet home as tabs (owner 2026-11-21, v3 2026-11-22). The tab is in `?tab=` (history entries
// through the History API, which Next keeps in step with useSearchParams, so the server is not asked
// again). Only the active panel is mounted. The badge of «Сообщения» is refreshed every 30 s while the
// page is visible (`/api/cabinet/threads`) and by the panels through COUNTS_EVENT.
// Panels arrive as server-rendered nodes; the bar is the shared `TabList` (segmented track, sliding pill).
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
  // A link of the «new message» email (`?thread=`) lands on the messages, a «review» link on the projects.
  const landing: CabinetTab = search.get('thread') && tabs.includes('messages') ? 'messages' : defaultTab
  const tab = parseTab(search.get('tab'), landing, tabs)
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

  // The active tab is brought into view inside the bar only (never scrolls the page).
  useEffect(() => {
    const list = bar.current?.querySelector<HTMLElement>('[role="tablist"]')
    const active = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!list || !active) return
    const target = active.offsetLeft - (list.clientWidth - active.clientWidth) / 2
    list.scrollTo({ left: Math.max(0, target), behavior: 'auto' })
  }, [tab])

  function select(next: CabinetTab) {
    if (next === tab) return
    window.history.pushState(null, '', withTab(window.location.search, next))
  }

  return (
    <div className="mt-10" id="cabinet-tabs">
      <div ref={bar}>
        <TabList
          base="cabinet"
          label={labels.label}
          value={tab}
          onChange={select}
          itemProps={(id) => ({ 'data-cabinet-tab': id })}
          items={tabs.map((id) => ({
            id,
            label: (
              <span className="inline-flex items-center gap-2">
                {labels[id]}
                {counts[id] ? (
                  <Badge tone="solid" aria-label={fill(labels.badge, { n: String(counts[id]) })} className="min-w-5 justify-center font-mono">
                    {counts[id]}
                  </Badge>
                ) : null}
              </span>
            ),
          }))}
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
              {/* Keyed: a server node that is still streaming arrives as a lazy chunk, and React then checks
                  the keys of this pair (intermittent «unique key» warning, 2026-11-22). */}
              <Fragment key="panel">{panels[id]}</Fragment>
              <Fragment key="strip">{strip}</Fragment>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
