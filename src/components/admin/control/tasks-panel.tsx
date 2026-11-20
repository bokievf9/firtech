'use client'

import { ArrowClockwise, Kanban, UserFocus, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import {
  blockedReason,
  taskBoard,
  type HqDepartment,
  type HqTask,
  type Id,
  type TaskColumn,
  type TaskFilter,
} from '@/lib/hq-admin-view'
import { formatDuration, formatUntil, minutesSince } from '@/lib/office-view'
import { errText, fill } from './api'
import { CcPanel } from './cc-panel'

const t = admin.cc.tasks
const deptName = (id: string) => (admin.office.depts as Record<string, string>)[id] ?? id

const columnTone: Record<TaskColumn, string> = {
  inbox: 'bg-line-strong',
  assigned: 'bg-line-strong',
  running: 'bg-accent',
  review: 'bg-fg/50',
  approval: 'bg-accent/50',
  blocked: 'bg-danger',
  done: 'bg-accent/30',
}

export type BoardFilter = TaskFilter & { label?: string | null }

function TaskCard({
  task,
  column,
  now,
  showDept,
  onOpen,
  onRetry,
}: {
  task: HqTask
  column: TaskColumn
  now: number
  showDept: boolean
  onOpen: (id: Id) => void
  onRetry: (task: HqTask) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const reason = column === 'blocked' ? blockedReason(task) : null
  const priority = (t.priority as Record<string, string>)[String(task.priority)]
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'min-w-0 rounded-xl border bg-inset transition-colors hover:border-line-strong',
        column === 'blocked' ? 'border-danger/40' : 'border-line',
      )}
    >
      <button type="button" onClick={() => onOpen(task.id)} className="block w-full p-3 text-left">
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-sm leading-snug font-medium break-words">{task.title}</span>
          <span className="shrink-0 font-mono text-[11px] text-faint">#{task.id}</span>
        </span>
        <span className="mt-1 block truncate text-xs text-muted">
          {[task.assigneeTitle, showDept ? deptName(task.dept) : null].filter(Boolean).join(' · ')}
        </span>
        {column === 'running' && task.progressLine ? (
          <span className="mt-2 flex items-center gap-1.5 text-xs text-accent-text">
            <span aria-hidden="true" className="office-breathe size-1.5 shrink-0 rounded-full bg-accent" />
            <span className="min-w-0 truncate" aria-live="polite">
              {task.progressLine}
            </span>
          </span>
        ) : null}
        {reason ? <span className="mt-2 block text-xs break-words text-danger">{reason}</span> : null}
        <span className="mt-2 flex flex-wrap gap-x-2 text-[11px] text-faint tabular-nums">
          {priority ? <span className={task.priority === 'high' ? 'text-danger' : ''}>{priority}</span> : null}
          {task.dueAt ? <span>{fill(t.due, { t: formatUntil(task.dueAt, now) || formatDuration(0) })}</span> : null}
          <span>{fill(t.updated, { t: formatDuration(minutesSince(task.updatedAt, now) ?? 0) })}</span>
        </span>
      </button>
      {column === 'blocked' ? (
        <div className="px-3 pb-3">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onRetry(task)
              setBusy(false)
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-fg px-3.5 text-xs font-medium text-bg disabled:opacity-50"
          >
            <ArrowClockwise size={13} weight="bold" aria-hidden="true" className={busy ? 'animate-spin' : ''} />
            {t.retry}
          </button>
        </div>
      ) : null}
    </motion.li>
  )
}

export function TasksPanel({
  items,
  error,
  now,
  tz,
  filter,
  departments,
  className,
  onFilter,
  onOpen,
  onRetry,
}: {
  items: HqTask[] | null
  error: string | null
  now: number
  tz: string
  filter: BoardFilter
  departments: HqDepartment[]
  className?: string
  onFilter: (filter: BoardFilter) => void
  onOpen: (id: Id) => void
  onRetry: (task: HqTask) => Promise<void>
}) {
  const board = items ? taskBoard(items, filter, now, tz) : null
  const deptIds = departments.length ? departments.map((d) => d.id) : [...new Set((items ?? []).map((i) => i.dept))]
  return (
    <CcPanel
      id="tasks"
      title={t.title}
      icon={<Kanban size={18} aria-hidden="true" />}
      className={className}
      aside={board ? <span className="px-2 text-xs text-faint tabular-nums">{fill(t.open, { n: board.open })}</span> : null}
    >
      <div className="@container flex min-h-0 flex-1 flex-col">
        <div role="group" aria-label={t.filter} className="flex gap-1.5 overflow-x-auto px-4 pt-3 pb-1">
          {[null, ...deptIds].map((id) => {
            const active = (filter.dept ?? null) === id && !filter.assigneeId
            return (
              <button
                key={id ?? 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => onFilter({ dept: id, assigneeId: null })}
                className={cn(
                  'inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-xs transition-colors',
                  active ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:text-fg',
                )}
              >
                {id ? deptName(id) : t.all}
              </button>
            )
          })}
          {filter.assigneeId ? (
            <span className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-accent bg-surface-2 pr-1 pl-3 text-xs">
              <UserFocus size={14} aria-hidden="true" className="text-accent-text" />
              {fill(t.person, { name: filter.label ?? filter.assigneeId })}
              <button
                type="button"
                onClick={() => onFilter({ dept: filter.dept, assigneeId: null })}
                aria-label={t.clear}
                className="grid size-7 place-items-center rounded-full hover:bg-surface-3"
              >
                <X size={12} weight="bold" aria-hidden="true" />
              </button>
            </span>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3 lg:max-h-[40rem] min-[120rem]:max-h-[46rem]">
          {error && !board ? <p className="p-2 text-sm text-danger">{errText(error)}</p> : null}
          {!board && !error ? <div className="h-48 animate-pulse rounded-xl bg-surface-2/60" /> : null}
          {board && !board.total ? <p className="p-2 text-sm text-muted">{t.empty}</p> : null}
          {board && board.total ? (
            <div className="grid gap-4 @5xl:grid-cols-7 @5xl:gap-2.5">
              {board.columns.map((col) => (
                <section
                  key={col.id}
                  aria-label={t.columns[col.id]}
                  className={cn('min-w-0', !col.tasks.length && 'hidden @5xl:block')}
                >
                  <h3 className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-muted">
                    <span aria-hidden="true" className={cn('size-2 rounded-full', columnTone[col.id])} />
                    {t.columns[col.id]}
                    <span className="ml-auto text-faint tabular-nums">{col.tasks.length}</span>
                  </h3>
                  {col.tasks.length ? (
                    <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                      <AnimatePresence initial={false}>
                        {col.tasks.map((task) => (
                          <TaskCard
                            key={String(task.id)}
                            task={task}
                            column={col.id}
                            now={now}
                            showDept={!filter.dept}
                            onOpen={onOpen}
                            onRetry={onRetry}
                          />
                        ))}
                      </AnimatePresence>
                    </ul>
                  ) : (
                    <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-faint">
                      {t.columnEmpty}
                    </p>
                  )}
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </CcPanel>
  )
}
