'use client'

import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useState } from 'react'
import { fill } from '@/components/admin/control/api'
import { Sparkline } from '@/components/admin/sparkline'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { delta, funnelShares, isoWeek, normalizeMetrics, shiftWeek, SITE_EVENTS } from '@/lib/pult'
import { usd } from './bits'
import { Loading, Offline, useHqView, useHub } from '../hub/ui'

const k = admin.pult.metrics

function Delta({ cur, prev, money = false }: { cur: number; prev: number | null | undefined; money?: boolean }) {
  const d = delta(cur, prev)
  if (!d || d.diff === 0) return <span className="text-xs text-faint">{d ? '0' : ''}</span>
  const up = d.diff > 0
  return (
    <span className={cn('text-xs tabular-nums', up ? 'text-accent-text' : 'text-danger')}>
      {up ? '+' : ''}
      {money ? usd(d.diff) : d.diff}
      {d.pct !== null ? ` (${up ? '+' : ''}${d.pct}%)` : ''}
    </span>
  )
}

function Stat({ label, value, prev, money = false }: { label: string; value: number; prev?: number | null; money?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-bg/50 p-3">
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums">{money ? usd(value) : value.toLocaleString('ru-RU')}</p>
      <Delta cur={value} prev={prev} money={money} />
    </div>
  )
}

// «Цифры»: one screen per week. Funnel bars (leads to projects), the site's own events against the
// previous week, blog, YouTube and money. Inline SVG only.
export function MetricsTab() {
  const { now } = useHub()
  const thisWeek = isoWeek(now)
  const [week, setWeek] = useState(thisWeek)
  const feed = useHqView(`metrics/week?week=${week}`, normalizeMetrics, { visible: 120_000, hidden: 600_000 })
  const m = feed.view
  const prev = m?.prev ?? null
  return (
    <div className="grid gap-4 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setWeek((w) => shiftWeek(w, -1))} aria-label={k.prev} className="grid size-10 place-items-center rounded-full border border-line-strong hover:border-accent">
          <CaretLeft size={16} aria-hidden="true" />
        </button>
        <p className="min-w-28 text-center font-mono text-sm tabular-nums">{week}</p>
        <button
          type="button"
          onClick={() => setWeek((w) => shiftWeek(w, 1))}
          disabled={week >= thisWeek}
          aria-label={k.next}
          className="grid size-10 place-items-center rounded-full border border-line-strong hover:border-accent disabled:opacity-40"
        >
          <CaretRight size={16} aria-hidden="true" />
        </button>
        <p className="ml-auto text-xs text-faint">{k.vsPrev}</p>
      </div>
      {!m ? (
        feed.error ? <Offline error={feed.error} onRetry={() => void feed.reload()} /> : <Loading rows={4} />
      ) : (
        <div className={cn('grid gap-4 transition-opacity', feed.stale && 'opacity-50')}>
          <section className="grid gap-2">
            <h3 className="text-sm font-medium">{k.funnel}</h3>
            <ul className="grid gap-1.5">
              {funnelShares(m.funnel).map(({ key, n, share }) => (
                <li key={key} className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                  <span className="truncate text-muted">{(k.funnelSteps as Record<string, string>)[key] ?? key}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, share * 100)}%` }} />
                  </span>
                  <span className="flex items-baseline gap-2 tabular-nums">
                    {n}
                    <Delta cur={n} prev={prev?.funnel[key as keyof typeof m.funnel]} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-2 sm:grid-cols-2">
            <Stat label={k.invoiced} value={m.money.invoicedUsd} prev={prev?.money.invoicedUsd} money />
            <Stat label={k.paid} value={m.money.paidUsd} prev={prev?.money.paidUsd} money />
          </section>

          <section className="grid gap-2">
            <h3 className="text-sm font-medium">{k.site}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="py-1 font-normal">{k.event}</th>
                  <th className="py-1 text-right font-normal">{k.thisWeek}</th>
                  <th className="py-1 text-right font-normal">{k.prevWeek}</th>
                  <th className="py-1 text-right font-normal">{k.change}</th>
                  <th className="py-1 font-normal">
                    <span className="sr-only">{k.trend}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {SITE_EVENTS.map((e) => (
                  <tr key={e} className="border-t border-line">
                    <td className="py-1.5">{k.events[e]}</td>
                    <td className="py-1.5 text-right tabular-nums">{m.site[e]}</td>
                    <td className="py-1.5 text-right text-muted tabular-nums">{prev ? prev.site[e] : '-'}</td>
                    <td className="py-1.5 text-right">
                      <Delta cur={m.site[e]} prev={prev?.site[e]} />
                    </td>
                    <td className="py-1.5 pl-3">
                      <Sparkline values={[prev?.site[e] ?? 0, m.site[e]]} label={fill(k.trendLabel, { e: k.events[e] })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={k.blogHits} value={m.blog.hits} prev={prev?.blog.hits} />
            <Stat label={k.blogPublished} value={m.blog.published} prev={prev?.blog.published} />
            <Stat label={k.ytShorts} value={m.youtube.shorts} prev={prev?.youtube.shorts} />
            <Stat label={k.ytViews} value={m.youtube.views} prev={prev?.youtube.views} />
            <Stat label={k.ytSubs} value={m.youtube.subscribers} prev={prev?.youtube.subscribers} />
          </section>
        </div>
      )}
    </div>
  )
}
