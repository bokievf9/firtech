'use client'

import { Check, CloudSlash, Copy } from '@phosphor-icons/react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { errText, hq, POLL_HIDDEN, POLL_VISIBLE } from '@/components/admin/control/api'
import type { ToastMessage } from '@/components/admin/control/toast'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'

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

export function Offline({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div role="alert" className="m-3 flex flex-wrap items-center gap-3 rounded-card border border-danger/40 bg-surface p-4 sm:m-4">
      <CloudSlash size={24} weight="duotone" aria-hidden="true" className="shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{h.offline}</p>
        <p className="text-xs text-muted">{errText(error)}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-ink"
      >
        {h.retry}
      </button>
    </div>
  )
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-2 p-3 sm:p-4" role="status" aria-label={u.loading}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2/60" />
      ))}
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">{children}</p>
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
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs transition-colors hover:border-accent hover:text-accent-text disabled:opacity-40',
        className,
      )}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {done ? u.copied : label}
    </button>
  )
}

// A small confirm dialog: `ask` resolves true on «Да», false on cancel or Escape.
export function useConfirm() {
  const [state, setState] = useState<{ text: string; yes: string; danger: boolean; resolve: (ok: boolean) => void } | null>(null)
  const yesRef = useRef<HTMLButtonElement>(null)
  const ask = useCallback(
    (text: string, { yes = u.yes, danger = false }: { yes?: string; danger?: boolean } = {}) =>
      new Promise<boolean>((resolve) => setState({ text, yes, danger, resolve })),
    [],
  )
  const done = useCallback(
    (ok: boolean) => {
      state?.resolve(ok)
      setState(null)
    },
    [state],
  )
  useEffect(() => {
    if (!state) return
    yesRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        done(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [state, done])
  const dialog = state ? (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4">
      <div role="alertdialog" aria-modal="true" aria-label={state.text} className="w-full max-w-sm rounded-card border border-line-strong bg-surface p-5 shadow-2xl">
        <p className="text-sm leading-relaxed">{state.text}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => done(false)} className="inline-flex min-h-10 items-center rounded-full px-4 text-sm text-muted hover:text-fg">
            {u.cancel}
          </button>
          <button
            ref={yesRef}
            type="button"
            onClick={() => done(true)}
            className={cn(
              'inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium',
              state.danger ? 'bg-danger text-white' : 'bg-accent text-accent-ink',
            )}
          >
            {state.yes}
          </button>
        </div>
      </div>
    </div>
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
        <button
          key={c.key}
          type="button"
          aria-pressed={value === c.key}
          onClick={() => onChange(c.key)}
          className={cn(
            'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
            value === c.key ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-muted hover:border-accent hover:text-fg',
          )}
        >
          {c.label}
          {c.count !== undefined ? <span className="font-mono text-xs tabular-nums opacity-70">{c.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export const btn =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-line-strong px-4 text-sm transition-colors hover:border-accent hover:text-accent-text disabled:opacity-50'
export const btnPrimary =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50'
export const btnDanger =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-danger/50 px-4 text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-50'
export const inputClass =
  'ym-disable-keys w-full rounded-xl border border-line-strong bg-bg px-3 py-2 text-base text-fg outline-none focus:border-accent md:text-sm'
