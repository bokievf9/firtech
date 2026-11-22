'use client'

import { ArrowsClockwise, CaretLeft, CaretRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { fill } from '@/components/admin/control/api'
import { Loading, Offline, useHqView, btn } from '@/components/admin/hub/ui'
import { admin } from '@/content/admin'
import { calendarHref, eventsByDay, gridDays, normalizeCalendar, rangeOf, shiftAnchor, CALENDAR_KINDS, CALENDAR_VIEWS, type CalendarEvent, type CalendarKind, type CalendarMode } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { sectionById } from '@/lib/hq-shell'

const t = admin.hq
const c = admin.hq.calendar

// One tint per kind: a dot and a soft background, never a text colour on its own.
const DOT: Record<CalendarKind, string> = {
  call: 'bg-dept-sales',
  milestone: 'bg-dept-production',
  routine: 'bg-faint',
  content: 'bg-dept-marketing',
}

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(Date.parse(`${day}T12:00:00Z`))
const timeLabel = (iso: string, tz: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(Date.parse(iso))
  } catch {
    return ''
  }
}

function EventCard({ e, tz, compact }: { e: CalendarEvent; tz: string; compact?: boolean }) {
  const href = calendarHref(e.link)
  const body = (
    <>
      <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[e.kind])} />
      <span className="min-w-0">
        <span className="block truncate text-xs leading-snug font-medium">
          {e.allDay ? null : <span className="mr-1 font-mono text-faint tabular-nums">{timeLabel(e.at, tz)}</span>}
          {e.title}
        </span>
        {compact || !e.detail ? null : <span className="block truncate text-[11px] text-muted">{e.detail}</span>}
      </span>
    </>
  )
  const cls = 'flex min-h-9 items-start gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-left transition-colors hover:border-accent'
  const label = `${c.kinds[e.kind]}: ${e.title}`
  return href ? (
    <Link href={href} className={cls} data-cal-event={e.id} data-kind={e.kind} aria-label={label}>
      {body}
    </Link>
  ) : (
    <div className={cls} data-cal-event={e.id} data-kind={e.kind} aria-label={label}>
      {body}
    </div>
  )
}

