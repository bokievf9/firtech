'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'

const k = admin.pult.kanban

// Wide enough for columns side by side (the panel is full screen on a phone).
export function useWide(query = '(min-width: 768px)') {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => true,
  )
}

export type Column<T> = { key: string; label: string; items: T[]; muted?: boolean }

// A board: drag a card to another column (HTML drag and drop), or with the keyboard: arrows move
// the focus, Shift+Left/Right moves the focused card one column, Enter opens it. On a phone the board
// becomes one list grouped by column, each card with a column select.
export function Kanban<T>({
  label,
  columns,
  idOf,
  render,
  onOpen,
  onMove,
}: {
  label: string
  columns: Column<T>[]
  idOf: (item: T) => string
  render: (item: T) => React.ReactNode
  onOpen: (item: T) => void
  onMove: (item: T, to: string) => void
}) {
  const wide = useWide()
  const [over, setOver] = useState<string | null>(null)
  const dragged = useRef<T | null>(null)
  const refs = useRef(new Map<string, HTMLElement>())

  const focusCard = (col: number, row: number) => {
    const c = columns[col]
    const item = c?.items[Math.min(row, c.items.length - 1)]
    if (item) refs.current.get(idOf(item))?.focus()
  }

  const onKey = (e: React.KeyboardEvent, item: T, col: number, row: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(item)
    } else if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault()
      const to = columns[col + (e.key === 'ArrowRight' ? 1 : -1)]
      if (to) {
        onMove(item, to.key)
        requestAnimationFrame(() => refs.current.get(idOf(item))?.focus())
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      focusCard(col, Math.max(0, row + (e.key === 'ArrowDown' ? 1 : -1)))
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      let c = col
      do c += e.key === 'ArrowRight' ? 1 : -1
      while (columns[c] && !columns[c]!.items.length)
      if (columns[c]) focusCard(c, row)
    }
  }

  const card = (item: T, col: number, row: number) => (
    <li key={idOf(item)}>
      <div
        ref={(el) => {
          if (el) refs.current.set(idOf(item), el)
          else refs.current.delete(idOf(item))
        }}
        role="button"
        tabIndex={0}
        draggable={wide}
        onDragStart={(e) => {
          dragged.current = item
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', idOf(item))
        }}
        onDragEnd={() => {
          dragged.current = null
          setOver(null)
        }}
        onClick={() => onOpen(item)}
        onKeyDown={(e) => onKey(e, item, col, row)}
        className="cursor-pointer rounded-xl border border-line bg-inset p-2.5 text-sm transition-colors outline-none hover:border-line-strong focus-visible:border-accent active:cursor-grabbing"
      >
        {render(item)}
      </div>
    </li>
  )

  if (!wide) {
    return (
      <div className="grid gap-4" aria-label={label}>
        {columns.map((c) =>
          c.items.length ? (
            <section key={c.key} aria-label={c.label}>
              <h3 className="mb-1.5 flex items-center gap-2 text-xs text-muted">
                {c.label} <span className="font-mono tabular-nums text-faint">{c.items.length}</span>
              </h3>
              <ul className="grid gap-1.5">
                {c.items.map((item) => (
                  <li key={idOf(item)} className="rounded-xl border border-line bg-inset p-2.5 text-sm">
                    <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
                      {render(item)}
                    </button>
                    <label className="mt-2 flex items-center gap-2 text-xs text-faint">
                      {k.move}
                      <select
                        value={c.key}
                        onChange={(e) => onMove(item, e.target.value)}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-field px-2 text-sm text-fg"
                      >
                        {columns.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
      </div>
    )
  }

  return (
    <div aria-label={`${label}. ${k.keys}`} role="group" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
      {columns.map((c, col) => (
        <section
          key={c.key}
          aria-label={c.label}
          onDragOver={(e) => {
            if (!dragged.current) return
            e.preventDefault()
            setOver(c.key)
          }}
          onDragLeave={() => setOver((o) => (o === c.key ? null : o))}
          onDrop={(e) => {
            e.preventDefault()
            const item = dragged.current
            setOver(null)
            dragged.current = null
            if (item) onMove(item, c.key)
          }}
          className={cn(
            'flex w-56 shrink-0 flex-col rounded-2xl border bg-surface-2/40 p-2 transition-colors',
            over === c.key ? 'border-accent bg-accent/5' : 'border-line',
            c.muted && 'opacity-80',
          )}
        >
          <h3 className="mb-2 flex items-center justify-between px-1 text-xs text-muted">
            <span>{c.label}</span>
            <span className="font-mono tabular-nums text-faint">{c.items.length}</span>
          </h3>
          {c.items.length ? (
            <ul className="grid gap-1.5">{c.items.map((item, row) => card(item, col, row))}</ul>
          ) : (
            <p className="rounded-xl border border-dashed border-line px-2 py-4 text-center text-xs text-faint">{k.empty}</p>
          )}
        </section>
      ))}
    </div>
  )
}
