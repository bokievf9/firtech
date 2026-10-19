'use client'

import { X } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { usePulse } from './pulse-provider'

const t = admin.pulse.echo

// The chat code is loaded the first time Echo is opened, not with the page.
const EchoChat = dynamic(
  () => import('@/components/admin/echo-console').then((m) => m.EchoConsole),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="p-4 text-sm text-muted">
        {t.loading}
      </p>
    ),
  },
)

// The Echo chat as a panel over the page: a column on the right (`side`) or a sheet from the bottom
// (`bottom`: full width on a phone, centred on a desktop). Closed, it is hidden and inert, but the
// conversation stays mounted, so closing it does not lose what was said. Escape closes it.
export function EchoPanel({ placement }: { placement: 'side' | 'bottom' }) {
  const { echo, echoProps, tasks, closeTask } = usePulse()
  const ref = useRef<HTMLElement>(null)
  const { open, hide } = echo
  const { reload } = tasks

  // Move focus into the panel when it opens, back to the page when it closes.
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const id = setTimeout(() => document.getElementById('echo-input')?.focus(), 60)
    return () => {
      clearTimeout(id)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hide])

  if (!echo.mounted) return null
  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t.close}
        onClick={() => {
          hide()
          closeTask()
        }}
        className={cn(
          'fixed inset-0 z-[55] bg-black/50 transition-opacity duration-200 motion-reduce:transition-none',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        ref={ref}
        role="dialog"
        aria-label={t.title}
        inert={!open}
        className={cn(
          'fixed z-[60] flex flex-col border-line-strong bg-surface shadow-2xl transition-[transform,visibility] duration-300 ease-[var(--ease-out-expo)] motion-reduce:transition-none',
          placement === 'side'
            ? 'inset-y-0 right-0 w-full border-l sm:w-[28rem]'
            : 'inset-x-0 bottom-0 h-[82dvh] rounded-t-card border-t sm:inset-x-auto sm:left-1/2 sm:w-[44rem] sm:-translate-x-1/2',
          !open && 'invisible',
          !open && (placement === 'side' ? 'translate-x-full' : 'translate-y-full'),
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="flex items-center gap-2.5 font-brand text-lg font-bold tracking-tight">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]"
            />
            {t.title}
          </h2>
          <button
            type="button"
            onClick={hide}
            aria-label={t.close}
            className="grid size-11 place-items-center rounded-full border border-line text-muted transition-colors hover:text-fg"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 p-3 sm:p-4">
          <EchoChat {...echoProps} chat question={echo.question} onActs={() => void reload()} />
        </div>
      </aside>
    </>
  )
}
