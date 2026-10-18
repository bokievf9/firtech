'use client'

import { CaretDown, Plus, Trash, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { admin, fillAdmin } from '@/content/admin'
import { cn } from '@/lib/cn'
import {
  projectIds,
  type ProjectId,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/pulse-types'
import { dueState, openCount, projectTasks, shortDate, sortTasks } from '@/lib/pulse-view'
import { StatusButton } from './status-button'
import type { TasksApi } from './use-tasks'

const t = admin.pulse.tasks
const names = admin.pulse.projectNames

const field =
  'w-full rounded-xl border border-line bg-bg/60 px-3 text-sm outline-none placeholder:text-faint focus:border-accent/60'

function DueChip({ due, today }: { due: string | null; today: string }) {
  const state = dueState(due, today)
  if (!due) return null
  return (
    <span
      className={cn(
        'shrink-0 font-mono text-[11px] tabular-nums',
        state === 'overdue' ? 'text-danger' : state === 'today' ? 'text-accent' : 'text-faint',
      )}
    >
      {state === 'overdue'
        ? `${shortDate(due)} ${t.dueOverdue}`
        : state === 'today'
          ? t.dueToday
          : shortDate(due)}
    </span>
  )
}

function TaskRow({ task, api, today }: { task: Task; api: TasksApi; today: string }) {
  const [open, setOpen] = useState(false)
  const busy = api.pending.has(task.id)
  const panelId = `task-${task.id}`
  return (
    <li className={cn('py-2.5', task.status === 'blocked' && 'bg-accent/[0.03]')}>
      <TaskSummary
        task={task}
        api={api}
        today={today}
        open={open}
        panelId={panelId}
        busy={busy}
        onToggle={() => setOpen((v) => !v)}
      />
      {/* Keyed by the saved text, so the fields follow the server copy after a save or a rollback. */}
      {open ? (
        <TaskEditor
          key={`${task.title}\n${task.notes}`}
          task={task}
          api={api}
          panelId={panelId}
          busy={busy}
        />
      ) : null}
    </li>
  )
}

function TaskEditor({
  task,
  api,
  panelId,
  busy,
}: {
  task: Task
  api: TasksApi
  panelId: string
  busy: boolean
}) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)

  function saveTitle() {
    const next = title.trim()
    if (!next) return setTitle(task.title)
    if (next !== task.title) void api.update(task.id, { title: next })
  }

  return (
    <div id={panelId} className="mt-3 grid gap-3 pl-0 sm:pl-[6.25rem]">
      <label className="grid gap-1 text-xs text-faint">
        {t.titleLabel}
        <input
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className={cn(field, 'h-10 text-fg')}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs text-faint">
          {t.statusLabel}
          <select
            value={task.status}
            onChange={(e) => void api.update(task.id, { status: e.target.value as TaskStatus })}
            className={cn(field, 'h-10 text-fg')}
          >
            {(Object.keys(t.status) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-faint">
          {t.priority}
          <select
            value={task.priority}
            onChange={(e) => void api.update(task.id, { priority: e.target.value as TaskPriority })}
            className={cn(field, 'h-10 text-fg')}
          >
            {(Object.keys(t.priorities) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {t.priorities[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-faint">
          {t.due}
          <input
            type="date"
            value={task.due ?? ''}
            onChange={(e) => void api.update(task.id, { due: e.target.value || null })}
            className={cn(field, 'h-10 text-fg')}
          />
        </label>
        <label className="grid gap-1 text-xs text-faint">
          {t.forProject}
          <select
            value={task.project}
            onChange={(e) => void api.update(task.id, { project: e.target.value as ProjectId })}
            className={cn(field, 'h-10 text-fg')}
          >
            {projectIds.map((id) => (
              <option key={id} value={id}>
                {names[id]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-xs text-faint">
        {t.notes}
        <textarea
          value={notes}
          maxLength={2000}
          rows={3}
          placeholder={t.notesPlaceholder}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== task.notes && void api.update(task.id, { notes })}
          className={cn(field, 'resize-y py-2 text-fg')}
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] tracking-wide text-faint uppercase">
          {t.source[task.source]}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(fillAdmin(t.removeConfirm, { title: task.title })))
              void api.remove(task.id)
          }}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-line px-4 text-sm text-danger transition-colors hover:border-danger/60 disabled:opacity-50"
        >
          <Trash size={16} aria-hidden="true" />
          {t.remove}
        </button>
      </div>
    </div>
  )
}

function TaskSummary({
  task,
  api,
  today,
  open,
  panelId,
  busy,
  onToggle,
}: {
  task: Task
  api: TasksApi
  today: string
  open: boolean
  panelId: string
  busy: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <StatusButton
        task={task}
        busy={busy}
        onChange={(status) => void api.update(task.id, { status })}
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          task.status === 'done' && 'text-faint line-through',
        )}
        title={task.title}
      >
        {task.title}
      </span>
      <DueChip due={task.due} today={today} />
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={fillAdmin(t.editFor, { title: task.title })}
        onClick={onToggle}
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-fg"
      >
        <CaretDown
          size={16}
          aria-hidden="true"
          className={cn(
            'transition-transform duration-150 motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
    </div>
  )
}

// Full task editor for one project at a time, in a modal sheet (native dialog: focus is trapped
// and Escape closes it).
export function TaskDrawer({
  project,
  onProject,
  onClose,
  api,
  today,
}: {
  project: ProjectId | null
  onProject: (id: ProjectId) => void
  onClose: () => void
  api: TasksApi
  today: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (project && !el.open) el.showModal()
    if (!project && el.open) el.close()
  }, [project])

  const list = project ? sortTasks(projectTasks(api.tasks, project)) : []

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title || !project || api.adding) return
    if (await api.add(project, title)) setDraft('')
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="task-drawer-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose()
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none flex-col border-l border-line-strong bg-surface p-0 text-fg backdrop:bg-black/60 open:flex sm:w-[34rem]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id="task-drawer-title" className="font-brand text-lg font-bold tracking-tight">
          {t.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="grid size-10 place-items-center rounded-full border border-line text-muted transition-colors hover:text-fg"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div
        role="group"
        aria-label={t.forProject}
        className="flex gap-1.5 overflow-x-auto px-5 py-3"
      >
        {projectIds.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === project}
            onClick={() => onProject(id)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors',
              id === project
                ? 'border-accent/60 bg-accent/10 text-accent'
                : 'border-line text-muted hover:text-fg',
            )}
          >
            {names[id]}
            <span className="ml-2 font-mono text-xs tabular-nums">{openCount(api.tasks, id)}</span>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 px-5 pb-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder={t.addPlaceholder}
          aria-label={t.addLabel}
          autoComplete="off"
          className={cn(field, 'h-11 min-w-0 flex-1')}
        />
        <button
          type="submit"
          disabled={!draft.trim() || api.adding}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-transform duration-150 active:scale-[0.97] disabled:opacity-40"
        >
          <Plus size={16} weight="bold" aria-hidden="true" />
          {api.adding ? t.adding : t.addSubmit}
        </button>
      </form>
      <p
        role="alert"
        aria-live="assertive"
        className={cn('px-5 text-sm text-danger', api.error ? 'pb-2' : 'sr-only')}
      >
        {api.error}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map((task) => (
              <TaskRow key={task.id} task={task} api={api} today={today} />
            ))}
          </ul>
        ) : (
          <p className="py-6 text-sm text-faint">{t.empty}</p>
        )}
      </div>
    </dialog>
  )
}
