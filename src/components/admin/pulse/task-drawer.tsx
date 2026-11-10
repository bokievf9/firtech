'use client'

import { Check, Sparkle, Sun, Trash, X } from '@phosphor-icons/react'
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
import { stamp, tomorrowOf } from '@/lib/pulse-today'
import { dueState, shortDate } from '@/lib/pulse-view'
import { usePulse } from './pulse-provider'
import { StatusSegments } from './status-segments'

const t = admin.pulse.tasks
const names = admin.pulse.projectNames

const field =
  'h-11 w-full rounded-xl border border-line bg-bg/60 px-3 text-[15px] text-fg outline-none placeholder:text-faint focus:border-accent/60'
const label = 'grid gap-1.5 text-sm text-muted'
const pill =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong px-5 text-sm text-fg transition-colors hover:border-accent-text disabled:opacity-50'

// Full editor of one task: the title, status as segments, date, priority, project, a note, and the
// quick actions (done, to tomorrow, ask Echo). The task comes from the live list, so a change made
// here shows on the page behind at once.
function TaskEditor({ task }: { task: Task }) {
  const { tasks, change, closeTask, echo, echoEnabled, data } = usePulse()
  const busy = tasks.pending.has(task.id)
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [sure, setSure] = useState(false)
  const done = task.status === 'done'

  function saveTitle() {
    const next = title.trim()
    if (!next) return setTitle(task.title)
    if (next !== task.title) void tasks.update(task.id, { title: next })
  }

  return (
    <div className="grid content-start gap-4">
      <label className={label}>
        {t.titleLabel}
        <input
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className={field}
        />
      </label>

      <StatusSegments
        value={task.status}
        disabled={busy}
        onChange={(status: TaskStatus) => void tasks.update(task.id, { status })}
      />

      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          {t.due}
          <input
            type="date"
            value={task.due ?? ''}
            onChange={(e) => void tasks.update(task.id, { due: e.target.value || null })}
            className={cn(field, 'font-mono')}
          />
        </label>
        <label className={label}>
          {t.priority}
          <select
            value={task.priority}
            onChange={(e) =>
              void tasks.update(task.id, { priority: e.target.value as TaskPriority })
            }
            className={field}
          >
            {(Object.keys(t.priorities) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {t.priorities[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={label}>
        {t.project}
        <select
          value={task.project}
          onChange={(e) => void tasks.update(task.id, { project: e.target.value as ProjectId })}
          className={field}
        >
          {projectIds.map((id) => (
            <option key={id} value={id}>
              {names[id]}
            </option>
          ))}
        </select>
      </label>

      <label className={label}>
        {t.notes}
        <textarea
          value={notes}
          maxLength={2000}
          rows={4}
          placeholder={t.notesPlaceholder}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== task.notes && void tasks.update(task.id, { notes })}
          className="w-full resize-y rounded-xl border border-line bg-bg/60 px-3 py-2.5 text-[15px] text-fg outline-none placeholder:text-faint focus:border-accent/60"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            change(
              task,
              { status: done ? 'todo' : 'done' },
              fillAdmin(done ? t.reopenToast : t.doneToast, { title: task.title }),
            )
            closeTask()
          }}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-medium text-accent-ink transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
        >
          <Check size={16} weight="bold" aria-hidden="true" />
          {done ? t.markOpen : t.markDone}
        </button>
        <button
          type="button"
          disabled={busy || done}
          onClick={() => {
            change(
              task,
              { due: tomorrowOf(data.today) },
              fillAdmin(t.postponeToast, { title: task.title }),
            )
            closeTask()
          }}
          className={pill}
        >
          <Sun size={16} aria-hidden="true" />
          {t.postpone}
        </button>
        {echoEnabled && (
          <button
            type="button"
            onClick={() => {
              closeTask()
              echo.ask(fillAdmin(t.echoQuestion, { title: task.title, project: names[task.project] }))
            }}
            className={pill}
          >
            <Sparkle size={16} aria-hidden="true" />
            {t.askEcho}
          </button>
        )}
      </div>

      <div className="grid gap-3 border-t border-line pt-4 text-sm text-muted">
        <p>
          {fillAdmin(t.createdAt, { source: t.source[task.source], date: stamp(task.createdAt) })}
          <br />
          {fillAdmin(t.changedAt, { date: stamp(task.updatedAt) })}
        </p>
        {sure ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                closeTask()
                void tasks.remove(task.id)
              }}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-danger/60 px-5 text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
            >
              <Trash size={16} aria-hidden="true" />
              {t.removeSure}
            </button>
            <button type="button" onClick={() => setSure(false)} className={pill}>
              {t.removeCancel}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSure(true)}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-line px-5 text-sm text-danger transition-colors hover:border-danger/60"
          >
            <Trash size={16} aria-hidden="true" />
            {t.remove}
          </button>
        )}
      </div>
    </div>
  )
}

// One task in a modal sheet from the right (native dialog: focus is trapped and Escape closes it).
export function TaskDrawer() {
  const { tasks, selected, closeTask, data } = usePulse()
  const dialog = useRef<HTMLDialogElement>(null)
  const task = tasks.tasks.find((x) => x.id === selected) ?? null
  const isOpen = task !== null

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (isOpen && !el.open) el.showModal()
    if (!isOpen && el.open) el.close()
  }, [isOpen])

  return (
    <dialog
      ref={dialog}
      aria-labelledby="task-drawer-title"
      onClose={closeTask}
      onClick={(e) => {
        if (e.target === dialog.current) closeTask()
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none flex-col border-l border-line-strong bg-surface p-0 text-fg backdrop:bg-black/60 open:flex sm:w-[30rem]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          {task ? (
            <p className="mb-1 inline-block rounded-full border border-line-strong px-2.5 py-0.5 text-xs text-muted">
              {names[task.project]}
            </p>
          ) : null}
          <h2
            id="task-drawer-title"
            className="line-clamp-2 font-brand text-lg leading-snug font-bold tracking-tight break-words"
          >
            {task ? task.title : t.title}
          </h2>
          {task && task.status !== 'done' && dueState(task.due, data.today) === 'overdue' ? (
            <p className="mt-0.5 text-sm text-danger">
              {fillAdmin(t.overdueSince, { date: shortDate(task.due ?? '') })}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={closeTask}
          aria-label={t.close}
          className="grid size-11 place-items-center rounded-full border border-line text-muted transition-colors hover:text-fg"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {/* Keyed by what is saved, so the fields follow the server copy after a save or a rollback. */}
        {task ? <TaskEditor key={`${task.id}\n${task.title}\n${task.notes}`} task={task} /> : null}
      </div>
    </dialog>
  )
}
