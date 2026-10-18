'use client'

import { useState } from 'react'
import { Panel } from '@/components/admin/admin-shell'
import { Sparkline } from '@/components/admin/sparkline'
import { admin, fillAdmin } from '@/content/admin'
import { cn } from '@/lib/cn'
import type { IgDay, IgItem } from '@/lib/pulse-types'
import { nextIgItems, shortDate, trendSeries, trendSummary } from '@/lib/pulse-view'
import { api, ApiError, igScope } from './api'

const t = admin.pulse.ig
const field =
  'h-9 w-full rounded-xl border border-line bg-bg/60 px-3 font-mono text-sm text-fg tabular-nums outline-none placeholder:text-faint focus:border-accent/60'

function Trend({ name, values }: { name: string; values: number[] }) {
  const { last, delta } = trendSummary(values)
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-faint">{name}</p>
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-xl tabular-nums">{last ?? '-'}</span>
          {delta !== null ? (
            <span
              className={cn(
                'font-mono text-xs tabular-nums',
                delta > 0 ? 'text-accent' : delta < 0 ? 'text-danger' : 'text-faint',
              )}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          ) : null}
        </p>
      </div>
      {values.length > 1 ? (
        <Sparkline values={values} label={fillAdmin(t.trendLabel, { name })} />
      ) : (
        <span className="w-[120px] text-right text-xs text-faint">{t.trendNone}</span>
      )}
    </div>
  )
}

// Compact Instagram panel: next publications with a done checkbox, today's numbers and a trend.
export function InstagramPanel({
  items: initialItems,
  days: initialDays,
  today,
  failed,
  onError,
}: {
  items: IgItem[]
  days: IgDay[]
  today: string
  failed: boolean
  onError: (message: string | null) => void
}) {
  const [items, setItems] = useState(initialItems)
  const [days, setDays] = useState(initialDays)
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const setError = onError
  const current = days.find((d) => d.date === today)
  const [followers, setFollowers] = useState(current?.followers?.toString() ?? '')
  const [reach, setReach] = useState(current?.reach?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // The three rows stay in place after a tick (so it can be undone, nothing jumps); the next
  // publications fill in on reload.
  const [windowIds] = useState(() => nextIgItems(initialItems, 3).map((i) => i.id))
  const visible = windowIds.flatMap((id) => items.find((i) => i.id === id) ?? [])

  async function mark(item: IgItem, published: boolean) {
    setError(null)
    setBusy((s) => new Set(s).add(item.id))
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, published } : i)))
    try {
      const { item: saved } = await api<{ item: IgItem }>(
        `/api/admin/instagram/items/${encodeURIComponent(item.id)}`,
        { method: 'PATCH', body: { published } },
        igScope,
        t.errors.mark,
      )
      setItems((list) => list.map((i) => (i.id === item.id ? saved : i)))
    } catch (e) {
      setItems((list) => list.map((i) => (i.id === item.id ? item : i)))
      setError(e instanceof ApiError ? e.message : t.errors.mark)
    } finally {
      setBusy((s) => {
        const next = new Set(s)
        next.delete(item.id)
        return next
      })
    }
  }

  async function saveDay(e: React.FormEvent) {
    e.preventDefault()
    const f = followers.trim() === '' ? null : Number(followers)
    const r = reach.trim() === '' ? null : Number(reach)
    if (
      (f === null && r === null) ||
      [f, r].some((v) => v !== null && (!Number.isFinite(v) || v < 0))
    ) {
      setError(t.needValue)
      return
    }
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      const { day } = await api<{ day: IgDay }>(
        '/api/admin/instagram/days',
        { method: 'PUT', body: { date: today, followers: f, reach: r } satisfies IgDay },
        igScope,
        t.errors.day,
      )
      setDays((list) => [...list.filter((d) => d.date !== day.date), day])
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.errors.day)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel className="p-4 sm:p-4">
      <h2 className="sr-only">{t.title}</h2>
      {failed ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {t.loadError}
        </p>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr] lg:gap-6">
        <div>
          <h3 className="mb-1.5 text-xs font-medium text-faint">
            <span className="text-accent">{t.title}</span> · {t.next}
          </h3>
          {visible.length ? (
            <ul className="divide-y divide-line">
              {visible.map((item) => (
                <li key={item.id}>
                  <label
                    className={cn(
                      'flex min-h-8 cursor-pointer items-center gap-3 py-1 text-sm',
                      item.published && 'text-faint',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={item.published}
                      disabled={busy.has(item.id)}
                      onChange={(e) => void mark(item, e.target.checked)}
                      aria-label={fillAdmin(t.markLabel, { title: item.title })}
                      className="size-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span className="w-[6.75rem] shrink-0 font-mono text-[11px] whitespace-nowrap text-muted tabular-nums">
                      {shortDate(item.date)} {item.time}
                    </span>
                    <span className="w-12 shrink-0 font-mono text-[10.5px] tracking-wide text-faint uppercase">
                      {t.kinds[item.kind]}
                    </span>
                    <span
                      className={cn('min-w-0 flex-1 truncate', item.published && 'line-through')}
                      title={item.title}
                    >
                      {item.title}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-faint">{t.nextNone}</p>
          )}
        </div>

        <form onSubmit={saveDay} className="grid content-start gap-2.5" aria-label={t.numbers}>
          <h3 className="text-xs font-medium text-faint">{t.numbers}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="grid gap-1 text-xs text-faint">
              {t.followers}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={followers}
                onChange={(e) => {
                  setFollowers(e.target.value)
                  setSaved(false)
                }}
                className={field}
              />
            </label>
            <label className="grid gap-1 text-xs text-faint">
              {t.reach}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={reach}
                onChange={(e) => {
                  setReach(e.target.value)
                  setSaved(false)
                }}
                className={field}
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
            >
              {saving ? t.saving : t.save}
            </button>
            <span role="status" className="text-xs text-accent">
              {saved ? t.saved : ''}
            </span>
          </div>
        </form>

        <div className="grid content-start gap-3">
          <h3 className="text-xs font-medium text-faint">{t.trend}</h3>
          <Trend name={t.followers} values={trendSeries(days, 'followers')} />
          <Trend name={t.reach} values={trendSeries(days, 'reach')} />
        </div>
      </div>
    </Panel>
  )
}
