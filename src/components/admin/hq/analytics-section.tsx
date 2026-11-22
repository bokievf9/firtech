'use client'

import { ArrowsClockwise, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useState } from 'react'
import { fill } from '@/components/admin/control/api'
import { Empty, Loading, Offline, useHqView, btn } from '@/components/admin/hub/ui'
import { admin } from '@/content/admin'
import { change, FUNNEL_STEPS, minutesLabel, normalizeAnalytics, shiftIsoWeek, siteRows, stepRate, type AnalyticsData } from '@/lib/analytics-hq'
import { cn } from '@/lib/cn'
import { sectionById } from '@/lib/hq-shell'

const t = admin.hq
const a = admin.hq.analytics
const ev = admin.pult.metrics.events as Record<string, string>

const card = 'rounded-card border border-line bg-surface p-4'
const sign = (n: number) => (n > 0 ? `+${n}` : String(n))

function Funnel({ d }: { d: AnalyticsData }) {
  const max = Math.max(1, ...FUNNEL_STEPS.map((k) => d.funnel[k]))
  return (
    <section className={card} aria-label={a.funnel} data-analytics="funnel">
      <h2 className="mb-3 text-sm font-medium">{a.funnel}</h2>
      <ol className="grid gap-2.5">
        {FUNNEL_STEPS.map((k, i) => {
          const rate = i === 0 ? null : stepRate(d.funnel[FUNNEL_STEPS[i - 1]!], d.funnel[k])
          return (
            <li key={k} data-funnel-step={k}>
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-sm">
                <span>{a.funnelSteps[k]}</span>
                <span className="font-mono tabular-nums" data-value>
                  {d.funnel[k]}
                </span>
                {rate !== null ? <span className="text-xs text-muted">{fill(a.rate, { p: rate })}</span> : null}
                <span className="ml-auto text-xs text-faint">{fill(a.prevWeekValue, { n: d.prevFunnel[k] })}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-inset" aria-hidden="true">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((d.funnel[k] / max) * 100)}%` }} />
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Response({ d }: { d: AnalyticsData }) {
  const r = d.firstResponse
  const p = d.prevFirstResponse
  return (
    <section className={card} aria-label={a.response} data-analytics="response">
      <h2 className="mb-3 text-sm font-medium">{a.response}</h2>
      {r.answered === 0 ? (
        <p className="text-sm text-muted">{a.noAnswers}</p>
      ) : (
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-muted">{a.avg}</dt>
            <dd className="font-mono text-lg tabular-nums" data-response="avg">
              {minutesLabel(r.avgMinutes)}
            </dd>
            <dd className="text-xs text-faint">{fill(a.prevWeekValue, { n: minutesLabel(p.avgMinutes) })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{a.median}</dt>
            <dd className="font-mono text-lg tabular-nums">{minutesLabel(r.medianMinutes)}</dd>
            <dd className="text-xs text-faint">{fill(a.prevWeekValue, { n: minutesLabel(p.medianMinutes) })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{a.within}</dt>
            <dd className="font-mono text-lg tabular-nums">{r.within1hShare === null ? '-' : `${Math.round(r.within1hShare * 100)}%`}</dd>
            <dd className="text-xs text-faint">{fill(a.prevWeekValue, { n: p.within1hShare === null ? '-' : `${Math.round(p.within1hShare * 100)}%` })}</dd>
          </div>
        </dl>
      )}
      <p className="mt-3 text-xs text-faint">{fill(a.answered, { a: r.answered, n: r.leads })}</p>
    </section>
  )
}

function Site({ d }: { d: AnalyticsData }) {
  const rows = siteRows(d.site, d.prevSite)
  return (
    <section className={cn(card, 'lg:col-span-2')} aria-label={a.site} data-analytics="site">
      <h2 className="mb-3 text-sm font-medium">{a.site}</h2>
      {rows.length === 0 ? (
        <Empty>{a.noEvents}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1.5 pr-3 font-normal">{a.event}</th>
                <th className="px-3 py-1.5 text-right font-normal">{a.cur}</th>
                <th className="px-3 py-1.5 text-right font-normal">{a.prevCol}</th>
                <th className="py-1.5 pl-3 text-right font-normal">{a.diff}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = change(r.cur, r.prev)
                return (
                  <tr key={r.name} className="border-t border-line" data-site-event={r.name}>
                    <td className="py-1.5 pr-3">{ev[r.name] ?? r.name}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{r.cur}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-muted tabular-nums">{r.prev}</td>
                    <td className={cn('py-1.5 pl-3 text-right font-mono tabular-nums', c.delta === 0 && 'text-faint')}>
                      {sign(c.delta)}
                      {c.percent === null ? '' : ` (${sign(c.percent)}%)`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Sources({ d }: { d: AnalyticsData }) {
  const names = a.sourceNames as Record<string, string>
  return (
    <section className={cn(card, 'lg:col-span-2')} aria-label={a.sources} data-analytics="sources">
      <h2 className="mb-3 text-sm font-medium">{a.sources}</h2>
      {d.sources.length === 0 ? (
        <Empty>{a.noSources}</Empty>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1.5 pr-3 font-normal">{a.source}</th>
              <th className="px-3 py-1.5 text-right font-normal">{a.leads}</th>
              <th className="px-3 py-1.5 text-right font-normal">{a.qualified}</th>
              <th className="py-1.5 pl-3 text-right font-normal">{a.paid}</th>
            </tr>
          </thead>
          <tbody>
            {d.sources.map((s) => (
              <tr key={s.source} className="border-t border-line" data-source={s.source}>
                <td className="py-1.5 pr-3">{names[s.source] ?? s.source}</td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">{s.leads}</td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">{s.qualified}</td>
                <td className="py-1.5 pl-3 text-right font-mono tabular-nums">{s.paid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

// Analytics: the funnel, the time of the first answer, site events and lead sources for one ISO week against the previous one.
// Read from HQ's `GET /admin/analytics`; the funnel and the site events are the numbers of the marketing «Цифры» tab.
export function AnalyticsSection() {
  const info = sectionById('analytics')!
  // null = the current week (HQ picks it); the switcher moves by whole weeks from the one HQ answered with.
  const [week, setWeek] = useState<string | null>(null)
  const view = useHqView(week ? `analytics?week=${week}` : 'analytics', normalizeAnalytics, { visible: 60_000, hidden: 180_000 })
  const d = view.view

  return (
    <div className="flex min-h-full flex-col" data-section-view="analytics">
      <div className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-3 sm:px-5">
          <h1 className="font-brand text-xl">{info.label}</h1>
          <p className="text-sm text-muted">{t.sectionHints.analytics}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-1" role="group" aria-label={a.weekLabel}>
            <button type="button" className={cn(btn, 'size-10 px-0')} aria-label={a.prev} disabled={!d} onClick={() => d && setWeek(shiftIsoWeek(d.week, -1))}>
              <CaretLeft size={16} aria-hidden="true" />
            </button>
            <button type="button" className={cn(btn, 'min-h-10')} onClick={() => setWeek(null)} disabled={week === null}>
              {a.thisWeek}
            </button>
            <button type="button" className={cn(btn, 'size-10 px-0')} aria-label={a.next} disabled={!d} onClick={() => d && setWeek(shiftIsoWeek(d.week, 1))}>
              <CaretRight size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="min-w-0 font-mono text-sm tabular-nums" data-analytics-week aria-live="polite">
            {d ? d.week : ''}
          </p>
          <button type="button" onClick={() => void view.reload()} className={cn(btn, 'ml-auto size-10 px-0')} aria-label={a.refresh}>
            <ArrowsClockwise size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {view.error && !d ? <Offline error={view.error} onRetry={view.reload} /> : null}
      {!d && !view.error ? <Loading rows={4} /> : null}
      {d ? (
        <div className={cn('grid gap-3 p-3 sm:p-4 lg:grid-cols-2', view.stale && 'opacity-60 transition-opacity')} aria-busy={view.stale}>
          {view.failed ? <div className="lg:col-span-2"><Offline error={view.failed} onRetry={view.reload} /></div> : null}
          <Funnel d={d} />
          <Response d={d} />
          <Site d={d} />
          <Sources d={d} />
          <p className="text-center text-[11px] text-faint lg:col-span-2">{fill(a.footer, { from: d.from, to: d.to, tz: d.tz })}</p>
        </div>
      ) : null}
    </div>
  )
}
