'use client'

import { X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { btn, btnPrimary, inputClass } from '@/components/admin/hub/ui'
import { resultText, type PublishResult } from '@/lib/review'

// Small modal dialogs of the review screen. They close on Escape (capturing it, so the page does not
// also leave for the office) and keep the focus inside by moving it to the first field.
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input,textarea,button[data-primary]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-scrim p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-card border border-line-strong bg-elevated p-5 shadow-dialog">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="-mt-1 -mr-2 grid size-10 place-items-center rounded-full text-muted hover:text-fg">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ScheduleDialog({ current, onSave, onClose }: { current: string; onSave: (day: string) => void; onClose: () => void }) {
  const [day, setDay] = useState(/^\d{4}-\d{2}-\d{2}$/.test(current) ? current : '')
  return (
    <Dialog title="Перенести на другой день" onClose={onClose}>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted">День публикации</span>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputClass} />
      </label>
      <p className="mt-2 text-xs text-faint">Время не хранится: материал выходит утренним проходом.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btn}>Отмена</button>
        <button type="button" data-primary disabled={!day} onClick={() => onSave(day)} className={btnPrimary}>Перенести</button>
      </div>
    </Dialog>
  )
}

export function CallDialog({ onSave, onClose }: { onSave: (iso: string) => void; onClose: () => void }) {
  const [at, setAt] = useState('')
  const iso = at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : ''
  return (
    <Dialog title="Назначить созвон" onClose={onClose}>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted">Дата и время (ваше локальное)</span>
        <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={inputClass} />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btn}>Отмена</button>
        <button type="button" data-primary disabled={!iso} onClick={() => onSave(iso)} className={btnPrimary}>Назначить</button>
      </div>
    </Dialog>
  )
}

export function ResultsDialog({ title, message, results, onClose }: { title: string; message: string | null; results: PublishResult[]; onClose: () => void }) {
  return (
    <Dialog title={title} onClose={onClose}>
      {message ? <p className="mb-3 text-sm text-muted">{message}</p> : null}
      {results.length ? (
        <ul className="grid gap-2">
          {results.map((r) => (
            <li key={r.platform} className="rounded-xl border border-line bg-inset p-3 text-sm">
              <span className={r.state === 'failed' || r.state === 'not_ready' ? 'text-danger' : undefined}>{resultText(r)}</span>
              {r.url ? (
                <a href={r.url} className="mt-1 block truncate text-xs text-accent-text underline">
                  {r.url}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Площадки не вернули подробностей.</p>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" data-primary onClick={onClose} className={btnPrimary}>Понятно</button>
      </div>
    </Dialog>
  )
}
