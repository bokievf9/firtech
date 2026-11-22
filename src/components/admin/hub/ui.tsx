'use client'

import { Check, CloudSlash, Copy, Tray } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { errText, hq, POLL_HIDDEN, POLL_VISIBLE } from '@/components/admin/control/api'
import { Pending } from '@/components/ui/pending'
import type { ToastMessage } from '@/components/admin/control/toast'
import { admin } from '@/content/admin'
import { btnPrimary, filterPill, cn } from '@/components/admin/kit'
import { fade, spring } from '@/lib/motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const h = admin.hub
const u = admin.pult.ui

// What every hub panel may use: the clock, toasts and opening another panel (links between panels).
export type HubApi = {
  now: number
  notify: (text: string, tone?: ToastMessage['tone']) => void
  open: (panel: string, tab?: string, focus?: string | null) => void
}
export const HubContext = createContext<HubApi>({ now: 0, notify: () => {}, open: () => {} })
export const useHub = () => useContext(HubContext)

// One GET endpoint through the proxy, kept as a normalized view. Polls like usePoll (visible/hidden
// tab); `mutate` changes the view optimistically and drops polls that started before it, so a slow
// poll never undoes the owner's click. `error` is set only while there is nothing to show.
export function useHqView<V>(
  path: string | null,
  normalize: (body: unknown) => V | null,
  { visible = POLL_VISIBLE * 3, hidden = POLL_HIDDEN * 2 }: { visible?: number; hidden?: number } = {},
) {
  const [view, setView] = useState<V | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadedPath, setLoadedPath] = useState<string | null>(null)
  const generation = useRef(0)
  const alive = useRef(true)
  const norm = useRef(normalize)
  useEffect(() => {
    norm.current = normalize
  })

  const load = useCallback(async () => {
    if (!path) return
    const started = generation.current
    const res = await hq<Record<string, unknown>>(path)
    if (!alive.current || started !== generation.current) return
    if (!res.ok) {
      setError(res.error)
      return
    }
    const next = norm.current(res)
    if (next === null) setError('hq_bad_response')
    else {
      setView(next)
      setLoadedPath(path)
      setError(null)
    }
  }, [path])

  useEffect(() => {
    alive.current = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        await load()
        if (alive.current) schedule(document.hidden ? hidden : visible)
      }, delay)
    }
    const onVisibility = () => schedule(document.hidden ? hidden : 0)
    schedule(0)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive.current = false
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load, visible, hidden])

  const mutate = useCallback((change: (current: V) => V) => {
    generation.current++
    setView((current) => (current === null ? current : change(current)))
  }, [])

  // A view loaded for another path (the week switcher) is shown dimmed until the new one arrives.
  const stale = path !== null && loadedPath !== null && loadedPath !== path
  return { view, error: view ? null : error, failed: error, stale, reload: load, mutate }
}

export function Offline({ error, onRetry }: { error: string; onRetry: () => void | Promise<unknown> }) {
  // The refresh button shows that it is working and ignores a second click meanwhile.
  const [busy, setBusy] = useState(false)
  const retry = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onRetry()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div role="alert" className="m-3 flex flex-wrap items-center gap-3 rounded-card border border-danger/40 bg-surface p-4 sm:m-5">
      <CloudSlash size={24} weight="duotone" aria-hidden="true" className="shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{h.offline}</p>
        <p className="text-xs text-muted">{errText(error)}</p>
      </div>
      <Pending
        pending={busy}
        pendingLabel={u.loading}
        onClick={() => void retry()}
        className={btnPrimary}
      >
        {h.retry}
      </Pending>
    </div>
  )
}

export function Loading({ rows = 3 }: { rows?: number }) {
  // Skeleton rows shaped like list rows (a glyph, two lines, a time) so the page does not jump when data lands.
  return (
    <div className="grid gap-1 p-3 sm:p-5" role="status" aria-label={u.loading}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
          <span aria-hidden="true" className="skeleton size-9 shrink-0 rounded-full" />
          <span aria-hidden="true" className="grid flex-1 gap-2">
            <span className={cn('skeleton block h-3.5', i % 2 ? 'w-2/5' : 'w-3/5')} />
            <span className="skeleton block h-3 w-1/4" />
          </span>
        </div>
      ))}
    </div>
  )
}

