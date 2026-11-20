'use client'

import { ArrowSquareOut, Check, Flag, Timer } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'motion/react'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errText } from '@/components/admin/control/api'
import { goliveText as t } from '@/content/golive'
import { cn } from '@/lib/cn'
import {
  agoText,
  applyAction,
  chipText,
  formatDeadline,
  formatTick,
  GOLIVE_HOURS,
  NOTE_MAX,
  parseAction,
  remaining,
  type GoliveAction,
  type GoliveState,
  type Progress,
} from '@/lib/golive'
import type { GoliveItem } from '@/content/golive'
import { btn, btnDanger, btnPrimary, inputClass, useConfirm } from './ui'

const REFRESH_MS = 60_000

type Block = { id: string; title: string }
export type GoliveData = {
  state: GoliveState
  items: GoliveItem[]
  blocks: Block[]
  progress: Progress
  groups: { id: string; progress: Progress }[]
}
type Notify = (text: string, tone?: 'info' | 'error') => void

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

// The go-live data: one GET on mount, then every 60 s while the tab is visible (the clock itself
// never polls: it counts from the deadline). Actions change the screen at once and roll back when
// the server refuses; the server answer replaces the local copy.
export function useGolive(notify: Notify) {
  const [data, setData] = useState<GoliveData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)

  const load = useCallback(async () => {
    const mine = generation.current
    try {
      const res = await fetch('/api/admin/golive', { cache: 'no-store' })
      const body = (await res.json()) as { ok?: boolean; error?: string } & Partial<GoliveData>
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'network')
      if (mine === generation.current) {
        setData(body as GoliveData)
        setError(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network')
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(() => void load(), 0)
    const id = setInterval(() => {
      if (!document.hidden) void load()
    }, REFRESH_MS)
    const onVisible = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(first)
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const send = useCallback(
    async (action: GoliveAction) => {
      if (!parseAction(action)) return false
      const before = data
      generation.current++
      if (data) {
        const state = applyAction(data.state, action, Date.now())
        const done = data.items.filter((i) => Object.hasOwn(state.done, i.id)).length
        setData({
          ...data,
          state,
          progress: {
            ...data.progress,
            done,
            percent: Math.round((done / data.items.length) * 100),
          },
        })
      }
      try {
        const res = await fetch('/api/admin/golive', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(action),
        })
        const body = (await res.json()) as { ok?: boolean; error?: string } & Partial<GoliveData>
        if (!res.ok || !body.ok) throw new Error(body.error ?? 'network')
        generation.current++
        setData(body as GoliveData)
        return true
      } catch (e) {
        generation.current++
        if (before) setData(before)
        notify(fill(t.saved, { e: errText(e instanceof Error ? e.message : 'network') }), 'error')
        return false
      }
    },
    [data, notify],
  )

  return { data, error, reload: load, send }
}

// A ticking clock for one component: once a second, only while the tab is visible.
function useClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null
    const run = () => {
      setNow(Date.now())
      if (id === null) id = setInterval(() => setNow(Date.now()), 1000)
    }
    const stop = () => {
      if (id !== null) clearInterval(id)
      id = null
    }
    const onVisibility = () => (document.hidden ? stop() : run())
    if (!document.hidden) run()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  return now
}

// ---- top bar chip ----

export function GoliveChip({
  state,
  onOpen,
  active,
}: {
  state: GoliveState | null
  onOpen: () => void
  active: boolean
}) {
  const now = useClock()
  const reduce = useReducedMotion()
  const r = remaining(state?.deadline, now)
  const started = !!state?.deadline
  const label = !started ? t.chipOff : r.over ? t.chipOver : `${t.chipOn} ${chipText(r)}`
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${t.open} (8)`}
      aria-label={`${label}. ${t.open}`}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 min-w-0 shrink-0 items-center gap-2 rounded-full border px-3 text-sm transition-colors',
        started && r.over
          ? 'border-danger/60 text-danger'
          : active
            ? 'border-accent-text bg-surface-2 text-fg'
            : 'border-line-strong text-muted hover:text-fg',
      )}
    >
      {started && !r.over ? (
        <motion.span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full bg-accent"
          animate={reduce ? undefined : { opacity: [1, 0.45, 1], scale: [1, 0.8, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <Timer size={16} aria-hidden="true" />
      )}
      {started ? (
        <span className="whitespace-nowrap">
          <span className={r.over ? undefined : 'hidden sm:inline'}>{r.over ? t.chipOver : `${t.chipOn} `}</span>
          {!r.over ? <span className="font-mono tabular-nums">{chipText(r)}</span> : null}
        </span>
      ) : (
        <span className="hidden whitespace-nowrap sm:inline">{t.chipOff}</span>
      )}
    </button>
  )
}

// ---- odometer ----

// One digit that rolls: a column 0-9 slides under a one-em window. Reduced motion swaps the text.
function Digit({ value, reduce }: { value: number; reduce: boolean }) {
  if (reduce) return <span className="inline-block h-[1em] w-[0.62em] text-center">{value}</span>
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden" aria-hidden="true">
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col"
        initial={false}
        animate={{ y: `${-value * 10}%` }}
        transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.8 }}
      >
        {Array.from({ length: 10 }, (_, d) => (
          <span key={d} className="block h-[1em] text-center">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

function Group({
  value,
  label,
  reduce,
  digits = 2,
}: {
  value: number
  label: string
  reduce: boolean
  digits?: number
}) {
  const text = String(value).padStart(digits, '0')
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex leading-none">
        {[...text].map((ch, i) => (
          <Digit key={i} value={Number(ch)} reduce={reduce} />
        ))}
      </span>
      <span className="font-sans text-[11px] leading-none tracking-wide text-muted">{label}</span>
    </div>
  )
}

function Countdown({ r, reduce }: { r: Remaining; reduce: boolean }) {
  const label = `${r.days} ${t.units[0]}, ${r.hours} ${t.units[1]}, ${r.minutes} ${t.units[2]}, ${r.seconds} ${t.units[3]}`
  const dayDigits = Math.max(2, String(r.days).length)
  return (
    <div className="@container">
      <div
        role="timer"
        aria-label={label}
        style={{ fontSize: 'clamp(1.75rem, 13.5cqw, 4.25rem)' }}
        className={cn(
          'flex items-start justify-center gap-[0.04em] font-mono font-medium tabular-nums',
          r.over ? 'text-danger' : 'text-fg',
        )}
      >
        <Group value={r.days} label={t.units[0]} reduce={reduce} digits={dayDigits} />
        <Sep />
        <Group value={r.hours} label={t.units[1]} reduce={reduce} />
        <Sep />
        <Group value={r.minutes} label={t.units[2]} reduce={reduce} />
        <Sep />
        <Group value={r.seconds} label={t.units[3]} reduce={reduce} />
      </div>
    </div>
  )
}

const Sep = () => (
  <span
    aria-hidden="true"
    className="h-[1em] w-[0.36em] -translate-y-[0.06em] text-center leading-none text-faint"
  >
    :
  </span>
)

type Remaining = ReturnType<typeof remaining>

// ---- checklist ----

// Inline note: saves on blur (Enter too), Escape drops the edit. Keyed by the saved note so a
// server answer resets the draft.
function NoteField({
  note,
  label,
  onSave,
}: {
  note: string
  label: string
  onSave: (text: string) => void
}) {
  const [draft, setDraft] = useState(note)
  return (
    <input
      type="text"
      value={draft}
      maxLength={NOTE_MAX}
      aria-label={label}
      placeholder={t.notePlaceholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() !== note) onSave(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(note)
          e.stopPropagation()
          e.currentTarget.blur()
        }
      }}
      className={cn(inputClass, 'mt-2 !py-1.5 !text-sm')}
    />
  )
}

function ItemRow({
  item,
  doneAt,
  note,
  onToggle,
  onNote,
}: {
  item: GoliveItem
  doneAt: string | undefined
  note: string
  onToggle: (done: boolean) => void
  onNote: (text: string) => void
}) {
  const done = !!doneAt
  const id = `golive-${item.id}`
  return (
    <li className="rounded-xl bg-inset px-3 py-2.5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-labelledby={`${id}-title`}
          onClick={() => onToggle(!done)}
          className="-m-1.5 grid size-11 shrink-0 place-items-center rounded-full"
        >
          <span
            className={cn(
              'grid size-6 place-items-center rounded-md border-2 transition-colors',
              done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-field',
            )}
          >
            {done ? <Check size={14} weight="bold" aria-hidden="true" /> : null}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p
            id={`${id}-title`}
            className={cn(
              'text-sm leading-snug font-medium',
              done && 'text-muted line-through decoration-line-strong',
            )}
          >
            {item.title}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted">{item.hint}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-full px-2 font-medium',
                item.owner === 'owner'
                  ? 'bg-dept-company-soft text-dept-company-text'
                  : 'bg-dept-director-soft text-dept-director-text',
              )}
            >
              {item.owner === 'owner' ? t.you : t.claude}
            </span>
            {item.link ? (
              <a
                href={item.link}
                {...(item.link.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                aria-label={`${t.link}: ${item.title}`}
                title={t.link}
                className="inline-flex size-6 items-center justify-center rounded-full text-muted hover:text-accent-text"
              >
                <ArrowSquareOut size={15} aria-hidden="true" />
              </a>
            ) : null}
            {doneAt ? (
              <span className="font-mono text-faint">
                {fill(t.ticked, { t: formatTick(doneAt) })}
              </span>
            ) : null}
          </div>
          <NoteField
            key={note}
            note={note}
            label={`${t.noteLabel}: ${item.title}`}
            onSave={onNote}
          />
        </div>
      </div>
    </li>
  )
}

function Bar({ p, className }: { p: Progress; className?: string }) {
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-full bg-surface-3', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={p.total}
      aria-valuenow={p.done}
    >
      <motion.div
        className="h-full rounded-full bg-accent"
        initial={false}
        animate={{ width: `${p.percent}%` }}
        transition={{ type: 'spring', stiffness: 140, damping: 24 }}
      />
    </div>
  )
}

// ---- panel body ----

export function GolivePanel({ golive }: { golive: ReturnType<typeof useGolive> }) {
  const { data, error, reload, send } = golive
  const now = useClock()
  const reduce = useReducedMotion() ?? false
  const { ask, dialog } = useConfirm()

  if (!data) {
    return error ? (
      <div role="alert" className="m-4 rounded-xl border border-danger/50 p-4 text-sm">
        <p className="text-danger">{t.loadFailed}</p>
        <button type="button" onClick={() => void reload()} className={cn(btn, 'mt-3')}>
          {t.retry}
        </button>
      </div>
    ) : (
      <p role="status" className="p-5 text-sm text-muted">
        {t.loading}
      </p>
    )
  }

  const { state } = data
  const started = !!state.deadline
  const r = remaining(state.deadline, now)
  const hours = GOLIVE_HOURS
  const groups = data.blocks
    .map((b) => ({
      ...b,
      items: data.items.filter((i) => i.block === b.id),
      progress: data.groups.find((g) => g.id === b.id)?.progress,
    }))
    .filter((g) => g.items.length)
  const all = data.progress

  const start = async () => {
    const preview = formatDeadline(new Date(Date.now() + hours * 3_600_000).toISOString())
    if (await ask(fill(t.startConfirm, { h: hours, d: preview }), { yes: t.yes }))
      void send({ action: 'start', hours })
  }
  const reset = async () => {
    if (await ask(t.resetConfirm, { yes: t.reset, danger: true })) void send({ action: 'reset' })
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 p-4 sm:p-5">
      <section
        aria-label={t.title}
        className="rounded-card border border-line bg-inset px-3 py-6 sm:px-6"
      >
        {started ? (
          <>
            <Countdown r={r} reduce={reduce} />
            <div className="mt-5 text-center text-sm">
              {r.over ? (
                <p className="font-medium text-danger">
                  {t.over}{' '}
                  <span className="font-normal text-muted">
                    ({fill(t.overAgo, { t: agoText(r) })})
                  </span>
                </p>
              ) : null}
              <p className="text-muted">
                {t.deadline}:{' '}
                <span className="font-mono tabular-nums text-fg">
                  {formatDeadline(state.deadline!)}
                </span>
              </p>
            </div>
          </>
        ) : (
          <div className="text-center">
            <Flag size={28} weight="duotone" aria-hidden="true" className="mx-auto text-muted" />
            <p className="mt-2 font-brand text-lg">{t.notStarted}</p>
            <p className="mt-1 text-sm text-muted">{t.notStartedHint}</p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {started ? (
            <>
              <button type="button" onClick={start} className={btn}>
                {t.restart}
              </button>
              <button type="button" onClick={reset} className={btnDanger}>
                {t.reset}
              </button>
            </>
          ) : (
            <button type="button" onClick={start} className={btnPrimary}>
              {fill(t.start, { h: hours })}
            </button>
          )}
        </div>
      </section>

      <section aria-label={fill(t.progress, { n: all.done, m: all.total, p: all.percent })}>
        <p className="mb-2 flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium">
            {fill(t.progress, { n: all.done, m: all.total, p: all.percent })}
          </span>
          {all.done === all.total && all.total > 0 ? (
            <span className="text-accent-text">{t.allDone}</span>
          ) : null}
        </p>
        <Bar p={all} className="h-2.5" />
      </section>

      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`golive-block-${g.id}`}>
          <div className="mb-2 flex items-center gap-3">
            <h3 id={`golive-block-${g.id}`} className="min-w-0 flex-1 truncate font-brand text-sm">
              {g.title}
            </h3>
            {g.progress ? (
              <>
                <Bar p={g.progress} className="h-1.5 w-20 shrink-0" />
                <span className="w-9 shrink-0 text-right font-mono text-xs text-muted tabular-nums">
                  {g.progress.done}/{g.progress.total}
                </span>
              </>
            ) : null}
          </div>
          <ul className="grid gap-2">
            {g.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                doneAt={state.done[item.id]}
                note={state.notes[item.id] ?? ''}
                onToggle={(done) => void send({ action: 'toggle', id: item.id, done })}
                onNote={(text) => void send({ action: 'note', id: item.id, text })}
              />
            ))}
          </ul>
        </section>
      ))}
      {dialog ? createPortal(dialog, document.body) : null}
    </div>
  )
}
