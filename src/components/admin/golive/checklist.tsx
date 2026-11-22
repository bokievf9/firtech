'use client'

import { ArrowSquareOut, CaretDown, Check, NotePencil } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { goliveText as t, type GoliveItem } from '@/content/golive'
import { cn } from '@/lib/cn'
import { formatTick, NOTE_MAX, type Progress } from '@/lib/golive'
import { fill, type GoliveData, type useGolive } from '@/components/admin/hub/golive'
import { inputClass } from '@/components/admin/hub/ui'

type Send = ReturnType<typeof useGolive>['send']

export function Bar({ p, className }: { p: Progress; className?: string }) {
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

// Saves on blur (Enter too), Escape drops the edit. Keyed by the saved note so a server answer
// resets the draft.
function NoteField({ note, label, onSave }: { note: string; label: string; onSave: (text: string) => void }) {
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
      className={cn(inputClass, '!py-2')}
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
  const [open, setOpen] = useState(false)
  const id = `golive-${item.id}`
  return (
    <li className="rounded-xl bg-inset">
      <div className="flex items-start gap-1 px-2 py-1.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-labelledby={`${id}-title`}
          onClick={() => onToggle(!done)}
          className="grid size-11 shrink-0 place-items-center rounded-full"
        >
          <motion.span
            whileTap={{ scale: 0.9 }}
            className={cn(
              'grid size-6 place-items-center rounded-md border-2 transition-colors',
              done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-field',
            )}
          >
            {done ? <Check size={14} weight="bold" aria-hidden="true" /> : null}
          </motion.span>
        </button>
        <div className="min-w-0 flex-1 py-1.5">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-more`}
            onClick={() => setOpen((v) => !v)}
            className="group block w-full text-left"
          >
            <span className="flex items-start gap-2">
              <span
                id={`${id}-title`}
                className={cn(
                  'min-w-0 flex-1 text-[0.95rem] leading-snug font-medium',
                  done && 'text-muted line-through decoration-line-strong',
                )}
              >
                {item.title}
              </span>
              {note ? <NotePencil size={16} aria-label={t.hasNote} className="mt-0.5 shrink-0 text-accent-text" /> : null}
              <CaretDown
                size={14}
                aria-hidden="true"
                className={cn('mt-1 shrink-0 text-faint transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')}
              />
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-muted">{item.hint}</span>
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-full px-2 font-medium',
                item.owner === 'owner' ? 'bg-dept-company-soft text-dept-company-text' : 'bg-dept-director-soft text-dept-director-text',
              )}
            >
              {item.owner === 'owner' ? t.you : t.claude}
            </span>
            {item.link ? (
              <a
                href={item.link}
                aria-label={`${t.link}: ${item.title}`}
                title={t.link}
                className="inline-flex size-7 items-center justify-center rounded-full text-muted hover:text-accent-text"
              >
                <ArrowSquareOut size={15} aria-hidden="true" />
              </a>
            ) : null}
            {doneAt ? <span className="font-mono text-faint">{fill(t.ticked, { t: formatTick(doneAt) })}</span> : null}
          </div>
          <div
            id={`${id}-more`}
            inert={!open}
            className={cn(
              'grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
              open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <div className="pt-2.5 pb-1">
                <NoteField key={note} note={note} label={`${t.noteLabel}: ${item.title}`} onSave={onNote} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

// The checklist section below the stage: a sticky mini-nav of blocks (with per-block progress) and
// the blocks themselves as big cards.
export function Checklist({ data, send }: { data: GoliveData; send: Send }) {
  const reduce = useReducedMotion()
  const { state } = data
  const groups = useMemo(
    () =>
      data.blocks
        .map((b) => ({
          ...b,
          items: data.items.filter((i) => i.block === b.id),
          progress: data.groups.find((g) => g.id === b.id)?.progress ?? { done: 0, total: 0, percent: 0 },
        }))
        .filter((g) => g.items.length),
    [data.blocks, data.items, data.groups],
  )
  const [active, setActive] = useState<string | null>(null)
  const ids = groups.map((g) => g.id).join(',')

  useEffect(() => {
    const els = ids.split(',').map((i) => document.getElementById(`golive-block-${i}`)).filter((e): e is HTMLElement => !!e)
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id.replace('golive-block-', ''))
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [ids])

  const go = (id: string) =>
    document.getElementById(`golive-block-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })

  return (
    <section aria-labelledby="golive-checklist-title" className="bg-bg pb-24">
      <nav aria-label={t.blocksNav} className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <ul className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2.5 sm:px-6 [scrollbar-width:none]">
          {groups.map((g) => (
            <li key={g.id} className="shrink-0">
              <button
                type="button"
                onClick={() => go(g.id)}
                aria-current={active === g.id ? 'true' : undefined}
                className={cn(
                  'flex min-h-11 flex-col justify-center gap-1 rounded-xl border px-3 text-left transition-colors',
                  active === g.id ? 'border-accent bg-surface-2' : 'border-line hover:border-line-strong',
                )}
              >
                <span className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium">{g.title}</span>
                  <span className="font-mono text-xs text-muted tabular-nums">
                    {g.progress.done}/{g.progress.total}
                  </span>
                </span>
                <Bar p={g.progress} className="h-1" />
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
        <h2 id="golive-checklist-title" className="font-brand text-2xl sm:text-3xl">
          {t.checklist}
        </h2>
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
          {groups.map((g) => (
            <motion.section
              key={g.id}
              id={`golive-block-${g.id}`}
              aria-label={g.title}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="scroll-mt-20 rounded-card border border-line bg-surface p-4 sm:p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <h3 className="min-w-0 flex-1 font-brand text-lg">{g.title}</h3>
                <Bar p={g.progress} className="h-1.5 w-24 shrink-0" />
                <span className="w-10 shrink-0 text-right font-mono text-sm text-muted tabular-nums">
                  {g.progress.done}/{g.progress.total}
                </span>
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
            </motion.section>
          ))}
        </div>
      </div>
    </section>
  )
}
