'use client'

import { Microphone, Sparkle } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { usePulse } from './pulse-provider'

const t = admin.pulse.echo

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

// "Ask Echo or add a task": a compact line instead of the hologram. A click or the "/" key opens the
// chat panel. `inline` sits in the page header on a desktop (a round button on a phone);
// `dock` is a bar fixed to the bottom of the screen like in a messenger.
export function EchoBar({
  variant,
  className,
}: {
  variant: 'inline' | 'dock'
  className?: string
}) {
  const { echo } = usePulse()
  const { show } = echo

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      if (document.querySelector('dialog[open]')) return
      e.preventDefault()
      show()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show])

  const line = (
    <button
      type="button"
      onClick={show}
      aria-haspopup="dialog"
      aria-expanded={echo.open}
      aria-keyshortcuts="/"
      className={cn(
        'flex h-12 w-full items-center gap-3 rounded-full border border-line-strong bg-surface px-4 text-left text-[15px] text-muted transition-colors hover:border-accent-text/70',
        variant === 'dock' && 'shadow-[0_8px_30px_rgb(0_0_0/0.25)]',
      )}
    >
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]"
      />
      <span className="min-w-0 flex-1 truncate">{t.bar}</span>
      {variant === 'inline' ? (
        <kbd className="hidden rounded-md border border-line-strong px-2 py-0.5 font-mono text-xs text-muted sm:inline">
          {t.key}
        </kbd>
      ) : (
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"
        >
          <Microphone size={18} weight="bold" />
        </span>
      )}
    </button>
  )

  if (variant === 'dock') {
    return (
      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] [background:linear-gradient(to_top,var(--color-bg)_55%,transparent)]',
          className,
        )}
      >
        <div className="pointer-events-auto mx-auto max-w-3xl">{line}</div>
      </div>
    )
  }
  return (
    <>
      <div className={cn('hidden lg:block', className)}>{line}</div>
      <button
        type="button"
        onClick={show}
        aria-label={t.open}
        className="fixed right-4 bottom-20 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-accent px-5 font-medium text-accent-ink shadow-[0_8px_30px_rgb(0_0_0/0.3)] transition-transform duration-150 active:scale-[0.97] lg:hidden"
      >
        <Sparkle size={20} weight="fill" aria-hidden="true" />
        {t.title}
      </button>
    </>
  )
}
