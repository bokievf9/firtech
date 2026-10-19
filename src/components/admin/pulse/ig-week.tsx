'use client'

import { useState } from 'react'
import { Sparkline } from '@/components/admin/sparkline'
import { admin, fillAdmin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { itemsOfDay, weekDays } from '@/lib/pulse-today'
import { trendSeries, trendSummary } from '@/lib/pulse-view'
import { usePulse } from './pulse-provider'

const t = admin.pulse.ig
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const

const field =
  'h-11 w-full rounded-xl border border-line bg-bg/60 px-3 font-mono text-[15px] text-fg tabular-nums outline-none placeholder:text-faint focus:border-accent/60'

function Trend({ name, values }: { name: string; values: number[] }) {
  const { last, delta } = trendSummary(values)
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-3xl leading-none tabular-nums">{last ?? '-'}</span>
          {delta !== null ? (
            <span
              className={cn(
                'font-mono text-sm tabular-nums',
                delta > 0 ? 'text-accent-text' : delta < 0 ? 'text-danger' : 'text-muted',
              )}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-muted">{name}</p>
      </div>
      {values.length > 1 ? (
        <Sparkline values={values} label={fillAdmin(t.trendLabel, { name })} />
      ) : (
        <span className="max-w-24 text-right text-xs text-muted">{t.trendNone}</span>
      )}
    </div>
  )
}

function DayNumbers() {
  const { ig, data } = usePulse()
  const current = ig.days.find((d) => d.date === data.today)
  const [followers, setFollowers] = useState(current?.followers?.toString() ?? '')
  const [reach, setReach] = useState(current?.reach?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const f = followers.trim() === '' ? null : Number(followers)
    const r = reach.trim() === '' ? null : Number(reach)
    if (
      (f === null && r === null) ||
      [f, r].some((v) => v !== null && (!Number.isFinite(v) || v < 0))
    ) {
      setMessage(t.needValue)
      return
    }
    setMessage('')
    setSaving(true)
    const ok = await ig.saveDay({ date: data.today, followers: f, reach: r })
    setSaving(false)
    if (ok) setMessage(t.saved)
  }

  return (
    <details className="group rounded-xl border border-line">
      <summary className="flex h-11 cursor-pointer list-none items-center px-4 text-sm text-accent-text [&::-webkit-details-marker]:hidden">
        {t.numbersOpen}
      </summary>
      <form onSubmit={submit} aria-label={t.numbers} className="grid gap-3 px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm text-muted">
            {t.followers}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={followers}
              onChange={(e) => {
                setFollowers(e.target.value)
                setMessage('')
              }}
              className={field}
            />
          </label>
          <label className="grid gap-1.5 text-sm text-muted">
            {t.reach}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={reach}
              onChange={(e) => {
                setReach(e.target.value)
                setMessage('')
              }}
              className={field}
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-medium text-accent-ink transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? t.saving : t.save}
          </button>
          <span role="status" className="text-sm text-accent-text">
            {message}
          </span>
        </div>
      </form>
    </details>
  )
}

// The Instagram week day by day with a tick on each publication, the follower and reach numbers
// with their change, and a short form for today's numbers.
export function IgWeek() {
  const { ig, data } = usePulse()
  const days = weekDays(data.today)
  return (
    <div className="@container">
      <div className="grid min-w-0 gap-5 @5xl:grid-cols-[15rem_minmax(0,1fr)]">
        {data.errors.instagram ? (
          <p role="alert" className="text-sm text-danger @5xl:col-span-2">
            {t.loadError}
          </p>
        ) : null}
        <div className="grid content-start gap-4 @xl:grid-cols-3 @5xl:grid-cols-1">
          <Trend name={t.subscribers} values={trendSeries(ig.days, 'followers')} />
          <Trend name={t.reachYesterday} values={trendSeries(ig.days, 'reach')} />
          <DayNumbers />
        </div>
        <ol className="grid min-w-0 gap-2 @xl:grid-cols-2 @3xl:grid-cols-4 @5xl:grid-cols-7">
          {days.map((day, i) => {
            const items = itemsOfDay(ig.items, day)
            const isToday = day === data.today
            return (
              <li
                key={day}
                className={cn(
                  'min-w-0 rounded-xl border p-2.5',
                  isToday ? 'border-accent-text/60' : 'border-line',
                )}
              >
                <p className="mb-2 flex items-baseline justify-between gap-2 text-sm text-muted">
                  <span>
                    {WEEKDAYS[i]} {Number(day.slice(8))}
                  </span>
                  {isToday ? <span className="text-accent-text">{t.today}</span> : null}
                </p>
                {items.length ? (
                  <ul className="grid gap-1.5">
                    {items.map((item) => (
                      <li key={item.id}>
                        <label
                          className={cn(
                            'flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg bg-surface-2 px-2.5 py-2',
                            item.published && 'text-faint',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={item.published}
                            disabled={ig.busy.has(item.id)}
                            onChange={(e) => void ig.mark(item, e.target.checked)}
                            aria-label={fillAdmin(t.markLabel, { title: item.title })}
                            className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent-text)]"
                          />
                          <span className="min-w-0">
                            <span className="block font-mono text-xs whitespace-nowrap text-muted tabular-nums">
                              {item.time} {t.kinds[item.kind]}
                            </span>
                            <span
                              className={cn(
                                'text-sm leading-snug break-words',
                                item.published && 'line-through',
                              )}
                            >
                              {item.title}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{t.empty}</p>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
