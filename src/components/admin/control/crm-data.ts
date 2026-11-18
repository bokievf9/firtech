'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AdminLead } from '@/lib/admin-data'

const POLL_VISIBLE = 30_000
const POLL_HIDDEN = 120_000

export type CrmData = {
  leads: AdminLead[] | null
  error: string | null
  now: number
  reload: () => void
  replace: (lead: AdminLead) => void
}

// The site-form leads for both CRM panels: one GET /api/admin/leads, polled every 30 s (every 2 min
// on a hidden tab). `replace` swaps one lead after a change, so the lists update at once.
export function useCrmLeads(): CrmData {
  const [leads, setLeads] = useState<AdminLead[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const generation = useRef(0)
  const alive = useRef(true)

  const load = useCallback(async () => {
    const started = generation.current
    try {
      const res = await fetch('/api/admin/leads', { cache: 'no-store' })
      const body: unknown = await res.json().catch(() => null)
      if (!alive.current || started !== generation.current) return
      if (res.ok && body && (body as { ok?: unknown }).ok === true) {
        setLeads((body as { leads: AdminLead[] }).leads)
        setNow(Date.now())
        setError(null)
      } else setError(res.status === 401 ? 'unauthorized' : 'hq_error')
    } catch {
      if (alive.current) setError('network')
    }
  }, [])

  useEffect(() => {
    alive.current = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        await load()
        if (alive.current) schedule(document.hidden ? POLL_HIDDEN : POLL_VISIBLE)
      }, delay)
    }
    const onVisibility = () => schedule(document.hidden ? POLL_HIDDEN : 0)
    schedule(0)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive.current = false
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  const replace = useCallback((lead: AdminLead) => {
    generation.current++
    setLeads((all) => (all ? all.map((l) => (l.id === lead.id ? lead : l)) : all))
  }, [])

  return { leads, error, now, reload: () => void load(), replace }
}
