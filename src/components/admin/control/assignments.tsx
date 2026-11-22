'use client'

import { focusRow, focusRowClass, useFocusRow } from '@/components/admin/hub/focus-row'
import { PanelError, PanelWait } from './panel-error'
import { deptLabel } from '@/lib/admin-labels'
import { ArrowClockwise, BellRinging, MagnifyingGlass, PaperPlaneRight, Trash, UserFocus, X, XCircle } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { modalOpen, typingIn, useConfirm, useHub } from '@/components/admin/hub/ui'
import { filterPill, iconBtn, inputClass, cn } from '@/components/admin/kit'
import { admin } from '@/content/admin'
import { blockedReason, HISTORY_LIMIT, mergeHistory, normalizeDirectorHistory, plainBotText, type ChatMessage, type HqTask, type Id, type TaskColumn } from '@/lib/hq-admin-view'
import { formatDuration, formatUntil, minutesSince } from '@/lib/office-view'
import {
  buildTimeline,
  cancelText,
  completeCommand,
  ORDER_FILTERS,
  orderActions,
  orderCounts,
  remindText,
  sendOf,
  suggestCommands,
  type OrderAction,
  type OrderFilter,
  type PersonFilter,
  type TimelineEntry,
} from '@/lib/orders'
import { fill, hq } from './api'
import { ApprovalsSection, type ApprovalsProps } from './approvals-panel'
import { CcPanel } from './cc-panel'
import { chat, clearChat, clearedAt } from './chat-store'
import { runOrder } from './orders-run'

const t = admin.orders
const deptName = (id: string) => (admin.office.depts as Record<string, string>)[id] ?? deptLabel(id)
const PAGE = 60

const columnTone: Record<TaskColumn | 'gone', string> = {
  inbox: 'bg-line-strong',
  assigned: 'bg-line-strong',
  running: 'bg-accent',
  review: 'bg-fg/50',
  approval: 'bg-accent/50',
  blocked: 'bg-danger',
  done: 'bg-accent/30',
  gone: 'bg-line',
}
const statusText = (column: TaskColumn | 'gone') => (column === 'gone' ? t.status.cancelled : t.status[column])

const small =
  'pressable inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-footnote text-muted hover:bg-fill hover:text-fg disabled:pointer-events-none disabled:opacity-50'

