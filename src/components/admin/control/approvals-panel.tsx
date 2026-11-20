'use client'

import { Check, LockSimple, PencilSimple, SealCheck, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { approvalsView, sameId, type Approval, type Id } from '@/lib/hq-admin-view'
import { formatDuration, minutesSince } from '@/lib/office-view'
import { errText, fill } from './api'
import { CcPanel } from './cc-panel'

const t = admin.cc.approvals
const deptName = (id: string) => (admin.office.depts as Record<string, string>)[id] ?? id

type Act = (a: Approval, action: 'approve' | 'reject', part?: Id) => void
type Edit = (a: Approval, text: string, part?: Id) => Promise<boolean>

function EditableText({
  value,
  label,
  onSave,
}: {
  value: string
  label?: string
  onSave: (text: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const editing = draft !== null
  useEffect(() => {
    if (editing) area.current?.focus()
  }, [editing])
  return (
    <div className="grid gap-1.5">
      {label ? <p className="text-xs text-faint">{label}</p> : null}
      {editing ? (
        <>
          <textarea
            ref={area}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') setDraft(null)
            }}
            rows={Math.min(10, Math.max(3, Math.ceil(draft.length / 60)))}
            className="ym-disable-keys w-full resize-y rounded-xl border border-line-strong bg-field p-3 text-sm leading-relaxed outline-none focus:border-accent"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={async () => {
                setBusy(true)
                const ok = await onSave(draft)
                setBusy(false)
                if (ok) setDraft(null)
              }}
              className="inline-flex min-h-10 items-center rounded-full bg-fg px-4 text-sm font-medium text-bg disabled:opacity-50"
            >
              {t.save}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="inline-flex min-h-10 items-center rounded-full px-4 text-sm text-muted hover:text-fg"
            >
              {t.cancel}
            </button>
          </div>
        </>
      ) : (
        <div className="group/text relative">
          <p className="rounded-xl bg-inset p-3 pr-12 text-sm leading-relaxed whitespace-pre-wrap break-words">
            {value || <span className="text-faint">{t.emptyText}</span>}
          </p>
          <button
            type="button"
            onClick={() => setDraft(value)}
            aria-label={label ? `${t.edit}: ${label}` : t.edit}
            title={t.edit}
            className="absolute top-1.5 right-1.5 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-fg"
          >
            <PencilSimple size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

function ApprovalCard({
  a,
  now,
  focusKey,
  onAct,
  onEdit,
}: {
  a: Approval
  now: number
  focusKey: number | null
  onAct: Act
  onEdit: Edit
}) {
  const ref = useRef<HTMLElement>(null)
  const [sure, setSure] = useState(false)
  // content_item cards come in parts; picking one makes every button act on that part only.
  const [part, setPart] = useState<Id | undefined>(undefined)
  useEffect(() => {
    if (focusKey === null) return
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    ref.current?.focus({ preventScroll: true })
  }, [focusKey])
  const money = /pay|invoice|money|spend|budget|purchase/i.test(a.kind)
  const lockLabel = money ? t.locked : t.lockedOther
  const lockHint = money ? t.lockedHint : t.lockedOtherHint
  const approve = () => {
    if (a.locked && !sure) {
      setSure(true)
      return
    }
    onAct(a, 'approve', part)
  }
  return (
    <motion.article
      ref={ref}
      layout="position"
      tabIndex={0}
      aria-label={a.summary}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return
        const key = e.key.toLowerCase()
        if (key === 'a' || key === 'ф') {
          e.preventDefault()
          approve()
        } else if (key === 'r' || key === 'к') {
          e.preventDefault()
          onAct(a, 'reject', part)
        }
      }}
      className={cn(
        'grid gap-3 rounded-2xl border bg-inset p-4 outline-none transition-colors focus-visible:border-accent',
        a.locked ? 'border-danger/40' : 'border-line',
      )}
    >
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 text-sm font-medium break-words">{a.summary}</p>
        {a.locked ? (
          <span
            title={lockHint}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-danger/50 px-2 py-0.5 text-xs text-danger"
          >
            <LockSimple size={12} weight="bold" aria-hidden="true" />
            {lockLabel}
          </span>
        ) : null}
        <p className="basis-full text-xs text-faint">
          {[deptName(a.dept), a.kind, fill(t.level, { n: a.level }), a.taskId !== null ? fill(t.task, { id: a.taskId }) : null, formatDuration(minutesSince(a.createdAt, now) ?? 0)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>
      {a.parts?.length ? (
        <div role="group" aria-label={t.parts} className="flex flex-wrap gap-1.5">
          {[undefined, ...a.parts.map((p) => p.id)].map((pid) => {
            const active = pid === undefined ? part === undefined : sameId(part, pid)
            return (
              <button
                key={pid === undefined ? 'all' : String(pid)}
                type="button"
                aria-pressed={active}
                onClick={() => setPart(pid)}
                className={cn(
                  'inline-flex min-h-8 items-center rounded-full border px-3 text-xs transition-colors',
                  active ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:text-fg',
                )}
              >
                {pid === undefined ? t.allParts : a.parts!.find((p) => sameId(p.id, pid))!.label}
              </button>
            )
          })}
        </div>
      ) : null}
      <EditableText value={a.text} onSave={(text) => onEdit(a, text, part)} />
      {a.locked ? <p className="text-xs text-danger">{lockHint}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={approve}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-full px-5 text-sm font-medium transition-colors',
            sure ? 'bg-danger text-bg' : 'bg-accent text-accent-ink hover:bg-accent-strong',
          )}
        >
          <Check size={16} weight="bold" aria-hidden="true" />
          {sure ? t.sure : t.approve}
          <kbd className="ml-1 hidden rounded border border-current/30 px-1 font-mono text-[10px] opacity-70 sm:inline">A</kbd>
        </button>
        <button
          type="button"
          onClick={() => onAct(a, 'reject', part)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong px-5 text-sm transition-colors hover:border-danger/60 hover:text-danger"
        >
          <X size={16} weight="bold" aria-hidden="true" />
          {t.reject}
          <kbd className="ml-1 hidden rounded border border-current/30 px-1 font-mono text-[10px] opacity-70 sm:inline">R</kbd>
        </button>
        {sure ? (
          <button type="button" onClick={() => setSure(false)} className="min-h-11 px-3 text-sm text-muted hover:text-fg">
            {t.cancel}
          </button>
        ) : null}
      </div>
    </motion.article>
  )
}

export function ApprovalsPanel({
  items,
  error,
  now,
  badge,
  focus,
  queued,
  className,
  onAct,
  onEdit,
  onRelease,
}: {
  items: Approval[] | null
  error: string | null
  now: number
  badge: string | null
  focus: { id: Id; key: number } | null
  queued: number
  className?: string
  onAct: Act
  onEdit: Edit
  onRelease: () => Promise<void>
}) {
  const [releasing, setReleasing] = useState(false)
  const list = items ? approvalsView(items) : null
  return (
    <CcPanel
      id="approvals"
      title={t.title}
      icon={<SealCheck size={18} aria-hidden="true" />}
      badge={badge}
      className={className}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 lg:max-h-[30rem] min-[120rem]:max-h-[46rem]">
        {queued > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-line-strong p-3">
            <p className="min-w-0 flex-1 text-sm">
              {fill(t.queued, { n: queued })}
              <span className="block text-xs text-faint">{t.queuedHint}</span>
            </p>
            <button
              type="button"
              disabled={releasing}
              onClick={async () => {
                setReleasing(true)
                await onRelease()
                setReleasing(false)
              }}
              className="inline-flex min-h-10 items-center rounded-full bg-fg px-4 text-sm font-medium text-bg disabled:opacity-50"
            >
              {t.release}
            </button>
          </div>
        ) : null}
        {error && !list ? <p className="p-2 text-sm text-danger">{errText(error)}</p> : null}
        {!list && !error ? <div className="h-40 animate-pulse rounded-xl bg-surface-2/60" /> : null}
        {list && !list.length ? <p className="p-2 text-sm text-muted">{t.empty}</p> : null}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          <AnimatePresence initial={false} mode="popLayout">
            {list?.map((a) => (
              <ApprovalCard
                key={String(a.id)}
                a={a}
                now={now}
                focusKey={focus && sameId(focus.id, a.id) ? focus.key : null}
                onAct={onAct}
                onEdit={onEdit}
              />
            ))}
          </AnimatePresence>
        </div>
        {list?.length ? <p className="mt-3 hidden px-1 text-xs text-faint sm:block">{t.keys}</p> : null}
      </div>
    </CcPanel>
  )
}
