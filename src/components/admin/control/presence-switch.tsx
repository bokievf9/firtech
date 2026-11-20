'use client'

import { Desktop, Info, PaperPlaneTilt } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import type { PresenceMode, PresenceView } from '@/lib/hq-admin-view'
import { formatDuration } from '@/lib/office-view'
import { fill } from './api'

const t = admin.cc.presence

// The big «На месте» / «Не на месте» switch. The pill shows what the owner chose; the line under it
// shows what HQ does (effective state), so an automatic switch to Telegram is never hidden.
export function PresenceSwitch({
  view,
  awayAfterMin,
  busy,
  onChange,
}: {
  view: PresenceView | null
  awayAfterMin: number
  busy: boolean
  onChange: (mode: PresenceMode) => void
}) {
  const mode = view?.mode ?? null
  const note = !view ? '' : view.autoAway ? t.autoNote : view.telegram ? t.awayNote : t.deskNote
  return (
    <div className="grid w-full gap-2 sm:w-auto">
      <div
        role="radiogroup"
        aria-label={t.label}
        aria-busy={busy}
        className="relative grid grid-cols-2 rounded-full border border-line-strong bg-field p-1"
      >
        {(['desk', 'away'] as const).map((m) => {
          const active = mode === m
          const ModeIcon = m === 'desk' ? Desktop : PaperPlaneTilt
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!view}
              onClick={() => onChange(m)}
              className={cn(
                'relative inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium whitespace-nowrap transition-colors sm:px-6',
                active ? (m === 'desk' ? 'text-accent-ink' : 'text-fg') : 'text-muted hover:text-fg',
              )}
            >
              {active ? (
                <motion.span
                  layoutId="cc-presence-pill"
                  aria-hidden="true"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  className={cn(
                    'absolute inset-0 rounded-full',
                    m === 'desk' ? 'bg-accent' : 'border border-line-strong bg-surface-2',
                  )}
                />
              ) : null}
              <ModeIcon size={18} weight={active ? 'fill' : 'regular'} aria-hidden="true" className="relative" />
              <span className="relative">{m === 'desk' ? t.desk : t.away}</span>
              {active && m === 'desk' && view?.autoAway ? (
                <span aria-hidden="true" className="relative size-2 rounded-full bg-danger ring-2 ring-accent" />
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="flex items-start gap-1.5 px-2 text-xs">
        <p aria-live="polite" className={cn('min-w-0 flex-1', view?.autoAway ? 'text-danger' : view?.telegram ? 'text-fg' : 'text-muted')}>
          {note}
          {view?.minutesSincePing !== null && view?.minutesSincePing !== undefined ? (
            <span className="text-faint"> · {fill(t.lastPing, { t: formatDuration(view.minutesSincePing) })}</span>
          ) : null}
        </p>
        <span className="group relative shrink-0">
          <button
            type="button"
            aria-label={t.helpLabel}
            aria-describedby="cc-presence-help"
            className="-m-2 grid size-8 place-items-center rounded-full text-faint hover:text-fg"
          >
            <Info size={14} aria-hidden="true" />
          </button>
          <span
            id="cc-presence-help"
            role="tooltip"
            className="invisible absolute top-full right-0 z-40 mt-2 w-72 rounded-xl border border-line-strong bg-elevated p-3 text-xs leading-relaxed text-fg opacity-0 shadow-dialog transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
          >
            {fill(t.help, { min: awayAfterMin })}
          </span>
        </span>
      </div>
    </div>
  )
}
