'use client'

import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { admin } from '@/content/admin'
import type { CrmList } from '@/lib/admin-crm-hq'
import { btn, filterPill, inputClass, cn } from '@/components/admin/kit'
import { errText, fill, hq } from './api'
import type { CrmFeed } from './crm-hq-data'
import { LIST_LIMIT } from './crm-hq-data'

// Shared parts of the CRM panels: the same chip, search and drawer look as «Лиды», so the seven new
// panels differ only in their rows.

export const t = admin.crm.hq.common

export const label = (map: Record<string, string>, key: string) => map[key] || key

export function Chips({
  name,
  chips,
  value,
  onChange,
}: {
  name: string
  chips: { key: string; label: string; count?: number }[]
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={name}>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          aria-pressed={value === c.key}
          onClick={() => onChange(c.key)}
          className={filterPill(value === c.key)}
        >
          {c.label}
          {c.count !== undefined ? <span className="text-xs tabular-nums text-faint">{c.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, 'h-10 py-0 pl-10 pr-3.5 lg:pr-14')}
      />
      <kbd aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 font-mono text-xs text-faint lg:block">{admin.hub.searchKey}</kbd>
    </label>
  )
}

export function Pill({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'accent' | 'warn' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-caption whitespace-nowrap',
        tone === 'accent' && 'bg-accent/15 text-accent-text',
        tone === 'warn' && 'bg-danger/12 text-danger',
        tone === 'plain' && 'bg-fill-strong text-muted',
      )}
    >
      {children}
    </span>
  )
}

// Loading, error, «table does not exist» and the rows: one place decides which one the owner sees.
export function FeedBody<T>({
  feed,
  unavailable = t.unavailable,
  hint = t.unavailableHint,
  children,
}: {
  feed: CrmFeed<T>
  unavailable?: string
  hint?: string
  children: (list: CrmList<T>) => React.ReactNode
}) {
  const { list, error } = feed
  if (!list) {
    return error ? (
      <p className="flex items-center gap-3 text-sm text-danger" role="alert">
        {errText(error)}
        <button type="button" onClick={feed.reload} className="rounded-full border border-line-strong px-3 py-1 text-xs text-fg">
          {t.retry}
        </button>
      </p>
    ) : (
      <div className="h-32 skeleton skeleton-block" role="status" aria-label={t.loading} />
    )
  }
  if (!list.available) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-4" role="status">
        <p className="text-sm font-medium">{unavailable}</p>
        <p className="mt-1 text-xs text-muted">{hint}</p>
      </div>
    )
  }
  return <>{children(list)}</>
}

export function Count({ shown, list }: { shown: number; list: CrmList<unknown> }) {
  return (
    <>
      <p className="font-mono text-xs text-faint">{fill(t.found, { n: shown })}</p>
      {list.nextCursor ? <p className="text-xs text-faint">{fill(t.truncated, { n: LIST_LIMIT })}</p> : null}
    </>
  )
}

export const rowClass = (active: boolean) =>
  cn('w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-3', active && 'bg-surface-2')

export const listClass = 'grid max-h-[34rem] grid-cols-[minmax(0,1fr)] gap-0.5 overflow-y-auto overscroll-contain'

export const buttonClass = btn

// A write to HQ (a prospect's or ticket's status and note). On success the row is swapped in the
// feed; an illegal transition (409) refreshes the list, because the row moved under the owner.
export async function writeCrm(feed: CrmFeed<unknown>, path: string, body: Record<string, string>) {
  const res = await hq<{ item?: unknown }>(path, body)
  if (res.ok && res.item && typeof res.item === 'object') {
    feed.replace(res.item)
    return { ok: true as const }
  }
  if (!res.ok && res.error === 'illegal_transition') feed.reload()
  return {
    ok: false as const,
    message: !res.ok && res.error === 'illegal_transition' ? t.illegal : fill(t.failed, { e: errText(res.ok ? 'hq_bad_response' : res.error) }),
  }
}

export function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-xs text-faint">{name}</h3>
      <div className="text-sm break-words whitespace-pre-wrap">{children}</div>
    </div>
  )
}

export function Status({ message }: { message: { text: string; bad?: boolean } | null }) {
  return (
    <p role="status" className={cn('text-sm empty:hidden', message?.bad ? 'text-danger' : 'text-accent-text')}>
      {message?.text}
    </p>
  )
}

// The owner's private note on a prospect or ticket, saved with its own button.
export function NoteEditor({ value, onSave }: { value: string; onSave: (note: string) => Promise<{ text: string; bad?: boolean }> }) {
  const [text, setText] = useState(value)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)
  return (
    <div>
      <label className="mb-1 block text-xs text-faint" htmlFor="crm-hq-note">
        {t.noteLabel}
      </label>
      <textarea
        id="crm-hq-note"
        value={text}
        maxLength={2000}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.notePlaceholder}
        className="w-full resize-y rounded-xl border border-line-strong bg-field p-3 text-base text-fg outline-none focus:border-accent md:text-sm"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || text === value}
          onClick={async () => {
            setBusy(true)
            setMessage(await onSave(text))
            setBusy(false)
          }}
          className={buttonClass}
        >
          {t.noteSave}
        </button>
        <Status message={message} />
      </div>
    </div>
  )
}

// Side drawer in the style of the lead drawer: overlay, Escape closes, content scrolls.
export function CrmDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <div className={cn('fixed inset-0 z-50 transition-[visibility] duration-300', open ? 'visible' : 'invisible')} aria-hidden={!open}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t.close}
        onClick={onClose}
        className={cn('absolute inset-0 bg-scrim transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={open ? title : undefined}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-line-strong bg-surface shadow-panel outline-none transition-transform duration-300 ease-out-expo',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {open ? (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold tracking-tight">{title}</h2>
                {subtitle ? <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.close}
                className="rounded-full border border-line p-2 text-muted transition-colors hover:text-fg"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6">{children}</div>
          </>
        ) : null}
      </div>
    </div>
  )
}
