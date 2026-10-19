'use client'

import { useCallback, useEffect, useState } from 'react'
import type { StatsResponse } from '@/lib/traffic-types'

const REFRESH_MS = 5 * 60_000

export type StatsState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; stats: StatsResponse }

// Site traffic and Vibely numbers, read in the browser after the page is shown so a slow or missing
// source never delays the screen. Refreshed every five minutes while the tab is visible.
export function useStats() {
  const [state, setState] = useState<StatsState>({ status: 'loading' })

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' })
      if (!res.ok) throw new Error('bad status')
      setState({ status: 'ready', stats: (await res.json()) as StatsResponse })
    } catch {
      // A refresh that fails keeps the last good numbers.
      setState((s) => (s.status === 'ready' ? s : { status: 'error' }))
    }
  }, [])

  useEffect(() => {
    // The first read starts after the render, not inside it.
    const first = setTimeout(() => void load(), 0)
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, REFRESH_MS)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [load])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    void load()
  }, [load])

  return { state, retry }
}
