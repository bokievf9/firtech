'use client'

import { useEffect, useState } from 'react'
import { looksLikePublicOffice, type PublicOffice } from '@/lib/office-public'

export const POLL_MS = 15_000
export const POLL_HIDDEN_MS = 60_000

export type OfficeFeed = {
  data: PublicOffice | null
  // Date.now() of the last good answer; the status line counts «обновлено N с назад» from it.
  receivedAt: number
}

// Polls GET /api/office/public: every 15 s, every 60 s while the tab is hidden, right away when it
// becomes visible again. A failed request keeps the last data (the hero never blanks).
export function useOfficeFeed(): OfficeFeed {
  const [feed, setFeed] = useState<OfficeFeed>({ data: null, receivedAt: 0 })

  useEffect(() => {
    let timer = 0
    let stopped = false
    let controller: AbortController | null = null

    async function load() {
      controller?.abort()
      controller = new AbortController()
      try {
        const res = await fetch('/api/office/public', {
          signal: controller.signal,
          cache: 'no-store',
        })
        const body: unknown = await res.json()
        if (!stopped && looksLikePublicOffice(body)) setFeed({ data: body, receivedAt: Date.now() })
      } catch {
        // Offline or aborted: keep what we have.
      }
      if (!stopped) plan()
    }

    function plan() {
      window.clearTimeout(timer)
      timer = window.setTimeout(load, document.hidden ? POLL_HIDDEN_MS : POLL_MS)
    }

    function onVisibility() {
      if (!document.hidden) load()
      else plan()
    }

    load()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      window.clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return feed
}
