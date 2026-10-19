'use client'

import { Check } from '@phosphor-icons/react'
import { Fragment } from 'react'
import { admin, fillAdmin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { dayTimeline, decisionsToday, dushanbeClock, type TimelineEntry } from '@/lib/pulse-today'
import { usePulse } from './pulse-provider'

const t = admin.pulse.day
const ig = admin.pulse.ig

function Entry({ entry }: { entry: TimelineEntry }) {
  const pulse = usePulse()
  const tone =
    entry.kind === 'ig' ? (entry.done ? 'bg-accent' : 'bg-line-strong') : 'bg-accent-text'
  let title: string
  let note: string
  if (entry.kind === 'ig') {
    title = entry.item.title
    note = fillAdmin(t.igNote, { kind: ig.kinds[entry.igKind] })
  } else if (entry.kind === 'call') {
    title = fillAdmin(t.call, { name: entry.call.name })
    note = t.callState[entry.call.state]
  } else {
    title = entry.task.title
    note = t.taskDue
  }
  return (
    <li className="grid grid-cols-[3.25rem_0.75rem_minmax(0,1fr)_auto] items-start gap-x-3 py-1.5">
      <span className="pt-0.5 font-mono text-sm text-muted tabular-nums">
        {entry.time ?? t.allDay}
      </span>
      <span aria-hidden="true" className="mt-2 flex justify-center">
        <span className={cn('size-2.5 rounded-full', tone)} />
      </span>
      {entry.kind === 'task' ? (
        <button
          type="button"
          onClick={() => pulse.openTask(entry.task.id)}
          className="min-w-0 rounded-lg text-left hover:text-accent-text"
        >
          <span className="block text-[15px] leading-snug break-words">{title}</span>
          <span className="block text-[13px] text-muted">{note}</span>
        </button>
      ) : (
        <span className="min-w-0">
          <span
            className={cn(
              'block text-[15px] leading-snug break-words',
              entry.done && 'text-faint line-through',
            )}
          >
            {title}
          </span>
          <span className="block text-[13px] text-muted">
            {entry.kind === 'ig' && entry.done ? t.publishedBy : note}
          </span>
        </span>
      )}
      {entry.kind === 'ig' ? (
        <button
          type="button"
          aria-pressed={entry.done}
          disabled={pulse.ig.busy.has(entry.item.id)}
          aria-label={fillAdmin(ig.markLabel, { title: entry.item.title })}
          onClick={() => void pulse.ig.mark(entry.item, !entry.done)}
          className="group -my-1.5 grid size-11 place-items-center disabled:opacity-50"
        >
          <span
            className={cn(
              'grid size-7 place-items-center rounded-full border-2 transition-colors',
              entry.done
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line-strong text-transparent group-hover:border-accent-text group-hover:text-accent-text',
            )}
          >
            <Check size={14} weight="bold" aria-hidden="true" />
          </span>
        </button>
      ) : (
        <span />
      )}
    </li>
  )
}

// The day by the hour: publications, calls and tasks due today, with a "now" marker.
export function DayTimeline() {
  const { tasks, ig: igApi, data } = usePulse()
  const now = Date.parse(data.snapshot.now)
  const { entries, nowIndex } = dayTimeline({
    items: igApi.items,
    calls: data.calls,
    tasks: tasks.tasks,
    now,
    // Tasks of today are already in "Decide today"; they are not repeated here.
    skip: new Set(decisionsToday(tasks.tasks, data.today).map((d) => d.task.id)),
  })
  const marker = (
    <li
      aria-label={fillAdmin(t.now, { time: dushanbeClock(now) })}
      className="grid grid-cols-[3.25rem_0.75rem_minmax(0,1fr)] items-center gap-x-3 py-1"
    >
      <span />
      <span aria-hidden="true" className="h-px bg-accent-text" />
      <span className="font-mono text-xs text-accent-text">
        {fillAdmin(t.now, { time: dushanbeClock(now) })}
      </span>
    </li>
  )
  return (
    <section aria-labelledby="day-title" className="grid gap-2">
      <h2 id="day-title" className="font-brand text-xl font-bold tracking-tight">
        {t.title}
      </h2>
      {entries.length ? (
        <ol className="rounded-card border border-line bg-surface px-4 py-2.5">
          {entries.map((entry, i) => (
            <Fragment key={entry.key}>
              {i === nowIndex ? marker : null}
              <Entry entry={entry} />
            </Fragment>
          ))}
          {nowIndex >= entries.length ? marker : null}
        </ol>
      ) : (
        <p className="rounded-card border border-line bg-surface px-4 py-5 text-[15px] text-muted">
          {t.empty}
        </p>
      )}
    </section>
  )
}
