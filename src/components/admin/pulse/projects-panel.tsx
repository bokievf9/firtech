'use client'

import { admin, fillAdmin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { projectIds, type ProjectId, type Task } from '@/lib/pulse-types'
import {
  blockedCount,
  dueState,
  nextOpenTasks,
  openCount,
  projectProgress,
  shortDate,
} from '@/lib/pulse-view'
import { StatusButton } from './status-button'
import type { TasksApi } from './use-tasks'

const t = admin.pulse

function TaskLine({ task, api, today }: { task: Task; api: TasksApi; today: string }) {
  const state = dueState(task.due, today)
  return (
    <li className="flex min-w-0 items-center gap-2 py-0.5">
      <StatusButton
        task={task}
        busy={api.pending.has(task.id)}
        onChange={(status) => void api.update(task.id, { status })}
      />
      <span className="min-w-0 flex-1 text-sm max-lg:line-clamp-2 lg:truncate" title={task.title}>
        {task.title}
      </span>
      {task.due ? (
        <span
          className={cn(
            'shrink-0 font-mono text-[11px] tabular-nums',
            state === 'overdue' ? 'text-danger' : state === 'today' ? 'text-accent' : 'text-faint',
          )}
        >
          {state === 'today' ? t.tasks.dueToday : shortDate(task.due)}
        </span>
      ) : null}
    </li>
  )
}

function Progress({ value }: { value: number | null }) {
  if (value === null) return <span className="font-mono text-[11px] text-faint">{t.noGoals}</span>
  return (
    <span className="flex items-center gap-2">
      <span
        role="img"
        aria-label={fillAdmin(t.progress, { n: value })}
        className="h-1 w-16 overflow-hidden rounded-full bg-surface-2"
      >
        <span
          className="block h-full rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]"
          style={{ width: `${value}%` }}
        />
      </span>
      <span aria-hidden="true" className="font-mono text-xs text-accent tabular-nums">
        {value}%
      </span>
    </span>
  )
}

function Waiting({ n }: { n: number }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] whitespace-nowrap',
        n ? 'border border-accent/40 bg-accent/10 text-accent' : 'text-faint',
      )}
    >
      {n ? fillAdmin(t.waiting, { n }) : t.waitingNone}
    </span>
  )
}

function ProjectCard({
  id,
  big,
  api,
  goals,
  today,
  onOpen,
}: {
  id: ProjectId
  big: boolean
  api: TasksApi
  goals: { project: string; progress: number }[]
  today: string
  onOpen: (id: ProjectId) => void
}) {
  const next = nextOpenTasks(api.tasks, id, big ? 3 : 1)
  const open = openCount(api.tasks, id)
  return (
    <section
      aria-labelledby={`pulse-project-${id}`}
      className={cn(
        'min-w-0 rounded-card border border-line bg-surface',
        big ? 'px-4 py-2.5' : 'px-4 py-2',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3
          id={`pulse-project-${id}`}
          className={cn('font-brand font-bold tracking-tight', big ? 'text-lg' : 'text-sm')}
        >
          {t.projectNames[id]}
        </h3>
        <Progress value={projectProgress(goals, id)} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <Waiting n={blockedCount(api.tasks, id)} />
        <button
          type="button"
          onClick={() => onOpen(id)}
          className="rounded-full px-2 py-1 text-xs text-muted transition-colors hover:text-accent"
        >
          {t.allTasks} <span className="font-mono tabular-nums">{open}</span>
        </button>
      </div>
      {next.length ? (
        <ul className="mt-1">
          {next.map((task) => (
            <TaskLine key={task.id} task={task} api={api} today={today} />
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-faint">{t.noOpen}</p>
      )}
    </section>
  )
}

export function ProjectsPanel({
  api,
  goals,
  today,
  failed,
  onOpen,
}: {
  api: TasksApi
  goals: { project: string; progress: number }[]
  today: string
  failed: boolean
  onOpen: (id: ProjectId) => void
}) {
  return (
    <section
      aria-label={t.projects}
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3"
    >
      {failed ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/[0.05] px-4 py-3 text-sm text-danger"
        >
          {t.tasksLoadError}
        </p>
      ) : null}
      {projectIds.map((id) => (
        <ProjectCard
          key={id}
          id={id}
          big={id === 'firtech' || id === 'vibely'}
          api={api}
          goals={goals}
          today={today}
          onOpen={onOpen}
        />
      ))}
    </section>
  )
}
