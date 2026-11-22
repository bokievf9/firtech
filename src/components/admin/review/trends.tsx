'use client'

import { LinkSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { errText, hq } from '@/components/admin/control/api'
import { btn, btnPrimary, inputClass, useHqView } from '@/components/admin/hub/ui'
import { Chip, type Tone } from '@/components/admin/shell-crm/bits'
import { normalizeTrends, TREND_LABELS, trendUrlProblem, type TrendStatus } from '@/lib/review'
import { Dialog } from './dialogs'

const TONE: Record<TrendStatus, Tone> = { analysing: 'dim', proposed: 'accent', done: 'plain', failed: 'bad' }

// The owner's links for the Trendwatcher: a dialog (URL + note) and a short list with the status of
// each link; a `proposed` link points at the item it grew into.
export function useTrends() {
  return useHqView('trends?limit=20', normalizeTrends, { visible: 20_000, hidden: 120_000 })
}

export function TrendDialog({ onClose, onSent }: { onClose: () => void; onSent: (message: string, tone?: 'info' | 'error') => void }) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const problem = trendUrlProblem(url)
  const submit = async () => {
    setTouched(true)
    if (problem || busy) return
    setBusy(true)
    const res = await hq<{ already?: boolean }>('trends', { url: url.trim(), ...(note.trim() ? { note: note.trim() } : {}) })
    setBusy(false)
    if (res.ok) {
      onSent(res.already ? 'This link is already in progress' : 'Link accepted. The Trendwatcher will go through it, the material will appear in review.')
      onClose()
    } else onSent(res.error === 'invalid_link' && typeof res.reason === 'string' ? `The link does not fit: ${res.reason}` : errText(res.error), 'error')
  }
  return (
    <Dialog title="Send a link to the Trendwatcher" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="grid gap-3"
      >
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted">Link to a post or a video (Instagram, TikTok, YouTube)</span>
          <input type="url" inputMode="url" autoComplete="off" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/shorts/..." aria-invalid={touched && !!problem} className={inputClass} />
          {touched && problem ? <span role="alert" className="text-xs text-danger">{problem}</span> : null}
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted">What you liked in it (optional)</span>
          <textarea value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn}>Cancel</button>
          <button type="submit" data-primary disabled={busy} className={btnPrimary}>{busy ? 'Sending' : 'Send'}</button>
        </div>
      </form>
    </Dialog>
  )
}

export function TrendList({ view, error, onOpen }: { view: ReturnType<typeof useTrends>['view']; error: string | null; onOpen: (reviewId: string) => void }) {
  if (error && !view) return <p className="text-xs text-danger">{errText(error)}</p>
  if (!view?.items.length) return <p className="text-xs text-faint">No links yet.</p>
  return (
    <ul className="grid gap-1.5">
      {view.items.slice(0, 6).map((t) => (
        <li key={t.id} className="grid gap-1 rounded-xl border border-line bg-inset p-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="min-w-0 flex-1 truncate text-xs text-muted" title={t.url}>{t.host.replace(/^www\./, '')}{t.note ? `: ${t.note}` : ''}</span>
            <Chip tone={TONE[t.status]}>{TREND_LABELS[t.status]}</Chip>
          </div>
          {t.status === 'proposed' && t.reviewId ? (
            <button type="button" onClick={() => onOpen(t.reviewId!)} className="inline-flex min-h-8 items-center gap-1 self-start text-xs text-accent-text underline">
              <LinkSimple size={12} aria-hidden="true" />
              Open material
            </button>
          ) : null}
          {t.status === 'failed' && t.error ? <span className="text-xs text-danger">{t.error}</span> : null}
        </li>
      ))}
    </ul>
  )
}
