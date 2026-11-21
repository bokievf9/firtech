'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Re-reads the server page (statuses, documents, next actions) every minute while the tab is visible
// and again when the visitor comes back to it. Mounted only inside the «Проекты» panel, so it runs
// only while that tab is open.
export function RefreshWhileVisible({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const timer = window.setInterval(tick, everyMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [router, everyMs])
  return null
}
