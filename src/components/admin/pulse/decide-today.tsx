'use client'

import { Check } from '@phosphor-icons/react'
import { useState } from 'react'
import { admin, fillAdmin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { decisionsToday, tomorrowOf, type Decision } from '@/lib/pulse-today'
import { shortDate } from '@/lib/pulse-view'
import { usePulse } from './pulse-provider'

const t = admin.pulse.decide
const projectNames = admin.pulse.projectNames
const MAIN = 3

function Card({ decision }: { decision: Decision }) {
  const { tasks, change, openTask, data } = usePulse()
  const { task, reason } = decision
  const busy = tasks.pending.has(task.id)
  const why =
    reason === 'overdue'
      ? fillAdmin(t.overdue, { date: shortDate(task.due ?? '') })
      : reason === 'today'
        ? t.today
        : t.waiting
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-card border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        reason === 'overdue' ? 'border-danger/50' : 'border-line',
        'bg-surface',
      )}
    >
      <button
        type="button"
        onClick={() => openTask(task.id)}
        className="min-w-0 rounded-xl text-left outline-offset-4 hover:text-accent-text"
      >
        <span className="block text-base leading-snug font-medium break-words">{task.title}</span>
        <span className="mt-1 block text-sm leading-snug text-muted">
          {projectNames[task.project]}.{' '}
          <span className={reason === 'overdue' ? 'text-danger' : undefined}>{why}</span>
          {task.notes ? <span className="line-clamp-2"> {task.notes}</span> : null}
        </span>
      </button>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
        <button
          type="button"
          disabled={busy}
          aria-label={fillAdmin(t.doneLabel, { title: task.title })}
          onClick={() =>
            change(task, { status: 'done' }, fillAdmin(t.doneToast, { title: task.title }))
          }
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-medium text-accent-ink transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
        >
          <Check size={16} weight="bold" aria-hidden="true" />
          {t.done}
        </button>
        <button
          type="button"
          disabled={busy}
          aria-label={fillAdmin(t.tomorrowLabel, { title: task.title })}
          onClick={() =>
            change(
              task,
              { due: tomorrowOf(data.today) },
              fillAdmin(t.tomorrowToast, { title: task.title }),
            )
          }
          className="inline-flex h-11 items-center justify-center rounded-full border border-line-strong px-6 text-sm transition-colors hover:border-accent-text disabled:opacity-50"
        >
          {t.tomorrow}
        </button>
      </div>
    </li>
  )
}

// "Decide today": open tasks that are overdue, due today or waiting for the owner without a date.
// "Done" and "Tomorrow" act at once and can be taken back from the toast.
export function DecideToday() {
  const { tasks, data, setTab } = usePulse()
  const [expanded, setExpanded] = useState(false)
  const list = decisionsToday(tasks.tasks, data.today)
  const main = list.slice(0, MAIN)
  const rest = list.slice(MAIN)
  return (
    <section aria-labelledby="decide-title" className="grid gap-3">
      <h2 id="decide-title" className="font-brand text-xl font-bold tracking-tight">
        {t.title}
      </h2>
      {list.length ? (
        <ul className="grid gap-2.5">
          {main.map((d) => (
            <Card key={d.task.id} decision={d} />
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-line bg-surface px-4 py-5 text-[15px] text-muted">
          {t.empty}
        </p>
      )}
      {expanded && rest.length ? (
        <ul id="decide-more" className="grid gap-2.5">
          {rest.map((d) => (
            <Card key={d.task.id} decision={d} />
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {rest.length ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="decide-more"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-sm text-fg transition-colors hover:border-accent-text"
          >
            {expanded ? t.less : fillAdmin(t.more, { n: rest.length })}
          </button>
        ) : null}
        <a
          href="#pulse-details"
          onClick={() => setTab('tasks')}
          className="inline-flex h-11 items-center px-2 text-sm text-accent-text hover:underline"
        >
          {t.all}
        </a>
      </div>
    </section>
  )
}
