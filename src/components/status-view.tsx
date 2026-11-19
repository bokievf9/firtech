'use client'

import { useEffect, useState } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import {
  formatStatusClock,
  formatStatusTime,
  headline,
  statusServiceIds,
  type ServiceState,
  type StatusData,
} from '@/lib/status'

// Status page body. The server renders the first state; this island asks /api/status every 60 s
// (not while the tab is hidden) and keeps the last good data when a refresh fails.
const REFRESH_MS = 60_000

const chip: Record<ServiceState, string> = {
  up: 'border-accent/40 bg-accent/10 text-accent-text',
  degraded: 'border-warn/40 bg-warn/10 text-warn',
  down: 'border-danger/40 bg-danger/10 text-danger',
  unknown: 'border-line-strong text-muted',
}
const dot: Record<ServiceState, string> = {
  up: 'bg-accent',
  degraded: 'bg-warn',
  down: 'bg-danger',
  unknown: 'bg-faint',
}

export function StatusView({
  initial,
  dict,
  locale,
}: {
  initial: StatusData
  dict: Dict
  locale: Locale
}) {
  const t = dict.statusPage
  const [data, setData] = useState(initial)
  const [fetchedAt, setFetchedAt] = useState(() => new Date().toISOString())

  useEffect(() => {
    async function refresh() {
      if (document.hidden) return
      try {
        const res = await fetch('/api/status', { cache: 'no-store' })
        const body: unknown = await res.json()
        // The route returns the normalized shape; a broken answer never replaces good data.
        const next = body && typeof body === 'object' ? (body as StatusData) : null
        if (next && Array.isArray(next.services)) {
          setData(next)
          setFetchedAt(new Date().toISOString())
        }
      } catch {
        // Keep showing the last data.
      }
    }
    const timer = window.setInterval(refresh, REFRESH_MS)
    const onVisible = () => {
      if (!document.hidden) void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const state = headline(data)
  const tone = state === 'ok' ? 'up' : state === 'issue' ? 'down' : 'unknown'
  const ordered = statusServiceIds.map(
    (id) => data.services.find((s) => s.id === id) ?? { id, state: 'unknown' as const },
  )

  return (
    <div>
      <div
        role="status"
        aria-live="polite"
        className={cn('rounded-card border p-6 md:p-8', chip[tone])}
      >
        <p className="flex items-center gap-3 font-display text-2xl font-semibold text-fg md:text-4xl">
          <span className={cn('size-3 rounded-full', dot[tone])} aria-hidden="true" />
          {t.headline[state]}
        </p>
        <p className="mt-3 max-w-[60ch] text-muted">{t.headlineSub[state]}</p>
      </div>

      <h2 className="mt-12 font-display text-2xl font-semibold">{t.servicesTitle}</h2>
      <ul className="mt-5 grid gap-3">
        {ordered.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-5 py-4"
          >
            <div>
              <p className="font-medium">{t.services[s.id]}</p>
              {s.since && (
                <p className="mt-0.5 text-[13px] text-faint">
                  {t.since.replace('{t}', formatStatusTime(s.since, locale))}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted">
                {t.uptime}:{' '}
                <span className="font-mono text-fg">
                  {s.uptime30d === undefined ? t.uptimeNone : `${s.uptime30d}%`}
                </span>
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px]',
                  chip[s.state],
                )}
              >
                <span className={cn('size-1.5 rounded-full', dot[s.state])} aria-hidden="true" />
                {t.states[s.state]}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-faint">{t.uptimeNote}</p>

      <h2 className="mt-12 font-display text-2xl font-semibold">{t.incidentsTitle}</h2>
      {data.incidents.length ? (
        <ul className="mt-5 grid gap-3">
          {data.incidents.map((i) => (
            <li
              key={`${i.service}-${i.startedAt}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-5 py-4"
            >
              <p>
                <span className="font-medium">{t.services[i.service]}</span>
                <span className="text-muted">: {t.incidentKind}</span>
              </p>
              <p className="font-mono text-[13px] text-muted">
                {i.endedAt
                  ? t.incidentSpan
                      .replace('{from}', formatStatusTime(i.startedAt, locale))
                      .replace('{to}', formatStatusTime(i.endedAt, locale))
                  : t.incidentOpen.replace('{from}', formatStatusTime(i.startedAt, locale))}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-muted">{data.available ? t.incidentsEmpty : t.incidentsUnavailable}</p>
      )}

      <div className="mt-10 grid gap-1 text-[13px] text-faint">
        <p>
          {t.updated}: {formatStatusClock(data.generatedAt ?? fetchedAt, locale)} · {t.refresh}
        </p>
        <p>{t.tzNote}</p>
        {data.mock && <p>{t.mockNote}</p>}
      </div>
    </div>
  )
}
