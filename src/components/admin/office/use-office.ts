'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { activityKey, type OfficeData, type OfficeResponse } from '@/lib/office-view'

const POLL_VISIBLE = 10_000
const POLL_HIDDEN = 60_000

// Polls the proxy: every 10 s, every 60 s while the tab is hidden. A failed poll keeps the last
// good data and sets `error`, the page then dims the data under a banner.
export function useOffice() {
  const [data, setData] = useState<OfficeData | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const seen = useRef<Set<string> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alive = useRef(true)

  const load = useCallback(async () => {
    setBusy(true)
    let next: OfficeResponse
    try {
      const res = await fetch('/api/admin/office', { cache: 'no-store' })
      next = res.status === 401 ? { ok: false, error: 'unauthorized' } : await res.json()
    } catch {
      next = { ok: false, error: 'network' }
    }
    if (!alive.current) return
    setBusy(false)
    if (next.ok) {
      const keys = next.activity.map(activityKey)
      const known = seen.current
      // The first load animates nothing; later loads slide in only rows not seen before.
      setFresh(known ? new Set(keys.filter((k) => !known.has(k))) : new Set())
      seen.current = new Set(keys)
      setData(next)
      setFetchedAt(Date.now())
      setError(null)
    } else {
      setError(next.error)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    const schedule = (first = false) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(
        async () => {
          await load()
          if (alive.current) schedule()
        },
        first ? 0 : document.hidden ? POLL_HIDDEN : POLL_VISIBLE,
      )
    }
    const onVisible = () => {
      if (!document.hidden) void load()
      schedule()
    }
    schedule(true)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive.current = false
      if (timer.current) clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  return { data, fetchedAt, error, busy, fresh, retry: load }
}

