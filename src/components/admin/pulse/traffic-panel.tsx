'use client'

import { useState } from 'react'
import { Sparkline } from '@/components/admin/sparkline'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import type { MetrikaStats, SourceState, VibelyStats } from '@/lib/traffic-types'
import { usePulse } from './pulse-provider'

const t = admin.pulse.traffic
const nf = new Intl.NumberFormat('ru-RU')

function Stat({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div>
      <dd className={cn('font-mono text-2xl tracking-tight tabular-nums', alert && 'text-danger')}>
        {typeof value === 'number' ? nf.format(value) : value}
      </dd>
      <dt className="text-sm text-muted">{label}</dt>
    </div>
  )
}

const note = (state: SourceState, off: string, down: string) =>
  state === 'not_configured' ? off : down

function Skeleton() {
  return (
    <div role="status" aria-label={t.loading} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="h-12 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none" />
        <div className="h-12 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none" />
      </div>
      <div className="h-16 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none" />
      <div className="h-20 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}

function Failed() {
  const { stats } = usePulse()
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
      {t.loadError}
      <button
        type="button"
        onClick={stats.retry}
        className="inline-flex h-11 items-center rounded-full border border-danger/50 px-5"
      >
        {t.retry}
      </button>
    </div>
  )
}

function Vibely({ vibely }: { vibely: { state: SourceState; data: VibelyStats | null } }) {
  const v = vibely.data
  if (!v)
    return <p className="text-sm text-muted">{note(vibely.state, t.vibelyOff, t.vibelyDown)}</p>
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
      <Stat label={t.dau} value={v.users.dau} />
      <Stat label={t.wau} value={v.users.wau} />
      <Stat label={t.total} value={v.users.total} />
      <Stat label={t.signups} value={v.users.signups30d} />
      <Stat label={t.matches} value={v.activity.matches7d} />
      <Stat label={t.push} value={`${Math.round(v.pushOptInShare * 100)}%`} />
      <Stat
        label={t.selfie}
        value={v.moderation.selfiePending}
        alert={v.moderation.selfiePending > 0 && v.moderation.selfieLongestWaitHours >= 24}
      />
      <Stat
        label={t.reports}
        value={v.moderation.openReports}
        alert={v.moderation.openReports > 0}
      />
      <Stat label={t.subs} value={v.money.activeSubscriptions} />
    </dl>
  )
}

function Site({ metrika }: { metrika: { state: SourceState; data: MetrikaStats | null } }) {
  const m = metrika.data
  if (!m)
    return (
      <div className="grid gap-1 text-sm text-muted">
        <p>{note(metrika.state, t.metrikaOff, t.metrikaDown)}</p>
        {metrika.state === 'not_configured' ? <p>{t.metrikaHow}</p> : null}
      </div>
    )
  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-3 gap-3">
        <Stat label={t.visits} value={m.visits7d} />
        <Stat label={t.users} value={m.users7d} />
        <Stat label={t.pages} value={m.pageviews7d} />
      </dl>
      <div className="flex items-end justify-between gap-4">
        <ul className="grid min-w-0 gap-1 text-sm text-muted">
          {m.sources.map((s) => (
            <li key={s.name} className="flex justify-between gap-4">
              <span className="truncate">{s.name}</span>
              <span className="font-mono tabular-nums">{nf.format(s.visits)}</span>
            </li>
          ))}
        </ul>
        <Sparkline values={m.days.map((d) => d.visits)} label={t.visits} />
      </div>
    </div>
  )
}

// Site traffic (Yandex Metrika) and the Vibely numbers. `layout="tabs"` shows one at a time under
// two tabs, `layout="stacked"` shows both. The numbers load in the browser, so there is a skeleton
// first and a retry button when they fail.
export function TrafficPanel({ layout }: { layout: 'tabs' | 'stacked' }) {
  const { stats } = usePulse()
  const [tab, setTab] = useState<'site' | 'vibely'>('site')
  const s = stats.state
  const showSite = layout === 'stacked' || tab === 'site'
  const showVibely = layout === 'stacked' || tab === 'vibely'
  return (
    <div className="grid min-w-0 content-start gap-4">
      {layout === 'tabs' ? (
        <div role="group" aria-label={t.title} className="flex gap-1.5">
          {(['site', 'vibely'] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'inline-flex h-11 items-center rounded-full border px-5 text-sm transition-colors',
                tab === id
                  ? 'border-fg bg-fg text-bg'
                  : 'border-line text-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {t.tabs[id]}
            </button>
          ))}
        </div>
      ) : null}
      {s.status === 'loading' ? <Skeleton /> : null}
      {s.status === 'error' ? <Failed /> : null}
      {s.status === 'ready' ? (
        <>
          {showSite ? (
            <section aria-labelledby="traffic-site" className="grid gap-3">
              {layout === 'stacked' ? (
                <h3 id="traffic-site" className="text-sm text-muted">
                  {t.siteTitle}
                </h3>
              ) : (
                <h3 id="traffic-site" className="sr-only">
                  {t.siteTitle}
                </h3>
              )}
              <Site metrika={s.stats.metrika} />
            </section>
          ) : null}
          {showVibely ? (
            <section aria-labelledby="traffic-vibely" className="grid gap-3">
              <h3
                id="traffic-vibely"
                className={layout === 'stacked' ? 'text-sm text-muted' : 'sr-only'}
              >
                {t.vibely}
              </h3>
              <Vibely vibely={s.stats.vibely} />
            </section>
          ) : null}
          {(showSite && s.stats.metrika.data) || (showVibely && s.stats.vibely.data) ? (
            <p className="text-sm text-muted">{t.hint}</p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
