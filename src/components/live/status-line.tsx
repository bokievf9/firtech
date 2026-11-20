'use client'

import { useEffect, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import type { PublicOffice } from '@/lib/office-public'
import { formatUpdated, statusLine, statusSegments, type StatusCopy } from '@/lib/status-line'
import { TickNumber } from '../count-up'

// «Сейчас в офисе: 19 агентов · 6 работают · 2 ждут решения · 14 задач сделано сегодня · обновлено
// 10 с назад». Numbers glide to new values on each poll; the age ticks once a second (only this
// small span re-renders). Screen readers get one polite sentence per poll, not per second.
export function StatusLine({
  locale,
  data,
  receivedAt,
  copy,
}: {
  locale: Locale
  data: PublicOffice | null
  receivedAt: number
  copy: StatusCopy & { loading: string }
}) {
  if (!data) {
    return (
      <div className="flex items-center gap-3 text-sm text-faint" aria-busy="true">
        <span className="sr-only">{copy.loading}</span>
        <span aria-hidden="true" className="skeleton h-3 w-24" />
        <span aria-hidden="true" className="skeleton h-3 w-40" />
        <span aria-hidden="true" className="skeleton hidden h-3 w-32 sm:block" />
      </div>
    )
  }
  const segments = statusSegments(locale, data.counts, copy)
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
      <span className="sr-only" aria-live="polite">
        {statusLine(locale, data.counts, 0, copy)}
      </span>
      <span aria-hidden="true" className="inline-flex items-center gap-2 font-medium text-fg">
        {copy.prefix}:
      </span>
      {segments.map((s) => (
        <span key={s.key} aria-hidden="true" className="inline-flex items-baseline gap-1.5">
          <span className="font-mono text-[15px] font-medium text-fg">
            <TickNumber value={s.n} />
          </span>
          <span className={s.key === 'waiting' && s.n > 0 ? 'text-accent-text' : undefined}>
            {s.label}
          </span>
        </span>
      ))}
      <Age receivedAt={receivedAt} copy={copy} />
    </p>
  )
}

function Age({ receivedAt, copy }: { receivedAt: number; copy: StatusCopy }) {
  const [now, setNow] = useState(receivedAt)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [receivedAt])
  return (
    <span aria-hidden="true" className="font-mono text-xs text-faint tabular-nums">
      {formatUpdated((now - receivedAt) / 1000, copy)}
    </span>
  )
}
