'use client'

import { admin, fillAdmin } from '@/content/admin'
import { cn } from '@/lib/cn'
import type { Task, TaskStatus } from '@/lib/pulse-types'
import { nextStatus } from '@/lib/pulse-view'

const t = admin.pulse.tasks

export const statusTone: Record<TaskStatus, string> = {
  blocked: 'border-accent/50 bg-accent/10 text-accent',
  doing: 'border-line-strong text-fg',
  todo: 'border-line text-muted',
  done: 'border-line text-faint',
}

const dotTone: Record<TaskStatus, string> = {
  blocked: 'bg-accent shadow-[0_0_8px_var(--color-accent)]',
  doing: 'bg-fg',
  todo: 'bg-faint',
  done: 'bg-faint/40',
}

// One click moves the task to the next status: todo, doing, blocked (waiting for the owner), done.
export function StatusButton({
  task,
  busy,
  onChange,
}: {
  task: Pick<Task, 'title' | 'status'>
  busy?: boolean
  onChange: (status: TaskStatus) => void
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onChange(nextStatus(task.status))}
      aria-label={fillAdmin(t.cycle, { title: task.title, status: t.status[task.status] })}
      className={cn(
        'inline-flex h-6 w-[5.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full border px-2 font-mono text-[10.5px] tracking-wide whitespace-nowrap uppercase transition-[border-color,background-color,color] duration-150 hover:border-accent/60 disabled:opacity-50',
        statusTone[task.status],
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 shrink-0 rounded-full', dotTone[task.status])}
      />
      {t.statusShort[task.status]}
    </button>
  )
}