function TaskEntry({
  e,
  now,
  busy,
  onOpen,
  onAction,
  focus,
}: {
  e: Extract<TimelineEntry, { kind: 'task' }>
  focus?: string | null
  now: number
  busy: string | null
  onOpen: (id: Id) => void
  onAction: (task: HqTask, action: OrderAction) => void
}) {
  const { task, column } = e
  const reason = column === 'blocked' ? blockedReason(task) : null
  const actions = orderActions(task)
  const age = minutesSince(task.updatedAt, now)
  return (
    <div className={cn('min-w-0 rounded-card border border-hairline bg-surface transition-colors hover:bg-surface-2', column === 'blocked' ? 'border-danger/40' : 'border-line', String(task.id) === focus && focusRowClass)} data-task={String(task.id)} {...focusRow(task.id, focus)}>
      <button type="button" onClick={() => onOpen(task.id)} aria-label={`${t.open}: ${task.title}`} className="block w-full rounded-t-card px-4 pt-3.5 pb-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-text">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fill-strong px-2.5 py-0.5 text-caption">
            <span aria-hidden="true" className={cn('size-1.5 rounded-full', columnTone[column])} />
            {statusText(column)}
          </span>
          <span className="text-xs text-muted">{deptName(task.dept)}</span>
          <span className="ml-auto font-mono text-[11px] text-faint">#{task.id}</span>
        </span>
        <span className="mt-1.5 block text-callout leading-snug font-medium break-words">{task.title}</span>
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          <span>{task.assigneeTitle ? `${t.assignee}: ${task.assigneeTitle}` : t.assignee}</span>
          <span className={task.dueAt ? '' : 'text-faint'}>{task.dueAt ? fill(t.deadline, { t: formatUntil(task.dueAt, now) || formatDuration(0) }) : t.noDeadline}</span>
          {age !== null ? <span className="text-faint tabular-nums">{formatDuration(age)}</span> : null}
        </span>
        {column === 'running' && task.progressLine ? (
          <span className="mt-1.5 flex items-center gap-1.5 text-xs text-accent-text">
            <span aria-hidden="true" className="office-breathe size-1.5 shrink-0 rounded-full bg-accent" />
            <span className="min-w-0 truncate">{task.progressLine}</span>
          </span>
        ) : null}
        {reason ? <span className="mt-1.5 block text-xs break-words text-danger">{reason}</span> : null}
      </button>
      {e.replies.length ? (
        <p className="mx-3.5 mb-2 border-l-2 border-line-strong pl-3 text-xs leading-relaxed whitespace-pre-wrap text-muted">
          <span className="sr-only">{t.reply}: </span>
          {plainBotText(e.replies[0]!)}
        </p>
      ) : null}
      {actions.length ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3.5">
          {actions.includes('start') ? (
            <button type="button" className={cn(small, 'text-accent-text')} disabled={busy !== null} onClick={() => onAction(task, 'start')}>
              <ArrowClockwise size={13} weight="bold" aria-hidden="true" className={busy === `start${task.id}` ? 'animate-spin' : ''} />
              {t.start}
            </button>
          ) : null}
          <button type="button" className={small} disabled={busy !== null} onClick={() => onAction(task, 'remind')}>
            <BellRinging size={13} aria-hidden="true" />
            {t.remind}
          </button>
          <button type="button" className={small} disabled={busy !== null} onClick={() => onAction(task, 'cancel')}>
            <XCircle size={13} aria-hidden="true" />
            {t.cancel}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ChatEntry({ e }: { e: Extract<TimelineEntry, { kind: 'me' | 'director' | 'error' }> }) {
  return (
    <div className={cn('flex flex-col', e.kind === 'me' ? 'items-end' : 'items-start')}>
      <span className="sr-only">{e.kind === 'me' ? t.you : t.director}: </span>
      <p
        className={cn(
          'max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words',
          e.kind === 'me' && 'rounded-br-md bg-fg text-bg',
          e.kind === 'director' && 'rounded-bl-md bg-surface-2',
          e.kind === 'error' && 'rounded-bl-md border border-danger/40 text-danger',
        )}
      >
        {e.text}
      </p>
    </div>
  )
}

// «Поручения»: the Director's chat and the tasks in one view. A composer on top (free text becomes a
// task, `/commands` run the bot's director commands), one timeline below with the tasks, their
// statuses and the Director's replies, filters and search. `N` focuses the composer.
export function Assignments({
  tasks,
  error,
  now,
  person,
  onPerson,
  onOpenTask,
  focus = null,
  onStart,
  onSent,
  approvals,
  className,
}: {
  tasks: HqTask[] | null
  error: string | null
  now: number
  person: PersonFilter
  onPerson: (p: PersonFilter) => void
  onOpenTask: (id: Id) => void
  // A task id from ⌘K (`?task=`): its entry is marked and scrolled into view.
  focus?: string | null
  onStart: (task: HqTask) => Promise<void>
  // Something changed in HQ (a task was given, a command ran): the page refreshes its panels.
  onSent: () => void
  // The approvals waiting for the owner, drawn as a section on top of the feed (same actions as the review centre's cards).
  approvals?: ApprovalsProps
  className?: string
}) {
  const { notify } = useHub()
  useFocusRow(focus, !!tasks)
  const { ask, dialog } = useConfirm()
  const local = useSyncExternalStore(chat.subscribe, chat.get, chat.server)
  const cleared = useSyncExternalStore(clearedAt.subscribe, clearedAt.get, clearedAt.server)
  // The Director's history from HQ (the timeline base), loaded once when the panel opens; this tab's own lines fill in what it lacks.
  const [history, setHistory] = useState<ChatMessage[]>([])
  useEffect(() => {
    let alive = true
    void hq<Record<string, unknown>>(`director/history?limit=${HISTORY_LIMIT}`).then((res) => {
      const items = res.ok ? normalizeDirectorHistory(res) : null
      if (alive && items) setHistory(items)
    })
    return () => {
      alive = false
    }
  }, [])
  const messages = useMemo(() => mergeHistory(history, local, cleared), [history, local, cleared])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState<OrderFilter>('all')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [hideSuggest, setHideSuggest] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const input = useRef<HTMLTextAreaElement>(null)

  const suggestions = hideSuggest ? [] : suggestCommands(text)
  const timeline = useMemo(() => buildTimeline(tasks, messages, { filter, query, person }), [tasks, messages, filter, query, person])
  const counts = useMemo(() => orderCounts(tasks, messages, person), [tasks, messages, person])
  const shown = timeline.slice(0, limit)

  // N puts the cursor in the composer from anywhere in the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyN' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      if (typingIn(e.target) || modalOpen()) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function send(raw: string) {
    const plan = sendOf(raw)
    if (!plan || sending) return
    setText('')
    setSending(true)
    const res = await runOrder(plan, raw.trim())
    setSending(false)
    if (res.ok) {
      if (res.taskId !== null) notify(fill(t.taskCreated, { id: res.taskId }))
      onSent()
    }
    input.current?.focus()
  }

  async function act(task: HqTask, action: OrderAction) {
    if (busy) return
    if (action === 'cancel' && !(await ask(fill(t.cancelAsk, { id: task.id }), { yes: t.cancelYes, danger: true }))) return
    setBusy(`${action}${task.id}`)
    if (action === 'start') {
      await onStart(task)
    } else {
      // «Напомнить» and «Отменить» have no HQ endpoint: they go to the Director in words, and both the line and its answer stay in the timeline.
      const res = await runOrder(
        { kind: 'say', text: action === 'cancel' ? cancelText(task) : remindText(task) },
        fill(action === 'cancel' ? t.cancelLine : t.remindLine, { id: task.id, t: task.title }),
      )
      if (res.ok) onSent()
    }
    setBusy(null)
  }

  const pick = (i: number) => {
    const c = suggestions[i]
    if (!c) return
    setText(completeCommand(c))
    setActive(0)
    input.current?.focus()
  }

  const personChip = person.assigneeId ? (
    <span className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-accent/15 pr-1 pl-3 text-footnote text-accent-text">
      <UserFocus size={14} aria-hidden="true" className="text-accent-text" />
      {fill(admin.cc.tasks.person, { name: person.label ?? person.assigneeId })}
      <button type="button" onClick={() => onPerson({ dept: person.dept, assigneeId: null })} aria-label={admin.cc.tasks.clear} className="pressable grid size-7 place-items-center rounded-full hover:bg-fill-strong">
        <X size={12} weight="bold" aria-hidden="true" />
      </button>
    </span>
  ) : null

  return (
    <CcPanel
      id="tasks"
      title={t.title}
      className={className}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-b-hairline border-line px-3 py-4 sm:px-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send(text)
            }}
            className="relative flex items-end gap-2 rounded-2xl border border-line-strong bg-field p-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-accent-text focus-within:ring-2 focus-within:ring-accent/25"
          >
            <label htmlFor="orders-composer" className="sr-only">
              {t.composerLabel}
            </label>
            <textarea
              id="orders-composer"
              ref={input}
              value={text}
              rows={2}
              maxLength={4000}
              placeholder={t.composer}
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls="orders-suggest"
              aria-autocomplete="list"
              aria-activedescendant={suggestions.length ? `orders-cmd-${active}` : undefined}
              onChange={(e) => {
                setText(e.target.value)
                setActive(0)
                setHideSuggest(false)
              }}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (suggestions.length) {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length)
                    return
                  }
                  if (e.key === 'Escape') {
                    // Closes the list, not the panel.
                    e.preventDefault()
                    e.stopPropagation()
                    setHideSuggest(true)
                    return
                  }
                  const cur = suggestions[active]
                  const typed = text.trim().slice(1).toLowerCase()
                  if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && cur && cur.name !== typed)) {
                    e.preventDefault()
                    pick(active)
                    return
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(text)
                }
              }}
              className="ym-disable-keys max-h-40 min-h-[3rem] flex-1 resize-none bg-transparent px-3 py-2.5 text-base leading-relaxed outline-none placeholder:text-faint [field-sizing:content] md:text-sm"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              aria-label={t.send}
              title={t.send}
              className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-40"
            >
              <PaperPlaneRight size={18} weight="fill" aria-hidden="true" />
            </button>
            {suggestions.length ? (
              <ul id="orders-suggest" role="listbox" aria-label={t.commands} className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line-strong bg-elevated p-1 shadow-dialog">
                {suggestions.map((c, i) => (
                  <li key={c.name} id={`orders-cmd-${i}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(i)}
                      className={cn('flex w-full items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm', i === active ? 'bg-surface-3' : 'hover:bg-surface-2')}
                    >
                      <span className="font-mono text-accent-text">/{c.name}</span>
                      {c.args ? <span className="font-mono text-xs text-faint">{c.args}</span> : null}
                      <span className="min-w-0 truncate text-xs text-muted">{c.help}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </form>
          <p className="mt-2 hidden px-1 text-caption text-faint sm:block">{t.hint}</p>
        </div>

        {approvals && (approvals.items === null ? approvals.error : approvals.items.length > 0 || approvals.queued > 0) ? (
          <section aria-label={t.approvals.title} data-orders-approvals className="border-b border-b-hairline border-line p-3 sm:px-5">
            <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-medium">
              {t.approvals.title}
              {approvals.items?.length ? <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs text-accent-ink tabular-nums">{approvals.items.length}</span> : null}
            </h3>
            <ApprovalsSection {...approvals} limit={3} />
          </section>
        ) : null}

        <div className="grid gap-2.5 px-3 pt-4 sm:px-5">
          <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label={t.filters.label}>
            {ORDER_FILTERS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => {
                  setFilter(id)
                  setLimit(PAGE)
                }}
                className={filterPill(filter === id, 'sm')}
              >
                {t.filters[id]}
                <span className="text-xs tabular-nums text-faint">{counts[id]}</span>
              </button>
            ))}
            {personChip}
          </div>
          <div className="flex items-center gap-2">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">{t.search}</span>
            <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setLimit(PAGE)
              }}
              placeholder={t.search}
              className={cn(inputClass, "min-h-10 pr-3 pl-9")}
            />
          </label>
            {messages.length ? (
              <button type="button" onClick={clearChat} aria-label={t.clear} title={t.clear} className={iconBtn}>
                <Trash size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div role="log" aria-live="polite" aria-relevant="additions" className="px-3 py-4 sm:px-5">
          {error && !tasks ? <PanelError error={error} /> : null}
          {!tasks && !error ? <PanelWait /> : null}
          {sending ? (
            <p className="mb-2.5 flex items-center gap-2 text-xs text-muted" role="status">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="office-breathe size-1.5 rounded-full bg-muted" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </span>
              {t.thinking}
            </p>
          ) : null}
          {tasks && !timeline.length ? <p className="rounded-card border border-dashed border-line px-3 py-10 text-center text-callout text-muted">{counts.all || messages.length ? t.nothing : t.empty}</p> : null}
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <AnimatePresence initial={false}>
              {shown.map((e) => (
                <motion.li key={e.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
                  {e.kind === 'task' ? <TaskEntry e={e} focus={focus} now={now} busy={busy} onOpen={onOpenTask} onAction={(task, a) => void act(task, a)} /> : <ChatEntry e={e} />}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {timeline.length > limit ? (
            <button type="button" className={cn(small, 'mx-auto mt-3')} onClick={() => setLimit(limit + PAGE)}>
              {fill(t.more, { n: timeline.length - limit })}
            </button>
          ) : null}
          {timeline.length ? <p className="mt-3 text-center text-[11px] text-faint">{fill(t.count, { n: Math.min(limit, timeline.length) })}</p> : null}
        </div>
      </div>
      {dialog}
    </CcPanel>
  )
}
