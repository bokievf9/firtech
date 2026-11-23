'use client'

import { Trash } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fill, hq } from '@/components/admin/control/api'
import { btn, btnDanger, useHub } from '@/components/admin/hub/ui'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import { cn } from '@/components/admin/kit'
import { normalizePurge, purgeBody, requestError, type PurgeCounts } from '@/lib/content-studio'
import { fade, spring } from '@/lib/motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const p = admin.pult.content.studio.purge

// «Delete old materials»: a quiet header button, a confirm dialog that first asks HQ for a dry run, shows the numbers, then deletes.
// The dialog leaves with an exit animation like the shared confirm (`useConfirm`), it only differs by the checkbox and the numbers.
export function PurgeButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={btn} onClick={() => setOpen(true)} data-purge="open">
        <Trash size={16} aria-hidden="true" /> {p.open}
      </button>
      {open ? <PurgeDialog onClose={() => setOpen(false)} onDone={onDone} /> : null}
    </>
  )
}

function PurgeDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { notify } = useHub()
  const reduce = useReducedMotion()
  const [published, setPublished] = useState(false)
  const [counts, setCounts] = useState<PurgeCounts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [closing, setClosing] = useState(false)
  const generation = useRef(0)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setClosing(true), [])

  // The dry run: on open and every time the checkbox changes; a late answer of an older request is dropped.
  useEffect(() => {
    const mine = ++generation.current
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new dry run starts: the old numbers are stale
    setCounts(null)
    setError(null)
    void hq<Record<string, unknown>>('content/purge', purgeBody(true, published)).then((res) => {
      if (mine !== generation.current) return
      const next = res.ok ? normalizePurge(res) : null
      if (next) setCounts(next)
      else setError(requestError(p.countFailed, res.ok ? { error: 'hq_bad_response' } : res))
    })
  }, [published])

  useEffect(() => {
    if (closing) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        if (!busy) close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [closing, busy, close])

  async function run() {
    if (busy || !counts || counts.materials === 0) return
    setBusy(true)
    const res = await hq<Record<string, unknown>>('content/purge', purgeBody(false, published))
    const done = res.ok ? normalizePurge(res) : null
    setBusy(false)
    if (!done) {
      const msg = requestError(p.deleteFailed, res.ok ? { error: 'hq_bad_response' } : res)
      setError(msg)
      notify(msg, 'error')
      return
    }
    notify(fill(p.done, { materials: done.materials, orders: done.orders, files: done.files, approvals: done.approvals }))
    onDone()
    close()
  }

  const n = counts?.materials ?? 0
  const rows: [string, number][] = counts ? [[p.materials, counts.materials], [p.orders, counts.orders], [p.files, counts.files], [p.approvals, counts.approvals]] : []
  return (
    <motion.div
      className={cn('fixed inset-0 z-[80] grid place-items-center bg-scrim p-4', closing && 'pointer-events-none')}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={fade}
      onAnimationComplete={() => {
        if (closing) onClose()
      }}
    >
      <motion.div
        role="alertdialog"
        aria-modal={closing ? undefined : 'true'}
        aria-hidden={closing || undefined}
        aria-label={p.title}
        data-purge="dialog"
        className="material-chrome w-full max-w-sm rounded-card p-5 shadow-dialog"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
        animate={closing ? (reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }) : { opacity: 1, scale: 1, y: 0 }}
        transition={reduce || closing ? fade : spring.snappy}
      >
        <h2 className="text-callout font-medium">{p.title}</h2>
        <p className="mt-1.5 text-footnote text-muted">{p.intro}</p>
        <div className="mt-4 min-h-[5.5rem]" aria-live="polite" data-purge="numbers">
          {error ? (
            <p className="text-sm text-danger" data-purge="error">
              {error}
            </p>
          ) : counts ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right tabular-nums" data-purge-count={label.toLowerCase()}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-faint">{p.counting}</p>
          )}
          {counts && n === 0 ? <p className="mt-2 text-sm text-faint">{p.nothing}</p> : null}
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={published} disabled={busy} onChange={(e) => setPublished(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" data-purge="published" />
          <span>{p.includePublished}</span>
        </label>
        {published ? (
          <p className="mt-1.5 text-footnote text-danger" data-purge="warning">
            {p.publishedWarning}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" disabled={busy} onClick={close} className="pressable inline-flex min-h-10 items-center rounded-full px-4 text-sm text-muted hover:bg-fill-strong hover:text-fg disabled:opacity-50" data-purge="cancel">
            {p.cancel}
          </button>
          <Pending pending={busy} pendingLabel={p.deleting} disabled={!counts || n === 0} onClick={() => void run()} className={btnDanger} data-purge="confirm">
            {fill(p.confirm, { n })}
          </Pending>
        </div>
      </motion.div>
    </motion.div>
  )
}
