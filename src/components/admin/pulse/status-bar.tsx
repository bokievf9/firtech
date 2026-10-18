'use client'

import { useEffect, useState } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import type { SiteStatus } from '@/lib/pulse-types'

const t = admin.pulse

const zone = 'Asia/Dushanbe'
const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: zone,
  weekday: 'short',
  day: 'numeric',
  month: 'long',
})
const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: zone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

// Live status of both sites and today's date and time in Dushanbe. The first render uses the
// server's clock reading, so the HTML matches; the clock then ticks on the client.
export function StatusBar({ sites, nowIso }: { sites: SiteStatus[]; nowIso: string }) {
  const [now, setNow] = useState(() => Date.parse(nowIso))
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])
  const date = new Date(now)
  return (
    <section
      aria-label={t.sites}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-card border border-line bg-surface px-4 py-2.5"
    >
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {sites.map((site) => (
          <li key={site.id} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={cn(
                'size-2 rounded-full',
                site.ok ? 'bg-accent shadow-[0_0_8px_var(--color-accent)]' : 'bg-danger',
              )}
            />
            <span className="font-medium">{site.name}</span>
            <span
              className={cn(
                'font-mono text-xs tabular-nums',
                site.ok ? 'text-muted' : 'text-danger',
              )}
            >
              {site.ok && site.ms !== null ? `${site.ms} ${t.ms}` : t.offline}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-baseline gap-3 text-sm text-muted">
        <span suppressHydrationWarning>{dateFormat.format(date)}</span>
        <time
          dateTime={date.toISOString()}
          suppressHydrationWarning
          className="font-mono text-base text-fg tabular-nums"
        >
          {timeFormat.format(date)}
        </time>
        <span className="hidden font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase sm:inline">
          {t.timeLabel}
        </span>
      </p>
    </section>
  )
}