// Calendar: calls, project stages, routine runs and planned content in one grid (week or month), from
// HQ's `GET /admin/calendar`. A click on an item opens the HQ section that holds it.
export function CalendarView({ initialDay }: { initialDay: string }) {
  const info = sectionById('calendar')!
  const [mode, setMode] = useState<CalendarMode>('week')
  // The day the grid is on; the first one comes from the server page so both renders agree.
  const [anchor, setAnchor] = useState<string | null>(initialDay)
  const [kinds, setKinds] = useState<ReadonlySet<CalendarKind>>(() => new Set(CALENDAR_KINDS))

  const days = useMemo(() => (anchor ? gridDays(mode, anchor) : []), [mode, anchor])
  const range = days.length ? rangeOf(days) : null
  const view = useHqView(range ? `calendar?from=${range.from}&to=${range.to}` : null, normalizeCalendar, { visible: 60_000, hidden: 180_000 })
  const data = view.view
  const byDay = useMemo(() => (data ? eventsByDay(data.events, kinds) : new Map<string, CalendarEvent[]>()), [data, kinds])
  const today = data?.today ?? anchor
  const toggle = (k: CalendarKind) =>
    setKinds((cur) => {
      const next = new Set(cur)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  const total = days.reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0)
  const title = !anchor
    ? ''
    : mode === 'week'
      ? `${dayLabel(days[0]!, { day: 'numeric', month: 'short' })} - ${dayLabel(days[6]!, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : dayLabel(anchor, { month: 'long', year: 'numeric' })
  const monthOf = anchor?.slice(0, 7)

  return (
    <div className="flex min-h-full flex-col" data-section-view="calendar" data-mode={mode}>
      <div className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-3 sm:px-5">
          <h1 className="font-brand text-xl">{info.label}</h1>
          <p className="text-sm text-muted">{t.sectionHints.calendar}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-1" role="group" aria-label={c.navLabel}>
            <button type="button" className={cn(btn, 'size-10 px-0')} aria-label={c.prev} onClick={() => anchor && setAnchor(shiftAnchor(mode, anchor, -1))}>
              <CaretLeft size={16} aria-hidden="true" />
            </button>
            <button type="button" className={cn(btn, 'min-h-10')} onClick={() => setAnchor(today)} disabled={!today}>
              {c.today}
            </button>
            <button type="button" className={cn(btn, 'size-10 px-0')} aria-label={c.next} onClick={() => anchor && setAnchor(shiftAnchor(mode, anchor, 1))}>
              <CaretRight size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="min-w-0 text-sm font-medium capitalize" data-cal-title aria-live="polite">
            {title}
          </p>
          <div className="ml-auto flex items-center gap-1" role="group" aria-label={c.modeLabel}>
            {CALENDAR_VIEWS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn('inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm transition-colors', mode === m ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:text-fg')}
              >
                {c.modes[m]}
              </button>
            ))}
            <button type="button" onClick={() => void view.reload()} className={cn(btn, 'size-10 px-0')} aria-label={c.refresh}>
              <ArrowsClockwise size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 sm:px-4" role="group" aria-label={c.filterLabel}>
          {CALENDAR_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kinds.has(k)}
              onClick={() => toggle(k)}
              data-kind-filter={k}
              className={cn('inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors', kinds.has(k) ? 'border-line-strong text-fg' : 'border-line text-faint line-through')}
            >
              <span aria-hidden="true" className={cn('size-2 rounded-full', DOT[k])} />
              {c.kinds[k]}
              {data ? <span className="font-mono text-faint tabular-nums">{data.counts[k]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {view.error && !data ? <Offline error={view.error} onRetry={view.reload} /> : null}
      {!data && !view.error ? <Loading rows={4} /> : null}
      {data ? (
        <div className={cn('p-3 sm:p-4', view.stale && 'opacity-60 transition-opacity')} aria-busy={view.stale}>
          {view.failed ? <Offline error={view.failed} onRetry={view.reload} /> : null}
          {total === 0 ? <p className="mb-3 rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">{c.empty}</p> : null}
          {mode === 'week' ? (
            <ol className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-7" data-cal-grid="week">
              {days.map((d) => {
                const list = byDay.get(d) ?? []
                return (
                  <li key={d} data-cal-day={d} data-today={d === today ? 'true' : undefined} className={cn('min-w-0 rounded-xl border bg-inset p-2', d === today ? 'border-accent' : 'border-line')}>
                    <p className={cn('mb-1.5 flex items-baseline gap-1.5 px-1 text-xs capitalize', d === today ? 'text-accent-text' : 'text-muted')}>
                      <span className="font-medium">{dayLabel(d, { weekday: 'short' })}</span>
                      <span className="tabular-nums">{dayLabel(d, { day: 'numeric', month: 'short' })}</span>
                    </p>
                    <ul className="grid gap-1.5">
                      {list.map((e) => (
                        <li key={e.id}>
                          <EventCard e={e} tz={data.tz} />
                        </li>
                      ))}
                    </ul>
                    {list.length === 0 ? <p className="px-1 py-1 text-[11px] text-faint">{c.noItems}</p> : null}
                  </li>
                )
              })}
            </ol>
          ) : (
            <>
              <div className="mb-1 hidden grid-cols-7 gap-1 px-1 text-center text-[11px] text-faint capitalize sm:grid" aria-hidden="true">
                {days.slice(0, 7).map((d) => (
                  <span key={d}>{dayLabel(d, { weekday: 'short' })}</span>
                ))}
              </div>
              <ol className="grid grid-cols-7 gap-1" data-cal-grid="month">
                {days.map((d) => {
                  const list = byDay.get(d) ?? []
                  const inMonth = d.slice(0, 7) === monthOf
                  return (
                    <li key={d} data-cal-day={d} data-today={d === today ? 'true' : undefined} className={cn('min-h-16 min-w-0 rounded-lg border p-1 sm:min-h-28', d === today ? 'border-accent' : 'border-line', inMonth ? 'bg-inset' : 'opacity-50')}>
                      <button
                        type="button"
                        onClick={() => {
                          setAnchor(d)
                          setMode('week')
                        }}
                        aria-label={fill(c.openWeek, { d: dayLabel(d, { day: 'numeric', month: 'long' }) })}
                        className={cn('mb-1 inline-flex min-h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs tabular-nums hover:bg-surface-3', d === today ? 'bg-accent font-medium text-accent-ink' : 'text-muted')}
                      >
                        {Number(d.slice(8))}
                      </button>
                      <ul className="hidden gap-1 sm:grid">
                        {list.slice(0, 3).map((e) => (
                          <li key={e.id}>
                            <EventCard e={e} tz={data.tz} compact />
                          </li>
                        ))}
                      </ul>
                      {list.length > 3 ? (
                        <button
                          type="button"
                          className="mt-1 hidden px-1 text-[11px] text-muted hover:text-fg sm:block"
                          onClick={() => {
                            setAnchor(d)
                            setMode('week')
                          }}
                        >
                          {fill(c.more, { n: list.length - 3 })}
                        </button>
                      ) : null}
                      <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">
                        {list.slice(0, 6).map((e) => (
                          <span key={e.id} className={cn('size-1.5 rounded-full', DOT[e.kind])} />
                        ))}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </>
          )}
          <p className="mt-3 text-center text-[11px] text-faint">{fill(c.footer, { n: total, tz: data.tz })}</p>
        </div>
      ) : null}
    </div>
  )
}

