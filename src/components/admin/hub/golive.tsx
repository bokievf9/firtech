'use client'

import { Timer } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errText } from '@/components/admin/control/api'
import { goliveText as t } from '@/content/golive'
import { cn } from '@/lib/cn'
import { applyAction, chipText, parseAction, remaining, type GoliveAction, type GoliveState, type Progress } from '@/lib/golive'
import type { GoliveItem } from '@/content/golive'

const REFRESH_MS = 60_000

type Block = { id: string; title: string }
export type GoliveData = {
  state: GoliveState
  items: GoliveItem[]
  blocks: Block[]
  progress: Progress
  groups: { id: string; progress: Progress }[]
}
export type Notify = (text: string, tone?: 'info' | 'error') => void

export const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

// The go-live data: one GET on mount, then every 60 s while the tab is visible (the clock itself
// never polls: it counts from the deadline). Actions change the screen at once and roll back when
// the server refuses; the server answer replaces the local copy.
export function useGolive(notify: Notify) {
  const [data, setData] = useState<GoliveData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)

  const load = useCallback(async () => {
    const mine = generation.current
    try {
      const res = await fetch('/api/admin/golive', { cache: 'no-store' })
      const body = (await res.json()) as { ok?: boolean; error?: string } & Partial<GoliveData>
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'network')
      if (mine === generation.current) {
        setData(body as GoliveData)
        setError(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network')
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(() => void load(), 0)
    const id = setInterval(() => {
      if (!document.hidden) void load()
    }, REFRESH_MS)
    const onVisible = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(first)
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const send = useCallback(
    async (action: GoliveAction) => {
      if (!parseAction(action)) return false
      const before = data
      generation.current++
      if (data) {
        const state = applyAction(data.state, action, Date.now())
        const done = data.items.filter((i) => Object.hasOwn(state.done, i.id)).length
        setData({
          ...data,
          state,
          progress: {
            ...data.progress,
            done,
            percent: Math.round((done / data.items.length) * 100),
          },
        })
      }
      try {
        const res = await fetch('/api/admin/golive', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(action),
        })
        const body = (await res.json()) as { ok?: boolean; error?: string } & Partial<GoliveData>
        if (!res.ok || !body.ok) throw new Error(body.error ?? 'network')
        generation.current++
        setData(body as GoliveData)
        return true
      } catch (e) {
        generation.current++
        if (before) setData(before)
        notify(fill(t.saved, { e: errText(e instanceof Error ? e.message : 'network') }), 'error')
        return false
      }
    },
    [data, notify],
  )

  return { data, error, reload: load, send }
}

// A ticking clock for one component: once a second, only while the tab is visible.
export function useClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null
    const run = () => {
      setNow(Date.now())
      if (id === null) id = setInterval(() => setNow(Date.now()), 1000)
    }
    const stop = () => {
      if (id !== null) clearInterval(id)
      id = null
    }
    const onVisibility = () => (document.hidden ? stop() : run())
    if (!document.hidden) run()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  return now
}

// ---- top bar chip: a link to the full-screen page /admin/golive ----

export function GoliveChip({ state }: { state: GoliveState | null }) {
  const now = useClock()
  const reduce = useReducedMotion()
  const r = remaining(state?.deadline, now)
  const started = !!state?.deadline
  const label = !started ? t.chipOff : r.over ? t.chipOver : `${t.chipOn} ${chipText(r)}`
  return (
    <Link
      href="/admin/golive"
      title={`${t.open} (8)`}
      aria-label={`${label}. ${t.open}`}
      className={cn(
        'inline-flex h-9 min-w-0 shrink-0 items-center gap-2 rounded-full border px-3 text-sm transition-colors',
        started && r.over
          ? 'border-danger/60 text-danger'
          : 'border-line-strong text-muted hover:text-fg',
      )}
    >
      {started && !r.over ? (
        <motion.span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full bg-accent"
          animate={reduce ? undefined : { opacity: [1, 0.45, 1], scale: [1, 0.8, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <Timer size={16} aria-hidden="true" />
      )}
      {started ? (
        <span className="whitespace-nowrap">
          <span className={r.over ? undefined : 'hidden sm:inline'}>{r.over ? t.chipOver : `${t.chipOn} `}</span>
          {!r.over ? <span className="font-mono tabular-nums">{chipText(r)}</span> : null}
        </span>
      ) : (
        <span className="hidden whitespace-nowrap sm:inline">{t.chipOff}</span>
      )}
    </Link>
  )
}
