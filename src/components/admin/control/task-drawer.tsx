'use client'

import { ArrowClockwise, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { blockedReason, taskColumn, type HqTask, type Id, type TaskDetail } from '@/lib/hq-admin-view'
import { formatDuration, formatUsd, minutesSince } from '@/lib/office-view'
import { errText, fill, usePoll } from './api'

const t = admin.cc.drawer
const tt = admin.cc.tasks
const deptName = (id: string) => (admin.office.depts as Record<string, string>)[id] ?? id

const dateTime = (iso: string | null, tz: string) => {
  if (!iso) return ''
  const d = Date.parse(iso)
  if (Number.isNaN(d)) return ''
  try {
    return new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d)
  } catch {
    return iso
  }
}

const statusLabel = (status: string) => {
  const col = taskColumn(status)
  return col === 'gone' ? status : tt.columns[col]
}

function Body({
  id,
  now,
  tz,
  onOpen,
  onRetry,
}: {
  id: Id
  now: number
  tz: string
  onOpen: (id: Id) => void
  onRetry: (task: HqTask) => Promise<void>
}) {
  const { data, error, reload } = usePoll<TaskDetail>(`tasks/${encodeURIComponent(String(id))}`)
  if (!data) {
    return (
      <p role="status" className={cn('p-5 text-sm', error ? 'text-danger' : 'text-muted')}>
        {error ? fill(t.failed, { e: errText(error) }) : t.loading}
      </p>
    )
  }
  const { task, events, approvals, children } = data
  const blocked = taskColumn(task.status) === 'blocked'
  const facts: [string, string][] = [
    [t.status, statusLabel(task.status)],
    [t.dept, deptName(task.dept)],
    [t.assignee, task.assigneeTitle ?? '-'],
    [t.created, dateTime(task.createdAt, tz)],
    [t.updated, dateTime(task.updatedAt, tz)],
  ]
  if (task.dueAt) facts.push([t.due, dateTime(task.dueAt, tz)])
  if (task.tags?.length) facts.push([t.tags, task.tags.join(', ')])
  if (task.creator) facts.push([t.creator, task.creator])
  if (typeof task.costUsd === 'number') facts.push([t.cost, formatUsd(task.costUsd)])
  return (
    <div className="grid gap-6 p-5">
      <div>
        <h2 id="cc-drawer-title" className="text-lg leading-snug font-medium break-words">
          {task.title}
        </h2>
        {task.progressLine ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-accent-text">
            <span aria-hidden="true" className="office-breathe size-1.5 rounded-full bg-accent" />
            {task.progressLine}
          </p>
        ) : null}
        {blocked ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 p-3">
            <p className="min-w-0 flex-1 text-sm text-danger">{blockedReason(task)}</p>
            <button
              type="button"
              onClick={async () => {
                await onRetry(task)
                await reload()
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-fg px-4 text-sm font-medium text-bg"
            >
              <ArrowClockwise size={14} weight="bold" aria-hidden="true" />
              {tt.retry}
            </button>
          </div>
        ) : null}
      </div>

      {task.body ? <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-muted">{task.body}</p> : null}
      {task.result ? (
        <section>
          <h3 className="mb-1.5 text-sm font-medium text-muted">{t.result}</h3>
          <p className="rounded-xl bg-bg/60 p-3 text-sm leading-relaxed whitespace-pre-wrap break-words">{task.result}</p>
        </section>
      ) : null}
      {task.parentId !== null && task.parentId !== undefined ? (
        <button
          type="button"
          onClick={() => onOpen(task.parentId as Id)}
          className="-my-2 inline-flex min-h-10 items-center gap-1.5 justify-self-start rounded-full border border-line px-3.5 text-xs text-muted hover:text-fg"
        >
          {fill(t.parent, { id: task.parentId })}
        </button>
      ) : null}

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
      </dl>

      {approvals.length ? (
        <section>
          <h3 className="mb-2 text-sm font-medium text-muted">{t.approvals}</h3>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {approvals.map((a) => (
              <li key={String(a.id)} className="rounded-xl border border-line bg-bg/40 p-3 text-sm">
                <p className="font-medium">{a.summary}</p>
                <p className="mt-1 line-clamp-3 text-xs text-muted">{a.parts?.join(' / ') || a.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {children.length ? (
        <section>
          <h3 className="mb-2 text-sm font-medium text-muted">{t.children}</h3>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
            {children.map((c) => (
              <li key={String(c.id)}>
                <button
                  type="button"
                  onClick={() => onOpen(c.id)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-surface-2"
                >
                  <span className="font-mono text-xs text-faint">#{c.id}</span>
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 text-xs text-muted">{statusLabel(c.status)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted">{t.journal}</h3>
        {events.length ? (
          <ol className="relative grid gap-3 border-l border-line pl-4">
            {[...events].reverse().map((e, i) => (
              <li key={`${e.at}-${i}`} className="relative text-sm">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-surface',
                    /block|fail/.test(e.kind) ? 'bg-danger' : i === 0 ? 'bg-accent' : 'bg-line-strong',
                  )}
                />
                <p className="break-words">{e.body}</p>
                <p className="mt-0.5 text-xs text-faint">
                  {e.actor} · <span className="font-mono">{e.kind}</span> ·{' '}
                  <span className="tabular-nums">{formatDuration(minutesSince(e.at, now) ?? 0)}</span>
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">{t.noEvents}</p>
        )}
      </section>
    </div>
  )
}

// Right-side drawer with a task's journal. Not modal for the data (polls on its own), but it traps
// nothing: Esc or the backdrop closes it and focus goes back where it was.
export function TaskDrawer({
  id,
  now,
  tz,
  onClose,
  onOpen,
  onRetry,
}: {
  id: Id | null
  now: number
  tz: string
  onClose: () => void
  onOpen: (id: Id) => void
  onRetry: (task: HqTask) => Promise<void>
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const open = id !== null
  useEffect(() => {
    if (!open) return
    const back = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      back?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            aria-hidden="true"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40"
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="false"
            aria-labelledby="cc-drawer-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 42 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[34rem] flex-col border-l border-line-strong bg-surface shadow-2xl"
          >
            <div className="flex min-h-14 items-center gap-2 border-b border-line py-2 pr-2 pl-5">
              <p className="font-mono text-sm text-muted">{fill(t.title, { id: id })}</p>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={t.close}
                className="ml-auto grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
              >
                <X size={18} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
              <Body key={String(id)} id={id} now={now} tz={tz} onOpen={onOpen} onRetry={onRetry} />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