// Nothing here yet: a quiet centered note with the glyph of the list, never a bare dashed box.
export function Empty({ children, icon: Glyph = Tray }: { children: React.ReactNode; icon?: typeof Tray }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-card border border-dashed border-line px-6 py-10 text-center">
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-fill text-faint">
        <Glyph size={20} />
      </span>
      <p className="max-w-sm text-callout text-muted">{children}</p>
    </div>
  )
}

export function CopyButton({ text, label = u.copy, className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => setDone(false), 1600)
    return () => clearTimeout(id)
  }, [done])
  return (
    <button
      type="button"
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
        } catch {
          setDone(false)
        }
      }}
      className={cn(
        'pressable inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs hover:bg-fill disabled:opacity-40',
        className,
      )}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {done ? u.copied : label}
    </button>
  )
}

// A small confirm dialog: `ask` resolves true on «Да», false on cancel or Escape. It leaves with an exit
// animation: `done` only marks it closing and resolves at once (the caller never waits for the animation);
// the element is removed when the exit finishes. `dialog` is still null until the first `ask`, so SSR and
// pages that never ask render nothing (an always-present element broke SSR on /admin/golive).
export function useConfirm() {
  const [state, setState] = useState<{ text: string; yes: string; danger: boolean; resolve: (ok: boolean) => void; closing: boolean } | null>(null)
  const yesRef = useRef<HTMLButtonElement>(null)
  const ask = useCallback(
    (text: string, { yes = u.yes, danger = false }: { yes?: string; danger?: boolean } = {}) =>
      new Promise<boolean>((resolve) => setState({ text, yes, danger, resolve, closing: false })),
    [],
  )
  const done = useCallback(
    (ok: boolean) => {
      if (!state || state.closing) return
      state.resolve(ok)
      setState({ ...state, closing: true })
    },
    [state],
  )
  const open = !!state && !state.closing
  useEffect(() => {
    if (!open) return
    yesRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        done(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, done])
  const reduce = useReducedMotion()
  const closing = !!state?.closing
  const dialog = state ? (
    <motion.div
      key="confirm"
      className={cn('fixed inset-0 z-[80] grid place-items-center bg-scrim p-4', closing && 'pointer-events-none')}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={fade}
      onAnimationComplete={() => {
        if (closing) setState(null)
      }}
    >
      <motion.div
        role="alertdialog"
        aria-modal={closing ? undefined : 'true'}
        aria-hidden={closing || undefined}
        aria-label={state.text}
        className="material-chrome w-full max-w-sm rounded-card p-5 shadow-dialog"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
        animate={closing ? (reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }) : { opacity: 1, scale: 1, y: 0 }}
        transition={reduce || closing ? fade : spring.snappy}
      >
        <p className="text-callout">{state.text}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => done(false)} className="pressable inline-flex min-h-10 items-center rounded-full px-4 text-sm text-muted hover:bg-fill-strong hover:text-fg">
            {u.cancel}
          </button>
          <button ref={yesRef} type="button" onClick={() => done(true)} className={state.danger ? 'pressable inline-flex min-h-10 items-center rounded-full bg-danger px-4 text-sm font-medium text-danger-ink' : btnPrimary}>
            {state.yes}
          </button>
        </div>
      </motion.div>
    </motion.div>
  ) : null
  return { ask, dialog }
}

// True while a modal dialog (a drawer or confirm) is open: the hub then leaves Escape and the
// number keys to it.
export function modalOpen(): boolean {
  for (const el of document.querySelectorAll<HTMLElement>('[aria-modal="true"]')) {
    if (el.closest('[aria-hidden="true"]')) continue
    if (getComputedStyle(el).visibility === 'hidden') continue
    return true
  }
  return false
}

export const typingIn = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

// Tabs inside a panel (filters, sub views): a row of pills with arrow keys.
export function Pills<K extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: { key: K; label: string; count?: number }[]
  value: K
  onChange: (key: K) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {items.map((c) => (
        <button key={c.key} type="button" aria-pressed={value === c.key} onClick={() => onChange(c.key)} className={filterPill(value === c.key, 'sm')}>
          {c.label}
          {c.count !== undefined ? <span className="text-xs tabular-nums text-faint">{c.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export { btn, btnPrimary, btnDanger, inputClass } from '@/components/admin/kit'
