'use client'

import { Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { projectIds, type ProjectId, type Task } from '@/lib/pulse-types'
import { dueState, isOpen, openCount, sortTasks } from '@/lib/pulse-view'
import { usePulse } from './pulse-provider'
import { TaskRow } from './task-row'

const t = admin.pulse.tasks
const names = admin.pulse.projectNames

const field =
  'h-11 rounded-xl border border-line bg-bg/60 px-3 text-[15px] text-fg outline-none placeholder:text-faint focus:border-accent/60'

type Filter = 'all' | ProjectId

function AddTask({ filter }: { filter: Filter }) {
  const { tasks } = usePulse()
  const [draft, setDraft] = useState('')
  const [chosen, setChosen] = useState<ProjectId>('firtech')
  const [open, setOpen] = useState(false)
  const project = filter === 'all' ? chosen : filter

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title || tasks.adding) return
    if (await tasks.add(project, title)) {
      setDraft('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-fit items-center gap-1.5 rounded-full border border-line-strong px-4 lg:h-9 text-sm text-fg transition-colors hover:border-accent-text"
      >
        <Plus size={16} weight="bold" aria-hidden="true" />
        {t.addOpen}
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !draft.trim()) setOpen(false)
      }}
      className="flex flex-wrap gap-2"
    >
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={200}
        placeholder={t.addPlaceholder}
        aria-label={t.addLabel}
        autoComplete="off"
        className={cn(field, 'min-w-0 flex-[1_1_9rem]')}
      />
      {filter === 'all' ? (
        <select
          value={chosen}
          onChange={(e) => setChosen(e.target.value as ProjectId)}
          aria-label={t.addProject}
          className={cn(field, 'w-32 shrink-0')}
        >
          {projectIds.map((id) => (
            <option key={id} value={id}>
              {names[id]}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="submit"
        disabled={!draft.trim() || tasks.adding}
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink transition-transform duration-150 active:scale-[0.97] disabled:bg-surface-2 disabled:text-faint"
      >
        <Plus size={16} weight="bold" aria-hidden="true" />
        {tasks.adding ? t.adding : t.addSubmit}
      </button>
    </form>
  )
}

function Group({
  title,
  list,
  showProject,
  showStatus = true,
}: {
  title: string
  list: Task[]
  showProject: boolean
  showStatus?: boolean
}) {
  if (!list.length) return null
  return (
    <section>
      <h3 className="mb-1 flex items-baseline justify-between gap-3 text-sm text-muted">
        {title}
        <span className="font-mono text-xs tabular-nums">{list.length}</span>
      </h3>
      <ul>
        {list.map((task) => (
          <TaskRow key={task.id} task={task} showProject={showProject} showStatus={showStatus} />
        ))}
      </ul>
    </section>
  )
}

// The task list of all projects. `group="status"` groups by what needs doing (waiting for the owner,
// today, in work, later) and has a tab per project; `group="project"` groups by project.
export function TaskBoard({
  group,
  tabs = false,
  className,
}: {
  group: 'status' | 'project'
  tabs?: boolean
  className?: string
}) {
  const { tasks, data } = usePulse()
  const [filter, setFilter] = useState<Filter>('all')
  const today = data.today
  const open = tasks.tasks.filter(isOpen)
  const shown = filter === 'all' ? open : open.filter((x) => x.project === filter)

  const sorted = sortTasks(shown)
  const blocked = sorted.filter((x) => x.status === 'blocked')
  const rest = sorted.filter((x) => x.status !== 'blocked')
  const dueNow = rest.filter((x) => ['overdue', 'today'].includes(dueState(x.due, today)))
  const doing = rest.filter((x) => x.status === 'doing' && !dueNow.includes(x))
  const later = rest.filter((x) => !dueNow.includes(x) && !doing.includes(x))

  return (
    <div className={cn('grid min-w-0 content-start gap-3 lg:gap-2.5', className)}>
      {data.errors.tasks ? (
        <p
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/40 bg-danger/[0.06] px-4 py-2 text-sm text-danger"
        >
          {t.loadError}
          <button
            type="button"
            onClick={() => void tasks.reload()}
            className="inline-flex h-11 items-center rounded-full border border-danger/50 px-4 text-danger"
          >
            {t.retry}
          </button>
        </p>
      ) : null}

      {tabs ? (
        <div
          role="group"
          aria-label={admin.pulse.projects}
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 max-lg:pr-10 max-lg:[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] lg:flex-wrap lg:overflow-visible lg:pb-0"
        >
          {(['all', ...projectIds] as Filter[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 lg:h-8 lg:px-3 lg:text-[13px] text-sm whitespace-nowrap transition-colors',
                filter === id
                  ? 'border-fg bg-fg text-bg'
                  : 'border-line text-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {id === 'all' ? t.all : names[id]}
              <span className="font-mono text-xs tabular-nums opacity-80">
                {id === 'all' ? open.length : openCount(tasks.tasks, id)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <AddTask filter={filter} />

      {open.length === 0 && !data.errors.tasks ? (
        <p className="py-2 text-sm text-muted">{t.noOpen}</p>
      ) : group === 'status' ? (
        <>
          <Group title={t.group.blocked} list={blocked} showProject showStatus={false} />
          <Group title={t.group.today} list={dueNow} showProject />
          <Group title={t.group.doing} list={doing} showProject />
          <Group title={t.group.later} list={later} showProject />
          {shown.length === 0 && open.length > 0 ? (
            <p className="py-2 text-sm text-muted">{t.noOpenProject}</p>
          ) : null}
        </>
      ) : (
        projectIds.map((id) => {
          const list = sortTasks(open.filter((x) => x.project === id))
          return (
            <section key={id} aria-labelledby={`board-${id}`}>
              <h3
                id={`board-${id}`}
                className="mb-1 flex items-baseline justify-between gap-3 font-brand text-base font-bold tracking-tight"
              >
                {names[id]}
                <span className="font-mono text-xs font-normal text-muted tabular-nums">
                  {list.length}
                </span>
              </h3>
              {list.length ? (
                <ul>
                  {list.map((task) => (
                    <TaskRow key={task.id} task={task} showProject={false} />
                  ))}
                </ul>
              ) : (
                <p className="py-1 text-sm text-muted">{t.noOpenProject}</p>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
