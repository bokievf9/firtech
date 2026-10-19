'use client'

import { admin, fillAdmin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { trendSeries, trendSummary } from '@/lib/pulse-view'
import { usePulse, type SectionId } from './pulse-provider'

const t = admin.pulse.tiles
const nf = new Intl.NumberFormat('ru-RU')

function Tile({
  label,
  value,
  hint,
  to,
  alert,
}: {
  label: string
  value: React.ReactNode
  hint: string
  to: SectionId
  alert?: boolean
}) {
  const { setTab } = usePulse()
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          setTab(to)
          const el = document.getElementById('pulse-details')
          const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          el?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
        }}
        className="flex h-full min-h-28 w-full flex-col justify-between gap-2 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-accent-text/60"
      >
        <span className="text-sm text-muted">{label}</span>
        <span className="font-mono text-3xl leading-none tracking-tight tabular-nums">{value}</span>
        <span className={cn('text-sm', alert ? 'text-danger' : 'text-muted')}>{hint}</span>
      </button>
    </li>
  )
}

const bar = (
  <span className="block h-8 w-16 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
)

// Four tiles with the state of the business at a glance; each opens its section below.
export function PulseTiles() {
  const { data, ig, stats } = usePulse()
  const { leads } = data.snapshot
  const s = stats.state
  const site = s.status === 'ready' ? s.stats.metrika.data : null
  const vibely = s.status === 'ready' ? s.stats.vibely.data : null
  const followers = trendSummary(trendSeries(ig.days, 'followers'))
  const pending = s.status === 'loading'
  return (
    <section aria-labelledby="tiles-title" className="grid gap-3">
      <h2 id="tiles-title" className="font-brand text-xl font-bold tracking-tight">
        {t.title}
      </h2>
      <ul className="grid grid-cols-2 gap-2.5">
        <Tile
          label={t.leads}
          value={leads.week}
          hint={leads.stale ? fillAdmin(t.leadsStale, { n: leads.stale }) : t.leadsOk}
          alert={leads.stale > 0}
          to="leads"
        />
        <Tile
          label={t.site}
          value={pending ? bar : site ? nf.format(site.visits7d) : '-'}
          hint={
            site ? t.siteWeek : s.status === 'ready' ? t.off : s.status === 'error' ? t.noData : ' '
          }
          to="numbers"
        />
        <Tile
          label={t.vibely}
          value={pending ? bar : vibely ? nf.format(vibely.users.dau) : '-'}
          hint={
            vibely
              ? t.vibelyHint
              : s.status === 'ready'
                ? t.off
                : s.status === 'error'
                  ? t.noData
                  : ' '
          }
          to="numbers"
        />
        <Tile
          label={t.instagram}
          value={followers.last ?? '-'}
          hint={
            followers.delta !== null
              ? `${followers.delta > 0 ? '+' : ''}${followers.delta} ${t.followers}`
              : t.noData
          }
          to="ig"
        />
      </ul>
    </section>
  )
}
