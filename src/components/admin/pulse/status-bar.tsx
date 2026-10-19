'use client'

import { useEffect, useState } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { usePulse } from './pulse-provider'

const t = admin.pulse

const zone = 'Asia/Dushanbe'
const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: zone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

// Live status of both sites and the time in Dushanbe. The first render uses the server's clock
// reading, so the HTML matches; the clock then ticks on the client.
export function StatusBar({ className }: { className?: string }) {
  const { data } = usePulse()
  const [now, setNow] = useState(() => Date.parse(data.snapshot.now))
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])
  const date = new Date(now)
  return (
    <section
      aria-label={t.sites}
      className={cn(
        'flex min-w-0 items-center justify-between gap-x-5 gap-y-1.5 text-sm sm:justify-start',
        className,
      )}
    >
      <ul className="flex items-center gap-x-4 gap-y-1.5 sm:gap-x-5">
        {data.snapshot.sites.map((site) => (
          <li key={site.id} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'size-2.5 rounded-full',
                site.ok ? 'bg-accent-text shadow-[0_0_8px_var(--color-accent-text)]' : 'bg-danger',
              )}
            />
            <span className="font-medium">{site.name}</span>
            <span
              className={cn(
                'font-mono text-xs tabular-nums',
                site.ok ? 'text-muted max-sm:hidden' : 'text-danger',
              )}
            >
              {site.ok && site.ms !== null ? `${site.ms} ${t.ms}` : t.offline}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-baseline gap-2 text-muted">
        <time
          dateTime={date.toISOString()}
          suppressHydrationWarning
          className="font-mono text-base text-fg tabular-nums"
        >
          {timeFormat.format(date)}
        </time>
        <span className="max-sm:hidden">{t.timeLabel}</span>
      </p>
    </section>
  )
}
