'use client'

import { ThumbsDown, ThumbsUp } from '@phosphor-icons/react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { hq } from '@/components/admin/control/api'
import { btn, inputClass, useHqView } from '@/components/admin/hub/ui'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { normalizeRatings, RATINGS_PATH, ratingKey, ratingsMap, withRating, type Rating } from '@/lib/quality-hq'
import { Fail } from './kq-ui'

const r = admin.hq.quality.rate

type Ctx = { map: Map<string, Rating>; set: (next: Rating) => void }
const RatingsContext = createContext<Ctx>({ map: new Map(), set: () => {} })

// One list of ratings per page (`GET quality/ratings`), so every reply shows its current mark. Polled slowly; a rating
// sent from the page is put in the list at once.
export function RatingsProvider({ children }: { children: ReactNode }) {
  const view = useHqView(RATINGS_PATH, normalizeRatings, { visible: 60_000, hidden: 180_000 })
  const list = view.view
  const mutate = view.mutate
  const map = useMemo(() => ratingsMap(list ?? []), [list])
  const set = useCallback((next: Rating) => mutate((cur) => withRating(cur, next)), [mutate])
  const value = useMemo(() => ({ map, set }), [map, set])
  return <RatingsContext.Provider value={value}>{children}</RatingsContext.Provider>
}

// Thumbs under an agent reply. Up sends at once, down opens a short optional note first. A repeat replaces the earlier rating.
export function RateButtons({ messageId, thread, className }: { messageId: string; thread: string; className?: string }) {
  const { map, set } = useContext(RatingsContext)
  const current = map.get(ratingKey(thread, messageId)) ?? null
  const [askNote, setAskNote] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<1 | -1 | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [last, setLast] = useState<{ value: 1 | -1; note?: string } | null>(null)

  const send = async (value: 1 | -1, text?: string) => {
    if (busy) return
    const trimmed = text?.trim()
    const body = { messageId, thread, value, ...(value === -1 && trimmed ? { note: trimmed } : {}) }
    setBusy(value)
    setError(null)
    setLast({ value, note: trimmed })
    const res = await hq<{ id?: unknown; lessonId?: unknown }>('quality/rate', body)
    setBusy(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    set({ id: typeof res.id === 'string' ? res.id : `${thread}:${messageId}`, messageId, thread, value, note: body.note ?? '', at: new Date().toISOString() })
    setSaved(typeof res.lessonId === 'string' && res.lessonId ? r.savedLesson : r.saved)
    setAskNote(false)
    setNote('')
  }

  const up = current?.value === 1
  const down = current?.value === -1
  return (
    <div className={cn('grid gap-1.5', className)} data-rate={messageId}>
      <div role="group" aria-label={r.group} className="flex flex-wrap items-center gap-1.5">
        <Pending
          pending={busy === 1}
          pendingLabel={r.sending}
          aria-pressed={up}
          aria-label={r.up}
          className={cn(btn, 'min-h-9 px-3 py-1', up && 'border-accent-text text-accent-text')}
          onClick={() => {
            setSaved(null)
            if (!up) void send(1)
          }}
          data-rate-up
        >
          <ThumbsUp size={16} weight={up ? 'fill' : 'regular'} aria-hidden="true" />
          {r.upShort}
        </Pending>
        <button
          type="button"
          aria-pressed={down}
          aria-label={r.down}
          aria-expanded={askNote}
          disabled={busy !== null}
          className={cn(btn, 'min-h-9 px-3 py-1', down && 'border-danger text-danger')}
          onClick={() => {
            setSaved(null)
            setAskNote(true)
          }}
          data-rate-down
        >
          <ThumbsDown size={16} weight={down ? 'fill' : 'regular'} aria-hidden="true" />
          {r.downShort}
        </button>
        <span className="text-xs text-faint" data-rate-state={up ? 'up' : down ? 'down' : 'none'}>
          {current ? `${r.current}: ${up ? r.up : r.down}` : r.none}
        </span>
      </div>
      {askNote ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send(-1, note)
          }}
        >
          <input
            className={cn(inputClass, 'min-h-9 min-w-0 flex-1 py-1')}
            value={note}
            maxLength={1000}
            placeholder={r.notePlaceholder}
            aria-label={r.noteLabel}
            onChange={(e) => setNote(e.target.value)}
            data-rate-note
          />
          <Pending type="submit" pending={busy === -1} pendingLabel={r.sending} className={cn(btn, 'min-h-9 py-1')} data-rate-send>
            {r.send}
          </Pending>
          <button type="button" className={cn(btn, 'min-h-9 py-1')} disabled={busy !== null} onClick={() => setAskNote(false)}>
            {r.cancel}
          </button>
        </form>
      ) : null}
      {error ? <Fail code={error} onRetry={() => void send(last?.value ?? 1, last?.note)} /> : null}
      {saved ? (
        <p role="status" className="text-xs text-accent-text" data-rate-saved>
          {saved}
        </p>
      ) : null}
    </div>
  )
}
