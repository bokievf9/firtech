'use client'

import { Desktop, PaperPlaneTilt } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { errText, hq, usePoll } from '@/components/admin/control/api'
import { useHub } from '@/components/admin/hub/ui'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { looksLikeState, presenceChange, presenceView, type HqState, type PresenceMode, type PresenceView } from '@/lib/hq-admin-view'

const cc = admin.cc
const PING_MS = 60_000

// Where the owner is: «На месте» keeps notifications in the Shell, «Не на месте» sends them to Telegram.
// While the page is visible it pings HQ once a minute; without pings HQ switches to away by itself.
export function PresenceSwitch() {
  const t = cc.presence
  const { notify } = useHub()
  const lastPresence = useRef<PresenceView | null>(null)
  const state = usePoll<HqState>('state', {
    onData: (s) => {
      const view = presenceView(s, Date.now())
      const change = presenceChange(lastPresence.current, view)
      lastPresence.current = view
      if (change) notify(t[change])
    },
  })
  const { accept, mutate, reload } = state
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    let alive = true
    const ping = async () => {
      if (document.hidden) return
      const res = await hq<HqState>('ping', {})
      if (alive && res.ok && looksLikeState(res)) accept(res)
    }
    void ping()
    const id = setInterval(ping, PING_MS)
    const onVisible = () => {
      if (!document.hidden) void ping()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [accept])
  const change = async (mode: PresenceMode) => {
    setBusy(true)
    mutate((s) => ({ ...s, presence: { ...s.presence, mode, effective: mode } }))
    const res = await hq<HqState>('presence', { mode })
    setBusy(false)
    if (res.ok && looksLikeState(res)) accept(res)
    else {
      if (!res.ok) notify(`${t.failed} (${errText(res.error)})`, 'error')
      void reload()
    }
  }
  const view = presenceView(state.data, now)
  const note = !view ? '' : view.autoAway ? t.autoNote : view.telegram ? t.awayNote : t.deskNote
  return (
    <div role="radiogroup" aria-label={t.label} aria-busy={busy} title={note} data-presence className="grid shrink-0 grid-cols-2 rounded-full border border-line-strong bg-field p-0.5">
      {(['desk', 'away'] as const).map((m) => {
        const active = view?.mode === m
        const ModeIcon = m === 'desk' ? Desktop : PaperPlaneTilt
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={m === 'desk' ? t.desk : t.away}
            disabled={!view}
            onClick={() => void change(m)}
            className={cn(
              'relative inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2 text-xs md:px-2.5 font-medium whitespace-nowrap transition-colors',
              active ? (m === 'desk' ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-fg') : 'text-muted hover:text-fg',
            )}
          >
            <ModeIcon size={15} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
            <span className="hidden md:inline">{m === 'desk' ? t.desk : t.away}</span>
            {active && m === 'desk' && view?.autoAway ? <span aria-hidden="true" className="size-1.5 rounded-full bg-danger" /> : null}
          </button>
        )
      })}
    </div>
  )
}
