'use client'

import { useEffect, useState } from 'react'
import { Sparkline } from '@/components/admin/sparkline'
import { admin } from '@/content/admin'
import type { SourceState, StatsResponse } from '@/lib/traffic-types'

const t = admin.pulse.traffic
const REFRESH_MS = 5 * 60_000

const nf = new Intl.NumberFormat('ru-RU')

function Stat({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div>
      <dd className={`font-mono text-xl tracking-tight tabular-nums ${alert ? 'text-danger' : ''}`}>
        {typeof value === 'number' ? nf.format(value) : value}
      </dd>
      <dt className="text-xs text-faint">{label}</dt>
    </div>
  )
}

const note = (state: SourceState, off: string, down: string) =>
  state === 'not_configured' ? off : down

// Site traffic from Yandex Metrika and the Vibely aggregates. Loaded in the browser after the page,
// so a slow or missing source never delays the home screen.
export function TrafficPanel() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/admin/stats', { cache: 'no-store' })
        if (!res.ok) throw new Error('bad status')
        const body = (await res.json()) as StatsResponse
        if (alive) {
          setStats(body)
          setFailed(false)
        }
      } catch {
        if (alive) setFailed(true)
      }
    }
    void load()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const m = stats?.metrika
  const v = stats?.vibely

  return (
    <section aria-labelledby="traffic-title" className="mt-6 border-t border-line pt-4">
      <h3 id="traffic-title" className="mb-3 text-xs font-medium text-faint">
        {t.title}
      </h3>
      {failed && !stats ? (
        <p role="alert" className="text-sm text-danger">
          {t.loadError}
        </p>
      ) : null}

      {m?.data ? (
        <>
          <dl className="grid grid-cols-3 gap-2">
            <Stat label={t.visits} value={m.data.visits7d} />
            <Stat label={t.users} value={m.data.users7d} />
            <Stat label={t.pages} value={m.data.pageviews7d} />
          </dl>
          <div className="mt-3 flex items-end justify-between gap-3">
            <ul className="min-w-0 space-y-0.5 text-xs text-muted">
              {m.data.sources.map((s) => (
                <li key={s.name} className="truncate">
                  {s.name}: <span className="font-mono tabular-nums">{nf.format(s.visits)}</span>
                </li>
              ))}
            </ul>
            <Sparkline values={m.data.days.map((d) => d.visits)} label={t.visits} />
          </div>
        </>
      ) : m ? (
        <p className="text-sm text-muted">{note(m.state, t.metrikaOff, t.metrikaDown)}</p>
      ) : null}

      {v ? (
        <div className="mt-5">
          <h4 className="mb-2 text-xs font-medium text-faint">{t.vibely}</h4>
          {v.data ? (
            <dl className="grid grid-cols-3 gap-x-2 gap-y-3">
              <Stat label={t.total} value={v.data.users.total} />
              <Stat label={t.dau} value={v.data.users.dau} />
              <Stat label={t.wau} value={v.data.users.wau} />
              <Stat label={t.signups} value={v.data.users.signups30d} />
              <Stat label={t.matches} value={v.data.activity.matches7d} />
              <Stat label={t.push} value={`${Math.round(v.data.pushOptInShare * 100)}%`} />
              <Stat
                label={t.selfie}
                value={v.data.moderation.selfiePending}
                alert={
                  v.data.moderation.selfiePending > 0 &&
                  v.data.moderation.selfieLongestWaitHours >= 24
                }
              />
              <Stat
                label={t.reports}
                value={v.data.moderation.openReports}
                alert={v.data.moderation.openReports > 0}
              />
              <Stat label={t.subs} value={v.data.money.activeSubscriptions} />
            </dl>
          ) : (
            <p className="text-sm text-muted">{note(v.state, t.vibelyOff, t.vibelyDown)}</p>
          )}
        </div>
      ) : null}
      <p className="mt-4 text-xs text-faint">{t.hint}</p>
    </section>
  )
}
