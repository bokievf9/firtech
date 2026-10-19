'use client'

import { Check } from '@phosphor-icons/react'
import { admin, fillAdmin } from '@/content/admin'
import { cn } from '@/lib/cn'
import type { Task } from '@/lib/pulse-types'
import { dueState, shortDate } from '@/lib/pulse-view'
import { usePulse } from './pulse-provider'

const t = admin.pulse.tasks

// One open task: a round tick that marks it done (with undo) and the full title that opens the
// task. Both targets are at least 44 px high; the title wraps instead of being cut.
export function TaskRow({
  task,
  showProject = true,
  showStatus = true,
}: {
  task: Task
  showProject?: boolean
  showStatus?: boolean
}) {
  const { tasks, change, openTask, data } = usePulse()
  const today = data.today
  const done = task.status === 'done'
  const state = dueState(task.due, today)
  const dueText = !task.due
    ? ''
    : state === 'today'
      ? t.dueToday
      : state === 'overdue'
        ? fillAdmin(t.dueOverdue, { date: shortDate(task.due) })
        : shortDate(task.due)
  const sub = [
    showProject ? admin.pulse.projectNames[task.project] : null,
    showStatus && task.status === 'blocked' ? t.status.blocked.toLowerCase() : null,
    task.status === 'doing' ? t.status.doing.toLowerCase() : null,
  ].filter(Boolean)
  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        aria-pressed={done}
        disabled={tasks.pending.has(task.id)}
        aria-label={fillAdmin(done ? t.toggleOpen : t.toggleDone, { title: task.title })}
        onClick={() =>
          change(
            task,
            { status: done ? 'todo' : 'done' },
            fillAdmin(done ? t.reopenToast : t.doneToast, { title: task.title }),
          )
        }
        className="group grid w-11 shrink-0 place-items-center disabled:opacity-50"
      >
        <span
          className={cn(
            'grid size-7 place-items-center rounded-full border-2 transition-colors duration-150',
            done
              ? 'border-accent bg-accent text-accent-ink'
              : task.status === 'blocked'
                ? 'border-accent-text/80 text-transparent group-hover:text-accent-text'
                : 'border-line-strong text-transparent group-hover:border-accent-text group-hover:text-accent-text',
          )}
        >
          <Check size={14} weight="bold" aria-hidden="true" />
        </span>
      </button>
      <button
        type="button"
        onClick={() => openTask(task.id)}
        aria-label={fillAdmin(t.open, { title: task.title })}
        className="flex min-h-11 min-w-0 flex-1 items-start justify-between gap-3 rounded-xl py-2 pr-1 text-left lg:py-1.5 transition-colors hover:text-accent-text"
      >
        <span className="min-w-0">
          <span
            className={cn(
              'block text-[15px] leading-snug break-words',
              done && 'text-faint line-through',
            )}
          >
            {task.title}
          </span>
          {sub.length || (task.due && !done) ? (
            <span className="mt-0.5 block text-[13px] text-muted">
              {sub.join(', ')}
              {task.due && !done ? (
                <span
                  className={cn(
                    'font-mono tabular-nums sm:hidden',
                    sub.length && 'before:content-["_·_"]',
                    state === 'overdue' && 'text-danger',
                    state === 'today' && 'text-accent-text',
                  )}
                >
                  {dueText}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
        {task.due && !done ? (
          <span
            className={cn(
              'shrink-0 pt-0.5 font-mono max-sm:hidden text-xs whitespace-nowrap tabular-nums',
              state === 'overdue'
                ? 'text-danger'
                : state === 'today'
                  ? 'text-accent-text'
                  : 'text-muted',
            )}
          >
            {dueText}
          </span>
        ) : null}
      </button>
    </li>
  )
}
